const GAS_URL = "https://script.google.com/macros/s/AKfycbxfxd5xpL_LwmhoMzMm08_F5lXNhQlJavm7I6kiCFL8ZRQtXhsJEPAGOcfA8vAOt4Wp/exec";
const CACHE_KEY = "kakeibo_local_data_v2";

let appState = {
  currentDate: new Date(),
  activeTab: "dashboard",
  rawData: {
    expCategories: [],
    expColors: {},
    incCategories: [],
    incColors: {},
    members: [],
    budgetsMaster: [],
    fixedExpensesMaster: [],
    expenses: [],
    incomes: []
  }
};

const COLOR_PALETTE = [
  "#f87171", "#60a5fa", "#a78bfa", "#818cf8",
  "#6ee7b7", "#fbbf24", "#f472b6", "#38bdf8"
];

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initMonthSelector();
  
  const hasCache = loadLocalCacheAndRender();

  if (!hasCache) {
    renderAppSkeleton();
  }

  syncWithGAS();

  document.getElementById("form-add-category").addEventListener("submit", handleAddCategory);
  document.getElementById("form-transaction").addEventListener("submit", handleTransactionSubmit);
});

function loadLocalCacheAndRender() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      appState.rawData = JSON.parse(cached);
      if (!appState.rawData.expColors) appState.rawData.expColors = {};
      if (!appState.rawData.incColors) appState.rawData.incColors = {};
      if (!appState.rawData.budgetsMaster) appState.rawData.budgetsMaster = [];
      if (!appState.rawData.fixedExpensesMaster) appState.rawData.fixedExpensesMaster = [];
      renderApp();
      return true;
    } catch (e) {
      console.error("キャッシュエラー:", e);
    }
  }
  return false;
}

function saveLocalCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(appState.rawData));
}

function renderAppSkeleton() {
  const y = appState.currentDate.getFullYear();
  const m = String(appState.currentDate.getMonth() + 1).padStart(2, '0');
  document.querySelectorAll(".month-display").forEach(el => el.innerText = `${y}年${parseInt(m)}月`);
  
  const grid = document.getElementById("category-budget-grid");
  grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">データを読み込んでいます...</div>`;
}

function syncWithGAS() {
  const callbackName = "gasCallback_" + Date.now();
  
  window[callbackName] = function(response) {
    if (response.status === "success") {
      appState.rawData = response.data;
      if (!appState.rawData.expColors) appState.rawData.expColors = {};
      if (!appState.rawData.incColors) appState.rawData.incColors = {};
      if (!appState.rawData.budgetsMaster) appState.rawData.budgetsMaster = [];
      if (!appState.rawData.fixedExpensesMaster) appState.rawData.fixedExpensesMaster = [];
      saveLocalCache();
      renderApp();
    }
    delete window[callbackName];
    if (script && script.parentNode) script.parentNode.removeChild(script);
  };

  const script = document.createElement("script");
  script.src = `${GAS_URL}?action=getInitialData&callback=${callbackName}`;
  document.body.appendChild(script);
}

async function sendPostDataBackground(payload, callbackOnSuccess) {
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.status === "success" && callbackOnSuccess) {
      callbackOnSuccess(result);
    }
  } catch (err) {
    console.error("同期エラー:", err);
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

  const totalExp = mExpenses.reduce((s, item) => s + item.amount, 0);
  const totalInc = mIncomes.reduce((s, item) => s + item.amount, 0);

  document.getElementById("sum-income").innerText = `¥${totalInc.toLocaleString()}`;
  document.getElementById("sum-expense").innerText = `¥${totalExp.toLocaleString()}`;
  document.getElementById("sum-balance").innerText = `¥${(totalInc - totalExp).toLocaleString()}`;

  renderDashboardGrid(prefix, mExpenses);
  renderMemberExpense(mExpenses);
  renderFixedExpensesGrid(prefix, mExpenses);
  renderMemberIncome(mIncomes);
  renderExpenseList(mExpenses);
  renderIncomeList(mIncomes);
  renderCategoryManageList(prefix);
}

