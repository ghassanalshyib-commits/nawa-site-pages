const SUPABASE_URL = "https://ibtjsfeblhbltbdrmvah.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlidGpzZmVibGhibHRiZHJtdmFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODk3MDIsImV4cCI6MjA5NDE2NTcwMn0.s-RNFg0M6TQvcMm3gzZR6HxduDT50iu5VBRUZpKpbI8";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
function showForgotMessage(message, type = "info") {
  const box = document.querySelector("#forgot-message");
  if (!box) return;
  box.hidden = false;
  box.textContent = message;
  box.className = "local-reset-message " + type;
}
function getResetPasswordRedirectUrl() {
  return new URL("reset-password.html", window.location.href).href;
}
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#forgot-password-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (typeof honeypotTriggered === "function" && honeypotTriggered(form)) {
      return;
    }

    if (typeof checkRateLimit === "function") {
      const rate = checkRateLimit("reset");
      if (!rate.allowed) {
        showForgotMessage(rate.message, "error");
        return;
      }
    }
    const email = typeof normalizeEmail === "function" ? normalizeEmail(new FormData(form).get("email")) : new FormData(form).get("email");
    if (typeof isValidEmail === "function" && !isValidEmail(email)) {
      showForgotMessage("الرجاء إدخال بريد إلكتروني صالح.", "error");
      return;
    }

    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "جاري إرسال الرابط...";
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: getResetPasswordRedirectUrl()
    });
    button.disabled = false;
    button.textContent = "إرسال رابط الاسترجاع";
    if (error) {
      showForgotMessage("تعذر إرسال رابط الاسترجاع: " + error.message, "error");
      return;
    }
    if (typeof resetRateLimit === "function") resetRateLimit("reset");
    showForgotMessage("تم إرسال رابط الاسترجاع إلى بريدك الإلكتروني.", "success");
  });
});
