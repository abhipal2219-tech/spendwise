/**
 * db.js — LocalStorage-backed database
 * Schema:
 *   users            { id, name, email, avatar, createdAt }
 *   groups           { id, name, createdBy, members:[], createdAt }
 *   expenses         { id, userId, groupId|null, amount, category, date, notes, isShared }
 *   expense_splits   { id, expenseId, paidBy, members:[], perShare, splits:[{userId, amount, settled}] }
 *   settlements      { id, fromUserId, toUserId, amount, expenseId, settledAt }
 */

const KEYS = {
  USERS: 'sxt_users',
  GROUPS: 'sxt_groups',
  EXPENSES: 'sxt_expenses',
  SPLITS: 'sxt_splits',
  SETTLEMENTS: 'sxt_settlements',
  CURRENT_USER: 'sxt_current_user',
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}
function readObj(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
}
function write(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── USERS ─────────────────────────────────────────────────────────────────────
export const UserDB = {
  getAll: () => read(KEYS.USERS),
  getById: (id) => read(KEYS.USERS).find(u => u.id === id) || null,
  getByEmail: (email) => read(KEYS.USERS).find(u => u.email === email.toLowerCase()) || null,
  create({ name, email, password, avatar = null }) {
    const users = read(KEYS.USERS);
    if (users.find(u => u.email === email.toLowerCase())) throw new Error('Email already registered');
    const user = { id: genId(), name, email: email.toLowerCase(), password, avatar, createdAt: new Date().toISOString() };
    write(KEYS.USERS, [...users, user]);
    return user;
  },
  update(id, patch) {
    const users = read(KEYS.USERS).map(u => u.id === id ? { ...u, ...patch } : u);
    write(KEYS.USERS, users);
    return users.find(u => u.id === id);
  },
};

// ── SESSION ────────────────────────────────────────────────────────────────────
export const Session = {
  get: () => readObj(KEYS.CURRENT_USER),
  set: (user) => localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user)),
  clear: () => localStorage.removeItem(KEYS.CURRENT_USER),
};

// ── GROUPS ────────────────────────────────────────────────────────────────────
export const GroupDB = {
  getAll: () => read(KEYS.GROUPS),
  getById: (id) => read(KEYS.GROUPS).find(g => g.id === id) || null,
  forUser: (userId) => read(KEYS.GROUPS).filter(g => g.members.includes(userId)),
  create({ name, createdBy }) {
    const groups = read(KEYS.GROUPS);
    const group = { id: genId(), name, createdBy, members: [createdBy], createdAt: new Date().toISOString() };
    write(KEYS.GROUPS, [...groups, group]);
    return group;
  },
  addMember(groupId, userId) {
    const groups = read(KEYS.GROUPS).map(g =>
      g.id === groupId && !g.members.includes(userId)
        ? { ...g, members: [...g.members, userId] } : g
    );
    write(KEYS.GROUPS, groups);
    return groups.find(g => g.id === groupId);
  },
  removeMember(groupId, userId) {
    const groups = read(KEYS.GROUPS).map(g =>
      g.id === groupId ? { ...g, members: g.members.filter(m => m !== userId) } : g
    );
    write(KEYS.GROUPS, groups);
  },
  delete(groupId) {
    write(KEYS.GROUPS, read(KEYS.GROUPS).filter(g => g.id !== groupId));
  },
};

// ── EXPENSES ──────────────────────────────────────────────────────────────────
export const ExpenseDB = {
  getAll: () => read(KEYS.EXPENSES),
  getById: (id) => read(KEYS.EXPENSES).find(e => e.id === id) || null,
  forUser: (userId) => read(KEYS.EXPENSES).filter(e => e.userId === userId),
  forGroup: (groupId) => read(KEYS.EXPENSES).filter(e => e.groupId === groupId),
  forUserToday(userId) {
    const today = new Date().toDateString();
    return read(KEYS.EXPENSES).filter(e => e.userId === userId && new Date(e.date).toDateString() === today);
  },
  forUserMonth(userId) {
    const now = new Date();
    return read(KEYS.EXPENSES).filter(e => {
      const d = new Date(e.date);
      return e.userId === userId && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  },
  create({ userId, groupId = null, amount, category, date, notes = '', isShared = false }) {
    const expenses = read(KEYS.EXPENSES);
    const expense = { id: genId(), userId, groupId, amount: parseFloat(amount), category, date, notes, isShared, createdAt: new Date().toISOString() };
    write(KEYS.EXPENSES, [...expenses, expense]);
    return expense;
  },
  delete(id) {
    write(KEYS.EXPENSES, read(KEYS.EXPENSES).filter(e => e.id !== id));
  },
};

// ── EXPENSE SPLITS ────────────────────────────────────────────────────────────
export const SplitDB = {
  getAll: () => read(KEYS.SPLITS),
  getById: (id) => read(KEYS.SPLITS).find(s => s.id === id) || null,
  forExpense: (expenseId) => read(KEYS.SPLITS).find(s => s.expenseId === expenseId) || null,
  forUser: (userId) => read(KEYS.SPLITS).filter(s => s.splits.some(sp => sp.userId === userId)),
  create({ expenseId, paidBy, members, totalAmount }) {
    const perShare = parseFloat((totalAmount / members.length).toFixed(2));
    const splits = members.map(userId => ({ userId, amount: perShare, settled: userId === paidBy }));
    // fix rounding: assign any leftover to first non-payer
    const totalAssigned = splits.reduce((s, sp) => s + sp.amount, 0);
    const diff = parseFloat((totalAmount - totalAssigned).toFixed(2));
    if (diff !== 0) {
      const idx = splits.findIndex(sp => sp.userId !== paidBy);
      if (idx >= 0) splits[idx].amount = parseFloat((splits[idx].amount + diff).toFixed(2));
    }
    const record = { id: genId(), expenseId, paidBy, members, perShare, splits, createdAt: new Date().toISOString() };
    write(KEYS.SPLITS, [...read(KEYS.SPLITS), record]);
    return record;
  },
  settleSplit(splitId, userId) {
    const allSplits = read(KEYS.SPLITS).map(s =>
      s.id === splitId
        ? { ...s, splits: s.splits.map(sp => sp.userId === userId ? { ...sp, settled: true } : sp) }
        : s
    );
    write(KEYS.SPLITS, allSplits);
    return allSplits.find(s => s.id === splitId);
  },
};

// ── SETTLEMENTS ───────────────────────────────────────────────────────────────
export const SettlementDB = {
  getAll: () => read(KEYS.SETTLEMENTS),
  forUser: (userId) => read(KEYS.SETTLEMENTS).filter(s => s.fromUserId === userId || s.toUserId === userId),
  create({ fromUserId, toUserId, amount, note = '' }) {
    const settlements = read(KEYS.SETTLEMENTS);
    const settlement = { id: genId(), fromUserId, toUserId, amount: parseFloat(amount), note, settledAt: new Date().toISOString() };
    write(KEYS.SETTLEMENTS, [...settlements, settlement]);
    return settlement;
  },
};

export { genId, KEYS };
