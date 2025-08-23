// Global Data Storage
let categories = [];
let expenses = {};

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
    updateDashboardStats();
    renderCategories();
    updateRecentExpenses();
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

    if (!description || !amount || amount <= 0) {
        alert('Please enter a valid description and amount.');
        return;
    }

    const expense = {
        id: 'exp_' + Date.now(),
        category_id: categoryId,
        description,
        amount,
        date: new Date().toISOString() 
    };

    expenses[categoryId].push({
        id: expense.id,
        description: description,
        amount: amount,
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

// ---------- Rendering ----------
function renderCategories() {
    if (categories.length === 0) {
        categoriesContainer.innerHTML = '<p class="no-data">No categories yet. Click "Add Category" to get started!</p>';
        return;
    }

    categoriesContainer.innerHTML = categories.map(category => {
        const categoryExpenses = expenses[category.id] || [];
        const totalSpent = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const remaining = category.budget - totalSpent;
        const percentage = Math.min((totalSpent / category.budget) * 100, 100);
        const isOverBudget = totalSpent > category.budget;

        return `
            <div class="category-card">
                <div class="category-header">
                    <div class="category-name">${category.name}</div>
                    <button onclick="openEditCategoryModal('${category.id}')">✎ Edit</button>
                    <button class="delete-btn" onclick="deleteCategory('${category.id}')">Delete</button>
                </div>
                
                <div class="budget-input-group">
                    <input type="text" id="desc_${category.id}" placeholder="Expense description" />
                    <input type="number" id="amount_${category.id}" placeholder="Amount" step="0.01" min="0" />
                    <button class="add-expense-btn" onclick="addExpense('${category.id}')">Add</button>
                </div>
                
                <div class="progress-bar">
                    <div class="progress-fill ${isOverBudget ? 'over-budget' : ''}" style="width: ${percentage}%"></div>
                </div>
                
                <div class="budget-summary">
                    <span>Spent: ${totalSpent.toFixed(2)}</span>
                    <span>Budget: ${category.budget.toFixed(2)}</span>
                    <span style="color: ${remaining >= 0 ? '#2ed573' : '#ff4757'}">
                        ${remaining >= 0 ? 'Left' : 'Over'}: ${Math.abs(remaining).toFixed(2)}
                    </span>
                </div>
                
                ${categoryExpenses.length > 0 ? `
                    <div class="expenses-list">
                        ${categoryExpenses.map(expense => `
                            <div class="expense-item">
                                <div>
                                    <strong>${expense.description}</strong><br>
                                    <small>${expense.date}</small>
                                </div>
                                <div style="display: flex; align-items: center;">
                                    <span>${expense.amount.toFixed(2)}</span>
                                    <button onclick="openEditExpenseModal('${category.id}', '${expense.id}')">✎</button>
                                    <button class="expense-delete" onclick="deleteExpense('${category.id}', '${expense.id}')">×</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// ---------- Dashboard ----------
function updateDashboardStats() {
    const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);
    const totalSpent = Object.keys(expenses).reduce((sum, categoryId) => {
        return sum + expenses[categoryId].reduce((catSum, exp) => catSum + exp.amount, 0);
    }, 0);
    const remaining = totalBudget - totalSpent;
    const categoriesCount = categories.length;

    document.getElementById('totalBudgetStat').textContent = `${totalBudget.toFixed(2)}`;
    document.getElementById('totalSpentStat').textContent = `${totalSpent.toFixed(2)}`;
    document.getElementById('remainingStat').textContent = `${remaining.toFixed(2)}`;
    document.getElementById('categoriesStat').textContent = categoriesCount;
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
