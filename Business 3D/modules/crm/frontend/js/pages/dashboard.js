/**
 * @file pages/dashboard.js
 * @description Dashboard page: stat cards, pipeline chart, activity feed,
 * leaderboard with goal progress bars, and the goals modal.
 */

/* ============================================================
   DASHBOARD
   ============================================================ */

/** Fetch dashboard stats and render the full dashboard page. */
async function loadDashboard() {
  document.getElementById('dashboard-content').innerHTML = '<div class="spinner"></div>';
  try {
    const month = new Date().toISOString().slice(0,7);
    const [data, goalsData] = await Promise.all([
      api('/api/dashboard'),
      ['manager','team_leader'].includes(State.currentUser?.role)
        ? api(`/api/goals?month=${month}`, {_silent:true}).catch(()=>({goals:[]}))
        : Promise.resolve({goals:[]}),
    ]);
    if (!data) return;
    document.getElementById('dashboard-subtitle').textContent = `Welcome back, ${State.currentUser?.name}!`;
    renderDashboard({ ...data, goals: goalsData.goals || [] });
  } catch(e) {
    console.error('Dashboard load error:', e.message);
    document.getElementById('dashboard-content').innerHTML = emptyState('fa-exclamation-circle', 'Failed to load dashboard', e.message);
  }
}

