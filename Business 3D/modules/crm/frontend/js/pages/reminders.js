/**
 * @file pages/reminders.js
 * @description Reminders page: grouped list (overdue / today / upcoming),
 * dismiss action, and the add-reminder modal.
 */

/* ============================================================
   REMINDERS
   ============================================================ */

/** Fetch all reminders for the current user and render grouped by urgency. */
async function loadReminders() {
  const container = document.getElementById('reminders-list');
  if (container) container.innerHTML = '<div class="spinner"></div>';
  try {
    State.reminders = await api('/api/reminders') || [];
    const el = document.getElementById('reminders-count');
    if (el) el.textContent = `${State.reminders.length} reminder${State.reminders.length !== 1 ? 's' : ''}`;
    renderReminderList(State.reminders);
  } catch(e) {
    const c = document.getElementById('reminders-list');
    if (c) c.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load reminders');
  }
}

/** Sort reminders into overdue / today / future groups and render them. */
function renderReminderList(reminders) {
  const container = document.getElementById('reminders-list');
  if (!container) return;
  if (!reminders.length) {
    container.innerHTML = emptyState('fa-bell', 'No reminders', 'Set a reminder when creating an activity or task');
    return;
  }
  const now = new Date();
  const todayStr = now.toDateString();
  const overdue = [], today = [], future = [];
  reminders.forEach(r => {
    const d = new Date(r.reminder_at);
    if (d < now) overdue.push(r);
    else if (d.toDateString() === todayStr) today.push(r);
    else future.push(r);
  });

  function group(label, items, cls) {
    if (!items.length) return '';
    return `<div class="reminder-group-label">${label}</div>
      <div class="reminders-list">
        ${items.map(r => reminderItem(r, cls, now)).join('')}
      </div>`;
  }

  container.innerHTML = `
    ${group('Overdue', overdue, 'overdue')}
    ${group('Today', today, 'today')}
    ${group('Upcoming', future, 'future')}
  `;
}

/** Render a single reminder card with time, linked entity, and actions. */
function reminderItem(a, cls, now) {
  const d = new Date(a.reminder_at);
  const isOverdue = d < now;
  const timeStr = d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  return `<div class="reminder-item ${cls} ${a.notified ? 'notified' : ''}">
    <div class="reminder-icon ${isOverdue ? 'overdue' : ''} ${a.notified ? 'notified' : ''}">
      <i class="fas fa-bell"></i>
    </div>
    <div class="reminder-body">
      <div class="reminder-title">${esc(a.title)}</div>
      <div class="reminder-meta">
        ${a.contact_name ? `<span><i class="fas fa-user"></i>${esc(a.contact_name)}</span>` : ''}
        ${a.company_name ? `<span><i class="fas fa-building"></i>${esc(a.company_name)}</span>` : ''}
        ${a.due_date ? `<span><i class="fas fa-clock"></i>${fmtDate(a.due_date)}</span>` : ''}
        ${a.notified ? `<span style="color:var(--success);"><i class="fas fa-check-circle"></i>Email sent</span>` : ''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
      <span class="reminder-time ${isOverdue?'overdue':''}">${timeStr}</span>
      <div class="reminder-actions">
        <button class="btn-icon" onclick="openTaskForm(${a.id})" title="Edit"><i class="fas fa-pen"></i></button>
        <button class="btn-icon" onclick="dismissReminder(${a.id})" title="Mark done" style="color:var(--success);"><i class="fas fa-check"></i></button>
      </div>
    </div>
  </div>`;
}

/** Mark a reminder as completed (dismissed) and reload. */
window.dismissReminder = async function(id) {
  const a = State.reminders.find(x => x.id === id);
  if (!a) return;
  try {
    await api(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify({ ...a, completed: true }) });
    showToast('Reminder dismissed');
    loadReminders();
  } catch(e) { showToast(e.message, 'error'); }
};

/** Open the add-reminder modal, pre-focused on the reminder datetime field. */
window.openReminderForm = function() {
  const companyOptions = State.companies.map(co =>
    `<option value="${co.id}">${esc(co.name)}</option>`).join('');
  const contactOptions = State.contacts.map(c =>
    `<option value="${c.id}">${esc(c.first_name)} ${esc(c.last_name)}</option>`).join('');

  openModal('Add Reminder', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Title *</label>
        <input id="rf_title" class="form-control" placeholder="What to be reminded about?">
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select id="rf_type" class="form-control">
          ${['call','email','meeting','task','visit','note'].map(t =>
            `<option value="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="rf_due" class="form-control" type="datetime-local">
      </div>
      <div class="form-group full">
        <label class="form-label"><i class="fas fa-bell" style="color:var(--warning);margin-right:4px;"></i>Reminder Date/Time *</label>
        <input id="rf_reminder" class="form-control" type="datetime-local" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Contact</label>
        <select id="rf_contact" class="form-control">
          <option value="">— None —</option>${contactOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <select id="rf_company" class="form-control">
          <option value="">— None —</option>${companyOptions}
        </select>
      </div>
      <div class="form-group full">
        <label class="form-label">Notes</label>
        <textarea id="rf_desc" class="form-control" rows="2"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveReminder()">Save</button>
    </div>`);
  setTimeout(() => document.getElementById('rf_title')?.focus(), 50);
};

/** Create a new reminder activity and reload the list. */
window.saveReminder = async function() {
  const title = document.getElementById('rf_title').value.trim();
  const reminder_at = document.getElementById('rf_reminder').value;
  if (!title) { showToast('Title is required', 'error'); return; }
  if (!reminder_at) { showToast('Reminder date/time is required', 'error'); return; }
  const body = {
    type:        document.getElementById('rf_type').value,
    title,
    due_date:    document.getElementById('rf_due').value || null,
    reminder_at,
    contact_id:  document.getElementById('rf_contact').value || null,
    company_id:  document.getElementById('rf_company').value || null,
    description: document.getElementById('rf_desc').value.trim(),
    completed:   false,
  };
  try {
    await api('/api/activities', { method: 'POST', body: JSON.stringify(body) });
    showToast('Reminder set');
    closeModal();
    loadReminders();
  } catch(e) { showToast(e.message, 'error'); }
};
