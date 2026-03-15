/**
 * app.js — SpendSplit controller (Stitch UI edition)
 */

import { AuthService } from './services/auth.service.js';
import { ExpenseService, CATEGORIES } from './services/expense.service.js';
import { GroupService } from './services/group.service.js';
import { SplitService } from './services/split.service.js';
import { SplitDB, SettlementDB, UserDB, ExpenseDB } from './data/db.js';

// ─────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────
let currentScreen = 'dashboard';
let analyticsPeriod = 'weekly';
let currentGroupId = null;
let pendingSettle = null;

// ─────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────
function init() {
  seedDemo();
  buildCategoryUI();
  if (AuthService.isLoggedIn()) showApp();
  else showAuth();
}

function seedDemo() {
  try { AuthService.register({ name: 'Alex Johnson', email: 'test@demo.com', password: 'password123' }); }
  catch (_) {}
}

// ─────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────
window.switchAuthTab = (tab) => {
  const login = tab === 'login';
  document.getElementById('tab-login').classList.toggle('active', login);
  document.getElementById('tab-register').classList.toggle('active', !login);
  document.getElementById('form-login').classList.toggle('hidden', !login);
  document.getElementById('form-register').classList.toggle('hidden', login);
};

window.handleLogin = (e) => {
  e.preventDefault();
  const err = document.getElementById('login-error');
  err.classList.add('hidden');
  try {
    AuthService.login({ email: document.getElementById('login-email').value, password: document.getElementById('login-password').value });
    showApp();
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
};

window.handleRegister = (e) => {
  e.preventDefault();
  const err = document.getElementById('register-error');
  err.classList.add('hidden');
  try {
    AuthService.register({ name: document.getElementById('reg-name').value, email: document.getElementById('reg-email').value, password: document.getElementById('reg-password').value });
    showApp();
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
};

window.handleLogout = () => { AuthService.logout(); showAuth(); document.getElementById('app').classList.add('hidden'); };

function showAuth() {
  document.getElementById('screen-auth').style.display = 'flex';
  document.getElementById('screen-auth').classList.add('active');
}

function showApp() {
  document.getElementById('screen-auth').style.display = 'none';
  document.getElementById('screen-auth').classList.remove('active');
  document.getElementById('app').classList.remove('hidden');
  navigateTo('dashboard');
}

// ─────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────
const NAV_MAP = { dashboard: 'nav-home', analytics: 'nav-analytics', groups: 'nav-groups', profile: 'nav-profile' };

window.navigateTo = (name) => {
  document.querySelectorAll('.app-screen').forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
  const el = document.getElementById(`screen-${name}`);
  if (el) { el.classList.remove('hidden'); el.classList.add('active'); }
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (NAV_MAP[name]) document.getElementById(NAV_MAP[name])?.classList.add('active');
  currentScreen = name;
  const renders = { dashboard: renderDashboard, analytics: renderAnalytics, groups: renderGroups, 'add-expense': initAddExpense, split: initSplit, profile: renderProfile, settlements: renderSettlements };
  renders[name]?.();
};

// ─────────────────────────────────────────────────────────
// CATEGORY UI (Stitch-style icon pills)
// ─────────────────────────────────────────────────────────
function buildCategoryUI() {
  buildCatRow('cat-row', 'exp-cat', selectExpCat);
  buildCatRow('split-cat-row', 'split-cat', selectSplitCat);
}

function buildCatRow(rowId, hiddenId, onSelect) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.innerHTML = CATEGORIES.map((c, i) => `
    <div class="cat-pill${i === 0 ? ' selected' : ''}" data-key="${c.key}" onclick="${onSelect.name}('${c.key}')"
         id="${rowId}-${c.key}" style="cursor:pointer;">
      <div class="cat-pill-icon" style="${i===0 ? `background:${c.color}22;border-color:${c.color};` : ''}">${c.icon}</div>
      <span class="cat-pill-label">${c.label}</span>
    </div>`).join('');
  const firstKey = CATEGORIES[0].key;
  document.getElementById(hiddenId) && (document.getElementById(hiddenId).value = firstKey);
}

function selectExpCat(key) { selectCatIn('cat-row', 'exp-cat', key); }
function selectSplitCat(key) { selectCatIn('split-cat-row', 'split-cat', key); }
window.selectExpCat = selectExpCat;
window.selectSplitCat = selectSplitCat;

function selectCatIn(rowId, hiddenId, key) {
  document.querySelectorAll(`#${rowId} .cat-pill`).forEach(p => {
    const pk = p.dataset.key;
    const cat = CATEGORIES.find(c => c.key === pk);
    p.classList.remove('selected');
    p.querySelector('.cat-pill-icon').style.background = '';
    p.querySelector('.cat-pill-icon').style.borderColor = '';
  });
  const pill = document.querySelector(`#${rowId} [data-key="${key}"]`);
  if (pill) {
    pill.classList.add('selected');
    const cat = CATEGORIES.find(c => c.key === key);
    if (cat) {
      pill.querySelector('.cat-pill-icon').style.background = cat.color + '22';
      pill.querySelector('.cat-pill-icon').style.borderColor = cat.color;
    }
  }
  const hidden = document.getElementById(hiddenId);
  if (hidden) hidden.value = key;
}

// ─────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────
function renderDashboard() {
  const user = AuthService.currentUser(); if (!user) return;
  document.getElementById('dash-name').textContent = user.name;
  document.getElementById('dash-av-btn').textContent = user.name[0].toUpperCase();

  const today = ExpenseService.getTodayTotal(user.id);
  const month = ExpenseService.getMonthTotal(user.id);
  const balance = Math.max(0, 5000 - month);

  document.getElementById('dash-balance').textContent = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('dash-today').textContent = `₹${today.toFixed(2)}`;

  renderDonut(user.id);
  renderDashTx(user.id);
}

function renderDonut(userId) {
  const totals = ExpenseService.getCategoryTotals(userId).filter(c => c.total > 0);
  const total = totals.reduce((s, c) => s + c.total, 0);
  const canvas = document.getElementById('donut-canvas');
  const legend = document.getElementById('donut-legend');

  if (total === 0) {
    canvas.innerHTML = `<div style="width:90px;height:90px;border-radius:50%;background:var(--border);display:flex;align-items:center;justify-content:center;">
      <span style="font-size:0.6rem;color:var(--text-3);text-align:center;">No data</span></div>`;
    legend.innerHTML = '';
    return;
  }

  // SVG donut
  const r = 40, cx = 45, cy = 45, strokeW = 16;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = totals.map(c => {
    const pct = c.total / total;
    const dash = pct * circumference;
    const seg = { ...c, dash, offset: circumference - offset, pct };
    offset += dash;
    return seg;
  });

  canvas.innerHTML = `
    <svg width="90" height="90" viewBox="0 0 90 90" style="transform:rotate(-90deg)">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${strokeW}"/>
      ${segments.map(s =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="${s.color}" stroke-width="${strokeW}"
          stroke-dasharray="${s.dash} ${circumference - s.dash}"
          stroke-dashoffset="${s.offset}"
          stroke-linecap="round"/>`
      ).join('')}
    </svg>`;

  legend.innerHTML = totals.slice(0, 3).map(c => `
    <div class="legend-row">
      <div class="legend-dot" style="background:${c.color}"></div>
      <span class="legend-name">${c.label}</span>
      <span class="legend-val">₹${c.total.toFixed(0)}</span>
    </div>`).join('');
}

function renderDashTx(userId) {
  const txs = ExpenseService.getRecentTransactions(userId, 5);
  const el = document.getElementById('dash-tx-list');
  el.innerHTML = txs.length
    ? txs.map(t => txHTML(t)).join('')
    : '<p class="empty-msg">Add your first expense! 💸</p>';
}

function txHTML(t) {
  const cat = CATEGORIES.find(c => c.key === t.category) || CATEGORIES[5];
  const date = new Date(t.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  return `
    <div class="tx-item" id="tx-${t.id}">
      <div class="tx-icon-wrap" style="background:${cat.color}22;">${cat.icon}</div>
      <div class="tx-body">
        <div class="tx-name">${t.notes || cat.label}${t.isShared ? ' 🔗' : ''}</div>
        <div class="tx-meta">${cat.label} • ${date}</div>
      </div>
      <span class="tx-amount">-₹${t.amount.toFixed(2)}</span>
      <button class="tx-del" onclick="deleteExpense('${t.id}')" title="Delete">🗑</button>
    </div>`;
}

window.deleteExpense = (id) => {
  ExpenseService.deleteExpense(id);
  showToast('Deleted');
  if (currentScreen === 'dashboard') renderDashboard();
  else if (currentScreen === 'analytics') renderAnalytics();
};

// ─────────────────────────────────────────────────────────
// ADD EXPENSE
// ─────────────────────────────────────────────────────────
function initAddExpense() {
  document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-notes').value = '';
  document.getElementById('add-exp-err').classList.add('hidden');
  selectExpCat('food');
}

window.handleAddExpense = (e) => {
  e.preventDefault();
  const err = document.getElementById('add-exp-err');
  err.classList.add('hidden');
  const user = AuthService.currentUser();
  try {
    ExpenseService.addExpense({
      userId: user.id,
      amount: document.getElementById('exp-amount').value,
      category: document.getElementById('exp-cat').value,
      date: document.getElementById('exp-date').value,
      notes: document.getElementById('exp-notes').value,
    });
    showToast('Expense saved! ✓', 'success');
    navigateTo('dashboard');
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
};

// ─────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────
window.setAnalyticsPeriod = (p) => {
  analyticsPeriod = p;
  ['weekly', 'monthly', 'yearly'].forEach(x =>
    document.getElementById(`pill-${x}`).classList.toggle('active', x === p)
  );
  renderAnalytics();
};

function renderAnalytics() {
  const user = AuthService.currentUser(); if (!user) return;
  const month = ExpenseService.getMonthTotal(user.id);
  document.getElementById('an-total').textContent = `₹${month.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  // Bar chart
  const trend = analyticsPeriod === 'monthly'
    ? ExpenseService.getMonthlyTrend(user.id)
    : ExpenseService.getWeeklyTrend(user.id);
  renderBarChart(trend);

  // Category list
  const cats = ExpenseService.getCategoryTotals(user.id).sort((a, b) => b.total - a.total);
  const maxCat = Math.max(...cats.map(c => c.total), 1);
  const allTxCount = ExpenseService.getUserExpenses(user.id).length;

  document.getElementById('an-cat-list').innerHTML = cats.length && cats.some(c => c.total > 0)
    ? cats.filter(c => c.total > 0).map(c => {
        const pct = Math.round(c.total / (month || 1) * 100);
        const txs = ExpenseDB.forUser(user.id).filter(e => e.category === c.key).length;
        return `
          <div class="cat-breakdown-row">
            <div class="cat-bd-icon" style="background:${c.color}22;">${c.icon}</div>
            <div class="cat-bd-info">
              <div class="cat-bd-name">${c.label}</div>
              <div class="cat-bd-txcount">${txs} transaction${txs !== 1 ? 's' : ''}</div>
              <div class="cat-bd-bar-wrap">
                <div class="cat-bd-bar" style="width:${(c.total/maxCat*100).toFixed(1)}%;background:${c.color};"></div>
              </div>
              <div class="cat-bd-pct">${pct}% of budget</div>
            </div>
            <div>
              <div class="cat-bd-amount">₹${c.total.toFixed(2)}</div>
            </div>
          </div>`;
      }).join('')
    : '<p class="empty-msg">No spending data yet.</p>';

  // Trend line SVG
  renderTrendLine(user.id);

  // All transactions
  const all = ExpenseService.getUserExpenses(user.id);
  document.getElementById('an-tx-list').innerHTML = all.length
    ? all.map(t => txHTML(t)).join('')
    : '<p class="empty-msg">No transactions yet.</p>';
}

