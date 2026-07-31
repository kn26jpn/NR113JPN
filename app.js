// ==========================================
// 設定パラメータ
// ==========================================
// ※ デプロイしたGASのWebアプリURLに書き換えてください
const GAS_URL = "https://script.google.com/macros/s/AKfycbxfxd5xpL_LwmhoMzMm08_F5lXNhQlJavm7I6kiCFL8ZRQtXhsJEPAGOcfA8vAOt4Wp/exec"; 
const ACCESS_TOKEN = "thevillageiii";

// 状態管理
let currentDate = new Date();
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth() + 1;
let masterData = { expCategories: [], incCategories: [], members: [] };

let barChartInstance = null;
let pieChartInstance = null;

// 初期化
document.addEventListener("DOMContentLoaded", async () => {
  setInitialDateInput();
  await fetchMasterData();
  loadMonthlyData();
});

// 今日の日付を YYYY-MM-DD 形式でセット
function setInitialDateInput() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  document.getElementById("form-date").value = `${yyyy}-${mm}-${dd}`;
}

// タブ切り替え
function switchTab(tab) {
  document.getElementById("tab-monthly-btn").classList.toggle("active", tab === "monthly");
  document.getElementById("tab-annual-btn").classList.toggle("active", tab === "annual");
  document.getElementById("view-monthly").classList.toggle("active", tab === "monthly");
  document.getElementById("view-annual").classList.toggle("active", tab === "annual");

  if (tab === "annual") {
    loadAnnualData();
  }
}

// 1. マスタデータ取得
async function fetchMasterData() {
  try {
    const url = `${GAS_URL}?action=getInitialData&token=${ACCESS_TOKEN}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === "success") {
      masterData = json.data;
    }
  } catch (e) {
    console.error("Master data fetch failed:", e);
  }
}

// 2. 月別データ取得・描画
async function loadMonthlyData() {
  document.getElementById("current-month-display").innerText = `${currentYear} / ${String(currentMonth).padStart(2, '0')}`;
  const tbody = document.getElementById("transaction-list");
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">読み込み中...</td></tr>';

  try {
    const url = `${GAS_URL}?action=getMonthlyData&year=${currentYear}&month=${currentMonth}&token=${ACCESS_TOKEN}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.status === "success") {
      renderMonthlyTable(json.data);
    }
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">取得エラーが発生しました</td></tr>';
  }
}

function renderMonthlyTable(items) {
  const tbody = document.getElementById("transaction-list");
  tbody.innerHTML = "";

  let incTotal = 0;
  let expTotal = 0;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">データがありません</td></tr>';
  } else {
    items.forEach(item => {
      if (item.type === "income") incTotal += item.amount;
      else expTotal += item.amount;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.date}</td>
        <td style="color:${item.type === 'income' ? '#10b981' : '#ef4444'}">${item.type === 'income' ? '収入' : '支出'}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.memo)}</td>
        <td>${escapeHtml(item.paymentMethod)}</td>
        <td style="font-weight:bold;">¥${item.amount.toLocaleString()}</td>
        <td>${escapeHtml(item.person || '家計')}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById("total-income").innerText = `¥${incTotal.toLocaleString()}`;
  document.getElementById("total-expense").innerText = `¥${expTotal.toLocaleString()}`;
  document.getElementById("total-balance").innerText = `¥${(incTotal - expTotal).toLocaleString()}`;
}

function changeMonth(diff) {
  currentMonth += diff;
  if (currentMonth > 12) { currentMonth = 1; currentYear++; }
  else if (currentMonth < 1) { currentMonth = 12; currentYear--; }
  loadMonthlyData();
}

// 3. 年間データ取得・グラフ描画
async function loadAnnualData() {
  document.getElementById("current-year-display").innerText = `${currentYear}年`;
  try {
    const url = `${GAS_URL}?action=getAnnualData&year=${currentYear}&token=${ACCESS_TOKEN}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === "success") {
      renderAnnualCharts(json.data);
    }
  } catch (e) {
    console.error("Annual data fetch failed:", e);
  }
}

function renderAnnualCharts(data) {
  const months = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const expData = data.monthlySummary.map(m => m.expense);
  const incData = data.monthlySummary.map(m => m.income);

  // 棒グラフ
  if (barChartInstance) barChartInstance.destroy();
  const ctxBar = document.getElementById("bar-chart").getContext("2d");
  barChartInstance = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: '収入', data: incData, backgroundColor: '#10b981' },
        { label: '支出', data: expData, backgroundColor: '#ef4444' }
      ]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });

  // 円グラフ
  const catLabels = Object.keys(data.categorySummary);
  const catValues = Object.values(data.categorySummary);

  if (pieChartInstance) pieChartInstance.destroy();
  const ctxPie = document.getElementById("pie-chart").getContext("2d");
  pieChartInstance = new Chart(ctxPie, {
    type: 'pie',
    data: {
      labels: catLabels,
      datasets: [{
        data: catValues,
        backgroundColor: ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#10b981', '#64748b']
      }]
    },
    options: { responsive: true }
  });
}

function changeYear(diff) {
  currentYear += diff;
  loadAnnualData();
}

// 4. モーダル・FAB制御 & POSTデータ送信
function toggleFab() {
  document.getElementById("fab-options").classList.toggle("open");
}

function openModal(type) {
  toggleFab();
  const modal = document.getElementById("entry-modal");
  const formType = document.getElementById("form-type");
  const title = document.getElementById("modal-title");
  const catSelect = document.getElementById("form-category");
  const personSelect = document.getElementById("form-person");
  const payGroup = document.getElementById("group-payment");

  formType.value = type;
  title.innerText = type === "expense" ? "支出の登録" : "収入の登録";
  payGroup.style.display = type === "expense" ? "flex" : "none";

  // カテゴリー選択肢設定
  catSelect.innerHTML = "";
  const categories = type === "expense" ? masterData.expCategories : masterData.incCategories;
  categories.forEach(c => {
    catSelect.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  });

  // 名簿選択肢設定
  personSelect.innerHTML = '<option value="">家計(全員)</option>';
  masterData.members.forEach(m => {
    personSelect.innerHTML += `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`;
  });

  modal.classList.add("open");
}

function closeModal() {
  document.getElementById("entry-modal").classList.remove("open");
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('.btn-submit');
  submitBtn.disabled = true;
  submitBtn.innerText = "保存中...";

  const type = document.getElementById("form-type").value;
  const payload = {
    token: ACCESS_TOKEN,
    type: type,
    data: {
      date: document.getElementById("form-date").value.replace(/-/g, "/"),
      category: document.getElementById("form-category").value,
      memo: document.getElementById("form-memo").value,
      paymentMethod: document.getElementById("form-payment").value,
      amount: document.getElementById("form-amount").value,
      person: document.getElementById("form-person").value
    }
  };

  try {
    // リダイレクト(302)制限対策に redirect: "follow" を追加
    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const json = await res.json();
    if (json.status === "success") {
      closeModal();
      document.getElementById("form-memo").value = "";
      document.getElementById("form-amount").value = "";
      loadMonthlyData();
    } else {
      alert("保存エラー: " + json.message);
    }
  } catch (err) {
    alert("通信エラーが発生しました");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "保存";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
