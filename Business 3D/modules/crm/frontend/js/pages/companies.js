/**
 * @file pages/companies.js
 * @description Companies split-view: list, filter, card rendering, detail panel
 * with tabbed contacts/deals/activities/team, all inline CRUD forms,
 * duplicate check, merge, owner assignment, and team task management.
 */

/* ============================================================
   COMPANIES — list load & filter
   ============================================================ */

/** Fetch companies and re-render the list panel. */
async function loadCompanies() {
  const listPanel = document.getElementById('co-list-panel');
  if (listPanel) listPanel.innerHTML = '<div class="spinner"></div>';
  try {
    const search = document.getElementById('companySearch').value;
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    State.companies = await api('/api/companies' + params) || [];
    populateStatusFilter('companyStatusFilter', State.lists['company_status'] || []);
    filterCompanies();
  } catch(e) {
    const lp = document.getElementById('co-list-panel');
    if (lp) lp.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load');
  }
}

const searchCompanies = debounce(filterCompanies, 200);

/** Populate a <select> filter with dynamic list items, preserving the current selection. */
function populateStatusFilter(selectId, items) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Status</option>' +
    items.map(i => `<option value="${esc(i.value)}" ${cur===i.value?'selected':''}>${esc(i.value)}</option>`).join('');
}

/** Apply status + text search filters to the cached companies and re-render. */
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
    const dp = document.getElementById('co-detail-panel');
    if (dp && dp.classList.contains('open') && !State.companyCache[State.selectedCompanyId]) {
      openCompanyDetail(State.selectedCompanyId);
    }
  }
}

/** Render the company card grid into the list panel. */
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

/** Toggle the "selected" CSS class on the correct company card. */
function highlightCompanyRow(id) {
  document.querySelectorAll('#co-list-panel .entity-card').forEach(r =>
    r.classList.toggle('selected', r.id === `co-row-${id}`)
  );
}

/** Load the company detail panel (cache-first). */
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

/** Render a single detail-panel field row; returns '' if val is falsy. */
function dpField(icon, label, val) {
  if (!val) return '';
  return `<div class="dp-field"><i class="fas ${icon}"></i><div><div style="font-size:10px;color:var(--text-light);text-transform:uppercase;letter-spacing:.03em;">${label}</div><div class="dp-field-val">${esc(String(val))}</div></div></div>`;
}

/* ============================================================
   COMPANY DETAIL PANEL
   ============================================================ */

/** Build the full HTML for the company "hub" detail panel. */
function renderCompanyDetailPanel(data) {
  const pipeline = data.deals.filter(d => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + (d.value || 0), 0);
  const wonRev   = data.deals.filter(d => d.stage === 'won').reduce((s, d) => s + (d.value || 0), 0);
  const sc = statusColor(data.status);

  return `<div class="detail-panel co-hub">
    ${mobileBackBtn('co-detail-panel')}
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

    <div class="co-hub-stats">
      ${data.industry ? `<div class="co-hub-stat"><i class="fas fa-industry"></i>${esc(data.industry)}</div>` : ''}
      ${data.city     ? `<div class="co-hub-stat"><i class="fas fa-map-marker-alt"></i>${esc(data.city)}</div>` : ''}
      ${data.phone    ? `<div class="co-hub-stat co-hub-phone" onclick="openWhatsApp('${data.phone.replace(/\D/g,'')}')"><i class="fab fa-whatsapp" style="color:#25d366;"></i>${esc(data.phone)}</div>` : ''}
      ${data.website  ? `<div class="co-hub-stat"><a href="${esc(data.website.startsWith('http')?data.website:'https://'+data.website)}" target="_blank" style="color:var(--primary);text-decoration:none;"><i class="fas fa-globe"></i>${esc(data.website)}</a></div>` : ''}
      <div class="co-hub-stat"><i class="fas fa-funnel-dollar" style="color:var(--primary);"></i><strong>${fmtMoney(pipeline)}</strong> pipeline</div>
      ${wonRev > 0 ? `<div class="co-hub-stat"><i class="fas fa-trophy" style="color:#10b981;"></i><strong>${fmtMoney(wonRev)}</strong> won</div>` : ''}
    </div>

    ${data.notes ? `<div class="dp-notes"><i class="fas fa-sticky-note" style="margin-right:6px;color:var(--warning);"></i>${esc(data.notes)}</div>` : ''}

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
      <div class="co-tab-toolbar" style="margin-top:12px;">
        <button class="btn btn-sm btn-primary" onclick="openAssignTaskForm(${data.id})">
          <i class="fas fa-plus"></i> Assign Task to Team
        </button>
      </div>
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

/** Render a contact card inside the company contacts tab. */
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

/** Render a single deal row inside the company deals tab. */
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

/** Render the grouped activity timeline for the company activities tab. */
function renderCoActivityList(activities, companyId, typeFilter) {
  const filtered = typeFilter && typeFilter !== 'all'
    ? activities.filter(a => a.type === typeFilter)
    : activities;
  if (!filtered.length) return `<div style="padding:30px;text-align:center;color:var(--text-muted);font-size:13px;"><i class="fas fa-bolt" style="font-size:24px;display:block;margin-bottom:8px;opacity:.3;"></i>No activities yet</div>`;

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

/** Switch the active tab inside a company detail panel. */
window.switchCoTab = function(companyId, tab) {
  const tabs  = document.querySelectorAll(`#co-hub-tabs-${companyId} .co-tab`);
  const panes = document.querySelectorAll(`#co-tab-contacts-${companyId},#co-tab-deals-${companyId},#co-tab-activities-${companyId}`);
  tabs.forEach(t => t.classList.remove('active'));
  panes.forEach(p => p.classList.remove('active'));
  const idx = ['contacts','deals','activities'].indexOf(tab);
  if (tabs[idx]) tabs[idx].classList.add('active');
  const pane = document.getElementById(`co-tab-${tab}-${companyId}`);
  if (pane) pane.classList.add('active');
};

