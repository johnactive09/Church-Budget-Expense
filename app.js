
'use strict';

// =====================================================
// NLOC BUDGET/EXPENSE - app.js
// =====================================================

// 전역 변수
let currentUser = null;
let deleteCallback = null;

// 기본 데이터 구조
let organizationData = {
  teams: [],
  departments: [],
  items: [],
  expenses: [],
  users: [
    { id: 'admin', password: 'admin123', isAdmin: true, name: '관리자' },
    { id: '100', password: 'team123', isAdmin: false, name: '목회행정팀', teamCode: '100' },
    { id: '200', password: 'team123', isAdmin: false, name: '예배팀', teamCode: '200' },
    { id: '300', password: 'team123', isAdmin: false, name: '2세 교육팀', teamCode: '300' },
  ],
  backups: [],
};

// ---------- Helpers ----------
function $(id) {
  return document.getElementById(id);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(Number(amount || 0));
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function escapeCsv(value) {
  // CSV 안전 처리 (쉼표/따옴표/줄바꿈)
  const s = String(value ?? '');
  const needs = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

// ---------- Storage ----------
function saveData() {
  localStorage.setItem('nloc_bve_data', JSON.stringify(organizationData));
}

function initializeData() {
  const savedData = localStorage.getItem('nloc_bve_data');

  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      organizationData = { ...organizationData, ...parsed };
    } catch (e) {
      console.error('저장 데이터 파싱 실패:', e);
      alert('저장된 데이터가 손상되어 초기 데이터로 재설정합니다.');
      localStorage.removeItem('nloc_bve_data');
    }
  }

  // 최초 실행 시 샘플 데이터
  if (!organizationData.teams?.length) {
    organizationData.teams = [
      { code: 'T001', name: '예배팀', leader: '김목사' },
      { code: 'T002', name: '교육팀', leader: '이전도사' },
      { code: 'T003', name: '선교팀', leader: '박장로' },
    ];

    organizationData.departments = [
      { code: 'D001', name: '음향부서', teamCode: 'T001', leader: '김음향' },
      { code: 'D002', name: '영상부서', teamCode: 'T001', leader: '이영상' },
      { code: 'D003', name: '주일학교', teamCode: 'T002', leader: '박교사' },
    ];

    organizationData.items = [
      { code: 'I001', name: '장비구입', deptCode: 'D001', budget: 5000.0, spent: 0.0 },
      { code: 'I002', name: '소모품', deptCode: 'D001', budget: 1000.0, spent: 0.0 },
      { code: 'I003', name: '카메라', deptCode: 'D002', budget: 3000.0, spent: 0.0 },
    ];

    saveData();
  }
}

// ---------- Auth ----------
function handleLogin(event) {
  event.preventDefault();

  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;

  const user = organizationData.users.find(u => u.id === username && u.password === password);

  if (!user) {
    alert('잘못된 사용자 정보입니다.');
    return;
  }

  currentUser = user;

  $('currentUser').textContent = `${user.name} 로그인 중...`;
  $('loginScreen').classList.add('hidden');
  $('mainApp').classList.remove('hidden');

  // 관리자가 아닌 경우 설정 숨김
  if (!user.isAdmin) {
    $('navSettingsBtn').style.display = 'none';
  } else {
    $('navSettingsBtn').style.display = '';
  }

  showSection('dashboard');
  populateSelects();

  // 지출 입력 초기화
  $('expenseItems').innerHTML = '';
  addExpenseItem();
  calculateTotal();

  updateDashboard();
}

function logout() {
  createBackup(); // 자동 백업
  currentUser = null;

  $('loginScreen').classList.remove('hidden');
  $('mainApp').classList.add('hidden');
  $('loginUsername').value = '';
  $('loginPassword').value = '';
}

// ---------- Navigation / Sections ----------
function showSection(sectionName) {
  document.querySelectorAll('.section').forEach(section => section.classList.add('hidden'));
  $(sectionName).classList.remove('hidden');

  if (sectionName === 'settings') {
    updateSettingsContent();
  }
}

// ---------- Dashboard ----------
function updateDashboard() {
  if (!currentUser) return;

  let totalBudget = 0;
  let totalExpenses = 0;

  if (currentUser.isAdmin) {
    totalBudget = organizationData.items.reduce((sum, item) => sum + Number(item.budget || 0), 0);
    totalExpenses = organizationData.items.reduce((sum, item) => sum + Number(item.spent || 0), 0);

    $('teamBudgetDetail').classList.add('hidden');
    updateAdminBudgetDetail();
    $('adminBudgetDetail').classList.remove('hidden');
  } else {
    const teamItems = organizationData.items.filter(item => {
      const dept = organizationData.departments.find(d => d.code === item.deptCode);
      return dept && dept.teamCode === currentUser.teamCode;
    });

    totalBudget = teamItems.reduce((sum, item) => sum + Number(item.budget || 0), 0);
    totalExpenses = teamItems.reduce((sum, item) => sum + Number(item.spent || 0), 0);

    updateTeamBudgetDetail();
    $('teamBudgetDetail').classList.remove('hidden');
    $('adminBudgetDetail').classList.add('hidden');
  }

  const totalBalance = totalBudget - totalExpenses;
  $('totalBudget').textContent = formatCurrency(totalBudget);
  $('totalExpenses').textContent = formatCurrency(totalExpenses);
  $('totalBalance').textContent = formatCurrency(totalBalance);

  updateExpenseTable();
}

