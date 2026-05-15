/**
 * @file pages/users.js
 * @description Users page (manager only): grouped user table, add/edit/delete
 * modal with role, PIN, email, phone, and team-leader assignment.
 */

/* ============================================================
   USERS (Manager only)
   ============================================================ */

/** Fetch all users and render the grouped table. */
async function loadUsers() {
  document.getElementById('users-table-container').innerHTML = '<div class="spinner"></div>';
  try {
    State.users = await api('/api/users') || [];
    document.getElementById('users-count').textContent = `${State.users.length} user${State.users.length !== 1 ? 's' : ''}`;
    renderUsersTable(State.users);
  } catch (e) {
    document.getElementById('users-table-container').innerHTML = emptyState('fa-exclamation-circle', 'Failed to load users');
  }
}

/** Render users grouped by role hierarchy: manager → TL → their sales → unassigned sales. */
function renderUsersTable(users) {
  const container = document.getElementById('users-table-container');
  if (!users.length) { container.innerHTML = emptyState('fa-user-shield', 'No users found'); return; }

  const managers    = users.filter(u => u.role === 'manager');
  const teamLeaders = users.filter(u => u.role === 'team_leader');
  const allSales    = users.filter(u => u.role === 'sales');

  let rows = '';
  managers.forEach(u => { rows += userRow(u, 0); });
  teamLeaders.forEach(tl => {
    rows += userRow(tl, 1);
    allSales.filter(s => s.team_leader_id === tl.id).forEach(s => { rows += userRow(s, 2); });
  });
  allSales.filter(s => !s.team_leader_id).forEach(s => { rows += userRow(s, 1); });

  container.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Name</th><th>Role</th><th>Team Leader</th><th>Email</th><th>Phone</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

/** Render one user as a table row with indentation for hierarchy. */
function userRow(u, indent = 0) {
  const isSelf = u.id === State.currentUser?.id;
  const ROLE_LABELS = { manager: 'Manager', team_leader: 'Team Leader', sales: 'Sales' };
  const indentStyle = indent > 0 ? `padding-left:${indent * 20 + 12}px;` : '';
  const connector = indent === 2 ? '<span style="color:var(--border);margin-right:4px;">└</span>' :
                    indent === 1 ? '<span style="color:var(--border);margin-right:4px;">├</span>' : '';
  return `<tr>
    <td><div class="avatar-name" style="${indentStyle}">
      ${connector}
      <div class="avatar" style="background:${avatarColor(u.name)};color:white;font-size:11px;font-weight:600;">${initials(u.name)}</div>
      <div>
        <div class="name-cell">${esc(u.name)} ${isSelf ? '<span style="font-size:11px;color:var(--text-muted);">(you)</span>' : ''}</div>
      </div>
    </div></td>
    <td><span class="badge badge-role-${u.role}">${esc(ROLE_LABELS[u.role] || u.role)}</span></td>
    <td>${u.team_leader_name ? `<span style="font-size:12px;color:var(--text-muted);"><i class="fas fa-sitemap" style="font-size:10px;"></i> ${esc(u.team_leader_name)}</span>` : '—'}</td>
    <td>${u.email ? `<a href="mailto:${esc(u.email)}" style="color:var(--primary);text-decoration:none;font-size:13px;">${esc(u.email)}</a>` : '—'}</td>
    <td style="font-size:13px;">${esc(u.phone || '—')}</td>
    <td><div class="td-actions">
      <button class="btn-icon" onclick="openUserForm(${u.id})" title="Edit"><i class="fas fa-pen"></i></button>
      ${!isSelf ? `<button class="btn-icon danger" onclick="deleteUser(${u.id})" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
    </div></td>
  </tr>`;
}

/** Open the add/edit user modal. */
function openUserForm(id) {
  const u = id ? State.users.find(x => x.id === id) : null;
  const teamLeaders = (State.users || []).filter(x => x.role === 'team_leader');
  const tlOptions = teamLeaders.map(tl =>
    `<option value="${tl.id}" ${u?.team_leader_id === tl.id ? 'selected' : ''}>${esc(tl.name)}</option>`
  ).join('');

  openModal(u ? 'Edit User' : 'Add User', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Name *</label>
        <input id="uf_name" class="form-control" value="${esc(u?.name || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Role</label>
        <select id="uf_role" class="form-control" onchange="toggleTLField()">
          <option value="sales"       ${u?.role === 'sales'       ? 'selected' : ''}>Sales</option>
          <option value="team_leader" ${u?.role === 'team_leader' ? 'selected' : ''}>Team Leader</option>
          <option value="manager"     ${u?.role === 'manager'     ? 'selected' : ''}>Manager</option>
        </select>
      </div>
      <div class="form-group" id="uf_tl_group" style="display:${(!u || u.role === 'sales') ? '' : 'none'}">
        <label class="form-label"><i class="fas fa-sitemap" style="color:var(--primary);margin-right:4px;"></i>Team Leader</label>
        <select id="uf_tl" class="form-control">
          <option value="">— None (unassigned) —</option>${tlOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">PIN (4 digits) ${u ? '— leave blank to keep current' : '*'}</label>
        <input id="uf_pin" class="form-control" type="password" maxlength="4" pattern="\\d{4}" placeholder="${u ? '••••' : '4-digit PIN'}" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label class="form-label"><i class="fas fa-envelope" style="color:var(--primary);margin-right:4px;"></i>Email — for reminders</label>
        <input id="uf_email" class="form-control" type="email" value="${esc(u?.email || '')}" placeholder="user@example.com">
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input id="uf_phone" class="form-control" value="${esc(u?.phone || '')}" placeholder="01xxxxxxxxxx">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveUser(${id || 'null'})">Save</button>
    </div>`);
}

