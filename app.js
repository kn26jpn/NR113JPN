const GAS_URL = "https://script.google.com/macros/s/AKfycbxfxd5xpL_LwmhoMzMm08_F5lXNhQlJavm7I6kiCFL8ZRQtXhsJEPAGOcfA8vAOt4Wp/exec";

let appState = {
  currentDate: new Date(),
  activeTab: "dashboard",
  rawData: {
    expCategories: [],
    incCategories: [],
    members: [],
    budgets: {},
    expenses: [],
    incomes: []
  }
};

const COLOR_PALETTE = [
  "#f87171", "#60a5fa", "#a78bfa", "#818cf8",
  "#6ee7b7", "#fbbf24", "#f472b6", "#38bdf8"
];

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initMonthSelector();
  fetchInitialData();

  document.getElementById("form-add-category").addEventListener("submit", handleAddCategory);
  document.getElementById("form-transaction").addEventListener("submit", handleTransactionSubmit);
});

// JSONP 通信（CORS完全回避）
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
    if (script && script.parentNode) script.parentNode.removeChild(script);
  };

  const script = document.createElement("script");
  script.src = `${GAS_URL}?action=getInitialData&callback=${callbackName}`;
  document.body.appendChild(script);
}

// POST データ送信 (redirect: "follow")
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
      fetchInitialData();
    } else {
      alert("保存エラー: " + result.message);
    }
  } catch (err) {
    alert("通信エラーが発生しました");
  }
}

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      
      btn.classList.add("active");
      const tabId = btn.dataset.tab;
      document.getElementById(`view-${tabId}`).classList.add("active");
      appState.activeTab = tabId;
      renderApp();
    });
  });
}

function initMonthSelector() {
  document.getElementById("btn-prev-month").addEventListener("click", () => changeMonth(-1));
  document.getElementById("btn-next-month").addEventListener("click", () => changeMonth(1));
}

function changeMonth(delta) {
  appState.currentDate.setMonth(appState.currentDate.getMonth() + delta);
  renderApp();
}

function renderApp() {
  const y = appState.currentDate.getFullYear();
  const m = String(appState.currentDate.getMonth() + 1).padStart(2, '0');
  const monthText = `${y}年${parseInt(m)}月`;

  document.querySelectorAll(".month-display").forEach(el => el.innerText = monthText);

  const prefix = `${y}-${m}`;
  const mExpenses = appState.rawData.expenses.filter(e => e.date && e.date.startsWith(prefix));
  const mIncomes = appState.rawData.incomes.filter(i => i.date && i.date.startsWith(prefix));

  // 収支集計
  const totalExp = mExpenses.reduce((s, item) => s + item.amount, 0);
  const totalInc = mIncomes.reduce((s, item) => s + item.amount, 0);

  document.getElementById("sum-income").innerText = `¥${totalInc.toLocaleString()}`;
  document.getElementById("sum-expense").innerText = `¥${totalExp.toLocaleString()}`;
  document.getElementById("sum-balance").innerText = `¥${(totalInc - totalExp).toLocaleString()}`;

  renderDashboardGrid(mExpenses);
  renderMemberIncome(mIncomes);
  renderExpenseList(mExpenses);
  renderIncomeList(mIncomes);
  renderCategoryManageList();
}

// 1. ダッシュボード画面の描画 (プログレスバー付き)
function renderDashboardGrid(mExpenses) {
  const grid = document.getElementById("category-budget-grid");
  grid.innerHTML = "";

  const expMap = {};
  appState.rawData.expCategories.forEach(c => expMap[c] = 0);
  mExpenses.forEach(e => {
    expMap[e.category] = (expMap[e.category] || 0) + e.amount;
  });

  let totalBudget = 0;

  appState.rawData.expCategories.forEach((cat, i) => {
    const amount = expMap[cat] || 0;
    const budget = appState.rawData.budgets[cat] || 0;
    const remaining = budget - amount;
    totalBudget += budget;

    const color = COLOR_PALETTE[i % COLOR_PALETTE.length];
    const progressPercent = budget > 0 ? Math.min(100, Math.round((amount / budget) * 100)) : 0;

    const card = document.createElement("div");
    card.className = "cat-card";
    card.innerHTML = `
      <div class="cat-header">
        <div class="cat-title-wrap">
          <span class="cat-dot" style="background:${color}"></span>
          <span>${cat}</span>
        </div>
        <strong>¥${amount.toLocaleString()}</strong>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${progressPercent}%; background-color: ${color};"></div>
      </div>
      <div class="cat-footer">
        <span>予算 ¥${budget.toLocaleString()}</span>
        <span class="remaining-val">残り ¥${remaining.toLocaleString()}</span>
      </div>
    `;
    grid.appendChild(card);
  });

  document.getElementById("sum-total-budget").innerText = `¥${totalBudget.toLocaleString()}`;
}

