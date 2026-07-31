// 設定: GASのWebアプリURLを入力してください
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxfxd5xpL_LwmhoMzMm08_F5lXNhQlJavm7I6kiCFL8ZRQtXhsJEPAGOcfA8vAOt4Wp/exec";

let currentYM = new Date().toISOString().slice(0, 7); // YYYY-MM
let globalCategories = {};
let recentIncomesCache = [];
let chartInstance = null; // グラフインスタンス保持用

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  setupEventListeners();
  loadData();
});

function initAuth() {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');

  if (tokenFromUrl) {
    localStorage.setItem('app_token', tokenFromUrl);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const token = localStorage.getItem('app_token');
  if (!token) {
    document.getElementById('auth-error').classList.remove('hidden');
  }
}

async function loadData() {
  const token = localStorage.getItem('app_token');
  if (!token) return;

  showLoading(true);
  document.getElementById('current-month-display').textContent = currentYM;

  try {
    const res = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ token: token, action: 'getData', yearMonth: currentYM })
    });
    const result = await res.json();

    if (result.success) {
      globalCategories = result.data.categories;
      recentIncomesCache = result.data.recentIncomes;
      renderDashboard(result.data);
    } else {
      alert(result.message);
    }
  } catch (err) {
    alert("通信エラーが発生しました: " + err.message);
  } finally {
    showLoading(false);
  }
}