// 特定の年月に適用される予算額を取得する関数
function getEffectiveBudget(prefixYearMonth, category) {
  const history = appState.rawData.budgetsMaster.filter(b => b.category === category && (!b.startMonth || b.startMonth <= prefixYearMonth));
  if (history.length === 0) return 0;
  
  history.sort((a, b) => (a.startMonth > b.startMonth ? -1 : 1));
  return history[0].amount;
}

function renderFixedExpensesGrid(prefixYearMonth, mExpenses) {
  const grid = document.getElementById("fixed-expense-grid");
  if (!grid) return;
  grid.innerHTML = "";

  let totalFixedAmount = 0;
  const activeMasters = appState.rawData.fixedExpensesMaster.filter(item => {
    return !item.startMonth || item.startMonth <= prefixYearMonth;
  });

  activeMasters.forEach((item, i) => {
    const existingRecord = mExpenses.find(e => e.category === item.name);
    const currentAmount = existingRecord ? existingRecord.amount : item.defaultAmount;
    totalFixedAmount += currentAmount;

    const color = item.color || COLOR_PALETTE[i % COLOR_PALETTE.length];

    const card = document.createElement("div");
    card.className = "cat-card";
    card.innerHTML = `
      <div class="cat-header">
        <div class="cat-title-wrap">
          <span class="cat-dot" style="background:${escapeHTML(color)}"></span>
          <span>${escapeHTML(item.name)}</span>
        </div>
        <div class="input-with-yen">
          <span>¥</span>
          <input type="number" class="form-control fixed-amount-input" data-cat="${escapeHTML(item.name)}" value="${currentAmount}" style="width:100px; text-align:right; font-weight:700;">
        </div>
      </div>
      <div class="cat-footer">
        <span>標準: ¥${item.defaultAmount.toLocaleString()}</span>
      </div>
    `;
    grid.appendChild(card);
  });

  document.querySelectorAll(".fixed-amount-input").forEach(input => {
    input.addEventListener("change", (e) => {
      const cat = e.target.dataset.cat;
      const val = Number(e.target.value) || 0;
      const date = `${prefixYearMonth}-01`;

      let existingRecord = appState.rawData.expenses.find(exp => exp.date && exp.date.startsWith(prefixYearMonth) && exp.category === cat);

      if (existingRecord) {
        existingRecord.amount = val;
      } else {
        const newRecord = {
          id: "temp_" + Date.now(),
          sheetName: "現金等",
          rowIndex: null,
          date: date,
          category: cat,
          memo: "固定費",
          amount: val,
          member: ""
        };
        appState.rawData.expenses.unshift(newRecord);
      }

      saveLocalCache();
      renderApp();

      sendPostDataBackground({
        action: "saveFixedExpenseRecord",
        payload: {
          date: date,
          category: cat,
          amount: val,
          memo: "固定費"
        }
      });
    });
  });

  document.getElementById("sum-fixed-expense").innerText = `¥${totalFixedAmount.toLocaleString()}`;
}

// 当月の適用予算に基づいてダッシュボードグリッドを描画
function renderDashboardGrid(prefixYearMonth, mExpenses) {
  const grid = document.getElementById("category-budget-grid");
  grid.innerHTML = "";

  const expMap = {};
  appState.rawData.expCategories.forEach(c => expMap[c] = 0);
  mExpenses.forEach(e => {
    if (e.category) {
      expMap[e.category] = (expMap[e.category] || 0) + e.amount;
    }
  });

  let totalBudget = 0;

  appState.rawData.expCategories.forEach((cat, i) => {
    const amount = expMap[cat] || 0;
    const budget = getEffectiveBudget(prefixYearMonth, cat);
    const remaining = budget - amount;
    totalBudget += budget;

    const color = appState.rawData.expColors[cat] || COLOR_PALETTE[i % COLOR_PALETTE.length];
    const progressPercent = budget > 0 ? Math.min(100, Math.round((amount / budget) * 100)) : 0;

    const card = document.createElement("div");
    card.className = "cat-card";
    card.innerHTML = `
      <div class="cat-header">
        <div class="cat-title-wrap">
          <span class="cat-dot" style="background:${escapeHTML(color)}"></span>
          <span>${escapeHTML(cat)}</span>
        </div>
        <strong>¥${amount.toLocaleString()}</strong>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${progressPercent}%; background-color: ${escapeHTML(color)};"></div>
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
      <span>${escapeHTML(mem)}</span>
      <strong>¥${amount.toLocaleString()}</strong>
    `;
    container.appendChild(card);
  });
}

