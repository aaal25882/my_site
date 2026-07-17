const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  session: null,
  profile: null,
  travelerProfile: null,
  orders: [],
  flights: [],
};

const roleLabels = { buyer: "خریدار", traveler: "حمل‌کننده", admin: "مدیر" };
const verificationLabels = { pending: "در انتظار تأیید", approved: "تأییدشده", rejected: "ردشده" };
const orderStatusLabels = {
  draft: "پیش‌نویس", open: "باز", matched: "حمل‌کننده یافت شد", purchased: "خریداری‌شده",
  in_transit: "در مسیر", delivered: "تحویل‌شده", cancelled: "لغوشده"
};
const flightStatusLabels = { active: "فعال", full: "تکمیل ظرفیت", completed: "انجام‌شده", cancelled: "لغوشده" };

function setMessage(element, text, type = "") {
  element.textContent = text;
  element.className = `form-message ${type}`.trim();
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(value));
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("fa-IR").format(value);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function showSection(name) {
  $$(".dashboard-nav button").forEach((button) => button.classList.toggle("active", button.dataset.section === name));
  $$(".dashboard-section").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === name));
  const active = $(`.dashboard-nav button[data-section="${name}"]`);
  $("#page-title").textContent = active?.textContent || "پنل کاربری";
}

function setupNavigation() {
  $$(".dashboard-nav button").forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.section));
  });
}

function setupTheme() {
  const saved = localStorage.getItem("aaal-theme") || "light";
  document.body.dataset.theme = saved;
  updateThemeButton(saved);
  $("#theme-toggle").addEventListener("click", () => {
    const next = document.body.dataset.theme === "light" ? "dark" : "light";
    document.body.dataset.theme = next;
    localStorage.setItem("aaal-theme", next);
    updateThemeButton(next);
  });
}

function updateThemeButton(theme) {
  $("#theme-toggle").textContent = theme === "light" ? "🌙 حالت تیره" : "☀️ حالت روشن";
}

async function loadSessionAndProfile() {
  if (!supabaseClient) throw new Error("اتصال Supabase تنظیم نشده است.");

  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !session) {
    location.replace("auth.html");
    return false;
  }
  state.session = session;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("id,full_name,role,phone,city,bio,verification_status,created_at")
    .eq("id", session.user.id)
    .single();

  if (error) throw new Error("پروفایل پیدا نشد. فایل schema.sql را اجرا کنید.");
  state.profile = profile;

  if (profile.role === "traveler") {
    const { data } = await supabaseClient.from("traveler_profiles").select("*").eq("user_id", profile.id).maybeSingle();
    state.travelerProfile = data;
  }
  return true;
}

function renderIdentity() {
  const { profile, session } = state;
  $("#sidebar-name").textContent = profile.full_name;
  $("#sidebar-role").textContent = `${roleLabels[profile.role]} • ${session.user.email || ""}`;
  $("#welcome-name").textContent = profile.full_name;
  const chip = $("#verification-chip");
  chip.textContent = verificationLabels[profile.verification_status] || profile.verification_status;
  chip.dataset.status = profile.verification_status;

  $("#nav-flights").hidden = profile.role !== "traveler" && profile.role !== "admin";
  $("#nav-admin").hidden = profile.role !== "admin";
  $("#traveler-profile-fields").hidden = profile.role !== "traveler";
  $("#traveler-buyer-hint").hidden = profile.role !== "traveler";

  if (profile.role === "buyer") {
    $("#role-notice").textContent = "از بخش سفارش‌ها درخواست خرید خود را ثبت و وضعیت آن را پیگیری کنید.";
  } else if (profile.role === "traveler" && profile.verification_status === "pending") {
    $("#role-notice").textContent = "اطلاعات حمل‌کننده را تکمیل کنید. پس از تأیید مدیریت، ثبت پرواز و مشاهده سفارش‌های باز فعال می‌شود.";
  } else if (profile.role === "traveler" && profile.verification_status === "approved") {
    $("#role-notice").textContent = "می‌توانید پروازهای خود را ثبت کنید، سفارش‌های باز را ببینید و برای خودتان نیز سفارش خرید بسازید.";
  } else if (profile.role === "traveler") {
    $("#role-notice").textContent = "حساب حمل‌کننده نیازمند اصلاح یا بررسی مجدد مدیریت است.";
  } else {
    $("#role-notice").textContent = "به همه کاربران، سفارش‌ها، پروازها و وضعیت تأیید حمل‌کنندگان دسترسی دارید.";
  }
}

