// GASデプロイ後のURLを貼り付けてください
const GAS_URL = "https://script.google.com/macros/s/AKfycbxfxd5xpL_LwmhoMzMm08_F5lXNhQlJavm7I6kiCFL8ZRQtXhsJEPAGOcfA8vAOt4Wp/exec";

// グローバル状態管理
let appState = {
  currentDate: new Date(),
  viewMode: "month", // 'month' or 'year'
  rawData: {
    expCategories: [],
    incCategories: [],
    members: [],
    budgets: {},
    expenses: [],
    incomes: []
  }
};

let expenseChartInstance = null;
let yearChartInstance = null;

// カテゴリー別パレット生成
const COLOR_PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"
];

document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  fetchInitialData();
});

// JSONPを利用したデータ取得（CORS完全回避）
function fetchInitialData() {
  const callbackName = "gasCallback_" + Date.now();
  window[callbackName] = function(response) {
    if (response.status === "success") {
      appState.rawData = response.data;
      renderApp();
    } else {
      alert("データ取得エラー: " + response.message);
    }
    delete window[callbackName];
    document.body.removeChild(script);
  };

  const script = document.createElement("script");
  script.src = `${GAS_URL}?action=getInitialData&callback=${callbackName}`;
  document.body.appendChild(script);
}

// データ保存 POST リクエスト (redirect: "follow" 必須)
async function sendPostData(payload) {
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.status === "success") {
      fetchInitialData(); // 最新データ再読み込み
    } else {
      alert("保存エラー: " + result.message);
    }
  } catch (err) {
    alert("通信エラーが発生しました: " + err);
  }
}

function initEventListeners() {
  // ナビゲーション
  document.getElementById("btn-prev").addEventListener("click", () => changePeriod(-1));
  document.getElementById("btn-next").addEventListener("click", () => changePeriod(1));
  document.getElementById("btn-view-month").addEventListener("click", () => setViewMode("month"));
  document.getElementById("btn-view-year").addEventListener("click", () => setViewMode("year"));

  // FAB モーダル
  const fabWrapper = document.getElementById("fab-wrapper");
  document.getElementById("fab-main").addEventListener("click", () => fabWrapper.classList.toggle("active"));
  document.getElementById("btn-open-expense").addEventListener("click", () => openTransactionModal("expense"));
  document.getElementById("btn-open-income").addEventListener("click", () => openTransactionModal("income"));
  document.getElementById("btn-close-modal").addEventListener("click", closeTransactionModal);

  // フォーム送信
  document.getElementById("transaction-form").addEventListener("submit", handleTransactionSubmit);
  document.getElementById("btn-open-budget").addEventListener("click", openBudgetModal);
  document.getElementById("btn-close-budget-modal").addEventListener("click", () => document.getElementById("budget-modal").classList.add("hidden"));
  document.getElementById("budget-form").addEventListener("submit", handleBudgetSubmit);
}

function changePeriod(delta) {
  if (appState.viewMode === "month") {
    appState.currentDate.setMonth(appState.currentDate.getMonth() + delta);
  } else {
    appState.currentDate.setFullYear(appState.currentDate.getFullYear() + delta);
  }
  renderApp();
}

function setViewMode(mode) {
  appState.viewMode = mode;
  document.getElementById("btn-view-month").classList.toggle("active", mode === "month");
  document.getElementById("btn-view-year").classList.toggle("active", mode === "year");
  document.getElementById("view-month-section").classList.toggle("hidden", mode !== "month");
  document.getElementById("view-year-section").classList.toggle("hidden", mode !== "year");
  renderApp();
}

function renderApp() {
  const y = appState.currentDate.getFullYear();
  const m = String(appState.currentDate.getMonth() + 1).padStart(2, '0');

  if (appState.viewMode === "month") {
    document.getElementById("current-period-title").innerText = `${y}年${m}月`;
    renderMonthView(y, m);
  } else {
    document.getElementById("current-period-title").innerText = `${y}年`;
    renderYearView(y);
  }
}

function renderMonthView(year, month) {
  const prefix = `${year}-${month}`;
  const monthlyExpenses = appState.rawData.expenses.filter(e => e.date.startsWith(prefix));
  const monthlyIncomes = appState.rawData.incomes.filter(i => i.date.startsWith(prefix));

  const totalExp = monthlyExpenses.reduce((sum, item) => sum + item.amount, 0);
  const totalInc = monthlyIncomes.reduce((sum, item) => sum + item.amount, 0);
  const totalBudget = Object.values(appState.rawData.budgets).reduce((a, b) => a + b, 0);

  document.getElementById("summary-income").innerText = `¥${totalInc.toLocaleString()}`;
  document.getElementById("summary-expense").innerText = `¥${totalExp.toLocaleString()}`;
  document.getElementById("summary-balance").innerText = `¥${(totalInc - totalExp).toLocaleString()}`;
  document.getElementById("summary-budget-diff").innerText = `¥${(totalBudget - totalExp).toLocaleString()}`;

  // 集計: 0円カテゴリーを除外
  const catMap = {};
  appState.rawData.expCategories.forEach(cat => catMap[cat] = 0);
  monthlyExpenses.forEach(e => {
    catMap[e.category] = (catMap[e.category] || 0) + e.amount;
  });

  const activeCategories = Object.keys(catMap).filter(cat => catMap[cat] > 0);
  const expData = activeCategories.map(cat => catMap[cat]);
  const budgetData = activeCategories.map(cat => appState.rawData.budgets[cat] || 0);

  renderExpenseChart(activeCategories, expData, budgetData);
}

