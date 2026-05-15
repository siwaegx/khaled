/* ============================================================
   STATE
   ============================================================ */
const State = {
  currentUser: null,
  token: null,
  currentPage: null,
  dealsView: 'kanban',
  activityFilter: 'all',
  activityType: '',
  taskFilter: 'all',
  contacts: [],
  companies: [],
  deals: [],
  activities: [],
  tasks: [],
  reminders: [],
  users: [],
  lists: {},
  dealChart: null,
  selectedCompanyId: null,
  selectedContactId: null,
  companyCache: {},
  contactCache: {},
  companyStatusFilter: '',
  contactStatusFilter: '',
  bulkContacts: [],
  bulkCompanies: [],
  viewAsUserId: null,   // manager/team leader: which user's data to scope to
  teamMembers: [],      // team leader's sales users
  customFields: { contact: [], company: [] },
  settings: { currency: 'EGP', currency_symbol: 'EGP' },
};

const LIST_LABELS = {
  city: 'Cities',
  industry: 'Industries',
  contact_title: 'Contact Titles',
  lead_status: 'Lead Status',
  source: 'Sources',
  category: 'Categories',
  company_status: 'Company Status',
};

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const STAGE_LABELS = { lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', won: 'Won', lost: 'Lost' };
const STAGE_COLORS = { lead: '#f59e0b', qualified: '#3b82f6', proposal: '#8b5cf6', negotiation: '#ec4899', won: '#10b981', lost: '#ef4444' };
const TYPE_ICONS = {
  call: 'fa-phone', email: 'fa-envelope', meeting: 'fa-calendar-alt', task: 'fa-check-square',
  visit: 'fa-map-marker-alt', note: 'fa-sticky-note', stage_change: 'fa-exchange-alt',
};

const STATUS_COLORS = {
  'fresh lead': '#3b82f6',
  'hot': '#ef4444',
  'cold': '#94a3b8',
  'vip': '#8b5cf6',
  'rfq': '#10b981',
  'need visit': '#f59e0b',
  'not interested': '#6b7280',
  'done sales': '#059669',
  'registered': '#0ea5e9',
  'customer': '#7c3aed',
};
function statusColor(status) {
  if (!status) return '#e2e8f0';
  return STATUS_COLORS[status.toLowerCase()] || '#6b7280';
}

/* ============================================================
   THEME (DARK / LIGHT MODE)
   ============================================================ */
function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  const icon = document.getElementById('themeIcon');
  if (icon) { icon.className = dark ? 'fas fa-sun' : 'fas fa-moon'; }
}
function toggleTheme() {
  const isDark = document.body.classList.contains('dark');
  const next = !isDark;
  localStorage.setItem('crm_theme', next ? 'dark' : 'light');
  applyTheme(next);
}
(function initTheme() {
  const saved = localStorage.getItem('crm_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved === 'dark' || (!saved && prefersDark));
})();

/* ============================================================
   API HELPER
   ============================================================ */
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (State.token) headers['Authorization'] = `Bearer ${State.token}`;
  // Manager / team leader: inject view_as on GET requests to scope data to selected user
  const _role = State.currentUser?.role;
  const _noViewAs = ['/api/auth','/api/team','/api/users','/api/lists','/api/notifications'];
  if ((['manager','team_leader'].includes(_role)) && State.viewAsUserId &&
      (options.method === undefined || options.method === 'GET') &&
      path.startsWith('/api/') && !_noViewAs.some(p => path.startsWith(p))) {
    const sep = path.includes('?') ? '&' : '?';
    path = path + sep + 'view_as=' + State.viewAsUserId;
  }
  const res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    // Only force logout for explicit auth failures, not background poll errors
    if (State.token && !options._silent) doLogout();
    throw new Error(body.error || 'Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ============================================================
   UTILITIES
   ============================================================ */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(val) {
  if (val == null || val === '') return '—';
  return val;
}

function fmtMoney(v) {
  const sym = State.settings?.currency_symbol || 'EGP';
  const num = Number(v) || 0;
  return sym + ' ' + num.toLocaleString();
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function avatarColor(name) {
  const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
  let hash = 0;
  for (const ch of String(name || '?')) hash = ((hash * 31) + ch.charCodeAt(0)) & 0xFFFFFF;
  return colors[hash % colors.length];
}

function initials(name) {
  return String(name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function emptyState(icon, msg, sub) {
  return `<div class="table-wrapper"><div class="empty-state">
    <i class="fas ${icon}"></i>
    <p>${esc(msg)}</p>
    ${sub ? `<span>${esc(sub)}</span>` : ''}
  </div></div>`;
}

function showToast(msg, type = 'success') {
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${icons[type] || icons.success}"></i><span>${esc(msg)}</span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => {
    t.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

let _confirmCallback = null;
function confirmDialog(msg, sub, onConfirm) {
  _confirmCallback = onConfirm;
  openModal('Confirm Delete', `
    <div class="confirm-body">
      <i class="fas fa-exclamation-triangle"></i>
      <p>${esc(msg)}</p>
      ${sub ? `<span>${esc(sub)}</span>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="_doConfirm()">Delete</button>
    </div>`);
}
window._doConfirm = function () { closeModal(); if (_confirmCallback) _confirmCallback(); };

/* ============================================================
   MODAL
   ============================================================ */
function openModal(title, bodyHtml, size = '') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalDialog').className = 'modal-dialog' + (size ? ' ' + size : '');
  document.getElementById('modalBackdrop').classList.add('open');
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  // Clear modal content to prevent stale data
  setTimeout(() => {
    document.getElementById('modalTitle').textContent = '';
    document.getElementById('modalBody').innerHTML = '';
  }, 300); // After transition
}

/* ============================================================
   AUTH & INIT
   ============================================================ */
async function init() {
  State.token = localStorage.getItem('crm_token');
  if (State.token) {
    // Try up to 3 times — handles brief server restart during dev
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        State.currentUser = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${State.token}` }
        }).then(async res => {
          if (res.status === 401) { State.token = null; localStorage.removeItem('crm_token'); return null; }
          if (!res.ok) throw new Error('server_error');
          return res.json();
        });
        if (State.currentUser) { showApp(); return; }
        break; // null means 401 — stop retrying
      } catch(e) {
        if (attempt < 2) await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
      }
    }
  }
  showLogin();
}

function showLogin() {
  const overlay = document.getElementById('login-overlay');
  overlay.style.display = 'flex';
  overlay.classList.remove('hidden');
  pinBuffer = '';
  const f = document.getElementById('pinInput');
  if (f) f.value = '';
  updateDots();
  hidePinError();
  setTimeout(() => f?.focus(), 60);
}

function showApp() {
  const overlay = document.getElementById('login-overlay');
  overlay.classList.add('hidden');
  overlay.style.display = 'none';
  updateSidebarUser();
  updateNavVisibility();
  const hash = location.hash.slice(1) || 'dashboard';
  navigateTo(hash);
}

function doLogout() {
  if (State.token) {
    fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${State.token}` } }).catch(() => {});
  }
  localStorage.removeItem('crm_token');
  State.token = null;
  State.currentUser = null;
  if (State.dealChart) { State.dealChart.destroy(); State.dealChart = null; }
  showLogin();
}

function updateSidebarUser() {
  const u = State.currentUser;
  if (!u) return;
  const ini = initials(u.name);
  document.getElementById('sidebarAvatar').textContent = ini;
  document.getElementById('sidebarName').textContent = u.name;
  const roleLabels = { manager: 'Manager', team_leader: 'Team Leader', sales: 'Sales' };
  document.getElementById('sidebarRole').textContent = roleLabels[u.role] || u.role;
  document.getElementById('topbarUserBadge').textContent = ini;
}

function updateNavVisibility() {
  const role = State.currentUser?.role;
  const isManager = role === 'manager';
  const isTL = role === 'team_leader';
  const canManage = isManager || isTL;
  document.getElementById('nav-users').style.display = isManager ? '' : 'none';
  document.getElementById('nav-lists').style.display = isManager ? '' : 'none';
  document.getElementById('nav-team').style.display = isTL ? '' : 'none';
  document.querySelectorAll('.manager-only').forEach(el => el.style.display = isManager ? '' : 'none');
  // General task button visible to managers AND team leaders
  const gtBtn = document.getElementById('btn-general-task');
  if (gtBtn) gtBtn.style.display = canManage ? '' : 'none';
}

/* ============================================================
   TEAM LEADER — member selector bar
   ============================================================ */
async function initTLMemberBar() {
  const role = State.currentUser?.role;
  if (role === 'team_leader') {
    try {
      const data = await api('/api/team');
      State.teamMembers = data.members || [];
    } catch(_) {}
  }
  renderTLMemberBar();
}

function renderTLMemberBar() {
  const bar = document.getElementById('tl-member-bar');
  if (!bar) return;
  const role = State.currentUser?.role;
  const isManager = role === 'manager';
  const isTL = role === 'team_leader';
  if (!isManager && !isTL) { bar.style.display = 'none'; return; }
  bar.style.display = '';

  // Manager sees all users; TL sees their team members
  const members = isManager
    ? (State.users || []).filter(u => u.id !== State.currentUser.id)
    : State.teamMembers;

  const chips = document.getElementById('tl-member-chips');
  chips.innerHTML = `
    <button class="tl-chip ${!State.viewAsUserId ? 'active' : ''}" onclick="setViewAs(null)">
      <i class="fas ${isManager ? 'fa-users' : 'fa-user-tie'}"></i>
      ${isManager ? 'All Data' : 'My Data'}
    </button>
    ${members.map(m => `
      <button class="tl-chip ${State.viewAsUserId === m.id ? 'active' : ''}" onclick="setViewAs(${m.id})">
        <span class="tl-chip-avatar" style="background:${avatarColor(m.name)}">${initials(m.name)}</span>
        ${esc(m.name)}
      </button>`).join('')}`;
}

window.setViewAs = function(userId) {
  State.viewAsUserId = userId;
  // Clear all caches so pages re-fetch scoped data
  State.companyCache = {};
  State.contactCache = {};
  State.selectedCompanyId = null;
  State.selectedContactId = null;
  renderTLMemberBar();
  loadPage(State.currentPage);
};

/* ============================================================
   PIN PAD
   ============================================================ */
let pinBuffer = '';

// Called by oninput on the input element (inline attribute — always works)
window.pinOnInput = function(field) {
  const digits = field.value.replace(/\D/g, '').slice(0, 4);
  field.value = digits;
  pinBuffer = digits;
  updateDots();
  hidePinError();
  if (pinBuffer.length === 4) submitPin();
};

// Called by onkeydown on the input element
window.pinOnKeyDown = function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (pinBuffer.length === 4) submitPin();
    else pinShakeCard();
  }
};

function initPinPad() {
  const field = document.getElementById('pinInput');

  // Numpad digit buttons
  document.querySelectorAll('.pin-btn[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (pinBuffer.length >= 4) return;
      pinBuffer += btn.dataset.digit;
      if (field) field.value = pinBuffer;
      updateDots();
      hidePinError();
      if (field) field.focus();
      if (pinBuffer.length === 4) submitPin();
    });
  });

  // Backspace button
  const backBtn = document.getElementById('pinBack');
  if (backBtn) backBtn.addEventListener('click', () => {
    pinBuffer = pinBuffer.slice(0, -1);
    if (field) field.value = pinBuffer;
    updateDots();
    hidePinError();
    if (field) field.focus();
  });

  // Arrow/submit button
  const enterBtn = document.getElementById('pinEnter');
  if (enterBtn) enterBtn.addEventListener('click', () => {
    if (pinBuffer.length === 4) submitPin();
    else pinShakeCard();
    if (field) field.focus();
  });
}

function pinShakeCard() {
  const card = document.querySelector('.login-card');
  if (!card) return;
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
  setTimeout(() => card.classList.remove('shake'), 500);
}

function updateDots() {
  // Use querySelectorAll — no reliance on specific element IDs
  document.querySelectorAll('.login-overlay .pin-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinBuffer.length);
  });
}

function hidePinError() {
  const el = document.getElementById('pin-error');
  if (el) el.style.display = 'none';
}

async function submitPin() {
  const field = document.getElementById('pinInput');
  try {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ pin: pinBuffer }) });
    if (!data) return;
    State.token = data.token;
    State.currentUser = data.user;
    localStorage.setItem('crm_token', data.token);
    pinBuffer = '';
    if (field) field.value = '';
    updateDots();
    showApp();
    if (State.currentUser) {
      preloadSharedData();
      initTLMemberBar();
      initNotifications();
    }
  } catch (e) {
    pinBuffer = '';
    if (field) field.value = '';
    updateDots();
    const err = document.getElementById('pin-error');
    if (err) err.style.display = 'flex';
    pinShakeCard();
    setTimeout(() => field?.focus(), 50);
  }
}

/* ============================================================
   ROUTER
   ============================================================ */
function navigateTo(page) {
  const valid = ['dashboard', 'contacts', 'companies', 'deals', 'activities', 'tasks', 'reminders', 'reports', 'calendar', 'team', 'users', 'lists'];
  if (!valid.includes(page)) page = 'dashboard';
  if ((page === 'users' || page === 'lists') && State.currentUser?.role !== 'manager') page = 'dashboard';
  if (page === 'team' && State.currentUser?.role !== 'team_leader') page = 'dashboard';

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const navEl = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  State.currentPage = page;
  history.replaceState(null, '', `#${page}`);
  loadPage(page);
}

function loadPage(page) {
  const map = {
    dashboard:  loadDashboard,
    contacts:   loadContacts,
    companies:  loadCompanies,
    deals:      loadDeals,
    activities: loadActivities,
    tasks:      loadTasks,
    reminders:  loadReminders,
    reports:    loadReports,
    calendar:   loadCalendar,
    team:       loadTeamPage,
    users:      loadUsers,
    lists:      loadListsPage,
  };
  map[page]?.();
}

/* ============================================================
   DASHBOARD
   ============================================================ */
async function loadDashboard() {
  document.getElementById('dashboard-content').innerHTML = '<div class="spinner"></div>';
  try {
    const month = new Date().toISOString().slice(0,7);
    const [data, goalsData] = await Promise.all([
      api('/api/dashboard'),
      ['manager','team_leader'].includes(State.currentUser?.role) ? api(`/api/goals?month=${month}`, {_silent:true}).catch(()=>({goals:[]})) : Promise.resolve({goals:[]}),
    ]);
    if (!data) return;
    document.getElementById('dashboard-subtitle').textContent = `Welcome back, ${State.currentUser?.name}!`;
    renderDashboard({ ...data, goals: goalsData.goals || [] });
  } catch (e) {
    console.error('Dashboard load error:', e.message);
    document.getElementById('dashboard-content').innerHTML = emptyState('fa-exclamation-circle', 'Failed to load dashboard', e.message);
  }
}

window.loadGoalsModal = async function() {
  const month = new Date().toISOString().slice(0,7);
  const {goals} = await api(`/api/goals?month=${month}`).catch(()=>({goals:[]}));
  const users = State.users || [];
  openModal('Monthly Goals — ' + month, `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text-muted);">Click a user to set or update their goal for this month.</div>
    ${users.filter(u=>u.role!=='manager').map(u => {
      const g = goals.find(x=>x.user_id===u.id);
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="width:32px;height:32px;border-radius:50%;background:${avatarColor(u.name)};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;">${initials(u.name)}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${esc(u.name)}</div>
          ${g ? `<div style="font-size:11px;color:var(--text-muted);">Rev: ${fmtMoney(g.target_revenue)} · Deals: ${g.target_deals} · Acts: ${g.target_activities}</div>` : '<div style="font-size:11px;color:var(--text-muted);">No goal set</div>'}
        </div>
        <button class="btn btn-sm btn-secondary" onclick="closeModal();openGoalForm(${u.id},'${esc(u.name)}','${month}')"><i class="fas fa-bullseye"></i> ${g ? 'Edit' : 'Set'}</button>
      </div>`;
    }).join('')}
  `);
};

function renderDashboard({ stats: s, dealsByStage, recentContacts, upcomingActivities, recentDeals, overdueCount, activityFeed, leaderboard, goals }) {
  const canSeeLeaderboard = ['manager','team_leader'].includes(State.currentUser?.role);
  document.getElementById('dashboard-content').innerHTML = `
    <!-- Stat cards row -->
    <div class="stats-grid">
      ${statCard('fa-users',            'Contacts',     s.totalContacts,        'var(--primary)')}
      ${statCard('fa-building',         'Companies',    s.totalCompanies,       '#10b981')}
      ${statCard('fa-handshake',        'Active Deals', s.totalDeals,           '#f59e0b')}
      ${statCard('fa-trophy',           'Won Revenue',  fmtMoney(s.wonRevenue), '#8b5cf6')}
      ${statCard('fa-filter',            'Pipeline',     fmtMoney(s.pipelineValue), '#3b82f6')}
      ${statCard('fa-chart-line',        'Forecast',     fmtMoney(s.forecastValue||0), '#14b8a6')}
      ${statCard('fa-exclamation-circle','Overdue',      overdueCount||0,            '#ef4444')}
    </div>

    <!-- Charts + upcoming row -->
    <div class="dashboard-grid">
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-chart-bar" style="color:var(--primary);margin-right:6px;"></i>Pipeline by Stage</div>
        <div class="chart-wrapper"><canvas id="dealsChart"></canvas></div>
      </div>
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-clock" style="color:var(--warning);margin-right:6px;"></i>Due Soon</div>
        <ul class="recent-list">
          ${upcomingActivities.length ? upcomingActivities.map(a => {
            const overdue = a.due_date && new Date(a.due_date) < new Date();
            return `<li class="recent-item">
              <div class="type-icon type-${a.type}"><i class="fas ${TYPE_ICONS[a.type]||'fa-circle'}"></i></div>
              <div class="recent-item-info">
                <div class="recent-item-name">${esc(a.title)}</div>
                <div class="recent-item-sub">${esc(a.company_name||a.contact_name||'—')}</div>
              </div>
              <div class="recent-item-right ${overdue?'overdue':''}">${fmtDate(a.due_date)}</div>
            </li>`;
          }).join('') : '<li class="empty-list-item">No upcoming activities</li>'}
        </ul>
      </div>
    </div>

    <!-- Activity feed + Recent deals row -->
    <div class="dashboard-grid">
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-bolt" style="color:var(--warning);margin-right:6px;"></i>Activity Feed</div>
        <ul class="recent-list">
          ${activityFeed && activityFeed.length ? activityFeed.map(a => `
            <li class="recent-item">
              <div class="type-icon type-${a.type}"><i class="fas ${TYPE_ICONS[a.type]||'fa-circle'}"></i></div>
              <div class="recent-item-info">
                <div class="recent-item-name">${esc(a.title)}</div>
                <div class="recent-item-sub">
                  ${a.user_name ? `<span style="font-weight:500;">${esc(a.user_name)}</span>` : ''}
                  ${a.company_name ? ` · ${esc(a.company_name)}` : a.contact_name ? ` · ${esc(a.contact_name)}` : ''}
                </div>
              </div>
              <div class="recent-item-right">${fmtDate(a.created_at)}</div>
            </li>`).join('') : '<li class="empty-list-item">No activities yet</li>'}
        </ul>
      </div>
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-handshake" style="color:var(--primary);margin-right:6px;"></i>Recent Deals</div>
        <ul class="recent-list">
          ${recentDeals.length ? recentDeals.map(d => `
            <li class="recent-item">
              <div style="width:10px;height:10px;border-radius:50%;background:${STAGE_COLORS[d.stage]};flex-shrink:0;margin-top:2px;"></div>
              <div class="recent-item-info">
                <div class="recent-item-name">${esc(d.title)}</div>
                <div class="recent-item-sub">${esc(d.company_name||'—')}</div>
              </div>
              <div class="recent-item-right" style="font-weight:600;color:var(--primary);">${fmtMoney(d.value)}</div>
            </li>`).join('') : '<li class="empty-list-item">No deals yet</li>'}
        </ul>
      </div>
    </div>

    <!-- Leaderboard (manager / TL only) -->
    ${canSeeLeaderboard && leaderboard && leaderboard.length ? `
    <div class="card dash-card" style="margin-top:0;">
      <div class="dash-card-title" style="justify-content:space-between;">
        <span><i class="fas fa-medal" style="color:#f59e0b;margin-right:6px;"></i>Team Leaderboard</span>
        ${State.currentUser?.role === 'manager' ? `<button class="btn btn-sm btn-secondary" onclick="loadGoalsModal()"><i class="fas fa-bullseye"></i> Goals</button>` : ''}
      </div>
      <div class="leaderboard">
        ${leaderboard.map((u,i) => {
          const goal = (goals||[]).find(g => g.user_id === u.id);
          return `<div class="lb-row">
            <div class="lb-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${i+1}</div>
            <div class="lb-avatar" style="background:${avatarColor(u.name)}">${initials(u.name)}</div>
            <div class="lb-info">
              <div class="lb-name">${esc(u.name)}</div>
              <div class="lb-role">${u.role}</div>
              ${goal ? `
                ${goalBar(goal.actual_revenue||0, goal.target_revenue, avatarColor(u.name))}
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${goal.actual_activities||0}/${goal.target_activities||0} activities · ${goal.actual_deals||0}/${goal.target_deals||0} deals</div>
              ` : ''}
            </div>
            <div class="lb-stats">
              <div class="lb-stat"><span class="lb-val">${u.activity_count}</span><span class="lb-lbl">Acts</span></div>
              <div class="lb-stat"><span class="lb-val">${u.deal_count}</span><span class="lb-lbl">Deals</span></div>
              <div class="lb-stat"><span class="lb-val">${fmtMoney(u.won_revenue)}</span><span class="lb-lbl">Won</span></div>
            </div>
            ${State.currentUser?.role === 'manager' ? `<button class="btn btn-sm btn-secondary" style="flex-shrink:0;" onclick="openGoalForm(${u.id},'${esc(u.name)}')" title="Set goal"><i class="fas fa-bullseye"></i></button>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}`;

  renderDealsChart(dealsByStage);
}

function statCard(icon, label, value, color) {
  return `<div class="stat-card" style="border-left:4px solid ${color};">
    <div class="stat-icon" style="background:${color}22;color:${color};"><i class="fas ${icon}"></i></div>
    <div class="stat-info">
      <div class="stat-value">${esc(String(value))}</div>
      <div class="stat-label">${esc(label)}</div>
    </div>
  </div>`;
}

function renderDealsChart(dealsByStage) {
  const ctx = document.getElementById('dealsChart')?.getContext('2d');
  if (!ctx) return;
  if (State.dealChart) State.dealChart.destroy();
  const order = ['lead','qualified','proposal','negotiation','won','lost'];
  const sorted = order.map(s => dealsByStage.find(d => d.stage === s)).filter(Boolean);
  const labels = sorted.map(d => STAGE_LABELS[d.stage] || d.stage);
  const counts = sorted.map(d => d.count);
  const values = sorted.map(d => d.value);
  const colors = sorted.map(d => STAGE_COLORS[d.stage] || '#9ca3af');
  State.dealChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Deals', data: counts, backgroundColor: colors, borderRadius: 6, yAxisID: 'y' },
        { label: 'Value', data: values, backgroundColor: colors.map(c => c + '33'), borderColor: colors, borderWidth: 1, borderRadius: 6, type: 'bar', yAxisID: 'y2' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y:  { position: 'left',  ticks: { font: { size: 11 }, color: '#6b7280' }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y2: { position: 'right', ticks: { font: { size: 11 }, color: '#6b7280', callback: v => fmtMoney(v) }, grid: { display: false } },
        x:  { ticks: { font: { size: 11 }, color: '#6b7280' }, grid: { display: false } },
      },
    },
  });
}

/* ============================================================
   CONTACTS
   ============================================================ */
async function loadContacts() {
  const listPanel = document.getElementById('ct-list-panel');
  if (listPanel) listPanel.innerHTML = '<div class="spinner"></div>';
  try {
    const search = document.getElementById('contactSearch').value;
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    State.contacts = await api('/api/contacts' + params) || [];
    populateStatusFilter('contactStatusFilter', State.lists['lead_status'] || []);
    filterContacts();
  } catch (e) {
    const lp = document.getElementById('ct-list-panel');
    if (lp) lp.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load contacts');
  }
}

function debounce(fn, ms) {
  let t;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

const searchContacts = debounce(filterContacts, 200);

function filterContacts() {
  const status = document.getElementById('contactStatusFilter').value;
  const search = document.getElementById('contactSearch')?.value.toLowerCase().trim() || '';
  let filtered = State.contacts;
  if (status) filtered = filtered.filter(c => c.lead_status === status);
  if (search) filtered = filtered.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
    (c.company_name||'').toLowerCase().includes(search) ||
    (c.phone||'').includes(search) ||
    (c.email||'').toLowerCase().includes(search)
  );
  document.getElementById('contacts-count').textContent = `${filtered.length} contact${filtered.length !== 1 ? 's' : ''}`;
  renderContactList(filtered);
  if (State.selectedContactId && !filtered.find(c => c.id === State.selectedContactId)) {
    State.selectedContactId = null;
    const dp = document.getElementById('ct-detail-panel');
    if (dp) { dp.classList.remove('open'); dp.innerHTML = '<div class="split-empty"><i class="fas fa-user"></i><p>Select a contact</p></div>'; }
  } else if (State.selectedContactId) {
    const dp = document.getElementById('ct-detail-panel');
    if (dp && dp.classList.contains('open') && !State.contactCache[State.selectedContactId]) {
      openContactDetail(State.selectedContactId);
    }
  }
}

