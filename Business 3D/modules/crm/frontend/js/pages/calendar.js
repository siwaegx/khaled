/**
 * @file pages/calendar.js
 * @description Calendar page: monthly grid view with event dots, navigation,
 * and click-through to the activities page.
 */

/* ============================================================
   CALENDAR PAGE
   ============================================================ */

/** Mutable state for the currently displayed year and month. */
let _calState = { year: new Date().getFullYear(), month: new Date().getMonth() };

/** Fetch activities for the current month and render the calendar grid. */
async function loadCalendar() {
  const container = document.getElementById('calendar-content');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const { year, month } = _calState;
    const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
    const data = await api(`/api/calendar?month=${monthStr}`);
    renderCalendar(data.events || []);
  } catch(e) {
    document.getElementById('calendar-content').innerHTML =
      emptyState('fa-exclamation-circle', 'Failed to load calendar', e.message);
  }
}

/** Render the full monthly calendar grid with event dots per day. */
function renderCalendar(events) {
  const container = document.getElementById('calendar-content');
  if (!container) return;
  const { year, month } = _calState;
  const today = new Date();
  const isToday = (d) => d.getFullYear()===today.getFullYear() && d.getMonth()===today.getMonth() && d.getDate()===today.getDate();

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const evMap = {};
  for (const ev of events) {
    const key = (ev.due_date || '').slice(0,10);
    if (!evMap[key]) evMap[key] = [];
    evMap[key].push(ev);
  }

  const firstDay   = new Date(year, month, 1);
  const lastDay    = new Date(year, month+1, 0);
  const startDow   = firstDay.getDay();
  const totalCells = Math.ceil((startDow + lastDay.getDate()) / 7) * 7;

  const dayOfWeeks = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let cells = '';
  for (let i = 0; i < totalCells; i++) {
    const date    = new Date(year, month, i - startDow + 1);
    const isOther = date.getMonth() !== month;
    const key     = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const dayEvs  = evMap[key] || [];
    const showMax = 3;
    const more    = dayEvs.length - showMax;
    const todayCls = isToday(date) ? ' today' : '';
    const otherCls = isOther ? ' other-month' : '';
    const evHTML = dayEvs.slice(0, showMax).map(ev => {
      const evDate  = new Date(ev.due_date);
      const isOverdue = !ev.completed && evDate < today && !isToday(evDate);
      const cls = isOverdue ? 'overdue' : (ev.type||'task');
      return `<div class="cal-event ${cls}" title="${esc(ev.title)}" onclick="calEventClick(${ev.id},event)">${esc(ev.title)}</div>`;
    }).join('');
    cells += `
      <div class="cal-cell${todayCls}${otherCls}" data-date="${key}">
        <div class="cal-day-num">${date.getDate()}</div>
        <div class="cal-events" data-count="${dayEvs.length}">${evHTML}${more > 0 ? `<div class="cal-more">+${more} more</div>` : ''}</div>
      </div>`;
  }

  container.innerHTML = `
    <div class="cal-header">
      <div class="cal-nav">
        <button class="cal-nav-btn" onclick="calNav(-1)"><i class="fas fa-chevron-left"></i></button>
        <div class="cal-title">${monthNames[month]} ${year}</div>
        <button class="cal-nav-btn" onclick="calNav(1)"><i class="fas fa-chevron-right"></i></button>
        <button class="cal-today-btn" onclick="calGoToday()">Today</button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);">${events.length} event${events.length!==1?'s':''} this month</div>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="cal-grid">
        ${dayOfWeeks.map(d => `<div class="cal-dow">${d}</div>`).join('')}
        ${cells}
      </div>
    </div>
    <div class="cal-legend">
      ${[['call','#dbeafe','#1d4ed8'],['email','#fef3c7','#b45309'],['meeting','#ede9fe','#6d28d9'],['task','#d1fae5','#065f46'],['visit','#fce7f3','#be185d'],['overdue','#fee2e2','#b91c1c']]
        .map(([t,bg,c]) => `<div class="cal-legend-item"><div class="cal-legend-dot" style="background:${bg};border:1px solid ${c};"></div><span>${t.charAt(0).toUpperCase()+t.slice(1)}</span></div>`).join('')}
    </div>`;
}

/** Navigate to the previous or next month and reload. */
window.calNav = function(dir) {
  _calState.month += dir;
  if (_calState.month > 11) { _calState.month = 0; _calState.year++; }
  if (_calState.month < 0)  { _calState.month = 11; _calState.year--; }
  loadCalendar();
};

/** Reset calendar to the current month and reload. */
window.calGoToday = function() {
  const t = new Date();
  _calState.year  = t.getFullYear();
  _calState.month = t.getMonth();
  loadCalendar();
};

/** Navigate to the activities page when a calendar event is clicked. */
window.calEventClick = function(id, e) {
  e.stopPropagation();
  navigateTo('activities');
};
