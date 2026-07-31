// 初期プレースホルダー（画面の設定ボタンから保存可能）
let GAS_URL = localStorage.getItem("GAS_URL") || "YOUR_GAS_WEBAPP_URL";
let API_TOKEN = localStorage.getItem("API_TOKEN") || "MySecretToken_2026_Key";

// 状態管理
let currentDate = new Date();
let masterData = { expenseCategories: [], incomeCategories: [], members: [] };
let barChartInstance = null;
let pieChartInstance = null;

// 初期化
document.addEventListener("DOMContentLoaded", () => {
  // URLパラメータからのトークン自動セット対応
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("token")) {
    API_TOKEN = urlParams.get("token");
    localStorage.setItem("API_TOKEN", API_TOKEN);
  }

  // 今日の日付をセット
  const todayStr = new Date().toISOString().split("T")[0];
  document.getElementById("form-date").value = todayStr;

  initApp();
});

async function initApp() {
  if (GAS_URL === "YOUR_GAS_WEBAPP_URL" || !GAS_URL) {
    openSettings();
    return;
  }
  await fetchMasterData();
  updateMonthlyView();
}

// -------------------------------------------------------------------
// API 通信
// -------------------------------------------------------------------
async function fetchMasterData() {
  try {
    const url = `${GAS_URL}?action=getInitialData&token=${encodeURIComponent(API_TOKEN)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === "success") {
      masterData = json.data;
    } else {
      alert("マスターデータ取得エラー: " + json.message);
    }
  } catch (e) {
    console.error(e);
  }
}

async function fetchMonthlyData(year, month) {
  const url = `${GAS_URL}?action=getMonthlyData&year=${year}&month=${month}&token=${encodeURIComponent(API_TOKEN)}`;
  const res = await fetch(url);
  return await res.json();
}

async function fetchAnnualData(year) {
  const url = `${GAS_URL}?action=getAnnualData&year=${year}&token=${encodeURIComponent(API_TOKEN)}`;
  const res = await fetch(url);
  return await res.json();
}

// -------------------------------------------------------------------
// 画面制御・描画
// -------------------------------------------------------------------
function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".view-section").forEach(s => s.classList.remove("active"));

  document.getElementById(`tab-${tabName}`).classList.add("active");
  document.getElementById(`view-${tabName}`).classList.add("active");

  if (tabName === "monthly") updateMonthlyView();
  if (tabName === "annual") updateAnnualView();
}

async function updateMonthlyView() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  document.getElementById("current-month-display").textContent = `${year}年${String(month).padStart(2, '0')}月`;

  const tbody = document.getElementById("monthly-list-body");
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">データを読み込み中...</td></tr>';

  const res = await fetchMonthlyData(year, month);
  if (res.status !== "success") {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">取得失敗: ${res.message}</td></tr>`;
    return;
  }

  const records = res.data;
  let totalInc = 0, totalExp = 0;
  tbody.innerHTML = "";

  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">該当するデータがありません</td></tr>';
  } else {
    records.forEach(r => {
      if (r.type === "income") totalInc += r.amount;
      if (r.type === "expense") totalExp += r.amount;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.date}</td>
        <td><span class="badge ${r.type === 'expense' ? 'badge-expense' : 'badge-income'}">${r.type === 'expense' ? '支出' : '収入'}</span></td>
        <td>${escapeHtml(r.category)}</td>
        <td>${escapeHtml(r.memo || '')}</td>
        <td>${escapeHtml(r.paymentMethod || '-')}</td>
        <td>${escapeHtml(r.name || '家計')}</td>
        <td class="text-right" style="font-weight:600; color:${r.type === 'expense' ? 'var(--expense-color)' : 'var(--income-color)'}">
          ${r.type === 'expense' ? '-' : '+'}¥${r.amount.toLocaleString()}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById("total-income").textContent = `¥${totalInc.toLocaleString()}`;
  document.getElementById("total-expense").textContent = `¥${totalExp.toLocaleString()}`;
  document.getElementById("total-balance").textContent = `¥${(totalInc - totalExp).toLocaleString()}`;
}

async function updateAnnualView() {
  const year = currentDate.getFullYear();
  document.getElementById("current-year-display").textContent = `${year}年`;

  const res = await fetchAnnualData(year);
  if (res.status !== "success") return;

  const data = res.data;

  // 1. 月別推移グラフ (Bar Chart)
  const months = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const expData = data.monthly.map(m => m.expense);
  const incData = data.monthly.map(m => m.income);

  if (barChartInstance) barChartInstance.destroy();
  const ctxBar = document.getElementById("barChart").getContext("2d");
  barChartInstance = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: '支出', data: expData, backgroundColor: '#ef4444' },
        { label: '収入', data: incData, backgroundColor: '#10b981' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // 2. 支出カテゴリー内訳 (Pie Chart)
  const catLabels = Object.keys(data.categories);
  const catValues = Object.values(data.categories);

  if (pieChartInstance) pieChartInstance.destroy();
  const ctxPie = document.getElementById("pieChart").getContext("2d");
  pieChartInstance = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: catLabels,
      datasets: [{
        data: catValues,
        backgroundColor: ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#10b981', '#64748b', '#06b6d4']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function changeMonth(diff) {
  currentDate.setMonth(currentDate.getMonth() + diff);
  updateMonthlyView();
}

function changeYear(diff) {
  currentDate.setFullYear(currentDate.getFullYear() + diff);
  updateAnnualView();
}

// -------------------------------------------------------------------
// FAB & モーダル操作
// -------------------------------------------------------------------
function toggleFab() {
  document.querySelector(".fab-container").classList.toggle("active");
}

function openModal(type) {
  toggleFab();
  document.getElementById("form-type").value = type;
  document.getElementById("modal-title").textContent = type === "expense" ? "支出の登録" : "収入の登録";
  
  // 支払方法フィールドの表示切替
  document.getElementById("group-payment-method").style.display = type === "expense" ? "flex" : "none";

  // カテゴリーのプルダウン動的生成
  const catSelect = document.getElementById("form-category");
  catSelect.innerHTML = "";
  const categories = type === "expense" ? masterData.expenseCategories : masterData.incomeCategories;
  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    catSelect.appendChild(opt);
  });

  // 名簿プルダウン動的生成
  const nameSelect = document.getElementById("form-name");
  nameSelect.innerHTML = '<option value="">家計（指定なし）</option>';
  masterData.members.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m; opt.textContent = m;
    nameSelect.appendChild(opt);
  });

  document.getElementById("entry-modal").classList.add("active");
}

