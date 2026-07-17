const tabs = document.querySelectorAll("[data-tab]");
const panels = document.querySelectorAll("[data-panel]");
const message = document.getElementById("auth-message");
const roleSelect = document.getElementById("role");
const requestedRole = new URLSearchParams(location.search).get("role");

if (["buyer", "traveler"].includes(requestedRole)) {
  roleSelect.value = requestedRole;
}

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `auth-message show ${type}`;
}

function clearMessage() {
  message.textContent = "";
  message.className = "auth-message";
}

function setButtonLoading(button, loading, loadingText) {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

tabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    panels.forEach((panel) =>
      panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab)
    );
    clearMessage();
  })
);

const password = document.getElementById("register-password");
const meter = document.getElementById("password-meter-bar");
const help = document.getElementById("password-help");

function passwordScore(value) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Za-z\u0600-\u06FF]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9\u0600-\u06FF]/.test(value)) score++;
  return score;
}

password.addEventListener("input", () => {
  const score = passwordScore(password.value);
  meter.style.width = `${score * 25}%`;
  meter.style.background =
    score < 2 ? "#ef6262" : score < 4 ? "#f1bd4b" : "#42d392";
  help.textContent =
    score < 3
      ? "رمز باید حداقل ۸ نویسه و شامل حرف و عدد باشد."
      : "قدرت رمز مناسب است.";
});

document
  .getElementById("register-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const fullName = document.getElementById("full-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const role = roleSelect.value;
    const pass = password.value;
    const termsAccepted = document.getElementById("terms").checked;

    if (fullName.length < 3) {
      return showMessage("نام و نام خانوادگی را کامل وارد کنید.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showMessage("آدرس ایمیل معتبر نیست.");
    }
    if (!["buyer", "traveler"].includes(role)) {
      return showMessage("نوع حساب معتبر را انتخاب کنید.");
    }
    if (passwordScore(pass) < 3) {
      return showMessage("رمز عبور باید حداقل ۸ نویسه و شامل حرف و عدد باشد.");
    }
    if (!termsAccepted) {
      return showMessage("پذیرش قوانین برای ساخت حساب ضروری است.");
    }
    if (!supabaseClient) {
      return showMessage("اتصال Supabase هنوز تنظیم نشده است.");
    }

    setButtonLoading(submitButton, true, "در حال ساخت حساب...");

    try {
      const redirectTo = new URL("dashboard.html", location.href).href;
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password: pass,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: fullName, role },
        },
      });

      if (error) throw error;

      if (data.session) {
        location.href = "dashboard.html";
        return;
      }

      form.reset();
      meter.style.width = "0";
      help.textContent = "حداقل ۸ نویسه، شامل حرف و عدد";
      showMessage(
        "حساب ساخته شد. لینک تأیید ارسال‌شده به ایمیل را باز کنید.",
        "success"
      );
    } catch (error) {
      console.error("Signup error:", error);
      showMessage(error.message || "ساخت حساب انجام نشد.");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });

document
  .getElementById("login-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value;

    if (!supabaseClient) {
      return showMessage("اتصال Supabase هنوز تنظیم نشده است.");
    }

    setButtonLoading(submitButton, true, "در حال ورود...");

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error) throw error;
      location.href = "dashboard.html";
    } catch (error) {
      console.error("Login error:", error);
      showMessage("ایمیل، رمز عبور یا وضعیت تأیید حساب صحیح نیست.");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });

document.getElementById("google-login").addEventListener("click", async () => {
  clearMessage();

  if (!supabaseClient) {
    return showMessage("اتصال Supabase هنوز تنظیم نشده است.");
  }

  const googleButton = document.getElementById("google-login");
  setButtonLoading(googleButton, true, "در حال اتصال به Google...");

  try {
    const redirectTo = new URL("dashboard.html", location.href).href;
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) throw error;
  } catch (error) {
    console.error("Google OAuth error:", error);
    showMessage(error.message || "ورود با Google انجام نشد.");
    setButtonLoading(googleButton, false);
  }
});
