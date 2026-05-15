/**
 * @file router.js
 * @description Hash-based SPA router: maps page names to load functions,
 * activates the correct nav link, and wires up the sidebar toggle.
 */

/* ============================================================
   ROUTER
   ============================================================ */

/** Navigate to a named page, enforcing role-based access. */
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

/** Call the correct page-load function for the current page name. */
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

/** Wire up nav link clicks, sidebar toggle, mobile backdrop, logout, and hashchange. */
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
