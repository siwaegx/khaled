/**
 * @file shortcuts.js
 * @description Global keyboard shortcuts: number keys for navigation,
 * 'n' to open a new-record form, '/' to focus search, Escape to close modal.
 */

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */

/** Register document-level key bindings for power-user navigation. */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (document.getElementById('modalBackdrop')?.style.display === 'flex') {
      if (e.key === 'Escape') closeModal();
      return;
    }
    if (!State.currentUser) return;
    switch(e.key) {
      case '/': e.preventDefault(); document.getElementById('globalSearch')?.focus(); break;
      case 'n': case 'N':
        if (State.currentPage === 'contacts')   openContactForm();
        else if (State.currentPage === 'companies') openCompanyForm();
        else if (State.currentPage === 'deals')     openDealForm();
        else if (State.currentPage === 'tasks')     openTaskForm();
        else if (State.currentPage === 'reminders') openReminderForm();
        break;
      case '1': navigateTo('dashboard');  break;
      case '2': navigateTo('contacts');   break;
      case '3': navigateTo('companies');  break;
      case '4': navigateTo('deals');      break;
      case '5': navigateTo('tasks');      break;
      case '6': navigateTo('reminders'); break;
      case '7': navigateTo('reports');   break;
      case '8': navigateTo('calendar');  break;
    }
  });
}
