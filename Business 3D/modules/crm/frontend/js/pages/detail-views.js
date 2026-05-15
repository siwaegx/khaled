/**
 * @file pages/detail-views.js
 * @description Full-screen detail modals for companies and contacts: timeline,
 * related contacts/deals tabs, quick activity logger, and tab switching.
 */

/* ============================================================
   DETAIL VIEWS (Company & Contact)
   ============================================================ */

/**
 * Render a chronological timeline of activities grouped by date label
 * (Today / Yesterday / formatted date).
 */
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

/** Open a full-detail company modal with activities, contacts, and deals tabs. */
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

/** Open a full-detail contact modal with activities and deals tabs. */
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

/** Switch the active tab inside a detail modal. */
window.switchDetailTab = function(tab) {
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.detail-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
};

/** Open a quick "log activity" mini-modal linked to a company or contact. */
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

/** Post a quick activity log and re-open the entity detail to show it. */
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