function updateAdminBudgetDetail() {
  if (!currentUser?.isAdmin) return;

  const container = $('adminBudgetTreeContent');
  container.innerHTML = '';

  organizationData.teams.forEach(team => {
    let teamBudget = 0;
    let teamSpent = 0;

    const teamDepts = organizationData.departments.filter(d => d.teamCode === team.code);
    teamDepts.forEach(dept => {
      const deptItems = organizationData.items.filter(i => i.deptCode === dept.code);
      deptItems.forEach(item => {
        teamBudget += Number(item.budget || 0);
        teamSpent += Number(item.spent || 0);
      });
    });

    const teamDiv = document.createElement('div');
    teamDiv.className = 'border p-4 rounded mb-4 bg-blue-50';
    teamDiv.innerHTML = `
      <h4 class="font-bold text-lg mb-2">${team.code} - ${team.name}</h4>
      <div class="grid grid-cols-3 gap-4 text-sm">
        <div>예산: <span class="font-bold text-blue-600">${formatCurrency(teamBudget)}</span></div>
        <div>지출: <span class="font-bold text-red-600">${formatCurrency(teamSpent)}</span></div>
        <div>잔액: <span class="font-bold text-green-600">${formatCurrency(teamBudget - teamSpent)}</span></div>
      </div>
    `;
    container.appendChild(teamDiv);

    teamDepts.forEach(dept => {
      const deptItems = organizationData.items.filter(i => i.deptCode === dept.code);

      let deptBudget = 0;
      let deptSpent = 0;
      deptItems.forEach(item => {
        deptBudget += Number(item.budget || 0);
        deptSpent += Number(item.spent || 0);
      });

      const deptDiv = document.createElement('div');
      deptDiv.className = 'border p-3 rounded mb-3 bg-green-50 ml-4';
      deptDiv.innerHTML = `
        <h5 class="font-bold mb-2">${dept.code} - ${dept.name}</h5>
        <div class="grid grid-cols-3 gap-4 text-sm mb-3">
          <div>예산: <span class="font-bold text-blue-600">${formatCurrency(deptBudget)}</span></div>
          <div>지출: <span class="font-bold text-red-600">${formatCurrency(deptSpent)}</span></div>
          <div>잔액: <span class="font-bold text-green-600">${formatCurrency(deptBudget - deptSpent)}</span></div>
        </div>
      `;

      const itemsDiv = document.createElement('div');
      itemsDiv.className = 'ml-4 space-y-2';

      deptItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'border p-2 rounded bg-yellow-50 text-xs';
        itemDiv.innerHTML = `
          <div class="font-medium">${item.code} - ${item.name}</div>
          <div class="grid grid-cols-3 gap-2 mt-1">
            <div>예산: ${formatCurrency(item.budget)}</div>
            <div>지출: ${formatCurrency(item.spent)}</div>
            <div>잔액: ${formatCurrency(Number(item.budget||0) - Number(item.spent||0))}</div>
          </div>
        `;
        itemsDiv.appendChild(itemDiv);
      });

      deptDiv.appendChild(itemsDiv);
      container.appendChild(deptDiv);
    });
  });
}

function updateTeamBudgetDetail() {
  if (!currentUser || currentUser.isAdmin) return;

  const container = $('budgetTreeContent');
  container.innerHTML = '';

  const team = organizationData.teams.find(t => t.code === currentUser.teamCode);
  if (!team) return;

  let teamBudget = 0;
  let teamSpent = 0;

  const teamDepts = organizationData.departments.filter(d => d.teamCode === team.code);
  teamDepts.forEach(dept => {
    const deptItems = organizationData.items.filter(i => i.deptCode === dept.code);
    deptItems.forEach(item => {
      teamBudget += Number(item.budget || 0);
      teamSpent += Number(item.spent || 0);
    });
  });

  const teamDiv = document.createElement('div');
  teamDiv.className = 'border p-4 rounded mb-4 bg-blue-50';
  teamDiv.innerHTML = `
    <h4 class="font-bold text-lg mb-2">${team.code} - ${team.name}</h4>
    <div class="grid grid-cols-3 gap-4 text-sm">
      <div>예산: <span class="font-bold text-blue-600">${formatCurrency(teamBudget)}</span></div>
      <div>지출: <span class="font-bold text-red-600">${formatCurrency(teamSpent)}</span></div>
      <div>잔액: <span class="font-bold text-green-600">${formatCurrency(teamBudget - teamSpent)}</span></div>
    </div>
  `;
  container.appendChild(teamDiv);

  teamDepts.forEach(dept => {
    const deptItems = organizationData.items.filter(i => i.deptCode === dept.code);

    let deptBudget = 0;
    let deptSpent = 0;
    deptItems.forEach(item => {
      deptBudget += Number(item.budget || 0);
      deptSpent += Number(item.spent || 0);
    });

    const deptDiv = document.createElement('div');
    deptDiv.className = 'border p-3 rounded mb-3 bg-green-50 ml-4';
    deptDiv.innerHTML = `
      <h5 class="font-bold mb-2">${dept.code} - ${dept.name}</h5>
      <div class="grid grid-cols-3 gap-4 text-sm mb-3">
        <div>예산: <span class="font-bold text-blue-600">${formatCurrency(deptBudget)}</span></div>
        <div>지출: <span class="font-bold text-red-600">${formatCurrency(deptSpent)}</span></div>
        <div>잔액: <span class="font-bold text-green-600">${formatCurrency(deptBudget - deptSpent)}</span></div>
      </div>
    `;

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'ml-4 space-y-2';

    deptItems.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'border p-2 rounded bg-yellow-50 text-xs';
      itemDiv.innerHTML = `
        <div class="font-medium">${item.code} - ${item.name}</div>
        <div class="grid grid-cols-3 gap-2 mt-1">
          <div>예산: ${formatCurrency(item.budget)}</div>
          <div>지출: ${formatCurrency(item.spent)}</div>
          <div>잔액: ${formatCurrency(Number(item.budget||0) - Number(item.spent||0))}</div>
        </div>
      `;
      itemsDiv.appendChild(itemDiv);
    });

    deptDiv.appendChild(itemsDiv);
    container.appendChild(deptDiv);
  });
}

// ---------- Selects (Dashboard) ----------
function populateSelects() {
  const teamSelect = $('teamSelect');
  teamSelect.innerHTML = '<option value="">팀을 선택하세요</option>';

  let teamsToShow = organizationData.teams;
  if (!currentUser?.isAdmin) {
    teamsToShow = organizationData.teams.filter(team => team.code === currentUser.teamCode);
  }

  teamsToShow.forEach(team => {
    const option = document.createElement('option');
    option.value = team.code;
    option.textContent = `${team.code} - ${team.name}`;
    teamSelect.appendChild(option);
  });

  // reset dependent selects
  $('departmentSelect').innerHTML = '<option value="">부서를 선택하세요</option>';
  $('itemSelect').innerHTML = '<option value="">항목을 선택하세요</option>';
}

function updateDepartmentSelect() {
  const teamCode = $('teamSelect').value;
  const departmentSelect = $('departmentSelect');
  const itemSelect = $('itemSelect');

  departmentSelect.innerHTML = '<option value="">부서를 선택하세요</option>';
  itemSelect.innerHTML = '<option value="">항목을 선택하세요</option>';

  if (!teamCode) return;

  const departments = organizationData.departments.filter(dept => dept.teamCode === teamCode);
  departments.forEach(dept => {
    const option = document.createElement('option');
    option.value = dept.code;
    option.textContent = `${dept.code} - ${dept.name}`;
    departmentSelect.appendChild(option);
  });
}

