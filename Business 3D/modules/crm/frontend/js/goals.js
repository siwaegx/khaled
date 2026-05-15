/**
 * @file goals.js
 * @description Monthly goal setting for managers: form modal, save, and
 * progress bar renderer used on the dashboard.
 */

/* ============================================================
   GOALS & TARGETS
   ============================================================ */

/** Open the goal-setting form for a specific user and month. */
window.openGoalForm = function(userId, userName, month) {
  const mo = month || new Date().toISOString().slice(0,7);
  openModal(`Set Goal — ${esc(userName)}`, `
    <input type="hidden" id="goal_user_id" value="${userId}">
    <div class="form-group">
      <label class="form-label">Month</label>
      <input id="goal_month" class="form-control" type="month" value="${mo}">
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Revenue Target ($)</label>
        <input id="goal_revenue" class="form-control" type="number" min="0" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">Deals Target</label>
        <input id="goal_deals" class="form-control" type="number" min="0" placeholder="0">
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label">Activities Target</label>
        <input id="goal_activities" class="form-control" type="number" min="0" placeholder="0">
      </div>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveGoal()"><i class="fas fa-save"></i> Save Goal</button>
    </div>
  `);
};

/** Save the goal form values and reload the dashboard. */
window.saveGoal = async function() {
  const user_id          = parseInt(document.getElementById('goal_user_id')?.value);
  const month            = document.getElementById('goal_month')?.value;
  const target_revenue   = parseFloat(document.getElementById('goal_revenue')?.value) || 0;
  const target_deals     = parseInt(document.getElementById('goal_deals')?.value) || 0;
  const target_activities = parseInt(document.getElementById('goal_activities')?.value) || 0;
  try {
    await api('/api/goals', { method: 'POST', body: JSON.stringify({ user_id, month, target_revenue, target_deals, target_activities }) });
    showToast('Goal saved');
    closeModal();
    loadDashboard();
  } catch(e) { showToast(e.message, 'error'); }
};

/**
 * Render a compact progress bar (actual vs target).
 * Returns empty string if no target is set.
 */
function goalBar(actual, target, color) {
  if (!target) return '';
  const pct = Math.min(100, Math.round((actual / target) * 100));
  return `<div style="margin-top:4px;">
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:2px;">
      <span>${actual} / ${target}</span><span>${pct}%</span>
    </div>
    <div style="height:5px;border-radius:3px;background:var(--border);overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${pct>=100?'#10b981':color};border-radius:3px;transition:width .4s;"></div>
    </div>
  </div>`;
}
