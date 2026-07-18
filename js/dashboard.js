const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = { session: null, profile: null, travelerProfile: null, orders: [], flights: [] };
const roleLabels = { buyer: "خریدار", traveler: "حمل‌کننده", admin: "مدیر" };
const verificationLabels = { pending: "در انتظار تأیید", approved: "تأییدشده", rejected: "ردشده" };
const documentStatusLabels = { missing: "ثبت نشده", pending: "در انتظار بررسی", approved: "تأییدشده", rejected: "ردشده" };
const orderStatusLabels = { draft: "پیش‌نویس", open: "باز", matched: "حمل‌کننده یافت شد", purchased: "خریداری‌شده", in_transit: "در مسیر", delivered: "تحویل‌شده", cancelled: "لغوشده" };
const flightStatusLabels = { active: "فعال", full: "تکمیل ظرفیت", completed: "انجام‌شده", cancelled: "لغوشده" };

function setMessage(el, text, type = "") { el.textContent = text; el.className = `form-message ${type}`.trim(); }
function formatDate(value) { return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(value)) : "—"; }
function formatNumber(value) { return value === null || value === undefined || value === "" ? "—" : new Intl.NumberFormat("fa-IR").format(value); }
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }

function showSection(name) {
  $$(".dashboard-nav button").forEach(b => b.classList.toggle("active", b.dataset.section === name));
  $$(".dashboard-section").forEach(p => p.classList.toggle("active", p.dataset.panel === name));
  const active = $(`.dashboard-nav button[data-section="${name}"]`);
  $("#page-title").textContent = active?.textContent || "پنل کاربری";
}
function setupNavigation() { $$(".dashboard-nav button").forEach(b => b.addEventListener("click", () => showSection(b.dataset.section))); }

async function loadSessionAndProfile() {
  if (!supabaseClient) throw new Error("اتصال Supabase تنظیم نشده است.");
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !session) { location.replace("auth.html"); return false; }
  state.session = session;
  const { data: profile, error } = await supabaseClient.from("profiles").select("*").eq("id", session.user.id).single();
  if (error) throw new Error("پروفایل پیدا نشد. فایل schema.sql را اجرا کنید.");
  state.profile = profile;
  if (profile.role === "traveler") {
    const { data, error: travelerError } = await supabaseClient.from("traveler_profiles").select("*").eq("user_id", profile.id).maybeSingle();
    if (travelerError) throw travelerError;
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
  if (profile.role === "buyer") $("#role-notice").textContent = "از بخش سفارش‌ها درخواست خرید خود را ثبت و وضعیت آن را پیگیری کنید.";
  else if (profile.role === "traveler" && profile.verification_status === "pending") $("#role-notice").textContent = "اطلاعات و مدرک خود را تکمیل کنید. پس از بررسی مدیریت، ثبت پرواز فعال می‌شود.";
  else if (profile.role === "traveler" && profile.verification_status === "approved") $("#role-notice").textContent = "می‌توانید پرواز ثبت کنید، سفارش‌های باز را ببینید و سفارش شخصی نیز بسازید.";
  else if (profile.role === "traveler") $("#role-notice").textContent = "حساب حمل‌کننده نیازمند اصلاح یا بررسی مجدد است.";
  else $("#role-notice").textContent = "به کاربران، سفارش‌ها، پروازها و مدارک حمل‌کنندگان دسترسی دارید.";
}

async function createDocumentUrl(path) {
  if (!path) return null;
  const { data, error } = await supabaseClient.storage.from("traveler-documents").createSignedUrl(path, 600);
  return error ? null : data.signedUrl;
}

async function renderTravelerDocument() {
  const box = $("#traveler-document-current");
  if (!box || !state.travelerProfile?.document_path) { if (box) box.hidden = true; return; }
  const url = await createDocumentUrl(state.travelerProfile.document_path);
  box.hidden = false;
  box.innerHTML = `<span>مدرک فعلی: ${escapeHtml(documentStatusLabels[state.travelerProfile.document_status] || "ثبت شده")}</span>${url ? `<a href="${url}" target="_blank" rel="noopener">مشاهده فایل</a>` : ""}`;
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
    $("#traveler-document-type").value = t.document_type || "student_card";
    $("#traveler-document-number").value = t.document_number || "";
    $("#traveler-notes").value = t.notes || "";
    renderTravelerDocument();
  }
}