// 2. 人ごとの収入の描画
function renderMemberIncome(mIncomes) {
  const container = document.getElementById("member-income-container");
  container.innerHTML = "";

  const memberMap = {};
  appState.rawData.members.forEach(m => memberMap[m] = 0);

  mIncomes.forEach(inc => {
    const mem = inc.member || "共通";
    memberMap[mem] = (memberMap[mem] || 0) + inc.amount;
  });

  Object.keys(memberMap).forEach(mem => {
    const amount = memberMap[mem];
    const card = document.createElement("div");
    card.className = "member-card";
    card.innerHTML = `
      <span>${mem}</span>
      <strong>¥${amount.toLocaleString()}</strong>
    `;
    container.appendChild(card);
  });
}

// 3. 支出一覧の描画
function renderExpenseList(mExpenses) {
  const container = document.getElementById("expense-list-container");
  container.innerHTML = "";

  const total = mExpenses.reduce((s, i) => s + i.amount, 0);
  document.getElementById("expense-stats").innerText = `${mExpenses.length}件 / ¥${total.toLocaleString()}`;

  mExpenses.forEach(item => {
    const row = document.createElement("div");
    row.className = "list-row";
    
    const catOptions = appState.rawData.expCategories.map(c => 
      `<option value="${c}" ${c === item.category ? 'selected' : ''}>${c}</option>`
    ).join("");

    row.innerHTML = `
      <div class="row-left">
        <span class="row-date">${item.date ? item.date.substring(5) : ''}</span>
        <div>
          <span class="row-memo">${item.memo || '(内容なし)'}</span>
          ${item.member ? `<span class="row-submemo">${item.member}</span>` : ''}
        </div>
      </div>
      <div class="row-right">
        <select class="category-select" onchange="updateCategory('${item.sheetName}', ${item.rowIndex}, this.value)">
          ${catOptions}
        </select>
        <span class="row-amount">¥${item.amount.toLocaleString()}</span>
        <button class="btn-delete" onclick="deleteItem('${item.sheetName}', ${item.rowIndex})">🗑</button>
      </div>
    `;
    container.appendChild(row);
  });
}

// 4. 収入一覧の描画
function renderIncomeList(mIncomes) {
  const container = document.getElementById("income-list-container");
  container.innerHTML = "";

  const total = mIncomes.reduce((s, i) => s + i.amount, 0);
  document.getElementById("income-stats").innerText = `${mIncomes.length}件 / ¥${total.toLocaleString()}`;

  mIncomes.forEach(item => {
    const row = document.createElement("div");
    row.className = "list-row";

    const catOptions = appState.rawData.incCategories.map(c => 
      `<option value="${c}" ${c === item.category ? 'selected' : ''}>${c}</option>`
    ).join("");

    row.innerHTML = `
      <div class="row-left">
        <span class="row-date">${item.date ? item.date.substring(5) : ''}</span>
        <div>
          <span class="row-memo">${item.memo || '(内容なし)'}</span>
          ${item.member ? `<span class="row-submemo">${item.member}</span>` : ''}
        </div>
      </div>
      <div class="row-right">
        <select class="category-select" onchange="updateCategory('${item.sheetName}', ${item.rowIndex}, this.value)">
          ${catOptions}
        </select>
        <span class="row-amount">¥${item.amount.toLocaleString()}</span>
        <button class="btn-delete" onclick="deleteItem('${item.sheetName}', ${item.rowIndex})">🗑</button>
      </div>
    `;
    container.appendChild(row);
  });
}