function renderExpenseChart(labels, expData, budgetData) {
  const ctx = document.getElementById("expenseChart").getContext("2d");
  if (expenseChartInstance) expenseChartInstance.destroy();

  expenseChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "支出額",
          data: expData,
          backgroundColor: labels.map((_, i) => COLOR_PALETTE[i % COLOR_PALETTE.length])
        },
        {
          label: "設定予算",
          data: budgetData,
          type: "line",
          borderColor: "#000000",
          borderWidth: 2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderYearView(year) {
  const monthlyIncomes = Array(12).fill(0);
  const monthlyExpenses = Array(12).fill(0);

  appState.rawData.incomes.forEach(i => {
    if (i.date.startsWith(year)) {
      const m = parseInt(i.date.split("-")[1], 10) - 1;
      monthlyIncomes[m] += i.amount;
    }
  });

  appState.rawData.expenses.forEach(e => {
    if (e.date.startsWith(year)) {
      const m = parseInt(e.date.split("-")[1], 10) - 1;
      monthlyExpenses[m] += e.amount;
    }
  });

  const ctx = document.getElementById("yearChart").getContext("2d");
  if (yearChartInstance) yearChartInstance.destroy();

  yearChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],
      datasets: [
        { label: "収入", data: monthlyIncomes, backgroundColor: "#10b981" },
        { label: "支出", data: monthlyExpenses, backgroundColor: "#ef4444" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } }
    }
  });
}

// フォーム・モーダル関連
function openTransactionModal(type) {
  document.getElementById("fab-wrapper").classList.remove("active");
  document.getElementById("form-type").value = type;
  document.getElementById("modal-title").innerText = type === "expense" ? "支出の登録" : "収入の登録";
  document.getElementById("group-payment-method").style.display = type === "expense" ? "flex" : "none";

  // 日付デフォルト（今日）
  document.getElementById("form-date").value = new Date().toISOString().split("T")[0];

  // カテゴリー・名簿のドロップダウン設定
  const catSelect = document.getElementById("form-category");
  catSelect.innerHTML = "";
  const categories = type === "expense" ? appState.rawData.expCategories : appState.rawData.incCategories;
  categories.forEach(c => catSelect.add(new Option(c, c)));

  const memSelect = document.getElementById("form-member");
  memSelect.innerHTML = "";
  appState.rawData.members.forEach(m => memSelect.add(new Option(m, m)));

  document.getElementById("transaction-modal").classList.remove("hidden");
}

function closeTransactionModal() {
  document.getElementById("transaction-modal").classList.add("hidden");
  document.getElementById("transaction-form").reset();
}

function handleTransactionSubmit(e) {
  e.preventDefault();
  const type = document.getElementById("form-type").value;
  const payload = {
    date: document.getElementById("form-date").value,
    category: document.getElementById("form-category").value,
    amount: Number(document.getElementById("form-amount").value),
    member: document.getElementById("form-member").value,
    memo: document.getElementById("form-memo").value,
    paymentMethod: document.getElementById("form-payment-method").value
  };

  closeTransactionModal();
  sendPostData({
    action: type === "expense" ? "addExpense" : "addIncome",
    payload: payload
  });
}

function openBudgetModal() {
  const container = document.getElementById("budget-inputs-container");
  container.innerHTML = "";

  appState.rawData.expCategories.forEach(cat => {
    const val = appState.rawData.budgets[cat] || 0;
    const div = document.createElement("div");
    div.className = "form-group";
    div.innerHTML = `
      <label>${cat}</label>
      <input type="number" class="budget-input-item" data-category="${cat}" value="${val}" min="0">
    `;
    container.appendChild(div);
  });

  // リアルタイム合計計算イベント
  container.querySelectorAll(".budget-input-item").forEach(input => {
    input.addEventListener("input", calcTotalBudgetPreview);
  });

  calcTotalBudgetPreview();
  document.getElementById("budget-modal").classList.remove("hidden");
}

function calcTotalBudgetPreview() {
  let sum = 0;
  document.querySelectorAll(".budget-input-item").forEach(input => {
    sum += Number(input.value) || 0;
  });
  document.getElementById("budget-total-sum").innerText = `¥${sum.toLocaleString()}`;
}

function handleBudgetSubmit(e) {
  e.preventDefault();
  const newBudgets = {};
  document.querySelectorAll(".budget-input-item").forEach(input => {
    newBudgets[input.dataset.category] = Number(input.value) || 0;
  });

  document.getElementById("budget-modal").classList.add("hidden");
  sendPostData({
    action: "saveBudgetsData",
    payload: newBudgets
  });
}
