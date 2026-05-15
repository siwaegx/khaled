/**
 * @file theme.js
 * @description Dark/light mode toggle. Reads saved preference from localStorage
 * and applies it immediately on page load (before DOMContentLoaded).
 */

/* ============================================================
   THEME — DARK / LIGHT MODE
   ============================================================ */

/** Apply or remove the 'dark' class on <body> and update the toggle icon. */
function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  const icon = document.getElementById('themeIcon');
  if (icon) { icon.className = dark ? 'fas fa-sun' : 'fas fa-moon'; }
}

/** Toggle between dark and light mode, persisting the choice. */
function toggleTheme() {
  const isDark = document.body.classList.contains('dark');
  const next = !isDark;
  localStorage.setItem('crm_theme', next ? 'dark' : 'light');
  applyTheme(next);
}

// Apply saved theme immediately so there is no flash of wrong theme
(function initTheme() {
  const saved = localStorage.getItem('crm_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved === 'dark' || (!saved && prefersDark));
})();
