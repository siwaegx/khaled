/**
 * @file utils.js
 * @description Shared utility functions: HTML escaping, formatting helpers,
 * toast notifications, confirm dialogs, avatar generation, and phone links.
 */

/* ============================================================
   UTILITIES
   ============================================================ */

/** Escape a value for safe insertion into HTML. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Return the value, or an em-dash if null/empty. */
function fmt(val) {
  if (val == null || val === '') return '—';
  return val;
}

/** Format a numeric value with the current currency symbol. */
function fmtMoney(v) {
  const sym = State.settings?.currency_symbol || 'EGP';
  const num = Number(v) || 0;
  return sym + ' ' + num.toLocaleString();
}

/** Format an ISO date string into a locale date, or em-dash if falsy. */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

/** Deterministic avatar background color based on the first character hash. */
function avatarColor(name) {
  const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
  let hash = 0;
  for (const ch of String(name || '?')) hash = ((hash * 31) + ch.charCodeAt(0)) & 0xFFFFFF;
  return colors[hash % colors.length];
}

/** Extract up to 2 uppercase initials from a full name string. */
function initials(name) {
  return String(name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Render a full-page empty state with an icon, message, and optional sub-text. */
function emptyState(icon, msg, sub) {
  return `<div class="table-wrapper"><div class="empty-state">
    <i class="fas ${icon}"></i>
    <p>${esc(msg)}</p>
    ${sub ? `<span>${esc(sub)}</span>` : ''}
  </div></div>`;
}

/** Show a brief auto-dismissing toast notification. */
function showToast(msg, type = 'success') {
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${icons[type] || icons.success}"></i><span>${esc(msg)}</span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => {
    t.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

/** Stored callback for the confirm dialog. */
let _confirmCallback = null;

/** Open a confirm-delete modal; calls onConfirm if the user clicks Delete. */
function confirmDialog(msg, sub, onConfirm) {
  _confirmCallback = onConfirm;
  openModal('Confirm Delete', `
    <div class="confirm-body">
      <i class="fas fa-exclamation-triangle"></i>
      <p>${esc(msg)}</p>
      ${sub ? `<span>${esc(sub)}</span>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="_doConfirm()">Delete</button>
    </div>`);
}
window._doConfirm = function () { closeModal(); if (_confirmCallback) _confirmCallback(); };

/** Return a debounced version of fn that fires ms milliseconds after the last call. */
function debounce(fn, ms) {
  let t;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

/**
 * Render a "Back" button visible only on mobile (< 768 px).
 * Closes the given detail panel when clicked.
 */
function mobileBackBtn(panelId) {
  if (window.innerWidth > 768) return '';
  return `<button class="mobile-back-btn" onclick="closeMobilePanel('${panelId}')"><i class="fas fa-arrow-left"></i> Back</button>`;
}
window.closeMobilePanel = function (panelId) {
  const dp = document.getElementById(panelId);
  if (dp) { dp.classList.remove('open'); dp.innerHTML = ''; }
};

/** Render a phone number as a tel: link with a WhatsApp icon shortcut. */
function phoneLink(phone) {
  if (!phone) return '—';
  const clean = String(phone).replace(/\s/g, '');
  const wa = clean.replace(/[^0-9+]/g, '');
  return `<a href="tel:${esc(clean)}" style="color:var(--primary);text-decoration:none;font-weight:500;" title="Call">${esc(phone)}</a>
    <a href="https://wa.me/${wa}" target="_blank" rel="noopener" style="color:#25d366;margin-left:8px;font-size:15px;" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>`;
}

/**
 * Normalise a phone number to the international format expected by WhatsApp.
 * Egyptian numbers starting with 0 are prefixed with country code 20.
 */
function normalizeWaPhone(phone) {
  const clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('00')) return clean.slice(2);
  if (clean.startsWith('0')) return '20' + clean.slice(1);
  return clean;
}

/** Open a WhatsApp chat for the given phone number in a new tab. */
window.openWhatsApp = function (phone) {
  const wa = String(phone || '').replace(/[^0-9+]/g, '');
  if (wa) window.open(`https://wa.me/${wa}`, '_blank');
};
