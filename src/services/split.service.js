import { ExpenseDB, SplitDB, SettlementDB, UserDB } from '../data/db.js';
import { ExpenseService } from './expense.service.js';

export const SplitService = {
  /**
   * splitExpense — Add a shared expense and automatically create splits
   * @param {string} paidBy       userId of the person who paid
   * @param {string[]} members    userIds of everyone included (must include paidBy)
   * @param {number} totalAmount
   * @param {string} category
   * @param {string} date
   * @param {string} notes
   * @param {string|null} groupId
   */
  splitExpense({ paidBy, members, totalAmount, category, date, notes = '', groupId = null }) {
    if (!paidBy) throw new Error('Payer is required');
    if (!members || members.length < 2) throw new Error('At least 2 members required to split an expense');
    if (!members.includes(paidBy)) throw new Error('Payer must be included in members');
    if (parseFloat(totalAmount) <= 0) throw new Error('Amount must be positive');

    // Create the base expense as shared
    const expense = ExpenseService.addExpense({
      userId: paidBy,
      amount: totalAmount,
      category,
      date,
      notes,
      groupId,
      isShared: true,
    });

    // Create split records
    const split = SplitDB.create({ expenseId: expense.id, paidBy, members, totalAmount });
    return { expense, split };
  },

  /**
   * calculateBalances — compute net balances per user pair in a group
   * Positive means "is owed money", negative means "owes money"
   * Returns { userId: { net, owes: [{toId, amount}], owed: [{fromId, amount}] } }
   */
  calculateBalances(groupId) {
    const splits = SplitDB.getAll().filter(sp => {
      const expense = ExpenseDB.getById(sp.expenseId);
      return expense && expense.groupId === groupId;
    });

    // Build debt map: debt[fromId][toId] = amount owed
    const debt = {};
    const ensureDebt = (a, b) => {
      if (!debt[a]) debt[a] = {};
      if (!debt[b]) debt[b] = {};
      if (!debt[a][b]) debt[a][b] = 0;
      if (!debt[b][a]) debt[b][a] = 0;
    };

    splits.forEach(split => {
      split.splits.forEach(sp => {
        if (!sp.settled && sp.userId !== split.paidBy) {
          ensureDebt(sp.userId, split.paidBy);
          debt[sp.userId][split.paidBy] += sp.amount;
        }
      });
    });

    // Net out mutual debts (simplify)
    const simplified = {};
    const processed = new Set();

    Object.keys(debt).forEach(fromId => {
      Object.keys(debt[fromId]).forEach(toId => {
        const key = [fromId, toId].sort().join('_');
        if (processed.has(key)) return;
        processed.add(key);

        const ab = debt[fromId]?.[toId] || 0;
        const ba = debt[toId]?.[fromId] || 0;
        const net = ab - ba;

        if (net > 0.01) {
          if (!simplified[fromId]) simplified[fromId] = [];
          simplified[fromId].push({ toId, amount: parseFloat(net.toFixed(2)) });
        } else if (net < -0.01) {
          if (!simplified[toId]) simplified[toId] = [];
          simplified[toId].push({ toId: fromId, amount: parseFloat(Math.abs(net).toFixed(2)) });
        }
      });
    });

    return simplified;
  },

  /**
   * getGroupBalanceSummary — human-readable balance list for a group
   * Returns array of { fromUser, toUser, amount }
   */
  getGroupBalanceSummary(groupId) {
    const balances = this.calculateBalances(groupId);
    const rows = [];
    Object.entries(balances).forEach(([fromId, debts]) => {
      debts.forEach(({ toId, amount }) => {
        const fromUser = UserDB.getById(fromId);
        const toUser = UserDB.getById(toId);
        if (fromUser && toUser && amount > 0) {
          rows.push({ fromUser, toUser, amount });
        }
      });
    });
    return rows;
  },

  /**
   * settleDebt — mark a specific split entry as settled and record a settlement
   */
  settleDebt({ splitId, userId, toUserId, amount }) {
    SplitDB.settleSplit(splitId, userId);
    const settlement = SettlementDB.create({ fromUserId: userId, toUserId, amount, note: 'Settled via app' });
    return settlement;
  },

  /**
   * getUserSplits — all splits involving a user, enriched with expense info
   */
  getUserSplits(userId) {
    return SplitDB.forUser(userId).map(split => {
      const expense = ExpenseDB.getById(split.expenseId);
      const userEntry = split.splits.find(sp => sp.userId === userId);
      const isPayer = split.paidBy === userId;
      return { ...split, expense, userEntry, isPayer };
    });
  },

  getSplitForExpense(expenseId) {
    return SplitDB.forExpense(expenseId);
  },
};
