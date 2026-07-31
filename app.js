// ==========================================================================
// App State & Configurations
// ==========================================================================
const CONFIG = {
  // ★ デプロイしたGASのウェブアプリURLをここに記述してください ★
  GAS_URL: "https://script.google.com/macros/s/AKfycbxfxd5xpL_LwmhoMzMm08_F5lXNhQlJavm7I6kiCFL8ZRQtXhsJEPAGOcfA8vAOt4Wp/exec"
};

const COLOR_PALETTE = [
  "#635bff", "#00d4b6", "#ff5b60", "#ffc01e", "#f77238", "#a5a6f6", "#0a2540", "#20c997", "#e83e8c"
];

let state = {
  currentDate: new Date(),
  configData: { expenseCategories: [], incomeCategories: [], names: [] },
  transactions: [],
  budgets: {}
};

let monthlyChartInstance = null;
let annualChartInstance = null;

function getCategoryColor(category) {
  if (!category) return "#8898aa";
  const categories = state.configData.expenseCategories || [];
  const index = categories.indexOf(category);
  if (index !== -1) {
    return COLOR_PALETTE[index % COLOR_PALETTE.length];
  }
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  initDefaultDates();
  await loadInitialBundle();
});

// ==========================================================================
// API Communication Helper
// ==========================================================================
async function fetchAPI(action, payload = {}) {
  try {
    const response = await fetch(CONFIG.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload })
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const res = await response.json();
    if (!res.success) throw new Error(res.error || "API returned failure");
    return res.data;
  } catch (error) {
    console.error("API Error:", error);
    alert("データの同期に失敗しました。GASのデプロイURLおよびネットワーク状況を確認してください。");
    return null;
  }
}

// ==========================================================================
// Data Operations
// ==========================================================================
async function loadInitialBundle() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth() + 1;
  
  document.getElementById("month-display").textContent = `${year}年 ${month}月`;
  document.getElementById("transaction-list").innerHTML = '<div style="padding: 32px; text-align: center; color: var(--text-subtle);">データを読み込み中...</div>';

  const res = await fetchAPI("getInitialBundle", { year, month });
  if (res) {
    state.configData = res.config || { expenseCategories: [], incomeCategories: [], names: [] };
    state.transactions = res.transactions || [];
    state.budgets = res.budgets || {};
    
    populateSelectOptions();
    renderMonthlyView();
    renderAnnualView();
  }
}

async function loadMonthData() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth() + 1;
  
  document.getElementById("month-display").textContent = `${year}年 ${month}月`;
  document.getElementById("transaction-list").innerHTML = '<div style="padding: 32px; text-align: center; color: var(--text-subtle);">データを読み込み中...</div>';

  const res = await fetchAPI("getData", { year, month });
  if (res) {
    state.transactions = res.transactions || [];
    state.budgets = res.budgets || {};
    
    renderMonthlyView();
    renderAnnualView();
  }
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
      const badgeColor = tx.type === "income" ? "var(--income-color)" : getCategoryColor(tx.category);

      const row = document.createElement("div");
      row.className = "tx-row";
      
      const editBtnHtml = (tx.sheetName && tx.rowIndex) ? `
        <button class="btn-edit-cat" onclick="openEditCategoryModal('${tx.sheetName}', ${tx.rowIndex}, '${escapeHTML(tx.content || tx.category)}', '${escapeHTML(tx.category)}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
      ` : "";

      row.innerHTML = `
        <div class="tx-left">
          <div class="tx-category-badge" style="background-color: ${badgeColor};">
            ${tx.category ? tx.category.slice(0, 2) : "収入"}
          </div>
          <div class="tx-details">
            <span class="tx-title">${escapeHTML(tx.content || tx.category)}</span>
            <span class="tx-sub">${dateFormatted} ${tx.payment ? `• ${tx.payment}` : ''} ${tx.name ? `• ${tx.name}` : ''}</span>
          </div>
        </div>
        <div class="tx-right">
          <!-- ★修正★ マイナス表記を取り払い、常にプラスの数値表示 -->
          <div class="tx-amount ${tx.type}">
            ¥${amount.toLocaleString()}
          </div>
          ${editBtnHtml}
        </div>
      `;
      listContainer.appendChild(row);
    });
  }

  document.getElementById("sum-income").textContent = `¥${incomeTotal.toLocaleString()}`;
  document.getElementById("sum-expense").textContent = `¥${expenseTotal.toLocaleString()}`;
  
  const balance = incomeTotal - expenseTotal;
  const balanceEl = document.getElementById("sum-total");
  balanceEl.textContent = `¥${balance.toLocaleString()}`;
  balanceEl.style.color = balance < 0 ? "var(--expense-color)" : "var(--text-main)";

  renderMonthlyChart();
}

