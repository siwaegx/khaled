/**
 * @file notifications.js
 * @description In-app notification bell: poll for unread count, show dropdown,
 * fire browser notifications when new items arrive.
 */

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
let _notifPollTimer = null;
let _lastUnreadCount = -1;
let _browserNotifGranted = false;

/** Poll the API and update the bell badge with the current unread count. */
async function loadNotifications() {
  try {
    const data = await api('/api/notifications', { _silent: true });
    const unread = data.unread || 0;
    const dot = document.getElementById('notifDot');
    const bell = document.querySelector('.notification-bell');
    if (dot) dot.style.display = unread > 0 ? '' : 'none';
    if (dot) dot.textContent = unread > 0 ? (unread > 9 ? '9+' : unread) : '';
    if (bell) bell._notifData = data.notifications || [];
    if (_lastUnreadCount >= 0 && unread > _lastUnreadCount) {
      const newest = (data.notifications || []).find(n => !n.read);
      if (newest) fireBrowserNotif(newest.title, newest.body || '');
    }
    _lastUnreadCount = unread;
  } catch(_) {}
}

/** Ask the browser for notification permission. */
function requestBrowserNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { _browserNotifGranted = true; return; }
  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => { _browserNotifGranted = p === 'granted'; });
  }
}

/** Fire a native browser notification if permission has been granted. */
function fireBrowserNotif(title, body) {
  if (!_browserNotifGranted || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/favicon.ico', tag: 'crm-notif' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch(_) {}
}

/** Start polling and wire up the bell click to show the notification dropdown. */
function initNotifications() {
  try { requestBrowserNotifPermission(); } catch(_) {}
  if (_notifPollTimer) { clearInterval(_notifPollTimer); _notifPollTimer = null; }
  _lastUnreadCount = -1;
  loadNotifications();
  _notifPollTimer = setInterval(loadNotifications, 30000);

  const bell = document.querySelector('.notification-bell');
  if (!bell) return;
  if (bell._notifBound) return;
  bell._notifBound = true;
  bell.style.cursor = 'pointer';
  bell.addEventListener('click', () => {
    const existing = document.getElementById('notif-dropdown');
    if (existing) { existing.remove(); return; }
    const notifs = bell._notifData || [];
    api('/api/notifications/read', { method: 'PUT' }).then(() => {
      loadNotifications();
    });
    const drop = document.createElement('div');
    drop.id = 'notif-dropdown';
    drop.className = 'notif-dropdown';
    drop.innerHTML = `
      <div class="notif-header"><i class="fas fa-bell"></i> Notifications</div>
      ${notifs.length ? notifs.map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotifClick(${n.link_id},'${n.link_type}')">
          <div class="notif-icon ${n.type === 'company_assigned' ? 'company' : 'task'}">
            <i class="fas ${n.type === 'company_assigned' ? 'fa-building' : 'fa-check-square'}"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div class="notif-title">${esc(n.title)}</div>
            <div class="notif-body">${esc(n.body || '')}</div>
            <div class="notif-time">${fmtDate(n.created_at)}</div>
          </div>
        </div>`).join('') : '<div class="notif-empty">No notifications</div>'}`;
    bell.appendChild(drop);
    setTimeout(() => document.addEventListener('click', function close(e) {
      if (!drop.contains(e.target) && !bell.contains(e.target)) { drop.remove(); document.removeEventListener('click', close); }
    }), 0);
  });
}

/** Navigate to the relevant page when a notification is clicked. */
window.handleNotifClick = function(linkId, linkType) {
  document.getElementById('notif-dropdown')?.remove();
  if (linkType === 'company' && linkId) {
    navigateTo('companies');
    setTimeout(() => openCompanyDetail(linkId), 300);
  } else if (linkType === 'task') {
    navigateTo('tasks');
  }
};
