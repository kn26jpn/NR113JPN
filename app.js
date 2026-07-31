{\rtf1\ansi\ansicpg932\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;\f1\fnil\fcharset128 HiraginoSans-W3;\f2\fnil\fcharset0 AppleColorEmoji;
}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 // 
\f1 \'90\'dd\'92\'e8
\f0 : GAS
\f1 \'82\'cc
\f0 Web
\f1 \'83\'41\'83\'76\'83\'8a
\f0 URL
\f1 \'82\'f0\'93\'fc\'97\'cd\'82\'b5\'82\'c4\'82\'ad\'82\'be\'82\'b3\'82\'a2
\f0 \
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxfxd5xpL_LwmhoMzMm08_F5lXNhQlJavm7I6kiCFL8ZRQtXhsJEPAGOcfA8vAOt4Wp/exec";\
\
let currentYM = new Date().toISOString().slice(0, 7); // YYYY-MM\
let globalCategories = \{\};\
let recentIncomesCache = [];\
\
document.addEventListener('DOMContentLoaded', () => \{\
  initAuth();\
  setupEventListeners();\
  loadData();\
\});\
\
// 
\f1 \'94\'46\'8f\'d8\'8f\'88\'97\'9d
\f0 \
function initAuth() \{\
  const urlParams = new URLSearchParams(window.location.search);\
  const tokenFromUrl = urlParams.get('token');\
\
  if (tokenFromUrl) \{\
    localStorage.setItem('app_token', tokenFromUrl);\
    // URL
\f1 \'82\'a9\'82\'e7\'83\'67\'81\'5b\'83\'4e\'83\'93\'83\'70\'83\'89\'83\'81\'81\'5b\'83\'5e\'82\'f0\'8f\'c1\'8b\'8e\'81\'69\'e3\'59\'97\'ed\'82\'c9\'82\'b7\'82\'e9\'81\'6a
\f0 \
    window.history.replaceState(\{\}, document.title, window.location.pathname);\
  \}\
\
  const token = localStorage.getItem('app_token');\
  if (!token) \{\
    document.getElementById('auth-error').classList.remove('hidden');\
  \}\
\}\
\
// 
\f1 \'83\'66\'81\'5b\'83\'5e\'93\'c7\'82\'dd\'8d\'9e\'82\'dd
\f0 \
async function loadData() \{\
  const token = localStorage.getItem('app_token');\
  if (!token) return;\
\
  showLoading(true);\
  document.getElementById('current-month-display').textContent = currentYM;\
\
  try \{\
    const res = await fetch(GAS_API_URL, \{\
      method: 'POST',\
      body: JSON.stringify(\{ token: token, action: 'getData', yearMonth: currentYM \})\
    \});\
    const result = await res.json();\
\
    if (result.success) \{\
      globalCategories = result.data.categories;\
      recentIncomesCache = result.data.recentIncomes;\
      renderDashboard(result.data);\
    \} else \{\
      alert(result.message);\
    \}\
  \} catch (err) \{\
    alert("
\f1 \'92\'ca\'90\'4d\'83\'47\'83\'89\'81\'5b\'82\'aa\'94\'ad\'90\'b6\'82\'b5\'82\'dc\'82\'b5\'82\'bd
\f0 : " + err.message);\
  \} finally \{\
    showLoading(false);\
  \}\
\}\
\
// 
\f1 \'83\'5f\'83\'62\'83\'56\'83\'85\'83\'7b\'81\'5b\'83\'68\'95\'60\'89\'e6
\f0 \
function renderDashboard(data) \{\
  const expenses = [...data.amex, ...data.cash];\
  const totalExp = expenses.reduce((sum, item) => sum + item.amount, 0);\
  const totalInc = data.income.reduce((sum, item) => sum + item.amount, 0);\
  const totalSav = [...data.savings, ...data.investment].reduce((sum, item) => sum + item.amount, 0);\
\
  document.getElementById('total-expense').textContent = `\'a5$\{totalExp.toLocaleString()\}`;\
  document.getElementById('total-income').textContent = `\'a5$\{totalInc.toLocaleString()\}`;\
  document.getElementById('total-savings').textContent = `\'a5$\{totalSav.toLocaleString()\}`;\
\
  // 
\f1 \'96\'be\'8d\'d7\'83\'8a\'83\'58\'83\'67\'82\'cc\'93\'9d\'8d\'87\'95\'5c\'8e\'a6\'81\'69\'93\'fa\'95\'74\'8f\'b8\'8f\'87
\f0 /
\f1 \'8d\'7e\'8f\'87\'81\'6a
\f0 \
  const allRecords = [\
    ...expenses.map(i => (\{ ...i, type: '
\f1 \'8e\'78\'8f\'6f
\f0 ' \})),\
    ...data.income.map(i => (\{ ...i, type: '
\f1 \'8e\'fb\'93\'fc
\f0 ' \})),\
    ...data.savings.map(i => (\{ ...i, type: '
\f1 \'92\'99\'92\'7e
\f0 ' \})),\
    ...data.investment.map(i => (\{ ...i, type: '
\f1 \'93\'8a\'8e\'91
\f0 ' \}))\
  ].sort((a, b) => new Date(b.date) - new Date(a.date));\
\
  const listContainer = document.getElementById('data-list');\
  listContainer.innerHTML = '';\
\
  allRecords.forEach(item => \{\
    const el = document.createElement('div');\
    el.className = 'data-item';\
    el.innerHTML = `\
      <div class="info">\
        <div class="title">$\{item.category\} <span style="font-size:0.75rem; font-weight:normal; color:#666;">($\{item.person\})</span></div>\
        <div class="sub">$\{item.date\} | $\{item.memo || ''\} $\{item.paymentMethod ? '[' + item.paymentMethod + ']' : ''\}</div>\
      </div>\
      <div class="amount" style="color: $\{getItemColor(item.type)\}">\
        $\{item.type === '
\f1 \'8e\'78\'8f\'6f
\f0 ' ? '-' : '+'\}\'a5$\{item.amount.toLocaleString()\}\
      </div>\
    `;\
    listContainer.appendChild(el);\
  \});\
\}\
\
function getItemColor(type) \{\
  if (type === '
\f1 \'8e\'78\'8f\'6f
\f0 ') return 'var(--expense-color)';\
  if (type === '
\f1 \'8e\'fb\'93\'fc
\f0 ') return 'var(--income-color)';\
  return 'var(--savings-color)';\
\}\
\
// 
\f1 \'83\'43\'83\'78\'83\'93\'83\'67\'83\'8a\'83\'58\'83\'69\'81\'5b\'90\'dd\'92\'e8
\f0 \
function setupEventListeners() \{\
  // 
\f1 \'8c\'8e\'90\'d8\'82\'e8\'91\'d6\'82\'a6
\f0 \
  document.getElementById('prev-month-btn').addEventListener('click', () => changeMonth(-1));\
  document.getElementById('next-month-btn').addEventListener('click', () => changeMonth(1));\
\
  // FAB
\f1 \'83\'81\'83\'6a\'83\'85\'81\'5b\'8a\'4a\'95\'c2
\f0 \
  const fabMain = document.getElementById('fab-main');\
  const fabMenu = document.getElementById('fab-menu');\
  fabMain.addEventListener('click', () => fabMenu.classList.toggle('hidden'));\
\
  // FAB
\f1 \'83\'82\'81\'5b\'83\'5f\'83\'8b\'8b\'4e\'93\'ae
\f0 \
  document.querySelectorAll('.fab-item').forEach(btn => \{\
    btn.addEventListener('click', (e) => \{\
      fabMenu.classList.add('hidden');\
      openModal(e.target.dataset.type);\
    \});\
  \});\
\
  document.getElementById('modal-close').addEventListener('click', closeModal);\
\
  // Form
\f1 \'91\'97\'90\'4d
\f0 \
  document.getElementById('entry-form').addEventListener('submit', handleFormSubmit);\
\
  // 
\f2 \uc0\u55357 \u56496 
\f1 \'83\'7b\'83\'5e\'83\'93
\f0  (
\f1 \'92\'bc\'8b\'df\'8e\'fb\'93\'fc\'91\'49\'91\'f0\'8b\'40\'94\'5c
\f0 )\
  document.getElementById('income-picker-btn').addEventListener('click', () => \{\
    const select = document.getElementById('recent-income-select');\
    select.classList.toggle('hidden');\
  \});\
\
  document.getElementById('recent-income-select').addEventListener('change', (e) => \{\
    if (e.target.value) \{\
      document.getElementById('entry-amount').value = e.target.value;\
      e.target.classList.add('hidden');\
    \}\
  \});\
\}\
\
function changeMonth(diff) \{\
  const [y, m] = currentYM.split('-').map(Number);\
  const d = new Date(y, m - 1 + diff, 1);\
  const newY = d.getFullYear();\
  const newM = String(d.getMonth() + 1).padStart(2, '0');\
  currentYM = `$\{newY\}-$\{newM\}`;\
  loadData();\
\}\
\
function openModal(type) \{\
  const modal = document.getElementById('modal');\
  document.getElementById('entry-type').value = type;\
  document.getElementById('entry-date').valueAsDate = new Date();\
  document.getElementById('modal-title').textContent = `$\{getTypeLabel(type)\}
\f1 \'82\'cc\'93\'fc\'97\'cd
\f0 `;\
\
  // 
\f1 \'83\'4a\'83\'65\'83\'53\'83\'8a\'81\'5b\'90\'dd\'92\'e8
\f0 \
  const categorySelect = document.getElementById('entry-category');\
  categorySelect.innerHTML = '';\
  \
  // 
\f1 \'92\'99\'92\'7e\'82\'cc\'8f\'ea\'8d\'87\'82\'cd\'8e\'fb\'93\'fc\'83\'4a\'83\'65\'83\'53\'83\'8a\'81\'5b\'81\'41\'82\'bb\'82\'ea\'88\'c8\'8a\'4f\'82\'cd\'91\'ce\'89\'9e\'82\'b7\'82\'e9\'83\'4a\'83\'65\'83\'53\'83\'8a\'81\'5b
\f0 \
  const catKey = type === 'savings' ? 'income' : type;\
  const categories = globalCategories[catKey] || [];\
  categories.forEach(c => \{\
    categorySelect.innerHTML += `<option value="$\{c\}">$\{c\}</option>`;\
  \});\
\
  // 
\f1 \'96\'bc\'95\'eb\'90\'dd\'92\'e8
\f0 \
  const personSelect = document.getElementById('entry-person');\
  personSelect.innerHTML = '<option value="
\f1 \'89\'c6\'8c\'76
\f0 ">
\f1 \'89\'c6\'8c\'76\'81\'69\'8b\'f3\'97\'93\'81\'6a
\f0 </option>';\
  (globalCategories.members || []).forEach(m => \{\
    personSelect.innerHTML += `<option value="$\{m\}">$\{m\}</option>`;\
  \});\
\
  // 
\f1 \'83\'74\'83\'42\'81\'5b\'83\'8b\'83\'68\'95\'5c\'8e\'a6\'90\'a7\'8c\'e4
\f0 \
  const paymentGroup = document.getElementById('group-payment-method');\
  const incomePickerBtn = document.getElementById('income-picker-btn');\
  const recentSelect = document.getElementById('recent-income-select');\
\
  paymentGroup.classList.toggle('hidden', type !== 'expense');\
  incomePickerBtn.classList.toggle('hidden', type !== 'savings');\
  recentSelect.classList.add('hidden');\
\
  // 
\f2 \uc0\u55357 \u56496 
\f1 \'8b\'40\'94\'5c\'97\'70\'82\'cc\'92\'bc\'8b\'df\'83\'66\'81\'5b\'83\'5e\'90\'dd\'92\'e8
\f0 \
  if (type === 'savings') \{\
    recentSelect.innerHTML = '<option value="">-- 
\f1 \'92\'bc\'8b\'df\'8e\'fb\'93\'fc\'82\'a9\'82\'e7\'91\'49\'91\'f0
\f0  --</option>';\
    recentIncomesCache.forEach(inc => \{\
      recentSelect.innerHTML += `<option value="$\{inc.amount\}">$\{inc.date\} - $\{inc.category\}: \'a5$\{inc.amount.toLocaleString()\}</option>`;\
    \});\
  \}\
\
  modal.classList.remove('hidden');\
\}\
\
function closeModal() \{\
  document.getElementById('modal').classList.add('hidden');\
\}\
\
async function handleFormSubmit(e) \{\
  e.preventDefault();\
  const token = localStorage.getItem('app_token');\
\
  const payload = \{\
    type: document.getElementById('entry-type').value,\
    date: document.getElementById('entry-date').value,\
    category: document.getElementById('entry-category').value,\
    amount: Number(document.getElementById('entry-amount').value),\
    memo: document.getElementById('entry-memo').value,\
    person: document.getElementById('entry-person').value,\
    paymentMethod: document.getElementById('entry-payment-method').value\
  \};\
\
  showLoading(true);\
  closeModal();\
\
  try \{\
    const res = await fetch(GAS_API_URL, \{\
      method: 'POST',\
      body: JSON.stringify(\{ token: token, action: 'addRecord', payload: payload \})\
    \});\
    const result = await res.json();\
\
    if (result.success) \{\
      alert("
\f1 \'95\'db\'91\'b6\'82\'b5\'82\'dc\'82\'b5\'82\'bd
\f0 ");\
      loadData(); // 
\f1 \'8d\'c4\'93\'c7\'82\'dd\'8d\'9e\'82\'dd
\f0 \
    \} else \{\
      alert("
\f1 \'83\'47\'83\'89\'81\'5b
\f0 : " + result.message);\
    \}\
  \} catch (err) \{\
    alert("
\f1 \'91\'97\'90\'4d\'8e\'b8\'94\'73
\f0 : " + err.message);\
  \} finally \{\
    showLoading(false);\
  \}\
\}\
\
function getTypeLabel(type) \{\
  const map = \{ expense: '
\f1 \'8e\'78\'8f\'6f
\f0 ', income: '
\f1 \'8e\'fb\'93\'fc
\f0 ', savings: '
\f1 \'92\'99\'92\'7e
\f0 ', investment: '
\f1 \'93\'8a\'8e\'91
\f0 ' \};\
  return map[type] || '';\
\}\
\
function showLoading(show) \{\
  document.getElementById('loading').classList.toggle('hidden', !show);\
\}}