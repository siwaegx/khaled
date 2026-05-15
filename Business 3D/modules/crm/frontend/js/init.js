/**
 * @file init.js
 * @description Application entry point: preloads shared lookup data,
 * exposes globals needed by inline HTML onclick handlers, and boots
 * the app on DOMContentLoaded.
 */

/* ============================================================
   PRELOAD shared data before opening forms
   ============================================================ */

/** Fetch companies, contacts, lists, settings, and (for manager) users into State. */
async function preloadSharedData() {
  try {
    const fetches = [api('/api/companies'), api('/api/contacts'), api('/api/lists'), api('/api/settings')];
    if (State.currentUser?.role === 'manager') fetches.push(api('/api/users'));
    const [cos, cons, lists, settings, users] = await Promise.all(fetches);
    State.companies = cos   || [];
    State.contacts  = cons  || [];
    State.lists     = lists || {};
    if (settings) State.settings = settings;
    if (users)    State.users    = users;
    await loadCustomFields();
  } catch (_) {}
}

/** Build <option> HTML for a dynamic list type, pre-selecting a value. */
function listOptions(type, selectedValue = '') {
  const items = State.lists[type] || [];
  return items.map(item =>
    `<option value="${esc(item.value)}" ${selectedValue === item.value ? 'selected' : ''}>${esc(item.value)}</option>`
  ).join('');
}

/* ============================================================
   EXPOSE globals needed by inline onclick handlers in HTML
   ============================================================ */
window.openContactForm      = openContactForm;
window.openCompanyForm      = openCompanyForm;
window.openDealForm         = openDealForm;
window.openActivityForm     = openActivityForm;
window.openUserForm         = openUserForm;
window.openCompanyDetail    = openCompanyDetail;
window.openContactDetail    = openContactDetail;
window.closeModal           = closeModal;
window.searchContacts       = searchContacts;
window.filterContacts       = filterContacts;
window.searchCompanies      = searchCompanies;
window.searchDeals          = searchDeals;
window.openImportModal      = openImportModal;
window.exportData           = exportData;
window.switchImportTab      = switchImportTab;
window.previewImport        = previewImport;
window.runImport            = runImport;
window.backupCompanies      = backupCompanies;
window.openRestoreModal     = openRestoreModal;
window.runRestore           = runRestore;
window.dragDeal             = dragDeal;
window.dropDeal             = dropDeal;
window.toggleBulk           = toggleBulk;
window.selectAllBulk        = selectAllBulk;
window.clearBulk            = clearBulk;
window.applyBulkStatus      = applyBulkStatus;
window.applyBulkAssign      = applyBulkAssign;
window.applyBulkDelete      = applyBulkDelete;
window.setViewAs            = setViewAs;
window.openGeneralTaskForm  = openGeneralTaskForm;
window.saveGeneralTask      = saveGeneralTask;
window.toggleTLField        = toggleTLField;
window.assignCompanyOwner   = assignCompanyOwner;
window.openAssignTaskForm   = openAssignTaskForm;
window.saveAssignedTask     = saveAssignedTask;
window.completeTeamTask     = completeTeamTask;
window.deleteTeamTask       = deleteTeamTask;

/* ============================================================
   PDF PRINT
   ============================================================ */
window.printDetail = function() {
  window.print();
};

/* ============================================================
   ENTRY POINT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllPages();
  initNav();
  initGlobalSearch();
  initKeyboardShortcuts();
  await init();

  if (State.currentUser) {
    await preloadSharedData();
    await initTLMemberBar();
    initNotifications();
  }
});
