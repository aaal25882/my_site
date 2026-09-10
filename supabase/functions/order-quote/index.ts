import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type QuoteInput = {
  productPriceCny: number;
  quantity: number;
  category: string;
  manualWeightKg?: number | null;
  origin: string;
  destination: string;
  departureDate: string;
};

type PricingConfig = {
  categoryWeightsKg: Record<string, number>;
  travelerRecoveryRate: number;
  usableBaggageKg: number;
  platformMarginRate: number;
  platformFixedToman: number;
  minimumServiceToman: number;
  riskReserveRate: number;
};

const defaultConfig: PricingConfig = {
  categoryWeightsKg: {
    keyboard: 1.15,
    controller: 0.48,
    laptop: 2.35,
    phone: 0.52,
    tablet: 0.9,
    headphone: 0.55,
    accessory: 0.3,
  },
  travelerRecoveryRate: 0.40,
  usableBaggageKg: 23,
  platformMarginRate: 0.12,
  platformFixedToman: 180000,
  minimumServiceToman: 650000,
  riskReserveRate: 0.035,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function parseNumber(value: unknown): number | null {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function getCnyTomanRate(): Promise<{ value: number; timestamp: string }> {
  const apiKey = Deno.env.get("NAVASAN_API_KEY");
  if (apiKey) {
    const response = await fetch(`https://api.navasan.tech/latest/?api_key=${encodeURIComponent(apiKey)}&item=cny`, {
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const data = await response.json();
      const row = data?.cny || data?.data?.cny || data;
      const value = parseNumber(row?.value ?? row?.sell ?? row?.price);
      if (value) return { value, timestamp: row?.date || row?.update || new Date().toISOString() };
    }
  }

  const fallback = parseNumber(Deno.env.get("CNY_TO_TOMAN_FALLBACK"));
  if (!fallback) throw new Error("نرخ یوان تنظیم نشده است.");
  return { value: fallback, timestamp: "نرخ پشتیبان مدیریت" };
}

async function getAmadeusToken(): Promise<string | null> {
  const clientId = Deno.env.get("AMADEUS_CLIENT_ID");
  const clientSecret = Deno.env.get("AMADEUS_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const response = await fetch("https://api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.access_token || null;
}

async function getFlightPriceToman(input: QuoteInput, cnyToToman: number): Promise<number> {
  const token = await getAmadeusToken();
  if (token) {
    const params = new URLSearchParams({
      originLocationCode: input.origin,
      destinationLocationCode: input.destination,
      departureDate: input.departureDate,
      adults: "1",
      currencyCode: "CNY",
      max: "10",
      nonStop: "false",
    });
    const response = await fetch(`https://api.amadeus.com/v2/shopping/flight-offers?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      const prices = (data?.data || []).map((offer: any) => parseNumber(offer?.price?.grandTotal)).filter(Boolean) as number[];
      if (prices.length) {
        prices.sort((a, b) => a - b);
        const median = prices[Math.floor(prices.length / 2)];
        return median * cnyToToman;
      }
    }
  }

  const fallback = parseNumber(Deno.env.get("FLIGHT_PRICE_TOMAN_FALLBACK"));
  if (!fallback) throw new Error("قیمت مرجع پرواز تنظیم نشده است.");
  return fallback;
}

function getConfig(): PricingConfig {
  const raw = Deno.env.get("PRIVATE_PRICING_CONFIG_JSON");
  if (!raw) return defaultConfig;
  try { return { ...defaultConfig, ...JSON.parse(raw) }; } catch { return defaultConfig; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);

  try {
    const input = await req.json() as QuoteInput;
    const config = getConfig();
    const productPriceCny = parseNumber(input.productPriceCny);
    const quantity = Math.max(1, Math.min(100, Math.floor(Number(input.quantity || 1))));
    if (!productPriceCny) return json({ ok: false, message: "قیمت کالا معتبر نیست." }, 400);

    const unitWeight = input.category === "manual"
      ? parseNumber(input.manualWeightKg)
      : parseNumber(config.categoryWeightsKg[input.category]);
    if (!unitWeight) return json({ ok: false, message: "وزن یا دسته‌بندی کالا معتبر نیست." }, 400);

    const totalWeightKg = input.category === "manual" ? unitWeight : unitWeight * quantity;
    if (totalWeightKg > 23) return json({ ok: false, message: "این سفارش برای حمل مسافری بیش از حد سنگین است و نیاز به بررسی دستی دارد." }, 400);

    const fx = await getCnyTomanRate();
    const flightPriceToman = await getFlightPriceToman(input, fx.value);

    const merchandiseToman = productPriceCny * fx.value;
    const travelerTravelShare = flightPriceToman * config.travelerRecoveryRate;
    const travelerWeightShare = travelerTravelShare * (totalWeightKg / config.usableBaggageKg);
    const riskReserve = merchandiseToman * config.riskReserveRate;
    const platformFee = Math.max(config.platformFixedToman, travelerWeightShare * config.platformMarginRate);
    const serviceTotal = Math.max(config.minimumServiceToman, travelerWeightShare + riskReserve + platformFee);

    return json({
      ok: true,
      estimatedTotalToman: Math.ceil((merchandiseToman + serviceTotal) / 10000) * 10000,
      validForMinutes: 30,
      rateTimestamp: fx.timestamp,
    });
  } catch (error) {
    console.error(error);
    return json({ ok: false, message: error instanceof Error ? error.message : "خطای محاسبه" }, 500);
  }
});