function renderMonthlyChart() {
  const expenses = state.transactions.filter(t => t.type === "expense");
  const categoryMap = {};

  if (state.configData && state.configData.expenseCategories) {
    state.configData.expenseCategories.forEach(cat => categoryMap[cat] = 0);
  }

  expenses.forEach(t => {
    const cat = t.category || "未分類";
    categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount);
  });

  const labels = Object.keys(categoryMap);
  const actualValues = labels.map(cat => categoryMap[cat]);
  const budgetValues = labels.map(cat => state.budgets[cat] || 0);
  const backgroundColors = labels.map(cat => getCategoryColor(cat));

  const ctx = document.getElementById("monthly-category-chart");
  if (monthlyChartInstance) monthlyChartInstance.destroy();

  monthlyChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "支出額 (円)",
          data: actualValues,
          backgroundColor: backgroundColors,
          borderRadius: 6,
          order: 2
        },
        {
          label: "予算 (円)",
          data: budgetValues,
          type: "line",
          borderColor: "#ff5b60",
          borderWidth: 2,
          borderDash: [5, 5],
          pointBackgroundColor: "#ff5b60",
          pointRadius: 4,
          fill: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { usePointStyle: true } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12, weight: "bold" } } },
        y: { grid: { color: "#e6ebf1" }, ticks: { font: { size: 11 } }, beginAtZero: true }
      }
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
  const backgroundColors = labels.map(cat => getCategoryColor(cat));

  const breakdownContainer = document.getElementById("category-breakdown");
  breakdownContainer.innerHTML = "";
  
  labels.forEach((cat, i) => {
    const item = document.createElement("div");
    item.className = "breakdown-item";
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="width: 12px; height: 12px; border-radius: 50%; background-color: ${backgroundColors[i]}; display: inline-block;"></span>
        <span style="font-weight: 600;">${escapeHTML(cat)}</span>
      </div>
      <span style="font-weight: 700;">¥${values[i].toLocaleString()}</span>
    `;
    breakdownContainer.appendChild(item);
  });

  const ctx = document.getElementById("category-chart");
  if (annualChartInstance) annualChartInstance.destroy();

  annualChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "年間支出額 (円)",
        data: values,
        backgroundColor: backgroundColors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12, weight: "bold" } } },
        y: { grid: { color: "#e6ebf1" }, ticks: { font: { size: 11 } }, beginAtZero: true }
      }
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

  document.getElementById("btn-open-budget").onclick = openBudgetModal;

  const fabTrigger = document.getElementById("fab-trigger");
  const fabMenu = document.getElementById("fab-menu");
  
  fabTrigger.onclick = () => {
    fabTrigger.classList.toggle("active");
    fabMenu.classList.toggle("active");
  };

  document.getElementById("form-expense").onsubmit = (e) => handleFormSubmit(e, "addExpense");
  document.getElementById("form-income").onsubmit = (e) => handleFormSubmit(e, "addIncome");
  document.getElementById("form-edit-category").onsubmit = (e) => handleFormSubmit(e, "updateCategory");
  document.getElementById("form-budget").onsubmit = (e) => handleBudgetSubmit(e);
}

function changeMonth(delta) {
  state.currentDate.setMonth(state.currentDate.getMonth() + delta);
  loadMonthData();
}

function initDefaultDates() {
  const today = new Date().toISOString().split("T")[0];
  document.querySelectorAll('input[type="date"]').forEach(input => input.value = today);
}

// ★修正★ ドロップダウン選択肢の挿入ロジックを確実に構築
function populateSelectOptions() {
  if (!state.configData) return;

  const fill = (selectId, list) => {
    const el = document.getElementById(selectId);
    if (!el) return;
    el.innerHTML = '<option value="" disabled selected>選択してください</option>';
    if (Array.isArray(list)) {
      list.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item;
        opt.textContent = item;
        el.appendChild(opt);
      });
    }
  };

  fill("select-expense-category", state.configData.expenseCategories);
  fill("select-income-category", state.configData.incomeCategories);
  fill("select-expense-name", state.configData.names);
  fill("select-income-name", state.configData.names);
  fill("edit-category-select", state.configData.expenseCategories);
}

// ★修正★ カテゴリー変更モーダルを正しく開く
window.openEditCategoryModal = (sheetName, rowIndex, content, currentCategory) => {
  populateSelectOptions();
  
  const form = document.getElementById("form-edit-category");
  form.querySelector('input[name="sheetName"]').value = sheetName;
  form.querySelector('input[name="rowIndex"]').value = rowIndex;
  document.getElementById("edit-content-display").value = content;
  
  const select = document.getElementById("edit-category-select");
  if (select) {
    select.value = currentCategory;
  }

  document.getElementById("modal-backdrop").classList.add("active");
  document.getElementById("modal-edit-category").classList.add("active");
};

// ★修正★ 予算設定モーダルを確実に描画
function openBudgetModal() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth() + 1;
  document.getElementById("budget-month-label").textContent = `${year}年${month}月`;

  const container = document.getElementById("budget-input-list");
  container.innerHTML = "";

  const categories = (state.configData && state.configData.expenseCategories) ? state.configData.expenseCategories : [];
  
  if (categories.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-subtle); padding: 16px;">カテゴリーを読み込み中または未登録です</div>';
  } else {
    categories.forEach(cat => {
      const val = state.budgets[cat] !== undefined ? state.budgets[cat] : "";
      const group = document.createElement("div");
      group.className = "form-group";
      group.innerHTML = `
        <label class="form-label">${escapeHTML(cat)} の予算 (円)</label>
        <input type="number" name="budget_${escapeHTML(cat)}" class="form-input" placeholder="0" value="${val}" min="0">
      `;
      container.appendChild(group);
    });
  }

  document.getElementById("modal-backdrop").classList.add("active");
  document.getElementById("modal-budget").classList.add("active");
}

async function handleBudgetSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const budgetData = {};

  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth() + 1;
  const targetYearMonth = `${year}/${String(month).padStart(2, '0')}`;

  for (let [key, val] of formData.entries()) {
    if (key.startsWith("budget_")) {
      const cat = key.replace("budget_", "");
      budgetData[cat] = Number(val) || 0;
    }
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "保存中...";

  await fetchAPI("saveBudgets", { yearMonth: targetYearMonth, budgets: budgetData });

  closeModals();
  submitBtn.disabled = false;
  submitBtn.textContent = "予算を保存";

  await loadMonthData();
}

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
  submitBtn.textContent = "処理中...";

  const success = await fetchAPI(action, formData);

  if (success) {
    form.reset();
    initDefaultDates();
    closeModals();
    await loadMonthData();
  }

  submitBtn.disabled = false;
  submitBtn.textContent = action === "updateCategory" ? "更新する" : "保存する";
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[match]));
}