async function uploadTravelerDocument(file) {
  if (!file) return state.travelerProfile?.document_path || null;
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) throw new Error("فرمت مدرک مجاز نیست.");
  if (file.size > 5 * 1024 * 1024) throw new Error("حجم مدرک باید کمتر از ۵ مگابایت باشد.");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${state.profile.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseClient.storage.from("traveler-documents").upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const oldPath = state.travelerProfile?.document_path;
  if (oldPath) await supabaseClient.storage.from("traveler-documents").remove([oldPath]);
  return path;
}

async function saveProfile(event) {
  event.preventDefault();
  const message = $("#profile-message");
  setMessage(message, "در حال ذخیره...");
  try {
    const profilePayload = { full_name: $("#profile-full-name").value.trim(), phone: $("#profile-phone").value.trim() || null, city: $("#profile-city").value.trim() || null, bio: $("#profile-bio").value.trim() || null };
    const { error } = await supabaseClient.from("profiles").update(profilePayload).eq("id", state.profile.id);
    if (error) throw error;
    if (state.profile.role === "traveler") {
      const file = $("#traveler-document-file").files[0];
      const documentPath = await uploadTravelerDocument(file);
      const travelerPayload = {
        user_id: state.profile.id,
        china_city: $("#traveler-china-city").value.trim() || null,
        university: $("#traveler-university").value.trim() || null,
        default_capacity_kg: $("#traveler-capacity").value || null,
        document_type: $("#traveler-document-type").value,
        document_number: $("#traveler-document-number").value.trim() || null,
        document_path: documentPath,
        notes: $("#traveler-notes").value.trim() || null,
      };
      const { data, error: travelerError } = await supabaseClient.from("traveler_profiles").upsert(travelerPayload).select().single();
      if (travelerError) throw travelerError;
      state.travelerProfile = data;
      $("#traveler-document-file").value = "";
      await renderTravelerDocument();
    }
    state.profile = { ...state.profile, ...profilePayload };
    renderIdentity();
    setMessage(message, "پروفایل با موفقیت ذخیره شد.", "success");
  } catch (error) { setMessage(message, error.message || "ذخیره پروفایل انجام نشد.", "error"); }
}

async function loadOrders() { const { data, error } = await supabaseClient.from("orders").select("*").order("created_at", { ascending: false }); if (error) throw error; state.orders = data || []; renderOrders(); }
function renderOrders() {
  const list = $("#orders-list");
  if (!state.orders.length) { list.innerHTML = '<div class="empty-state">هنوز سفارشی برای نمایش وجود ندارد.</div>'; return; }
  list.innerHTML = state.orders.map(order => `<article class="data-card"><div class="data-card-head"><div><h3>${escapeHtml(order.title)}</h3><span>${formatDate(order.created_at)}</span></div><span class="status-pill">${orderStatusLabels[order.status] || order.status}</span></div><div class="data-meta"><span>تعداد: ${formatNumber(order.quantity)}</span><span>وزن: ${formatNumber(order.weight_kg)} کیلو</span><span>قیمت تقریبی: ${formatNumber(order.estimated_price)}</span><span>مقصد: ${escapeHtml(order.destination_city || "—")}</span></div>${order.product_url ? `<a class="text-link" target="_blank" rel="noopener" href="${escapeHtml(order.product_url)}">مشاهده لینک محصول</a>` : ""}${order.notes ? `<p>${escapeHtml(order.notes)}</p>` : ""}</article>`).join("");
}
async function createOrder(event) {
  event.preventDefault(); const message = $("#order-message"); setMessage(message, "در حال ثبت سفارش...");
  const payload = { buyer_id: state.profile.id, title: $("#order-title").value.trim(), product_url: $("#order-url").value.trim() || null, quantity: Number($("#order-quantity").value), weight_kg: $("#order-weight").value || null, color: $("#order-color").value.trim() || null, model: $("#order-model").value.trim() || null, estimated_price: $("#order-price").value || null, destination_city: $("#order-destination").value.trim() || null, notes: $("#order-notes").value.trim() || null };
  const { error } = await supabaseClient.from("orders").insert(payload); if (error) return setMessage(message, error.message, "error"); event.target.reset(); $("#order-quantity").value = "1"; setMessage(message, "سفارش ثبت شد.", "success"); await loadOrders();
}

