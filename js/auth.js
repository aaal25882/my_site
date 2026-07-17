
const tabs=document.querySelectorAll("[data-tab]");
const panels=document.querySelectorAll("[data-panel]");
const message=document.getElementById("auth-message");
const roleSelect=document.getElementById("role");
const requestedRole=new URLSearchParams(location.search).get("role");
if(["buyer","traveler"].includes(requestedRole)) roleSelect.value=requestedRole;

function showMessage(text,type="error"){
  message.textContent=text;message.className=`auth-message show ${type}`;
}
tabs.forEach(tab=>tab.addEventListener("click",()=>{
  tabs.forEach(t=>t.classList.toggle("active",t===tab));
  panels.forEach(p=>p.classList.toggle("active",p.dataset.panel===tab.dataset.tab));
  message.className="auth-message";
}));

const password=document.getElementById("register-password");
const meter=document.getElementById("password-meter-bar");
const help=document.getElementById("password-help");
function passwordScore(value){
  let score=0;
  if(value.length>=8)score++;
  if(/[A-Za-z\u0600-\u06FF]/.test(value))score++;
  if(/\d/.test(value))score++;
  if(/[^A-Za-z0-9\u0600-\u06FF]/.test(value))score++;
  return score;
}
password.addEventListener("input",()=>{
  const score=passwordScore(password.value);
  meter.style.width=`${score*25}%`;
  meter.style.background=score<2?"#ef6262":score<4?"#f1bd4b":"#42d392";
  help.textContent=score<3?"رمز باید حداقل ۸ نویسه و شامل حرف و عدد باشد.":"قدرت رمز مناسب است.";
});

document.getElementById("register-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const fullName=document.getElementById("full-name").value.trim();
  const email=document.getElementById("register-email").value.trim();
  const role=roleSelect.value;
  const pass=password.value;
  const terms=document.getElementById("terms").checked;

  if(fullName.length<3)return showMessage("نام و نام خانوادگی را کامل وارد کنید.");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return showMessage("آدرس ایمیل معتبر نیست.");
  if(!role)return showMessage("نوع حساب را انتخاب کنید.");
  if(passwordScore(pass)<3)return showMessage("رمز عبور باید حداقل ۸ نویسه و شامل حرف و عدد باشد.");
  if(!terms)return showMessage("پذیرش قوانین برای ساخت حساب ضروری است.");
  if(!supabaseClient)return showMessage("ابتدا Project URL و Publishable Key را در js/supabase-config.js قرار دهید.");

  const redirectTo=new URL("dashboard.html",location.href).href;
  const {error}=await supabaseClient.auth.signUp({
    email,password:pass,
    options:{emailRedirectTo:redirectTo,data:{full_name:fullName,role}}
  });
  if(error)return showMessage(error.message);
  showMessage("حساب ساخته شد. لینک تأیید ارسال‌شده به ایمیل را باز کنید.","success");
});

document.getElementById("login-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=document.getElementById("login-email").value.trim();
  const pass=document.getElementById("login-password").value;
  if(!supabaseClient)return showMessage("ابتدا اتصال Supabase را در فایل تنظیمات کامل کنید.");
  const {error}=await supabaseClient.auth.signInWithPassword({email,password:pass});
  if(error)return showMessage("ایمیل، رمز عبور یا وضعیت تأیید حساب صحیح نیست.");
  location.href="dashboard.html";
});

document.getElementById("google-login").addEventListener("click",async()=>{
  if(!supabaseClient)return showMessage("ابتدا اتصال Supabase را در فایل تنظیمات کامل کنید.");
  const redirectTo=new URL("dashboard.html",location.href).href;
  const {error}=await supabaseClient.auth.signInWithOAuth({
    provider:"google",options:{redirectTo}
  });
  if(error)showMessage(error.message);
});