function updateItemSelect() {
  const deptCode = $('departmentSelect').value;
  const itemSelect = $('itemSelect');

  itemSelect.innerHTML = '<option value="">항목을 선택하세요</option>';

  if (!deptCode) return;

  const items = organizationData.items.filter(item => item.deptCode === deptCode);
  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item.code;
    const balance = Number(item.budget || 0) - Number(item.spent || 0);
    option.textContent = `${item.code} - ${item.name} (잔액: ${formatCurrency(balance)})`;
    itemSelect.appendChild(option);
  });
}

// ---------- Expense Items ----------
function addExpenseItem() {
  const container = $('expenseItems');
  const itemCount = container.children.length;

  if (itemCount >= 5) {
    alert('최대 5개 항목까지만 추가할 수 있습니다.');
    return;
  }

  const itemDiv = document.createElement('div');
  itemDiv.className = 'expense-row flex space-x-2';
  itemDiv.innerHTML = `
    <div class="flex-1">
      <input type="text" class="expense-description w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="지출 내용" />
    </div>
    <div class="w-32">
      <input type="number" step="0.01" class="expense-amount w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="0.00" />
    </div>
    <button type="button" class="remove-expense-btn bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded">삭제</button>
  `;
  container.appendChild(itemDiv);

  // events
  itemDiv.querySelector('.expense-description').addEventListener('input', calculateTotal);
  itemDiv.querySelector('.expense-amount').addEventListener('input', calculateTotal);
  itemDiv.querySelector('.remove-expense-btn').addEventListener('click', () => removeExpenseItem(itemDiv));

  calculateTotal();
}

function removeExpenseItem(itemDiv) {
  itemDiv.style.opacity = '0';
  setTimeout(() => {
    itemDiv.remove();
    calculateTotal();
  }, 200);
}

function calculateTotal() {
  const amounts = document.querySelectorAll('.expense-amount');
  let total = 0;
  amounts.forEach(input => {
    const value = parseFloat(input.value);
    if (!isNaN(value)) total += value;
  });
  $('totalAmount').value = formatCurrency(total);
}

// ---------- Expense CRUD ----------
function addExpense(event) {
  event.preventDefault();

  const teamCode = $('teamSelect').value;
  const deptCode = $('departmentSelect').value;
  const itemCode = $('itemSelect').value;

  if (!teamCode || !deptCode || !itemCode) {
    alert('팀, 부서, 항목을 모두 선택해주세요.');
    return;
  }

  const descriptions = document.querySelectorAll('.expense-description');
  const amounts = document.querySelectorAll('.expense-amount');

  let totalAmount = 0;
  const expenseItems = [];

  for (let i = 0; i < descriptions.length; i++) {
    const desc = descriptions[i].value.trim();
    const amount = parseFloat(amounts[i].value) || 0;

    if (desc && amount > 0) {
      expenseItems.push({ description: desc, amount });
      totalAmount += amount;
    }
  }

  if (expenseItems.length === 0) {
    alert('최소 하나의 지출 항목을 입력해주세요.');
    return;
  }

  const item = organizationData.items.find(i => i.code === itemCode);
  const balance = Number(item?.budget || 0) - Number(item?.spent || 0);

  if (item && balance < totalAmount) {
    const ok = confirm(
      `예산을 초과합니다. 계속하시겠습니까?\n잔액: ${formatCurrency(balance)}\n지출: ${formatCurrency(totalAmount)}`
    );
    if (!ok) return;
  }

  const expense = {
    id: Date.now(),
    date: todayISO(),
    teamCode,
    deptCode,
    itemCode,
    items: expenseItems,
    totalAmount,
    createdBy: currentUser?.name || 'unknown',
  };

  organizationData.expenses.push(expense);

  if (item) item.spent = Number(item.spent || 0) + totalAmount;

  saveData();
  updateDashboard();

  // reset form
  resetExpenseForm();

  if (confirm('지출청구서를 생성하시겠습니까?')) {
    showExpenseFormById(expense.id);
  }
}

function resetExpenseForm() {
  $('teamSelect').value = '';
  $('departmentSelect').innerHTML = '<option value="">부서를 선택하세요</option>';
  $('itemSelect').innerHTML = '<option value="">항목을 선택하세요</option>';

  $('expenseItems').innerHTML = '';
  addExpenseItem();
  $('totalAmount').value = formatCurrency(0);
}

function deleteExpense(id) {
  const expense = organizationData.expenses.find(e => e.id === id);
  if (!expense) return;

  const item = organizationData.items.find(i => i.code === expense.itemCode);
  if (item) item.spent = Number(item.spent || 0) - Number(expense.totalAmount || 0);

  organizationData.expenses = organizationData.expenses.filter(e => e.id !== id);

  saveData();
  updateDashboard();
  closeDeleteModal();
  alert('지출이 성공적으로 삭제되었습니다.');
}

// ---------- Expense Table ----------
function updateExpenseTable() {
  const tbody = $('expenseTableBody');
  tbody.innerHTML = '';

  let expensesToShow = organizationData.expenses;
  if (!currentUser?.isAdmin) {
    expensesToShow = organizationData.expenses.filter(expense => expense.teamCode === currentUser.teamCode);
  }

  // 최신 먼저
  expensesToShow
    .slice()
    .sort((a, b) => (b.id || 0) - (a.id || 0))
    .forEach(expense => {
      const team = organizationData.teams.find(t => t.code === expense.teamCode);
      const dept = organizationData.departments.find(d => d.code === expense.deptCode);
      const item = organizationData.items.find(i => i.code === expense.itemCode);

      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="px-4 py-2">${expense.date}</td>
        <td class="px-4 py-2">${team ? team.name : expense.teamCode}</td>
        <td class="px-4 py-2">${dept ? dept.name : expense.deptCode}</td>
        <td class="px-4 py-2">${item ? item.name : expense.itemCode}</td>
        <td class="px-4 py-2">${(expense.items || []).map(i => i.description).join(', ')}</td>
        <td class="px-4 py-2">${formatCurrency(expense.totalAmount)}</td>
        <td class="px-4 py-2 no-print space-x-2">
          <button data-action="invoice" data-id="${expense.id}" class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm">
            청구서
          </button>
          <button data-action="delete" data-id="${expense.id}" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm">
            삭제
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

  // event delegation
  tbody.querySelectorAll('button[data-action="invoice"]').forEach(btn => {
    btn.addEventListener('click', () => showExpenseFormById(Number(btn.dataset.id)));
  });

  tbody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      showDeleteConfirmation('지출', String(id), () => deleteExpense(id));
    });
  });
}

