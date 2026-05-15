/**
 * @file pages/tasks.js
 * @description Tasks page: personal task list with completion toggle, filters,
 * add/edit/delete modal, and the broadcast "Assign Team Task" form for managers/TLs.
 */

/* ============================================================
   TASKS
   ============================================================ */

/** Fetch tasks (activities of type=task) and render the list. */
async function loadTasks() {
  const container = document.getElementById('tasks-list');
  if (container) container.innerHTML = '<div class="spinner"></div>';
  try {
    const params = new URLSearchParams();
    if (State.taskFilter === 'pending')   params.set('completed', 'false');
    if (State.taskFilter === 'completed') params.set('completed', 'true');
    State.tasks = await api('/api/tasks?' + params) || [];
    const el = document.getElementById('tasks-count');
    if (el) el.textContent = `${State.tasks.length} task${State.tasks.length !== 1 ? 's' : ''}`;
    renderTaskList(State.tasks);
  } catch (e) {
    const c = document.getElementById('tasks-list');
    if (c) c.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load tasks');
  }
}

/** Switch pending/completed/all filter and reload. */
window.filterTasks = function (filter) {
  State.taskFilter = filter;
  document.querySelectorAll('#page-tasks .tab').forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
  loadTasks();
};

/** Render all tasks into the list container. */
function renderTaskList(tasks) {
  const container = document.getElementById('tasks-list');
  if (!container) return;
  if (!tasks.length) {
    container.innerHTML = emptyState('fa-check-square', 'No tasks found', 'Add a task to get started');
    return;
  }
  const now = new Date();
  container.innerHTML = `<div class="tasks-list">${tasks.map(t => taskItem(t, now)).join('')}</div>`;
}

/** Render a single task row with assignment badges, meta, and action buttons. */
function taskItem(a, now = new Date()) {
  const isOverdue      = !a.completed && a.due_date && new Date(a.due_date) < now;
  const isAssigned     = a.assigned_to && a.assigned_to !== a.user_id;
  const isAssignedToMe = a.assigned_to === State.currentUser?.id && a.user_id !== State.currentUser?.id;
  return `<div class="task-item ${a.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''} ${isAssignedToMe ? 'assigned-to-me' : ''}">
    <div class="task-check">
      <input type="checkbox" ${a.completed ? 'checked' : ''} onchange="toggleTask(${a.id}, this.checked)">
    </div>
    <div class="task-body">
      <div class="task-title ${a.completed ? 'done' : ''}">${esc(a.title)}
        ${isAssignedToMe ? `<span class="task-from-badge"><i class="fas fa-user-tie" style="font-size:9px;"></i> From ${esc(a.user_name||'Manager')}</span>` : ''}
        ${isAssigned && !isAssignedToMe ? `<span class="assigned-badge"><i class="fas fa-user-check" style="font-size:9px;"></i> ${esc(a.assigned_to_name||'—')}</span>` : ''}
        ${a.reminder_at ? `<span class="task-reminder-badge"><i class="fas fa-bell" style="font-size:9px;"></i> Reminder set</span>` : ''}
      </div>
      <div class="task-meta">
        ${a.contact_name ? `<span><i class="fas fa-user"></i>${esc(a.contact_name)}</span>` : ''}
        ${a.company_name ? `<span><i class="fas fa-building"></i>${esc(a.company_name)}</span>` : ''}
        ${a.due_date ? `<span class="${isOverdue ? 'overdue' : ''}"><i class="fas fa-clock"></i>${fmtDate(a.due_date)}</span>` : ''}
        ${a.description ? `<span style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-align-left"></i>${esc(a.description)}</span>` : ''}
      </div>
    </div>
    <div class="task-actions">
      ${!isAssignedToMe ? `<button class="btn-icon" onclick="openTaskForm(${a.id})" title="Edit"><i class="fas fa-pen"></i></button>` : ''}
      ${!isAssignedToMe ? `<button class="btn-icon danger" onclick="deleteTask(${a.id})" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
    </div>
  </div>`;
}

/** Toggle the completed state of a task and reload. */
window.toggleTask = async function (id, completed) {
  const a = State.tasks.find(x => x.id === id);
  if (!a) return;
  try {
    await api(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify({ ...a, completed }) });
    loadTasks();
  } catch (e) { showToast(e.message, 'error'); }
};

