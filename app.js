const formatter = new Intl.NumberFormat("ar-SA", {
  maximumFractionDigits: 0
});

const percentFormatter = new Intl.NumberFormat("ar-SA", {
  maximumFractionDigits: 1
});

const colors = {
  cash: "#00856f",
  sukuk: "#3f7fca",
  localStocks: "#2f5fce",
  globalStocks: "#b87916",
  reits: "#6d5fd3",
  alternatives: "#d85a44"
};

const assetLabels = {
  cash: "نقد ومرابحات",
  sukuk: "صكوك ودخل ثابت",
  localStocks: "أسهم محلية",
  globalStocks: "أسهم عالمية",
  reits: "صناديق عقارية",
  alternatives: "بدائل"
};

const assumptions = {
  cash: { expectedReturn: 0.035, volatility: 0.01 },
  sukuk: { expectedReturn: 0.045, volatility: 0.035 },
  localStocks: { expectedReturn: 0.085, volatility: 0.18 },
  globalStocks: { expectedReturn: 0.075, volatility: 0.16 },
  reits: { expectedReturn: 0.065, volatility: 0.13 },
  alternatives: { expectedReturn: 0.055, volatility: 0.11 }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundAllocation(allocation) {
  const entries = Object.entries(allocation).map(([key, value]) => [key, Math.max(0, value)]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  const normalized = entries.map(([key, value]) => [key, Math.round((value / total) * 100)]);
  const drift = 100 - normalized.reduce((sum, [, value]) => sum + value, 0);

  normalized.sort((a, b) => b[1] - a[1]);
  normalized[0][1] += drift;

  return Object.fromEntries(normalized);
}

function getHorizonYears(horizon) {
  return { short: 2, mid: 5, long: 10, veryLong: 20 }[horizon] || 5;
}

function calculatePortfolio(data) {
  const age = clamp(toNumber(data.get("age"), 35), 18, 75);
  const risk = data.get("risk") || "medium";
  const horizon = data.get("horizon") || "mid";
  const liquidity = data.get("liquidity") || "medium";
  const goal = data.get("goal") || "balanced";
  const marketBias = data.get("marketBias") || "global";
  const sharia = data.get("sharia") || "flexible";
  const monthly = toNumber(data.get("monthly"), 0);
  const capital = Math.max(0, toNumber(data.get("capital"), 0));
  const monthlyRate = capital > 0 ? monthly / capital : 0;

  let equity = clamp(105 - age, 18, 82);
  equity += { low: -22, medium: 0, high: 15 }[risk];
  equity += { short: -26, mid: 0, long: 12, veryLong: 20 }[horizon];
  equity += { income: -16, balanced: 0, growth: 12, retirement: -6, capitalPreservation: -24 }[goal];
  equity += { low: 4, medium: 0, high: -14 }[liquidity];
  equity += monthlyRate >= 0.03 && horizon !== "short" ? 4 : 0;
  equity = clamp(equity, 8, 88);

  let cash = { low: 7, medium: 12, high: 24 }[liquidity];
  cash += horizon === "short" ? 10 : 0;
  cash += goal === "capitalPreservation" ? 10 : 0;
  cash += goal === "growth" && liquidity !== "high" ? -3 : 0;
  cash += monthlyRate >= 0.03 ? -2 : 0;
  cash = clamp(cash, 4, 38);

  let reits = { income: 12, balanced: 8, growth: 6, retirement: 8, capitalPreservation: 3 }[goal];
  reits += horizon === "short" ? -3 : 0;
  reits = clamp(reits, 2, 14);

  let alternatives = risk === "high" && horizon !== "short" ? 6 : 3;
  alternatives += goal === "growth" ? 2 : 0;
  alternatives += goal === "capitalPreservation" || sharia === "strict" ? -2 : 0;
  alternatives = clamp(alternatives, 0, 8);

  let sukuk = 100 - equity - cash - reits - alternatives;

  if (sukuk < 5) {
    const shortage = 5 - sukuk;
    equity -= shortage;
    sukuk = 5;
  }

  const localShare = { local: 0.65, global: 0.35, balanced: 0.5 }[marketBias] ?? 0.45;
  let allocation = roundAllocation({
    cash,
    sukuk,
    localStocks: equity * localShare,
    globalStocks: equity * (1 - localShare),
    reits,
    alternatives
  });

  if (sharia === "strict") {
    allocation.alternatives = 0;
    allocation.sukuk += 2;
    allocation.cash += 1;
    allocation = roundAllocation(allocation);
  }

  return allocation;
}

function calculateMetrics(allocation, data) {
  const annualReturn = Object.entries(allocation).reduce((sum, [key, weight]) => {
    return sum + (weight / 100) * assumptions[key].expectedReturn;
  }, 0);

  const volatility = Math.sqrt(Object.entries(allocation).reduce((sum, [key, weight]) => {
    return sum + Math.pow(weight / 100, 2) * Math.pow(assumptions[key].volatility, 2);
  }, 0));

  const capital = Math.max(0, toNumber(data.get("capital"), 0));
  const monthly = Math.max(0, toNumber(data.get("monthly"), 0));
  const years = getHorizonYears(data.get("horizon"));
  const monthlyReturn = annualReturn / 12;
  const months = years * 12;
  const futureCapital = capital * Math.pow(1 + annualReturn, years);
  const futureMonthly = monthlyReturn > 0
    ? monthly * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn)
    : monthly * months;

  return {
    annualReturn,
    volatility,
    years,
    projectedValue: futureCapital + futureMonthly,
    annualContribution: monthly * 12
  };
}

function describePortfolio(allocation, data, metrics) {
  const equity = allocation.localStocks + allocation.globalStocks;
  const safe = allocation.cash + allocation.sukuk;
  const risk = data.get("risk") || "medium";
  const horizon = data.get("horizon") || "mid";
  const liquidity = data.get("liquidity") || "medium";
  const goal = data.get("goal") || "balanced";
  const titleMap = {
    income: "محفظة دخل",
    balanced: equity >= 62 ? "محفظة نمو متوازن" : "محفظة متوازنة",
    growth: "محفظة نمو",
    retirement: "محفظة تقاعد تدريجية",
    capitalPreservation: "محفظة حفظ رأس المال"
  };
  const notes = [];

  notes.push(`تم بناء التوزيع لهدف: ${goalLabels[goal]} مع أفق تقريبي ${metrics.years} سنوات.`);

  if (liquidity === "high") notes.push("تم رفع النقد والصكوك لأن احتياج السيولة مرتفع، وهذا يقلل التذبذب لكنه يخفض النمو المتوقع.");
  if ((horizon === "long" || horizon === "veryLong") && risk !== "low") notes.push("الأفق الطويل يسمح بوزن أعلى للأسهم بشرط الالتزام وعدم البيع وقت الهبوط.");
  if (horizon === "veryLong") notes.push("الأفق الزمني فوق 20 سنة مناسب غالباً لاستراتيجية نمو تدريجية مع إعادة توازن منتظمة.");
  if (risk === "low") notes.push("مستوى المخاطر المنخفض خفّض الأسهم ورفع الأصول الدفاعية.");
  if (goal === "income") notes.push("تم تعزيز الصكوك والصناديق العقارية لأن الهدف يركز على الدخل الدوري أكثر من النمو السريع.");
  if (goal === "growth") notes.push("تم رفع وزن الأسهم لأن الهدف يركز على النمو، مع ضرورة قبول تذبذب أعلى.");
  notes.push("قاعدة إعادة التوازن: راجع المحفظة كل 6 أشهر أو عند انحراف أي أصل بأكثر من 5 نقاط مئوية عن النسبة المقترحة.");

  return { title: titleMap[goal], equity, safe, notes };
}

const goalLabels = {
  income: "دخل دوري",
  balanced: "توازن",
  growth: "نمو رأس المال",
  retirement: "تقاعد",
  capitalPreservation: "حفظ رأس المال"
};



function drawPerformanceChart(metrics, capital, monthly) {
  const canvas = document.querySelector("#performance-chart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 760;
  const cssHeight = Number(canvas.getAttribute("height")) || 300;

  canvas.width = cssWidth * ratio;
  canvas.height = cssHeight * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const years = Math.max(1, metrics.years);
  const annualReturn = metrics.annualReturn;
  const monthlyReturn = annualReturn / 12;

  const points = [];
  const baseline = [];

  for (let y = 0; y <= years; y++) {
    const months = y * 12;
    const futureCapital = capital * Math.pow(1 + annualReturn, y);
    const futureMonthly = monthlyReturn > 0
      ? monthly * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn)
      : monthly * months;

    points.push({ year: y, value: futureCapital + futureMonthly });
    baseline.push({ year: y, value: capital + monthly * months });
  }

  const allValues = [...points, ...baseline].map((p) => p.value);
  const maxValue = Math.max(...allValues, 1) * 1.12;
  const minValue = 0;

  const padding = { top: 28, right: 32, bottom: 42, left: 74 };
  const plotW = cssWidth - padding.left - padding.right;
  const plotH = cssHeight - padding.top - padding.bottom;

  const x = (i) => padding.left + (i / Math.max(points.length - 1, 1)) * plotW;
  const y = (value) => padding.top + (1 - (value - minValue) / (maxValue - minValue || 1)) * plotH;

  function compactNumber(value) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${Math.round(value / 1000)}K`;
    return `${Math.round(value)}`;
  }

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, cssHeight);
  bg.addColorStop(0, "rgba(255,250,243,1)");
  bg.addColorStop(1, "rgba(248,241,232,1)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  // Grid + y labels
  ctx.lineWidth = 1;
  ctx.font = "12px Manrope, Segoe UI, Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 4; i++) {
    const value = (maxValue / 4) * i;
    const gy = y(value);
    ctx.strokeStyle = "rgba(23,33,47,.09)";
    ctx.beginPath();
    ctx.moveTo(padding.left, gy);
    ctx.lineTo(cssWidth - padding.right, gy);
    ctx.stroke();

    ctx.fillStyle = "rgba(109,116,128,.85)";
    ctx.fillText(compactNumber(value), padding.left - 12, gy);
  }

  // Area fill
  const areaGradient = ctx.createLinearGradient(0, padding.top, 0, cssHeight - padding.bottom);
  areaGradient.addColorStop(0, "rgba(10,129,109,.28)");
  areaGradient.addColorStop(.55, "rgba(49,95,206,.10)");
  areaGradient.addColorStop(1, "rgba(49,95,206,0)");

  ctx.beginPath();
  points.forEach((pt, i) => i === 0 ? ctx.moveTo(x(i), y(pt.value)) : ctx.lineTo(x(i), y(pt.value)));
  ctx.lineTo(x(points.length - 1), cssHeight - padding.bottom);
  ctx.lineTo(x(0), cssHeight - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = areaGradient;
  ctx.fill();

  // Baseline dashed line
  ctx.save();
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  baseline.forEach((pt, i) => i === 0 ? ctx.moveTo(x(i), y(pt.value)) : ctx.lineTo(x(i), y(pt.value)));
  ctx.strokeStyle = "rgba(194,131,43,.65)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Main smooth-ish line
  ctx.beginPath();
  points.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(x(i), y(pt.value));
    else {
      const prevX = x(i - 1);
      const prevY = y(points[i - 1].value);
      const currX = x(i);
      const currY = y(pt.value);
      const midX = (prevX + currX) / 2;
      ctx.bezierCurveTo(midX, prevY, midX, currY, currX, currY);
    }
  });

  const lineGradient = ctx.createLinearGradient(padding.left, 0, cssWidth - padding.right, 0);
  lineGradient.addColorStop(0, "#0a816d");
  lineGradient.addColorStop(.55, "#315fce");
  lineGradient.addColorStop(1, "#c2832b");

  ctx.strokeStyle = lineGradient;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Points
  points.forEach((pt, i) => {
    if (i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 4) === 0) {
      ctx.beginPath();
      ctx.arc(x(i), y(pt.value), 6, 0, Math.PI * 2);
      ctx.fillStyle = "#fffaf3";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#315fce";
      ctx.stroke();
    }
  });

  // X labels
  ctx.fillStyle = "rgba(109,116,128,.92)";
  ctx.font = "12px Manrope, Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  points.forEach((pt, i) => {
    if (i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 4) === 0) {
      ctx.fillText(`سنة ${pt.year}`, x(i), cssHeight - padding.bottom + 16);
    }
  });

  // Final value label
  const last = points[points.length - 1];
  const lx = x(points.length - 1);
  const ly = y(last.value);
  const label = compactNumber(last.value);
  ctx.font = "bold 13px Manrope, Segoe UI, Arial";
  ctx.textAlign = "center";
  const labelW = ctx.measureText(label).width + 24;
  const labelX = Math.min(Math.max(lx, padding.left + labelW / 2), cssWidth - padding.right - labelW / 2);
  const labelY = Math.max(18, ly - 38);

  ctx.fillStyle = "#17212f";
  roundRect(ctx, labelX - labelW / 2, labelY, labelW, 30, 15);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(label, labelX, labelY + 15);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}


function renderBuilder() {
  const form = document.querySelector("#portfolio-form");
  if (!form) return;

  const data = new FormData(form);
  const allocation = calculatePortfolio(data);
  const metrics = calculateMetrics(allocation, data);
  const summary = describePortfolio(allocation, data, metrics);
  const capital = Math.max(0, toNumber(data.get("capital"), 0));
  const monthly = Math.max(0, toNumber(data.get("monthly"), 0));
  const list = document.querySelector("#allocation-list");
  const donut = document.querySelector("#builder-donut");

  document.querySelector("#result-title").textContent = summary.title;
  document.querySelector("#risk-score").textContent = `${summary.equity}/100`;
  document.querySelector("#dominant-asset").textContent = summary.equity >= summary.safe ? "نمو" : "دفاعي";
  document.querySelector("#equity-value").textContent = `${formatter.format((capital * summary.equity) / 100)} ريال`;
  document.querySelector("#safe-value").textContent = `${formatter.format((capital * summary.safe) / 100)} ريال`;
  document.querySelector("#year-value").textContent = `${formatter.format(capital + monthly * 12)} ريال`;
  document.querySelector("#return-value").textContent = `${percentFormatter.format(metrics.annualReturn * 100)}%`;
  document.querySelector("#volatility-value").textContent = `${percentFormatter.format(metrics.volatility * 100)}%`;
  document.querySelector("#projection-value").textContent = `${formatter.format(metrics.projectedValue)} ريال`;
  drawPerformanceChart(metrics, capital, monthly);
  window.NAWA_CURRENT_PORTFOLIO = {
    name: summary.title,
    age: toNumber(data.get("age"), 35),
    capital,
    monthly,
    goal: data.get("goal") || "balanced",
    risk_level: data.get("risk") || "medium",
    horizon: data.get("horizon") || "mid",
    liquidity: data.get("liquidity") || "medium",
    market_bias: data.get("marketBias") || "global",
    sharia: data.get("sharia") || "flexible",
    allocation,
    expected_return: metrics.annualReturn,
    volatility: metrics.volatility,
    projected_value: metrics.projectedValue,
    years: metrics.years,
    notes: summary.notes
  };
  const forecastReturn = document.querySelector("#forecast-return");
  const forecastValue = document.querySelector("#forecast-value");
  const forecastRisk = document.querySelector("#forecast-risk");
  const forecastSummary = document.querySelector("#forecast-summary");

  if (forecastReturn) forecastReturn.textContent = `${percentFormatter.format(metrics.annualReturn * 100)}%`;
  if (forecastValue) forecastValue.textContent = `${formatter.format(metrics.projectedValue)} ريال`;
  if (forecastRisk) forecastRisk.textContent = `${percentFormatter.format(metrics.volatility * 100)}%`;
  if (forecastSummary) {
    forecastSummary.textContent = `بناءً على التوزيع الحالي، قد تصل المحفظة إلى ${formatter.format(metrics.projectedValue)} ريال خلال ${metrics.years} سنوات مع عائد سنوي تقديري ${percentFormatter.format(metrics.annualReturn * 100)}%.`;
  }

  const caption = document.querySelector("#chart-caption");
  if (caption) caption.textContent = `توقع تقريبي خلال ${metrics.years} سنوات`;

  const stock = allocation.localStocks + allocation.globalStocks;
  const safe = allocation.cash + allocation.sukuk;
  donut.style.setProperty("--stock", stock);
  donut.style.setProperty("--safe", safe);
  donut.style.setProperty("--real", allocation.reits);
  donut.style.setProperty("--alt", allocation.alternatives);

  list.innerHTML = Object.entries(allocation)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `
      <article class="allocation-item" style="--bar:${colors[key]}; --w:${value}%">
        <header><span>${assetLabels[key]}</span><strong>${value}%</strong></header>
        <b>${value}%</b>
      </article>
    `)
    .join("");

  
  const expectedReturn = document.querySelector("#expected-return");
  const futureValue = document.querySelector("#future-value");
  const volatilityScore = document.querySelector("#volatility-score");

  if(expectedReturn) expectedReturn.textContent = `${(metrics.expectedReturn*100).toFixed(1)}%`;
  if(futureValue) futureValue.textContent = formatter.format(metrics.futureValue);
  if(volatilityScore){
    volatilityScore.textContent =
      metrics.volatility < 0.08 ? "منخفض" :
      metrics.volatility < 0.14 ? "متوسط" : "مرتفع";
  }


  document.querySelector("#portfolio-notes").innerHTML = summary.notes
    .map((note) => `<p>${note}</p>`)
    .join("");
}

function renderRisk() {
  const form = document.querySelector("#risk-form");
  if (!form) return;

  const data = new FormData(form);
  const score = ["q1", "q2", "q3", "q4"].reduce((sum, key) => sum + Number(data.get(key) || 1), 0);
  const percent = Math.round(((score - 4) / 8) * 100);
  const label = document.querySelector("#risk-label");
  const description = document.querySelector("#risk-description");
  const meter = document.querySelector(".meter");
  const meterBar = document.querySelector("#risk-meter");

  meter.style.setProperty("--meter", `${Math.max(10, percent)}%`);
  if (meterBar) meterBar.style.width = `${Math.max(10, percent)}%`;

  if (score <= 6) {
    label.textContent = "متحفظ";
    description.textContent = "محفظة تركز على السيولة والدخل الثابت وتخفض وزن الأسهم.";
  } else if (score <= 9) {
    label.textContent = "متوازن";
    description.textContent = "محفظة تجمع بين النمو والدخل وتقبل تذبذباً متوسطاً.";
  } else {
    label.textContent = "نامي";
    description.textContent = "محفظة ترفع وزن الأسهم وتحتاج أفقاً زمنياً طويلاً وانضباطاً وقت الهبوط.";
  }
}

function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

document.addEventListener("input", (event) => {
  if (event.target.closest("#portfolio-form")) renderBuilder();
  if (event.target.closest("#risk-form")) renderRisk();
});

document.addEventListener("change", (event) => {
  if (event.target.closest("#portfolio-form")) renderBuilder();
  if (event.target.closest("#risk-form")) renderRisk();
});

document.addEventListener("DOMContentLoaded", () => {
  renderBuilder();
  renderRisk();
  initIcons();
});