function closeModal() {
  document.getElementById("entry-modal").classList.remove("active");
  document.getElementById("entry-form").reset();
  document.getElementById("form-date").value = new Date().toISOString().split("T")[0];
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "送信中...";

  const type = document.getElementById("form-type").value;
  const payload = {
    date: document.getElementById("form-date").value.replace(/-/g, "/"),
    category: document.getElementById("form-category").value,
    amount: document.getElementById("form-amount").value,
    paymentMethod: document.getElementById("form-payment-method").value,
    memo: document.getElementById("form-memo").value,
    name: document.getElementById("form-name").value
  };

  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      redirect: "follow", // GASのリダイレクト対応
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // CORS回避のためtext/plain
      body: JSON.stringify({ token: API_TOKEN, type: type, data: payload })
    });
    
    const json = await res.json();
    if (json.status === "success") {
      closeModal();
      updateMonthlyView();
    } else {
      alert("保存失敗: " + json.message);
    }
  } catch (err) {
    alert("エラーが発生しました: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "保存する";
  }
}

// 設定モーダル
function openSettings() {
  document.getElementById("setting-gas-url").value = GAS_URL === "YOUR_GAS_WEBAPP_URL" ? "" : GAS_URL;
  document.getElementById("setting-token").value = API_TOKEN;
  document.getElementById("settings-modal").classList.add("active");
}

function closeSettings() {
  document.getElementById("settings-modal").classList.remove("active");
}

function saveSettings() {
  const url = document.getElementById("setting-gas-url").value.trim();
  const token = document.getElementById("setting-token").value.trim();
  if (!url) return alert("URLを入力してください");

  localStorage.setItem("GAS_URL", url);
  localStorage.setItem("API_TOKEN", token);
  GAS_URL = url;
  API_TOKEN = token;

  closeSettings();
  initApp();
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