/** Filter the activities tab by type without re-fetching. */
window.filterCoActivities = function(companyId, type) {
  const bar = document.getElementById(`co-hub-tabs-${companyId}`)?.closest('.co-hub');
  if (bar) bar.querySelectorAll('.act-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  const cached = State.companyCache[companyId];
  if (!cached) return;
  const el = document.getElementById(`co-activity-list-${companyId}`);
  if (el) el.innerHTML = renderCoActivityList(cached.activities, companyId, type);
};

/* ============================================================
   IN-COMPANY CONTACT CRUD
   ============================================================ */

/** Open the "Add Contact" modal pre-linked to a company. */
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

/** Open the quick-log modal for a contact inside the company detail panel. */
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

/** Show a status picker for a contact's lead status inside the company detail panel. */
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

/* ============================================================
   IN-COMPANY DEAL CRUD
   ============================================================ */

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

/** Mark an activity as completed from within the company hub. */
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

/* ============================================================
   COMPANY ADD / EDIT FORM
   ============================================================ */

/** Open the add/edit company form modal. */
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
  if (!id) {
    const nameEl  = document.getElementById('cof_name');
    const phoneEl = document.getElementById('cof_phone');
    if (nameEl)  nameEl.addEventListener('blur',  () => scheduleDupCheck('companies', {name: nameEl.value?.trim()},  'co-dup-warn'));
    if (phoneEl) phoneEl.addEventListener('blur', () => scheduleDupCheck('companies', {phone: phoneEl.value?.trim()}, 'co-dup-warn'));
  }
}

/** Persist the company form (create or update). */
window.saveCompany = async function(id) {
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
  } catch(e) { showToast(e.message, 'error'); }
};

/** Confirm and delete a company. */
window.deleteCompany = function(id) {
  const co = State.companies.find(c => c.id === id);
  confirmDialog(`Delete ${co?.name}?`, 'Associated contacts and deals will be unlinked.', async () => {
    try {
      await api(`/api/companies/${id}`, { method: 'DELETE' });
      showToast('Company deleted');
      loadCompanies();
    } catch(e) { showToast(e.message, 'error'); }
  });
};

/* ============================================================
   TEAM TASK ACTIONS (in company hub)
   ============================================================ */

/** Render the list of team tasks for the company team tab. */
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

/** Toggle the completion state of a team task within the company hub. */
window.completeTeamTask = async function(id, companyId, completed) {
  try {
    await api(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify({ completed }) });
    delete State.companyCache[companyId];
    const data = await loadCompanyDetail(companyId);
    if (data) document.getElementById(`co-team-tasks-${companyId}`).innerHTML = renderTeamTasks(data.teamTasks || [], companyId);
  } catch(e) { showToast(e.message, 'error'); }
};

/** Confirm and delete a team task within the company hub. */
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

/** Reassign a company's owner and refresh the hub. */
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

/** Open the "Assign Task" modal for a team member inside a company's team tab. */
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

/** Fetch the latest company data and update the cache. */
async function loadCompanyDetail(companyId) {
  try {
    const data = await api(`/api/companies/${companyId}`);
    State.companyCache[companyId] = data;
    return data;
  } catch(e) { return null; }
}