function renderBarChart(trend) {
  const maxVal = Math.max(...trend.map(t => t.total), 1);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short' });
  const container = document.getElementById('bar-chart');
  container.innerHTML = trend.map(t => {
    const pct = Math.round((t.total / maxVal) * 100);
    const isActive = t.label === today || (analyticsPeriod !== 'weekly' && t === trend[trend.length -1]);
    return `
      <div class="bar-col">
        <div class="bar-bg">
          <div class="bar-fill${isActive ? ' active' : ''}" style="height:${pct}%;"></div>
        </div>
        <span class="bar-label${isActive ? ' active' : ''}">${t.label}</span>
      </div>`;
  }).join('');
}

function renderTrendLine(userId) {
  const trend = analyticsPeriod === 'monthly'
    ? ExpenseService.getMonthlyTrend(userId)
    : ExpenseService.getWeeklyTrend(userId);
  const vals = trend.map(t => t.total);
  const maxV = Math.max(...vals, 1);
  const W = 300, H = 80, pad = 10;
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
    const y = H - pad - (v / maxV) * (H - pad * 2);
    return [x, y];
  });
  const pathD = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const areaD = `M${pts[0][0]},${H} ` + pts.map(p => `L${p[0]},${p[1]}`).join(' ') + ` L${pts[pts.length-1][0]},${H} Z`;

  const svg = document.getElementById('trend-svg');
  if (svg) {
    document.getElementById('trend-line').setAttribute('d', pathD);
    document.getElementById('trend-area').setAttribute('d', areaD);
  }
  const labels = document.getElementById('trend-x-labels');
  if (labels) {
    labels.innerHTML = trend.map(t => `<span style="font-size:0.6rem;color:var(--text-3);">${t.label}</span>`).join('');
  }
}

