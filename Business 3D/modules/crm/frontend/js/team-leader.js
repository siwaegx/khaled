/**
 * @file team-leader.js
 * @description Team-leader / manager member-selector bar.
 * Renders a row of chips below the topbar so managers or TLs can
 * switch which user's data is currently being viewed.
 */

/* ============================================================
   TEAM LEADER — member selector bar
   ============================================================ */

/** Fetch the TL's team members and render the member-selector bar. */
async function initTLMemberBar() {
  const role = State.currentUser?.role;
  if (role === 'team_leader') {
    try {
      const data = await api('/api/team');
      State.teamMembers = data.members || [];
    } catch (_) {}
  }
  renderTLMemberBar();
}

/** Re-render the chip strip with the current teamMembers / users list. */
function renderTLMemberBar() {
  const bar = document.getElementById('tl-member-bar');
  if (!bar) return;
  const role = State.currentUser?.role;
  const isManager = role === 'manager';
  const isTL = role === 'team_leader';
  if (!isManager && !isTL) { bar.style.display = 'none'; return; }
  bar.style.display = '';

  // Manager sees all users; TL sees their team members only
  const members = isManager
    ? (State.users || []).filter(u => u.id !== State.currentUser.id)
    : State.teamMembers;

  const chips = document.getElementById('tl-member-chips');
  chips.innerHTML = `
    <button class="tl-chip ${!State.viewAsUserId ? 'active' : ''}" onclick="setViewAs(null)">
      <i class="fas ${isManager ? 'fa-users' : 'fa-user-tie'}"></i>
      ${isManager ? 'All Data' : 'My Data'}
    </button>
    ${members.map(m => `
      <button class="tl-chip ${State.viewAsUserId === m.id ? 'active' : ''}" onclick="setViewAs(${m.id})">
        <span class="tl-chip-avatar" style="background:${avatarColor(m.name)}">${initials(m.name)}</span>
        ${esc(m.name)}
      </button>`).join('')}`;
}

/**
 * Switch the "view as" scope to a specific user (or back to the default view).
 * Clears all caches so every page re-fetches scoped data.
 */
window.setViewAs = function (userId) {
  State.viewAsUserId = userId;
  State.companyCache = {};
  State.contactCache = {};
  State.selectedCompanyId = null;
  State.selectedContactId = null;
  renderTLMemberBar();
  loadPage(State.currentPage);
};