async function loadFlights() { const { data, error } = await supabaseClient.from("flights").select("*").order("departure_date", { ascending: true }); if (error) throw error; state.flights = data || []; renderFlights(); }
function renderFlights() {
  const list = $("#flights-list"); if (!state.flights.length) { list.innerHTML = '<div class="empty-state">هنوز پروازی ثبت نشده است.</div>'; return; }
  list.innerHTML = state.flights.map(f => `<article class="data-card"><div class="data-card-head"><div><h3>${escapeHtml(f.origin_city)} ← ${escapeHtml(f.destination_city)}</h3><span>${formatDate(f.departure_date)}</span></div><span class="status-pill">${flightStatusLabels[f.status] || f.status}</span></div><div class="data-meta"><span>شرکت: ${escapeHtml(f.airline || "—")}</span><span>شماره پرواز: ${escapeHtml(f.flight_number || "—")}</span><span>ظرفیت کل: ${formatNumber(f.capacity_kg)} کیلو</span><span>ظرفیت آزاد: ${formatNumber(f.available_capacity_kg)} کیلو</span></div>${f.notes ? `<p>${escapeHtml(f.notes)}</p>` : ""}</article>`).join("");
}
async function createFlight(event) {
  event.preventDefault(); const message = $("#flight-message");
  if (state.profile.verification_status !== "approved") return setMessage(message, "ثبت پرواز فقط برای حساب تأییدشده ممکن است.", "error");
  const payload = { traveler_id: state.profile.id, origin_city: $("#flight-origin").value.trim(), destination_city: $("#flight-destination").value.trim(), departure_date: $("#flight-departure").value, arrival_date: $("#flight-arrival").value || null, airline: $("#flight-airline").value.trim() || null, flight_number: $("#flight-number").value.trim() || null, capacity_kg: Number($("#flight-capacity").value), available_capacity_kg: Number($("#flight-available").value), notes: $("#flight-notes").value.trim() || null };
  const { error } = await supabaseClient.from("flights").insert(payload); if (error) return setMessage(message, error.message, "error"); event.target.reset(); setMessage(message, "پرواز ثبت شد.", "success"); await loadFlights();
}

function renderStats() {
  const completedFields = [state.profile.full_name, state.profile.phone, state.profile.city].filter(Boolean).length;
  const cards = [["تکمیل پروفایل", `${Math.round(completedFields / 3 * 100)}٪`], ["سفارش‌های قابل مشاهده", formatNumber(state.orders.length)]];
  if (["traveler", "admin"].includes(state.profile.role)) cards.push(["پروازها", formatNumber(state.flights.length)]);
  if (state.profile.role === "traveler") cards.push(["وضعیت مدرک", documentStatusLabels[state.travelerProfile?.document_status || "missing"]]);
  if (state.profile.role === "admin") cards.push(["سطح دسترسی", "مدیر کل"]);
  $("#stats-grid").innerHTML = cards.map(([l,v]) => `<article class="stat-card"><span>${l}</span><strong>${v}</strong></article>`).join("");
  const steps = [];
  if (!state.profile.phone || !state.profile.city) steps.push("شماره تماس و شهر خود را تکمیل کنید.");
  if (state.profile.role === "buyer" && !state.orders.length) steps.push("اولین درخواست خرید خود را ثبت کنید.");
  if (state.profile.role === "traveler" && !state.travelerProfile?.document_path) steps.push("تصویر یا فایل مدرک معتبر را بارگذاری کنید.");
  if (state.profile.role === "traveler" && state.profile.verification_status === "pending") steps.push("پس از تکمیل اطلاعات، منتظر بررسی مدیریت بمانید.");
  if (state.profile.role === "traveler" && state.profile.verification_status === "approved" && !state.flights.length) steps.push("اولین پرواز را ثبت کنید.");
  if (!steps.length) steps.push("حساب شما آماده استفاده است.");
  $("#next-steps").innerHTML = steps.map(s => `<li>${escapeHtml(s)}</li>`).join("");
}

async function loadAdmin() {
  if (state.profile.role !== "admin") return;
  const [profilesRes, travelerRes, ordersRes, flightsRes] = await Promise.all([
    supabaseClient.from("profiles").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("traveler_profiles").select("*"),
    supabaseClient.from("orders").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("flights").select("*").order("departure_date", { ascending: false })
  ]);
  for (const r of [profilesRes, travelerRes, ordersRes, flightsRes]) if (r.error) throw r.error;
  const travelers = Object.fromEntries((travelerRes.data || []).map(t => [t.user_id, t]));
  await renderAdminUsers(profilesRes.data || [], travelers);
  renderAdminOrders(ordersRes.data || []); renderAdminFlights(flightsRes.data || []);
}

