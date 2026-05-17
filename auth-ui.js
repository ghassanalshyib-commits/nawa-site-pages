
const SUPABASE_URL = "https://ibtjsfeblhbltbdrmvah.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlidGpzZmVibGhibHRiZHJtdmFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODk3MDIsImV4cCI6MjA5NDE2NTcwMn0.s-RNFg0M6TQvcMm3gzZR6HxduDT50iu5VBRUZpKpbI8";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  }
);
function getPublicBaseUrl() {
  const basePath = window.location.pathname.replace(/[^/]*$/, "").replace(/\/$/, "");
  return window.location.origin + basePath;
}

function getPageUrl(pageName) {
  return `${getPublicBaseUrl()}/${pageName}`;
}


async function getCurrentUser() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (sessionData && sessionData.session && sessionData.session.user) {
    return sessionData.session.user;
  }

  const { data, error } = await supabaseClient.auth.getUser();
  if (error) return null;
  return data.user;
}

function setHeaderAuthState(user) {
  const guestLinks = document.querySelectorAll(".auth-guest-link");
  const userMenu = document.querySelector(".user-menu-wrapper");

  if (user) {
    guestLinks.forEach((el) => {
      el.style.display = "none";
    });

    if (userMenu) {
      userMenu.hidden = false;
    }
  } else {
    guestLinks.forEach((el) => {
      el.style.display = "";
    });

    if (userMenu) {
      userMenu.hidden = true;
    }
  }
}

function initUserMenu() {
  const menuButton = document.querySelector(".user-menu-button");
  const dropdown = document.querySelector(".user-dropdown");
  const logoutButtons = document.querySelectorAll(".logout-menu-button, #logout-button");

  if (menuButton && dropdown) {
    menuButton.addEventListener("click", () => {
      dropdown.hidden = !dropdown.hidden;
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".user-menu-wrapper")) {
        dropdown.hidden = true;
      }
    });
  }

  logoutButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "login.html";
    });
  });
}


/* ===== 5 Minutes Inactivity Session Timeout ===== */
const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;

let inactivityTimer = null;
let warningTimer = null;
let warningBox = null;

function createSessionWarningBox() {
  if (warningBox) return warningBox;

  warningBox = document.createElement("div");
  warningBox.className = "session-warning-box";
  warningBox.hidden = true;
  warningBox.innerHTML = `
    <strong>تنبيه الجلسة</strong>
    <p>سيتم تسجيل خروجك خلال دقيقة بسبب عدم النشاط.</p>
    <button type="button" id="extend-session-button">تمديد الجلسة</button>
  `;

  document.body.appendChild(warningBox);

  const extendButton = warningBox.querySelector("#extend-session-button");
  extendButton.addEventListener("click", () => {
    resetInactivityTimer();
  });

  return warningBox;
}

function showSessionWarning() {
  createSessionWarningBox();
  warningBox.hidden = false;
}

function hideSessionWarning() {
  if (warningBox) warningBox.hidden = true;
}

async function logoutForInactivity() {
  await supabaseClient.auth.signOut();
  alert("تم تسجيل خروجك بسبب عدم النشاط لمدة 5 دقائق.");
  window.location.href = "login.html";
}

function clearSessionTimers() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (warningTimer) clearTimeout(warningTimer);
}

function resetInactivityTimer() {
  clearSessionTimers();
  hideSessionWarning();

  warningTimer = setTimeout(showSessionWarning, INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS);
  inactivityTimer = setTimeout(logoutForInactivity, INACTIVITY_LIMIT_MS);
}

async function startInactivitySessionTimeout() {
  const user = await getCurrentUser();

  if (!user) return;

  const publicPages = ["login.html", "signup.html", "reset-password.html", "index.html", "learn.html", "risk.html"];
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  // Apply timeout mainly after user is logged in. Public pages are not forced out.
  if (publicPages.includes(currentPage) && !document.querySelector("#logout-button")) {
    return;
  }

  ["click", "mousemove", "keydown", "scroll", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, resetInactivityTimer, { passive: true });
  });

  resetInactivityTimer();
}


