const SUPABASE_URL = "https://ibtjsfeblhbltbdrmvah.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlidGpzZmVibGhibHRiZHJtdmFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODk3MDIsImV4cCI6MjA5NDE2NTcwMn0.s-RNFg0M6TQvcMm3gzZR6HxduDT50iu5VBRUZpKpbI8";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage }
});
let canUpdatePassword = false;
function showResetMessage(message, type = "info") {
  const box = document.querySelector("#reset-message");
  if (!box) return;
  box.hidden = false;
  box.textContent = message;
  box.className = "local-reset-message " + type;
}
async function prepareResetSession() {
  const hashParams = new URLSearchParams((window.location.hash || "").replace("#", ""));
  const searchParams = new URLSearchParams((window.location.search || "").replace("?", ""));
  const access_token = hashParams.get("access_token");
  const refresh_token = hashParams.get("refresh_token");
  const type = hashParams.get("type");
  const code = searchParams.get("code");
  if (type === "recovery" && access_token && refresh_token) {
    const { error } = await supabaseClient.auth.setSession({ access_token, refresh_token });
    if (error) {
      showResetMessage("تعذر تفعيل رابط الاسترجاع: " + error.message, "error");
      return false;
    }
    canUpdatePassword = true;
    showResetMessage("تم التحقق من رابط الاسترجاع. يمكنك تعيين كلمة مرور جديدة.", "success");
    return true;
  }
  if (code) {
    const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
    if (error) {
      showResetMessage("تعذر تفعيل رابط الاسترجاع: " + error.message, "error");
      return false;
    }
    canUpdatePassword = true;
    showResetMessage("تم التحقق من رابط الاسترجاع. يمكنك تعيين كلمة مرور جديدة.", "success");
    return true;
  }
  const { data } = await supabaseClient.auth.getSession();
  if (data && data.session) {
    canUpdatePassword = true;
    showResetMessage("تم العثور على جلسة نشطة. يمكنك تحديث كلمة المرور. للاسترجاع من البريد تأكد من فتح رابط الرسالة نفسها.", "success");
    return true;
  }
  showResetMessage("رابط الاسترجاع غير صحيح أو منتهي. اطلب رابطاً جديداً.", "error");
  return false;
}
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector("#reset-password-form");
  const ready = await prepareResetSession();
  if (!ready && form) form.querySelectorAll("input, button").forEach((el) => el.disabled = true);
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canUpdatePassword) {
      showResetMessage("لا يمكن تحديث كلمة المرور بدون رابط استرجاع صالح.", "error");
      return;
    }
    const data = new FormData(form);
    const password = data.get("password");
    const confirmPassword = data.get("confirmPassword");
    const button = form.querySelector("button[type='submit']");
    if (password !== confirmPassword) {
      showResetMessage("كلمة المرور وتأكيدها غير متطابقين.", "error");
      return;
    }
    if (!password || password.length < 8) {
      showResetMessage("كلمة المرور يجب أن لا تقل عن 8 أحرف.", "error");
      return;
    }
    button.disabled = true;
    button.textContent = "جاري تحديث كلمة المرور...";
    const { error } = await supabaseClient.auth.updateUser({ password });
    button.disabled = false;
    button.textContent = "تحديث كلمة المرور";
    if (error) {
      showResetMessage("تعذر تحديث كلمة المرور: " + error.message, "error");
      return;
    }
    showResetMessage("تم تحديث كلمة المرور بنجاح. سيتم تحويلك إلى تسجيل الدخول.", "success");
    await supabaseClient.auth.signOut();
    setTimeout(() => { window.location.href = "login.html"; }, 1500);
  });
});