// ─────────────────────────────────────────────────────────
// GROUPS
// ─────────────────────────────────────────────────────────
function renderGroups() {
  const user = AuthService.currentUser(); if (!user) return;
  const groups = GroupService.getUserGroups(user.id);
  const el = document.getElementById('groups-list');
  if (!groups.length) {
    el.innerHTML = `
      <div class="empty-card">
        <span class="empty-card-icon">🏠</span>
        <p class="empty-card-text">No groups yet</p>
        <p class="empty-card-hint">Create a group and invite your roommates</p>
        <button class="btn-green" onclick="showModal('modal-create-group')" style="margin-top:8px;">CREATE GROUP</button>
      </div>`;
    return;
  }
  el.innerHTML = groups.map(g => `
    <div class="group-card" onclick="openGroupDetail('${g.id}')" id="gc-${g.id}">
      <div class="group-avatar">🏠</div>
      <div class="group-body">
        <div class="group-name">${g.name}</div>
        <div class="group-meta">${g.members.length} member${g.members.length !== 1 ? 's' : ''} · Created ${new Date(g.createdAt).toLocaleDateString('en-IN')}</div>
      </div>
      <span class="group-arr">›</span>
    </div>`).join('');
}

window.openGroupDetail = (groupId) => {
  currentGroupId = groupId;
  renderGroupDetail(groupId);
  navigateTo('group-detail');
};