function renderContactList(contacts) {
  const panel = document.getElementById('ct-list-panel');
  if (!panel) return;
  if (!contacts.length) {
    panel.innerHTML = `<div style="padding:60px;text-align:center;color:var(--text-muted);">
      <i class="fas fa-users" style="font-size:40px;opacity:.2;display:block;margin-bottom:12px;"></i>No contacts found</div>`;
    return;
  }
  const bulkBar = document.getElementById('ct-bulk-bar');
  if (bulkBar) { State.bulkContacts = []; renderBulkBar('contacts'); }
  panel.innerHTML = `
    <div class="select-all-bar" id="ct-select-all-bar">
      <label class="select-all-label">
        <input type="checkbox" id="ct-select-all-cb" onclick="selectAllBulk('contacts',this.checked)">
        <span id="ct-select-all-text">Select all (${contacts.length})</span>
      </label>
    </div>
    <div class="cards-grid">${contacts.map(c => {
    const isSelected = State.selectedContactId === c.id;
    return `<div class="entity-card ${isSelected?'selected':''}" id="ct-row-${c.id}" onclick="selectContact(${c.id})">
      <input type="checkbox" class="bulk-check" data-id="${c.id}" onclick="event.stopPropagation();toggleBulk('contacts',${c.id},this.checked)" title="Select">
      <div class="entity-card-top">
        <div class="entity-card-avatar" style="background:${avatarColor(c.first_name)}">${esc(c.first_name[0]||'?')}${esc((c.last_name||'')[0]||'')}</div>
        <div style="flex:1;min-width:0;">
          <div class="entity-card-name">${esc(c.first_name)} ${esc(c.last_name||'')}</div>
          <div class="entity-card-sub">${esc(c.title||'—')}</div>
        </div>
      </div>
      ${c.company_name ? `<div class="entity-card-meta"><i class="fas fa-building" style="font-size:9px;"></i>${esc(c.company_name)}</div>` : ''}
      ${c.phone ? `<div class="entity-card-meta"><i class="fas fa-phone" style="font-size:9px;"></i>${esc(c.phone)}</div>` : ''}
      <div class="entity-card-footer">
        ${c.lead_status ? `<span class="split-status-chip" style="background:#f1f5f9;color:var(--text-muted);border:1px solid var(--border);font-size:10px;cursor:pointer;"
          onclick="event.stopPropagation();quickChangeLeadStatus(${c.id},event)">
          ${esc(c.lead_status)} <i class="fas fa-chevron-down" style="font-size:8px;opacity:.6;"></i>
        </span>` : '<span></span>'}
        <div class="entity-card-actions">
          <button class="entity-card-act-btn" onclick="event.stopPropagation();quickLogForContact('call',${c.id})" title="Log Call"><i class="fas fa-phone"></i></button>
          <button class="entity-card-act-btn visit" onclick="event.stopPropagation();quickLogForContact('visit',${c.id})" title="Log Visit"><i class="fas fa-map-marker-alt"></i></button>
          <button class="entity-card-act-btn note" onclick="event.stopPropagation();quickLogForContact('note',${c.id})" title="Add Note"><i class="fas fa-sticky-note"></i></button>
          ${c.phone ? `<button class="entity-card-act-btn whatsapp" onclick="event.stopPropagation();openWhatsApp('${c.phone.replace(/\D/g,'')}')" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

window.quickLogForContact = function(type, contactId) {
  const c = State.contacts.find(x => x.id === contactId);
  openModal(`Log ${type.charAt(0).toUpperCase()+type.slice(1)}`, `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Title *</label>
        <input id="ql_title" class="form-control" value="${type === 'call' ? `Call with ${c ? esc(c.first_name) : ''}` : type === 'visit' ? `Visit — ${c ? esc(c.first_name) : ''}` : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Date & Time</label>
        <input id="ql_date" class="form-control" type="datetime-local" value="${new Date().toISOString().slice(0,16)}">
      </div>
      <div class="form-group">
        <label class="form-label">Contact</label>
        <input class="form-control" value="${c ? esc(c.first_name+' '+(c.last_name||'')) : ''}" disabled style="opacity:.7;">
      </div>
      <div class="form-group full">
        <label class="form-label">Notes / Description</label>
        <textarea id="ql_desc" class="form-control" rows="3" placeholder="What happened? Any details…"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveContactLog('${type}',${contactId})">Save</button>
    </div>`);
  setTimeout(() => document.getElementById('ql_title')?.focus(), 50);
};

window.saveContactLog = async function(type, contactId) {
  const title = document.getElementById('ql_title').value.trim();
  if (!title) { showToast('Title is required', 'error'); return; }
  const body = {
    type,
    title,
    due_date:    document.getElementById('ql_date').value || null,
    description: document.getElementById('ql_desc').value.trim(),
    contact_id:  contactId,
    completed:   true,
  };
  try {
    await api('/api/activities', { method: 'POST', body: JSON.stringify(body) });
    showToast(`${type.charAt(0).toUpperCase()+type.slice(1)} logged`);
    closeModal();
    delete State.contactCache[contactId];
    if (State.selectedContactId === contactId) selectContact(contactId);
  } catch(e) { showToast(e.message, 'error'); }
};

window.quickChangeLeadStatus = function(contactId, event) {
  const statuses = State.lists['lead_status'] || [];
  if (!statuses.length) return;
  const rect = event.target.closest('.split-status-chip').getBoundingClientRect();
  const existing = document.getElementById('_stage_popup');
  if (existing) existing.remove();
  const popup = document.createElement('div');
  popup.id = '_stage_popup';
  popup.style.cssText = `position:fixed;z-index:9999;background:white;border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:4px;min-width:140px;top:${rect.bottom+4}px;left:${rect.left}px;`;
  popup.innerHTML = statuses.map(s => `
    <div onclick="applyLeadStatus(${contactId},'${esc(s.value)}')" style="padding:7px 12px;cursor:pointer;font-size:13px;border-radius:5px;transition:background .15s;" onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background=''">
      ${esc(s.value)}
    </div>`).join('');
  document.body.appendChild(popup);
  const close = e => { if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', close); } };
  setTimeout(() => document.addEventListener('click', close), 10);
};

window.applyLeadStatus = async function(contactId, status) {
  document.getElementById('_stage_popup')?.remove();
  const c = State.contacts.find(x => x.id === contactId);
  if (!c) return;
  try {
    await api(`/api/contacts/${contactId}`, { method: 'PUT', body: JSON.stringify({ ...c, lead_status: status }) });
    delete State.contactCache[contactId];
    showToast(`Status → ${status}`);
    loadContacts();
  } catch(e) { showToast(e.message, 'error'); }
};

function mobileBackBtn(panelId) {
  if (window.innerWidth > 768) return '';
  return `<button class="mobile-back-btn" onclick="closeMobilePanel('${panelId}')"><i class="fas fa-arrow-left"></i> Back</button>`;
}
window.closeMobilePanel = function(panelId) {
  const dp = document.getElementById(panelId);
  if (dp) { dp.classList.remove('open'); dp.innerHTML = ''; }
};

function highlightContactRow(id) {
  document.querySelectorAll('#ct-list-panel .entity-card').forEach(r =>
    r.classList.toggle('selected', r.id === `ct-row-${id}`)
  );
}

window.selectContact = async function(id) {
  State.selectedContactId = id;
  if (State.currentPage !== 'contacts') navigateTo('contacts');
  highlightContactRow(id);
  const dp = document.getElementById('ct-detail-panel');
  if (!dp) return;
  dp.classList.add('open');
  if (State.contactCache[id]) {
    dp.innerHTML = renderContactDetailPanel(State.contactCache[id]);
    return;
  }
  dp.innerHTML = '<div class="spinner" style="padding:60px;"></div>';
  try {
    const data = await api(`/api/contacts/${id}`);
    if (!data) return;
    State.contactCache[id] = data;
    dp.innerHTML = renderContactDetailPanel(data);
  } catch(e) {
    dp.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load');
  }
};

function renderContactDetailPanel(data) {
  const name = `${data.first_name} ${data.last_name || ''}`.trim();
  return `<div class="detail-panel">
    ${mobileBackBtn('ct-detail-panel')}
    <div class="detail-panel-header">
      <div class="detail-avatar" style="background:${avatarColor(data.first_name)};border-radius:50%;">
        ${esc(data.first_name[0]||'?')}${esc((data.last_name||'')[0]||'')}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="detail-title">${esc(name)}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;">
          ${data.lead_status ? `<span class="badge badge-lead-status">${esc(data.lead_status)}</span>` : ''}
          ${data.title ? `<span class="badge" style="background:#f1f5f9;color:#475569;">${esc(data.title)}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap;">
        ${data.email ? `<button class="btn btn-sm btn-secondary" onclick="openEmailComposer(${data.id},'${esc(name)}','${esc(data.email)}')" title="Send Email"><i class="fas fa-envelope"></i></button>` : ''}
        ${State.currentUser?.role !== 'sales' ? `<button class="btn btn-sm btn-secondary" onclick="openMergeModal('contacts',${data.id},'${esc(name)}')" title="Merge duplicate"><i class="fas fa-compress-alt"></i></button>` : ''}
        <button class="btn btn-sm btn-secondary" onclick="printDetail()" title="Print / PDF"><i class="fas fa-print"></i></button>
        <button class="btn btn-sm btn-secondary" onclick="openContactForm(${data.id})" title="Edit"><i class="fas fa-pen"></i></button>
        <button class="btn btn-sm" style="background:var(--danger-light);color:var(--danger);border:1px solid var(--danger-light);" onclick="deleteContact(${data.id})" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    </div>
    <div class="dp-fields-grid">
      ${dpField('fa-building','Company', data.company_name)}
      <div class="dp-field"><i class="fas fa-phone"></i><div><div style="font-size:10px;color:var(--text-light);text-transform:uppercase;letter-spacing:.03em;">Phone</div><div class="dp-field-val">${phoneLink(data.phone)}</div></div></div>
      ${dpField('fa-envelope','Email', data.email)}
      ${dpField('fa-share-alt','Source', data.source)}
    </div>
    ${data.notes ? `<div class="dp-notes"><i class="fas fa-sticky-note" style="margin-right:6px;"></i>${esc(data.notes)}</div>` : ''}
    ${data.deals.length ? `<div class="dp-section">
      <div class="dp-section-header"><i class="fas fa-handshake"></i> Deals <span class="dp-count">${data.deals.length}</span></div>
      <div>${data.deals.map(d=>`
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
          <span class="badge badge-${d.stage}">${esc(STAGE_LABELS[d.stage]||d.stage)}</span>
          <div style="flex:1;font-size:13px;">${esc(d.title)}</div>
          <div style="font-weight:600;color:var(--primary);font-size:13px;">${fmtMoney(d.value)}</div>
        </div>`).join('')}</div>
    </div>` : ''}
    <div class="dp-section">
      <div class="dp-section-header">
        <i class="fas fa-calendar-check"></i> Activities <span class="dp-count">${data.activities.length}</span>
        <button class="btn btn-sm btn-primary" style="margin-left:auto;" onclick="quickLogActivity('contact',${data.id})">
          <i class="fas fa-plus"></i> Log
        </button>
      </div>
      ${renderTimeline(data.activities, 'contact', data.id)}
    </div>
  </div>`;
}

function openContactForm(id) {
  const contact = id ? State.contacts.find(c => c.id === id) : null;
  const title = contact ? 'Edit Contact' : 'Add Contact';
  const companyOptions = State.companies.map(co =>
    `<option value="${co.id}" ${contact?.company_id === co.id ? 'selected' : ''}>${esc(co.name)}</option>`
  ).join('');

  openModal(title, `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">First Name *</label>
        <input id="cf_first" class="form-control" value="${esc(contact?.first_name || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Last Name *</label>
        <input id="cf_last" class="form-control" value="${esc(contact?.last_name || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input id="cf_email" class="form-control" type="email" value="${esc(contact?.email || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input id="cf_phone" class="form-control" value="${esc(contact?.phone || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Title / Role</label>
        <input id="cf_title" class="form-control" list="dl_contact_title" value="${esc(contact?.title || '')}">
        <datalist id="dl_contact_title">${listOptions('contact_title')}</datalist>
      </div>
      <div class="form-group">
        <label class="form-label">Lead Status</label>
        <select id="cf_lead_status" class="form-control">
          <option value="">— Select —</option>
          ${listOptions('lead_status', contact?.lead_status || '')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <select id="cf_company" class="form-control">
          <option value="">— None —</option>
          ${companyOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Source</label>
        <input id="cf_source" class="form-control" list="dl_source" value="${esc(contact?.source || '')}">
        <datalist id="dl_source">${listOptions('source')}</datalist>
      </div>
      <div class="form-group full">
        <label class="form-label">Notes</label>
        <textarea id="cf_notes" class="form-control">${esc(contact?.notes || '')}</textarea>
      </div>
      ${!id ? renderCustomFieldInputs('contact', []) : ''}
    </div>
    <div id="ct-dup-warn"></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveContact(${id || 'null'})">Save</button>
    </div>`);
  // Wire duplicate check
  if (!id) {
    const phoneEl = document.getElementById('cf_phone');
    const emailEl = document.getElementById('cf_email');
    if (phoneEl) phoneEl.addEventListener('blur', () => scheduleDupCheck('contacts', {phone: phoneEl.value?.trim()}, 'ct-dup-warn'));
    if (emailEl) emailEl.addEventListener('blur', () => scheduleDupCheck('contacts', {email: emailEl.value?.trim()}, 'ct-dup-warn'));
  }
}

window.saveContact = async function (id) {
  const body = {
    first_name:  document.getElementById('cf_first').value.trim(),
    last_name:   document.getElementById('cf_last').value.trim(),
    email:       document.getElementById('cf_email').value.trim(),
    phone:       document.getElementById('cf_phone').value.trim(),
    title:       document.getElementById('cf_title').value.trim(),
    status:      'active',
    lead_status: document.getElementById('cf_lead_status').value || null,
    company_id:  document.getElementById('cf_company').value || null,
    source:      document.getElementById('cf_source').value.trim(),
    notes:       document.getElementById('cf_notes').value.trim(),
  };
  if (!body.first_name || !body.last_name) { showToast('First and last name are required', 'error'); return; }
  try {
    if (id) {
      await api(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      delete State.contactCache[id];
      showToast('Contact updated');
      closeModal();
      loadContacts();
    } else {
      const created = await api('/api/contacts', { method: 'POST', body: JSON.stringify(body) });
      if (created?.id) await saveCustomValues('contact', created.id);
      showToast('Contact added');
      closeModal();
      loadContacts();
    }
  } catch (e) { showToast(e.message, 'error'); }
};

window.deleteContact = function (id) {
  const c = State.contacts.find(x => x.id === id);
  confirmDialog(`Delete ${c?.first_name} ${c?.last_name}?`, 'This action cannot be undone.', async () => {
    try {
      await api(`/api/contacts/${id}`, { method: 'DELETE' });
      delete State.contactCache[id];
      if (State.selectedContactId === id) {
        State.selectedContactId = null;
        const dp = document.getElementById('ct-detail-panel');
        if (dp) dp.innerHTML = '<div class="split-empty"><i class="fas fa-user"></i><p>Select a contact</p></div>';
      }
      showToast('Contact deleted');
      loadContacts();
    } catch (e) { showToast(e.message, 'error'); }
  });
};

/* ============================================================
   COMPANIES — split view
   ============================================================ */
async function loadCompanies() {
  const listPanel = document.getElementById('co-list-panel');
  if (listPanel) listPanel.innerHTML = '<div class="spinner"></div>';
  try {
    const search = document.getElementById('companySearch').value;
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    State.companies = await api('/api/companies' + params) || [];
    // Populate status filter
    populateStatusFilter('companyStatusFilter', State.lists['company_status'] || []);
    filterCompanies();
  } catch (e) {
    const lp = document.getElementById('co-list-panel');
    if (lp) lp.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load');
  }
}

const searchCompanies = debounce(filterCompanies, 200);

function populateStatusFilter(selectId, items) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Status</option>' +
    items.map(i => `<option value="${esc(i.value)}" ${cur===i.value?'selected':''}>${esc(i.value)}</option>`).join('');
}

function filterCompanies() {
  State.companyStatusFilter = document.getElementById('companyStatusFilter')?.value || '';
  const search = document.getElementById('companySearch')?.value.toLowerCase().trim() || '';
  let filtered = State.companies;
  if (State.companyStatusFilter) filtered = filtered.filter(c => c.status === State.companyStatusFilter);
  if (search) filtered = filtered.filter(c =>
    (c.name||'').toLowerCase().includes(search) ||
    (c.industry||'').toLowerCase().includes(search) ||
    (c.city||'').toLowerCase().includes(search) ||
    (c.custom_id||'').toLowerCase().includes(search)
  );
  document.getElementById('companies-count').textContent =
    `${filtered.length} compan${filtered.length !== 1 ? 'ies' : 'y'}`;
  renderCompanyList(filtered);
  if (State.selectedCompanyId && !filtered.find(c => c.id === State.selectedCompanyId)) {
    State.selectedCompanyId = null;
    const dp = document.getElementById('co-detail-panel');
    if (dp) { dp.classList.remove('open'); dp.innerHTML = '<div class="split-empty"><i class="fas fa-building"></i><p>Select a company</p></div>'; }
  } else if (State.selectedCompanyId) {
    highlightCompanyRow(State.selectedCompanyId);
    // If detail panel is open but cache was cleared (after an edit), re-fetch and re-render
    const dp = document.getElementById('co-detail-panel');
    if (dp && dp.classList.contains('open') && !State.companyCache[State.selectedCompanyId]) {
      openCompanyDetail(State.selectedCompanyId);
    }
  }
}

function renderCompanyList(companies) {
  const panel = document.getElementById('co-list-panel');
  if (!panel) return;
  if (!companies.length) {
    panel.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px;">
      <i class="fas fa-building" style="font-size:32px;opacity:.2;display:block;margin-bottom:10px;"></i>No companies found</div>`;
    return;
  }
  const coBulkBar = document.getElementById('co-bulk-bar');
  if (coBulkBar) { State.bulkCompanies = []; renderBulkBar('companies'); }
  panel.innerHTML = `
    <div class="select-all-bar" id="co-select-all-bar">
      <label class="select-all-label">
        <input type="checkbox" id="co-select-all-cb" onclick="selectAllBulk('companies',this.checked)">
        <span id="co-select-all-text">Select all (${companies.length})</span>
      </label>
    </div>
    <div class="cards-grid">${companies.map(co => {
    const sc = statusColor(co.status);
    const isSelected = State.selectedCompanyId === co.id;
    return `<div class="entity-card ${isSelected?'selected':''}" id="co-row-${co.id}" onclick="selectCompany(${co.id})"
      style="${co.status && !isSelected ? `border-left:4px solid ${sc};` : isSelected ? 'border-left:4px solid var(--primary);' : ''}">
      <input type="checkbox" class="bulk-check" data-id="${co.id}" onclick="event.stopPropagation();toggleBulk('companies',${co.id},this.checked)" title="Select">
      <div class="entity-card-top">
        <div class="entity-card-avatar" style="background:${avatarColor(co.name)};border-radius:8px;">${esc(co.name.slice(0,2).toUpperCase())}</div>
        <div style="flex:1;min-width:0;">
          <div class="entity-card-name">${esc(co.name)}</div>
          <div class="entity-card-sub">${esc(co.industry||'—')}</div>
        </div>
      </div>
      ${co.city ? `<div class="entity-card-meta"><i class="fas fa-map-marker-alt" style="font-size:9px;"></i>${esc(co.city)}</div>` : ''}
      ${co.custom_id ? `<div class="entity-card-meta"><i class="fas fa-hashtag" style="font-size:9px;"></i>${esc(co.custom_id)}</div>` : ''}
      <div class="entity-card-footer">
        ${co.status ? `<span class="split-status-chip" style="background:${sc}18;color:${sc};border:1px solid ${sc}38;font-size:10px;">${esc(co.status)}</span>` : '<span></span>'}
        <div style="display:flex;gap:6px;align-items:center;font-size:11px;color:var(--text-muted);">
          ${co.contact_count > 0 ? `<span><i class="fas fa-users" style="font-size:9px;"></i> ${co.contact_count}</span>` : ''}
          ${co.deal_count > 0 ? `<span><i class="fas fa-handshake" style="font-size:9px;"></i> ${co.deal_count}</span>` : ''}
          ${co.owner_name ? `<span style="margin-left:auto;background:#f1f5f9;border:1px solid var(--border);border-radius:10px;padding:1px 7px;font-size:10px;color:#475569;"><i class="fas fa-user" style="font-size:9px;"></i> ${esc(co.owner_name)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function statusChipClass(status) {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s.includes('hot') || s.includes('vip')) return 'hot';
  if (s.includes('vip')) return 'vip';
  if (s.includes('cold')) return 'cold';
  if (s.includes('done') || s.includes('customer')) return 'done';
  return '';
}

function highlightCompanyRow(id) {
  document.querySelectorAll('#co-list-panel .entity-card').forEach(r =>
    r.classList.toggle('selected', r.id === `co-row-${id}`)
  );
}

window.selectCompany = async function(id) {
  State.selectedCompanyId = id;
  highlightCompanyRow(id);
  const dp = document.getElementById('co-detail-panel');
  if (!dp) return;
  dp.classList.add('open');
  if (State.companyCache[id]) {
    dp.innerHTML = renderCompanyDetailPanel(State.companyCache[id]);
    return;
  }
  dp.innerHTML = '<div class="spinner" style="padding:60px;"></div>';
  try {
    const data = await api(`/api/companies/${id}`);
    if (!data) return;
    State.companyCache[id] = data;
    dp.innerHTML = renderCompanyDetailPanel(data);
  } catch(e) {
    dp.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load');
  }
};

function dpField(icon, label, val) {
  if (!val) return '';
  return `<div class="dp-field"><i class="fas ${icon}"></i><div><div style="font-size:10px;color:var(--text-light);text-transform:uppercase;letter-spacing:.03em;">${label}</div><div class="dp-field-val">${esc(String(val))}</div></div></div>`;
}

function renderCompanyDetailPanel(data) {
  const pipeline = data.deals.filter(d => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + (d.value || 0), 0);
  const wonRev   = data.deals.filter(d => d.stage === 'won').reduce((s, d) => s + (d.value || 0), 0);
  const sc = statusColor(data.status);

  return `<div class="detail-panel co-hub">
    ${mobileBackBtn('co-detail-panel')}

    <!-- Header -->
    <div class="co-hub-header" style="border-left:4px solid ${sc};">
      <div class="detail-avatar" style="background:${avatarColor(data.name)};border-radius:10px;width:46px;height:46px;font-size:15px;flex-shrink:0;">
        ${esc(data.name.slice(0, 2).toUpperCase())}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="detail-title" style="font-size:17px;">${esc(data.name)}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;">
          ${data.status    ? `<span class="badge" style="background:${sc}18;color:${sc};border:1px solid ${sc}38;">${esc(data.status)}</span>` : ''}
          ${data.category  ? `<span class="badge" style="background:#f3e8ff;color:#6b21a8;">${esc(data.category)}</span>` : ''}
          ${data.folder    ? `<span class="badge" style="background:#fef9c3;color:#854d0e;"><i class="fas fa-folder" style="font-size:9px;"></i> ${esc(data.folder)}</span>` : ''}
          ${data.custom_id ? `<span class="badge" style="background:#f1f5f9;color:#475569;">#${esc(data.custom_id)}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap;">
        ${State.currentUser?.role !== 'sales' ? `<button class="btn btn-sm btn-secondary" onclick="openMergeModal('companies',${data.id},'${esc(data.name)}')" title="Merge duplicate"><i class="fas fa-compress-alt"></i></button>` : ''}
        <button class="btn btn-sm btn-secondary" onclick="printDetail()" title="Print / PDF"><i class="fas fa-print"></i></button>
        <button class="btn btn-sm btn-secondary" onclick="openCompanyForm(${data.id})" title="Edit"><i class="fas fa-pen"></i></button>
        <button class="btn btn-sm" style="background:var(--danger-light);color:var(--danger);border:1px solid var(--danger-light);" onclick="deleteCompany(${data.id})" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    </div>

    <!-- Quick stats bar -->
    <div class="co-hub-stats">
      ${data.industry ? `<div class="co-hub-stat"><i class="fas fa-industry"></i>${esc(data.industry)}</div>` : ''}
      ${data.city     ? `<div class="co-hub-stat"><i class="fas fa-map-marker-alt"></i>${esc(data.city)}</div>` : ''}
      ${data.phone    ? `<div class="co-hub-stat co-hub-phone" onclick="openWhatsApp('${data.phone.replace(/\D/g,'')}')"><i class="fab fa-whatsapp" style="color:#25d366;"></i>${esc(data.phone)}</div>` : ''}
      ${data.website  ? `<div class="co-hub-stat"><a href="${esc(data.website.startsWith('http')?data.website:'https://'+data.website)}" target="_blank" style="color:var(--primary);text-decoration:none;"><i class="fas fa-globe"></i>${esc(data.website)}</a></div>` : ''}
      <div class="co-hub-stat"><i class="fas fa-funnel-dollar" style="color:var(--primary);"></i><strong>${fmtMoney(pipeline)}</strong> pipeline</div>
      ${wonRev > 0 ? `<div class="co-hub-stat"><i class="fas fa-trophy" style="color:#10b981;"></i><strong>${fmtMoney(wonRev)}</strong> won</div>` : ''}
    </div>

    ${data.notes ? `<div class="dp-notes"><i class="fas fa-sticky-note" style="margin-right:6px;color:var(--warning);"></i>${esc(data.notes)}</div>` : ''}

    <!-- Tabs -->
    <div class="co-hub-tabs" id="co-hub-tabs-${data.id}">
      <button class="co-tab active" onclick="switchCoTab(${data.id},'contacts')">
        <i class="fas fa-users"></i> Contacts <span class="co-tab-count">${data.contacts.length}</span>
      </button>
      <button class="co-tab" onclick="switchCoTab(${data.id},'deals')">
        <i class="fas fa-handshake"></i> Deals <span class="co-tab-count">${data.deals.length}</span>
      </button>
      <button class="co-tab" onclick="switchCoTab(${data.id},'activities')">
        <i class="fas fa-bolt"></i> Activities <span class="co-tab-count">${data.activities.length}</span>
      </button>
      ${State.currentUser?.role !== 'sales' ? `<button class="co-tab manager-tab" onclick="switchCoTab(${data.id},'team')">
        <i class="fas fa-user-shield"></i> Team <span class="co-tab-count">${(data.teamTasks||[]).length}</span>
      </button>` : ''}
    </div>

    <!-- Contacts Tab -->
    <div class="co-tab-pane active" id="co-tab-contacts-${data.id}">
      <div class="co-tab-toolbar">
        <button class="btn btn-sm btn-primary" onclick="openContactFormForCompany(${data.id})">
          <i class="fas fa-plus"></i> Add Contact
        </button>
      </div>
      ${data.contacts.length ? data.contacts.map(c => renderContactInCompany(c, data.id)).join('') : `
        <div class="co-empty"><i class="fas fa-users"></i><p>No contacts yet</p>
        <button class="btn btn-primary" onclick="openContactFormForCompany(${data.id})"><i class="fas fa-plus"></i> Add First Contact</button></div>`}
    </div>

    <!-- Deals Tab -->
    <div class="co-tab-pane" id="co-tab-deals-${data.id}">
      <div class="co-tab-toolbar">
        <button class="btn btn-sm btn-primary" onclick="openDealFormForCompany(${data.id})">
          <i class="fas fa-plus"></i> Add Deal
        </button>
      </div>
      ${data.deals.length ? data.deals.map(d => renderDealInCompany(d, data.id)).join('') : `
        <div class="co-empty"><i class="fas fa-handshake"></i><p>No deals yet</p>
        <button class="btn btn-primary" onclick="openDealFormForCompany(${data.id})"><i class="fas fa-plus"></i> Add First Deal</button></div>`}
    </div>

    <!-- Team Tab (manager/team_leader only) -->
    ${State.currentUser?.role !== 'sales' ? `
    <div class="co-tab-pane" id="co-tab-team-${data.id}">
      <!-- Owner assignment -->
      <div class="team-owner-box">
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;"><i class="fas fa-user-tie"></i> Account Owner</div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div class="co-contact-avatar" style="background:${data.user_id ? avatarColor(data.owner_name||'?') : '#94a3b8'};width:34px;height:34px;font-size:12px;">
            ${data.owner_name ? esc(data.owner_name.slice(0,2).toUpperCase()) : '?'}
          </div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;">${esc(data.owner_name||'Unassigned')}</div>
            <div style="font-size:11px;color:var(--text-muted);">Responsible for this account</div>
          </div>
          <select id="assign-user-${data.id}" class="form-control" style="max-width:150px;height:34px;font-size:12px;">
            <option value="">— Unassigned —</option>
            ${(State.currentUser?.role === 'team_leader' ? State.teamMembers : (State.users||[])).map(u => `<option value="${u.id}" ${u.id===data.user_id?'selected':''}>${esc(u.name)}${State.currentUser?.role !== 'team_leader' ? ` (${u.role})` : ''}</option>`).join('')}
          </select>
          <button class="btn btn-sm btn-primary" onclick="assignCompanyOwner(${data.id})">Assign</button>
        </div>
      </div>

      <!-- Assign task to team member -->
      <div class="co-tab-toolbar" style="margin-top:12px;">
        <button class="btn btn-sm btn-primary" onclick="openAssignTaskForm(${data.id})">
          <i class="fas fa-plus"></i> Assign Task to Team
        </button>
      </div>

      <!-- Team tasks list -->
      <div id="co-team-tasks-${data.id}">
        ${renderTeamTasks(data.teamTasks||[], data.id)}
      </div>
    </div>` : ''}

    <!-- Activities Tab -->
    <div class="co-tab-pane" id="co-tab-activities-${data.id}">
      <div class="co-tab-toolbar" style="gap:8px;">
        <button class="btn btn-sm btn-primary" onclick="quickLogActivity('company',${data.id})">
          <i class="fas fa-plus"></i> Log Activity
        </button>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          ${['all','call','visit','email','meeting','note'].map(t =>
            `<button class="act-filter-btn ${t==='all'?'active':''}" data-type="${t}" onclick="filterCoActivities(${data.id},'${t}')">
              ${t === 'all' ? 'All' : t.charAt(0).toUpperCase()+t.slice(1)}
            </button>`).join('')}
        </div>
      </div>
      <div id="co-activity-list-${data.id}">
        ${renderCoActivityList(data.activities, data.id)}
      </div>
    </div>
  </div>`;
}

function renderContactInCompany(c, companyId) {
  const phone = c.phone ? c.phone.replace(/\D/g, '') : '';
  const sc = c.lead_status ? (STATUS_COLORS[c.lead_status.toLowerCase()] || '#6b7280') : null;
  return `<div class="co-contact-card" id="co-contact-${c.id}">
    <div class="co-contact-top">
      <div class="co-contact-avatar" style="background:${avatarColor(c.first_name)}">
        ${esc(c.first_name[0]||'?')}${esc((c.last_name||'')[0]||'')}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="co-contact-name">${esc(c.first_name)} ${esc(c.last_name||'')}</div>
        <div class="co-contact-title">${esc(c.title||'—')}</div>
      </div>
      ${sc ? `<span class="co-contact-status" style="background:${sc}18;color:${sc};border:1px solid ${sc}38;" onclick="quickChangeLeadStatusInCompany(${c.id},${companyId},event)">
        ${esc(c.lead_status)} <i class="fas fa-chevron-down" style="font-size:8px;"></i>
      </span>` : `<button class="co-contact-status-add" onclick="quickChangeLeadStatusInCompany(${c.id},${companyId},event)">
        <i class="fas fa-tag"></i> Status
      </button>`}
    </div>
    <div class="co-contact-info">
      ${c.phone  ? `<span><i class="fas fa-phone"></i>${esc(c.phone)}</span>` : ''}
      ${c.email  ? `<span><i class="fas fa-envelope"></i>${esc(c.email)}</span>` : ''}
      ${c.source ? `<span><i class="fas fa-share-alt"></i>${esc(c.source)}</span>` : ''}
    </div>
    <div class="co-contact-actions">
      ${c.phone ? `<button class="co-act-btn whatsapp" onclick="openWhatsApp('${phone}')" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>` : ''}
      <button class="co-act-btn call"  onclick="quickLogForContactInCompany('call',${c.id},${companyId})"  title="Log Call"><i class="fas fa-phone"></i></button>
      <button class="co-act-btn visit" onclick="quickLogForContactInCompany('visit',${c.id},${companyId})" title="Log Visit"><i class="fas fa-map-marker-alt"></i></button>
      <button class="co-act-btn email" onclick="quickLogForContactInCompany('email',${c.id},${companyId})" title="Log Email"><i class="fas fa-envelope"></i></button>
      <button class="co-act-btn note"  onclick="quickLogForContactInCompany('note',${c.id},${companyId})"  title="Add Note"><i class="fas fa-sticky-note"></i></button>
      <div style="flex:1;"></div>
      <button class="co-act-btn edit"  onclick="openContactFormInCompany(${c.id},${companyId})" title="Edit"><i class="fas fa-pen"></i></button>
      <button class="co-act-btn del"   onclick="deleteContactInCompany(${c.id},${companyId})"   title="Delete"><i class="fas fa-trash"></i></button>
    </div>
  </div>`;
}

function renderDealInCompany(d, companyId) {
  const sc = STAGE_COLORS[d.stage] || '#6b7280';
  return `<div class="co-deal-row">
    <div class="co-deal-stage-dot" style="background:${sc};"></div>
    <div style="flex:1;min-width:0;">
      <div class="co-deal-title">${esc(d.title)}</div>
      <div class="co-deal-meta">
        <span style="background:${sc}18;color:${sc};border:1px solid ${sc}38;" class="badge">${STAGE_LABELS[d.stage]||d.stage}</span>
        ${d.close_date ? `<span style="font-size:11px;color:var(--text-muted);"><i class="fas fa-calendar" style="font-size:9px;"></i> ${fmtDate(d.close_date)}</span>` : ''}
        ${d.owner_name ? `<span style="font-size:11px;color:var(--text-muted);"><i class="fas fa-user" style="font-size:9px;"></i> ${esc(d.owner_name)}</span>` : ''}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div class="co-deal-value">${fmtMoney(d.value)}</div>
      <div style="display:flex;gap:4px;margin-top:4px;">
        <button class="co-act-btn edit" onclick="openDealForm(${d.id})" title="Edit"><i class="fas fa-pen"></i></button>
        <button class="co-act-btn del"  onclick="deleteDealInCompany(${d.id},${companyId})" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  </div>`;
}

function renderCoActivityList(activities, companyId, typeFilter) {
  const filtered = typeFilter && typeFilter !== 'all'
    ? activities.filter(a => a.type === typeFilter)
    : activities;
  if (!filtered.length) return `<div style="padding:30px;text-align:center;color:var(--text-muted);font-size:13px;"><i class="fas fa-bolt" style="font-size:24px;display:block;margin-bottom:8px;opacity:.3;"></i>No activities yet</div>`;

  // Group by date
  const groups = {};
  filtered.forEach(a => {
    const d = new Date(a.created_at);
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
    const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
    let label;
    if (dayStart >= today) label = 'Today';
    else if (dayStart >= yesterday) label = 'Yesterday';
    else label = d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(a);
  });

  return Object.entries(groups).map(([date, acts]) => `
    <div class="tl-date-group">
      <div class="tl-date-label"><span>${date}</span></div>
      <div class="tl-entries">
        ${acts.map(a => {
          const overdue = !a.completed && a.due_date && new Date(a.due_date) < new Date();
          return `<div class="tl-entry ${a.completed?'tl-done':''}">
            <div class="tl-dot type-${a.type}"><i class="fas ${TYPE_ICONS[a.type]||'fa-circle'}"></i></div>
            <div class="tl-content">
              <div class="tl-entry-title">${esc(a.title)}</div>
              <div class="tl-entry-meta">
                ${a.user_name ? `<span><i class="fas fa-user-circle"></i>${esc(a.user_name)}</span>` : ''}
                ${a.contact_name ? `<span><i class="fas fa-user"></i>${esc(a.contact_name)}</span>` : ''}
                ${a.due_date ? `<span class="${overdue?'tl-overdue':''}"><i class="fas fa-clock"></i>${fmtDate(a.due_date)}</span>` : ''}
              </div>
              ${a.description ? `<div class="tl-entry-desc">${esc(a.description)}</div>` : ''}
            </div>
            <div class="tl-actions">
              <span class="tl-time">${new Date(a.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>
              ${!a.completed
                ? `<button class="co-act-btn" style="color:var(--success);border-color:var(--success-light);width:26px;height:26px;" onclick="completeActivityInCompany(${a.id},${companyId})" title="Mark done"><i class="fas fa-check"></i></button>`
                : `<span style="color:var(--success);font-size:11px;"><i class="fas fa-check-circle"></i></span>`}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');
}

window.switchCoTab = function(companyId, tab) {
  const tabs = document.querySelectorAll(`#co-hub-tabs-${companyId} .co-tab`);
  const panes = document.querySelectorAll(`#co-tab-contacts-${companyId},#co-tab-deals-${companyId},#co-tab-activities-${companyId}`);
  tabs.forEach(t => t.classList.remove('active'));
  panes.forEach(p => p.classList.remove('active'));
  const idx = ['contacts','deals','activities'].indexOf(tab);
  if (tabs[idx]) tabs[idx].classList.add('active');
  const pane = document.getElementById(`co-tab-${tab}-${companyId}`);
  if (pane) pane.classList.add('active');
};

window.filterCoActivities = function(companyId, type) {
  const bar = document.getElementById(`co-hub-tabs-${companyId}`)?.closest('.co-hub');
  if (bar) bar.querySelectorAll('.act-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  const cached = State.companyCache[companyId];
  if (!cached) return;
  const el = document.getElementById(`co-activity-list-${companyId}`);
  if (el) el.innerHTML = renderCoActivityList(cached.activities, companyId, type);
};

window.openContactFormForCompany = function(companyId) {
  const co = State.companies.find(c => c.id === companyId);
  openModal('Add Contact', `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">First Name *</label>
        <input id="ctf_first" class="form-control" placeholder="First name">
      </div>
      <div class="form-group">
        <label class="form-label">Last Name</label>
        <input id="ctf_last" class="form-control" placeholder="Last name">
      </div>
      <div class="form-group">
        <label class="form-label">Title / Role</label>
        <input id="ctf_title" class="form-control" list="dl_ctitle" placeholder="e.g. Owner, Engineer">
        <datalist id="dl_ctitle">${listOptions('contact_title')}</datalist>
      </div>
      <div class="form-group">
        <label class="form-label">Lead Status</label>
        <select id="ctf_lstatus" class="form-control">
          <option value="">— Select —</option>${listOptions('lead_status')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input id="ctf_phone" class="form-control" type="tel">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input id="ctf_email" class="form-control" type="email">
      </div>
      <div class="form-group">
        <label class="form-label">Source</label>
        <select id="ctf_source" class="form-control">
          <option value="">— Select —</option>${listOptions('source')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <input class="form-control" value="${esc(co?.name||'')}" disabled>
      </div>
      <div class="form-group full">
        <label class="form-label">Notes</label>
        <textarea id="ctf_notes" class="form-control" rows="2"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveContactForCompany(${companyId})">Save</button>
    </div>`);
  setTimeout(() => document.getElementById('ctf_first')?.focus(), 50);
};

window.saveContactForCompany = async function(companyId) {
  const first = document.getElementById('ctf_first').value.trim();
  if (!first) { showToast('First name is required', 'error'); return; }
  const body = {
    first_name:  first,
    last_name:   document.getElementById('ctf_last').value.trim(),
    title:       document.getElementById('ctf_title').value.trim() || null,
    lead_status: document.getElementById('ctf_lstatus').value || null,
    phone:       document.getElementById('ctf_phone').value.trim() || null,
    email:       document.getElementById('ctf_email').value.trim() || null,
    source:      document.getElementById('ctf_source').value || null,
    notes:       document.getElementById('ctf_notes').value.trim() || null,
    company_id:  companyId,
  };
  try {
    await api('/api/contacts', { method: 'POST', body: JSON.stringify(body) });
    showToast('Contact added');
    closeModal();
    delete State.companyCache[companyId];
    await selectCompany(companyId);
  } catch(e) { showToast(e.message, 'error'); }
};

window.openContactFormInCompany = function(contactId, companyId) {
  const c = State.companyCache[companyId]?.contacts?.find(x => x.id === contactId);
  if (!c) return;
  openModal('Edit Contact', `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">First Name *</label>
        <input id="ctf_first" class="form-control" value="${esc(c.first_name)}">
      </div>
      <div class="form-group">
        <label class="form-label">Last Name</label>
        <input id="ctf_last" class="form-control" value="${esc(c.last_name||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Title / Role</label>
        <input id="ctf_title" class="form-control" list="dl_ctitle2" value="${esc(c.title||'')}">
        <datalist id="dl_ctitle2">${listOptions('contact_title')}</datalist>
      </div>
      <div class="form-group">
        <label class="form-label">Lead Status</label>
        <select id="ctf_lstatus" class="form-control">
          <option value="">— Select —</option>${listOptions('lead_status', c.lead_status||'')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input id="ctf_phone" class="form-control" value="${esc(c.phone||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input id="ctf_email" class="form-control" value="${esc(c.email||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Source</label>
        <select id="ctf_source" class="form-control">
          <option value="">— Select —</option>${listOptions('source', c.source||'')}
        </select>
      </div>
      <div class="form-group full">
        <label class="form-label">Notes</label>
        <textarea id="ctf_notes" class="form-control" rows="2">${esc(c.notes||'')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="updateContactInCompany(${contactId},${companyId})">Save</button>
    </div>`);
};

window.updateContactInCompany = async function(contactId, companyId) {
  const first = document.getElementById('ctf_first').value.trim();
  if (!first) { showToast('First name is required', 'error'); return; }
  const body = {
    first_name:  first,
    last_name:   document.getElementById('ctf_last').value.trim(),
    title:       document.getElementById('ctf_title').value.trim() || null,
    lead_status: document.getElementById('ctf_lstatus').value || null,
    phone:       document.getElementById('ctf_phone').value.trim() || null,
    email:       document.getElementById('ctf_email').value.trim() || null,
    source:      document.getElementById('ctf_source').value || null,
    notes:       document.getElementById('ctf_notes').value.trim() || null,
    company_id:  companyId,
  };
  try {
    await api(`/api/contacts/${contactId}`, { method: 'PUT', body: JSON.stringify(body) });
    showToast('Contact updated');
    closeModal();
    delete State.companyCache[companyId];
    await selectCompany(companyId);
  } catch(e) { showToast(e.message, 'error'); }
};

window.deleteContactInCompany = function(contactId, companyId) {
  const cached = State.companyCache[companyId];
  const c = cached?.contacts?.find(x => x.id === contactId);
  confirmDialog(`Delete ${c?.first_name||'contact'}?`, 'This will remove the contact permanently.', async () => {
    try {
      await api(`/api/contacts/${contactId}`, { method: 'DELETE' });
      showToast('Contact deleted');
      delete State.companyCache[companyId];
      await selectCompany(companyId);
    } catch(e) { showToast(e.message, 'error'); }
  });
};

window.quickLogForContactInCompany = function(type, contactId, companyId) {
  const cached = State.companyCache[companyId];
  const c = cached?.contacts?.find(x => x.id === contactId);
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  openModal(`Log ${label} — ${c?.first_name||''}`, `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Title *</label>
        <input id="ql_title" class="form-control" value="${label} with ${esc(c?.first_name||'')}">
      </div>
      <div class="form-group full">
        <label class="form-label">Notes</label>
        <textarea id="ql_desc" class="form-control" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="ql_due" class="form-control" type="datetime-local">
      </div>
      <div class="form-group">
        <label class="form-label"><i class="fas fa-bell" style="color:var(--warning);margin-right:4px;"></i>Reminder</label>
        <input id="ql_reminder" class="form-control" type="datetime-local">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveQuickActivityInCompany('${type}',${contactId},${companyId})">Save</button>
    </div>`);
  setTimeout(() => document.getElementById('ql_title')?.focus(), 50);
};

window.saveQuickActivityInCompany = async function(type, contactId, companyId) {
  const title = document.getElementById('ql_title').value.trim();
  if (!title) { showToast('Title required', 'error'); return; }
  const body = {
    type, title,
    description: document.getElementById('ql_desc').value.trim() || null,
    due_date:    document.getElementById('ql_due').value || null,
    reminder_at: document.getElementById('ql_reminder').value || null,
    contact_id:  contactId,
    company_id:  companyId,
    completed:   false,
  };
  try {
    await api('/api/activities', { method: 'POST', body: JSON.stringify(body) });
    showToast(`${type.charAt(0).toUpperCase()+type.slice(1)} logged`);
    closeModal();
    delete State.companyCache[companyId];
    await selectCompany(companyId);
    switchCoTab(companyId, 'activities');
  } catch(e) { showToast(e.message, 'error'); }
};

window.quickChangeLeadStatusInCompany = function(contactId, companyId, event) {
  event.stopPropagation();
  const cached = State.companyCache[companyId];
  const c = cached?.contacts?.find(x => x.id === contactId);
  const items = State.lists['lead_status'] || [];
  if (!items.length) { showToast('No lead statuses configured', 'error'); return; }
  const opts = items.map(i =>
    `<div class="status-menu-item" onclick="setLeadStatusInCompany(${contactId},${companyId},'${i.value.replace(/'/g,"\\'")}')">
      <span class="status-dot" style="background:${STATUS_COLORS[i.value.toLowerCase()]||'#6b7280'};"></span>${esc(i.value)}
    </div>`).join('');
  const menu = document.createElement('div');
  menu.className = 'status-menu';
  menu.innerHTML = opts;
  document.body.appendChild(menu);
  const rect = event.target.closest('span,button').getBoundingClientRect();
  menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  menu.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';
  const remove = () => { menu.remove(); document.removeEventListener('click', remove); };
  setTimeout(() => document.addEventListener('click', remove), 0);
};

window.setLeadStatusInCompany = async function(contactId, companyId, status) {
  const cached = State.companyCache[companyId];
  const c = cached?.contacts?.find(x => x.id === contactId);
  if (!c) return;
  try {
    await api(`/api/contacts/${contactId}`, { method: 'PUT', body: JSON.stringify({ ...c, lead_status: status, company_id: companyId }) });
    showToast('Status updated');
    delete State.companyCache[companyId];
    await selectCompany(companyId);
  } catch(e) { showToast(e.message, 'error'); }
};

window.openDealFormForCompany = function(companyId) {
  const co = State.companies.find(c => c.id === companyId);
  openModal('Add Deal', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Deal Title *</label>
        <input id="dlf_title" class="form-control" placeholder="e.g. RO System Supply">
      </div>
      <div class="form-group">
        <label class="form-label">Stage</label>
        <select id="dlf_stage" class="form-control">
          ${STAGES.map(s => `<option value="${s}" ${s==='lead'?'selected':''}>${STAGE_LABELS[s]}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Value (${esc(State.settings?.currency_symbol || 'EGP')})</label>
        <input id="dlf_value" class="form-control" type="number" min="0" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">Close Date</label>
        <input id="dlf_close" class="form-control" type="date">
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <input class="form-control" value="${esc(co?.name||'')}" disabled>
      </div>
      <div class="form-group full">
        <label class="form-label">Notes</label>
        <textarea id="dlf_notes" class="form-control" rows="2"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveDealForCompany(${companyId})">Save</button>
    </div>`);
  setTimeout(() => document.getElementById('dlf_title')?.focus(), 50);
};

window.saveDealForCompany = async function(companyId) {
  const title = document.getElementById('dlf_title').value.trim();
  if (!title) { showToast('Title is required', 'error'); return; }
  const body = {
    title,
    stage:      document.getElementById('dlf_stage').value,
    value:      parseFloat(document.getElementById('dlf_value').value) || 0,
    close_date: document.getElementById('dlf_close').value || null,
    notes:      document.getElementById('dlf_notes').value.trim() || null,
    company_id: companyId,
  };
  try {
    await api('/api/deals', { method: 'POST', body: JSON.stringify(body) });
    showToast('Deal added');
    closeModal();
    delete State.companyCache[companyId];
    await selectCompany(companyId);
    switchCoTab(companyId, 'deals');
  } catch(e) { showToast(e.message, 'error'); }
};

window.deleteDealInCompany = function(dealId, companyId) {
  const cached = State.companyCache[companyId];
  const d = cached?.deals?.find(x => x.id === dealId);
  confirmDialog(`Delete deal "${d?.title||''}"?`, 'This cannot be undone.', async () => {
    try {
      await api(`/api/deals/${dealId}`, { method: 'DELETE' });
      showToast('Deal deleted');
      delete State.companyCache[companyId];
      await selectCompany(companyId);
    } catch(e) { showToast(e.message, 'error'); }
  });
};

window.completeActivityInCompany = async function(activityId, companyId) {
  const cached = State.companyCache[companyId];
  const a = cached?.activities?.find(x => x.id === activityId);
  if (!a) return;
  try {
    await api(`/api/activities/${activityId}`, { method: 'PUT', body: JSON.stringify({ ...a, completed: true }) });
    showToast('Activity completed');
    delete State.companyCache[companyId];
    await selectCompany(companyId);
    switchCoTab(companyId, 'activities');
  } catch(e) { showToast(e.message, 'error'); }
};

function openCompanyForm(id) {
  const co = id ? State.companies.find(c => c.id === id) : null;
  openModal(co ? 'Edit Company' : 'Add Company', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Company Name *</label>
        <input id="cof_name" class="form-control" value="${esc(co?.name || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="cof_status" class="form-control">
          <option value="">— Select —</option>
          ${listOptions('company_status', co?.status || '')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select id="cof_category" class="form-control">
          <option value="">— Select —</option>
          ${listOptions('category', co?.category || '')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Industry</label>
        <input id="cof_industry" class="form-control" list="dl_industry" value="${esc(co?.industry || '')}">
        <datalist id="dl_industry">${listOptions('industry')}</datalist>
      </div>
      <div class="form-group">
        <label class="form-label">City</label>
        <input id="cof_city" class="form-control" list="dl_city" value="${esc(co?.city || '')}">
        <datalist id="dl_city">${listOptions('city')}</datalist>
      </div>
      <div class="form-group">
        <label class="form-label">Custom ID</label>
        <input id="cof_custom_id" class="form-control" value="${esc(co?.custom_id || '')}" placeholder="e.g. C-001">
      </div>
      <div class="form-group">
        <label class="form-label">Folder</label>
        <input id="cof_folder" class="form-control" value="${esc(co?.folder || '')}" placeholder="e.g. VIP Clients">
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input id="cof_phone" class="form-control" value="${esc(co?.phone || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input id="cof_email" class="form-control" value="${esc(co?.email || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Website</label>
        <input id="cof_website" class="form-control" value="${esc(co?.website || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Country</label>
        <input id="cof_country" class="form-control" value="${esc(co?.country || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Size</label>
        <select id="cof_size" class="form-control">
          ${['','1-10','11-50','51-200','201-1000','1000+'].map(s =>
            `<option value="${s}" ${co?.size === s ? 'selected' : ''}>${s || '— Select —'}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label class="form-label">Address</label>
        <input id="cof_address" class="form-control" value="${esc(co?.address || '')}">
      </div>
      <div class="form-group full">
        <label class="form-label">Notes</label>
        <textarea id="cof_notes" class="form-control">${esc(co?.notes || '')}</textarea>
      </div>
      ${!id ? renderCustomFieldInputs('company', []) : ''}
    </div>
    <div id="co-dup-warn"></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveCompany(${id || 'null'})">Save</button>
    </div>`);
  // Wire duplicate check
  if (!id) {
    const nameEl = document.getElementById('cof_name');
    const phoneEl = document.getElementById('cof_phone');
    if (nameEl) nameEl.addEventListener('blur', () => scheduleDupCheck('companies', {name: nameEl.value?.trim()}, 'co-dup-warn'));
    if (phoneEl) phoneEl.addEventListener('blur', () => scheduleDupCheck('companies', {phone: phoneEl.value?.trim()}, 'co-dup-warn'));
  }
}

window.saveCompany = async function (id) {
  const body = {
    name:      document.getElementById('cof_name').value.trim(),
    status:    document.getElementById('cof_status').value || null,
    industry:  document.getElementById('cof_industry').value.trim(),
    category:  document.getElementById('cof_category').value || null,
    custom_id: document.getElementById('cof_custom_id').value.trim() || null,
    folder:    document.getElementById('cof_folder').value.trim() || null,
    size:      document.getElementById('cof_size').value,
    website:   document.getElementById('cof_website').value.trim(),
    phone:     document.getElementById('cof_phone').value.trim(),
    email:     document.getElementById('cof_email').value.trim(),
    city:      document.getElementById('cof_city').value.trim(),
    country:   document.getElementById('cof_country').value.trim(),
    address:   document.getElementById('cof_address').value.trim(),
    notes:     document.getElementById('cof_notes').value.trim(),
  };
  if (!body.name) { showToast('Company name is required', 'error'); return; }
  try {
    if (id) {
      await api(`/api/companies/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      delete State.companyCache[id];
      showToast('Company updated');
    } else {
      const created = await api('/api/companies', { method: 'POST', body: JSON.stringify(body) });
      if (created?.id) await saveCustomValues('company', created.id);
      showToast('Company added');
    }
    closeModal();
    loadCompanies();
  } catch (e) { showToast(e.message, 'error'); }
};

window.deleteCompany = function (id) {
  const co = State.companies.find(c => c.id === id);
  confirmDialog(`Delete ${co?.name}?`, 'Associated contacts and deals will be unlinked.', async () => {
    try {
      await api(`/api/companies/${id}`, { method: 'DELETE' });
      showToast('Company deleted');
      loadCompanies();
    } catch (e) { showToast(e.message, 'error'); }
  });
};

/* ============================================================
   DEALS
   ============================================================ */
async function loadDeals() {
  document.getElementById('deals-content').innerHTML = '<div class="spinner"></div>';
  try {
    const search = document.getElementById('dealSearch').value;
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    State.deals = await api('/api/deals' + params) || [];
    document.getElementById('deals-count').textContent = `${State.deals.length} deal${State.deals.length !== 1 ? 's' : ''}`;
    renderDealsContent();
  } catch (e) {
    document.getElementById('deals-content').innerHTML = emptyState('fa-exclamation-circle', 'Failed to load deals');
  }
}

const searchDeals = debounce(loadDeals, 350);

window.setDealsView = function (view) {
  State.dealsView = view;
  document.getElementById('kanbanViewBtn').classList.toggle('active', view === 'kanban');
  document.getElementById('listViewBtn').classList.toggle('active', view === 'list');
  renderDealsContent();
};

function renderDealsContent() {
  if (State.dealsView === 'kanban') renderKanban(State.deals);
  else renderDealsList(State.deals);
}

let _dragDealId = null;

window.dragDeal = function(event, id) {
  _dragDealId = id;
  event.currentTarget.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
};

window.dropDeal = async function(event, stage) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  if (!_dragDealId) return;
  const deal = State.deals.find(d => d.id === _dragDealId);
  _dragDealId = null;
  if (!deal || deal.stage === stage) return;
  try {
    await api(`/api/deals/${deal.id}`, { method: 'PUT', body: JSON.stringify({ ...deal, stage }) });
    loadDeals();
  } catch(e) { showToast(e.message, 'error'); }
};

function renderKanban(deals) {
  const container = document.getElementById('deals-content');
  container.innerHTML = `<div class="kanban-board">
    ${STAGES.map(stage => {
      const stageDeals = deals.filter(d => d.stage === stage);
      const total = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
      return `<div class="kanban-col">
        <div class="kanban-col-header">
          <div class="kanban-col-title">
            <span class="stage-dot dot-${stage}"></span>${STAGE_LABELS[stage]}
            <span class="kanban-col-count">${stageDeals.length}</span>
          </div>
        </div>
        <div class="kanban-cards" data-stage="${stage}"
          ondragover="event.preventDefault();this.classList.add('drag-over')"
          ondragleave="this.classList.remove('drag-over')"
          ondrop="dropDeal(event,'${stage}')">
          ${stageDeals.map(d => `
            <div class="kanban-card" draggable="true"
              ondragstart="dragDeal(event,${d.id})"
              ondragend="document.querySelectorAll('.kanban-card').forEach(c=>c.classList.remove('dragging'));document.querySelectorAll('.kanban-cards').forEach(c=>c.classList.remove('drag-over'))"
              onclick="openDealForm(${d.id})">
              <div class="kanban-card-title">${esc(d.title)}</div>
              ${d.company_name ? `<div class="kanban-card-company"><i class="fas fa-building" style="font-size:10px;margin-right:3px;opacity:.5;"></i>${esc(d.company_name)}</div>` : ''}
              ${d.contact_name ? `<div class="kanban-card-company" style="margin-top:2px;"><i class="fas fa-user" style="font-size:10px;margin-right:3px;opacity:.5;"></i>${esc(d.contact_name)}</div>` : ''}
              <div class="kanban-card-footer">
                <span class="kanban-card-value">${fmtMoney(d.value)}</span>
                <span class="kanban-card-date">${fmtDate(d.close_date)}</span>
              </div>
            </div>`).join('')}
        </div>
        <div class="kanban-total">${fmtMoney(total)}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderDealsList(deals) {
  const container = document.getElementById('deals-content');
  if (!deals.length) {
    container.innerHTML = emptyState('fa-handshake', 'No deals found', 'Add your first deal to get started');
    return;
  }
  container.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr>
      <th>Title</th><th>Company</th><th>Contact</th><th>Stage</th><th>Value</th><th>Close Date</th><th></th>
    </tr></thead>
    <tbody>${deals.map(dealRow).join('')}</tbody>
  </table></div>`;
}

function dealRow(d) {
  return `<tr>
    <td><div class="name-cell">${esc(d.title)}</div></td>
    <td>${esc(fmt(d.company_name))}</td>
    <td>${esc(fmt(d.contact_name))}</td>
    <td><span class="badge badge-${d.stage}">${esc(STAGE_LABELS[d.stage] || d.stage)}</span></td>
    <td style="font-weight:600;color:var(--primary);">${fmtMoney(d.value)}</td>
    <td>${fmtDate(d.close_date)}</td>
    <td><div class="td-actions">
      <button class="btn-icon" onclick="openDealForm(${d.id})" title="Edit"><i class="fas fa-pen"></i></button>
      <button class="btn-icon danger" onclick="deleteDeal(${d.id})" title="Delete"><i class="fas fa-trash"></i></button>
    </div></td>
  </tr>`;
}

function openDealForm(id) {
  const deal = id ? State.deals.find(d => d.id === id) : null;
  const companyOptions = State.companies.map(co =>
    `<option value="${co.id}" ${deal?.company_id === co.id ? 'selected' : ''}>${esc(co.name)}</option>`
  ).join('');
  const contactOptions = State.contacts.map(c =>
    `<option value="${c.id}" ${deal?.contact_id === c.id ? 'selected' : ''}>${esc(c.first_name)} ${esc(c.last_name)}</option>`
  ).join('');

  openModal(deal ? 'Edit Deal' : 'Add Deal', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Title *</label>
        <input id="df_title" class="form-control" value="${esc(deal?.title || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <select id="df_company" class="form-control">
          <option value="">— None —</option>${companyOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Contact</label>
        <select id="df_contact" class="form-control">
          <option value="">— None —</option>${contactOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Value ($)</label>
        <input id="df_value" class="form-control" type="number" min="0" value="${deal?.value || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Stage</label>
        <select id="df_stage" class="form-control">
          ${STAGES.map(s => `<option value="${s}" ${(deal?.stage || 'lead') === s ? 'selected' : ''}>${STAGE_LABELS[s]}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Probability (%)</label>
        <input id="df_prob" class="form-control" type="number" min="0" max="100" value="${deal?.probability || 0}">
      </div>
      <div class="form-group">
        <label class="form-label">Close Date</label>
        <input id="df_date" class="form-control" type="date" value="${deal?.close_date ? deal.close_date.slice(0, 10) : ''}">
      </div>
      <div class="form-group full">
        <label class="form-label">Notes</label>
        <textarea id="df_notes" class="form-control">${esc(deal?.notes || '')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveDeal(${id || 'null'})">Save</button>
    </div>`);
}

window.saveDeal = async function (id) {
  const body = {
    title:      document.getElementById('df_title').value.trim(),
    company_id: document.getElementById('df_company').value || null,
    contact_id: document.getElementById('df_contact').value || null,
    value:      parseFloat(document.getElementById('df_value').value) || 0,
    stage:      document.getElementById('df_stage').value,
    probability:parseInt(document.getElementById('df_prob').value) || 0,
    close_date: document.getElementById('df_date').value || null,
    notes:      document.getElementById('df_notes').value.trim(),
  };
  if (!body.title) { showToast('Deal title is required', 'error'); return; }
  try {
    if (id) {
      await api(`/api/deals/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Deal updated');
    } else {
      await api('/api/deals', { method: 'POST', body: JSON.stringify(body) });
      showToast('Deal added');
    }
    // Invalidate company cache so detail panel refreshes if open
    if (body.company_id) delete State.companyCache[body.company_id];
    if (State.selectedCompanyId) delete State.companyCache[State.selectedCompanyId];
    closeModal();
    loadDeals();
  } catch (e) { showToast(e.message, 'error'); }
};

window.deleteDeal = function (id) {
  const d = State.deals.find(x => x.id === id);
  confirmDialog(`Delete "${d?.title}"?`, 'This action cannot be undone.', async () => {
    try {
      await api(`/api/deals/${id}`, { method: 'DELETE' });
      showToast('Deal deleted');
      loadDeals();
    } catch (e) { showToast(e.message, 'error'); }
  });
};

/* ============================================================
   ACTIVITIES
   ============================================================ */
async function loadActivities() {
  document.getElementById('activities-list').innerHTML = '<div class="spinner"></div>';
  try {
    const params = new URLSearchParams();
    if (State.activityFilter === 'pending')   params.set('completed', 'false');
    if (State.activityFilter === 'completed') params.set('completed', 'true');
    if (State.activityType) params.set('type', State.activityType);
    State.activities = await api('/api/activities?' + params) || [];
    document.getElementById('activities-count').textContent = `${State.activities.length} activit${State.activities.length !== 1 ? 'ies' : 'y'}`;
    renderActivitiesList(State.activities);
  } catch (e) {
    document.getElementById('activities-list').innerHTML = emptyState('fa-exclamation-circle', 'Failed to load activities');
  }
}

window.filterActivities = function (filter) {
  if (filter) {
    State.activityFilter = filter;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
  }
  loadActivities();
};

window.filterActivitiesByType = function () {
  State.activityType = document.getElementById('activityTypeFilter').value;
  loadActivities();
};

function renderActivitiesList(activities) {
  const container = document.getElementById('activities-list');
  if (!activities.length) {
    container.innerHTML = emptyState('fa-calendar-check', 'No activities found', 'Add an activity to stay on track');
    return;
  }
  const now = new Date();
  container.innerHTML = `<div class="activities-list">
    ${activities.map(a => activityItem(a, now)).join('')}
  </div>`;
}

function activityItem(a, now = new Date()) {
  const isOverdue = !a.completed && a.due_date && new Date(a.due_date) < now;
  return `<div class="activity-item ${a.completed ? 'completed' : ''}">
    <div class="activity-check">
      <input type="checkbox" ${a.completed ? 'checked' : ''} onchange="toggleActivity(${a.id}, this.checked)">
    </div>
    <div class="type-icon type-${a.type}"><i class="fas ${TYPE_ICONS[a.type] || 'fa-circle'}"></i></div>
    <div class="activity-body">
      <div class="activity-title ${a.completed ? 'done' : ''}">${esc(a.title)}
        ${a.reminder_at ? `<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:10px;background:#fef3c7;color:#92400e;margin-left:6px;"><i class="fas fa-bell" style="font-size:9px;"></i> ${new Date(a.reminder_at).toLocaleDateString()}</span>` : ''}
      </div>
      <div class="activity-meta">
        ${a.contact_name ? `<span><i class="fas fa-user"></i>${esc(a.contact_name)}</span>` : ''}
        ${a.company_name ? `<span><i class="fas fa-building"></i>${esc(a.company_name)}</span>` : ''}
        ${a.due_date ? `<span class="${isOverdue ? 'overdue' : ''}"><i class="fas fa-clock"></i>${fmtDate(a.due_date)}</span>` : ''}
        ${a.user_name ? `<span><i class="fas fa-user-tie"></i>${esc(a.user_name)}</span>` : ''}
      </div>
    </div>
    <div class="activity-actions">
      <button class="btn-icon" onclick="openActivityForm(${a.id})" title="Edit"><i class="fas fa-pen"></i></button>
      <button class="btn-icon danger" onclick="deleteActivity(${a.id})" title="Delete"><i class="fas fa-trash"></i></button>
    </div>
  </div>`;
}

window.toggleActivity = async function (id, completed) {
  const a = State.activities.find(x => x.id === id);
  if (!a) return;
  try {
    await api(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify({ ...a, completed }) });
    loadActivities();
  } catch (e) { showToast(e.message, 'error'); }
};

function openActivityForm(id) {
  const a = id ? State.activities.find(x => x.id === id) : null;
  const companyOptions = State.companies.map(co =>
    `<option value="${co.id}" ${a?.company_id === co.id ? 'selected' : ''}>${esc(co.name)}</option>`
  ).join('');
  const contactOptions = State.contacts.map(c =>
    `<option value="${c.id}" ${a?.contact_id === c.id ? 'selected' : ''}>${esc(c.first_name)} ${esc(c.last_name)}</option>`
  ).join('');
  const dealOptions = State.deals.map(d =>
    `<option value="${d.id}" ${a?.deal_id === d.id ? 'selected' : ''}>${esc(d.title)}</option>`
  ).join('');

  openModal(a ? 'Edit Activity' : 'Add Activity', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Title *</label>
        <input id="af_title" class="form-control" value="${esc(a?.title || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select id="af_type" class="form-control">
          ${['call','email','meeting','task','visit','note'].map(t =>
            `<option value="${t}" ${(a?.type || 'call') === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="af_due" class="form-control" type="datetime-local" value="${a?.due_date ? a.due_date.slice(0, 16) : ''}">
      </div>
      <div class="form-group">
        <label class="form-label"><i class="fas fa-bell" style="color:var(--warning);margin-right:4px;"></i>Reminder Date/Time</label>
        <input id="af_reminder" class="form-control" type="datetime-local" value="${a?.reminder_at ? a.reminder_at.slice(0, 16) : ''}" title="Sends email notification to assigned user">
      </div>
      <div class="form-group">
        <label class="form-label">Contact</label>
        <select id="af_contact" class="form-control">
          <option value="">— None —</option>${contactOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <select id="af_company" class="form-control">
          <option value="">— None —</option>${companyOptions}
        </select>
      </div>
      <div class="form-group full">
        <label class="form-label">Deal</label>
        <select id="af_deal" class="form-control">
          <option value="">— None —</option>${dealOptions}
        </select>
      </div>
      <div class="form-group full">
        <label class="form-label">Description</label>
        <textarea id="af_desc" class="form-control">${esc(a?.description || '')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveActivity(${id || 'null'})">Save</button>
    </div>`);
}

window.saveActivity = async function (id) {
  const body = {
    title:       document.getElementById('af_title').value.trim(),
    type:        document.getElementById('af_type').value,
    due_date:    document.getElementById('af_due').value || null,
    reminder_at: document.getElementById('af_reminder')?.value || null,
    contact_id:  document.getElementById('af_contact').value || null,
    company_id:  document.getElementById('af_company').value || null,
    deal_id:     document.getElementById('af_deal').value || null,
    description: document.getElementById('af_desc').value.trim(),
    completed:   id ? (State.activities.find(a => a.id === id)?.completed || false) : false,
  };
  if (!body.title) { showToast('Activity title is required', 'error'); return; }
  try {
    if (id) {
      await api(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Activity updated');
    } else {
      await api('/api/activities', { method: 'POST', body: JSON.stringify(body) });
      showToast('Activity added');
    }
    closeModal();
    loadActivities();
  } catch (e) { showToast(e.message, 'error'); }
};

window.deleteActivity = function (id) {
  const a = State.activities.find(x => x.id === id);
  confirmDialog(`Delete "${a?.title}"?`, 'This action cannot be undone.', async () => {
    try {
      await api(`/api/activities/${id}`, { method: 'DELETE' });
      showToast('Activity deleted');
      loadActivities();
    } catch (e) { showToast(e.message, 'error'); }
  });
};

/* ============================================================
   TASKS
   ============================================================ */
async function loadTasks() {
  const container = document.getElementById('tasks-list');
  if (container) container.innerHTML = '<div class="spinner"></div>';
  try {
    const params = new URLSearchParams();
    if (State.taskFilter === 'pending')   params.set('completed', 'false');
    if (State.taskFilter === 'completed') params.set('completed', 'true');
    State.tasks = await api('/api/tasks?' + params) || [];
    const el = document.getElementById('tasks-count');
    if (el) el.textContent = `${State.tasks.length} task${State.tasks.length !== 1 ? 's' : ''}`;
    renderTaskList(State.tasks);
  } catch (e) {
    const c = document.getElementById('tasks-list');
    if (c) c.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load tasks');
  }
}

window.filterTasks = function (filter) {
  State.taskFilter = filter;
  document.querySelectorAll('#page-tasks .tab').forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
  loadTasks();
};

function renderTaskList(tasks) {
  const container = document.getElementById('tasks-list');
  if (!container) return;
  if (!tasks.length) {
    container.innerHTML = emptyState('fa-check-square', 'No tasks found', 'Add a task to get started');
    return;
  }
  const now = new Date();
  container.innerHTML = `<div class="tasks-list">${tasks.map(t => taskItem(t, now)).join('')}</div>`;
}

function taskItem(a, now = new Date()) {
  const isOverdue = !a.completed && a.due_date && new Date(a.due_date) < now;
  const isAssigned = a.assigned_to && a.assigned_to !== a.user_id;
  const isAssignedToMe = a.assigned_to === State.currentUser?.id && a.user_id !== State.currentUser?.id;
  return `<div class="task-item ${a.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''} ${isAssignedToMe ? 'assigned-to-me' : ''}">
    <div class="task-check">
      <input type="checkbox" ${a.completed ? 'checked' : ''} onchange="toggleTask(${a.id}, this.checked)">
    </div>
    <div class="task-body">
      <div class="task-title ${a.completed ? 'done' : ''}">${esc(a.title)}
        ${isAssignedToMe ? `<span class="task-from-badge"><i class="fas fa-user-tie" style="font-size:9px;"></i> From ${esc(a.user_name||'Manager')}</span>` : ''}
        ${isAssigned && !isAssignedToMe ? `<span class="assigned-badge"><i class="fas fa-user-check" style="font-size:9px;"></i> ${esc(a.assigned_to_name||'—')}</span>` : ''}
        ${a.reminder_at ? `<span class="task-reminder-badge"><i class="fas fa-bell" style="font-size:9px;"></i> Reminder set</span>` : ''}
      </div>
      <div class="task-meta">
        ${a.contact_name ? `<span><i class="fas fa-user"></i>${esc(a.contact_name)}</span>` : ''}
        ${a.company_name ? `<span><i class="fas fa-building"></i>${esc(a.company_name)}</span>` : ''}
        ${a.due_date ? `<span class="${isOverdue ? 'overdue' : ''}"><i class="fas fa-clock"></i>${fmtDate(a.due_date)}</span>` : ''}
        ${a.description ? `<span style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-align-left"></i>${esc(a.description)}</span>` : ''}
      </div>
    </div>
    <div class="task-actions">
      ${!isAssignedToMe ? `<button class="btn-icon" onclick="openTaskForm(${a.id})" title="Edit"><i class="fas fa-pen"></i></button>` : ''}
      ${!isAssignedToMe ? `<button class="btn-icon danger" onclick="deleteTask(${a.id})" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
    </div>
  </div>`;
}

window.toggleTask = async function (id, completed) {
  const a = State.tasks.find(x => x.id === id);
  if (!a) return;
  try {
    await api(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify({ ...a, completed }) });
    loadTasks();
  } catch (e) { showToast(e.message, 'error'); }
};

window.openTaskForm = function(id) {
  const a = id ? State.tasks.find(x => x.id === id) : null;
  const contactOptions = State.contacts.map(c =>
    `<option value="${c.id}" ${a?.contact_id === c.id ? 'selected' : ''}>${esc(c.first_name)} ${esc(c.last_name)}</option>`
  ).join('');
  const companyOptions = State.companies.map(co =>
    `<option value="${co.id}" ${a?.company_id === co.id ? 'selected' : ''}>${esc(co.name)}</option>`
  ).join('');

  openModal(a ? 'Edit Task' : 'Add Task', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Task Title *</label>
        <input id="tf_title" class="form-control" value="${esc(a?.title || '')}" placeholder="What needs to be done?">
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="tf_due" class="form-control" type="datetime-local" value="${a?.due_date ? a.due_date.slice(0,16) : ''}">
      </div>
      <div class="form-group">
        <label class="form-label"><i class="fas fa-bell" style="color:var(--warning);margin-right:4px;"></i>Reminder</label>
        <input id="tf_reminder" class="form-control" type="datetime-local" value="${a?.reminder_at ? a.reminder_at.slice(0,16) : ''}" title="Sends email notification to assigned user">
      </div>
      <div class="form-group">
        <label class="form-label">Contact</label>
        <select id="tf_contact" class="form-control">
          <option value="">— None —</option>${contactOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <select id="tf_company" class="form-control">
          <option value="">— None —</option>${companyOptions}
        </select>
      </div>
      <div class="form-group full">
        <label class="form-label">Notes</label>
        <textarea id="tf_desc" class="form-control" rows="2">${esc(a?.description || '')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveTask(${id || 'null'})">Save</button>
    </div>`);
  setTimeout(() => document.getElementById('tf_title')?.focus(), 50);
};

window.saveTask = async function(id) {
  const title = document.getElementById('tf_title').value.trim();
  if (!title) { showToast('Title is required', 'error'); return; }
  const body = {
    type: 'task',
    title,
    due_date:    document.getElementById('tf_due').value || null,
    reminder_at: document.getElementById('tf_reminder').value || null,
    contact_id:  document.getElementById('tf_contact').value || null,
    company_id:  document.getElementById('tf_company').value || null,
    description: document.getElementById('tf_desc').value.trim(),
    completed:   id ? (State.tasks.find(a => a.id === id)?.completed || false) : false,
  };
  try {
    if (id) {
      await api(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Task updated');
    } else {
      await api('/api/activities', { method: 'POST', body: JSON.stringify(body) });
      showToast('Task added');
    }
    closeModal();
    loadTasks();
  } catch(e) { showToast(e.message, 'error'); }
};

window.deleteTask = function(id) {
  const a = State.tasks.find(x => x.id === id);
  confirmDialog(`Delete "${a?.title}"?`, 'This action cannot be undone.', async () => {
    try {
      await api(`/api/activities/${id}`, { method: 'DELETE' });
      showToast('Task deleted');
      loadTasks();
    } catch(e) { showToast(e.message, 'error'); }
  });
};

/* ============================================================
   GENERAL / BROADCAST TASKS (Manager & Team Leader)
   ============================================================ */
window.openGeneralTaskForm = function() {
  const role = State.currentUser?.role;
  const isTL = role === 'team_leader';

  // Build recipient groups
  let groups = [];
  if (isTL) {
    // TL sees their sales members only
    const members = State.teamMembers || [];
    if (members.length) {
      groups.push({ label: 'My Entire Team', ids: members.map(m => m.id) });
      members.forEach(m => groups.push({ label: m.name, ids: [m.id] }));
    }
  } else {
    // Manager sees by role groups + individual users
    const users = State.users || [];
    const tls    = users.filter(u => u.role === 'team_leader');
    const sales  = users.filter(u => u.role === 'sales');
    groups.push({ label: 'Everyone (All Users)', ids: users.filter(u => u.id !== State.currentUser.id).map(u => u.id) });
    if (tls.length)   groups.push({ label: 'All Team Leaders', ids: tls.map(u => u.id) });
    if (sales.length) groups.push({ label: 'All Sales', ids: sales.map(u => u.id) });
    users.filter(u => u.id !== State.currentUser.id).forEach(u =>
      groups.push({ label: `${u.name} (${u.role === 'team_leader' ? 'TL' : 'Sales'})`, ids: [u.id] })
    );
  }

  if (!groups.length) { showToast('No team members to assign to', 'error'); return; }

  const groupOpts = groups.map((g, i) =>
    `<option value="${i}">${esc(g.label)} ${g.ids.length > 1 ? `— ${g.ids.length} people` : ''}</option>`
  ).join('');

  openModal('Assign Team Task', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Task Title *</label>
        <input id="gt_title" class="form-control" placeholder="What needs to be done?">
      </div>
      <div class="form-group full">
        <label class="form-label"><i class="fas fa-users" style="color:var(--primary);margin-right:4px;"></i> Assign To *</label>
        <select id="gt_recipients" class="form-control" size="1">
          ${groupOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="gt_due" class="form-control" type="datetime-local">
      </div>
      <div class="form-group full">
        <label class="form-label">Description</label>
        <textarea id="gt_desc" class="form-control" rows="3" placeholder="Task details, instructions..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveGeneralTask(${JSON.stringify(groups).replace(/"/g,'&quot;')})">
        <i class="fas fa-paper-plane"></i> Send Task
      </button>
    </div>`);
  setTimeout(() => document.getElementById('gt_title')?.focus(), 50);
};

window.saveGeneralTask = async function(groups) {
  const title = document.getElementById('gt_title')?.value.trim();
  if (!title) { showToast('Title is required', 'error'); return; }
  const idx = parseInt(document.getElementById('gt_recipients')?.value) || 0;
  const group = groups[idx];
  if (!group || !group.ids.length) { showToast('Select recipients', 'error'); return; }

  const due_date    = document.getElementById('gt_due')?.value || null;
  const description = document.getElementById('gt_desc')?.value.trim() || null;

  const btn = document.querySelector('#modalDialog .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  try {
    let sent = 0;
    for (const userId of group.ids) {
      await api('/api/activities', {
        method: 'POST',
        body: JSON.stringify({ type: 'task', title, description, due_date, assigned_to: userId, completed: false }),
      });
      sent++;
    }
    showToast(`Task sent to ${sent} team member${sent !== 1 ? 's' : ''}`, 'success');
    closeModal();
    loadTasks();
  } catch(e) {
    showToast(e.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Task'; }
  }
};

/* ============================================================
   REMINDERS
   ============================================================ */
async function loadReminders() {
  const container = document.getElementById('reminders-list');
  if (container) container.innerHTML = '<div class="spinner"></div>';
  try {
    State.reminders = await api('/api/reminders') || [];
    const el = document.getElementById('reminders-count');
    if (el) el.textContent = `${State.reminders.length} reminder${State.reminders.length !== 1 ? 's' : ''}`;
    renderReminderList(State.reminders);
  } catch(e) {
    const c = document.getElementById('reminders-list');
    if (c) c.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load reminders');
  }
}

function renderReminderList(reminders) {
  const container = document.getElementById('reminders-list');
  if (!container) return;
  if (!reminders.length) {
    container.innerHTML = emptyState('fa-bell', 'No reminders', 'Set a reminder when creating an activity or task');
    return;
  }
  const now = new Date();
  const todayStr = now.toDateString();
  const overdue = [], today = [], future = [];
  reminders.forEach(r => {
    const d = new Date(r.reminder_at);
    if (d < now) overdue.push(r);
    else if (d.toDateString() === todayStr) today.push(r);
    else future.push(r);
  });

  function group(label, items, cls) {
    if (!items.length) return '';
    return `<div class="reminder-group-label">${label}</div>
      <div class="reminders-list">
        ${items.map(r => reminderItem(r, cls, now)).join('')}
      </div>`;
  }

  container.innerHTML = `
    ${group('Overdue', overdue, 'overdue')}
    ${group('Today', today, 'today')}
    ${group('Upcoming', future, 'future')}
  `;
}

function reminderItem(a, cls, now) {
  const d = new Date(a.reminder_at);
  const isOverdue = d < now;
  const timeStr = d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  return `<div class="reminder-item ${cls} ${a.notified ? 'notified' : ''}">
    <div class="reminder-icon ${isOverdue ? 'overdue' : ''} ${a.notified ? 'notified' : ''}">
      <i class="fas fa-bell"></i>
    </div>
    <div class="reminder-body">
      <div class="reminder-title">${esc(a.title)}</div>
      <div class="reminder-meta">
        ${a.contact_name ? `<span><i class="fas fa-user"></i>${esc(a.contact_name)}</span>` : ''}
        ${a.company_name ? `<span><i class="fas fa-building"></i>${esc(a.company_name)}</span>` : ''}
        ${a.due_date ? `<span><i class="fas fa-clock"></i>${fmtDate(a.due_date)}</span>` : ''}
        ${a.notified ? `<span style="color:var(--success);"><i class="fas fa-check-circle"></i>Email sent</span>` : ''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
      <span class="reminder-time ${isOverdue?'overdue':''}">${timeStr}</span>
      <div class="reminder-actions">
        <button class="btn-icon" onclick="openTaskForm(${a.id})" title="Edit"><i class="fas fa-pen"></i></button>
        <button class="btn-icon" onclick="dismissReminder(${a.id})" title="Mark done" style="color:var(--success);"><i class="fas fa-check"></i></button>
      </div>
    </div>
  </div>`;
}

window.dismissReminder = async function(id) {
  const a = State.reminders.find(x => x.id === id);
  if (!a) return;
  try {
    await api(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify({ ...a, completed: true }) });
    showToast('Reminder dismissed');
    loadReminders();
  } catch(e) { showToast(e.message, 'error'); }
};

window.openReminderForm = function() {
  // Open the activity form pre-focused on the reminder field
  const companyOptions = State.companies.map(co =>
    `<option value="${co.id}">${esc(co.name)}</option>`).join('');
  const contactOptions = State.contacts.map(c =>
    `<option value="${c.id}">${esc(c.first_name)} ${esc(c.last_name)}</option>`).join('');

  openModal('Add Reminder', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Title *</label>
        <input id="rf_title" class="form-control" placeholder="What to be reminded about?">
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select id="rf_type" class="form-control">
          ${['call','email','meeting','task','visit','note'].map(t =>
            `<option value="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="rf_due" class="form-control" type="datetime-local">
      </div>
      <div class="form-group full">
        <label class="form-label"><i class="fas fa-bell" style="color:var(--warning);margin-right:4px;"></i>Reminder Date/Time *</label>
        <input id="rf_reminder" class="form-control" type="datetime-local" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Contact</label>
        <select id="rf_contact" class="form-control">
          <option value="">— None —</option>${contactOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <select id="rf_company" class="form-control">
          <option value="">— None —</option>${companyOptions}
        </select>
      </div>
      <div class="form-group full">
        <label class="form-label">Notes</label>
        <textarea id="rf_desc" class="form-control" rows="2"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveReminder()">Save</button>
    </div>`);
  setTimeout(() => document.getElementById('rf_title')?.focus(), 50);
};

window.saveReminder = async function() {
  const title = document.getElementById('rf_title').value.trim();
  const reminder_at = document.getElementById('rf_reminder').value;
  if (!title) { showToast('Title is required', 'error'); return; }
  if (!reminder_at) { showToast('Reminder date/time is required', 'error'); return; }
  const body = {
    type:        document.getElementById('rf_type').value,
    title,
    due_date:    document.getElementById('rf_due').value || null,
    reminder_at,
    contact_id:  document.getElementById('rf_contact').value || null,
    company_id:  document.getElementById('rf_company').value || null,
    description: document.getElementById('rf_desc').value.trim(),
    completed:   false,
  };
  try {
    await api('/api/activities', { method: 'POST', body: JSON.stringify(body) });
    showToast('Reminder set');
    closeModal();
    loadReminders();
  } catch(e) { showToast(e.message, 'error'); }
};

/* ============================================================
   USERS (Manager only)
   ============================================================ */
async function loadUsers() {
  document.getElementById('users-table-container').innerHTML = '<div class="spinner"></div>';
  try {
    State.users = await api('/api/users') || [];
    document.getElementById('users-count').textContent = `${State.users.length} user${State.users.length !== 1 ? 's' : ''}`;
    renderUsersTable(State.users);
  } catch (e) {
    document.getElementById('users-table-container').innerHTML = emptyState('fa-exclamation-circle', 'Failed to load users');
  }
}

function renderUsersTable(users) {
  const container = document.getElementById('users-table-container');
  if (!users.length) { container.innerHTML = emptyState('fa-user-shield', 'No users found'); return; }

  // Group: managers, then team leaders with their sales, then unassigned sales
  const managers    = users.filter(u => u.role === 'manager');
  const teamLeaders = users.filter(u => u.role === 'team_leader');
  const allSales    = users.filter(u => u.role === 'sales');

  let rows = '';
  managers.forEach(u => { rows += userRow(u, 0); });
  teamLeaders.forEach(tl => {
    rows += userRow(tl, 1);
    allSales.filter(s => s.team_leader_id === tl.id).forEach(s => { rows += userRow(s, 2); });
  });
  allSales.filter(s => !s.team_leader_id).forEach(s => { rows += userRow(s, 1); });

  container.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Name</th><th>Role</th><th>Team Leader</th><th>Email</th><th>Phone</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function userRow(u, indent = 0) {
  const isSelf = u.id === State.currentUser?.id;
  const ROLE_LABELS = { manager: 'Manager', team_leader: 'Team Leader', sales: 'Sales' };
  const indentStyle = indent > 0 ? `padding-left:${indent * 20 + 12}px;` : '';
  const connector = indent === 2 ? '<span style="color:var(--border);margin-right:4px;">└</span>' :
                    indent === 1 ? '<span style="color:var(--border);margin-right:4px;">├</span>' : '';
  return `<tr>
    <td><div class="avatar-name" style="${indentStyle}">
      ${connector}
      <div class="avatar" style="background:${avatarColor(u.name)};color:white;font-size:11px;font-weight:600;">${initials(u.name)}</div>
      <div>
        <div class="name-cell">${esc(u.name)} ${isSelf ? '<span style="font-size:11px;color:var(--text-muted);">(you)</span>' : ''}</div>
      </div>
    </div></td>
    <td><span class="badge badge-role-${u.role}">${esc(ROLE_LABELS[u.role] || u.role)}</span></td>
    <td>${u.team_leader_name ? `<span style="font-size:12px;color:var(--text-muted);"><i class="fas fa-sitemap" style="font-size:10px;"></i> ${esc(u.team_leader_name)}</span>` : '—'}</td>
    <td>${u.email ? `<a href="mailto:${esc(u.email)}" style="color:var(--primary);text-decoration:none;font-size:13px;">${esc(u.email)}</a>` : '—'}</td>
    <td style="font-size:13px;">${esc(u.phone || '—')}</td>
    <td><div class="td-actions">
      <button class="btn-icon" onclick="openUserForm(${u.id})" title="Edit"><i class="fas fa-pen"></i></button>
      ${!isSelf ? `<button class="btn-icon danger" onclick="deleteUser(${u.id})" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
    </div></td>
  </tr>`;
}

function openUserForm(id) {
  const u = id ? State.users.find(x => x.id === id) : null;
  const teamLeaders = (State.users || []).filter(x => x.role === 'team_leader');
  const tlOptions = teamLeaders.map(tl =>
    `<option value="${tl.id}" ${u?.team_leader_id === tl.id ? 'selected' : ''}>${esc(tl.name)}</option>`
  ).join('');

  openModal(u ? 'Edit User' : 'Add User', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Name *</label>
        <input id="uf_name" class="form-control" value="${esc(u?.name || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Role</label>
        <select id="uf_role" class="form-control" onchange="toggleTLField()">
          <option value="sales"       ${u?.role === 'sales'       ? 'selected' : ''}>Sales</option>
          <option value="team_leader" ${u?.role === 'team_leader' ? 'selected' : ''}>Team Leader</option>
          <option value="manager"     ${u?.role === 'manager'     ? 'selected' : ''}>Manager</option>
        </select>
      </div>
      <div class="form-group" id="uf_tl_group" style="display:${(!u || u.role === 'sales') ? '' : 'none'}">
        <label class="form-label"><i class="fas fa-sitemap" style="color:var(--primary);margin-right:4px;"></i>Team Leader</label>
        <select id="uf_tl" class="form-control">
          <option value="">— None (unassigned) —</option>${tlOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">PIN (4 digits) ${u ? '— leave blank to keep current' : '*'}</label>
        <input id="uf_pin" class="form-control" type="password" maxlength="4" pattern="\\d{4}" placeholder="${u ? '••••' : '4-digit PIN'}" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label class="form-label"><i class="fas fa-envelope" style="color:var(--primary);margin-right:4px;"></i>Email — for reminders</label>
        <input id="uf_email" class="form-control" type="email" value="${esc(u?.email || '')}" placeholder="user@example.com">
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input id="uf_phone" class="form-control" value="${esc(u?.phone || '')}" placeholder="01xxxxxxxxxx">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveUser(${id || 'null'})">Save</button>
    </div>`);
}

window.toggleTLField = function() {
  const role = document.getElementById('uf_role')?.value;
  const grp  = document.getElementById('uf_tl_group');
  if (grp) grp.style.display = role === 'sales' ? '' : 'none';
};

window.saveUser = async function (id) {
  const name  = document.getElementById('uf_name').value.trim();
  const role  = document.getElementById('uf_role').value;
  const pin   = document.getElementById('uf_pin').value.trim();
  const email = document.getElementById('uf_email').value.trim();
  const phone = document.getElementById('uf_phone').value.trim();

  if (!name) { showToast('Name is required', 'error'); return; }
  if (!id && !pin) { showToast('PIN is required', 'error'); return; }
  if (pin && !/^\d{4}$/.test(pin)) { showToast('PIN must be exactly 4 digits', 'error'); return; }

  const tlId = document.getElementById('uf_tl')?.value || null;
  const body = { name, role, email: email || null, phone: phone || null, team_leader_id: tlId || null };
  if (pin) body.pin = pin;

  try {
    if (id) {
      await api(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('User updated');
      if (id === State.currentUser.id) {
        State.currentUser.name = name;
        State.currentUser.role = role;
        updateSidebarUser();
        updateNavVisibility();
      }
    } else {
      await api('/api/users', { method: 'POST', body: JSON.stringify(body) });
      showToast('User added');
    }
    closeModal();
    loadUsers();
  } catch (e) { showToast(e.message, 'error'); }
};

window.deleteUser = function (id) {
  const u = State.users.find(x => x.id === id);
  if (id === State.currentUser?.id) { showToast('Cannot delete your own account', 'error'); return; }
  confirmDialog(`Delete user "${u?.name}"?`, 'Their data will remain but be reassigned to manager.', async () => {
    try {
      await api(`/api/users/${id}`, { method: 'DELETE' });
      showToast('User deleted');
      loadUsers();
    } catch (e) { showToast(e.message, 'error'); }
  });
};

/* ============================================================
   DETAIL VIEWS (Company & Contact)
   ============================================================ */

function renderTimeline(activities, entityType, entityId) {
  if (!activities || !activities.length) {
    return `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px;"><i class="fas fa-bolt" style="font-size:24px;display:block;margin-bottom:8px;opacity:.3;"></i>No activities yet</div>`;
  }
  const groups = {};
  activities.forEach(a => {
    const d = new Date(a.created_at);
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
    const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
    let label;
    if (dayStart >= today) label = 'Today';
    else if (dayStart >= yesterday) label = 'Yesterday';
    else label = d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(a);
  });
  return Object.entries(groups).map(([date, acts]) => `
    <div class="tl-date-group">
      <div class="tl-date-label"><span>${date}</span></div>
      <div class="tl-entries">
        ${acts.map(a => {
          const overdue = !a.completed && a.due_date && new Date(a.due_date) < new Date();
          return `<div class="tl-entry ${a.completed?'tl-done':''}">
            <div class="tl-dot type-${a.type}"><i class="fas ${TYPE_ICONS[a.type]||'fa-circle'}"></i></div>
            <div class="tl-content">
              <div class="tl-entry-title">${esc(a.title)}</div>
              <div class="tl-entry-meta">
                ${a.user_name ? `<span><i class="fas fa-user-circle"></i>${esc(a.user_name)}</span>` : ''}
                ${a.contact_name && entityType==='company' ? `<span><i class="fas fa-user"></i>${esc(a.contact_name)}</span>` : ''}
                ${a.due_date ? `<span class="${overdue?'tl-overdue':''}"><i class="fas fa-clock"></i>${fmtDate(a.due_date)}</span>` : ''}
              </div>
              ${a.description ? `<div class="tl-entry-desc">${esc(a.description)}</div>` : ''}
            </div>
            <div class="tl-actions">
              <span class="tl-time">${new Date(a.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>
              <span class="badge badge-${a.type}" style="font-size:10px;">${a.type}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');
}

window.openCompanyDetail = async function(id) {
  openModal('Loading…', '<div class="spinner"></div>', 'modal-xl');
  try {
    const data = await api(`/api/companies/${id}`);
    if (!data) return;
    document.getElementById('modalTitle').textContent = data.name;
    document.getElementById('modalBody').innerHTML = `
      <div class="detail-header">
        <div class="detail-avatar" style="background:${avatarColor(data.name)}">
          ${esc(data.name.slice(0,2).toUpperCase())}
        </div>
        <div>
          <div class="detail-title">${esc(data.name)}</div>
          <div class="detail-meta">
            ${data.industry ? `<span><i class="fas fa-industry"></i>${esc(data.industry)}</span>` : ''}
            ${data.city     ? `<span><i class="fas fa-map-marker-alt"></i>${esc(data.city)}</span>` : ''}
            ${data.category ? `<span><i class="fas fa-tag"></i>${esc(data.category)}</span>` : ''}
            ${data.phone    ? `<span><i class="fas fa-phone"></i>${esc(data.phone)}</span>` : ''}
          </div>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="openCompanyForm(${id});"><i class="fas fa-pen"></i> Edit</button>
        </div>
      </div>
      <div class="detail-stats">
        <div class="detail-stat"><div class="detail-stat-val">${data.contacts.length}</div><div class="detail-stat-lbl">Contacts</div></div>
        <div class="detail-stat"><div class="detail-stat-val">${data.deals.length}</div><div class="detail-stat-lbl">Deals</div></div>
        <div class="detail-stat"><div class="detail-stat-val">${data.activities.length}</div><div class="detail-stat-lbl">Activities</div></div>
        <div class="detail-stat"><div class="detail-stat-val" style="font-size:15px;">${fmtMoney(data.deals.filter(d=>d.stage!=='won'&&d.stage!=='lost').reduce((s,d)=>s+(d.value||0),0))}</div><div class="detail-stat-lbl">Pipeline</div></div>
      </div>
      <div class="detail-tabs">
        <button class="detail-tab active" data-tab="activities" onclick="switchDetailTab('activities')"><i class="fas fa-calendar-check"></i> Activities (${data.activities.length})</button>
        <button class="detail-tab" data-tab="contacts" onclick="switchDetailTab('contacts')"><i class="fas fa-users"></i> Contacts (${data.contacts.length})</button>
        <button class="detail-tab" data-tab="deals" onclick="switchDetailTab('deals')"><i class="fas fa-handshake"></i> Deals (${data.deals.length})</button>
      </div>
      <div class="detail-pane active" data-pane="activities">
        <button class="timeline-add-btn" onclick="quickLogActivity('company',${id})"><i class="fas fa-plus"></i> Log Activity / Note</button>
        ${renderTimeline(data.activities, 'company', id)}
      </div>
      <div class="detail-pane" data-pane="contacts">
        ${data.contacts.length ? `<table class="mini-table">
          <thead><tr><th>Name</th><th>Title</th><th>Lead Status</th><th>Phone</th></tr></thead>
          <tbody>${data.contacts.map(c=>`<tr>
            <td><span class="name-link" onclick="openContactDetail(${c.id})">${esc(c.first_name)} ${esc(c.last_name)}</span></td>
            <td>${esc(c.title||'—')}</td>
            <td>${c.lead_status?`<span class="badge badge-lead-status">${esc(c.lead_status)}</span>`:'—'}</td>
            <td>${esc(c.phone||'—')}</td>
          </tr>`).join('')}</tbody>
        </table>` : '<div style="text-align:center;padding:30px;color:var(--text-muted);">No contacts linked</div>'}
      </div>
      <div class="detail-pane" data-pane="deals">
        ${data.deals.length ? `<table class="mini-table">
          <thead><tr><th>Title</th><th>Stage</th><th>Value</th><th>Close Date</th></tr></thead>
          <tbody>${data.deals.map(d=>`<tr>
            <td>${esc(d.title)}</td>
            <td><span class="badge badge-${d.stage}">${esc(STAGE_LABELS[d.stage]||d.stage)}</span></td>
            <td style="font-weight:600;color:var(--primary);">${fmtMoney(d.value)}</td>
            <td>${fmtDate(d.close_date)}</td>
          </tr>`).join('')}</tbody>
        </table>` : '<div style="text-align:center;padding:30px;color:var(--text-muted);">No deals yet</div>'}
      </div>`;
  } catch(e) {
    showToast('Failed to load company: ' + e.message, 'error');
    closeModal();
  }
};

window.openContactDetail = async function(id) {
  openModal('Loading…', '<div class="spinner"></div>', 'modal-xl');
  try {
    const data = await api(`/api/contacts/${id}`);
    if (!data) return;
    const name = `${data.first_name} ${data.last_name}`;
    document.getElementById('modalTitle').textContent = name;
    document.getElementById('modalBody').innerHTML = `
      <div class="detail-header">
        <div class="detail-avatar" style="background:${avatarColor(data.first_name)}">
          ${esc(data.first_name[0])}${esc(data.last_name[0])}
        </div>
        <div>
          <div class="detail-title">${esc(name)}</div>
          <div class="detail-meta">
            ${data.title        ? `<span><i class="fas fa-briefcase"></i>${esc(data.title)}</span>` : ''}
            ${data.company_name ? `<span><i class="fas fa-building"></i>${esc(data.company_name)}</span>` : ''}
            ${data.lead_status  ? `<span><i class="fas fa-flag"></i>${esc(data.lead_status)}</span>` : ''}
            ${data.source       ? `<span><i class="fas fa-share-alt"></i>${esc(data.source)}</span>` : ''}
            ${data.email        ? `<span><i class="fas fa-envelope"></i>${esc(data.email)}</span>` : ''}
            ${data.phone        ? `<span><i class="fas fa-phone"></i>${esc(data.phone)}</span>` : ''}
          </div>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="openContactForm(${id});"><i class="fas fa-pen"></i> Edit</button>
        </div>
      </div>
      <div class="detail-stats">
        <div class="detail-stat"><div class="detail-stat-val">${data.deals.length}</div><div class="detail-stat-lbl">Deals</div></div>
        <div class="detail-stat"><div class="detail-stat-val">${data.activities.length}</div><div class="detail-stat-lbl">Activities</div></div>
        <div class="detail-stat"><div class="detail-stat-val" style="font-size:15px;">${fmtMoney(data.deals.filter(d=>d.stage!=='won'&&d.stage!=='lost').reduce((s,d)=>s+(d.value||0),0))}</div><div class="detail-stat-lbl">Pipeline</div></div>
      </div>
      <div class="detail-tabs">
        <button class="detail-tab active" data-tab="activities" onclick="switchDetailTab('activities')"><i class="fas fa-calendar-check"></i> Activities (${data.activities.length})</button>
        <button class="detail-tab" data-tab="deals" onclick="switchDetailTab('deals')"><i class="fas fa-handshake"></i> Deals (${data.deals.length})</button>
      </div>
      <div class="detail-pane active" data-pane="activities">
        <button class="timeline-add-btn" onclick="quickLogActivity('contact',${id})"><i class="fas fa-plus"></i> Log Activity / Note</button>
        ${renderTimeline(data.activities, 'contact', id)}
      </div>
      <div class="detail-pane" data-pane="deals">
        ${data.deals.length ? `<table class="mini-table">
          <thead><tr><th>Title</th><th>Stage</th><th>Value</th><th>Close Date</th></tr></thead>
          <tbody>${data.deals.map(d=>`<tr>
            <td>${esc(d.title)}</td>
            <td><span class="badge badge-${d.stage}">${esc(STAGE_LABELS[d.stage]||d.stage)}</span></td>
            <td style="font-weight:600;color:var(--primary);">${fmtMoney(d.value)}</td>
            <td>${fmtDate(d.close_date)}</td>
          </tr>`).join('')}</tbody>
        </table>` : '<div style="text-align:center;padding:30px;color:var(--text-muted);">No deals yet</div>'}
      </div>`;
  } catch(e) {
    showToast('Failed to load contact: ' + e.message, 'error');
    closeModal();
  }
};

window.switchDetailTab = function(tab) {
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.detail-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
};

window.quickLogActivity = function(entityType, entityId) {
  const field = entityType === 'company' ? 'company_id' : 'contact_id';
  openModal('Log Activity / Note', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Title *</label>
        <input id="ql_title" class="form-control" placeholder="e.g. Called client, Sent proposal...">
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select id="ql_type" class="form-control">
          ${['call','email','meeting','task','visit','note'].map(t=>`<option value="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input id="ql_date" class="form-control" type="datetime-local" value="${new Date().toISOString().slice(0,16)}">
      </div>
      <div class="form-group full">
        <label class="form-label"><i class="fas fa-bell" style="color:var(--warning);margin-right:4px;"></i>Set Reminder (optional)</label>
        <input id="ql_reminder" class="form-control" type="datetime-local" placeholder="Leave blank for no reminder">
      </div>
      <div class="form-group full">
        <label class="form-label">Notes / Description</label>
        <textarea id="ql_desc" class="form-control" rows="3" placeholder="What happened? Any details..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveQuickActivity('${entityType}',${entityId},'${field}')">Save</button>
    </div>`);
};

window.saveQuickActivity = async function(entityType, entityId, field) {
  const title = document.getElementById('ql_title').value.trim();
  if (!title) { showToast('Title is required', 'error'); return; }
  const body = {
    title,
    type:        document.getElementById('ql_type').value,
    due_date:    document.getElementById('ql_date').value || null,
    reminder_at: document.getElementById('ql_reminder')?.value || null,
    description: document.getElementById('ql_desc').value.trim(),
    [field]:     entityId,
  };
  try {
    await api('/api/activities', {method:'POST', body:JSON.stringify(body)});
    showToast('Activity logged');
    if (entityType === 'company') openCompanyDetail(entityId);
    else openContactDetail(entityId);
  } catch(e) { showToast(e.message, 'error'); }
};

/* ============================================================
   LISTS MANAGEMENT PAGE
   ============================================================ */

async function loadListsPage() {
  const container = document.getElementById('lists-grid-container');
  container.innerHTML = '<div class="spinner"></div>';
  try {
    State.lists = await api('/api/lists') || {};
    renderListsGrid();
  } catch(e) {
    container.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load lists');
  }
}

function renderListsGrid() {
  const container = document.getElementById('lists-grid-container');
  const sym = State.settings?.currency_symbol || 'EGP';
  const types = Object.keys(LIST_LABELS);
  container.innerHTML = `
    <div class="settings-card" style="margin-bottom:20px;padding:16px 20px;background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;">
        <i class="fas fa-coins" style="color:var(--primary);"></i> Currency Symbol
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:180px;">
        <input id="currency-sym-input" class="form-control" style="max-width:140px;height:36px;"
          value="${esc(sym)}" placeholder="e.g. EGP, $, €, £" maxlength="10"
          oninput="const p=document.getElementById('currency-preview');if(p)p.textContent=(this.value.trim()||'EGP')+' 1,000'"
          onkeydown="if(event.key==='Enter')saveCurrencySetting()">
        <button class="btn btn-primary" style="height:36px;padding:0 16px;" onclick="saveCurrencySetting()">
          <i class="fas fa-save"></i> Save
        </button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);">
        Preview: <strong id="currency-preview">${esc(sym)} 1,000</strong>
      </div>
    </div>
    <div class="lists-grid">
    ${types.map(type => {
      const items = State.lists[type] || [];
      return `<div class="list-col" data-type="${esc(type)}">
        <div class="list-col-header">
          <span class="list-col-title">${esc(LIST_LABELS[type])}</span>
          <small style="color:var(--text-light);font-size:10px;">${items.length}</small>
        </div>
        <div class="list-col-body" id="list-body-${esc(type)}">
          ${items.map(item => renderListCell(item)).join('')}
        </div>
        <div class="list-add-row">
          <input class="list-add-input" id="list-input-${esc(type)}" placeholder="Add new…" onkeydown="if(event.key==='Enter')addListItem('${esc(type)}')">
          <button class="list-add-btn" onclick="addListItem('${esc(type)}')">+</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;  // closes .lists-grid
}

window.saveCurrencySetting = async function() {
  const sym = document.getElementById('currency-sym-input')?.value.trim();
  if (!sym) { showToast('Enter a currency symbol', 'error'); return; }
  try {
    const updated = await api('/api/settings', { method: 'PUT', body: JSON.stringify({ currency_symbol: sym, currency: sym }) });
    State.settings = { ...State.settings, ...updated };
    document.getElementById('currency-preview').textContent = sym + ' 1,000';
    showToast('Currency updated to ' + sym, 'success');
  } catch(e) { showToast(e.message || 'Failed to save', 'error'); }
};

function renderListCell(item) {
  return `<div class="list-cell" data-id="${item.id}" data-type="${esc(item.list_type)}">
    <span class="list-cell-val" onclick="startEditListItem(${item.id})">${esc(item.value)}</span>
    <input class="list-cell-edit-input" value="${esc(item.value)}" onkeydown="if(event.key==='Enter')saveListItem(${item.id});if(event.key==='Escape')cancelEditListItem(${item.id})">
    <button class="list-cell-save" onclick="saveListItem(${item.id})">✓</button>
    <button class="list-cell-cancel" onclick="cancelEditListItem(${item.id})">✕</button>
    <button class="list-cell-del" onclick="deleteListItem(${item.id},'${esc(item.list_type)}')" title="Delete">×</button>
  </div>`;
}

window.startEditListItem = function(id) {
  const cell = document.querySelector(`.list-cell[data-id="${id}"]`);
  if (!cell) return;
  cell.classList.add('editing');
  cell.querySelector('.list-cell-edit-input').focus();
};

window.cancelEditListItem = function(id) {
  const cell = document.querySelector(`.list-cell[data-id="${id}"]`);
  if (cell) cell.classList.remove('editing');
};

window.saveListItem = async function(id) {
  const cell = document.querySelector(`.list-cell[data-id="${id}"]`);
  if (!cell) return;
  const value = cell.querySelector('.list-cell-edit-input').value.trim();
  if (!value) { showToast('Value cannot be empty', 'error'); return; }
  try {
    await api(`/api/list-items/${id}`, {method:'PUT', body:JSON.stringify({value})});
    showToast('Updated');
    cell.querySelector('.list-cell-val').textContent = value;
    cell.classList.remove('editing');
    const type = cell.dataset.type;
    if (State.lists[type]) {
      const item = State.lists[type].find(i=>i.id===id);
      if (item) item.value = value;
    }
  } catch(e) { showToast(e.message, 'error'); }
};

window.addListItem = async function(type) {
  const input = document.getElementById(`list-input-${type}`);
  const value = input?.value.trim();
  if (!value) { input?.focus(); return; }
  try {
    const item = await api(`/api/lists/${type}`, {method:'POST', body:JSON.stringify({value})});
    if (!item) return;
    if (!State.lists[type]) State.lists[type] = [];
    State.lists[type].push(item);
    const body = document.getElementById(`list-body-${type}`);
    if (body) body.insertAdjacentHTML('beforeend', renderListCell(item));
    input.value = '';
    input.focus();
    const countEl = document.querySelector(`.list-col[data-type="${type}"] .list-col-header small`);
    if (countEl) countEl.textContent = State.lists[type].length;
  } catch(e) { showToast(e.message, 'error'); }
};

window.deleteListItem = async function(id, type) {
  try {
    await api(`/api/list-items/${id}`, {method:'DELETE'});
    document.querySelector(`.list-cell[data-id="${id}"]`)?.remove();
    if (State.lists[type]) State.lists[type] = State.lists[type].filter(i=>i.id!==id);
    const countEl = document.querySelector(`.list-col[data-type="${type}"] .list-col-header small`);
    if (countEl) countEl.textContent = (State.lists[type]||[]).length;
  } catch(e) { showToast(e.message, 'error'); }
};

/* ============================================================
   EXPORT / IMPORT
   ============================================================ */
window.exportData = async function() {
  try {
    showToast('Preparing export…', 'info');
    const res = await fetch('/api/export/companies', {
      headers: { 'Authorization': `Bearer ${State.token}` }
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `companies-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported successfully', 'success');
  } catch(e) { showToast('Export failed: ' + e.message, 'error'); }
};

function parseCSV(text) {
  const lines = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];
  const parseRow = line => {
    const cols = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur=''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };
  const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseRow(line);
    const obj = {};
    headers.forEach((h,i) => { obj[h] = vals[i] !== undefined ? vals[i] : ''; });
    return obj;
  });
}

let _importTab = 'companies';

window.openImportModal = function(defaultTab) {
  _importTab = defaultTab || 'companies';
  openModal('Import Data', `
    <div>
      <div style="display:flex;gap:6px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:12px;">
        <button id="imp-tab-companies" onclick="switchImportTab('companies')"
          style="padding:6px 14px;border-radius:6px;border:1px solid var(--border);cursor:pointer;font-size:13px;background:${_importTab==='companies'?'var(--primary)':'#f8fafc'};color:${_importTab==='companies'?'white':'var(--text)'};">
          <i class="fas fa-building"></i> Companies
        </button>
        <button id="imp-tab-contacts" onclick="switchImportTab('contacts')"
          style="padding:6px 14px;border-radius:6px;border:1px solid var(--border);cursor:pointer;font-size:13px;background:${_importTab==='contacts'?'var(--primary)':'#f8fafc'};color:${_importTab==='contacts'?'white':'var(--text)'};">
          <i class="fas fa-users"></i> Contacts
        </button>
      </div>
      <div id="imp-help-companies" style="display:${_importTab==='companies'?'':'none'};background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:var(--text-muted);">
        <strong>Companies CSV columns:</strong> <code>name</code>, industry, city, country, phone, email, website, status, category, folder, notes, custom_id<br>
        Only <strong>name</strong> is required. Contacts can be imported separately.
      </div>
      <div id="imp-help-contacts" style="display:${_importTab==='contacts'?'':'none'};background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:var(--text-muted);">
        <strong>Contacts CSV columns:</strong> <code>first_name</code>, <code>last_name</code>, phone, email, title, company_name, lead_status, source, notes<br>
        <strong>first_name</strong> and <strong>last_name</strong> are required. company_name will match existing companies.
      </div>
      <div class="form-group">
        <label class="form-label">Upload CSV file</label>
        <input type="file" id="imp-file" accept=".csv,.txt" style="display:block;width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
      </div>
      <div style="text-align:center;color:var(--text-muted);font-size:12px;margin:6px 0;">— or paste CSV text —</div>
      <div class="form-group">
        <textarea id="imp-text" class="form-control" rows="5" placeholder="Paste CSV content here…" style="font-family:monospace;font-size:12px;"></textarea>
      </div>
      <div id="imp-preview" style="display:none;margin-top:10px;">
        <div id="imp-preview-label" style="font-size:12px;font-weight:600;margin-bottom:6px;"></div>
        <div id="imp-preview-table" style="overflow-x:auto;max-height:200px;overflow-y:auto;"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-secondary" onclick="previewImport()"><i class="fas fa-eye"></i> Preview</button>
      <button class="btn btn-primary" onclick="runImport()"><i class="fas fa-file-import"></i> Import</button>
    </div>`, 'modal-lg');
  document.getElementById('imp-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { document.getElementById('imp-text').value = ev.target.result; };
    reader.readAsText(file, 'UTF-8');
  });
};

window.switchImportTab = function(tab) {
  _importTab = tab;
  const active = 'var(--primary)', inact = '#f8fafc';
  const tabCo = document.getElementById('imp-tab-companies');
  const tabCt = document.getElementById('imp-tab-contacts');
  if (tabCo) { tabCo.style.background = tab==='companies'?active:inact; tabCo.style.color = tab==='companies'?'white':'var(--text)'; }
  if (tabCt) { tabCt.style.background = tab==='contacts'?active:inact; tabCt.style.color = tab==='contacts'?'white':'var(--text)'; }
  const hCo = document.getElementById('imp-help-companies');
  const hCt = document.getElementById('imp-help-contacts');
  if (hCo) hCo.style.display = tab==='companies' ? '' : 'none';
  if (hCt) hCt.style.display = tab==='contacts' ? '' : 'none';
  const prev = document.getElementById('imp-preview');
  if (prev) prev.style.display = 'none';
};

window.previewImport = function() {
  const text = document.getElementById('imp-text').value.trim();
  if (!text) { showToast('Please upload or paste CSV content first', 'warning'); return; }
  const rows = parseCSV(text);
  if (!rows.length) { showToast('No data rows found in CSV', 'warning'); return; }
  const preview = rows.slice(0, 5);
  const headers = Object.keys(preview[0]);
  const tableHtml = `<table style="width:100%;font-size:11px;border-collapse:collapse;white-space:nowrap;">
    <thead><tr>${headers.map(h=>`<th style="padding:4px 8px;background:#f1f5f9;border:1px solid var(--border);text-align:left;">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${preview.map(row=>`<tr>${headers.map(h=>`<td style="padding:4px 8px;border:1px solid var(--border);max-width:160px;overflow:hidden;text-overflow:ellipsis;">${esc(row[h]||'')}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
  document.getElementById('imp-preview-label').textContent = `Preview — ${rows.length} row${rows.length!==1?'s':''} found:`;
  document.getElementById('imp-preview-table').innerHTML = tableHtml;
  document.getElementById('imp-preview').style.display = '';
};

window.runImport = async function() {
  const text = document.getElementById('imp-text').value.trim();
  if (!text) { showToast('Please upload or paste CSV content first', 'warning'); return; }
  const rows = parseCSV(text);
  if (!rows.length) { showToast('No data rows found in CSV', 'warning'); return; }
  const endpoint = _importTab === 'contacts' ? '/api/import/contacts' : '/api/import';
  try {
    const result = await api(endpoint, { method: 'POST', body: JSON.stringify(rows) });
    if (!result) return;
    closeModal();
    const msg = `Imported ${result.created} record${result.created!==1?'s':''}${result.skipped?`, skipped ${result.skipped}`:''}`;
    showToast(msg, result.errors?.length ? 'warning' : 'success');
    if (_importTab === 'contacts') { State.contactCache = {}; loadContacts(); }
    else { State.companyCache = {}; loadCompanies(); }
  } catch(e) { showToast('Import failed: ' + e.message, 'error'); }
};

window.backupCompanies = async function() {
  try {
    showToast('Preparing backup…', 'info');
    const res = await fetch('/api/backup/companies', {
      headers: { 'Authorization': `Bearer ${State.token}` }
    });
    if (!res.ok) throw new Error('Backup failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `companies-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup downloaded', 'success');
  } catch(e) { showToast('Backup failed: ' + e.message, 'error'); }
};

window.openRestoreModal = function() {
  openModal('Restore from Backup', `
    <div>
      <div style="background:#fff8e1;border:1px solid #ffc107;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;">
        <i class="fas fa-exclamation-triangle" style="color:#f59e0b;margin-right:6px;"></i>
        <strong>Restore appends data</strong> — existing records are kept. All restored records are assigned to you. Relationships (contacts ↔ companies, deals, activities) are fully re-linked.
      </div>
      <div class="form-group">
        <label class="form-label">Select backup file (.json)</label>
        <input type="file" id="restore-file" accept=".json" style="display:block;width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
      </div>
      <div id="restore-preview" style="display:none;margin-top:12px;font-size:13px;"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="runRestore()"><i class="fas fa-upload"></i> Restore</button>
    </div>`, 'modal-lg');

  document.getElementById('restore-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.companies)) throw new Error('Missing companies array');
        document.getElementById('restore-preview').innerHTML = `
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;">
            <div style="font-weight:600;margin-bottom:8px;">Backup ready to restore:</div>
            <div style="display:flex;gap:18px;flex-wrap:wrap;">
              <span><i class="fas fa-building" style="color:var(--primary);margin-right:4px;"></i><strong>${(data.companies||[]).length}</strong> companies</span>
              <span><i class="fas fa-users" style="color:var(--primary);margin-right:4px;"></i><strong>${(data.contacts||[]).length}</strong> contacts</span>
              <span><i class="fas fa-handshake" style="color:var(--primary);margin-right:4px;"></i><strong>${(data.deals||[]).length}</strong> deals</span>
              <span><i class="fas fa-tasks" style="color:var(--primary);margin-right:4px;"></i><strong>${(data.activities||[]).length}</strong> activities</span>
            </div>
            ${data.exported_at ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted);">Exported: ${new Date(data.exported_at).toLocaleString()}</div>` : ''}
          </div>`;
        document.getElementById('restore-preview').style.display = '';
        document.getElementById('restore-file')._backupData = data;
      } catch(err) {
        showToast('Invalid backup file: ' + err.message, 'error');
        document.getElementById('restore-preview').style.display = 'none';
      }
    };
    reader.readAsText(file, 'UTF-8');
  });
};

window.runRestore = async function() {
  const input = document.getElementById('restore-file');
  const data = input?._backupData;
  if (!data || !Array.isArray(data.companies)) return showToast('Please select a valid backup file first', 'warning');
  try {
    const result = await api('/api/restore/companies', { method: 'POST', body: JSON.stringify(data) });
    if (!result) return;
    closeModal();
    showToast(
      `Restored: ${result.companies} companies, ${result.contacts} contacts, ${result.deals} deals, ${result.activities} activities`,
      'success'
    );
    State.companyCache = {};
    State.contactCache = {};
    loadCompanies();
  } catch(e) { showToast('Restore failed: ' + e.message, 'error'); }
};

/* ============================================================
   NAV WIRING
   ============================================================ */
function initNav() {
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mobile-open');
      document.getElementById('mobile-backdrop').classList.toggle('show', sidebar.classList.contains('mobile-open'));
    } else {
      sidebar.classList.toggle('collapsed');
    }
  });

  document.getElementById('mobile-backdrop').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('mobile-backdrop').classList.remove('show');
  });

  // Close mobile sidebar on nav link click
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('mobile-open');
        document.getElementById('mobile-backdrop').classList.remove('show');
      }
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', doLogout);

  window.addEventListener('hashchange', () => navigateTo(location.hash.slice(1)));
}

/* ============================================================
   PRELOAD shared data before opening forms
   ============================================================ */
async function preloadSharedData() {
  try {
    const fetches = [api('/api/companies'), api('/api/contacts'), api('/api/lists'), api('/api/settings')];
    if (State.currentUser?.role === 'manager') fetches.push(api('/api/users'));
    const [cos, cons, lists, settings, users] = await Promise.all(fetches);
    State.companies = cos || [];
    State.contacts  = cons || [];
    State.lists     = lists || {};
    if (settings) State.settings = settings;
    if (users) State.users = users;
    await loadCustomFields();
  } catch (_) {}
}

function listOptions(type, selectedValue = '') {
  const items = State.lists[type] || [];
  return items.map(item =>
    `<option value="${esc(item.value)}" ${selectedValue === item.value ? 'selected' : ''}>${esc(item.value)}</option>`
  ).join('');
}

/* ============================================================
   GLOBAL SEARCH
   ============================================================ */
function initGlobalSearch() {
  const input = document.getElementById('globalSearch');
  const results = document.getElementById('globalSearchResults');
  if (!input || !results) return;

  let searchTimer;
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { results.classList.remove('open'); return; }
    searchTimer = setTimeout(async () => {
      try {
        const data = await api(`/api/search?q=${encodeURIComponent(q)}`);
        renderSearchResults(data, results, input);
      } catch(_) {}
    }, 250);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { results.classList.remove('open'); input.value = ''; }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.topbar-search')) results.classList.remove('open');
  });
}

function renderSearchResults(data, container, input) {
  const { contacts = [], companies = [], deals = [] } = data;
  if (!contacts.length && !companies.length && !deals.length) {
    container.innerHTML = `<div class="search-empty">No results found</div>`;
    container.classList.add('open');
    return;
  }
  const section = (icon, label, items, renderFn) => items.length ? `
    <div class="search-section-label"><i class="fas ${icon}"></i> ${label}</div>
    ${items.map(renderFn).join('')}` : '';

  container.innerHTML =
    section('fa-users', 'Contacts', contacts, c => `
      <div class="search-result-item" onclick="closeSearchAndGo('contacts',${c.id})">
        <div class="search-result-avatar" style="background:${avatarColor(c.first_name)}">${esc(c.first_name[0]||'?')}</div>
        <div><div class="search-result-name">${esc(c.first_name)} ${esc(c.last_name||'')}</div>
        <div class="search-result-sub">${esc(c.phone||'')} ${c.lead_status?`· ${esc(c.lead_status)}`:''}</div></div>
      </div>`) +
    section('fa-building', 'Companies', companies, co => `
      <div class="search-result-item" onclick="closeSearchAndGo('companies',${co.id})">
        <div class="search-result-avatar" style="background:${avatarColor(co.name)};border-radius:6px;">${esc(co.name.slice(0,2).toUpperCase())}</div>
        <div><div class="search-result-name">${esc(co.name)}</div>
        <div class="search-result-sub">${esc(co.city||'')} ${co.status?`· ${esc(co.status)}`:''}</div></div>
      </div>`) +
    section('fa-handshake', 'Deals', deals, d => `
      <div class="search-result-item" onclick="closeSearchAndGo('deals',${d.id})">
        <div class="search-result-avatar" style="background:${STAGE_COLORS[d.stage]||'#6b7280'};border-radius:6px;"><i class="fas fa-handshake" style="font-size:11px;"></i></div>
        <div><div class="search-result-name">${esc(d.title)}</div>
        <div class="search-result-sub">${STAGE_LABELS[d.stage]||d.stage} · ${fmtMoney(d.value)}</div></div>
      </div>`);

  container.classList.add('open');
}

window.closeSearchAndGo = function(page, id) {
  const input = document.getElementById('globalSearch');
  const results = document.getElementById('globalSearchResults');
  if (input) input.value = '';
  if (results) results.classList.remove('open');
  navigateTo(page);
  setTimeout(() => {
    if (page === 'contacts') window.selectContact?.(id);
    else if (page === 'companies') window.selectCompany?.(id);
  }, 400);
};

function normalizeWaPhone(phone) {
  const clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('00')) return clean.slice(2);
  if (clean.startsWith('0')) return '20' + clean.slice(1);
  return clean;
}

window.openWhatsApp = function(phone) {
  const num = normalizeWaPhone(phone);
  window.open(`https://wa.me/${num}`, '_blank');
};

/* ============================================================
   BULK ACTIONS
   ============================================================ */
window.selectAllBulk = function(type, checked) {
  const key    = type === 'contacts' ? 'bulkContacts' : 'bulkCompanies';
  const prefix = type === 'contacts' ? 'ct' : 'co';
  const checks = document.querySelectorAll(`#${prefix}-list-panel .bulk-check`);
  if (checked) {
    State[key] = [];
    checks.forEach(cb => { cb.checked = true; State[key].push(parseInt(cb.dataset.id)); });
  } else {
    State[key] = [];
    checks.forEach(cb => { cb.checked = false; });
  }
  syncSelectAllCb(type);
  renderBulkBar(type);
};

function syncSelectAllCb(type) {
  const key    = type === 'contacts' ? 'bulkContacts' : 'bulkCompanies';
  const prefix = type === 'contacts' ? 'ct' : 'co';
  const cb     = document.getElementById(`${prefix}-select-all-cb`);
  if (!cb) return;
  const total = document.querySelectorAll(`#${prefix}-list-panel .bulk-check`).length;
  const sel   = State[key].length;
  cb.indeterminate = sel > 0 && sel < total;
  cb.checked       = sel > 0 && sel === total;
}

window.toggleBulk = function(type, id, checked) {
  const key = type === 'contacts' ? 'bulkContacts' : 'bulkCompanies';
  if (checked) { if (!State[key].includes(id)) State[key].push(id); }
  else { State[key] = State[key].filter(x => x !== id); }
  syncSelectAllCb(type);
  renderBulkBar(type);
};

function renderBulkBar(type) {
  const key   = type === 'contacts' ? 'bulkContacts' : 'bulkCompanies';
  const barId = type === 'contacts' ? 'ct-bulk-bar' : 'co-bulk-bar';
  const bar   = document.getElementById(barId);
  if (!bar) return;
  const count = State[key].length;
  if (!count) { bar.style.display = 'none'; bar.innerHTML = ''; return; }

  const isManager = State.currentUser?.role === 'manager';
  const listType  = type === 'contacts' ? 'lead_status' : 'company_status';
  const listItems = (State.lists[listType] || []).map(i => `<option value="${esc(i.value)}">${esc(i.value)}</option>`).join('');
  const userOpts  = isManager ? (State.users||[]).map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('') : '';

  bar.style.display = 'flex';
  bar.innerHTML = `
    <span class="bulk-count"><i class="fas fa-check-square"></i> ${count} selected</span>
    <div class="bulk-actions">
      <select id="bulk-status-sel" class="form-control" style="height:32px;font-size:12px;max-width:160px;">
        <option value="">— Change ${type==='contacts'?'Lead Status':'Status'} —</option>
        ${listItems}
      </select>
      <button class="btn btn-secondary" style="height:32px;font-size:12px;" onclick="applyBulkStatus('${type}')">Apply</button>
      ${isManager ? `<select id="bulk-user-sel" class="form-control" style="height:32px;font-size:12px;max-width:140px;"><option value="">— Assign to —</option>${userOpts}</select>
      <button class="btn btn-secondary" style="height:32px;font-size:12px;" onclick="applyBulkAssign('${type}')">Assign</button>` : ''}
      <button class="btn btn-danger" style="height:32px;font-size:12px;" onclick="applyBulkDelete('${type}')"><i class="fas fa-trash"></i> Delete</button>
      <button class="btn btn-secondary" style="height:32px;font-size:12px;" onclick="clearBulk('${type}')">Clear</button>
    </div>`;
}

window.clearBulk = function(type) {
  const key    = type === 'contacts' ? 'bulkContacts' : 'bulkCompanies';
  const prefix = type === 'contacts' ? 'ct' : 'co';
  State[key] = [];
  document.querySelectorAll(`#${prefix}-list-panel .bulk-check`).forEach(cb => cb.checked = false);
  const saCb = document.getElementById(`${prefix}-select-all-cb`);
  if (saCb) { saCb.checked = false; saCb.indeterminate = false; }
  renderBulkBar(type);
};

window.applyBulkStatus = async function(type) {
  const key   = type === 'contacts' ? 'bulkContacts' : 'bulkCompanies';
  const value = document.getElementById('bulk-status-sel')?.value;
  if (!value || !State[key].length) { showToast('Select a status first', 'error'); return; }
  const action = type === 'contacts' ? 'lead_status' : 'status';
  try {
    await api(`/api/bulk/${type}`, { method: 'POST', body: JSON.stringify({ ids: State[key], action, value }) });
    showToast(`Updated ${State[key].length} ${type}`);
    clearBulk(type);
    type === 'contacts' ? loadContacts() : loadCompanies();
  } catch(e) { showToast(e.message, 'error'); }
};

window.applyBulkAssign = async function(type) {
  const key   = type === 'contacts' ? 'bulkContacts' : 'bulkCompanies';
  const value = parseInt(document.getElementById('bulk-user-sel')?.value);
  if (!value || !State[key].length) { showToast('Select a user first', 'error'); return; }
  try {
    await api(`/api/bulk/${type}`, { method: 'POST', body: JSON.stringify({ ids: State[key], action: 'assign', value }) });
    showToast(`Assigned ${State[key].length} ${type}`);
    clearBulk(type);
    type === 'contacts' ? loadContacts() : loadCompanies();
  } catch(e) { showToast(e.message, 'error'); }
};

window.applyBulkDelete = function(type) {
  const key = type === 'contacts' ? 'bulkContacts' : 'bulkCompanies';
  if (!State[key].length) return;
  confirmDialog(`Delete ${State[key].length} ${type}?`, 'This cannot be undone.', async () => {
    try {
      await api(`/api/bulk/${type}`, { method: 'POST', body: JSON.stringify({ ids: State[key], action: 'delete' }) });
      showToast(`Deleted ${State[key].length} ${type}`);
      State[key] = [];
      renderBulkBar(type);
      type === 'contacts' ? loadContacts() : loadCompanies();
    } catch(e) { showToast(e.message, 'error'); }
  });
};

/* ============================================================
   REPORTS
   ============================================================ */
let _reportCharts = [];
function destroyReportCharts() { _reportCharts.forEach(c => { try { c.destroy(); } catch(_){} }); _reportCharts = []; }

function mkChart(id, config) {
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return;
  const c = new Chart(ctx, config);
  _reportCharts.push(c);
  return c;
}

async function loadReports() {
  const container = document.getElementById('reports-content');
  if (!container) return;

  // Date range bar (rendered once)
  if (!document.getElementById('report-range-bar')) {
    const today = new Date();
    const y = today.getFullYear(), m = String(today.getMonth()+1).padStart(2,'0');
    const defaultFrom = `${y}-01-01`;
    const defaultTo   = `${y}-${m}-${today.getDate().toString().padStart(2,'0')}`;
    container.insertAdjacentHTML('beforebegin', `
      <div id="report-range-bar" class="report-range-bar">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:13px;font-weight:600;color:var(--text-muted);">Date range:</span>
          <button class="rng-btn active" data-range="ytd">Year to Date</button>
          <button class="rng-btn" data-range="30">Last 30 days</button>
          <button class="rng-btn" data-range="90">Last 90 days</button>
          <button class="rng-btn" data-range="12m">Last 12 months</button>
          <button class="rng-btn" data-range="custom">Custom</button>
          <span id="custom-range-inputs" style="display:none;gap:6px;align-items:center;display:none;">
            <input type="date" id="rng-from" class="form-control" style="height:32px;width:140px;" value="${defaultFrom}">
            <span style="color:var(--text-muted);">→</span>
            <input type="date" id="rng-to"   class="form-control" style="height:32px;width:140px;" value="${defaultTo}">
            <button class="btn btn-sm btn-primary" onclick="applyReportRange()">Apply</button>
          </span>
        </div>
        <a class="btn btn-sm btn-secondary" id="report-export-btn" href="/api/export/companies" style="margin-left:auto;" title="Export data">
          <i class="fas fa-file-export"></i> Export CSV
        </a>
      </div>`);
    document.querySelectorAll('.rng-btn').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.rng-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const ci = document.getElementById('custom-range-inputs');
      if (b.dataset.range === 'custom') { ci.style.display = 'flex'; return; }
      ci.style.display = 'none';
      applyReportRange(b.dataset.range);
    }));
  }

  container.innerHTML = '<div class="spinner"></div>';
  const { from, to } = getReportDateRange();
  try {
    const params = (from && to) ? `?from=${from}&to=${to}` : '';
    const data = await api(`/api/reports${params}`);
    renderReports(data);
  } catch(e) {
    container.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load reports', e.message);
  }
}

function getReportDateRange() {
  const active = document.querySelector('.rng-btn.active')?.dataset.range || 'ytd';
  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const to = fmt(today);
  if (active === 'custom') {
    return { from: document.getElementById('rng-from')?.value, to: document.getElementById('rng-to')?.value };
  }
  if (active === '30') { const d = new Date(today); d.setDate(d.getDate()-30); return { from: fmt(d), to }; }
  if (active === '90') { const d = new Date(today); d.setDate(d.getDate()-90); return { from: fmt(d), to }; }
  if (active === '12m'){ const d = new Date(today); d.setFullYear(d.getFullYear()-1); return { from: fmt(d), to }; }
  // ytd
  return { from: `${today.getFullYear()}-01-01`, to };
}

window.applyReportRange = function() { loadReports(); };

function renderReports({ revenueByMonth, leadFunnel, activityByType, activityByUser, dealStages, topCompanies, winLoss }) {
  destroyReportCharts();
  const container = document.getElementById('reports-content');

  const totalRevenue = revenueByMonth.reduce((s,r) => s+r.revenue, 0);
  const totalWon     = winLoss.find(r => r.stage==='won');
  const totalLost    = winLoss.find(r => r.stage==='lost');
  const winRate      = (totalWon?.count||0) + (totalLost?.count||0) > 0
    ? Math.round((totalWon?.count||0) / ((totalWon?.count||0)+(totalLost?.count||0)) * 100) : 0;
  const totalActs    = activityByUser.reduce((s,r) => s+r.total, 0);

  container.innerHTML = `
    <div class="stats-grid" style="margin-bottom:20px;">
      ${statCard('fa-trophy',    'Won Revenue',    fmtMoney(totalRevenue),       '#10b981')}
      ${statCard('fa-handshake', 'Won Deals',      totalWon?.count||0,           '#8b5cf6')}
      ${statCard('fa-percentage','Win Rate',       winRate+'%',                  '#3b82f6')}
      ${statCard('fa-bolt',      'Activities',     totalActs,                    '#f59e0b')}
    </div>

    <div class="reports-grid">
      <div class="card dash-card" style="grid-column:1/-1;">
        <div class="dash-card-title"><i class="fas fa-chart-line" style="color:var(--primary);margin-right:6px;"></i>Revenue Trend</div>
        <div class="chart-wrapper" style="height:200px;"><canvas id="revenueChart"></canvas></div>
      </div>
    </div>

    <div class="reports-grid" style="margin-top:16px;">
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-funnel-dollar" style="color:var(--warning);margin-right:6px;"></i>Deal Pipeline</div>
        <div class="chart-wrapper"><canvas id="stageChart"></canvas></div>
      </div>
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-tasks" style="color:#10b981;margin-right:6px;"></i>Activity by Type</div>
        <div class="chart-wrapper"><canvas id="actTypeChart"></canvas></div>
      </div>
    </div>

    <div class="reports-grid" style="margin-top:16px;">
      <div class="card dash-card">
        <div class="dash-card-title" style="justify-content:space-between;">
          <span><i class="fas fa-user-clock" style="color:#8b5cf6;margin-right:6px;"></i>Activity by User</span>
        </div>
        <div class="report-user-list">
          ${activityByUser.length ? activityByUser.map(u => {
            const pct = activityByUser[0]?.total ? Math.round(u.total/activityByUser[0].total*100) : 0;
            return `<div class="report-user-row">
              <div class="report-user-av" style="background:${avatarColor(u.user_name||'?')}">${initials(u.user_name||'?')}</div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <span style="font-size:13px;font-weight:600;">${esc(u.user_name||'—')}</span>
                  <span style="font-size:12px;color:var(--text-muted);">${u.total} total · ${u.done} done · ${u.calls} calls</span>
                </div>
                <div class="report-bar-bg"><div class="report-bar-fill" style="width:${pct}%;background:${avatarColor(u.user_name||'?')};"></div></div>
              </div>
            </div>`;
          }).join('') : '<div style="padding:20px;text-align:center;color:var(--text-muted);">No activity data</div>'}
        </div>
      </div>
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-building" style="color:#3b82f6;margin-right:6px;"></i>Top Companies</div>
        ${topCompanies.length ? `<table class="report-table">
          <thead><tr><th>Company</th><th style="text-align:right;">Won</th><th style="text-align:center;">Deals</th></tr></thead>
          <tbody>${topCompanies.map((c,i) => `<tr>
            <td><span class="lb-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}" style="display:inline-flex;margin-right:6px;">${i+1}</span>${esc(c.name)}</td>
            <td style="text-align:right;font-weight:600;color:var(--success);">${fmtMoney(c.total_value)}</td>
            <td style="text-align:center;">${c.deal_count}</td>
          </tr>`).join('')}</tbody>
        </table>` : '<div style="padding:20px;text-align:center;color:var(--text-muted);">No won deals yet</div>'}
      </div>
    </div>

    <div class="reports-grid" style="margin-top:16px;">
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-filter" style="color:var(--primary);margin-right:6px;"></i>Lead Status Breakdown</div>
        <div class="chart-wrapper"><canvas id="funnelChart"></canvas></div>
      </div>
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-balance-scale" style="color:var(--danger);margin-right:6px;"></i>Won vs Lost</div>
        <div class="chart-wrapper"><canvas id="winlossChart"></canvas></div>
      </div>
    </div>`;

  // Revenue trend line
  mkChart('revenueChart', {
    type: 'line',
    data: {
      labels: revenueByMonth.map(r => r.month || ''),
      datasets: [
        { label: 'Revenue', data: revenueByMonth.map(r => r.revenue), borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.1)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 4 },
        { label: 'Deals',   data: revenueByMonth.map(r => r.deals_count), borderColor: '#10b981', backgroundColor: 'transparent', borderWidth: 2, tension: 0.4, yAxisID: 'y2', pointRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { font: { size: 11 }, usePointStyle: true } } },
      scales: {
        y:  { position: 'left',  ticks: { callback: v => fmtMoney(v), font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y2: { position: 'right', ticks: { font: { size: 11 } }, grid: { display: false } },
        x:  { ticks: { font: { size: 11 } }, grid: { display: false } },
      },
    },
  });

  // Deal stages bar
  const stageOrder = ['lead','qualified','proposal','negotiation','won','lost'];
  const sorted = stageOrder.map(s => dealStages.find(d => d.stage===s)).filter(Boolean);
  mkChart('stageChart', {
    type: 'bar',
    data: {
      labels: sorted.map(d => STAGE_LABELS[d.stage]||d.stage),
      datasets: [{ label: 'Deals', data: sorted.map(d => d.count), backgroundColor: sorted.map(d => STAGE_COLORS[d.stage]||'#9ca3af'), borderRadius: 6 }],
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{ticks:{font:{size:11}}},x:{ticks:{font:{size:11}}}} },
  });

  // Activity by type horizontal bar
  mkChart('actTypeChart', {
    type: 'bar',
    data: {
      labels: activityByType.map(a => a.type),
      datasets: [
        { label: 'Total', data: activityByType.map(a => a.total), backgroundColor: activityByType.map(a => { const m={call:'#3b82f6',visit:'#10b981',email:'#f59e0b',meeting:'#8b5cf6',task:'#ef4444',note:'#6b7280'}; return m[a.type]||'#9ca3af'; }), borderRadius: 6 },
        { label: 'Done',  data: activityByType.map(a => a.done),  backgroundColor: 'rgba(16,185,129,0.3)', borderRadius: 6 },
      ],
    },
    options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top',labels:{font:{size:11},usePointStyle:true}}}, scales:{x:{ticks:{font:{size:11}}},y:{ticks:{font:{size:11}}}} },
  });

  // Lead funnel doughnut
  if (leadFunnel.length) mkChart('funnelChart', {
    type: 'doughnut',
    data: { labels: leadFunnel.map(r=>r.lead_status), datasets:[{ data: leadFunnel.map(r=>r.count), backgroundColor: leadFunnel.map((_,i)=>`hsl(${i*36},65%,55%)`), borderWidth:2, borderColor:'transparent' }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ font:{size:11}, padding:8, usePointStyle:true } } } },
  });

  // Win/Loss
  if (winLoss.length) mkChart('winlossChart', {
    type: 'doughnut',
    data: { labels: ['Won','Lost'], datasets:[{ data:[totalWon?.count||0, totalLost?.count||0], backgroundColor:['#10b981','#ef4444'], borderWidth:2, borderColor:'transparent' }] },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ position:'bottom', labels:{ font:{size:12}, usePointStyle:true } },
        tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.raw} (${fmtMoney(ctx.label==='Won'?totalWon?.value||0:totalLost?.value||0)})` } }
      }
    },
  });
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
let _notifPollTimer = null;

async function loadNotifications() {
  try {
    const data = await api('/api/notifications', { _silent: true });
    const unread = data.unread || 0;
    const dot = document.getElementById('notifDot');
    const bell = document.querySelector('.notification-bell');
    if (dot) dot.style.display = unread > 0 ? '' : 'none';
    if (dot) dot.textContent = unread > 0 ? (unread > 9 ? '9+' : unread) : '';
    if (bell) bell._notifData = data.notifications || [];
    // Fire browser notification only when new items arrive after initial load
    if (_lastUnreadCount >= 0 && unread > _lastUnreadCount) {
      const newest = (data.notifications || []).find(n => !n.read);
      if (newest) fireBrowserNotif(newest.title, newest.body || '');
    }
    _lastUnreadCount = unread;
  } catch(e) {
    // Swallow network errors; 401 is handled inside api() via doLogout()
  }
}

let _lastUnreadCount = -1;
let _browserNotifGranted = false;

function requestBrowserNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { _browserNotifGranted = true; return; }
  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => { _browserNotifGranted = p === 'granted'; });
  }
}

function fireBrowserNotif(title, body) {
  if (!_browserNotifGranted || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/favicon.ico', tag: 'crm-notif' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch(_) {}
}

function initNotifications() {
  try { requestBrowserNotifPermission(); } catch(_) {}
  // Clear any previous poll so repeated logins don't stack timers
  if (_notifPollTimer) { clearInterval(_notifPollTimer); _notifPollTimer = null; }
  _lastUnreadCount = -1;
  loadNotifications();
  _notifPollTimer = setInterval(loadNotifications, 30000);

  const bell = document.querySelector('.notification-bell');
  if (!bell) return;
  // Guard against re-binding on repeated logins
  if (bell._notifBound) return;
  bell._notifBound = true;
  bell.style.cursor = 'pointer';
  bell.addEventListener('click', () => {
    const existing = document.getElementById('notif-dropdown');
    if (existing) { existing.remove(); return; }
    const notifs = bell._notifData || [];
    api('/api/notifications/read', { method: 'PUT' }).then(() => {
      loadNotifications();
    });
    const drop = document.createElement('div');
    drop.id = 'notif-dropdown';
    drop.className = 'notif-dropdown';
    drop.innerHTML = `
      <div class="notif-header"><i class="fas fa-bell"></i> Notifications</div>
      ${notifs.length ? notifs.map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotifClick(${n.link_id},'${n.link_type}')">
          <div class="notif-icon ${n.type === 'company_assigned' ? 'company' : 'task'}">
            <i class="fas ${n.type === 'company_assigned' ? 'fa-building' : 'fa-check-square'}"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div class="notif-title">${esc(n.title)}</div>
            <div class="notif-body">${esc(n.body || '')}</div>
            <div class="notif-time">${fmtDate(n.created_at)}</div>
          </div>
        </div>`).join('') : '<div class="notif-empty">No notifications</div>'}`;
    bell.appendChild(drop);
    setTimeout(() => document.addEventListener('click', function close(e) {
      if (!drop.contains(e.target) && !bell.contains(e.target)) { drop.remove(); document.removeEventListener('click', close); }
    }), 0);
  });
}

window.handleNotifClick = function(linkId, linkType) {
  document.getElementById('notif-dropdown')?.remove();
  if (linkType === 'company' && linkId) {
    navigateTo('companies');
    setTimeout(() => openCompanyDetail(linkId), 300);
  } else if (linkType === 'task') {
    navigateTo('tasks');
  }
};

/* ============================================================
   CALENDAR PAGE
   ============================================================ */
let _calState = { year: new Date().getFullYear(), month: new Date().getMonth() };

async function loadCalendar() {
  const container = document.getElementById('calendar-content');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const { year, month } = _calState;
    const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
    const data = await api(`/api/calendar?month=${monthStr}`);
    renderCalendar(data.events || []);
  } catch(e) {
    document.getElementById('calendar-content').innerHTML =
      emptyState('fa-exclamation-circle', 'Failed to load calendar', e.message);
  }
}

function renderCalendar(events) {
  const container = document.getElementById('calendar-content');
  if (!container) return;
  const { year, month } = _calState;
  const today = new Date();
  const isToday = (d) => d.getFullYear()===today.getFullYear() && d.getMonth()===today.getMonth() && d.getDate()===today.getDate();

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Build event map: key = "YYYY-MM-DD" → array of events
  const evMap = {};
  for (const ev of events) {
    const key = (ev.due_date || '').slice(0,10);
    if (!evMap[key]) evMap[key] = [];
    evMap[key].push(ev);
  }

  // Calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const totalCells = Math.ceil((startDow + lastDay.getDate()) / 7) * 7;

  const dayOfWeeks = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let cells = '';
  for (let i = 0; i < totalCells; i++) {
    const date = new Date(year, month, i - startDow + 1);
    const isOther = date.getMonth() !== month;
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const dayEvs = evMap[key] || [];
    const showMax = 3;
    const more = dayEvs.length - showMax;
    const todayCls = isToday(date) ? ' today' : '';
    const otherCls = isOther ? ' other-month' : '';
    const evHTML = dayEvs.slice(0, showMax).map(ev => {
      const evDate = new Date(ev.due_date);
      const isOverdue = !ev.completed && evDate < today && !isToday(evDate);
      const cls = isOverdue ? 'overdue' : (ev.type||'task');
      return `<div class="cal-event ${cls}" title="${esc(ev.title)}" onclick="calEventClick(${ev.id},event)">${esc(ev.title)}</div>`;
    }).join('');
    cells += `
      <div class="cal-cell${todayCls}${otherCls}" data-date="${key}">
        <div class="cal-day-num">${date.getDate()}</div>
        <div class="cal-events" data-count="${dayEvs.length}">${evHTML}${more > 0 ? `<div class="cal-more">+${more} more</div>` : ''}</div>
      </div>`;
  }

  container.innerHTML = `
    <div class="cal-header">
      <div class="cal-nav">
        <button class="cal-nav-btn" onclick="calNav(-1)"><i class="fas fa-chevron-left"></i></button>
        <div class="cal-title">${monthNames[month]} ${year}</div>
        <button class="cal-nav-btn" onclick="calNav(1)"><i class="fas fa-chevron-right"></i></button>
        <button class="cal-today-btn" onclick="calGoToday()">Today</button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);">${events.length} event${events.length!==1?'s':''} this month</div>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="cal-grid">
        ${dayOfWeeks.map(d => `<div class="cal-dow">${d}</div>`).join('')}
        ${cells}
      </div>
    </div>
    <div class="cal-legend">
      ${[['call','#dbeafe','#1d4ed8'],['email','#fef3c7','#b45309'],['meeting','#ede9fe','#6d28d9'],['task','#d1fae5','#065f46'],['visit','#fce7f3','#be185d'],['overdue','#fee2e2','#b91c1c']]
        .map(([t,bg,c]) => `<div class="cal-legend-item"><div class="cal-legend-dot" style="background:${bg};border:1px solid ${c};"></div><span>${t.charAt(0).toUpperCase()+t.slice(1)}</span></div>`).join('')}
    </div>`;
}

window.calNav = function(dir) {
  _calState.month += dir;
  if (_calState.month > 11) { _calState.month = 0; _calState.year++; }
  if (_calState.month < 0)  { _calState.month = 11; _calState.year--; }
  loadCalendar();
};

window.calGoToday = function() {
  const t = new Date();
  _calState.year = t.getFullYear();
  _calState.month = t.getMonth();
  loadCalendar();
};

window.calEventClick = function(id, e) {
  e.stopPropagation();
  navigateTo('activities');
};

/* ============================================================
   MY TEAM PAGE (Team Leader)
   ============================================================ */
async function loadTeamPage() {
  const container = document.getElementById('team-content');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const data = await api('/api/team');
    renderTeamPage(data);
  } catch(e) {
    container.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load team', e.message);
  }
}

function renderTeamPage({ members }) {
  const container = document.getElementById('team-content');
  const subtitle = document.getElementById('team-subtitle');
  if (subtitle) subtitle.textContent = `${members.length} member${members.length !== 1 ? 's' : ''} on your team`;

  if (!members.length) {
    container.innerHTML = emptyState('fa-users-cog', 'No sales users assigned to you yet',
      'Ask your manager to assign sales users to your team.');
    return;
  }

  container.innerHTML = `<div class="team-members-grid">${members.map(m => `
    <div class="team-member-card card">
      <div class="team-member-header">
        <div class="entity-card-avatar" style="background:${avatarColor(m.name)};width:42px;height:42px;font-size:15px;">${initials(m.name)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:600;">${esc(m.name)}</div>
          <div style="font-size:12px;color:var(--text-muted);">${m.email ? esc(m.email) : 'No email'}</div>
        </div>
        <span class="badge badge-role-sales">Sales</span>
      </div>
      <div class="team-member-stats">
        <div class="tm-stat"><div class="tm-stat-val">${m.companies}</div><div class="tm-stat-lbl">Companies</div></div>
        <div class="tm-stat"><div class="tm-stat-val">${m.contacts}</div><div class="tm-stat-lbl">Contacts</div></div>
        <div class="tm-stat"><div class="tm-stat-val">${m.deals}</div><div class="tm-stat-lbl">Active Deals</div></div>
        <div class="tm-stat"><div class="tm-stat-val" style="color:var(--success);">${fmtMoney(m.wonRevenue)}</div><div class="tm-stat-lbl">Won</div></div>
        <div class="tm-stat"><div class="tm-stat-val" style="color:${m.tasks > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${m.tasks}</div><div class="tm-stat-lbl">Pending Tasks</div></div>
        <div class="tm-stat"><div class="tm-stat-val">${fmtMoney(m.pipeline)}</div><div class="tm-stat-lbl">Pipeline</div></div>
      </div>
      ${m.recentActs.length ? `
      <div class="team-member-activity">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Recent Activity</div>
        ${m.recentActs.map(a => `
          <div class="co-activity-row ${a.completed ? 'done' : ''}">
            <div class="co-activity-icon" style="background:${a.type==='call'?'#3b82f6':a.type==='visit'?'#10b981':a.type==='email'?'#8b5cf6':'#f59e0b'};">
              <i class="fas ${TYPE_ICONS[a.type]||'fa-circle'}"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <div class="co-activity-title">${esc(a.title)}</div>
              <div class="co-activity-meta">
                ${a.company_name ? `<span><i class="fas fa-building"></i>${esc(a.company_name)}</span>` : ''}
                <span><i class="fas fa-clock"></i>${fmtDate(a.created_at)}</span>
              </div>
            </div>
          </div>`).join('')}
      </div>` : `<div style="padding:12px;text-align:center;font-size:12px;color:var(--text-muted);">No recent activity</div>`}
    </div>`).join('')}
  </div>`;
}

/* ============================================================
   TEAM TAB — assign owner, assign tasks, render team tasks
   ============================================================ */
function renderTeamTasks(teamTasks, companyId) {
  if (!teamTasks || !teamTasks.length) {
    return `<div class="co-empty" style="padding:20px;"><i class="fas fa-clipboard-list"></i><p>No tasks assigned yet</p></div>`;
  }
  const now = new Date();
  return teamTasks.map(t => {
    const isOverdue = !t.completed && t.due_date && new Date(t.due_date) < now;
    return `<div class="team-task-item ${t.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}">
      <div class="task-check">
        <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="completeTeamTask(${t.id}, ${companyId}, this.checked)">
      </div>
      <div class="task-body">
        <div class="task-title ${t.completed ? 'done' : ''}">${esc(t.title)}</div>
        <div class="task-meta">
          <span class="assigned-badge"><i class="fas fa-user-check"></i> ${esc(t.assigned_to_name || '—')}</span>
          ${t.due_date ? `<span class="${isOverdue ? 'overdue' : ''}"><i class="fas fa-clock"></i>${fmtDate(t.due_date)}</span>` : ''}
          ${t.description ? `<span style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-align-left"></i>${esc(t.description)}</span>` : ''}
        </div>
      </div>
      <button class="btn-icon danger" onclick="deleteTeamTask(${t.id}, ${companyId})" title="Delete"><i class="fas fa-trash"></i></button>
    </div>`;
  }).join('');
}

window.completeTeamTask = async function(id, companyId, completed) {
  try {
    await api(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify({ completed }) });
    delete State.companyCache[companyId];
    const data = await loadCompanyDetail(companyId);
    if (data) document.getElementById(`co-team-tasks-${companyId}`).innerHTML = renderTeamTasks(data.teamTasks || [], companyId);
  } catch(e) { showToast(e.message, 'error'); }
};

window.deleteTeamTask = function(id, companyId) {
  confirmDialog('Delete this task?', 'This cannot be undone.', async () => {
    try {
      await api(`/api/activities/${id}`, { method: 'DELETE' });
      showToast('Task deleted');
      delete State.companyCache[companyId];
      const data = await loadCompanyDetail(companyId);
      if (data) document.getElementById(`co-team-tasks-${companyId}`).innerHTML = renderTeamTasks(data.teamTasks || [], companyId);
    } catch(e) { showToast(e.message, 'error'); }
  });
};

window.assignCompanyOwner = async function(companyId) {
  const sel = document.getElementById(`assign-user-${companyId}`);
  const userId = sel?.value ? parseInt(sel.value) : null;
  try {
    await api(`/api/companies/${companyId}/assign`, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
    showToast('Owner updated');
    delete State.companyCache[companyId];
    openCompanyDetail(companyId);
  } catch(e) { showToast(e.message, 'error'); }
};

window.openAssignTaskForm = function(companyId) {
  const isTL = State.currentUser?.role === 'team_leader';
  const salesUsers = isTL
    ? State.teamMembers
    : (State.users || []).filter(u => u.role === 'sales' || u.role === 'team_leader');
  const userOpts = salesUsers.map(u => `<option value="${u.id}">${esc(u.name)}${!isTL ? ` (${u.role})` : ''}</option>`).join('');
  openModal('Assign Task to Team Member', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Assign To *</label>
        <select id="at_user" class="form-control">
          <option value="">— Select User —</option>${userOpts}
        </select>
      </div>
      <div class="form-group full">
        <label class="form-label">Task Title *</label>
        <input id="at_title" class="form-control" placeholder="What needs to be done?">
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="at_due" class="form-control" type="datetime-local">
      </div>
      <div class="form-group full">
        <label class="form-label">Description</label>
        <textarea id="at_desc" class="form-control" rows="2" placeholder="Additional details..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveAssignedTask(${companyId})">Assign Task</button>
    </div>`);
  setTimeout(() => document.getElementById('at_user')?.focus(), 50);
};

window.saveAssignedTask = async function(companyId) {
  const assigned_to = document.getElementById('at_user')?.value;
  const title = document.getElementById('at_title')?.value.trim();
  if (!assigned_to) { showToast('Please select a user', 'error'); return; }
  if (!title) { showToast('Title is required', 'error'); return; }
  const body = {
    type: 'task',
    title,
    assigned_to: parseInt(assigned_to),
    company_id: companyId,
    due_date: document.getElementById('at_due')?.value || null,
    description: document.getElementById('at_desc')?.value.trim() || null,
    completed: false,
  };
  try {
    await api('/api/activities', { method: 'POST', body: JSON.stringify(body) });
    showToast('Task assigned');
    closeModal();
    delete State.companyCache[companyId];
    const data = await loadCompanyDetail(companyId);
    if (data) document.getElementById(`co-team-tasks-${companyId}`).innerHTML = renderTeamTasks(data.teamTasks || [], companyId);
  } catch(e) { showToast(e.message, 'error'); }
};

async function loadCompanyDetail(companyId) {
  try {
    const data = await api(`/api/companies/${companyId}`);
    State.companyCache[companyId] = data;
    return data;
  } catch(e) { return null; }
}

/* ============================================================
   EXPOSE globals needed by inline onclick handlers in HTML
   ============================================================ */
window.openContactForm   = openContactForm;
window.openCompanyForm   = openCompanyForm;
window.openDealForm      = openDealForm;
window.openActivityForm  = openActivityForm;
window.openUserForm      = openUserForm;
window.openCompanyDetail = openCompanyDetail;
window.openContactDetail = openContactDetail;
window.closeModal        = closeModal;
window.searchContacts    = searchContacts;
window.filterContacts    = filterContacts;
window.searchCompanies   = searchCompanies;
window.searchDeals       = searchDeals;
window.openImportModal   = openImportModal;
window.exportData        = exportData;
window.switchImportTab   = switchImportTab;
window.previewImport     = previewImport;
window.runImport         = runImport;
window.backupCompanies   = backupCompanies;
window.openRestoreModal  = openRestoreModal;
window.runRestore        = runRestore;
window.dragDeal          = dragDeal;
window.dropDeal          = dropDeal;
window.toggleBulk        = toggleBulk;
window.selectAllBulk     = selectAllBulk;
window.clearBulk         = clearBulk;
window.applyBulkStatus   = applyBulkStatus;
window.applyBulkAssign   = applyBulkAssign;
window.applyBulkDelete       = applyBulkDelete;
window.setViewAs             = setViewAs;
window.openGeneralTaskForm   = openGeneralTaskForm;
window.saveGeneralTask       = saveGeneralTask;
window.toggleTLField         = toggleTLField;
window.assignCompanyOwner    = assignCompanyOwner;
window.openAssignTaskForm    = openAssignTaskForm;
window.saveAssignedTask      = saveAssignedTask;
window.completeTeamTask      = completeTeamTask;
window.deleteTeamTask        = deleteTeamTask;

/* ============================================================
   PHONE / WHATSAPP LINKS
   ============================================================ */
function phoneLink(phone) {
  if (!phone) return '—';
  const clean = String(phone).replace(/\s/g, '');
  const wa = clean.replace(/[^0-9+]/g, '');
  return `<a href="tel:${esc(clean)}" style="color:var(--primary);text-decoration:none;font-weight:500;" title="Call">${esc(phone)}</a>
    <a href="https://wa.me/${wa}" target="_blank" rel="noopener" style="color:#25d366;margin-left:8px;font-size:15px;" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>`;
}

window.openWhatsApp = function(phone) {
  const wa = String(phone||'').replace(/[^0-9+]/g,'');
  if (wa) window.open(`https://wa.me/${wa}`, '_blank');
};

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (document.getElementById('modalBackdrop')?.style.display === 'flex') {
      if (e.key === 'Escape') closeModal();
      return;
    }
    if (!State.currentUser) return;
    switch(e.key) {
      case '/': e.preventDefault(); document.getElementById('globalSearch')?.focus(); break;
      case 'n': case 'N':
        if (State.currentPage === 'contacts') openContactForm();
        else if (State.currentPage === 'companies') openCompanyForm();
        else if (State.currentPage === 'deals') openDealForm();
        else if (State.currentPage === 'tasks') openTaskForm();
        else if (State.currentPage === 'reminders') openReminderForm();
        break;
      case '1': navigateTo('dashboard'); break;
      case '2': navigateTo('contacts'); break;
      case '3': navigateTo('companies'); break;
      case '4': navigateTo('deals'); break;
      case '5': navigateTo('tasks'); break;
      case '6': navigateTo('reminders'); break;
      case '7': navigateTo('reports'); break;
      case '8': navigateTo('calendar'); break;
    }
  });
}

/* ============================================================
   DUPLICATE DETECTION
   ============================================================ */
let _dupCheckTimer = null;
function scheduleDupCheck(type, params, containerId) {
  clearTimeout(_dupCheckTimer);
  _dupCheckTimer = setTimeout(async () => {
    try {
      const qs = Object.entries(params).filter(([,v])=>v).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&');
      if (!qs) return;
      const res = await api(`/api/${type}/check-dup?${qs}`, {_silent:true});
      const el = document.getElementById(containerId);
      if (!el) return;
      if (res.duplicate) {
        el.innerHTML = `<div class="dup-warning"><i class="fas fa-exclamation-triangle"></i> Similar ${type === 'contacts' ? 'contact' : 'company'} found: <strong>${esc(res.duplicate.name)}</strong>${res.duplicate.company_name ? ` at ${esc(res.duplicate.company_name)}` : res.duplicate.city ? ` (${esc(res.duplicate.city)})` : ''}. <a href="#" onclick="event.preventDefault();selectDuplicate('${type}',${res.duplicate.id})">View it</a></div>`;
      } else { el.innerHTML = ''; }
    } catch(_) {}
  }, 600);
}

window.selectDuplicate = function(type, id) {
  closeModal();
  if (type === 'contacts') { navigateTo('contacts'); setTimeout(() => selectContact(id), 300); }
  else { navigateTo('companies'); setTimeout(() => selectCompany(id), 300); }
};

/* ============================================================
   MERGE DUPLICATES
   ============================================================ */
window.openMergeModal = function(type, keepId, keepName) {
  openModal(`Merge ${type === 'contacts' ? 'Contact' : 'Company'}`, `
    <div style="margin-bottom:12px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px;">
      <strong>Keeping:</strong> ${esc(keepName)}
    </div>
    <div class="form-group">
      <label class="form-label">Search for duplicate to merge into this one</label>
      <input id="merge-search" class="form-control" placeholder="Type name to search..." oninput="searchMergeTarget('${type}',${keepId},this.value)">
    </div>
    <div id="merge-results" style="margin-top:8px;"></div>
    <p style="font-size:12px;color:var(--text-muted);margin-top:12px;"><i class="fas fa-info-circle"></i> All deals, activities and contacts will be moved to the kept record, then the duplicate will be deleted. This cannot be undone.</p>
  `);
};

window.searchMergeTarget = async function(type, keepId, query) {
  if (!query || query.length < 2) { document.getElementById('merge-results').innerHTML = ''; return; }
  try {
    const list = type === 'contacts' ? State.contacts : State.companies;
    const results = list.filter(x => {
      const name = type === 'contacts' ? `${x.first_name} ${x.last_name}` : x.name;
      return name.toLowerCase().includes(query.toLowerCase()) && x.id !== keepId;
    }).slice(0, 8);
    document.getElementById('merge-results').innerHTML = results.length
      ? results.map(x => {
          const name = type === 'contacts' ? `${x.first_name} ${x.last_name}` : x.name;
          return `<div class="merge-result-row" onclick="confirmMerge('${type}',${keepId},${x.id},'${esc(name)}')">
            <div class="merge-result-av" style="background:${avatarColor(name)}">${initials(name)}</div>
            <div style="flex:1;">${esc(name)}${x.company_name ? `<div style="font-size:11px;color:var(--text-muted);">${esc(x.company_name)}</div>` : ''}</div>
            <button class="btn btn-sm" style="background:#fee2e2;color:#b91c1c;border:none;">Merge</button>
          </div>`;
        }).join('')
      : '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No matches found</div>';
  } catch(_) {}
};

window.confirmMerge = async function(type, keepId, mergeId, mergeName) {
  if (!confirm(`Merge "${mergeName}" into the kept record? This cannot be undone.`)) return;
  try {
    await api(`/api/merge/${type}`, { method: 'POST', body: JSON.stringify({ keep_id: keepId, merge_id: mergeId }) });
    showToast('Merged successfully');
    closeModal();
    delete State.companyCache[mergeId]; delete State.companyCache[keepId];
    delete State.contactCache[mergeId]; delete State.contactCache[keepId];
    if (type === 'contacts') loadContacts();
    else loadCompanies();
  } catch(e) { showToast(e.message, 'error'); }
};

/* ============================================================
   EMAIL COMPOSER
   ============================================================ */
window.openEmailComposer = function(contactId, contactName, contactEmail) {
  if (!contactEmail) { showToast('This contact has no email address', 'error'); return; }
  openModal(`Email to ${contactName}`, `
    <div class="form-group">
      <label class="form-label">To</label>
      <input class="form-control" value="${esc(contactEmail)}" readonly style="background:var(--bg);">
    </div>
    <div class="form-group">
      <label class="form-label">Subject *</label>
      <input id="email_subject" class="form-control" placeholder="Subject...">
    </div>
    <div class="form-group">
      <label class="form-label">Message *</label>
      <textarea id="email_body" class="form-control" rows="6" placeholder="Your message..."></textarea>
    </div>
    <div id="email-smtp-note" style="font-size:12px;color:var(--text-muted);margin-top:4px;"><i class="fas fa-info-circle"></i> Requires SMTP configuration on the server.</div>
    <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="sendEmail(${contactId})"><i class="fas fa-paper-plane"></i> Send</button>
    </div>
  `);
};

window.sendEmail = async function(contactId) {
  const subject = document.getElementById('email_subject')?.value?.trim();
  const body_text = document.getElementById('email_body')?.value?.trim();
  if (!subject || !body_text) { showToast('Subject and message are required', 'error'); return; }
  try {
    await api('/api/send-email', { method: 'POST', body: JSON.stringify({ contact_id: contactId, subject, body_text }) });
    showToast('Email sent and logged as activity');
    closeModal();
    delete State.contactCache[contactId];
  } catch(e) { showToast(e.message, 'error'); }
};

/* ============================================================
   WHATSAPP BROADCAST
   ============================================================ */
window.openWhatsAppBroadcast = function() {
  const contacts = State.contacts.filter(c => c.phone);
  openModal('WhatsApp Broadcast', `
    <div style="margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span style="font-size:13px;color:var(--text-muted);">${contacts.length} contacts with phone numbers</span>
      <button class="btn btn-sm btn-secondary" onclick="waBroadcastSelectAll(true)">Select All</button>
      <button class="btn btn-sm btn-secondary" onclick="waBroadcastSelectAll(false)">Clear</button>
    </div>
    <div id="wa-contact-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:12px;">
      ${contacts.map(c => `
        <label class="wa-contact-row" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);">
          <input type="checkbox" class="wa-cb" data-phone="${esc(c.phone)}" data-name="${esc(c.first_name+' '+c.last_name)}" style="width:15px;height:15px;">
          <div class="wa-av" style="width:28px;height:28px;border-radius:50%;background:${avatarColor(c.first_name)};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">${initials(c.first_name+' '+c.last_name)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:500;">${esc(c.first_name)} ${esc(c.last_name||'')}</div>
            <div style="font-size:11px;color:var(--text-muted);">${esc(c.phone)}</div>
          </div>
        </label>`).join('')}
    </div>
    <div class="form-group">
      <label class="form-label">Message Template</label>
      <textarea id="wa-message" class="form-control" rows="3" placeholder="Hello {name}, ..."></textarea>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Use {name} to insert contact name</div>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" style="background:#25d366;border-color:#25d366;" onclick="generateWaLinks()"><i class="fab fa-whatsapp"></i> Generate Links</button>
    </div>
    <div id="wa-links-output" style="margin-top:12px;"></div>
  `);
};

window.waBroadcastSelectAll = function(v) {
  document.querySelectorAll('.wa-cb').forEach(cb => cb.checked = v);
};

window.generateWaLinks = function() {
  const msg = document.getElementById('wa-message')?.value || '';
  const selected = [...document.querySelectorAll('.wa-cb:checked')];
  if (!selected.length) { showToast('Select at least one contact', 'error'); return; }
  const links = selected.map(cb => {
    const name = cb.dataset.name;
    const phone = normalizeWaPhone(cb.dataset.phone);
    const text = encodeURIComponent(msg.replace(/{name}/g, name));
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
      <span style="flex:1;font-size:12px;">${esc(name)} · ${esc(cb.dataset.phone)}</span>
      <a href="https://wa.me/${phone}${text ? '?text='+text : ''}" target="_blank" class="btn btn-sm" style="background:#25d366;color:#fff;border:none;font-size:12px;"><i class="fab fa-whatsapp"></i> Open</a>
    </div>`;
  }).join('');
  const allUrls = selected.map(cb => {
    const phone = normalizeWaPhone(cb.dataset.phone);
    const text = encodeURIComponent(msg.replace(/{name}/g, cb.dataset.name));
    return `https://wa.me/${phone}${text ? '?text='+text : ''}`;
  }).join('\n');

  const output = document.getElementById('wa-links-output');
  output.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-size:13px;font-weight:600;">${selected.length} link${selected.length!==1?'s':''} generated</span>
      <button id="wa-copy-all-btn" class="btn btn-sm btn-secondary" style="display:flex;align-items:center;gap:6px;"><i class="fas fa-copy"></i> Copy All</button>
    </div>
    ${links}`;

  const copyBtn = document.getElementById('wa-copy-all-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(allUrls)
        .then(() => showToast('Copied!'))
        .catch(() => showToast('Clipboard copy failed', 'error'));
    });
  }
};

/* ============================================================
   GOALS & TARGETS
   ============================================================ */
window.openGoalForm = function(userId, userName, month) {
  const mo = month || new Date().toISOString().slice(0,7);
  openModal(`Set Goal — ${esc(userName)}`, `
    <input type="hidden" id="goal_user_id" value="${userId}">
    <div class="form-group">
      <label class="form-label">Month</label>
      <input id="goal_month" class="form-control" type="month" value="${mo}">
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Revenue Target ($)</label>
        <input id="goal_revenue" class="form-control" type="number" min="0" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">Deals Target</label>
        <input id="goal_deals" class="form-control" type="number" min="0" placeholder="0">
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label">Activities Target</label>
        <input id="goal_activities" class="form-control" type="number" min="0" placeholder="0">
      </div>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveGoal()"><i class="fas fa-save"></i> Save Goal</button>
    </div>
  `);
};

window.saveGoal = async function() {
  const user_id = parseInt(document.getElementById('goal_user_id')?.value);
  const month = document.getElementById('goal_month')?.value;
  const target_revenue = parseFloat(document.getElementById('goal_revenue')?.value) || 0;
  const target_deals = parseInt(document.getElementById('goal_deals')?.value) || 0;
  const target_activities = parseInt(document.getElementById('goal_activities')?.value) || 0;
  try {
    await api('/api/goals', { method: 'POST', body: JSON.stringify({ user_id, month, target_revenue, target_deals, target_activities }) });
    showToast('Goal saved');
    closeModal();
    loadDashboard();
  } catch(e) { showToast(e.message, 'error'); }
};

function goalBar(actual, target, color) {
  if (!target) return '';
  const pct = Math.min(100, Math.round((actual / target) * 100));
  return `<div style="margin-top:4px;">
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:2px;">
      <span>${actual} / ${target}</span><span>${pct}%</span>
    </div>
    <div style="height:5px;border-radius:3px;background:var(--border);overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${pct>=100?'#10b981':color};border-radius:3px;transition:width .4s;"></div>
    </div>
  </div>`;
}

/* ============================================================
   CUSTOM FIELDS
   ============================================================ */
async function loadCustomFields() {
  try {
    const [contact, company] = await Promise.all([
      api('/api/custom-fields/contact', {_silent:true}),
      api('/api/custom-fields/company', {_silent:true}),
    ]);
    State.customFields = { contact: contact||[], company: company||[] };
  } catch(_) { State.customFields = { contact:[], company:[] }; }
}

async function loadCustomValues(entityType, entityId) {
  try {
    const vals = await api(`/api/custom-values/${entityType}/${entityId}`, {_silent:true});
    return vals || [];
  } catch(_) { return []; }
}

function renderCustomFieldsView(entityType, entityId, values) {
  const defs = State.customFields?.[entityType] || [];
  if (!defs.length) return '';
  const valMap = Object.fromEntries((values||[]).map(v => [v.field_def_id, v.value]));
  const fields = defs.map(d => {
    const val = valMap[d.id];
    if (!val) return '';
    return `<div class="dp-field"><i class="fas fa-tag"></i><div><div style="font-size:10px;color:var(--text-light);text-transform:uppercase;letter-spacing:.03em;">${esc(d.label)}</div><div class="dp-field-val">${esc(val)}</div></div></div>`;
  }).filter(Boolean).join('');
  return fields ? `<div class="dp-fields-grid">${fields}</div>` : '';
}

function renderCustomFieldInputs(entityType, values) {
  const defs = State.customFields?.[entityType] || [];
  if (!defs.length) return '';
  const valMap = Object.fromEntries((values||[]).map(v => [v.field_def_id, v.value]));
  return `<div class="form-group" style="grid-column:1/-1;">
    <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Custom Fields</div>
    ${defs.map(d => `<div class="form-group" style="margin-bottom:8px;">
      <label class="form-label">${esc(d.label)}</label>
      ${d.field_type === 'select' && d.options
        ? `<select class="form-control cf-input" data-def-id="${d.id}"><option value="">— select —</option>${JSON.parse(d.options||'[]').map(o => `<option ${valMap[d.id]===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`
        : `<input class="form-control cf-input" data-def-id="${d.id}" type="${d.field_type==='number'?'number':d.field_type==='date'?'date':'text'}" value="${esc(valMap[d.id]||'')}">`}
    </div>`).join('')}
  </div>`;
}

async function saveCustomValues(entityType, entityId) {
  const inputs = document.querySelectorAll('.cf-input');
  for (const inp of inputs) {
    const field_def_id = parseInt(inp.dataset.defId);
    const value = inp.value?.trim() || null;
    if (field_def_id) {
      await api('/api/custom-values', { method:'POST', body: JSON.stringify({ entity_type: entityType, entity_id: entityId, field_def_id, value }) });
    }
  }
}

/* ============================================================
   PDF PRINT
   ============================================================ */
window.printDetail = function() {
  window.print();
};

/* ============================================================
   ENTRY POINT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  initPinPad();
  initNav();
  initGlobalSearch();
  initKeyboardShortcuts();
  await init();

  // After auth, preload shared lookup data once
  if (State.currentUser) {
    await preloadSharedData();
    await initTLMemberBar();
    initNotifications();
  }
});
