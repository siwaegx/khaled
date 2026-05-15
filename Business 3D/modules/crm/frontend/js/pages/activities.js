/**
 * @file pages/activities.js
 * @description Activities page: list with completion toggle, type/status filters,
 * and activity add/edit/delete modal.
 */

/* ============================================================
   ACTIVITIES
   ============================================================ */

/** Fetch activities with the current filter/type and render the list. */
async function loadActivities() {
  document.getElementById('activities-list').innerHTML = '<div class="spinner"></div>';
  try {
    const params = new URLSearchParams();
    if (State.activityFilter === 'pending')   params.set('completed', 'false');
    if (State.activityFilter === 'completed') params.set('completed', 'true');
    if (State.activityType) params.set('type', State.activityType);
    State.activities = await api('/api/activities?' + params) || [];
    document.getElementById('activities-count').textContent = `${State.activities.length} activit${State.activities.length !== 1 ? 'ies' : 'y'}`;
    renderActivitiesList(State.activities);
  } catch (e) {
    document.getElementById('activities-list').innerHTML = emptyState('fa-exclamation-circle', 'Failed to load activities');
  }
}

/** Switch the pending/completed/all filter tab and reload. */
window.filterActivities = function (filter) {
  if (filter) {
    State.activityFilter = filter;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
  }
  loadActivities();
};

/** Read the type dropdown and reload the list. */
window.filterActivitiesByType = function () {
  State.activityType = document.getElementById('activityTypeFilter').value;
  loadActivities();
};

/** Render all activity items into the list container. */
function renderActivitiesList(activities) {
  const container = document.getElementById('activities-list');
  if (!activities.length) {
    container.innerHTML = emptyState('fa-calendar-check', 'No activities found', 'Add an activity to stay on track');
    return;
  }
  const now = new Date();
  container.innerHTML = `<div class="activities-list">
    ${activities.map(a => activityItem(a, now)).join('')}
  </div>`;
}