// ---------- Expense Form Modal ----------
function showExpenseFormById(expenseId) {
  const expense = organizationData.expenses.find(e => e.id === expenseId);
  if (!expense) {
    alert('지출 데이터를 찾을 수 없습니다.');
    return;
  }
  showExpenseForm(expense);
}

function showExpenseForm(expense) {
  const team = organizationData.teams.find(t => t.code === expense.teamCode);
  const dept = organizationData.departments.find(d => d.code === expense.deptCode);
  const item = organizationData.items.find(i => i.code === expense.itemCode);

  const formContent = `
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold mb-2">지출 청구서</h1>
      <p class="text-gray-600">NLOC BUDGET/EXPENSE</p>
    </div>

    <div class="grid grid-cols-2 gap-8 mb-8">
      <div>
        <h3 class="font-bold mb-4">기본 정보</h3>
        <div class="space-y-2">
          <p><strong>팀 코드:</strong> ${expense.teamCode}</p>
          <p><strong>팀 이름:</strong> ${team ? team.name : ''}</p>
          <p><strong>부서 코드:</strong> ${expense.deptCode}</p>
          <p><strong>부서 이름:</strong> ${dept ? dept.name : ''}</p>
          <p><strong>날짜:</strong> ${expense.date}</p>
        </div>
      </div>

      <div>
        <h3 class="font-bold mb-4">담당자 정보</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">수령인:</label>
            <div class="border-b border-gray-300 pb-1 mt-1">_________________</div>
          </div>
        </div>
      </div>
    </div>

    <div class="mb-8">
      <h3 class="font-bold mb-4">지출 내역</h3>
      <table class="w-full border border-gray-300">
        <thead class="bg-gray-50">
          <tr>
            <th class="border border-gray-300 px-4 py-2 text-left">예산 항목</th>
            <th class="border border-gray-300 px-4 py-2 text-left">내용</th>
            <th class="border border-gray-300 px-4 py-2 text-right">금액</th>
          </tr>
        </thead>
        <tbody>
          ${(expense.items || []).map(expenseItem => `
            <tr>
              <td class="border border-gray-300 px-4 py-2">${item ? item.name : ''}</td>
              <td class="border border-gray-300 px-4 py-2">${expenseItem.description}</td>
              <td class="border border-gray-300 px-4 py-2 text-right">${formatCurrency(expenseItem.amount)}</td>
            </tr>
          `).join('')}
          ${Array(Math.max(0, 5 - (expense.items || []).length)).fill(0).map(() => `
            <tr>
              <td class="border border-gray-300 px-4 py-2">&nbsp;</td>
              <td class="border border-gray-300 px-4 py-2">&nbsp;</td>
              <td class="border border-gray-300 px-4 py-2">&nbsp;</td>
            </tr>
          `).join('')}
          <tr class="bg-gray-50 font-bold">
            <td class="border border-gray-300 px-4 py-2" colspan="2">총 금액</td>
            <td class="border border-gray-300 px-4 py-2 text-right">${formatCurrency(expense.totalAmount)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="grid grid-cols-3 gap-8 mt-12">
      <div class="text-center">
        <div class="border-b border-gray-300 pb-1 mb-2">_________________</div>
        <p class="text-sm">청구자: ${expense.createdBy}</p>
      </div>
      <div class="text-center">
        <div class="border-b border-gray-300 pb-1 mb-2">_________________</div>
        <p class="text-sm">부서장: ${dept ? dept.leader : ''}</p>
      </div>
      <div class="text-center">
        <div class="border-b border-gray-300 pb-1 mb-2">_________________</div>
        <p class="text-sm">팀장: ${team ? team.leader : ''}</p>
      </div>
    </div>
  `;

  $('expenseFormContent').innerHTML = formContent;
  $('expenseFormModal').classList.remove('hidden');
  $('expenseFormModal').classList.add('flex');
}

function closeExpenseForm() {
  $('expenseFormModal').classList.add('hidden');
  $('expenseFormModal').classList.remove('flex');
}

function printExpenseForm() {
  const printContent = $('expenseFormContent').innerHTML;
  const w = window.open('', '_blank');
  w.document.write(`
    <html>
      <head>
        <title>지출 청구서</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .bg-gray-50 { background-color: #f9f9f9; }
          .grid { display: grid; }
          .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
          .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
          .gap-8 { gap: 2rem; }
          .mb-2 { margin-bottom: 0.5rem; }
          .mb-4 { margin-bottom: 1rem; }
          .mb-8 { margin-bottom: 2rem; }
          .mt-12 { margin-top: 3rem; }
          .space-y-2 > * + * { margin-top: 0.5rem; }
          .space-y-4 > * + * { margin-top: 1rem; }
          .border-b { border-bottom: 1px solid #000; }
          .pb-1 { padding-bottom: 0.25rem; }
          .mt-1 { margin-top: 0.25rem; }
        </style>
      </head>
      <body>${printContent}</body>
    </html>
  `);
  w.document.close();
  w.print();
  w.close();
}