/** Open a modal listing each team member's current monthly goal with edit buttons. */
window.loadGoalsModal = async function() {
  const month = new Date().toISOString().slice(0,7);
  const {goals} = await api(`/api/goals?month=${month}`).catch(()=>({goals:[]}));
  const users = State.users || [];
  openModal('Monthly Goals — ' + month, `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text-muted);">Click a user to set or update their goal for this month.</div>
    ${users.filter(u=>u.role!=='manager').map(u => {
      const g = goals.find(x=>x.user_id===u.id);
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="width:32px;height:32px;border-radius:50%;background:${avatarColor(u.name)};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;">${initials(u.name)}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${esc(u.name)}</div>
          ${g ? `<div style="font-size:11px;color:var(--text-muted);">Rev: ${fmtMoney(g.target_revenue)} · Deals: ${g.target_deals} · Acts: ${g.target_activities}</div>` : '<div style="font-size:11px;color:var(--text-muted);">No goal set</div>'}
        </div>
        <button class="btn btn-sm btn-secondary" onclick="closeModal();openGoalForm(${u.id},'${esc(u.name)}','${month}')"><i class="fas fa-bullseye"></i> ${g ? 'Edit' : 'Set'}</button>
      </div>`;
    }).join('')}
  `);
};

/** Render the full dashboard HTML into the #dashboard-content container. */
function renderDashboard({ stats: s, dealsByStage, recentContacts, upcomingActivities, recentDeals, overdueCount, activityFeed, leaderboard, goals }) {
  const canSeeLeaderboard = ['manager','team_leader'].includes(State.currentUser?.role);
  document.getElementById('dashboard-content').innerHTML = `
    <div class="stats-grid">
      ${statCard('fa-users',             'Contacts',     s.totalContacts,            'var(--primary)')}
      ${statCard('fa-building',          'Companies',    s.totalCompanies,           '#10b981')}
      ${statCard('fa-handshake',         'Active Deals', s.totalDeals,               '#f59e0b')}
      ${statCard('fa-trophy',            'Won Revenue',  fmtMoney(s.wonRevenue),     '#8b5cf6')}
      ${statCard('fa-filter',            'Pipeline',     fmtMoney(s.pipelineValue),  '#3b82f6')}
      ${statCard('fa-chart-line',        'Forecast',     fmtMoney(s.forecastValue||0),'#14b8a6')}
      ${statCard('fa-exclamation-circle','Overdue',      overdueCount||0,            '#ef4444')}
    </div>

    <div class="dashboard-grid">
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-chart-bar" style="color:var(--primary);margin-right:6px;"></i>Pipeline by Stage</div>
        <div class="chart-wrapper"><canvas id="dealsChart"></canvas></div>
      </div>
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-clock" style="color:var(--warning);margin-right:6px;"></i>Due Soon</div>
        <ul class="recent-list">
          ${upcomingActivities.length ? upcomingActivities.map(a => {
            const overdue = a.due_date && new Date(a.due_date) < new Date();
            return `<li class="recent-item">
              <div class="type-icon type-${a.type}"><i class="fas ${TYPE_ICONS[a.type]||'fa-circle'}"></i></div>
              <div class="recent-item-info">
                <div class="recent-item-name">${esc(a.title)}</div>
                <div class="recent-item-sub">${esc(a.company_name||a.contact_name||'—')}</div>
              </div>
              <div class="recent-item-right ${overdue?'overdue':''}">${fmtDate(a.due_date)}</div>
            </li>`;
          }).join('') : '<li class="empty-list-item">No upcoming activities</li>'}
        </ul>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-bolt" style="color:var(--warning);margin-right:6px;"></i>Activity Feed</div>
        <ul class="recent-list">
          ${activityFeed && activityFeed.length ? activityFeed.map(a => `
            <li class="recent-item">
              <div class="type-icon type-${a.type}"><i class="fas ${TYPE_ICONS[a.type]||'fa-circle'}"></i></div>
              <div class="recent-item-info">
                <div class="recent-item-name">${esc(a.title)}</div>
                <div class="recent-item-sub">
                  ${a.user_name ? `<span style="font-weight:500;">${esc(a.user_name)}</span>` : ''}
                  ${a.company_name ? ` · ${esc(a.company_name)}` : a.contact_name ? ` · ${esc(a.contact_name)}` : ''}
                </div>
              </div>
              <div class="recent-item-right">${fmtDate(a.created_at)}</div>
            </li>`).join('') : '<li class="empty-list-item">No activities yet</li>'}
        </ul>
      </div>
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-handshake" style="color:var(--primary);margin-right:6px;"></i>Recent Deals</div>
        <ul class="recent-list">
          ${recentDeals.length ? recentDeals.map(d => `
            <li class="recent-item">
              <div style="width:10px;height:10px;border-radius:50%;background:${STAGE_COLORS[d.stage]};flex-shrink:0;margin-top:2px;"></div>
              <div class="recent-item-info">
                <div class="recent-item-name">${esc(d.title)}</div>
                <div class="recent-item-sub">${esc(d.company_name||'—')}</div>
              </div>
              <div class="recent-item-right" style="font-weight:600;color:var(--primary);">${fmtMoney(d.value)}</div>
            </li>`).join('') : '<li class="empty-list-item">No deals yet</li>'}
        </ul>
      </div>
    </div>

    ${canSeeLeaderboard && leaderboard && leaderboard.length ? `
    <div class="card dash-card" style="margin-top:0;">
      <div class="dash-card-title" style="justify-content:space-between;">
        <span><i class="fas fa-medal" style="color:#f59e0b;margin-right:6px;"></i>Team Leaderboard</span>
        ${State.currentUser?.role === 'manager' ? `<button class="btn btn-sm btn-secondary" onclick="loadGoalsModal()"><i class="fas fa-bullseye"></i> Goals</button>` : ''}
      </div>
      <div class="leaderboard">
        ${leaderboard.map((u,i) => {
          const goal = (goals||[]).find(g => g.user_id === u.id);
          return `<div class="lb-row">
            <div class="lb-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${i+1}</div>
            <div class="lb-avatar" style="background:${avatarColor(u.name)}">${initials(u.name)}</div>
            <div class="lb-info">
              <div class="lb-name">${esc(u.name)}</div>
              <div class="lb-role">${u.role}</div>
              ${goal ? `
                ${goalBar(goal.actual_revenue||0, goal.target_revenue, avatarColor(u.name))}
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${goal.actual_activities||0}/${goal.target_activities||0} activities · ${goal.actual_deals||0}/${goal.target_deals||0} deals</div>
              ` : ''}
            </div>
            <div class="lb-stats">
              <div class="lb-stat"><span class="lb-val">${u.activity_count}</span><span class="lb-lbl">Acts</span></div>
              <div class="lb-stat"><span class="lb-val">${u.deal_count}</span><span class="lb-lbl">Deals</span></div>
              <div class="lb-stat"><span class="lb-val">${fmtMoney(u.won_revenue)}</span><span class="lb-lbl">Won</span></div>
            </div>
            ${State.currentUser?.role === 'manager' ? `<button class="btn btn-sm btn-secondary" style="flex-shrink:0;" onclick="openGoalForm(${u.id},'${esc(u.name)}')" title="Set goal"><i class="fas fa-bullseye"></i></button>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}`;

  renderDealsChart(dealsByStage);
}

/** Render a single stat card tile. */
function statCard(icon, label, value, color) {
  return `<div class="stat-card" style="border-left:4px solid ${color};">
    <div class="stat-icon" style="background:${color}22;color:${color};"><i class="fas ${icon}"></i></div>
    <div class="stat-info">
      <div class="stat-value">${esc(String(value))}</div>
      <div class="stat-label">${esc(label)}</div>
    </div>
  </div>`;
}

/** Render the deals pipeline bar chart using Chart.js. */
function renderDealsChart(dealsByStage) {
  const ctx = document.getElementById('dealsChart')?.getContext('2d');
  if (!ctx) return;
  if (State.dealChart) State.dealChart.destroy();
  const order  = ['lead','qualified','proposal','negotiation','won','lost'];
  const sorted = order.map(s => dealsByStage.find(d => d.stage === s)).filter(Boolean);
  const labels = sorted.map(d => STAGE_LABELS[d.stage] || d.stage);
  const counts = sorted.map(d => d.count);
  const values = sorted.map(d => d.value);
  const colors = sorted.map(d => STAGE_COLORS[d.stage] || '#9ca3af');
  State.dealChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Deals', data: counts, backgroundColor: colors, borderRadius: 6, yAxisID: 'y' },
        { label: 'Value', data: values, backgroundColor: colors.map(c => c + '33'), borderColor: colors, borderWidth: 1, borderRadius: 6, type: 'bar', yAxisID: 'y2' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y:  { position: 'left',  ticks: { font: { size: 11 }, color: '#6b7280' }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y2: { position: 'right', ticks: { font: { size: 11 }, color: '#6b7280', callback: v => fmtMoney(v) }, grid: { display: false } },
        x:  { ticks: { font: { size: 11 }, color: '#6b7280' }, grid: { display: false } },
      },
    },
  });
}