function renderMemberExpense(mExpenses) {
  const container = document.getElementById("member-expense-container");
  if (!container) return;
  container.innerHTML = "";

  const memberMap = {};
  appState.rawData.members.forEach(m => memberMap[m] = 0);

  mExpenses.forEach(exp => {
    if (exp.member && exp.member.trim() !== "") {
      const mem = exp.member.trim();
      memberMap[mem] = (memberMap[mem] || 0) + exp.amount;
    }
  });

  Object.keys(memberMap).forEach(mem => {
    const amount = memberMap[mem];
    const card = document.createElement("div");
    card.className = "member-card";
    card.innerHTML = `
      <span>${escapeHTML(mem)}</span>
      <strong>¥${amount.toLocaleString()}</strong>
    `;
    container.appendChild(card);
  });
}

function renderExpenseList(mExpenses) {
  const container = document.getElementById("expense-list-container");
  container.innerHTML = "";

  const total = mExpenses.reduce((s, i) => s + i.amount, 0);
  document.getElementById("expense-stats").innerText = `${mExpenses.length}件 / ¥${total.toLocaleString()}`;

  mExpenses.forEach(item => {
    const row = document.createElement("div");
    row.className = "list-row";
    
    let catOptions = `<option value="" ${!item.category ? 'selected' : ''}></option>`;
    catOptions += appState.rawData.expCategories.map(c => 
      `<option value="${escapeHTML(c)}" ${c === item.category ? 'selected' : ''}>${escapeHTML(c)}</option>`
    ).join("");

    row.innerHTML = `
      <div class="row-left">
        <span class="row-date">${item.date ? escapeHTML(item.date.substring(5)) : ''}</span>
        <div>
          <span class="row-memo">${escapeHTML(item.memo || '(内容なし)')}</span>
          ${item.member ? `<span class="row-submemo">個人支出: ${escapeHTML(item.member)}</span>` : ''}
        </div>
      </div>
      <div class="row-right">
        <select class="category-select" data-id="${escapeHTML(item.id)}">
          ${catOptions}
        </select>
        <span class="row-amount">¥${item.amount.toLocaleString()}</span>
        <button class="btn-delete" data-id="${escapeHTML(item.id)}">🗑</button>
      </div>
    `;

    row.querySelector(".category-select").addEventListener("change", (e) => {
      updateCategory(e.target.dataset.id, e.target.value);
    });

    row.querySelector(".btn-delete").addEventListener("click", (e) => {
      deleteItem(e.currentTarget.dataset.id);
    });

    container.appendChild(row);
  });
}

function renderIncomeList(mIncomes) {
  const container = document.getElementById("income-list-container");
  container.innerHTML = "";

  const total = mIncomes.reduce((s, i) => s + i.amount, 0);
  document.getElementById("income-stats").innerText = `${mIncomes.length}件 / ¥${total.toLocaleString()}`;

  mIncomes.forEach(item => {
    const row = document.createElement("div");
    row.className = "list-row";

    let catOptions = `<option value="" ${!item.category ? 'selected' : ''}></option>`;
    catOptions += appState.rawData.incCategories.map(c => 
      `<option value="${escapeHTML(c)}" ${c === item.category ? 'selected' : ''}>${escapeHTML(c)}</option>`
    ).join("");

    row.innerHTML = `
      <div class="row-left">
        <span class="row-date">${item.date ? escapeHTML(item.date.substring(5)) : ''}</span>
        <div>
          <span class="row-memo">${escapeHTML(item.memo || '(内容なし)')}</span>
          ${item.member ? `<span class="row-submemo">${escapeHTML(item.member)}</span>` : ''}
        </div>
      </div>
      <div class="row-right">
        <select class="category-select" data-id="${escapeHTML(item.id)}">
          ${catOptions}
        </select>
        <span class="row-amount">¥${item.amount.toLocaleString()}</span>
        <button class="btn-delete" data-id="${escapeHTML(item.id)}">🗑</button>
      </div>
    `;

    row.querySelector(".category-select").addEventListener("change", (e) => {
      updateCategory(e.target.dataset.id, e.target.value);
    });

    row.querySelector(".btn-delete").addEventListener("click", (e) => {
      deleteItem(e.currentTarget.dataset.id);
    });

    container.appendChild(row);
  });
}