// ---------- Export / Print / Validation ----------
function exportToExcel() {
  let csv = '날짜,팀,부서,항목,내용,금액\n';

  let expenses = organizationData.expenses;
  if (!currentUser?.isAdmin) {
    expenses = expenses.filter(e => e.teamCode === currentUser.teamCode);
  }

  expenses.forEach(expense => {
    const team = organizationData.teams.find(t => t.code === expense.teamCode);
    const dept = organizationData.departments.find(d => d.code === expense.deptCode);
    const item = organizationData.items.find(i => i.code === expense.itemCode);

    (expense.items || []).forEach(expenseItem => {
      csv += [
        escapeCsv(expense.date),
        escapeCsv(team ? team.name : expense.teamCode),
        escapeCsv(dept ? dept.name : expense.deptCode),
        escapeCsv(item ? item.name : expense.itemCode),
        escapeCsv(expenseItem.description),
        escapeCsv(expenseItem.amount),
      ].join(',') + '\n';
    });
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `지출내역_${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printExpenses() {
  // print the expenses card (table area)
  const tableCard = $('expenseTableBody')?.closest('.bg-white');
  if (!tableCard) return alert('인쇄할 데이터가 없습니다.');

  const printContent = tableCard.innerHTML;
  const w = window.open('', '_blank');
  w.document.write(`
    <html>
      <head>
        <title>지출 내역</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #f9f9f9; }
          .no-print { display: none; }
        </style>
      </head>
      <body>
        <h1>지출 내역</h1>
        ${printContent}
      </body>
    </html>
  `);
  w.document.close();
  w.print();
  w.close();
}

function checkBudgetBalance() {
  let report = '예산 검증 결과:\n\n';
  let totalBudget = 0;
  let totalSpent = 0;
  let hasError = false;

  let itemsToCheck = organizationData.items;

  if (!currentUser?.isAdmin) {
    itemsToCheck = organizationData.items.filter(item => {
      const dept = organizationData.departments.find(d => d.code === item.deptCode);
      return dept && dept.teamCode === currentUser.teamCode;
    });
  }

  itemsToCheck.forEach(item => {
    totalBudget += Number(item.budget || 0);
    totalSpent += Number(item.spent || 0);

    const dept = organizationData.departments.find(d => d.code === item.deptCode);
    const team = organizationData.teams.find(t => t.code === dept?.teamCode);

    if (Number(item.spent || 0) > Number(item.budget || 0)) {
      report += `⚠️ ${team?.name || ''} > ${dept?.name || ''} > ${item.name}: 예산 초과 (${formatCurrency(Number(item.spent) - Number(item.budget))})\n`;
      hasError = true;
    }
  });

  report += `\n총 예산: ${formatCurrency(totalBudget)}\n`;
  report += `총 지출: ${formatCurrency(totalSpent)}\n`;
  report += `잔액: ${formatCurrency(totalBudget - totalSpent)}\n`;

  if (!hasError) report += '\n✅ 모든 예산이 정상 범위 내에 있습니다.';

  alert(report);
}

// ---------- Settings Tabs ----------
function showSettingsTab(tabName) {
  document.querySelectorAll('.settings-content').forEach(content => content.classList.add('hidden'));
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.classList.remove('border-blue-500', 'text-blue-600');
    tab.classList.add('border-transparent', 'text-gray-500');
  });

  $(tabName + 'Tab').classList.remove('hidden');

  // highlight button
  const btn = document.querySelector(`.settings-tab[data-tab="${tabName}"]`);
  if (btn) {
    btn.classList.remove('border-transparent', 'text-gray-500');
    btn.classList.add('border-blue-500', 'text-blue-600');
  }

  updateSettingsContent();
}

function updateSettingsContent() {
  updateTeamsList();
  updateDepartmentsList();
  updateItemsList();
  updateBudgetsList();
  updateUsersList();
  updateBackupsList();
  populateSettingsSelects();
}

function populateSettingsSelects() {
  const deptTeamSelect = $('deptTeamSelect');
  deptTeamSelect.innerHTML = '<option value="">팀 선택</option>';
  organizationData.teams.forEach(team => {
    const option = document.createElement('option');
    option.value = team.code;
    option.textContent = `${team.code} - ${team.name}`;
    deptTeamSelect.appendChild(option);
  });

  const itemDeptSelect = $('itemDeptSelect');
  itemDeptSelect.innerHTML = '<option value="">부서 선택</option>';
  organizationData.departments.forEach(dept => {
    const team = organizationData.teams.find(t => t.code === dept.teamCode);
    const option = document.createElement('option');
    option.value = dept.code;
    option.textContent = `${dept.code} - ${dept.name} (${team ? team.name : ''})`;
    itemDeptSelect.appendChild(option);
  });
}

// ---------- Settings CRUD ----------
function addTeam(event) {
  event.preventDefault();

  const code = $('teamCode').value.trim();
  const name = $('teamName').value.trim();
  const leader = $('teamLeader').value.trim();

  if (!code) return alert('⚠️ 팀 코드를 입력해주세요.');
  if (!name) return alert('⚠️ 팀 이름을 입력해주세요.');
  if (!leader) return alert('⚠️ 팀장을 입력해주세요.');

  if (organizationData.teams.find(t => t.code === code)) {
    alert('이미 존재하는 팀 코드입니다.');
    return;
  }

  organizationData.teams.push({ code, name, leader });

  // 팀 사용자 자동 생성 (id=팀코드)
  organizationData.users.push({
    id: code,
    password: 'team123',
    isAdmin: false,
    name,
    teamCode: code
  });

  saveData();
  updateSettingsContent();
  populateSelects();

  $('teamCode').value = '';
  $('teamName').value = '';
  $('teamLeader').value = '';

  alert('팀이 성공적으로 추가되었습니다.');
}

function addDepartment(event) {
  event.preventDefault();

  const teamCode = $('deptTeamSelect').value;
  const code = $('deptCode').value.trim();
  const name = $('deptName').value.trim();
  const leader = $('deptLeader').value.trim();

  if (!teamCode) return alert('⚠️ 소속 팀을 선택해주세요.');
  if (!code) return alert('⚠️ 부서 코드를 입력해주세요.');
  if (!name) return alert('⚠️ 부서 이름을 입력해주세요.');
  if (!leader) return alert('⚠️ 부서장을 입력해주세요.');

  if (organizationData.departments.find(d => d.code === code)) {
    alert('이미 존재하는 부서 코드입니다.');
    return;
  }

  organizationData.departments.push({ code, name, teamCode, leader });

  saveData();
  updateSettingsContent();
  updateDashboard();
  populateSelects();

  $('deptTeamSelect').value = '';
  $('deptCode').value = '';
  $('deptName').value = '';
  $('deptLeader').value = '';

  alert('부서가 성공적으로 추가되었습니다.');
}

function addItem(event) {
  event.preventDefault();

  const deptCode = $('itemDeptSelect').value;
  const code = $('itemCode').value.trim();
  const name = $('itemName').value.trim();
  const budgetValue = $('itemBudget').value.trim();
  const budget = parseFloat(budgetValue);

  if (!deptCode) return alert('⚠️ 소속 부서를 선택해주세요.');
  if (!code) return alert('⚠️ 항목 코드를 입력해주세요.');
  if (!name) return alert('⚠️ 항목 이름을 입력해주세요.');
  if (!budgetValue || isNaN(budget) || budget <= 0) return alert('⚠️ 올바른 예산 금액을 입력해주세요.');

  if (organizationData.items.find(i => i.code === code)) {
    alert('이미 존재하는 항목 코드입니다.');
    return;
  }

  organizationData.items.push({ code, name, deptCode, budget, spent: 0.0 });

  saveData();
  updateSettingsContent();
  updateDashboard();
  populateSelects();

  $('itemDeptSelect').value = '';
  $('itemCode').value = '';
  $('itemName').value = '';
  $('itemBudget').value = '';

  alert('항목이 성공적으로 추가되었습니다.');
}

// lists
function updateTeamsList() {
  const container = $('teamsList');
  container.innerHTML = '';

  organizationData.teams
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .forEach(team => {
      const div = document.createElement('div');
      div.className = 'border p-4 rounded mb-2';
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <strong>${team.code} - ${team.name}</strong>
            <p class="text-sm text-gray-600">팀장: ${team.leader}</p>
          </div>
          <div class="space-x-2">
            <button data-action="editTeam" data-code="${team.code}" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">편집</button>
            <button data-action="deleteTeam" data-code="${team.code}" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">삭제</button>
          </div>
        </div>
      `;
      container.appendChild(div);
    });

  container.querySelectorAll('button[data-action="editTeam"]').forEach(btn => {
    btn.addEventListener('click', () => editTeam(btn.dataset.code));
  });
  container.querySelectorAll('button[data-action="deleteTeam"]').forEach(btn => {
    btn.addEventListener('click', () => showDeleteConfirmation('팀', btn.dataset.code, () => deleteTeam(btn.dataset.code)));
  });
}