/** Show/hide the team-leader selector based on the selected role. */
window.toggleTLField = function() {
  const role = document.getElementById('uf_role')?.value;
  const grp  = document.getElementById('uf_tl_group');
  if (grp) grp.style.display = role === 'sales' ? '' : 'none';
};

/** Persist a new or edited user, update sidebar if editing self, then reload. */
window.saveUser = async function (id) {
  const name  = document.getElementById('uf_name').value.trim();
  const role  = document.getElementById('uf_role').value;
  const pin   = document.getElementById('uf_pin').value.trim();
  const email = document.getElementById('uf_email').value.trim();
  const phone = document.getElementById('uf_phone').value.trim();

  if (!name) { showToast('Name is required', 'error'); return; }
  if (!id && !pin) { showToast('PIN is required', 'error'); return; }
  if (pin && !/^\d{4}$/.test(pin)) { showToast('PIN must be exactly 4 digits', 'error'); return; }

  const tlId = document.getElementById('uf_tl')?.value || null;
  const body = { name, role, email: email || null, phone: phone || null, team_leader_id: tlId || null };
  if (pin) body.pin = pin;

  try {
    if (id) {
      await api(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('User updated');
      if (id === State.currentUser.id) {
        State.currentUser.name = name;
        State.currentUser.role = role;
        updateSidebarUser();
        updateNavVisibility();
      }
    } else {
      await api('/api/users', { method: 'POST', body: JSON.stringify(body) });
      showToast('User added');
    }
    closeModal();
    loadUsers();
  } catch (e) { showToast(e.message, 'error'); }
};

/** Confirm and delete a user (cannot delete yourself). */
window.deleteUser = function (id) {
  const u = State.users.find(x => x.id === id);
  if (id === State.currentUser?.id) { showToast('Cannot delete your own account', 'error'); return; }
  confirmDialog(`Delete user "${u?.name}"?`, 'Their data will remain but be reassigned to manager.', async () => {
    try {
      await api(`/api/users/${id}`, { method: 'DELETE' });
      showToast('User deleted');
      loadUsers();
    } catch (e) { showToast(e.message, 'error'); }
  });
};
