const quoteForm = document.getElementById("profit-calculator");
const quoteResult = document.getElementById("quote-result");
const quoteAmount = document.getElementById("quote-amount");
const quoteStatus = document.getElementById("quote-status");
const quoteMeta = document.getElementById("quote-meta");
const categorySelect = document.getElementById("product-category");
const manualWeightWrap = document.getElementById("manual-weight-wrap");
const manualWeightInput = document.getElementById("manual-weight");

const money = value => new Intl.NumberFormat("fa-IR").format(Math.round(value)) + " تومان";

function syncWeightMode() {
  const manual = categorySelect.value === "manual";
  manualWeightWrap.hidden = !manual;
  manualWeightInput.required = manual;
  if (!manual) manualWeightInput.value = "";
}

async function requestQuote(event) {
  event.preventDefault();
  quoteStatus.textContent = "در حال دریافت نرخ‌ها و محاسبه برآورد...";
  quoteStatus.className = "quote-status loading";
  quoteResult.hidden = true;

  const payload = {
    productPriceCny: Number(document.getElementById("product-price-cny").value),
    quantity: Number(document.getElementById("product-quantity").value),
    category: categorySelect.value,
    manualWeightKg: categorySelect.value === "manual" ? Number(manualWeightInput.value) : null,
    origin: document.getElementById("flight-origin").value,
    destination: document.getElementById("flight-destination").value,
    departureDate: document.getElementById("flight-date").value,
  };

  try {
    if (!payload.productPriceCny || payload.productPriceCny <= 0) throw new Error("مبلغ کالا به یوان را وارد کنید.");
    if (!payload.quantity || payload.quantity < 1) throw new Error("تعداد کالا معتبر نیست.");
    if (payload.category === "manual" && (!payload.manualWeightKg || payload.manualWeightKg <= 0)) throw new Error("وزن دستی را وارد کنید.");
    if (!payload.departureDate) throw new Error("تاریخ تقریبی سفر را انتخاب کنید.");

    if (!window.supabaseClient) throw new Error("اتصال Supabase در دسترس نیست.");
    const { data, error } = await supabaseClient.functions.invoke("order-quote", { body: payload });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.message || "برآورد انجام نشد.");

    quoteAmount.textContent = money(data.estimatedTotalToman);
    quoteMeta.textContent = `نرخ‌های مرجع: ${data.rateTimestamp || "امروز"} • اعتبار برآورد: ${data.validForMinutes || 30} دقیقه`;
    quoteResult.hidden = false;
    quoteStatus.textContent = "این مبلغ برآورد اولیه است؛ مبلغ قطعی بعد از بررسی لینک، وزن و تأیید سفارش اعلام می‌شود.";
    quoteStatus.className = "quote-status success";
  } catch (error) {
    console.error(error);
    quoteStatus.textContent = error.message || "دریافت برآورد ممکن نشد. دوباره تلاش کنید.";
    quoteStatus.className = "quote-status error";
  }
}

if (quoteForm) {
  categorySelect.addEventListener("change", syncWeightMode);
  quoteForm.addEventListener("submit", requestQuote);
  syncWeightMode();

  const dateInput = document.getElementById("flight-date");
  const tomorrow = new Date(Date.now() + 86400000);
  dateInput.min = tomorrow.toISOString().slice(0, 10);
}
