# راه‌اندازی برآورد هزینه خصوصی

## 1) APIها
- از Navasan یک API Key بگیرید.
- در Amadeus for Developers یک App بسازید و Client ID / Client Secret دریافت کنید.

## 2) Secrets در Supabase
در Dashboard > Edge Functions > Secrets این موارد را ثبت کنید:

NAVASAN_API_KEY=...
AMADEUS_CLIENT_ID=...
AMADEUS_CLIENT_SECRET=...
CNY_TO_TOMAN_FALLBACK=...
FLIGHT_PRICE_TOMAN_FALLBACK=...
PRIVATE_PRICING_CONFIG_JSON={...}

نمونه تنظیمات خصوصی:
{"travelerRecoveryRate":0.4,"usableBaggageKg":23,"platformMarginRate":0.12,"platformFixedToman":180000,"minimumServiceToman":650000,"riskReserveRate":0.035,"categoryWeightsKg":{"keyboard":1.15,"controller":0.48,"laptop":2.35,"phone":0.52,"tablet":0.9,"headphone":0.55,"accessory":0.3}}

مقادیر واقعی را بر اساس سیاست کسب‌وکار خودتان تغییر دهید. فایل env یا کلیدها را در GitHub قرار ندهید.

## 3) Deploy
supabase login
supabase link --project-ref iowhgknspzchsywanlrl
supabase functions deploy order-quote

## 4) دیتابیس
فایل supabase/dynamic_quote_migration.sql را یک بار در SQL Editor اجرا کنید.

## نکته امنیتی
منطق محاسبه داخل Edge Function اجرا می‌شود؛ اما اگر سورس همین Function را در مخزن عمومی GitHub قرار دهید، ساختار کلی الگوریتم قابل مشاهده است. برای محرمانگی بیشتر، Function را از مخزن عمومی حذف و فقط مستقیم در Supabase نگهداری کنید. ضرایب اصلی در PRIVATE_PRICING_CONFIG_JSON قرار می‌گیرند و نباید در GitHub ثبت شوند.