function renderCategoryManageList(prefixYearMonth) {
  const expContainer = document.getElementById("exp-category-manage-list");
  expContainer.innerHTML = "";

  appState.rawData.expCategories.forEach((cat, i) => {
    const budget = getEffectiveBudget(prefixYearMonth, cat);
    const color = appState.rawData.expColors[cat] || COLOR_PALETTE[i % COLOR_PALETTE.length];

    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div class="row-left">
        <input type="color" class="category-color-picker" data-type="支出" data-cat="${escapeHTML(cat)}" value="${escapeHTML(color)}">
        <span class="row-memo">${escapeHTML(cat)}</span>
      </div>
      <div class="row-right">
        <button class="arrow-btn btn-move-up" data-type="支出" data-index="${i}">▲</button>
        <button class="arrow-btn btn-move-down" data-type="支出" data-index="${i}">▼</button>
        <span style="font-size:0.85rem; color:var(--text-muted);">予算</span>
        <div class="input-with-yen">
          <span>¥</span>
          <input type="number" class="form-control budget-update-input" data-cat="${escapeHTML(cat)}" value="${budget}" style="width:100px;">
        </div>
        <button class="btn-delete btn-delete-cat" data-type="支出" data-cat="${escapeHTML(cat)}">🗑</button>
      </div>
    `;
    expContainer.appendChild(row);
  });

  const incContainer = document.getElementById("inc-category-manage-list");
  incContainer.innerHTML = "";

  appState.rawData.incCategories.forEach((cat, i) => {
    const color = appState.rawData.incColors[cat] || COLOR_PALETTE[i % COLOR_PALETTE.length];

    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div class="row-left">
        <input type="color" class="category-color-picker" data-type="収入" data-cat="${escapeHTML(cat)}" value="${escapeHTML(color)}">
        <span class="row-memo">${escapeHTML(cat)}</span>
      </div>
      <div class="row-right">
        <button class="arrow-btn btn-move-up" data-type="収入" data-index="${i}">▲</button>
        <button class="arrow-btn btn-move-down" data-type="収入" data-index="${i}">▼</button>
        <button class="btn-delete btn-delete-cat" data-type="収入" data-cat="${escapeHTML(cat)}">🗑</button>
      </div>
    `;
    incContainer.appendChild(row);
  });

  const fixedContainer = document.getElementById("fixed-category-manage-list");
  if (fixedContainer) {
    fixedContainer.innerHTML = "";
    appState.rawData.fixedExpensesMaster.forEach((item, i) => {
      const color = item.color || COLOR_PALETTE[i % COLOR_PALETTE.length];
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `
        <div class="row-left">
          <span class="cat-dot" style="background:${escapeHTML(color)}"></span>
          <span class="row-memo">${escapeHTML(item.name)}</span>
        </div>
        <div class="row-right">
          <span style="font-size:0.85rem; color:var(--text-muted);">標準額: ¥${item.defaultAmount.toLocaleString()}</span>
        </div>
      `;
      fixedContainer.appendChild(row);
    });
  }

  attachCategoryManagementEvents(prefixYearMonth);
}

