/**
 * @file bulk.js
 * @description Bulk-action toolbar for contacts and companies: multi-select,
 * status change, ownership reassignment, bulk delete, and WhatsApp broadcast.
 */

/* ============================================================
   BULK ACTIONS
   ============================================================ */

/** Toggle every visible bulk checkbox for the given entity type. */
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

/** Sync the "select all" master checkbox indeterminate / checked state. */
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

/** Add or remove a single record from the bulk selection. */
window.toggleBulk = function(type, id, checked) {
  const key = type === 'contacts' ? 'bulkContacts' : 'bulkCompanies';
  if (checked) { if (!State[key].includes(id)) State[key].push(id); }
  else { State[key] = State[key].filter(x => x !== id); }
  syncSelectAllCb(type);
  renderBulkBar(type);
};

/** Render or hide the floating bulk-action bar based on current selection count. */
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

/** Deselect all records and hide the bulk bar. */
window.clearBulk = function(type) {
  const key    = type === 'contacts' ? 'bulkContacts' : 'bulkCompanies';
  const prefix = type === 'contacts' ? 'ct' : 'co';
  State[key] = [];
  document.querySelectorAll(`#${prefix}-list-panel .bulk-check`).forEach(cb => cb.checked = false);
  const saCb = document.getElementById(`${prefix}-select-all-cb`);
  if (saCb) { saCb.checked = false; saCb.indeterminate = false; }
  renderBulkBar(type);
};

/** Apply a status change to all selected records. */
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

/** Reassign all selected records to a different user (manager only). */
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

/** Delete all selected records after a confirmation prompt. */
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
   WHATSAPP BROADCAST
   ============================================================ */

/** Open the WhatsApp broadcast composer with a contact checklist and message template. */
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

/** Check or uncheck all contact rows in the broadcast list. */
window.waBroadcastSelectAll = function(v) {
  document.querySelectorAll('.wa-cb').forEach(cb => cb.checked = v);
};

/** Build personalized WhatsApp deep-links for each checked contact. */
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
