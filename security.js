
/* ===== Nawa Frontend Security Layer ===== */

const NAWA_RATE_LIMITS = {
  login: { key: "nawa_login_attempts", limit: 5, windowMs: 10 * 60 * 1000 },
  signup: { key: "nawa_signup_attempts", limit: 3, windowMs: 10 * 60 * 1000 },
  reset: { key: "nawa_reset_attempts", limit: 3, windowMs: 10 * 60 * 1000 },
  savePortfolio: { key: "nawa_save_portfolio_attempts", limit: 20, windowMs: 10 * 60 * 1000 }
};

function getRateRecord(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || { count: 0, startedAt: Date.now() };
  } catch {
    return { count: 0, startedAt: Date.now() };
  }
}

function checkRateLimit(type) {
  const config = NAWA_RATE_LIMITS[type];
  if (!config) return { allowed: true };

  const now = Date.now();
  let record = getRateRecord(config.key);

  if (now - record.startedAt > config.windowMs) {
    record = { count: 0, startedAt: now };
  }

  if (record.count >= config.limit) {
    const remainingMs = config.windowMs - (now - record.startedAt);
    const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
    return {
      allowed: false,
      message: `تم تجاوز عدد المحاولات. حاول مرة أخرى بعد ${minutes} دقيقة.`
    };
  }

  record.count += 1;
  localStorage.setItem(config.key, JSON.stringify(record));
  return { allowed: true };
}

function resetRateLimit(type) {
  const config = NAWA_RATE_LIMITS[type];
  if (config) localStorage.removeItem(config.key);
}

function isStrongPassword(password) {
  if (!password || password.length < 8) return false;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length >= 3;
}

function getPasswordStrengthMessage(password) {
  if (!password || password.length < 8) {
    return "كلمة المرور يجب أن لا تقل عن 8 أحرف.";
  }
  if (!isStrongPassword(password)) {
    return "استخدم كلمة مرور أقوى تحتوي على أحرف وأرقام ورمز أو أحرف كبيرة.";
  }
  return "";
}

function addHoneypot(form) {
  if (!form || form.querySelector(".nawa-honeypot")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "nawa-honeypot";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.innerHTML = `
    <label>اترك هذا الحقل فارغاً
      <input type="text" name="website" tabindex="-1" autocomplete="off">
    </label>
  `;
  form.prepend(wrapper);
}

function honeypotTriggered(form) {
  const field = form ? form.querySelector('input[name="website"]') : null;
  return field && field.value.trim() !== "";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function sanitizeText(value, maxLength = 120) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function requireAuthenticatedPage(supabaseClient, options = {}) {
  const protectedPages = options.protectedPages || ["dashboard.html"];
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  if (!protectedPages.includes(currentPage)) return true;
  if (!supabaseClient || !supabaseClient.auth) return false;

  const { data } = await supabaseClient.auth.getSession();

  if (!data || !data.session) {
    window.location.href = "login.html";
    return false;
  }

  return true;
}

function initSecurityEnhancements() {
  document.querySelectorAll("form").forEach(addHoneypot);

  document.querySelectorAll('input[type="password"]').forEach((input) => {
    input.setAttribute("minlength", "8");
    input.setAttribute("autocomplete", input.name === "password" ? input.getAttribute("autocomplete") || "current-password" : "new-password");
  });

  document.querySelectorAll('input[type="email"]').forEach((input) => {
    input.setAttribute("autocomplete", "email");
    input.setAttribute("inputmode", "email");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("autocapitalize", "off");
  });
}

document.addEventListener("DOMContentLoaded", initSecurityEnhancements);
