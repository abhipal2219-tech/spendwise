import { ExpenseDB } from '../data/db.js';

export const CATEGORIES = [
  { key: 'food',          label: 'Food',           icon: '🍔', color: '#FF6B6B' },
  { key: 'transport',     label: 'Transport',       icon: '🚗', color: '#4ECDC4' },
  { key: 'shopping',      label: 'Shopping',        icon: '🛍️',  color: '#45B7D1' },
  { key: 'study',         label: 'Study',           icon: '📚', color: '#96CEB4' },
  { key: 'entertainment', label: 'Entertainment',   icon: '🎬', color: '#FFEAA7' },
  { key: 'others',        label: 'Others',          icon: '📦', color: '#DDA0DD' },
];

export const ExpenseService = {
  /**
   * Add a personal expense
   */
  addExpense({ userId, amount, category, date, notes = '', groupId = null, isShared = false }) {
    if (!userId) throw new Error('User not authenticated');
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) throw new Error('Invalid amount');
    if (!category) throw new Error('Category is required');
    if (!date) throw new Error('Date is required');
    return ExpenseDB.create({ userId, groupId, amount, category, date, notes, isShared });
  },

  deleteExpense(id) {
    ExpenseDB.delete(id);
  },

  getUserExpenses(userId) {
    return ExpenseDB.forUser(userId).sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  getTodayTotal(userId) {
    return ExpenseDB.forUserToday(userId).reduce((s, e) => s + e.amount, 0);
  },

  getMonthTotal(userId) {
    return ExpenseDB.forUserMonth(userId).reduce((s, e) => s + e.amount, 0);
  },

  getCategoryTotals(userId) {
    const expenses = ExpenseDB.forUserMonth(userId);
    const map = {};
    CATEGORIES.forEach(c => { map[c.key] = 0; });
    expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return CATEGORIES.map(c => ({ ...c, total: parseFloat((map[c.key] || 0).toFixed(2)) }));
  },

  getRecentTransactions(userId, limit = 10) {
    return ExpenseDB.forUser(userId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  },

  getWeeklyTrend(userId) {
    const expenses = ExpenseDB.forUser(userId);
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const total = expenses
        .filter(e => new Date(e.date).toDateString() === d.toDateString())
        .reduce((s, e) => s + e.amount, 0);
      trend.push({ label, total: parseFloat(total.toFixed(2)) });
    }
    return trend;
  },

  getMonthlyTrend(userId) {
    const expenses = ExpenseDB.forUser(userId);
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      const total = expenses
        .filter(e => {
          const ed = new Date(e.date);
          return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
        })
        .reduce((s, e) => s + e.amount, 0);
      trend.push({ label, total: parseFloat(total.toFixed(2)) });
    }
    return trend;
  },
};