function attachCategoryManagementEvents(prefixYearMonth) {
  document.querySelectorAll(".category-color-picker").forEach(picker => {
    picker.addEventListener("change", (e) => {
      const type = e.target.dataset.type;
      const cat = e.target.dataset.cat;
      const newColor = e.target.value;

      if (type === "支出") {
        appState.rawData.expColors[cat] = newColor;
      } else {
        appState.rawData.incColors[cat] = newColor;
      }
      saveLocalCache();
      renderApp();

      sendPostDataBackground({
        action: "saveCategoryOrder",
        payload: {
          type,
          categories: type === "支出" ? appState.rawData.expCategories : appState.rawData.incCategories,
          colors: type === "支出" ? appState.rawData.expColors : appState.rawData.incColors
        }
      });
    });
  });

  document.querySelectorAll(".budget-update-input").forEach(input => {
    input.addEventListener("change", (e) => {
      const cat = e.target.dataset.cat;
      const val = Number(e.target.value) || 0;
      
      // 当月適用開始年月としてマスターに追加
      appState.rawData.budgetsMaster.push({
        category: cat,
        amount: val,
        startMonth: prefixYearMonth
      });

      saveLocalCache();
      renderApp();

      sendPostDataBackground({
        action: "updateBudgets",
        payload: {
          category: cat,
          amount: val,
          startMonth: prefixYearMonth
        }
      });
    });
  });

  document.querySelectorAll(".btn-move-up").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const type = e.currentTarget.dataset.type;
      const index = Number(e.currentTarget.dataset.index);
      moveCategory(type, index, -1);
    });
  });

  document.querySelectorAll(".btn-move-down").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const type = e.currentTarget.dataset.type;
      const index = Number(e.currentTarget.dataset.index);
      moveCategory(type, index, 1);
    });
  });

  document.querySelectorAll(".btn-delete-cat").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const type = e.currentTarget.dataset.type;
      const cat = e.currentTarget.dataset.cat;
      deleteCategory(type, cat);
    });
  });
}

function moveCategory(type, index, direction) {
  const list = type === "支出" ? appState.rawData.expCategories : appState.rawData.incCategories;
  const colorsMap = type === "支出" ? appState.rawData.expColors : appState.rawData.incColors;
  const targetIndex = index + direction;

  if (targetIndex < 0 || targetIndex >= list.length) return;

  const currentCat = list[index];
  const targetCat = list[targetIndex];

  const currentColor = colorsMap[currentCat] || COLOR_PALETTE[index % COLOR_PALETTE.length];
  const targetColor = colorsMap[targetCat] || COLOR_PALETTE[targetIndex % COLOR_PALETTE.length];

  list[index] = targetCat;
  list[targetIndex] = currentCat;

  colorsMap[currentCat] = currentColor;
  colorsMap[targetCat] = targetColor;

  saveLocalCache();
  renderApp();

  sendPostDataBackground({
    action: "saveCategoryOrder",
    payload: {
      type,
      categories: list,
      colors: colorsMap
    }
  });
}

function updateCategory(itemId, newCategory) {
  let item = appState.rawData.expenses.find(e => e.id === itemId) || appState.rawData.incomes.find(i => i.id === itemId);
  if (!item) return;

  item.category = newCategory;
  saveLocalCache();
  renderApp();

  sendPostDataBackground({
    action: "updateCategory",
    payload: { sheetName: item.sheetName, rowIndex: item.rowIndex, category: newCategory }
  });
}

function deleteItem(itemId) {
  if (!confirm("この明細を削除しますか？")) return;

  const expIndex = appState.rawData.expenses.findIndex(e => e.id === itemId);
  let item = null;

  if (expIndex !== -1) {
    item = appState.rawData.expenses[expIndex];
    appState.rawData.expenses.splice(expIndex, 1);
  } else {
    const incIndex = appState.rawData.incomes.findIndex(i => i.id === itemId);
    if (incIndex !== -1) {
      item = appState.rawData.incomes[incIndex];
      appState.rawData.incomes.splice(incIndex, 1);
    }
  }

  if (!item) return;

  saveLocalCache();
  renderApp();

  sendPostDataBackground({
    action: "deleteTransaction",
    payload: { sheetName: item.sheetName, rowIndex: item.rowIndex }
  });
}