function renderGroupDetail(groupId) {
  const group = GroupService.getGroup(groupId); if (!group) return;
  const user = AuthService.currentUser();
  document.getElementById('gd-title').textContent = group.name;

  // Members
  const members = GroupService.getGroupMembers(groupId);
  document.getElementById('gd-members').innerHTML = members.map(m => `
    <div class="member-row">
      <div class="member-av">${m.name[0].toUpperCase()}</div>
      <div style="flex:1;">
        <div class="member-name">${m.name}${m.id === user.id ? ' (You)' : ''}</div>
        <div class="member-email">${m.email}</div>
      </div>
      ${m.id === group.createdBy ? '<span class="member-tag">Admin</span>' : ''}
    </div>`).join('');

  // Balances
  const bal = SplitService.getGroupBalanceSummary(groupId);
  const balEl = document.getElementById('gd-balances');
  balEl.innerHTML = bal.length
    ? bal.map(b => {
        const isCurr = b.fromUser.id === user.id;
        const sinfo = findUnsettledSplit(b.fromUser.id, b.toUser.id, groupId);
        return `
          <div class="balance-row">
            <div class="balance-text">
              <strong>${b.fromUser.name}</strong> owes <span class="to-name">${b.toUser.name}</span>
              &nbsp;₹${b.amount.toFixed(2)}
            </div>
            ${isCurr && sinfo ? `<button class="settle-pill"
              onclick="showSettleModal('${sinfo.splitId}','${b.fromUser.id}','${b.toUser.id}',${b.amount},'${b.fromUser.name}','${b.toUser.name}')">
              Settle ✓</button>` : ''}
          </div>`;
      }).join('')
    : '<p class="empty-msg">All settled up! 🎉</p>';

  // Group expenses
  const splits = SplitDB.getAll().filter(s => {
    const exp = ExpenseDB.getById(s.expenseId);
    return exp && exp.groupId === groupId;
  }).sort((a, b) => new Date(ExpenseDB.getById(b.expenseId)?.date) - new Date(ExpenseDB.getById(a.expenseId)?.date));

  document.getElementById('gd-expenses').innerHTML = splits.length
    ? splits.map(s => {
        const exp = ExpenseDB.getById(s.expenseId);
        const cat = CATEGORIES.find(c => c.key === exp?.category) || CATEGORIES[5];
        const payer = UserDB.getById(s.paidBy);
        return `
          <div class="tx-item">
            <div class="tx-icon-wrap" style="background:${cat.color}22;">${cat.icon}</div>
            <div class="tx-body">
              <div class="tx-name">${exp?.notes || cat.label}</div>
              <div class="tx-meta">Paid by ${payer?.name || '?'} · ₹${s.perShare.toFixed(2)}/person</div>
            </div>
            <span class="tx-amount">₹${exp?.amount.toFixed(2)}</span>
          </div>`;
      }).join('')
    : '<p class="empty-msg">No shared expenses yet.</p>';
}

