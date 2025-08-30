// Global Data Storage
let categories = [];
let expenses = {};
let salary = 0;

// DOM Elements
const dashboardSection = document.getElementById('dashboard');
const budgetSection = document.getElementById('budget');
const categoriesContainer = document.getElementById('categoriesContainer');
const addCategoryModal = document.getElementById('addCategoryModal');

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    await loadDataFromServer();
    showDashboard();
});

// ---------- API Calls ----------
async function loadDataFromServer() {
    const res = await fetch('/get_data');
    const data = await res.json();
    categories = data.categories;
    expenses = data.expenses;

    categories.forEach(cat => {
        if (!expenses[cat.id]) {
            expenses[cat.id] = [];
        }
    });

    // NEW: load salary
    const salaryRes = await fetch('/get_salary');
    const salaryData = await salaryRes.json();
    salary = salaryData.salary;

    updateDashboardStats();
    renderCategories();
    updateRecentExpenses();
    renderCharts();
}

async function saveCategoryToServer(category) {
    await fetch('/add_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category)
    });
}

async function deleteCategoryFromServer(categoryId) {
    await fetch(`/delete_category/${categoryId}`, { method: 'DELETE' });
}

async function saveExpenseToServer(expense) {
    await fetch('/add_expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense)
    });
}

async function deleteExpenseFromServer(expenseId) {
    await fetch(`/delete_expense/${expenseId}`, { method: 'DELETE' });
}

// ---------- NEW API (EDIT) ----------
async function updateCategoryOnServer(categoryId, updatedData) {
    await fetch(`/update_category/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
    });
}

async function updateExpenseOnServer(expenseId, updatedData) {
    await fetch(`/update_expense/${expenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
    });
}

// ---------- Navigation ----------
function showDashboard() {
    dashboardSection.classList.add('active');
    budgetSection.classList.remove('active');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    updateDashboardStats();
    updateRecentExpenses();
}

function showBudget() {
    budgetSection.classList.add('active');
    dashboardSection.classList.remove('active');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderCategories();
}

// ---------- Modal ----------
function openAddCategoryModal() {
    addCategoryModal.classList.add('active');
    document.getElementById('categoryNameInput').focus();
}

function closeAddCategoryModal() {
    addCategoryModal.classList.remove('active');
    document.getElementById('categoryNameInput').value = '';
    document.getElementById('categoryBudgetInput').value = '';
}

function openSidebar() {
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('sidebar-overlay').classList.add('active');
}



// Update your closeSidebar function  
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