function handleTransactionSubmit(e) {
  e.preventDefault();
  const type = document.getElementById("tx-type").value;
  const payload = {
    date: document.getElementById("tx-date").value,
    category: document.getElementById("tx-category").value,
    amount: Number(document.getElementById("tx-amount").value),
    member: document.getElementById("tx-member").value || "",
    memo: document.getElementById("tx-memo").value
  };

  closeTxModal();

  const tempItem = {
    id: "temp_" + Date.now(),
    sheetName: type === "expense" ? "現金等" : "収入",
    rowIndex: null,
    date: payload.date,
    category: payload.category,
    memo: payload.memo,
    amount: payload.amount,
    member: payload.member
  };

  if (type === "expense") {
    appState.rawData.expenses.unshift(tempItem);
  } else {
    appState.rawData.incomes.unshift(tempItem);
  }

  saveLocalCache();
  renderApp();

  sendPostDataBackground({
    action: type === "expense" ? "addExpense" : "addIncome",
    payload: payload
  }, (result) => {
    if (result.newRowIndex) {
      tempItem.rowIndex = result.newRowIndex;
      tempItem.id = `${tempItem.sheetName}_${result.newRowIndex}`;
      saveLocalCache();
    }
  });
}

function handleAddCategory(e) {
  e.preventDefault();
  const type = document.getElementById("new-cat-type").value;
  const name = document.getElementById("new-cat-name").value.trim();
  const budget = Number(document.getElementById("new-cat-budget").value) || 0;

  if (!name) return;

  const currentYearMonth = `${appState.currentDate.getFullYear()}-${String(appState.currentDate.getMonth() + 1).padStart(2, '0')}`;

  if (type === "固定費") {
    const newFixed = {
      name: name,
      defaultAmount: budget,
      color: COLOR_PALETTE[appState.rawData.fixedExpensesMaster.length % COLOR_PALETTE.length],
      startMonth: currentYearMonth
    };
    appState.rawData.fixedExpensesMaster.push(newFixed);

    document.getElementById("form-add-category").reset();
    saveLocalCache();
    renderApp();

    sendPostDataBackground({
      action: "addFixedExpense",
      payload: newFixed
    });
    return;
  }

  if (type === "支出") {
    if (!appState.rawData.expCategories.includes(name)) {
      appState.rawData.expCategories.push(name);
    }
    appState.rawData.budgetsMaster.push({
      category: name,
      amount: budget,
      startMonth: currentYearMonth
    });
  } else {
    if (!appState.rawData.incCategories.includes(name)) {
      appState.rawData.incCategories.push(name);
    }
  }

  document.getElementById("form-add-category").reset();
  saveLocalCache();
  renderApp();

  sendPostDataBackground({
    action: "addCategory",
    payload: { type, name, budget, startMonth: currentYearMonth }
  });
}

function deleteCategory(type, name) {
  if (!confirm(`「${name}」カテゴリーを削除しますか？`)) return;

  if (type === "支出") {
    appState.rawData.expCategories = appState.rawData.expCategories.filter(c => c !== name);
    appState.rawData.budgetsMaster = appState.rawData.budgetsMaster.filter(b => b.category !== name);
    delete appState.rawData.expColors[name];
  } else {
    appState.rawData.incCategories = appState.rawData.incCategories.filter(c => c !== name);
    delete appState.rawData.incColors[name];
  }

  saveLocalCache();
  renderApp();

  sendPostDataBackground({
    action: "deleteCategory",
    payload: { type, name }
  });
}

function openExpenseModal() { openModal("expense"); }
function openIncomeModal() { openModal("income"); }

function openModal(type) {
  document.getElementById("tx-type").value = type;
  document.getElementById("modal-tx-title").innerText = type === "expense" ? "支出の手入力" : "収入の追加";
  document.getElementById("tx-date").value = new Date().toISOString().split("T")[0];

  const catSelect = document.getElementById("tx-category");
  catSelect.innerHTML = "";
  
  catSelect.add(new Option("", ""));
  const categories = type === "expense" ? appState.rawData.expCategories : appState.rawData.incCategories;
  categories.forEach(c => catSelect.add(new Option(c, c)));
  catSelect.value = "";

  const memSelect = document.getElementById("tx-member");
  memSelect.innerHTML = "";
  memSelect.add(new Option("選択なし（家計）", ""));
  appState.rawData.members.forEach(m => memSelect.add(new Option(m, m)));
  memSelect.value = "";

  document.getElementById("modal-transaction").classList.remove("hidden");
}

function closeTxModal() {
  document.getElementById("modal-transaction").classList.add("hidden");
  document.getElementById("form-transaction").reset();
}