/** Open the personal task add/edit modal. */
window.openTaskForm = function(id) {
  const a = id ? State.tasks.find(x => x.id === id) : null;
  const contactOptions = State.contacts.map(c =>
    `<option value="${c.id}" ${a?.contact_id === c.id ? 'selected' : ''}>${esc(c.first_name)} ${esc(c.last_name)}</option>`
  ).join('');
  const companyOptions = State.companies.map(co =>
    `<option value="${co.id}" ${a?.company_id === co.id ? 'selected' : ''}>${esc(co.name)}</option>`
  ).join('');

  openModal(a ? 'Edit Task' : 'Add Task', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Task Title *</label>
        <input id="tf_title" class="form-control" value="${esc(a?.title || '')}" placeholder="What needs to be done?">
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="tf_due" class="form-control" type="datetime-local" value="${a?.due_date ? a.due_date.slice(0,16) : ''}">
      </div>
      <div class="form-group">
        <label class="form-label"><i class="fas fa-bell" style="color:var(--warning);margin-right:4px;"></i>Reminder</label>
        <input id="tf_reminder" class="form-control" type="datetime-local" value="${a?.reminder_at ? a.reminder_at.slice(0,16) : ''}" title="Sends email notification to assigned user">
      </div>
      <div class="form-group">
        <label class="form-label">Contact</label>
        <select id="tf_contact" class="form-control">
          <option value="">— None —</option>${contactOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <select id="tf_company" class="form-control">
          <option value="">— None —</option>${companyOptions}
        </select>
      </div>
      <div class="form-group full">
        <label class="form-label">Notes</label>
        <textarea id="tf_desc" class="form-control" rows="2">${esc(a?.description || '')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveTask(${id || 'null'})">Save</button>
    </div>`);
  setTimeout(() => document.getElementById('tf_title')?.focus(), 50);
};

/** Persist a new or edited personal task then reload. */
window.saveTask = async function(id) {
  const title = document.getElementById('tf_title').value.trim();
  if (!title) { showToast('Title is required', 'error'); return; }
  const body = {
    type: 'task',
    title,
    due_date:    document.getElementById('tf_due').value || null,
    reminder_at: document.getElementById('tf_reminder').value || null,
    contact_id:  document.getElementById('tf_contact').value || null,
    company_id:  document.getElementById('tf_company').value || null,
    description: document.getElementById('tf_desc').value.trim(),
    completed:   id ? (State.tasks.find(a => a.id === id)?.completed || false) : false,
  };
  try {
    if (id) {
      await api(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Task updated');
    } else {
      await api('/api/activities', { method: 'POST', body: JSON.stringify(body) });
      showToast('Task added');
    }
    closeModal();
    loadTasks();
  } catch(e) { showToast(e.message, 'error'); }
};

/** Confirm and delete a personal task, then reload. */
window.deleteTask = function(id) {
  const a = State.tasks.find(x => x.id === id);
  confirmDialog(`Delete "${a?.title}"?`, 'This action cannot be undone.', async () => {
    try {
      await api(`/api/activities/${id}`, { method: 'DELETE' });
      showToast('Task deleted');
      loadTasks();
    } catch(e) { showToast(e.message, 'error'); }
  });
};

/* ============================================================
   GENERAL / BROADCAST TASKS (Manager & Team Leader)
   ============================================================ */

/** Open a modal for managers/TLs to broadcast a task to a group or individual. */
window.openGeneralTaskForm = function() {
  const role = State.currentUser?.role;
  const isTL = role === 'team_leader';

  let groups = [];
  if (isTL) {
    const members = State.teamMembers || [];
    if (members.length) {
      groups.push({ label: 'My Entire Team', ids: members.map(m => m.id) });
      members.forEach(m => groups.push({ label: m.name, ids: [m.id] }));
    }
  } else {
    const users = State.users || [];
    const tls   = users.filter(u => u.role === 'team_leader');
    const sales = users.filter(u => u.role === 'sales');
    groups.push({ label: 'Everyone (All Users)', ids: users.filter(u => u.id !== State.currentUser.id).map(u => u.id) });
    if (tls.length)   groups.push({ label: 'All Team Leaders', ids: tls.map(u => u.id) });
    if (sales.length) groups.push({ label: 'All Sales', ids: sales.map(u => u.id) });
    users.filter(u => u.id !== State.currentUser.id).forEach(u =>
      groups.push({ label: `${u.name} (${u.role === 'team_leader' ? 'TL' : 'Sales'})`, ids: [u.id] })
    );
  }

  if (!groups.length) { showToast('No team members to assign to', 'error'); return; }

  const groupOpts = groups.map((g, i) =>
    `<option value="${i}">${esc(g.label)} ${g.ids.length > 1 ? `— ${g.ids.length} people` : ''}</option>`
  ).join('');

  openModal('Assign Team Task', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Task Title *</label>
        <input id="gt_title" class="form-control" placeholder="What needs to be done?">
      </div>
      <div class="form-group full">
        <label class="form-label"><i class="fas fa-users" style="color:var(--primary);margin-right:4px;"></i> Assign To *</label>
        <select id="gt_recipients" class="form-control" size="1">
          ${groupOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="gt_due" class="form-control" type="datetime-local">
      </div>
      <div class="form-group full">
        <label class="form-label">Description</label>
        <textarea id="gt_desc" class="form-control" rows="3" placeholder="Task details, instructions..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveGeneralTask(${JSON.stringify(groups).replace(/"/g,'&quot;')})">
        <i class="fas fa-paper-plane"></i> Send Task
      </button>
    </div>`);
  setTimeout(() => document.getElementById('gt_title')?.focus(), 50);
};

/** Send a broadcast task to every user in the selected group. */
window.saveGeneralTask = async function(groups) {
  const title = document.getElementById('gt_title')?.value.trim();
  if (!title) { showToast('Title is required', 'error'); return; }
  const idx   = parseInt(document.getElementById('gt_recipients')?.value) || 0;
  const group = groups[idx];
  if (!group || !group.ids.length) { showToast('Select recipients', 'error'); return; }

  const due_date    = document.getElementById('gt_due')?.value || null;
  const description = document.getElementById('gt_desc')?.value.trim() || null;

  const btn = document.querySelector('#modalDialog .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  try {
    let sent = 0;
    for (const userId of group.ids) {
      await api('/api/activities', {
        method: 'POST',
        body: JSON.stringify({ type: 'task', title, description, due_date, assigned_to: userId, completed: false }),
      });
      sent++;
    }
    showToast(`Task sent to ${sent} team member${sent !== 1 ? 's' : ''}`, 'success');
    closeModal();
    loadTasks();
  } catch(e) {
    showToast(e.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Task'; }
  }
};