function openCreateDBModal() {
    document.getElementById("createDBModal").classList.add("active");
  }
  function closeCreateDBModal() {
    document.getElementById("createDBModal").classList.remove("active");
  }
  async function createDBFromModal() {
    const name = document.getElementById("newDBNameModal").value.trim();
    if (!name) { alert("Enter DB name"); return; }
    const res = await fetch("/create_db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dbname: name })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    closeCreateDBModal();
    showNotification(data.message, "success");
    loadDBList();
  }

// ---------- Category Management ----------
async function addCategory() {
    const name = document.getElementById('categoryNameInput').value.trim();
    const budget = parseFloat(document.getElementById('categoryBudgetInput').value);

    if (!name || !budget || budget <= 0) {
        alert('Please enter a valid category name and budget amount.');
        return;
    }

    if (categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
        alert('A category with this name already exists.');
        return;
    }

    const categoryId = 'cat_' + Date.now();
    const newCategory = { id: categoryId, name, budget };

    categories.push(newCategory);
    expenses[categoryId] = [];
    await saveCategoryToServer(newCategory);

    renderCategories();
    closeAddCategoryModal();
    updateDashboardStats();
    showNotification(`Category "${name}" added successfully!`, 'success');
}

async function deleteCategory(categoryId) {
    if (categoryId === 'misc_cat') {
        alert("The Miscellaneous category cannot be deleted.");
        return;
    }
    if (!confirm('Are you sure you want to delete this category? All expenses will be lost.')) return;

    categories = categories.filter(cat => cat.id !== categoryId);
    delete expenses[categoryId];
    await deleteCategoryFromServer(categoryId);

    renderCategories();
    updateDashboardStats();
    showNotification('Category deleted successfully!', 'success');
}

// ---------- Expense Management ----------
async function addExpense(categoryId) {
    const descInput = document.getElementById(`desc_${categoryId}`);
    const amountInput = document.getElementById(`amount_${categoryId}`);

    const description = descInput.value.trim();
    const amount = parseFloat(amountInput.value);

    if (!description || isNaN(amount) || amount <= 0) {
        alert('Please enter a valid description and amount.');
        return;
    }

    if (!expenses[categoryId]) expenses[categoryId] = []; // ✅ Ensure array exists

    const expense = {
        id: 'exp_' + Date.now(),
        category_id: categoryId,
        description,
        amount,
        date: new Date().toISOString()
    };

    expenses[categoryId].unshift({   // ✅ newest first
        id: expense.id,
        description,
        amount,
        date: expense.date
    });

    await saveExpenseToServer(expense);

    descInput.value = '';
    amountInput.value = '';
    renderCategories();
    updateDashboardStats();
    updateRecentExpenses();
    const categoryName = categories.find(cat => cat.id === categoryId).name;
    showNotification(`Expense added to ${categoryName}!`, 'success');
}

async function deleteExpense(categoryId, expenseId) {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    expenses[categoryId] = expenses[categoryId].filter(exp => exp.id !== expenseId);
    await deleteExpenseFromServer(expenseId);

    renderCategories();
    updateDashboardStats();
    updateRecentExpenses();
    showNotification('Expense deleted successfully!', 'success');
}

async function loadDBList() {
    const res = await fetch("/list_dbs");
    const data = await res.json();
    const dbs = data.databases || [];
    const active = data.active;
    const dbList = document.getElementById("dbList");
    dbList.innerHTML = dbs.map(db => 
        `<li class="${db === active ? 'active-db' : ''}" onclick="switchDB('${db}')">${db}</li>`
    ).join('');
}

async function createDB() {
    const name = document.getElementById("newDBName").value.trim();
    if (!name) { alert("Enter DB name"); return; }
    const res = await fetch("/create_db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbname: name })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    document.getElementById("newDBName").value = "";
    showNotification(data.message, "success");
    loadDBList();
}


async function switchDB(dbname) {
    await fetch(`/switch_db/${dbname}`, { method: "POST" });
    await loadDataFromServer();  // reload dashboard data for active DB
    closeSidebar();
    showNotification(`Switched to ${dbname}`, "success");
}
// Load DB list when page starts
document.addEventListener("DOMContentLoaded", loadDBList);


// ---------- Rendering ----------
function renderCategories() {
    if (categories.length === 0) {
        categoriesContainer.innerHTML = '<p class="no-data">No categories yet. Click "Add Category" to get started!</p>';
        return;
    }

    categoriesContainer.innerHTML = categories.map(category => {
        // LIFO expenses
        const categoryExpenses = (expenses[category.id] || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
        const totalSpent = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const remaining = category.budget - totalSpent;
        const percentage = category.budget > 0 ? Math.min((totalSpent / category.budget) * 100, 100) : 0;
        const isOverBudget = category.budget > 0 && totalSpent > category.budget;

        return `
            <div class="category-card">
                <div class="category-header">
                    <div class="category-name">${category.name}</div>
                    ${category.id !== 'misc_cat' ? `
                        <button class="edit-btn" onclick="openEditCategoryModal('${category.id}')">✎ Edit</button>
                        <button class="delete-btn" onclick="deleteCategory('${category.id}')">Delete</button>
                    ` : `<span class="locked-tag">Default</span>`}
                </div>

                <!-- Always allow adding expense -->
                <div class="budget-input-group">
                    <input type="text" id="desc_${category.id}" placeholder="Expense description">
                    <input type="number" id="amount_${category.id}" placeholder="Amount">
                    <button class="add-expense-btn" onclick="addExpense('${category.id}')">Add</button>
                </div>

                ${category.budget > 0 ? `
                <div class="progress-bar">
                    <div class="progress-fill ${isOverBudget ? 'over-budget' : ''}" style="width: ${percentage}%"></div>
                </div>
                <div class="budget-summary">
                    <span>Spent: ${totalSpent.toFixed(2)}</span>
                    <span>Budget: ${category.budget.toFixed(2)}</span>
                    <span style="color: ${remaining >= 0 ? '#2ed573' : '#ff4757'}">
                        ${remaining >= 0 ? 'Left' : 'Over'}: ${Math.abs(remaining).toFixed(2)}
                    </span>
                </div>` : `
                <div class="budget-summary">
                    <span>Spent: ${totalSpent.toFixed(2)}</span>
                    <span>No budget allocation</span>
                </div>`}

                ${categoryExpenses.length > 0 ? `
                    <div class="expenses-list">
                        ${categoryExpenses.map(expense => `
                            <div class="expense-item">
                                <div>
                                    <strong>${expense.description}</strong><br>
                                    <small>${new Date(expense.date).toLocaleString()}</small>
                                </div>
                                <div style="display: flex; align-items: center;">
                                    <span>${expense.amount.toFixed(2)}</span>
                                    <button class="edit-btn" onclick="openEditExpenseModal('${category.id}', '${expense.id}')">✎</button>
                                    <button class="expense-delete" onclick="deleteExpense('${category.id}', '${expense.id}')">×</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${isOverBudget ? `<div class="alert" style="color:red;">⚠  Over budget!</div>` : ''}
            </div>
        `;
    }).join('');
}

// ---------- Dashboard ----------
function updateDashboardStats() {
    // Split expenses into budgeted and miscellaneous
    const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);

    let totalSpent = 0;
    let miscSpent = 0;

    categories.forEach(cat => {
        const catSpent = (expenses[cat.id] || []).reduce((s, e) => s + e.amount, 0);
        if (cat.id === 'misc_cat') {
            miscSpent += catSpent;  // ✅ Miscellaneous separate
        } else {
            totalSpent += catSpent; // ✅ Budgeted categories only
        }
    });

    const remaining = totalBudget - totalSpent;
    const savings = salary - (totalSpent + miscSpent);

    document.getElementById('totalBudgetStat').textContent = totalBudget.toFixed(2);
    document.getElementById('totalSpentStat').textContent = totalSpent.toFixed(2);
    document.getElementById('additionalSpentStat').textContent = miscSpent.toFixed(2); // ✅ new box
    document.getElementById('remainingStat').textContent = remaining.toFixed(2);
    document.getElementById('categoriesStat').textContent = categories.length;
    document.getElementById('salaryStat').textContent = salary.toFixed(2);
    document.getElementById('savingsStat').textContent = savings.toFixed(2);
}


function openEditSalaryModal() {
    document.getElementById('editSalaryInput').value = salary;
    document.getElementById('editSalaryModal').classList.add('active');
}

function closeEditSalaryModal() {
    document.getElementById('editSalaryModal').classList.remove('active');
}

async function saveSalaryEdit() {
    const newSalary = parseFloat(document.getElementById('editSalaryInput').value);
    if (!newSalary || newSalary <= 0) {
        alert('Enter a valid salary.');
        return;
    }
    salary = newSalary;
    await fetch('/update_salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: newSalary })
    });
    updateDashboardStats();
    closeEditSalaryModal();
    showNotification('Salary updated successfully!', 'success');
}

function updateRecentExpenses() {
    const recentList = document.getElementById('recentExpensesList');
    const allExpenses = [];
    Object.keys(expenses).forEach(categoryId => {
        const category = categories.find(cat => cat.id === categoryId);
        if (category) {
            expenses[categoryId].forEach(expense => {
                allExpenses.push({ ...expense, categoryName: category.name });
            });
        }
    });

    allExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const recentExpenses = allExpenses.slice(0, 5);

    if (recentExpenses.length === 0) {
        recentList.innerHTML = '<p class="no-data">No expenses yet...</p>';
        return;
    }

    recentList.innerHTML = recentExpenses.map(expense => `
        <div class="recent-expense-item">
            <div class="expense-details">
                <div class="expense-category">${expense.categoryName}</div>
                <div class="expense-description">${expense.description}</div>
                <small>${new Date(expense.date).toLocaleString()}</small>
            </div>
            <div class="expense-amount">${expense.amount.toFixed(2)}</div>
        </div>
    `).join('');
}

// ---------- NEW: Edit Modal Logic ----------
let editingCategoryId = null;
let editingExpenseId = null;
let editingExpenseCategoryId = null;

// Category Editing
function openEditCategoryModal(categoryId) {
    editingCategoryId = categoryId;
    const category = categories.find(c => c.id === categoryId);
    document.getElementById('editCategoryName').value = category.name;
    document.getElementById('editCategoryBudget').value = category.budget;
    document.getElementById('editCategoryModal').classList.add('active');
}

function closeEditCategoryModal() {
    document.getElementById('editCategoryModal').classList.remove('active');
    editingCategoryId = null;
}

async function saveCategoryEdit() {
    const name = document.getElementById('editCategoryName').value.trim();
    const budget = parseFloat(document.getElementById('editCategoryBudget').value);

    if (!name || !budget || budget <= 0) {
        alert('Enter valid name and budget.');
        return;
    }

    const category = categories.find(c => c.id === editingCategoryId);
    category.name = name;
    category.budget = budget;

    await updateCategoryOnServer(editingCategoryId, { name, budget });
    renderCategories();
    updateDashboardStats();
    closeEditCategoryModal();
    showNotification('Category updated successfully!', 'success');
}

// Expense Editing
function openEditExpenseModal(categoryId, expenseId) {
    editingExpenseId = expenseId;
    editingExpenseCategoryId = categoryId;
    const expense = expenses[categoryId].find(e => e.id === expenseId);
    document.getElementById('editExpenseDesc').value = expense.description;
    document.getElementById('editExpenseAmount').value = expense.amount;
    document.getElementById('editExpenseModal').classList.add('active');
}

function closeEditExpenseModal() {
    document.getElementById('editExpenseModal').classList.remove('active');
    editingExpenseId = null;
    editingExpenseCategoryId = null;
}

async function saveExpenseEdit() {
    const description = document.getElementById('editExpenseDesc').value.trim();
    const amount = parseFloat(document.getElementById('editExpenseAmount').value);

    if (!description || !amount || amount <= 0) {
        alert('Enter valid description and amount.');
        return;
    }

    const expense = expenses[editingExpenseCategoryId].find(e => e.id === editingExpenseId);
    expense.description = description;
    expense.amount = amount;

    await updateExpenseOnServer(editingExpenseId, { description, amount });
    renderCategories();
    updateDashboardStats();
    updateRecentExpenses();
    closeEditExpenseModal();
    showNotification('Expense updated successfully!', 'success');
}

// ---------- Utility ----------
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: type === 'success' ? 'green' : type === 'error' ? 'red' : 'blue',
        color: 'white',
        padding: '1rem',
        borderRadius: '10px',
        zIndex: '9999'
    });
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

let monthlyChart, categoryPieChart, budgetTrendChart;

function renderCharts() {
    renderMonthlyBreakdown();
    renderCategoryPie();
    renderBudgetTrend();
}

// ----- Monthly Breakdown -----
function renderMonthlyBreakdown() {
    const monthlyData = {};
    Object.values(expenses).flat().forEach(exp => {
        const month = new Date(exp.date).toLocaleString('default', { month: 'short', year: 'numeric' });
        monthlyData[month] = (monthlyData[month] || 0) + exp.amount;
    });

    const labels = Object.keys(monthlyData);
    const data = Object.values(monthlyData);

    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(document.getElementById('monthlyBreakdownChart'), {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Total Spent', data, backgroundColor: '#36a2eb' }] },
        options: { responsive: true }
    });
}

// ----- Category-wise Pie -----
function renderCategoryPie() {
    const labels = categories.map(c => c.name);
    const data = categories.map(c =>
        (expenses[c.id] || []).reduce((sum, e) => sum + e.amount, 0)
    );

    if (categoryPieChart) categoryPieChart.destroy();
    categoryPieChart = new Chart(document.getElementById('categoryPieChart'), {
        type: 'pie',
        data: { 
            labels, 
            datasets: [{ 
                data, 
                backgroundColor: ['#ff6384','#36a2eb','#ffcd56','#4bc0c0','#9966ff','#e17055'] 
            }] 
        },
        options: { responsive: true }
    });
}

// ----- Budget vs Spent Trend -----
function renderBudgetTrend() {
    const validCategories = categories.filter(c => c.id !== 'misc_cat');

    const labels = validCategories.map(c => c.name);
    const spent = validCategories.map(c =>
        (expenses[c.id] || []).reduce((sum, e) => sum + e.amount, 0)
    );
    const budgets = validCategories.map(c => c.budget);

    if (budgetTrendChart) budgetTrendChart.destroy();
    budgetTrendChart = new Chart(document.getElementById('budgetTrendChart'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Budget', data: budgets, borderColor: '#36a2eb', fill: false },
                { label: 'Spent', data: spent, borderColor: '#ff6384', fill: false }
            ]
        },
        options: { responsive: true }
    });
}

