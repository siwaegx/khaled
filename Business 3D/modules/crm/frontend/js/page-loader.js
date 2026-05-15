'use strict';

const PAGE_NAMES = [
  'dashboard', 'contacts', 'companies', 'deals',
  'tasks', 'reminders', 'reports', 'calendar',
  'activities', 'lists', 'team', 'users'
];

async function loadAllPages() {
  const container = document.getElementById('pages-container');
  if (!container) return;

  const htmls = await Promise.all(
    PAGE_NAMES.map(name =>
      fetch(`/crm/pages/${name}.html`)
        .then(r => {
          if (!r.ok) throw new Error(`Failed to load page: ${name}`);
          return r.text();
        })
        .catch(err => {
          console.error(err);
          return `<div id="page-${name}" class="page"></div>`;
        })
    )
  );

  htmls.forEach(html => container.insertAdjacentHTML('beforeend', html));
}