function updateDepartmentsList() {
  const container = $('departmentsList');
  container.innerHTML = '';

  organizationData.departments
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .forEach(dept => {
      const team = organizationData.teams.find(t => t.code === dept.teamCode);

      const div = document.createElement('div');
      div.className = 'border p-4 rounded mb-2';
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <strong>${dept.code} - ${dept.name}</strong>
            <p class="text-sm text-gray-600">소속팀: ${team ? team.name : dept.teamCode}</p>
            <p class="text-sm text-gray-600">부서장: ${dept.leader}</p>
          </div>
          <div class="space-x-2">
            <button data-action="editDept" data-code="${dept.code}" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">편집</button>
            <button data-action="deleteDept" data-code="${dept.code}" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">삭제</button>
          </div>
        </div>
      `;
      container.appendChild(div);
    });

  container.querySelectorAll('button[data-action="editDept"]').forEach(btn => {
    btn.addEventListener('click', () => editDepartment(btn.dataset.code));
  });
  container.querySelectorAll('button[data-action="deleteDept"]').forEach(btn => {
    btn.addEventListener('click', () => showDeleteConfirmation('부서', btn.dataset.code, () => deleteDepartment(btn.dataset.code)));
  });
}

function updateItemsList() {
  const container = $('itemsList');
  container.innerHTML = '';

  organizationData.items
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .forEach(item => {
      const dept = organizationData.departments.find(d => d.code === item.deptCode);
      const team = organizationData.teams.find(t => t.code === dept?.teamCode);

      const div = document.createElement('div');
      div.className = 'border p-4 rounded mb-2';
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <strong>${item.code} - ${item.name}</strong>
            <p class="text-sm text-gray-600">소속: ${team ? team.name : ''} > ${dept ? dept.name : item.deptCode}</p>
            <p class="text-sm text-gray-600">예산: ${formatCurrency(item.budget)} | 지출: ${formatCurrency(item.spent)} | 잔액: ${formatCurrency(Number(item.budget||0) - Number(item.spent||0))}</p>
          </div>
          <div class="space-x-2">
            <button data-action="editItem" data-code="${item.code}" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">편집</button>
            <button data-action="deleteItem" data-code="${item.code}" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">삭제</button>
          </div>
        </div>
      `;
      container.appendChild(div);
    });

  container.querySelectorAll('button[data-action="editItem"]').forEach(btn => {
    btn.addEventListener('click', () => editItem(btn.dataset.code));
  });
  container.querySelectorAll('button[data-action="deleteItem"]').forEach(btn => {
    btn.addEventListener('click', () => showDeleteConfirmation('항목', btn.dataset.code, () => deleteItem(btn.dataset.code)));
  });
}

function updateBudgetsList() {
  const container = $('budgetsList');
  container.innerHTML = '';

  const teamBudgets = {};
  const deptBudgets = {};

  organizationData.items.forEach(item => {
    const dept = organizationData.departments.find(d => d.code === item.deptCode);
    const team = organizationData.teams.find(t => t.code === dept?.teamCode);

    if (team) {
      if (!teamBudgets[team.code]) teamBudgets[team.code] = { name: team.name, budget: 0, spent: 0 };
      teamBudgets[team.code].budget += Number(item.budget || 0);
      teamBudgets[team.code].spent += Number(item.spent || 0);
    }

    if (dept) {
      if (!deptBudgets[dept.code]) deptBudgets[dept.code] = { name: dept.name, teamName: team?.name, budget: 0, spent: 0 };
      deptBudgets[dept.code].budget += Number(item.budget || 0);
      deptBudgets[dept.code].spent += Number(item.spent || 0);
    }
  });

  Object.entries(teamBudgets).forEach(([code, data]) => {
    const div = document.createElement('div');
    div.className = 'border p-4 rounded mb-2 bg-green-50';
    div.innerHTML = `
      <h4 class="font-bold">${code} - ${data.name} (팀)</h4>
      <p>예산: ${formatCurrency(data.budget)} | 지출: ${formatCurrency(data.spent)} | 잔액: ${formatCurrency(data.budget - data.spent)}</p>
    `;
    container.appendChild(div);
  });

  Object.entries(deptBudgets).forEach(([code, data]) => {
    const div = document.createElement('div');
    div.className = 'border p-4 rounded mb-2 bg-green-50 ml-4';
    div.innerHTML = `
      <h5 class="font-bold">${code} - ${data.name} (부서)</h5>
      <p class="text-sm">소속팀: ${data.teamName || ''}</p>
      <p>예산: ${formatCurrency(data.budget)} | 지출: ${formatCurrency(data.spent)} | 잔액: ${formatCurrency(data.budget - data.spent)}</p>
    `;
    container.appendChild(div);
  });
}

