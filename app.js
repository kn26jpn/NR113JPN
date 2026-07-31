// ==========================================================================
// App State & Configurations
// ==========================================================================
const CONFIG = {
  // デプロイしたGASのウェブアプリURLを貼り付けてください
  GAS_URL: "https://script.google.com/macros/s/AKfycbxfxd5xpL_LwmhoMzMm08_F5lXNhQlJavm7I6kiCFL8ZRQtXhsJEPAGOcfA8vAOt4Wp/exec",
  STORAGE_KEY: "kakeibo_token"
};

let state = {
  token: null,
  currentDate: new Date(),
  configData: null,
  transactions: []
};

let monthlyChartInstance = null;
let annualChartInstance = null;

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  initAuthentication();
  setupEventListeners();
  initDefaultDates();
  
  // 順次実行で非同期通信の混線・誤エラーを防止
  await loadAppConfig();
  await loadMonthData();
});

// 認証・トークン管理
function initAuthentication() {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get("token");

  if (tokenFromUrl) {
    state.token = tokenFromUrl;
    localStorage.setItem(CONFIG.STORAGE_KEY, tokenFromUrl);
    window.history.replaceState({}, document.title, window.location.pathname);
  } else {
    state.token = localStorage.getItem(CONFIG.STORAGE_KEY);
  }

  if (!state.token) {
    const inputToken = prompt("アクセス用のセキュリティトークンを入力してください:");
    if (inputToken) {
      state.token = inputToken;
      localStorage.setItem(CONFIG.STORAGE_KEY, inputToken);
    } else {
      alert("トークンがないためデータを同期できません。");
    }
  }
}

// ==========================================================================
// API Communication Helper
// ==========================================================================
async function fetchAPI(action, payload = {}) {
  if (!state.token) return null;

  try {
    const response = await fetch(CONFIG.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: state.token, action, ...payload })
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const res = await response.json();
    if (!res.success) {
      throw new Error(res.error || "API returned failure");
    }
    return res.data;
  } catch (error) {
    console.error("API Fetch Error:", error);
    if (action !== "getConfig") {
      alert("データの同期に失敗しました。ネットワーク状況または設定を確認してください。");
    }
    return null;
  }
}

// ==========================================================================
// Data Operations & Rendering
// ==========================================================================
async function loadAppConfig() {
  const data = await fetchAPI("getConfig");
  if (data) {
    state.configData = data;
    populateSelectOptions();
  }
}

async function loadMonthData() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth() + 1;
  
  document.getElementById("month-display").textContent = `${year}年 ${month}月`;
  document.getElementById("transaction-list").innerHTML = '<div style="padding: 32px; text-align: center; color: var(--text-subtle);">データを読み込み中...</div>';

  const data = await fetchAPI("getData", { year, month });
  state.transactions = data || [];
  
  renderMonthlyView();
  renderAnnualView();
}

function renderMonthlyView() {
  const listContainer = document.getElementById("transaction-list");
  listContainer.innerHTML = "";

  let incomeTotal = 0;
  let expenseTotal = 0;

  document.getElementById("transaction-count").textContent = `${state.transactions.length} 件`;

  if (state.transactions.length === 0) {
    listContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-subtle);">今月の記録はありません</div>';
  } else {
    state.transactions.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === "income") incomeTotal += amount;
      else expenseTotal += amount;

      const dateObj = new Date(tx.date);
      const dateFormatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

      const row = document.createElement("div");
      row.className = "tx-row";
      row.innerHTML = `
        <div class="tx-left">
          <div class="tx-category-badge">${tx.category ? tx.category.slice(0, 2) : "他"}</div>
          <div class="tx-details">
            <span class="tx-title">${escapeHTML(tx.content || tx.category)}</span>
            <span class="tx-sub">${dateFormatted} ${tx.payment ? `• ${tx.payment}` : ''} ${tx.name ? `• ${tx.name}` : ''}</span>
          </div>
        </div>
        <div class="tx-amount ${tx.type}">
          ${tx.type === "income" ? "+" : "-"}¥${amount.toLocaleString()}
        </div>
      `;
      listContainer.appendChild(row);
    });
  }

  // サマリーカード更新
  document.getElementById("sum-income").textContent = `¥${incomeTotal.toLocaleString()}`;
  document.getElementById("sum-expense").textContent = `¥${expenseTotal.toLocaleString()}`;
  
  const balance = incomeTotal - expenseTotal;
  const balanceEl = document.getElementById("sum-total");
  balanceEl.textContent = `¥${balance.toLocaleString()}`;
  balanceEl.style.color = balance < 0 ? "var(--expense-color)" : "var(--text-main)";

  // 今月のカテゴリー別グラフ描画
  renderMonthlyChart();
}

