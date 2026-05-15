/**
 * @file dup-check.js
 * @description Duplicate detection for contact/company forms and the merge-duplicates workflow.
 */

/* ============================================================
   DUPLICATE DETECTION
   ============================================================ */
let _dupCheckTimer = null;

/**
 * Debounce a duplicate-check API call; renders a warning banner in containerId
 * if a similar record is found.
 */
function scheduleDupCheck(type, params, containerId) {
  clearTimeout(_dupCheckTimer);
  _dupCheckTimer = setTimeout(async () => {
    try {
      const qs = Object.entries(params).filter(([,v])=>v).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&');
      if (!qs) return;
      const res = await api(`/api/${type}/check-dup?${qs}`, {_silent:true});
      const el = document.getElementById(containerId);
      if (!el) return;
      if (res.duplicate) {
        el.innerHTML = `<div class="dup-warning"><i class="fas fa-exclamation-triangle"></i> Similar ${type === 'contacts' ? 'contact' : 'company'} found: <strong>${esc(res.duplicate.name)}</strong>${res.duplicate.company_name ? ` at ${esc(res.duplicate.company_name)}` : res.duplicate.city ? ` (${esc(res.duplicate.city)})` : ''}. <a href="#" onclick="event.preventDefault();selectDuplicate('${type}',${res.duplicate.id})">View it</a></div>`;
      } else { el.innerHTML = ''; }
    } catch(_) {}
  }, 600);
}

/** Close the open modal and navigate directly to the duplicate record. */
window.selectDuplicate = function(type, id) {
  closeModal();
  if (type === 'contacts') { navigateTo('contacts'); setTimeout(() => selectContact(id), 300); }
  else { navigateTo('companies'); setTimeout(() => selectCompany(id), 300); }
};

/* ============================================================
   MERGE DUPLICATES
   ============================================================ */

/** Open the merge modal for a given record, pre-filled with the "keep" name. */
window.openMergeModal = function(type, keepId, keepName) {
  openModal(`Merge ${type === 'contacts' ? 'Contact' : 'Company'}`, `
    <div style="margin-bottom:12px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px;">
      <strong>Keeping:</strong> ${esc(keepName)}
    </div>
    <div class="form-group">
      <label class="form-label">Search for duplicate to merge into this one</label>
      <input id="merge-search" class="form-control" placeholder="Type name to search..." oninput="searchMergeTarget('${type}',${keepId},this.value)">
    </div>
    <div id="merge-results" style="margin-top:8px;"></div>
    <p style="font-size:12px;color:var(--text-muted);margin-top:12px;"><i class="fas fa-info-circle"></i> All deals, activities and contacts will be moved to the kept record, then the duplicate will be deleted. This cannot be undone.</p>
  `);
};

/** Filter the local cache to find matching records to merge, excluding the kept record. */
window.searchMergeTarget = async function(type, keepId, query) {
  if (!query || query.length < 2) { document.getElementById('merge-results').innerHTML = ''; return; }
  try {
    const list = type === 'contacts' ? State.contacts : State.companies;
    const results = list.filter(x => {
      const name = type === 'contacts' ? `${x.first_name} ${x.last_name}` : x.name;
      return name.toLowerCase().includes(query.toLowerCase()) && x.id !== keepId;
    }).slice(0, 8);
    document.getElementById('merge-results').innerHTML = results.length
      ? results.map(x => {
          const name = type === 'contacts' ? `${x.first_name} ${x.last_name}` : x.name;
          return `<div class="merge-result-row" onclick="confirmMerge('${type}',${keepId},${x.id},'${esc(name)}')">
            <div class="merge-result-av" style="background:${avatarColor(name)}">${initials(name)}</div>
            <div style="flex:1;">${esc(name)}${x.company_name ? `<div style="font-size:11px;color:var(--text-muted);">${esc(x.company_name)}</div>` : ''}</div>
            <button class="btn btn-sm" style="background:#fee2e2;color:#b91c1c;border:none;">Merge</button>
          </div>`;
        }).join('')
      : '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No matches found</div>';
  } catch(_) {}
};

/** Confirm and execute the merge; invalidates caches and reloads the list. */
window.confirmMerge = async function(type, keepId, mergeId, mergeName) {
  if (!confirm(`Merge "${mergeName}" into the kept record? This cannot be undone.`)) return;
  try {
    await api(`/api/merge/${type}`, { method: 'POST', body: JSON.stringify({ keep_id: keepId, merge_id: mergeId }) });
    showToast('Merged successfully');
    closeModal();
    delete State.companyCache[mergeId]; delete State.companyCache[keepId];
    delete State.contactCache[mergeId]; delete State.contactCache[keepId];
    if (type === 'contacts') loadContacts();
    else loadCompanies();
  } catch(e) { showToast(e.message, 'error'); }
};