document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.querySelector("#login-form");
  const signupForm = document.querySelector("#signup-form");
  const userEmail = document.querySelector("#user-email");

  initUserMenu();

  const currentUser = await getCurrentUser();
  setHeaderAuthState(currentUser);

  if (typeof requireAuthenticatedPage === 'function') {
    await requireAuthenticatedPage(supabaseClient);
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (typeof honeypotTriggered === "function" && honeypotTriggered(signupForm)) {
        return;
      }

      if (typeof checkRateLimit === "function") {
        const rate = checkRateLimit("signup");
        if (!rate.allowed) {
          alert(rate.message);
          return;
        }
      }

      const submitButton = signupForm.querySelector("button[type='submit']");
      const data = new FormData(signupForm);
      const name = typeof sanitizeText === "function" ? sanitizeText(data.get("name"), 80) : data.get("name");
      const email = typeof normalizeEmail === "function" ? normalizeEmail(data.get("email")) : data.get("email");
      const password = data.get("password");
      const confirmPassword = data.get("confirmPassword");

      if (password !== confirmPassword) {
        alert("كلمة المرور وتأكيدها غير متطابقين.");
        return;
      }

      if (typeof isValidEmail === "function" && !isValidEmail(email)) {
        alert("الرجاء إدخال بريد إلكتروني صالح.");
        return;
      }

      const signupPasswordMessage = typeof getPasswordStrengthMessage === "function" ? getPasswordStrengthMessage(password) : "";
      if (signupPasswordMessage) {
        alert(signupPasswordMessage);
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "جاري إنشاء الحساب...";
      }

      const { data: signUpData, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getPageUrl("login.html"),
          data: {
            full_name: name
          }
        }
      });

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i data-lucide="user-plus"></i> إنشاء الحساب';
        if (window.lucide) window.lucide.createIcons();
      }

      if (error) {
        alert("خطأ: " + error.message);
        return;
      }

      if (typeof resetRateLimit === "function") resetRateLimit("signup");

      if (signUpData && signUpData.session) {
        setHeaderAuthState(signUpData.session.user);
        window.location.href = "dashboard.html";
      } else {
        alert("تم إنشاء الحساب بنجاح. إذا كان تأكيد البريد مفعلاً، تحقق من بريدك الإلكتروني قبل تسجيل الدخول.");
        window.location.href = "login.html";
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (typeof honeypotTriggered === "function" && honeypotTriggered(loginForm)) {
        return;
      }

      if (typeof checkRateLimit === "function") {
        const rate = checkRateLimit("login");
        if (!rate.allowed) {
          alert(rate.message);
          return;
        }
      }

      const submitButton = loginForm.querySelector("button[type='submit']");
      const data = new FormData(loginForm);
      const email = typeof normalizeEmail === "function" ? normalizeEmail(data.get("email")) : data.get("email");
      const password = data.get("password");

      const loginEmailValid = typeof isValidEmail === "function" ? isValidEmail(email) : true;
      if (!loginEmailValid) {
        alert("الرجاء إدخال بريد إلكتروني صالح.");
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "جاري تسجيل الدخول...";
      }

      const { data: loginData, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i data-lucide="log-in"></i> دخول';
        if (window.lucide) window.lucide.createIcons();
      }

      if (error) {
        alert("خطأ: " + error.message);
        return;
      }

      if (typeof resetRateLimit === "function") resetRateLimit("login");

      setHeaderAuthState(loginData.user);
      window.location.href = "dashboard.html";
    });
  }

  if (userEmail) {
    const user = await getCurrentUser();

    if (!user) {
      window.location.href = "login.html";
      return;
    }

    userEmail.textContent = user.email || "مستخدم مسجل";
  }

  startInactivitySessionTimeout();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setHeaderAuthState(session ? session.user : null);
  });
});