function renderMonthlyChart() {
  const expenses = state.transactions.filter(t => t.type === "expense");
  const categoryMap = {};

  expenses.forEach(t => {
    const cat = t.category || "未分類";
    categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount);
  });

  const labels = Object.keys(categoryMap);
  const values = Object.values(categoryMap);

  const ctx = document.getElementById("monthly-category-chart");
  if (monthlyChartInstance) monthlyChartInstance.destroy();

  if (labels.length === 0) {
    ctx.style.display = "none";
    return;
  }
  ctx.style.display = "block";

  monthlyChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          "#635bff", "#00d4b6", "#ff5b60", "#ffc01e", "#f77238", "#a5a6f6", "#111827"
        ],
        borderWidth: 2,
        borderColor: "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right", labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 } } }
      },
      cutout: "65%"
    }
  });
}

function renderAnnualView() {
  const expenses = state.transactions.filter(t => t.type === "expense");
  const categoryMap = {};

  expenses.forEach(t => {
    const cat = t.category || "未分類";
    categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount);
  });

  const labels = Object.keys(categoryMap);
  const values = Object.values(categoryMap);

  // 内訳リスト
  const breakdownContainer = document.getElementById("category-breakdown");
  breakdownContainer.innerHTML = "";
  
  labels.forEach((cat, i) => {
    const item = document.createElement("div");
    item.className = "breakdown-item";
    item.innerHTML = `
      <span style="font-weight: 600;">${escapeHTML(cat)}</span>
      <span style="font-weight: 700;">¥${values[i].toLocaleString()}</span>
    `;
    breakdownContainer.appendChild(item);
  });

  // 年間グラフ描画
  const ctx = document.getElementById("category-chart");
  if (annualChartInstance) annualChartInstance.destroy();

  if (labels.length === 0) return;

  annualChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          "#635bff", "#00d4b6", "#ff5b60", "#ffc01e", "#f77238", "#a5a6f6", "#111827"
        ],
        borderWidth: 2,
        borderColor: "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, padding: 16 } }
      },
      cutout: "70%"
    }
  });
}

// ==========================================
// Event Listeners & UI Controls
// ==========================================
function setupEventListeners() {
  document.getElementById("prev-month").onclick = () => changeMonth(-1);
  document.getElementById("next-month").onclick = () => changeMonth(1);

  const btnMonthly = document.getElementById("btn-monthly-view");
  const btnAnnual = document.getElementById("btn-annual-view");
  const viewMonthly = document.getElementById("monthly-view");
  const viewAnnual = document.getElementById("annual-view");

  btnMonthly.onclick = () => {
    btnMonthly.classList.add("active");
    btnAnnual.classList.remove("active");
    viewMonthly.classList.add("active");
    viewAnnual.classList.remove("active");
  };

  btnAnnual.onclick = () => {
    btnAnnual.classList.add("active");
    btnMonthly.classList.remove("active");
    viewAnnual.classList.add("active");
    viewMonthly.classList.remove("active");
    renderAnnualView();
  };

  const fabTrigger = document.getElementById("fab-trigger");
  const fabMenu = document.getElementById("fab-menu");
  
  fabTrigger.onclick = () => {
    fabTrigger.classList.toggle("active");
    fabMenu.classList.toggle("active");
  };

  document.getElementById("form-expense").onsubmit = (e) => handleFormSubmit(e, "addExpense");
  document.getElementById("form-income").onsubmit = (e) => handleFormSubmit(e, "addIncome");
}

function changeMonth(delta) {
  state.currentDate.setMonth(state.currentDate.getMonth() + delta);
  loadMonthData();
}

function initDefaultDates() {
  const today = new Date().toISOString().split("T")[0];
  document.querySelectorAll('input[type="date"]').forEach(input => input.value = today);
}

function populateSelectOptions() {
  if (!state.configData) return;

  const fillSelect = (selector, list) => {
    const el = document.querySelector(selector);
    list.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      el.appendChild(opt);
    });
  };

  fillSelect('#form-expense select[name="category"]', state.configData.expenseCategories);
  fillSelect('#form-income select[name="category"]', state.configData.incomeCategories);
  fillSelect('#form-expense select[name="name"]', state.configData.names);
  fillSelect('#form-income select[name="name"]', state.configData.names);
}

// モーダル制御
window.openModal = (type) => {
  document.getElementById("modal-backdrop").classList.add("active");
  document.getElementById(`modal-${type}`).classList.add("active");
  document.getElementById("fab-trigger").classList.remove("active");
  document.getElementById("fab-menu").classList.remove("active");
};

window.closeModals = () => {
  document.getElementById("modal-backdrop").classList.remove("active");
  document.querySelectorAll(".modal-window").forEach(m => m.classList.remove("active"));
};

async function handleFormSubmit(e, action) {
  e.preventDefault();
  const form = e.target;
  const formData = Object.fromEntries(new FormData(form).entries());

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "保存中...";

  const success = await fetchAPI(action, formData);

  if (success) {
    form.reset();
    initDefaultDates();
    closeModals();
    await loadMonthData();
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "保存する";
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[match]));
}
