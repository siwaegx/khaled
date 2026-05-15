/**
 * @file pages/lists.js
 * @description Lists management page (manager only): currency setting card,
 * dynamic dropdown columns with inline add/edit/delete per list type.
 */

/* ============================================================
   LISTS MANAGEMENT PAGE
   ============================================================ */

/** Fetch all list types and render the management grid. */
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

/** Render the currency setting card and one column per list type. */
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
  </div>`;
}

/** Persist a new currency symbol to settings. */
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

/** Render a single list item cell with inline edit controls. */
function renderListCell(item) {
  return `<div class="list-cell" data-id="${item.id}" data-type="${esc(item.list_type)}">
    <span class="list-cell-val" onclick="startEditListItem(${item.id})">${esc(item.value)}</span>
    <input class="list-cell-edit-input" value="${esc(item.value)}" onkeydown="if(event.key==='Enter')saveListItem(${item.id});if(event.key==='Escape')cancelEditListItem(${item.id})">
    <button class="list-cell-save" onclick="saveListItem(${item.id})">✓</button>
    <button class="list-cell-cancel" onclick="cancelEditListItem(${item.id})">✕</button>
    <button class="list-cell-del" onclick="deleteListItem(${item.id},'${esc(item.list_type)}')" title="Delete">×</button>
  </div>`;
}

/** Enter edit mode for a list item cell. */
window.startEditListItem = function(id) {
  const cell = document.querySelector(`.list-cell[data-id="${id}"]`);
  if (!cell) return;
  cell.classList.add('editing');
  cell.querySelector('.list-cell-edit-input').focus();
};

/** Cancel edit mode for a list item cell without saving. */
window.cancelEditListItem = function(id) {
  const cell = document.querySelector(`.list-cell[data-id="${id}"]`);
  if (cell) cell.classList.remove('editing');
};

/** Persist the edited value for a list item in place. */
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

/** Add a new item to a list type from the inline input. */
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

/** Delete a list item and remove it from the DOM. */
window.deleteListItem = async function(id, type) {
  try {
    await api(`/api/list-items/${id}`, {method:'DELETE'});
    document.querySelector(`.list-cell[data-id="${id}"]`)?.remove();
    if (State.lists[type]) State.lists[type] = State.lists[type].filter(i=>i.id!==id);
    const countEl = document.querySelector(`.list-col[data-type="${type}"] .list-col-header small`);
    if (countEl) countEl.textContent = (State.lists[type]||[]).length;
  } catch(e) { showToast(e.message, 'error'); }
};
