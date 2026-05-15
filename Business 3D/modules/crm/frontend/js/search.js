/**
 * @file search.js
 * @description Global search bar: debounced API queries, result rendering,
 * and navigation to the selected result.
 */

/* ============================================================
   GLOBAL SEARCH
   ============================================================ */

/** Wire up the global search input with debounced API calls and keyboard handling. */
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

/** Render search result groups (contacts, companies, deals) into the dropdown. */
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

/** Close the search dropdown and navigate to the selected item's page. */
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
