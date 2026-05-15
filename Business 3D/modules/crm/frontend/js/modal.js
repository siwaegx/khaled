/**
 * @file modal.js
 * @description Single shared modal dialog: open with title + HTML body, close with animation.
 */

/* ============================================================
   MODAL
   ============================================================ */

/**
 * Open the shared modal dialog.
 * @param {string} title - Modal header text
 * @param {string} bodyHtml - Inner HTML for the modal body
 * @param {string} [size=''] - Optional extra CSS class (e.g. 'modal-lg', 'modal-xl')
 */
function openModal(title, bodyHtml, size = '') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalDialog').className = 'modal-dialog' + (size ? ' ' + size : '');
  document.getElementById('modalBackdrop').classList.add('open');
}

/** Close the modal and clear its contents after the CSS transition finishes. */
function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  // Clear after transition so stale form data is not visible if the modal re-opens quickly
  setTimeout(() => {
    document.getElementById('modalTitle').textContent = '';
    document.getElementById('modalBody').innerHTML = '';
  }, 300);
}