/** Render a single activity row with type icon, meta, and action buttons. */
function activityItem(a, now = new Date()) {
  const isOverdue = !a.completed && a.due_date && new Date(a.due_date) < now;
  return `<div class="activity-item ${a.completed ? 'completed' : ''}">
    <div class="activity-check">
      <input type="checkbox" ${a.completed ? 'checked' : ''} onchange="toggleActivity(${a.id}, this.checked)">
    </div>
    <div class="type-icon type-${a.type}"><i class="fas ${TYPE_ICONS[a.type] || 'fa-circle'}"></i></div>
    <div class="activity-body">
      <div class="activity-title ${a.completed ? 'done' : ''}">${esc(a.title)}
        ${a.reminder_at ? `<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:10px;background:#fef3c7;color:#92400e;margin-left:6px;"><i class="fas fa-bell" style="font-size:9px;"></i> ${new Date(a.reminder_at).toLocaleDateString()}</span>` : ''}
      </div>
      <div class="activity-meta">
        ${a.contact_name ? `<span><i class="fas fa-user"></i>${esc(a.contact_name)}</span>` : ''}
        ${a.company_name ? `<span><i class="fas fa-building"></i>${esc(a.company_name)}</span>` : ''}
        ${a.due_date ? `<span class="${isOverdue ? 'overdue' : ''}"><i class="fas fa-clock"></i>${fmtDate(a.due_date)}</span>` : ''}
        ${a.user_name ? `<span><i class="fas fa-user-tie"></i>${esc(a.user_name)}</span>` : ''}
      </div>
    </div>
    <div class="activity-actions">
      <button class="btn-icon" onclick="openActivityForm(${a.id})" title="Edit"><i class="fas fa-pen"></i></button>
      <button class="btn-icon danger" onclick="deleteActivity(${a.id})" title="Delete"><i class="fas fa-trash"></i></button>
    </div>
  </div>`;
}

/** Toggle the completed state of an activity and reload. */
window.toggleActivity = async function (id, completed) {
  const a = State.activities.find(x => x.id === id);
  if (!a) return;
  try {
    await api(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify({ ...a, completed }) });
    loadActivities();
  } catch (e) { showToast(e.message, 'error'); }
};

/** Open the activity add/edit modal, pre-filled when editing. */
function openActivityForm(id) {
  const a = id ? State.activities.find(x => x.id === id) : null;
  const companyOptions = State.companies.map(co =>
    `<option value="${co.id}" ${a?.company_id === co.id ? 'selected' : ''}>${esc(co.name)}</option>`
  ).join('');
  const contactOptions = State.contacts.map(c =>
    `<option value="${c.id}" ${a?.contact_id === c.id ? 'selected' : ''}>${esc(c.first_name)} ${esc(c.last_name)}</option>`
  ).join('');
  const dealOptions = State.deals.map(d =>
    `<option value="${d.id}" ${a?.deal_id === d.id ? 'selected' : ''}>${esc(d.title)}</option>`
  ).join('');

  openModal(a ? 'Edit Activity' : 'Add Activity', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Title *</label>
        <input id="af_title" class="form-control" value="${esc(a?.title || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select id="af_type" class="form-control">
          ${['call','email','meeting','task','visit','note'].map(t =>
            `<option value="${t}" ${(a?.type || 'call') === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="af_due" class="form-control" type="datetime-local" value="${a?.due_date ? a.due_date.slice(0, 16) : ''}">
      </div>
      <div class="form-group">
        <label class="form-label"><i class="fas fa-bell" style="color:var(--warning);margin-right:4px;"></i>Reminder Date/Time</label>
        <input id="af_reminder" class="form-control" type="datetime-local" value="${a?.reminder_at ? a.reminder_at.slice(0, 16) : ''}" title="Sends email notification to assigned user">
      </div>
      <div class="form-group">
        <label class="form-label">Contact</label>
        <select id="af_contact" class="form-control">
          <option value="">— None —</option>${contactOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <select id="af_company" class="form-control">
          <option value="">— None —</option>${companyOptions}
        </select>
      </div>
      <div class="form-group full">
        <label class="form-label">Deal</label>
        <select id="af_deal" class="form-control">
          <option value="">— None —</option>${dealOptions}
        </select>
      </div>
      <div class="form-group full">
        <label class="form-label">Description</label>
        <textarea id="af_desc" class="form-control">${esc(a?.description || '')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveActivity(${id || 'null'})">Save</button>
    </div>`);
}

/** Persist a new or edited activity then reload the list. */
window.saveActivity = async function (id) {
  const body = {
    title:       document.getElementById('af_title').value.trim(),
    type:        document.getElementById('af_type').value,
    due_date:    document.getElementById('af_due').value || null,
    reminder_at: document.getElementById('af_reminder')?.value || null,
    contact_id:  document.getElementById('af_contact').value || null,
    company_id:  document.getElementById('af_company').value || null,
    deal_id:     document.getElementById('af_deal').value || null,
    description: document.getElementById('af_desc').value.trim(),
    completed:   id ? (State.activities.find(a => a.id === id)?.completed || false) : false,
  };
  if (!body.title) { showToast('Activity title is required', 'error'); return; }
  try {
    if (id) {
      await api(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Activity updated');
    } else {
      await api('/api/activities', { method: 'POST', body: JSON.stringify(body) });
      showToast('Activity added');
    }
    closeModal();
    loadActivities();
  } catch (e) { showToast(e.message, 'error'); }
};

/** Confirm and delete an activity, then reload the list. */
window.deleteActivity = function (id) {
  const a = State.activities.find(x => x.id === id);
  confirmDialog(`Delete "${a?.title}"?`, 'This action cannot be undone.', async () => {
    try {
      await api(`/api/activities/${id}`, { method: 'DELETE' });
      showToast('Activity deleted');
      loadActivities();
    } catch (e) { showToast(e.message, 'error'); }
  });
};