function findUnsettledSplit(fromId, toId, groupId) {
  for (const split of SplitDB.getAll()) {
    const exp = ExpenseDB.getById(split.expenseId);
    if (!exp || exp.groupId !== groupId || split.paidBy !== toId) continue;
    const entry = split.splits.find(s => s.userId === fromId && !s.settled);
    if (entry) return { splitId: split.id, entry };
  }
  return null;
}

window.showCreateGroupModal = () => showModal('modal-create-group');

window.handleCreateGroup = (e) => {
  e.preventDefault();
  const err = document.getElementById('cg-err'); err.classList.add('hidden');
  try {
    const group = GroupService.createGroup({ name: document.getElementById('new-group-name').value, createdBy: AuthService.currentUser().id });
    closeAllModals();
    showToast(`"${group.name}" created! 🏠`, 'success');
    renderGroups();
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
};

window.handleInviteMember = (e) => {
  e.preventDefault();
  const err = document.getElementById('inv-err'); err.classList.add('hidden');
  try {
    GroupService.inviteMemberByEmail(currentGroupId, document.getElementById('invite-email').value);
    closeAllModals();
    showToast('Member added!', 'success');
    renderGroupDetail(currentGroupId);
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
};

// ─────────────────────────────────────────────────────────
// SPLIT
// ─────────────────────────────────────────────────────────
function initSplit() {
  const user = AuthService.currentUser(); if (!user) return;
  document.getElementById('split-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('split-amount').value = '';
  document.getElementById('split-notes').value = '';
  document.getElementById('split-err').classList.add('hidden');
  document.getElementById('split-preview').classList.add('hidden');

  const groups = GroupService.getUserGroups(user.id);
  const sel = document.getElementById('split-group');
  sel.innerHTML = '<option value="">Select a group…</option>' +
    groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  if (currentGroupId) sel.value = currentGroupId;

  selectSplitCat('food');
  onSplitGroupChange();
}

window.onSplitGroupChange = () => {
  const gid = document.getElementById('split-group').value;
  const paidBy = document.getElementById('split-paid-by');
  const membersEl = document.getElementById('split-members');
  if (!gid) {
    paidBy.innerHTML = '<option value="">Select payer…</option>';
    membersEl.innerHTML = '<p class="empty-msg">Select a group first</p>';
    document.getElementById('split-preview').classList.add('hidden');
    return;
  }
  const user = AuthService.currentUser();
  const members = GroupService.getGroupMembers(gid);
  paidBy.innerHTML = members.map(m =>
    `<option value="${m.id}"${m.id === user.id ? ' selected' : ''}>${m.name}${m.id === user.id ? ' (You)' : ''}</option>`
  ).join('');
  membersEl.innerHTML = members.map(m => `
    <div class="split-member-row">
      <input type="checkbox" class="split-cb" value="${m.id}" id="scb-${m.id}" checked onchange="updateSplitPreview()"/>
      <label for="scb-${m.id}" class="split-member-name">${m.name}${m.id === user.id ? ' (You)' : ''}</label>
    </div>`).join('');
  updateSplitPreview();
};

window.updateSplitPreview = () => {
  const amt = parseFloat(document.getElementById('split-amount').value);
  const paidBy = document.getElementById('split-paid-by').value;
  const checked = Array.from(document.querySelectorAll('.split-cb:checked')).map(c => c.value);
  const preview = document.getElementById('split-preview');
  if (!paidBy || !amt || isNaN(amt) || checked.length < 1) { preview.classList.add('hidden'); return; }
  const per = amt / checked.length;
  document.getElementById('split-preview-rows').innerHTML = checked.map(uid => {
    const u = UserDB.getById(uid);
    const isPayer = uid === paidBy;
    return `<div class="split-preview-row">
      <span class="split-preview-name">${u?.name || uid}</span>
      <span class="split-preview-amt ${isPayer ? 'payer' : 'owes'}">
        ${isPayer ? `+₹${(amt - per*(checked.length-1)).toFixed(2)} back` : `-₹${per.toFixed(2)}`}
      </span></div>`;
  }).join('');
  preview.classList.remove('hidden');
};

window.handleSplitExpense = (e) => {
  e.preventDefault();
  const err = document.getElementById('split-err'); err.classList.add('hidden');
  const members = Array.from(document.querySelectorAll('.split-cb:checked')).map(c => c.value);
  try {
    SplitService.splitExpense({
      paidBy: document.getElementById('split-paid-by').value,
      members,
      totalAmount: parseFloat(document.getElementById('split-amount').value),
      category: document.getElementById('split-cat').value,
      date: document.getElementById('split-date').value,
      notes: document.getElementById('split-notes').value,
      groupId: document.getElementById('split-group').value,
    });
    showToast('Split created! ✂️', 'success');
    navigateTo('groups');
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
};

// ─────────────────────────────────────────────────────────
// SETTLEMENTS
// ─────────────────────────────────────────────────────────
function renderSettlements() {
  const user = AuthService.currentUser(); if (!user) return;
  const groups = GroupService.getUserGroups(user.id);
  let youOwe = [], owedYou = [];
  groups.forEach(g => {
    SplitService.getGroupBalanceSummary(g.id).forEach(b => {
      if (b.fromUser.id === user.id) youOwe.push({ ...b, group: g });
      else if (b.toUser.id === user.id) owedYou.push({ ...b, group: g });
    });
  });

  const renderSettle = (list, type) => list.length
    ? list.map(b => {
        const other = type === 'owe' ? b.toUser : b.fromUser;
        const sinfo = type === 'owe' ? findUnsettledSplit(b.fromUser.id, b.toUser.id, b.group.id) : null;
        return `<div class="settle-row">
          <div class="settle-av">${other.name[0]}</div>
          <div class="settle-body">
            <div class="settle-who">${type === 'owe' ? 'To ' : 'From '}${other.name}</div>
            <div class="settle-group">${b.group.name}</div>
          </div>
          <span class="${type === 'owe' ? 'settle-amt-owe' : 'settle-amt-owed'}">₹${b.amount.toFixed(2)}</span>
          ${sinfo && type === 'owe' ? `<button class="settle-pay-btn"
            onclick="showSettleModal('${sinfo.splitId}','${b.fromUser.id}','${b.toUser.id}',${b.amount},'${b.fromUser.name}','${b.toUser.name}')">
            PAY</button>` : ''}
        </div>`;
      }).join('')
    : `<p class="empty-msg">${type === 'owe' ? 'Nothing to pay! 🎉' : 'No one owes you.'}</p>`;

  document.getElementById('s-you-owe').innerHTML = renderSettle(youOwe, 'owe');
  document.getElementById('s-owed-you').innerHTML = renderSettle(owedYou, 'owed');

  const history = SettlementDB.forUser(user.id).sort((a, b) => new Date(b.settledAt) - new Date(a.settledAt));
  document.getElementById('s-history').innerHTML = history.length
    ? history.map(s => {
        const isSender = s.fromUserId === user.id;
        const other = UserDB.getById(isSender ? s.toUserId : s.fromUserId);
        return txHTML({ id: s.id, notes: `${isSender ? 'Paid' : 'Received from'} ${other?.name || '?'}`, category: 'others', date: s.settledAt, amount: s.amount, isShared: false });
      }).join('')
    : '<p class="empty-msg">No history yet.</p>';
}

// ─────────────────────────────────────────────────────────
// SETTLE MODAL
// ─────────────────────────────────────────────────────────
window.showSettleModal = (splitId, fromId, toId, amount, fromName, toName) => {
  pendingSettle = { splitId, fromId, toId, amount, fromName, toName };
  document.getElementById('settle-info').innerHTML =
    `<strong>${fromName}</strong> owes <strong>${toName}</strong>
     <span class="settle-big-amt">₹${parseFloat(amount).toFixed(2)}</span>
     Mark this as paid?`;
  document.getElementById('settle-err').classList.add('hidden');
  showModal('modal-settle');
};

window.confirmSettle = () => {
  if (!pendingSettle) return;
  try {
    SplitService.settleDebt({ splitId: pendingSettle.splitId, userId: pendingSettle.fromId, toUserId: pendingSettle.toId, amount: pendingSettle.amount });
    closeAllModals();
    showToast('Debt settled! 🎉', 'success');
    pendingSettle = null;
    if (currentScreen === 'group-detail') renderGroupDetail(currentGroupId);
    else if (currentScreen === 'settlements') renderSettlements();
  } catch (ex) { document.getElementById('settle-err').textContent = ex.message; document.getElementById('settle-err').classList.remove('hidden'); }
};

// ─────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────
function renderProfile() {
  const user = AuthService.currentUser(); if (!user) return;
  document.getElementById('profile-av').textContent = user.name[0].toUpperCase();
  document.getElementById('profile-dname').textContent = user.name;
  document.getElementById('profile-demail').textContent = user.email;
  document.getElementById('prof-name-input').value = user.name;

  const exps = ExpenseService.getUserExpenses(user.id);
  const spent = exps.reduce((s, e) => s + e.amount, 0);
  document.getElementById('pstat-count').textContent = exps.length;
  document.getElementById('pstat-spent').textContent = `₹${Math.round(spent)}`;
  document.getElementById('pstat-groups').textContent = GroupService.getUserGroups(user.id).length;
}

window.handleUpdateProfile = (e) => {
  e.preventDefault();
  const err = document.getElementById('prof-err'), ok = document.getElementById('prof-ok');
  err.classList.add('hidden'); ok.classList.add('hidden');
  try {
    const name = document.getElementById('prof-name-input').value.trim();
    if (!name) throw new Error('Name cannot be empty');
    AuthService.updateProfile({ name });
    ok.classList.remove('hidden');
    showToast('Profile saved! ✓', 'success');
    renderProfile();
    setTimeout(() => ok.classList.add('hidden'), 3000);
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
};

window.exportData = () => {
  const user = AuthService.currentUser();
  const exps = ExpenseService.getUserExpenses(user.id);
  const csv = ['Date,Category,Amount,Notes', ...exps.map(e => `${e.date},${e.category},${e.amount},"${e.notes || ''}"`)].join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], {type:'text/csv'})), download: `spendsplit-${new Date().toISOString().split('T')[0]}.csv` });
  a.click();
  showToast('Exported!', 'success');
};

// ─────────────────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────────────────
window.showModal = (id) => {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById(id).classList.remove('hidden');
};
window.closeAllModals = () => {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
};

// ─────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast${type ? ' ' + type : ''}`;
  t.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.add('hidden'), 2800);
}

// ─────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────
init();