function renderProfileForm() {
  const p = state.profile;
  $("#profile-full-name").value = p.full_name || "";
  $("#profile-phone").value = p.phone || "";
  $("#profile-city").value = p.city || "";
  $("#profile-bio").value = p.bio || "";
  if (p.role === "traveler") {
    const t = state.travelerProfile || {};
    $("#traveler-china-city").value = t.china_city || "";
    $("#traveler-university").value = t.university || "";
    $("#traveler-capacity").value = t.default_capacity_kg ?? "";
    $("#traveler-student-ref").value = t.student_id_reference || "";
    $("#traveler-notes").value = t.notes || "";
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const message = $("#profile-message");
  setMessage(message, "در حال ذخیره...");

  const profilePayload = {
    full_name: $("#profile-full-name").value.trim(),
    phone: $("#profile-phone").value.trim() || null,
    city: $("#profile-city").value.trim() || null,
    bio: $("#profile-bio").value.trim() || null,
  };

  const { error } = await supabaseClient.from("profiles").update(profilePayload).eq("id", state.profile.id);
  if (error) return setMessage(message, error.message, "error");

  if (state.profile.role === "traveler") {
    const travelerPayload = {
      user_id: state.profile.id,
      china_city: $("#traveler-china-city").value.trim() || null,
      university: $("#traveler-university").value.trim() || null,
      default_capacity_kg: $("#traveler-capacity").value || null,
      student_id_reference: $("#traveler-student-ref").value.trim() || null,
      notes: $("#traveler-notes").value.trim() || null,
    };
    const { error: travelerError } = await supabaseClient.from("traveler_profiles").upsert(travelerPayload);
    if (travelerError) return setMessage(message, travelerError.message, "error");
    state.travelerProfile = travelerPayload;
  }

  state.profile = { ...state.profile, ...profilePayload };
  renderIdentity();
  setMessage(message, "پروفایل با موفقیت ذخیره شد.", "success");
}

async function loadOrders() {
  let query = supabaseClient.from("orders").select("*").order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  state.orders = data || [];
  renderOrders();
}

function renderOrders() {
  const list = $("#orders-list");
  if (!state.orders.length) {
    list.innerHTML = '<div class="empty-state">هنوز سفارشی برای نمایش وجود ندارد.</div>';
    return;
  }
  list.innerHTML = state.orders.map((order) => `
    <article class="data-card">
      <div class="data-card-head">
        <div><h3>${escapeHtml(order.title)}</h3><span>${formatDate(order.created_at)}</span></div>
        <span class="status-pill">${orderStatusLabels[order.status] || order.status}</span>
      </div>
      <div class="data-meta">
        <span>تعداد: ${formatNumber(order.quantity)}</span>
        <span>وزن: ${formatNumber(order.weight_kg)} کیلو</span>
        <span>قیمت تقریبی: ${formatNumber(order.estimated_price)}</span>
        <span>مقصد: ${escapeHtml(order.destination_city || "—")}</span>
      </div>
      ${order.product_url ? `<a class="text-link" target="_blank" rel="noopener" href="${escapeHtml(order.product_url)}">مشاهده لینک محصول</a>` : ""}
      ${order.notes ? `<p>${escapeHtml(order.notes)}</p>` : ""}
    </article>
  `).join("");
}

async function createOrder(event) {
  event.preventDefault();
  const message = $("#order-message");
  setMessage(message, "در حال ثبت سفارش...");
  const payload = {
    buyer_id: state.profile.id,
    title: $("#order-title").value.trim(),
    product_url: $("#order-url").value.trim() || null,
    quantity: Number($("#order-quantity").value),
    weight_kg: $("#order-weight").value || null,
    color: $("#order-color").value.trim() || null,
    model: $("#order-model").value.trim() || null,
    estimated_price: $("#order-price").value || null,
    destination_city: $("#order-destination").value.trim() || null,
    notes: $("#order-notes").value.trim() || null,
  };
  const { error } = await supabaseClient.from("orders").insert(payload);
  if (error) return setMessage(message, error.message, "error");
  event.target.reset();
  $("#order-quantity").value = "1";
  setMessage(message, "سفارش با موفقیت ثبت شد.", "success");
  await loadOrders();
}

async function loadFlights() {
  const { data, error } = await supabaseClient.from("flights").select("*").order("departure_date", { ascending: true });
  if (error) throw error;
  state.flights = data || [];
  renderFlights();
}

function renderFlights() {
  const list = $("#flights-list");
  if (!state.flights.length) {
    list.innerHTML = '<div class="empty-state">هنوز پروازی ثبت نشده است.</div>';
    return;
  }
  list.innerHTML = state.flights.map((flight) => `
    <article class="data-card">
      <div class="data-card-head">
        <div><h3>${escapeHtml(flight.origin_city)} ← ${escapeHtml(flight.destination_city)}</h3><span>${formatDate(flight.departure_date)}</span></div>
        <span class="status-pill">${flightStatusLabels[flight.status] || flight.status}</span>
      </div>
      <div class="data-meta">
        <span>شرکت: ${escapeHtml(flight.airline || "—")}</span>
        <span>شماره پرواز: ${escapeHtml(flight.flight_number || "—")}</span>
        <span>ظرفیت کل: ${formatNumber(flight.capacity_kg)} کیلو</span>
        <span>ظرفیت آزاد: ${formatNumber(flight.available_capacity_kg)} کیلو</span>
      </div>
      ${flight.notes ? `<p>${escapeHtml(flight.notes)}</p>` : ""}
    </article>
  `).join("");
}

async function createFlight(event) {
  event.preventDefault();
  const message = $("#flight-message");
  if (state.profile.verification_status !== "approved") {
    return setMessage(message, "ثبت پرواز فقط برای حساب تأییدشده ممکن است.", "error");
  }
  const payload = {
    traveler_id: state.profile.id,
    origin_city: $("#flight-origin").value.trim(),
    destination_city: $("#flight-destination").value.trim(),
    departure_date: $("#flight-departure").value,
    arrival_date: $("#flight-arrival").value || null,
    airline: $("#flight-airline").value.trim() || null,
    flight_number: $("#flight-number").value.trim() || null,
    capacity_kg: Number($("#flight-capacity").value),
    available_capacity_kg: Number($("#flight-available").value),
    notes: $("#flight-notes").value.trim() || null,
  };
  const { error } = await supabaseClient.from("flights").insert(payload);
  if (error) return setMessage(message, error.message, "error");
  event.target.reset();
  setMessage(message, "پرواز با موفقیت ثبت شد.", "success");
  await loadFlights();
}

function renderStats() {
  const completedFields = [state.profile.full_name, state.profile.phone, state.profile.city].filter(Boolean).length;
  const profilePercent = Math.round((completedFields / 3) * 100);
  const cards = [
    ["تکمیل پروفایل", `${profilePercent}٪`],
    ["سفارش‌های قابل مشاهده", formatNumber(state.orders.length)],
  ];
  if (state.profile.role === "traveler" || state.profile.role === "admin") cards.push(["پروازها", formatNumber(state.flights.length)]);
  if (state.profile.role === "admin") cards.push(["سطح دسترسی", "مدیر کل"]);
  $("#stats-grid").innerHTML = cards.map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`).join("");

  const steps = [];
  if (!state.profile.phone || !state.profile.city) steps.push("شماره تماس و شهر خود را در پروفایل تکمیل کنید.");
  if (state.profile.role === "buyer" && !state.orders.length) steps.push("اولین درخواست خرید خود را ثبت کنید.");
  if (state.profile.role === "traveler" && state.profile.verification_status === "pending") steps.push("اطلاعات حمل‌کننده را کامل کنید تا مدیر حساب را بررسی کند.");
  if (state.profile.role === "traveler" && state.profile.verification_status === "approved" && !state.flights.length) steps.push("اولین پرواز و ظرفیت حمل خود را ثبت کنید.");
  if (!steps.length) steps.push("حساب شما آماده استفاده است؛ وضعیت سفارش‌ها و پروازها را پیگیری کنید.");
  $("#next-steps").innerHTML = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
}

async function loadAdmin() {
  if (state.profile.role !== "admin") return;
  const [profilesRes, ordersRes, flightsRes] = await Promise.all([
    supabaseClient.from("profiles").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("orders").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("flights").select("*").order("departure_date", { ascending: false }),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (ordersRes.error) throw ordersRes.error;
  if (flightsRes.error) throw flightsRes.error;
  renderAdminUsers(profilesRes.data || []);
  renderAdminOrders(ordersRes.data || []);
  renderAdminFlights(flightsRes.data || []);
}

function renderAdminUsers(users) {
  $("#admin-users").innerHTML = users.map((user) => `
    <article class="admin-row">
      <div><strong>${escapeHtml(user.full_name)}</strong><span>${roleLabels[user.role]} • ${escapeHtml(user.phone || "بدون شماره")}</span></div>
      <div class="admin-row-actions">
        <span class="status-pill">${verificationLabels[user.verification_status]}</span>
        ${user.role === "traveler" ? `
          <button data-user-status="approved" data-user-id="${user.id}">تأیید</button>
          <button data-user-status="rejected" data-user-id="${user.id}" class="danger-text">رد</button>
        ` : ""}
      </div>
    </article>
  `).join("") || '<div class="empty-state">کاربری وجود ندارد.</div>';

  $$('[data-user-status]').forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    const { error } = await supabaseClient.rpc("admin_set_traveler_status", {
      target_user: button.dataset.userId,
      new_status: button.dataset.userStatus,
    });
    if (error) alert(error.message);
    await loadAdmin();
  }));
}

function renderAdminOrders(orders) {
  $("#admin-orders").innerHTML = orders.map((o) => `
    <article class="admin-row"><div><strong>${escapeHtml(o.title)}</strong><span>${formatDate(o.created_at)} • ${orderStatusLabels[o.status]}</span></div><span>${formatNumber(o.estimated_price)}</span></article>
  `).join("") || '<div class="empty-state">سفارشی وجود ندارد.</div>';
}

function renderAdminFlights(flights) {
  $("#admin-flights").innerHTML = flights.map((f) => `
    <article class="admin-row"><div><strong>${escapeHtml(f.origin_city)} ← ${escapeHtml(f.destination_city)}</strong><span>${formatDate(f.departure_date)} • ${flightStatusLabels[f.status]}</span></div><span>${formatNumber(f.available_capacity_kg)} کیلو آزاد</span></article>
  `).join("") || '<div class="empty-state">پروازی وجود ندارد.</div>';
}

function setupAdminTabs() {
  $$(".admin-tabs button").forEach((button) => button.addEventListener("click", () => {
    $$(".admin-tabs button").forEach((b) => b.classList.toggle("active", b === button));
    $$(".admin-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `admin-${button.dataset.adminTab}`));
  }));
}

function setupActions() {
  $("#profile-form").addEventListener("submit", saveProfile);
  $("#order-form").addEventListener("submit", createOrder);
  $("#flight-form").addEventListener("submit", createFlight);
  $("#new-order-toggle").addEventListener("click", () => $("#order-form").hidden = !$("#order-form").hidden);
  $("#new-flight-toggle").addEventListener("click", () => $("#flight-form").hidden = !$("#flight-form").hidden);
  $("#logout-button").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    location.replace("auth.html");
  });
}

async function init() {
  setupTheme();
  setupNavigation();
  setupAdminTabs();
  setupActions();
  try {
    const ready = await loadSessionAndProfile();
    if (!ready) return;
    renderIdentity();
    renderProfileForm();
    $("#flight-verification-warning").hidden = !(state.profile.role === "traveler" && state.profile.verification_status !== "approved");
    $("#new-flight-toggle").disabled = state.profile.role === "traveler" && state.profile.verification_status !== "approved";
    await Promise.all([loadOrders(), (state.profile.role === "traveler" || state.profile.role === "admin") ? loadFlights() : Promise.resolve()]);
    renderStats();
    await loadAdmin();
    $("#dashboard-status").hidden = true;
  } catch (error) {
    console.error(error);
    $("#dashboard-status").textContent = error.message || "خطا در بارگذاری پنل";
    $("#dashboard-status").classList.add("error");
  }
}

supabaseClient?.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") location.replace("auth.html");
});

init();
