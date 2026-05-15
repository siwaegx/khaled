/**
 * @file pages/team.js
 * @description My Team page (Team Leader only): member cards with stats
 * and recent activity feed for each assigned sales user.
 */

/* ============================================================
   MY TEAM PAGE (Team Leader)
   ============================================================ */

/** Fetch team data from the API and render member cards. */
async function loadTeamPage() {
  const container = document.getElementById('team-content');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const data = await api('/api/team');
    renderTeamPage(data);
  } catch(e) {
    container.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load team', e.message);
  }
}

/** Render the team member card grid with stats and recent activities. */
function renderTeamPage({ members }) {
  const container = document.getElementById('team-content');
  const subtitle  = document.getElementById('team-subtitle');
  if (subtitle) subtitle.textContent = `${members.length} member${members.length !== 1 ? 's' : ''} on your team`;

  if (!members.length) {
    container.innerHTML = emptyState('fa-users-cog', 'No sales users assigned to you yet',
      'Ask your manager to assign sales users to your team.');
    return;
  }

  container.innerHTML = `<div class="team-members-grid">${members.map(m => `
    <div class="team-member-card card">
      <div class="team-member-header">
        <div class="entity-card-avatar" style="background:${avatarColor(m.name)};width:42px;height:42px;font-size:15px;">${initials(m.name)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:600;">${esc(m.name)}</div>
          <div style="font-size:12px;color:var(--text-muted);">${m.email ? esc(m.email) : 'No email'}</div>
        </div>
        <span class="badge badge-role-sales">Sales</span>
      </div>
      <div class="team-member-stats">
        <div class="tm-stat"><div class="tm-stat-val">${m.companies}</div><div class="tm-stat-lbl">Companies</div></div>
        <div class="tm-stat"><div class="tm-stat-val">${m.contacts}</div><div class="tm-stat-lbl">Contacts</div></div>
        <div class="tm-stat"><div class="tm-stat-val">${m.deals}</div><div class="tm-stat-lbl">Active Deals</div></div>
        <div class="tm-stat"><div class="tm-stat-val" style="color:var(--success);">${fmtMoney(m.wonRevenue)}</div><div class="tm-stat-lbl">Won</div></div>
        <div class="tm-stat"><div class="tm-stat-val" style="color:${m.tasks > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${m.tasks}</div><div class="tm-stat-lbl">Pending Tasks</div></div>
        <div class="tm-stat"><div class="tm-stat-val">${fmtMoney(m.pipeline)}</div><div class="tm-stat-lbl">Pipeline</div></div>
      </div>
      ${m.recentActs.length ? `
      <div class="team-member-activity">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Recent Activity</div>
        ${m.recentActs.map(a => `
          <div class="co-activity-row ${a.completed ? 'done' : ''}">
            <div class="co-activity-icon" style="background:${a.type==='call'?'#3b82f6':a.type==='visit'?'#10b981':a.type==='email'?'#8b5cf6':'#f59e0b'};">
              <i class="fas ${TYPE_ICONS[a.type]||'fa-circle'}"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <div class="co-activity-title">${esc(a.title)}</div>
              <div class="co-activity-meta">
                ${a.company_name ? `<span><i class="fas fa-building"></i>${esc(a.company_name)}</span>` : ''}
                <span><i class="fas fa-clock"></i>${fmtDate(a.created_at)}</span>
              </div>
            </div>
          </div>`).join('')}
      </div>` : `<div style="padding:12px;text-align:center;font-size:12px;color:var(--text-muted);">No recent activity</div>`}
    </div>`).join('')}
  </div>`;
}
