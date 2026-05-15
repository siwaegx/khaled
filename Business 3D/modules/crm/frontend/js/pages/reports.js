/**
 * @file pages/reports.js
 * @description Reports page: date-range selector, KPI summary cards, and
 * Chart.js charts for revenue trend, pipeline, activity, lead funnel, win/loss.
 */

/* ============================================================
   REPORTS
   ============================================================ */

/** Active Chart.js instances — destroyed before each re-render. */
let _reportCharts = [];

/** Destroy all active report charts to avoid canvas reuse errors. */
function destroyReportCharts() {
  _reportCharts.forEach(c => { try { c.destroy(); } catch(_){} });
  _reportCharts = [];
}

/** Create a Chart.js chart, register it for cleanup, and return the instance. */
function mkChart(id, config) {
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return;
  const c = new Chart(ctx, config);
  _reportCharts.push(c);
  return c;
}

/** Fetch report data for the current date range and render all charts. */
async function loadReports() {
  const container = document.getElementById('reports-content');
  if (!container) return;

  // Build the date-range bar once per page visit
  if (!document.getElementById('report-range-bar')) {
    const today = new Date();
    const y = today.getFullYear(), m = String(today.getMonth()+1).padStart(2,'0');
    const defaultFrom = `${y}-01-01`;
    const defaultTo   = `${y}-${m}-${today.getDate().toString().padStart(2,'0')}`;
    container.insertAdjacentHTML('beforebegin', `
      <div id="report-range-bar" class="report-range-bar">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:13px;font-weight:600;color:var(--text-muted);">Date range:</span>
          <button class="rng-btn active" data-range="ytd">Year to Date</button>
          <button class="rng-btn" data-range="30">Last 30 days</button>
          <button class="rng-btn" data-range="90">Last 90 days</button>
          <button class="rng-btn" data-range="12m">Last 12 months</button>
          <button class="rng-btn" data-range="custom">Custom</button>
          <span id="custom-range-inputs" style="display:none;gap:6px;align-items:center;display:none;">
            <input type="date" id="rng-from" class="form-control" style="height:32px;width:140px;" value="${defaultFrom}">
            <span style="color:var(--text-muted);">→</span>
            <input type="date" id="rng-to"   class="form-control" style="height:32px;width:140px;" value="${defaultTo}">
            <button class="btn btn-sm btn-primary" onclick="applyReportRange()">Apply</button>
          </span>
        </div>
        <a class="btn btn-sm btn-secondary" id="report-export-btn" href="/api/export/companies" style="margin-left:auto;" title="Export data">
          <i class="fas fa-file-export"></i> Export CSV
        </a>
      </div>`);
    document.querySelectorAll('.rng-btn').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.rng-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const ci = document.getElementById('custom-range-inputs');
      if (b.dataset.range === 'custom') { ci.style.display = 'flex'; return; }
      ci.style.display = 'none';
      applyReportRange(b.dataset.range);
    }));
  }

  container.innerHTML = '<div class="spinner"></div>';
  const { from, to } = getReportDateRange();
  try {
    const params = (from && to) ? `?from=${from}&to=${to}` : '';
    const data = await api(`/api/reports${params}`);
    renderReports(data);
  } catch(e) {
    container.innerHTML = emptyState('fa-exclamation-circle', 'Failed to load reports', e.message);
  }
}

/** Compute from/to date strings based on the active range button. */
function getReportDateRange() {
  const active = document.querySelector('.rng-btn.active')?.dataset.range || 'ytd';
  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const to = fmt(today);
  if (active === 'custom') {
    return { from: document.getElementById('rng-from')?.value, to: document.getElementById('rng-to')?.value };
  }
  if (active === '30') { const d = new Date(today); d.setDate(d.getDate()-30); return { from: fmt(d), to }; }
  if (active === '90') { const d = new Date(today); d.setDate(d.getDate()-90); return { from: fmt(d), to }; }
  if (active === '12m'){ const d = new Date(today); d.setFullYear(d.getFullYear()-1); return { from: fmt(d), to }; }
  return { from: `${today.getFullYear()}-01-01`, to };
}

