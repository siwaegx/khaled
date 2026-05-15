/**
 * @file auth.js
 * @description Session init/restore, logout, and sidebar/nav user info updates.
 * Login is handled globally at /login — this module only verifies the token.
 */

/* ============================================================
   AUTH & INIT
   ============================================================ */

async function init() {
  State.token = localStorage.getItem('crm_token');
  if (State.token) {
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
        break;
      } catch (e) {
        if (attempt < 2) await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
      }
    }
  }
  // Not authenticated — send to global login
  window.location.replace('/');
}

function showApp() {
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
  window.location.replace('/');
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
  const gtBtn = document.getElementById('btn-general-task');
  if (gtBtn) gtBtn.style.display = canManage ? '' : 'none';
}