function renderDashboard(data) {
  const expenses = [...data.amex, ...data.cash];
  const totalExp = expenses.reduce((sum, item) => sum + item.amount, 0);
  const totalInc = data.income.reduce((sum, item) => sum + item.amount, 0);
  const totalSav = [...data.savings, ...data.investment].reduce((sum, item) => sum + item.amount, 0);

  document.getElementById('total-expense').textContent = `¥${totalExp.toLocaleString()}`;
  document.getElementById('total-income').textContent = `¥${totalInc.toLocaleString()}`;
  document.getElementById('total-savings').textContent = `¥${totalSav.toLocaleString()}`;

  // 1. 明細リストの描画
  const allRecords = [
    ...expenses.map(i => ({ ...i, type: '支出' })),
    ...data.income.map(i => ({ ...i, type: '収入' })),
    ...data.savings.map(i => ({ ...i, type: '貯蓄' })),
    ...data.investment.map(i => ({ ...i, type: '投資' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const listContainer = document.getElementById('data-list');
  listContainer.innerHTML = '';

  allRecords.forEach(item => {
    const el = document.createElement('div');
    el.className = 'data-item';
    el.innerHTML = `
      <div class="info">
        <div class="title">${item.category} <span style="font-size:0.75rem; font-weight:normal; color:#666;">(${item.person})</span></div>
        <div class="sub">${item.date} | ${item.memo || ''} ${item.paymentMethod ? '[' + item.paymentMethod + ']' : ''}</div>
      </div>
      <div class="amount" style="color: ${getItemColor(item.type)}">
        ${item.type === '支出' ? '-' : '+'}¥${item.amount.toLocaleString()}
      </div>
    `;
    listContainer.appendChild(el);
  });

  // 2. グラフ描画
  renderChart(expenses);
}

// カテゴリー別支出グラフ描画関数
function renderChart(expenses) {
  // カテゴリーごとの金額を集計
  const categoryTotals = {};
  expenses.forEach(item => {
    categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.amount;
  });

  const labels = Object.keys(categoryTotals);
  const dataValues = Object.values(categoryTotals);

  const ctx = document.getElementById('expenseChart').getContext('2d');

  // 既にグラフが存在する場合は破棄して再描画
  if (chartInstance) {
    chartInstance.destroy();
  }

  if (labels.length === 0) {
    // データがない場合の表示
    return;
  }

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: dataValues,
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
          '#FF9F40', '#E7E9ED', '#71B37C', '#EC644B', '#15A085'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

function getItemColor(type) {
  if (type === '支出') return 'var(--expense-color)';
  if (type === '収入') return 'var(--income-color)';
  return 'var(--savings-color)';
}

function setupEventListeners() {
  document.getElementById('prev-month-btn').addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month-btn').addEventListener('click', () => changeMonth(1));

  const fabMain = document.getElementById('fab-main');
  const fabMenu = document.getElementById('fab-menu');
  fabMain.addEventListener('click', () => fabMenu.classList.toggle('hidden'));

  document.querySelectorAll('.fab-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      fabMenu.classList.add('hidden');
      openModal(e.target.dataset.type);
    });
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('entry-form').addEventListener('submit', handleFormSubmit);

  document.getElementById('income-picker-btn').addEventListener('click', () => {
    document.getElementById('recent-income-select').classList.toggle('hidden');
  });

  document.getElementById('recent-income-select').addEventListener('change', (e) => {
    if (e.target.value) {
      document.getElementById('entry-amount').value = e.target.value;
      e.target.classList.add('hidden');
    }
  });
}

function changeMonth(diff) {
  const [y, m] = currentYM.split('-').map(Number);
  const d = new Date(y, m - 1 + diff, 1);
  const newY = d.getFullYear();
  const newM = String(d.getMonth() + 1).padStart(2, '0');
  currentYM = `${newY}-${newM}`;
  loadData();
}

function openModal(type) {
  const modal = document.getElementById('modal');
  document.getElementById('entry-type').value = type;
  document.getElementById('entry-date').valueAsDate = new Date();
  document.getElementById('modal-title').textContent = `${getTypeLabel(type)}の入力`;

  const categorySelect = document.getElementById('entry-category');
  categorySelect.innerHTML = '';
  
  const catKey = type === 'savings' ? 'income' : type;
  const categories = globalCategories[catKey] || [];
  categories.forEach(c => {
    categorySelect.innerHTML += `<option value="${c}">${c}</option>`;
  });

  const personSelect = document.getElementById('entry-person');
  personSelect.innerHTML = '<option value="家計">家計（空欄）</option>';
  (globalCategories.members || []).forEach(m => {
    personSelect.innerHTML += `<option value="${m}">${m}</option>`;
  });

  const paymentGroup = document.getElementById('group-payment-method');
  const incomePickerBtn = document.getElementById('income-picker-btn');
  const recentSelect = document.getElementById('recent-income-select');

  paymentGroup.classList.toggle('hidden', type !== 'expense');
  incomePickerBtn.classList.toggle('hidden', type !== 'savings');
  recentSelect.classList.add('hidden');

  if (type === 'savings') {
    recentSelect.innerHTML = '<option value="">-- 直近収入から選択 --</option>';
    recentIncomesCache.forEach(inc => {
      recentSelect.innerHTML += `<option value="${inc.amount}">${inc.date} - ${inc.category}: ¥${inc.amount.toLocaleString()}</option>`;
    });
  }

  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const token = localStorage.getItem('app_token');

  const payload = {
    type: document.getElementById('entry-type').value,
    date: document.getElementById('entry-date').value,
    category: document.getElementById('entry-category').value,
    amount: Number(document.getElementById('entry-amount').value),
    memo: document.getElementById('entry-memo').value,
    person: document.getElementById('entry-person').value,
    paymentMethod: document.getElementById('entry-payment-method').value
  };

  showLoading(true);
  closeModal();

  try {
    const res = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ token: token, action: 'addRecord', payload: payload })
    });
    const result = await res.json();

    if (result.success) {
      alert("保存しました");
      loadData();
    } else {
      alert("エラー: " + result.message);
    }
  } catch (err) {
    alert("送信失敗: " + err.message);
  } finally {
    showLoading(false);
  }
}

function getTypeLabel(type) {
  const map = { expense: '支出', income: '収入', savings: '貯蓄', investment: '投資' };
  return map[type] || '';
}

function showLoading(show) {
  document.getElementById('loading').classList.toggle('hidden', !show);
}
