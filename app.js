// ==========================================
// 初期設定 & 状態管理
// ==========================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbxfxd5xpL_LwmhoMzMm08_F5lXNhQlJavm7I6kiCFL8ZRQtXhsJEPAGOcfA8vAOt4Wp/exec";
let API_TOKEN = localStorage.getItem("kakeibo_token");

let state = {
  currentDate: new Date(),
  config: null,
  transactions: []
};

// ==========================================
// 起動処理
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  if (!API_TOKEN) {
    API_TOKEN = prompt("アクセス用のシークレットトークンを入力してください:");
    if (API_TOKEN) localStorage.setItem("kakeibo_token", API_TOKEN);
    else return alert("トークンがないため利用できません。");
  }

  setupEventListeners();
  setDefaultDates();
  
  // 初期データの取得
  await fetchConfig();
  await loadMonthData();
});

// ==========================================
// API通信ヘルパー
// ==========================================
async function apiCall(action, payload = {}) {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ token: API_TOKEN, action, ...payload })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  } catch (error) {
    console.error(error);
    alert("通信エラーが発生しました。トークンが間違っている可能性があります。");
  }
}

// ==========================================
// データ取得 & 描画
// ==========================================
async function fetchConfig() {
  state.config = await apiCall("getConfig");
  populateDropdowns();
}

async function loadMonthData() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth() + 1;
  document.getElementById("month-display").textContent = `${year}年 ${month}月`;
  
  const listEl = document.getElementById("transaction-list");
  listEl.innerHTML = "<div style='text-align:center; padding: 48px; color: #5f6368;'>読み込み中...</div>";
  
  state.transactions = await apiCall("getData", { year, month }) || [];
  renderList();
  renderChart();
}

function renderList() {
  const listEl = document.getElementById("transaction-list");
  listEl.innerHTML = "";
  
  let sumInc = 0, sumExp = 0;

  state.transactions.forEach(t => {
    const amount = Number(t.amount) || 0;
    if (t.type === "income") sumInc += amount;
    else sumExp += amount;

    const dateStr = new Date(t.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    const nameBadge = t.name ? ` | ${t.name}` : "";
    const payment = t.payment ? ` | ${t.payment}` : "";

    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="item-left">
        <span class="item-title">${t.content}</span>
        <span class="item-meta">${dateStr} | ${t.category}${nameBadge}${payment}</span>
      </div>
      <div class="item-right ${t.type}">${t.type === "income" ? "+" : "-"}¥${amount.toLocaleString()}</div>
    `;
    listEl.appendChild(div);
  });

  if (state.transactions.length === 0) listEl.innerHTML = "<p style='text-align:center; color:#999; padding: 48px;'>データがありません</p>";

  document.getElementById("sum-income").textContent = `¥${sumInc.toLocaleString()}`;
  document.getElementById("sum-expense").textContent = `¥${sumExp.toLocaleString()}`;
  document.getElementById("sum-total").textContent = `¥${(sumInc - sumExp).toLocaleString()}`;
}

// ==========================================
// UI・イベント制御
// ==========================================
function setupEventListeners() {
  // 月移動
  document.getElementById("prev-month").onclick = () => changeMonth(-1);
  document.getElementById("next-month").onclick = () => changeMonth(1);
  
  // ビュー切り替え
  document.getElementById("toggle-view").onclick = (e) => {
    const isAnnual = document.getElementById("annual-view").classList.contains("active");
    document.getElementById("monthly-view").classList.toggle("active", isAnnual);
    document.getElementById("annual-view").classList.toggle("active", !isAnnual);
    e.target.textContent = isAnnual ? "年間分析" : "月間一覧";
  };

  // FAB制御
  document.getElementById("fab-main").onclick = () => {
    document.getElementById("fab-menu").classList.toggle("open");
    document.getElementById("fab-main").classList.toggle("open");
  };

  // フォーム送信
  document.getElementById("expense-form").onsubmit = (e) => handleFormSubmit(e, "addExpense");
  document.getElementById("income-form").onsubmit = (e) => handleFormSubmit(e, "addIncome");
}

function changeMonth(delta) {
  state.currentDate.setMonth(state.currentDate.getMonth() + delta);
  loadMonthData();
}

function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  document.querySelectorAll('form input[name="date"]').forEach(input => {
    input.value = today;
  });
}

function populateDropdowns() {
  if (!state.config) return;
  
  const populate = (selector, data) => {
    const select = document.querySelector(selector);
    data.forEach(item => {
      const option = document.createElement("option");
      option.value = item; option.textContent = item;
      select.appendChild(option);
    });
  };

  populate('#expense-form select[name="category"]', state.config.expenseCategories);
  populate('#income-form select[name="category"]', state.config.incomeCategories);
  populate('#expense-form select[name="name"]', state.config.names);
  populate('#income-form select[name="name"]', state.config.names);
}

// モーダル制御
window.openModal = (type) => {
  document.getElementById("modal-overlay").classList.add("open");
  document.getElementById(`${type}-modal`).classList.add("open");
  document.getElementById("fab-menu").classList.remove("open");
  document.getElementById("fab-main").classList.remove("open");
};

window.closeModals = () => {
  document.getElementById("modal-overlay").classList.remove("open");
  document.querySelectorAll(".modal").forEach(m => m.classList.remove("open"));
};

async function handleFormSubmit(e, action) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  
  const submitBtn = form.querySelector(".submit-btn");
  submitBtn.disabled = true; submitBtn.textContent = "送信中...";

  await apiCall(action, data);
  
  form.reset();
  setDefaultDates();
  closeModals();
  submitBtn.disabled = false; submitBtn.textContent = "登録する";
  
  loadMonthData(); // 再読み込み
}

// ==========================================
// 簡易チャート描画 (Chart.js)
// ==========================================
let chartInstance = null;
function renderChart() {
  const ctx = document.getElementById("annual-chart");
  if (!ctx || !document.getElementById("annual-view").classList.contains("active")) return;
  if (chartInstance) chartInstance.destroy();
  
  // 表示中の月のカテゴリー別支出を集計
  const expenses = state.transactions.filter(t => t.type === "expense");
  const categories = {};
  expenses.forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + Number(t.amount);
  });

  const categoryNames = Object.keys(categories);
  if (categoryNames.length === 0) {
    if (chartInstance) chartInstance.destroy();
    document.querySelector('.chart-container').innerHTML = "<p style='text-align:center; padding: 48px; color:#999;'>データがありません</p>";
    return;
  } else {
    // グラフを再配置
     document.querySelector('.chart-container').innerHTML = '<canvas id="annual-chart"></canvas>';
  }

  chartInstance = new Chart(document.getElementById("annual-chart"), {
    type: 'doughnut',
    data: {
      labels: categoryNames,
      datasets: [{
        data: Object.values(categories),
        backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#06b6d4', '#3b82f6', '#8b5cf6'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } }, title: { display: false } }
    }
  });
}