function updateUsersList() {
  const container = $('usersList');
  container.innerHTML = '';

  organizationData.users.forEach(user => {
    if (user.id === 'admin') return;

    const div = document.createElement('div');
    div.className = 'border p-4 rounded mb-2';
    div.innerHTML = `
      <div class="flex justify-between items-center">
        <div><strong>${user.id} - ${user.name}</strong></div>
        <div class="flex space-x-2">
          <input type="password" id="newPassword_${user.id}" placeholder="새 비밀번호" class="px-3 py-1 border rounded">
          <button data-action="changePw" data-id="${user.id}" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">변경</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll('button[data-action="changePw"]').forEach(btn => {
    btn.addEventListener('click', () => changePassword(btn.dataset.id));
  });
}

function changePassword(userId) {
  const input = document.getElementById(`newPassword_${userId}`);
  const newPassword = input?.value || '';
  if (!newPassword) return alert('새 비밀번호를 입력해주세요.');

  const user = organizationData.users.find(u => u.id === userId);
  if (!user) return;

  user.password = newPassword;
  saveData();
  alert('비밀번호가 변경되었습니다.');
  input.value = '';
}

// ---------- Backups ----------
function createBackup() {
  const backup = {
    id: Date.now(),
    date: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(organizationData))
  };
  organizationData.backups.push(backup);
  saveData();
  updateBackupsList();
}

function updateBackupsList() {
  const container = $('backupsList');
  if (!container) return;

  container.innerHTML = '';

  (organizationData.backups || [])
    .slice()
    .sort((a, b) => (b.id || 0) - (a.id || 0))
    .forEach(backup => {
      const div = document.createElement('div');
      div.className = 'border p-4 rounded mb-2';
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <strong>백업 ${backup.id}</strong>
            <p class="text-sm text-gray-600">${new Date(backup.date).toLocaleString('ko-KR')}</p>
          </div>
          <div class="space-x-2">
            <button data-action="restore" data-id="${backup.id}" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm">복원</button>
            <button data-action="delete" data-id="${backup.id}" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">삭제</button>
          </div>
        </div>
      `;
      container.appendChild(div);
    });

  container.querySelectorAll('button[data-action="restore"]').forEach(btn => {
    btn.addEventListener('click', () => restoreBackup(Number(btn.dataset.id)));
  });

  container.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => showDeleteConfirmation('백업', btn.dataset.id, () => deleteBackup(Number(btn.dataset.id))));
  });
}

function restoreBackup(backupId) {
  if (!confirm('이 백업으로 복원하시겠습니까? 현재 데이터는 손실됩니다.')) return;

  const backup = organizationData.backups.find(b => b.id === backupId);
  if (!backup) return;

  organizationData = backup.data;
  saveData();
  alert('백업이 복원되었습니다. 페이지를 새로고침합니다.');
  location.reload();
}

function deleteBackup(backupId) {
  organizationData.backups = organizationData.backups.filter(b => b.id !== backupId);
  saveData();
  updateBackupsList();
  closeDeleteModal();
  alert('백업이 성공적으로 삭제되었습니다.');
}

// ---------- Delete Confirmation Modal ----------
function showDeleteConfirmation(type, code, callback) {
  $('deleteMessage').textContent = `${type} "${code}"을(를) 정말로 삭제하시겠습니까?`;
  deleteCallback = callback;
  $('deleteModal').classList.remove('hidden');
  $('deleteModal').classList.add('flex');
}

function closeDeleteModal() {
  $('deleteModal').classList.add('hidden');
  $('deleteModal').classList.remove('flex');
  deleteCallback = null;
}

