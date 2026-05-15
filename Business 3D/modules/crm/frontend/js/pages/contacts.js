/**
 * @file pages/contacts.js
 * @description Contacts page: list, filter, card rendering, detail panel,
 * quick-log actions, lead-status picker, add/edit/delete form.
 */

/* ============================================================
   CONTACTS
   ============================================================ */

/** Fetch contacts (optionally filtered by search) and re-render the list. */
async function loadContacts() {
  const listPanel = document.getElementById('ct-list-panel');
  if (listPanel) listPanel.innerHTML = '<div class="spinner"></div>';
  try {
    const search = document.getElementById('contactSearch').value;
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    State.contacts = await api('/api/contacts' + params) || [];
    populateStatusFilter('contactStatusFilter', State.lists['lead_status'] || []);
    filterContacts();
  } catch(e) {
    const lp = document.getElementById('ct-list-panel');
    if (lp) lp.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load contacts');
  }
}

/** Debounced search — triggered by the contact search input's oninput handler. */
const searchContacts = debounce(loadContacts, 200);

/** Apply status/search filters to the cached contact list and re-render. */
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

/** Render the card grid of contacts into the list panel. */
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

/** Highlight the selected row and show the detail panel for a contact. */
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

/** Toggle the "selected" CSS class on the correct contact card. */
function highlightContactRow(id) {
  document.querySelectorAll('#ct-list-panel .entity-card').forEach(r =>
    r.classList.toggle('selected', r.id === `ct-row-${id}`)
  );
}

/** Build the full HTML for the contact detail panel. */
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

/** Open the quick-log modal for a specific activity type and contact. */
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

/** Save a quick-log activity for a contact and refresh the detail panel. */
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

/** Show a dropdown popup to change a contact's lead status inline. */
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

/** Persist an inline lead-status change for a contact. */
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

/** Open the add/edit contact form modal. */
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
  if (!id) {
    const phoneEl = document.getElementById('cf_phone');
    const emailEl = document.getElementById('cf_email');
    if (phoneEl) phoneEl.addEventListener('blur', () => scheduleDupCheck('contacts', {phone: phoneEl.value?.trim()}, 'ct-dup-warn'));
    if (emailEl) emailEl.addEventListener('blur', () => scheduleDupCheck('contacts', {email: emailEl.value?.trim()}, 'ct-dup-warn'));
  }
}

/** Persist the contact form (create or update). */
window.saveContact = async function(id) {
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
  } catch(e) { showToast(e.message, 'error'); }
};

/** Confirm and delete a contact, clearing its cache and detail panel. */
window.deleteContact = function(id) {
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
    } catch(e) { showToast(e.message, 'error'); }
  });
};