// 5. カテゴリー・予算管理画面（支出＋収入）
function renderCategoryManageList() {
  // 支出カテゴリー一覧
  const expContainer = document.getElementById("exp-category-manage-list");
  expContainer.innerHTML = "";

  appState.rawData.expCategories.forEach((cat, i) => {
    const budget = appState.rawData.budgets[cat] || 0;
    const color = COLOR_PALETTE[i % COLOR_PALETTE.length];

    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div class="row-left">
        <span class="cat-dot" style="background:${color}"></span>
        <span class="row-memo">${cat}</span>
      </div>
      <div class="row-right">
        <span style="font-size:0.85rem; color:var(--text-muted);">予算</span>
        <input type="number" class="form-control budget-update-input" data-cat="${cat}" value="${budget}" style="width:110px;">
        <button class="btn-delete" onclick="deleteCategory('支出', '${cat}')">🗑</button>
      </div>
    `;
    expContainer.appendChild(row);
  });

  document.querySelectorAll(".budget-update-input").forEach(input => {
    input.addEventListener("change", (e) => {
      const cat = e.target.dataset.cat;
      const val = Number(e.target.value) || 0;
      appState.rawData.budgets[cat] = val;
      sendPostData({
        action: "updateBudgets",
        payload: appState.rawData.budgets
      });
    });
  });

  // 収入カテゴリー一覧
  const incContainer = document.getElementById("inc-category-manage-list");
  incContainer.innerHTML = "";

  appState.rawData.incCategories.forEach((cat, i) => {
    const color = COLOR_PALETTE[i % COLOR_PALETTE.length];

    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div class="row-left">
        <span class="cat-dot" style="background:${color}"></span>
        <span class="row-memo">${cat}</span>
      </div>
      <div class="row-right">
        <button class="btn-delete" onclick="deleteCategory('収入', '${cat}')">🗑</button>
      </div>
    `;
    incContainer.appendChild(row);
  });
}

// 操作アクション
function updateCategory(sheetName, rowIndex, category) {
  sendPostData({
    action: "updateCategory",
    payload: { sheetName, rowIndex, category }
  });
}

function deleteItem(sheetName, rowIndex) {
  if (confirm("この明細を削除しますか？")) {
    sendPostData({
      action: "deleteTransaction",
      payload: { sheetName, rowIndex }
    });
  }
}

function deleteCategory(type, name) {
  if (confirm(`「${name}」カテゴリーを削除しますか？`)) {
    sendPostData({
      action: "deleteCategory",
      payload: { type, name }
    });
  }
}

function openExpenseModal() { openModal("expense"); }
function openIncomeModal() { openModal("income"); }

function openModal(type) {
  document.getElementById("tx-type").value = type;
  document.getElementById("modal-tx-title").innerText = type === "expense" ? "支出の手入力" : "収入の追加";
  document.getElementById("tx-date").value = new Date().toISOString().split("T")[0];

  const catSelect = document.getElementById("tx-category");
  catSelect.innerHTML = "";
  const categories = type === "expense" ? appState.rawData.expCategories : appState.rawData.incCategories;
  categories.forEach(c => catSelect.add(new Option(c, c)));

  const memSelect = document.getElementById("tx-member");
  memSelect.innerHTML = "";
  appState.rawData.members.forEach(m => memSelect.add(new Option(m, m)));

  document.getElementById("modal-transaction").classList.remove("hidden");
}

function closeTxModal() {
  document.getElementById("modal-transaction").classList.add("hidden");
  document.getElementById("form-transaction").reset();
}

function handleTransactionSubmit(e) {
  e.preventDefault();
  const type = document.getElementById("tx-type").value;
  const payload = {
    date: document.getElementById("tx-date").value,
    category: document.getElementById("tx-category").value,
    amount: Number(document.getElementById("tx-amount").value),
    member: document.getElementById("tx-member").value,
    memo: document.getElementById("tx-memo").value
  };

  closeTxModal();
  sendPostData({
    action: type === "expense" ? "addExpense" : "addIncome",
    payload: payload
  });
}

function handleAddCategory(e) {
  e.preventDefault();
  const type = document.getElementById("new-cat-type").value;
  const name = document.getElementById("new-cat-name").value.trim();
  const budget = Number(document.getElementById("new-cat-budget").value) || 0;

  if (!name) return;

  sendPostData({
    action: "addCategory",
    payload: { type, name, budget }
  });

  document.getElementById("form-add-category").reset();
}