async function renderAdminUsers(users, travelers) {
  const rows = await Promise.all(users.map(async user => {
    const t = travelers[user.id]; const url = t?.document_path ? await createDocumentUrl(t.document_path) : null;
    return `<article class="admin-row"><div><strong>${escapeHtml(user.full_name)}</strong><span>${roleLabels[user.role]} • ${escapeHtml(user.phone || "بدون شماره")}</span>${user.role === "traveler" ? `<small>مدرک: ${documentStatusLabels[t?.document_status || "missing"]}${t?.document_number ? ` • ${escapeHtml(t.document_number)}` : ""}</small>` : ""}</div><div class="admin-row-actions"><span class="status-pill">${verificationLabels[user.verification_status]}</span>${url ? `<a class="document-link" href="${url}" target="_blank" rel="noopener">مشاهده مدرک</a>` : ""}${user.role === "traveler" ? `<button data-user-status="approved" data-doc-status="approved" data-user-id="${user.id}">تأیید</button><button data-user-status="rejected" data-doc-status="rejected" data-user-id="${user.id}" class="danger-text">رد</button>` : ""}</div></article>`;
  }));
  $("#admin-users").innerHTML = rows.join("") || '<div class="empty-state">کاربری وجود ندارد.</div>';
  $$('[data-user-status]').forEach(button => button.addEventListener("click", async () => {
    button.disabled = true;
    const { error } = await supabaseClient.rpc("admin_set_traveler_status", { target_user: button.dataset.userId, new_status: button.dataset.userStatus, new_document_status: button.dataset.docStatus });
    if (error) alert(error.message); await loadAdmin();
  }));
}
function renderAdminOrders(orders) { $("#admin-orders").innerHTML = orders.map(o => `<article class="admin-row"><div><strong>${escapeHtml(o.title)}</strong><span>${formatDate(o.created_at)} • ${orderStatusLabels[o.status]}</span></div><span>${formatNumber(o.estimated_price)}</span></article>`).join("") || '<div class="empty-state">سفارشی وجود ندارد.</div>'; }
function renderAdminFlights(flights) { $("#admin-flights").innerHTML = flights.map(f => `<article class="admin-row"><div><strong>${escapeHtml(f.origin_city)} ← ${escapeHtml(f.destination_city)}</strong><span>${formatDate(f.departure_date)} • ${flightStatusLabels[f.status]}</span></div><span>${formatNumber(f.available_capacity_kg)} کیلو آزاد</span></article>`).join("") || '<div class="empty-state">پروازی وجود ندارد.</div>'; }
function setupAdminTabs() { $$(".admin-tabs button").forEach(button => button.addEventListener("click", () => { $$(".admin-tabs button").forEach(b => b.classList.toggle("active", b === button)); $$(".admin-panel").forEach(p => p.classList.toggle("active", p.id === `admin-${button.dataset.adminTab}`)); })); }
function setupActions() {
  $("#profile-form").addEventListener("submit", saveProfile); $("#order-form").addEventListener("submit", createOrder); $("#flight-form").addEventListener("submit", createFlight);
  $("#new-order-toggle").addEventListener("click", () => $("#order-form").hidden = !$("#order-form").hidden);
  $("#new-flight-toggle").addEventListener("click", () => $("#flight-form").hidden = !$("#flight-form").hidden);
  $("#logout-button").addEventListener("click", async () => { await supabaseClient.auth.signOut(); location.replace("auth.html"); });
}
async function init() {
  setupNavigation(); setupAdminTabs(); setupActions();
  try {
    if (!await loadSessionAndProfile()) return;
    renderIdentity(); renderProfileForm();
    $("#flight-verification-warning").hidden = !(state.profile.role === "traveler" && state.profile.verification_status !== "approved");
    $("#new-flight-toggle").disabled = state.profile.role === "traveler" && state.profile.verification_status !== "approved";
    await Promise.all([loadOrders(), ["traveler", "admin"].includes(state.profile.role) ? loadFlights() : Promise.resolve()]);
    renderStats(); await loadAdmin(); $("#dashboard-status").hidden = true;
  } catch (error) { console.error(error); $("#dashboard-status").textContent = error.message || "خطا در بارگذاری پنل"; $("#dashboard-status").classList.add("error"); }
}
supabaseClient?.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT") location.replace("auth.html"); });
init();