/** Reload reports when the custom date range Apply button is clicked. */
window.applyReportRange = function() { loadReports(); };

/** Render KPI cards and all charts from the API response. */
function renderReports({ revenueByMonth, leadFunnel, activityByType, activityByUser, dealStages, topCompanies, winLoss }) {
  destroyReportCharts();
  const container = document.getElementById('reports-content');

  const totalRevenue = revenueByMonth.reduce((s,r) => s+r.revenue, 0);
  const totalWon     = winLoss.find(r => r.stage==='won');
  const totalLost    = winLoss.find(r => r.stage==='lost');
  const winRate      = (totalWon?.count||0) + (totalLost?.count||0) > 0
    ? Math.round((totalWon?.count||0) / ((totalWon?.count||0)+(totalLost?.count||0)) * 100) : 0;
  const totalActs    = activityByUser.reduce((s,r) => s+r.total, 0);

  container.innerHTML = `
    <div class="stats-grid" style="margin-bottom:20px;">
      ${statCard('fa-trophy',    'Won Revenue',    fmtMoney(totalRevenue),       '#10b981')}
      ${statCard('fa-handshake', 'Won Deals',      totalWon?.count||0,           '#8b5cf6')}
      ${statCard('fa-percentage','Win Rate',       winRate+'%',                  '#3b82f6')}
      ${statCard('fa-bolt',      'Activities',     totalActs,                    '#f59e0b')}
    </div>

    <div class="reports-grid">
      <div class="card dash-card" style="grid-column:1/-1;">
        <div class="dash-card-title"><i class="fas fa-chart-line" style="color:var(--primary);margin-right:6px;"></i>Revenue Trend</div>
        <div class="chart-wrapper" style="height:200px;"><canvas id="revenueChart"></canvas></div>
      </div>
    </div>

    <div class="reports-grid" style="margin-top:16px;">
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-funnel-dollar" style="color:var(--warning);margin-right:6px;"></i>Deal Pipeline</div>
        <div class="chart-wrapper"><canvas id="stageChart"></canvas></div>
      </div>
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-tasks" style="color:#10b981;margin-right:6px;"></i>Activity by Type</div>
        <div class="chart-wrapper"><canvas id="actTypeChart"></canvas></div>
      </div>
    </div>

    <div class="reports-grid" style="margin-top:16px;">
      <div class="card dash-card">
        <div class="dash-card-title" style="justify-content:space-between;">
          <span><i class="fas fa-user-clock" style="color:#8b5cf6;margin-right:6px;"></i>Activity by User</span>
        </div>
        <div class="report-user-list">
          ${activityByUser.length ? activityByUser.map(u => {
            const pct = activityByUser[0]?.total ? Math.round(u.total/activityByUser[0].total*100) : 0;
            return `<div class="report-user-row">
              <div class="report-user-av" style="background:${avatarColor(u.user_name||'?')}">${initials(u.user_name||'?')}</div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <span style="font-size:13px;font-weight:600;">${esc(u.user_name||'—')}</span>
                  <span style="font-size:12px;color:var(--text-muted);">${u.total} total · ${u.done} done · ${u.calls} calls</span>
                </div>
                <div class="report-bar-bg"><div class="report-bar-fill" style="width:${pct}%;background:${avatarColor(u.user_name||'?')};"></div></div>
              </div>
            </div>`;
          }).join('') : '<div style="padding:20px;text-align:center;color:var(--text-muted);">No activity data</div>'}
        </div>
      </div>
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-building" style="color:#3b82f6;margin-right:6px;"></i>Top Companies</div>
        ${topCompanies.length ? `<table class="report-table">
          <thead><tr><th>Company</th><th style="text-align:right;">Won</th><th style="text-align:center;">Deals</th></tr></thead>
          <tbody>${topCompanies.map((c,i) => `<tr>
            <td><span class="lb-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}" style="display:inline-flex;margin-right:6px;">${i+1}</span>${esc(c.name)}</td>
            <td style="text-align:right;font-weight:600;color:var(--success);">${fmtMoney(c.total_value)}</td>
            <td style="text-align:center;">${c.deal_count}</td>
          </tr>`).join('')}</tbody>
        </table>` : '<div style="padding:20px;text-align:center;color:var(--text-muted);">No won deals yet</div>'}
      </div>
    </div>

    <div class="reports-grid" style="margin-top:16px;">
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-filter" style="color:var(--primary);margin-right:6px;"></i>Lead Status Breakdown</div>
        <div class="chart-wrapper"><canvas id="funnelChart"></canvas></div>
      </div>
      <div class="card dash-card">
        <div class="dash-card-title"><i class="fas fa-balance-scale" style="color:var(--danger);margin-right:6px;"></i>Won vs Lost</div>
        <div class="chart-wrapper"><canvas id="winlossChart"></canvas></div>
      </div>
    </div>`;

  mkChart('revenueChart', {
    type: 'line',
    data: {
      labels: revenueByMonth.map(r => r.month || ''),
      datasets: [
        { label: 'Revenue', data: revenueByMonth.map(r => r.revenue), borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.1)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 4 },
        { label: 'Deals',   data: revenueByMonth.map(r => r.deals_count), borderColor: '#10b981', backgroundColor: 'transparent', borderWidth: 2, tension: 0.4, yAxisID: 'y2', pointRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { font: { size: 11 }, usePointStyle: true } } },
      scales: {
        y:  { position: 'left',  ticks: { callback: v => fmtMoney(v), font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y2: { position: 'right', ticks: { font: { size: 11 } }, grid: { display: false } },
        x:  { ticks: { font: { size: 11 } }, grid: { display: false } },
      },
    },
  });

  const stageOrder = ['lead','qualified','proposal','negotiation','won','lost'];
  const sorted = stageOrder.map(s => dealStages.find(d => d.stage===s)).filter(Boolean);
  mkChart('stageChart', {
    type: 'bar',
    data: {
      labels: sorted.map(d => STAGE_LABELS[d.stage]||d.stage),
      datasets: [{ label: 'Deals', data: sorted.map(d => d.count), backgroundColor: sorted.map(d => STAGE_COLORS[d.stage]||'#9ca3af'), borderRadius: 6 }],
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{ticks:{font:{size:11}}},x:{ticks:{font:{size:11}}}} },
  });

  mkChart('actTypeChart', {
    type: 'bar',
    data: {
      labels: activityByType.map(a => a.type),
      datasets: [
        { label: 'Total', data: activityByType.map(a => a.total), backgroundColor: activityByType.map(a => { const m={call:'#3b82f6',visit:'#10b981',email:'#f59e0b',meeting:'#8b5cf6',task:'#ef4444',note:'#6b7280'}; return m[a.type]||'#9ca3af'; }), borderRadius: 6 },
        { label: 'Done',  data: activityByType.map(a => a.done),  backgroundColor: 'rgba(16,185,129,0.3)', borderRadius: 6 },
      ],
    },
    options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top',labels:{font:{size:11},usePointStyle:true}}}, scales:{x:{ticks:{font:{size:11}}},y:{ticks:{font:{size:11}}}} },
  });

  if (leadFunnel.length) mkChart('funnelChart', {
    type: 'doughnut',
    data: { labels: leadFunnel.map(r=>r.lead_status), datasets:[{ data: leadFunnel.map(r=>r.count), backgroundColor: leadFunnel.map((_,i)=>`hsl(${i*36},65%,55%)`), borderWidth:2, borderColor:'transparent' }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ font:{size:11}, padding:8, usePointStyle:true } } } },
  });

  if (winLoss.length) mkChart('winlossChart', {
    type: 'doughnut',
    data: { labels: ['Won','Lost'], datasets:[{ data:[totalWon?.count||0, totalLost?.count||0], backgroundColor:['#10b981','#ef4444'], borderWidth:2, borderColor:'transparent' }] },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ position:'bottom', labels:{ font:{size:12}, usePointStyle:true } },
        tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.raw} (${fmtMoney(ctx.label==='Won'?totalWon?.value||0:totalLost?.value||0)})` } }
      }
    },
  });
}
