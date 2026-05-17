
const portfolioClient = window.supabase.createClient(
  "https://ibtjsfeblhbltbdrmvah.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlidGpzZmVibGhibHRiZHJtdmFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODk3MDIsImV4cCI6MjA5NDE2NTcwMn0.s-RNFg0M6TQvcMm3gzZR6HxduDT50iu5VBRUZpKpbI8",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  }
);

async function getPortfolioUser() {
  const { data: sessionData } = await portfolioClient.auth.getSession();

  if (sessionData && sessionData.session && sessionData.session.user) {
    return sessionData.session.user;
  }

  const { data, error } = await portfolioClient.auth.getUser();
  if (error) return null;
  return data.user;
}

function setSaveButtonLoading(isLoading) {
  const button = document.querySelector("#save-portfolio-button");
  if (!button) return;

  if (isLoading) {
    button.disabled = true;
    button.textContent = "جاري الحفظ...";
  } else {
    button.disabled = false;
    button.innerHTML = '<i data-lucide="save"></i> حفظ المحفظة';
    if (window.lucide) window.lucide.createIcons();
  }
}

async function saveCurrentPortfolio() {
  if (typeof checkRateLimit === "function") {
    const rate = checkRateLimit("savePortfolio");
    if (!rate.allowed) {
      alert(rate.message);
      return;
    }
  }

  const portfolio = window.NAWA_CURRENT_PORTFOLIO;
  const user = await getPortfolioUser();

  if (!user) {
    alert("سجل الدخول أولاً حتى تتمكن من حفظ المحفظة.");
    window.location.href = "login.html";
    return;
  }

  if (!portfolio) {
    alert("لم يتم تجهيز بيانات المحفظة بعد. عدّل بيانات المحفظة ثم حاول مرة أخرى.");
    return;
  }

  let portfolioName = prompt("اكتب اسم المحفظة:", portfolio.name || "محفظتي الاستثمارية");
  portfolioName = typeof sanitizeText === "function" ? sanitizeText(portfolioName, 80) : portfolioName;
  if (!portfolioName) return;

  setSaveButtonLoading(true);

  const { error } = await portfolioClient.from("portfolios").insert({
    user_id: user.id,
    portfolio_name: portfolioName,
    age: portfolio.age,
    capital: portfolio.capital,
    monthly: portfolio.monthly,
    goal: portfolio.goal,
    risk_level: portfolio.risk_level,
    horizon: portfolio.horizon,
    liquidity: portfolio.liquidity,
    market_bias: portfolio.market_bias,
    sharia: portfolio.sharia,
    allocation: portfolio.allocation,
    expected_return: portfolio.expected_return,
    volatility: portfolio.volatility,
    projected_value: portfolio.projected_value,
    years: portfolio.years,
    notes: portfolio.notes
  });

  setSaveButtonLoading(false);

  if (error) {
    alert("تعذر حفظ المحفظة: " + error.message);
    return;
  }

  /*
    مهم:
    لا يتم تسجيل خروج المستخدم ولا تحويله لصفحة الدخول بعد الحفظ.
    تبقى جلسة Supabase محفوظة في localStorage.
  */
  alert("تم حفظ المحفظة داخل حسابك بنجاح. يمكنك رؤيتها في صفحة حسابي.");

  const savedList = document.querySelector("#saved-portfolios-list");
  if (savedList) {
    await loadSavedPortfolios();
  }
}

function formatMoney(value) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Number(value || 0)) + " ريال";
}

function formatPercent(value) {
  return (Number(value || 0) * 100).toFixed(1) + "%";
}

async function loadSavedPortfolios() {
  const list = document.querySelector("#saved-portfolios-list");
  if (!list) return;

  const user = await getPortfolioUser();

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  list.innerHTML = `<div class="empty-state">جاري تحميل المحافظ...</div>`;

  const { data, error } = await portfolioClient
    .from("portfolios")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<div class="empty-state">تعذر تحميل المحافظ: ${error.message}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state">لا توجد محافظ محفوظة بعد.</div>`;
    return;
  }

  list.innerHTML = data.map((p) => `
    <article class="saved-portfolio-card">
      <div class="saved-card-top">
        <div>
          <h3>${p.portfolio_name || "محفظة استثمارية"}</h3>
          <span>${new Date(p.created_at).toLocaleDateString("ar-SA")}</span>
        </div>
        <strong>${formatPercent(p.expected_return)}</strong>
      </div>

      <div class="saved-card-metrics">
        <div><span>القيمة المستقبلية</span><strong>${formatMoney(p.projected_value)}</strong></div>
        <div><span>المخاطر</span><strong>${p.risk_level || "-"}</strong></div>
        <div><span>الأفق</span><strong>${p.years || "-"} سنوات</strong></div>
      </div>
    
      <div class="portfolio-actions">
        

        

        <button class="button danger" onclick="deletePortfolio('${p.id}')">
          حذف
        </button>
      </div>
    </article>
  `).join("");

  if(list){
    list.querySelectorAll("button").forEach(btn => {
      btn.blur();
    });
  }

}

document.addEventListener("DOMContentLoaded", () => {
  const saveButton = document.querySelector("#save-portfolio-button");

  if (saveButton) {
    saveButton.addEventListener("click", saveCurrentPortfolio);
  }

  loadSavedPortfolios();
});


async function deletePortfolio(id){
  const confirmed = confirm("هل تريد حذف المحفظة؟");

  if(!confirmed) return;

  const { error } = await portfolioClient
    .from("portfolios")
    .delete()
    .eq("id", id);

  if(error){
    alert("تعذر حذف المحفظة: " + error.message);
    return;
  }

  loadSavedPortfolios();
}