// ---------- Delete functions ----------
function deleteTeam(code) {
  try {
    const relatedDepts = organizationData.departments.filter(d => d.teamCode === code);
    const deptCodes = relatedDepts.map(d => d.code);

    organizationData.items = organizationData.items.filter(i => !deptCodes.includes(i.deptCode));
    organizationData.departments = organizationData.departments.filter(d => d.teamCode !== code);
    organizationData.expenses = organizationData.expenses.filter(e => e.teamCode !== code);
    organizationData.users = organizationData.users.filter(u => u.id === 'admin' || u.teamCode !== code);
    organizationData.teams = organizationData.teams.filter(t => t.code !== code);

    saveData();
    updateSettingsContent();
    updateDashboard();
    populateSelects();
    closeDeleteModal();

    alert('팀과 관련된 모든 데이터가 성공적으로 삭제되었습니다.');
  } catch (err) {
    console.error(err);
    alert('팀 삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

function deleteDepartment(code) {
  try {
    organizationData.items = organizationData.items.filter(i => i.deptCode !== code);
    organizationData.expenses = organizationData.expenses.filter(e => e.deptCode !== code);
    organizationData.departments = organizationData.departments.filter(d => d.code !== code);

    saveData();
    updateSettingsContent();
    updateDashboard();
    populateSelects();
    closeDeleteModal();

    alert('부서와 관련된 모든 데이터가 성공적으로 삭제되었습니다.');
  } catch (err) {
    console.error(err);
    alert('부서 삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

function deleteItem(code) {
  try {
    organizationData.expenses = organizationData.expenses.filter(e => e.itemCode !== code);
    organizationData.items = organizationData.items.filter(i => i.code !== code);

    saveData();
    updateSettingsContent();
    updateDashboard();
    populateSelects();
    closeDeleteModal();

    alert('항목과 관련된 모든 데이터가 성공적으로 삭제되었습니다.');
  } catch (err) {
    console.error(err);
    alert('항목 삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

// ---------- Edit Modals (same as your original idea, but safer) ----------
function closeEditModal() {
  $('editModal').classList.add('hidden');
  $('editModal').classList.remove('flex');
}

function editTeam(code) {
  const team = organizationData.teams.find(t => t.code === code);
  if (!team) return;

  $('editModalTitle').textContent = '팀 편집';
  $('editModalContent').innerHTML = `
    <form id="editTeamForm">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">팀 코드</label>
          <input type="text" value="${team.code}" class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100" readonly>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">팀 이름</label>
          <input type="text" id="editTeamName" value="${team.name}" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">팀장</label>
          <input type="text" id="editTeamLeader" value="${team.leader}" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
        </div>
      </div>
      <div class="flex space-x-3 mt-6">
        <button type="button" id="cancelEditBtn" class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">취소</button>
        <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">저장</button>
      </div>
    </form>
  `;

  $('editModal').classList.remove('hidden');
  $('editModal').classList.add('flex');

  $('cancelEditBtn').addEventListener('click', closeEditModal);
  $('editTeamForm').addEventListener('submit', (e) => {
    e.preventDefault();
    team.name = $('editTeamName').value.trim();
    team.leader = $('editTeamLeader').value.trim();

    // 해당 팀 사용자 이름도 업데이트
    const user = organizationData.users.find(u => u.teamCode === code);
    if (user) user.name = team.name;

    saveData();
    updateSettingsContent();
    updateDashboard();
    populateSelects();
    closeEditModal();
    alert('팀 정보가 성공적으로 수정되었습니다.');
  });
}

function editDepartment(code) {
  const dept = organizationData.departments.find(d => d.code === code);
  if (!dept) return;

  $('editModalTitle').textContent = '부서 편집';
  $('editModalContent').innerHTML = `
    <form id="editDeptForm">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">소속 팀</label>
          <select id="editDeptTeamCode" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
            ${organizationData.teams.map(team =>
              `<option value="${team.code}" ${team.code === dept.teamCode ? 'selected' : ''}>${team.code} - ${team.name}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">부서 코드</label>
          <input type="text" value="${dept.code}" class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100" readonly>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">부서 이름</label>
          <input type="text" id="editDeptName" value="${dept.name}" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">부서장</label>
          <input type="text" id="editDeptLeader" value="${dept.leader}" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
        </div>
      </div>
      <div class="flex space-x-3 mt-6">
        <button type="button" id="cancelEditBtn" class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">취소</button>
        <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">저장</button>
      </div>
    </form>
  `;

  $('editModal').classList.remove('hidden');
  $('editModal').classList.add('flex');

  $('cancelEditBtn').addEventListener('click', closeEditModal);
  $('editDeptForm').addEventListener('submit', (e) => {
    e.preventDefault();

    dept.teamCode = $('editDeptTeamCode').value;
    dept.name = $('editDeptName').value.trim();
    dept.leader = $('editDeptLeader').value.trim();

    saveData();
    updateSettingsContent();
    updateDashboard();
    populateSelects();
    closeEditModal();
    alert('부서 정보가 성공적으로 수정되었습니다.');
  });
}

function editItem(code) {
  const item = organizationData.items.find(i => i.code === code);
  if (!item) return;

  $('editModalTitle').textContent = '항목 편집';
  $('editModalContent').innerHTML = `
    <form id="editItemForm">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">소속 부서</label>
          <select id="editItemDeptCode" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
            ${organizationData.departments.map(dept => {
              const team = organizationData.teams.find(t => t.code === dept.teamCode);
              return `<option value="${dept.code}" ${dept.code === item.deptCode ? 'selected' : ''}>${dept.code} - ${dept.name} (${team ? team.name : ''})</option>`;
            }).join('')}
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">항목 코드</label>
          <input type="text" value="${item.code}" class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100" readonly>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">항목 이름</label>
          <input type="text" id="editItemName" value="${item.name}" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">예산</label>
          <input type="number" step="0.01" id="editItemBudget" value="${item.budget}" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">현재 지출</label>
          <input type="text" value="${formatCurrency(item.spent)}" class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100" readonly>
        </div>
      </div>

      <div class="flex space-x-3 mt-6">
        <button type="button" id="cancelEditBtn" class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">취소</button>
        <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">저장</button>
      </div>
    </form>
  `;

  $('editModal').classList.remove('hidden');
  $('editModal').classList.add('flex');

  $('cancelEditBtn').addEventListener('click', closeEditModal);
  $('editItemForm').addEventListener('submit', (e) => {
    e.preventDefault();

    item.deptCode = $('editItemDeptCode').value;
    item.name = $('editItemName').value.trim();
    item.budget = parseFloat($('editItemBudget').value);

    saveData();
    updateSettingsContent();
    updateDashboard();
    populateSelects();
    closeEditModal();
    alert('항목 정보가 성공적으로 수정되었습니다.');
  });
}

// ---------- Import / Export System Data ----------
function exportSystemData() {
  const dataStr = JSON.stringify(organizationData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `NLOC_BUDGET_EXPENSE_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert('시스템 데이터가 성공적으로 내보내졌습니다.');
}

function importSystemData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);

      if (!importedData.teams || !importedData.departments || !importedData.items) {
        alert('올바르지 않은 데이터 파일입니다.');
        return;
      }

      if (confirm('현재 데이터를 모두 교체하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        organizationData = importedData;
        saveData();
        alert('데이터가 성공적으로 가져와졌습니다. 페이지를 새로고침합니다.');
        location.reload();
      }
    } catch (err) {
      alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// =====================================================
// Wire up events once DOM is ready
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  initializeData();

  // login
  $('loginForm').addEventListener('submit', handleLogin);

  // nav
  $('navDashboardBtn').addEventListener('click', () => showSection('dashboard'));
  $('navSettingsBtn').addEventListener('click', () => showSection('settings'));
  $('navLogoutBtn').addEventListener('click', logout);
  $('logoutBigBtn').addEventListener('click', logout);

  // dashboard selects
  $('teamSelect').addEventListener('change', () => {
    updateDepartmentSelect();
    calculateTotal();
  });
  $('departmentSelect').addEventListener('change', () => {
    updateItemSelect();
    calculateTotal();
  });

  // expense form
  $('expenseForm').addEventListener('submit', addExpense);
  $('cancelExpenseBtn').addEventListener('click', resetExpenseForm);
  $('addExpenseItemBtn').addEventListener('click', addExpenseItem);

  // actions
  $('exportExcelBtn').addEventListener('click', exportToExcel);
  $('printExpensesBtn').addEventListener('click', printExpenses);
  $('checkBudgetBtn').addEventListener('click', checkBudgetBalance);

  // modal buttons
  $('closeExpenseFormBtn').addEventListener('click', closeExpenseForm);
  $('printExpenseFormBtn').addEventListener('click', printExpenseForm);
  $('closeEditModalBtn').addEventListener('click', closeEditModal);

  // delete modal buttons
  $('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
  $('confirmDeleteBtn').addEventListener('click', () => {
    if (typeof deleteCallback === 'function') deleteCallback();
  });

  // settings tabs
  document.querySelectorAll('.settings-tab').forEach(btn => {
    btn.addEventListener('click', () => showSettingsTab(btn.dataset.tab));
  });

  // settings forms
  $('addTeamForm').addEventListener('submit', addTeam);
  $('addDepartmentForm').addEventListener('submit', addDepartment);
  $('addItemForm').addEventListener('submit', addItem);
  $('createBackupBtn').addEventListener('click', createBackup);

  // system import/export on login page
  $('exportSystemBtn').addEventListener('click', exportSystemData);
  $('importSystemBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importSystemData(file);
    e.target.value = '';
  });
});
