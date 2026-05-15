/**
 * @file import-export.js
 * @description CSV export, CSV import (companies & contacts), JSON backup,
 * and JSON restore for the manager.
 */

/* ============================================================
   EXPORT
   ============================================================ */

/** Download the full companies list as a CSV file. */
window.exportData = async function() {
  try {
    showToast('Preparing export…', 'info');
    const res = await fetch('/api/export/companies', {
      headers: { 'Authorization': `Bearer ${State.token}` }
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `companies-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported successfully', 'success');
  } catch(e) { showToast('Export failed: ' + e.message, 'error'); }
};

/* ============================================================
   CSV PARSER
   ============================================================ */

/** Parse a raw CSV string into an array of header-keyed objects. */
function parseCSV(text) {
  const lines = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];
  const parseRow = line => {
    const cols = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur=''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };
  const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseRow(line);
    const obj = {};
    headers.forEach((h,i) => { obj[h] = vals[i] !== undefined ? vals[i] : ''; });
    return obj;
  });
}

/* ============================================================
   IMPORT
   ============================================================ */
let _importTab = 'companies';

/** Open the CSV import modal with a tab switcher for companies vs contacts. */
window.openImportModal = function(defaultTab) {
  _importTab = defaultTab || 'companies';
  openModal('Import Data', `
    <div>
      <div style="display:flex;gap:6px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:12px;">
        <button id="imp-tab-companies" onclick="switchImportTab('companies')"
          style="padding:6px 14px;border-radius:6px;border:1px solid var(--border);cursor:pointer;font-size:13px;background:${_importTab==='companies'?'var(--primary)':'#f8fafc'};color:${_importTab==='companies'?'white':'var(--text)'};">
          <i class="fas fa-building"></i> Companies
        </button>
        <button id="imp-tab-contacts" onclick="switchImportTab('contacts')"
          style="padding:6px 14px;border-radius:6px;border:1px solid var(--border);cursor:pointer;font-size:13px;background:${_importTab==='contacts'?'var(--primary)':'#f8fafc'};color:${_importTab==='contacts'?'white':'var(--text)'};">
          <i class="fas fa-users"></i> Contacts
        </button>
      </div>
      <div id="imp-help-companies" style="display:${_importTab==='companies'?'':'none'};background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:var(--text-muted);">
        <strong>Companies CSV columns:</strong> <code>name</code>, industry, city, country, phone, email, website, status, category, folder, notes, custom_id<br>
        Only <strong>name</strong> is required. Contacts can be imported separately.
      </div>
      <div id="imp-help-contacts" style="display:${_importTab==='contacts'?'':'none'};background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:var(--text-muted);">
        <strong>Contacts CSV columns:</strong> <code>first_name</code>, <code>last_name</code>, phone, email, title, company_name, lead_status, source, notes<br>
        <strong>first_name</strong> and <strong>last_name</strong> are required. company_name will match existing companies.
      </div>
      <div class="form-group">
        <label class="form-label">Upload CSV file</label>
        <input type="file" id="imp-file" accept=".csv,.txt" style="display:block;width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
      </div>
      <div style="text-align:center;color:var(--text-muted);font-size:12px;margin:6px 0;">— or paste CSV text —</div>
      <div class="form-group">
        <textarea id="imp-text" class="form-control" rows="5" placeholder="Paste CSV content here…" style="font-family:monospace;font-size:12px;"></textarea>
      </div>
      <div id="imp-preview" style="display:none;margin-top:10px;">
        <div id="imp-preview-label" style="font-size:12px;font-weight:600;margin-bottom:6px;"></div>
        <div id="imp-preview-table" style="overflow-x:auto;max-height:200px;overflow-y:auto;"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-secondary" onclick="previewImport()"><i class="fas fa-eye"></i> Preview</button>
      <button class="btn btn-primary" onclick="runImport()"><i class="fas fa-file-import"></i> Import</button>
    </div>`, 'modal-lg');
  document.getElementById('imp-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { document.getElementById('imp-text').value = ev.target.result; };
    reader.readAsText(file, 'UTF-8');
  });
};

/** Switch the import tab between companies and contacts, resetting the preview. */
window.switchImportTab = function(tab) {
  _importTab = tab;
  const active = 'var(--primary)', inact = '#f8fafc';
  const tabCo = document.getElementById('imp-tab-companies');
  const tabCt = document.getElementById('imp-tab-contacts');
  if (tabCo) { tabCo.style.background = tab==='companies'?active:inact; tabCo.style.color = tab==='companies'?'white':'var(--text)'; }
  if (tabCt) { tabCt.style.background = tab==='contacts'?active:inact; tabCt.style.color = tab==='contacts'?'white':'var(--text)'; }
  const hCo = document.getElementById('imp-help-companies');
  const hCt = document.getElementById('imp-help-contacts');
  if (hCo) hCo.style.display = tab==='companies' ? '' : 'none';
  if (hCt) hCt.style.display = tab==='contacts' ? '' : 'none';
  const prev = document.getElementById('imp-preview');
  if (prev) prev.style.display = 'none';
};

/** Parse and display the first 5 rows of the CSV as a preview table. */
window.previewImport = function() {
  const text = document.getElementById('imp-text').value.trim();
  if (!text) { showToast('Please upload or paste CSV content first', 'warning'); return; }
  const rows = parseCSV(text);
  if (!rows.length) { showToast('No data rows found in CSV', 'warning'); return; }
  const preview = rows.slice(0, 5);
  const headers = Object.keys(preview[0]);
  const tableHtml = `<table style="width:100%;font-size:11px;border-collapse:collapse;white-space:nowrap;">
    <thead><tr>${headers.map(h=>`<th style="padding:4px 8px;background:#f1f5f9;border:1px solid var(--border);text-align:left;">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${preview.map(row=>`<tr>${headers.map(h=>`<td style="padding:4px 8px;border:1px solid var(--border);max-width:160px;overflow:hidden;text-overflow:ellipsis;">${esc(row[h]||'')}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
  document.getElementById('imp-preview-label').textContent = `Preview — ${rows.length} row${rows.length!==1?'s':''} found:`;
  document.getElementById('imp-preview-table').innerHTML = tableHtml;
  document.getElementById('imp-preview').style.display = '';
};

/** Submit the parsed CSV rows to the server and reload the affected page. */
window.runImport = async function() {
  const text = document.getElementById('imp-text').value.trim();
  if (!text) { showToast('Please upload or paste CSV content first', 'warning'); return; }
  const rows = parseCSV(text);
  if (!rows.length) { showToast('No data rows found in CSV', 'warning'); return; }
  const endpoint = _importTab === 'contacts' ? '/api/import/contacts' : '/api/import';
  try {
    const result = await api(endpoint, { method: 'POST', body: JSON.stringify(rows) });
    if (!result) return;
    closeModal();
    const msg = `Imported ${result.created} record${result.created!==1?'s':''}${result.skipped?`, skipped ${result.skipped}`:''}`;
    showToast(msg, result.errors?.length ? 'warning' : 'success');
    if (_importTab === 'contacts') { State.contactCache = {}; loadContacts(); }
    else { State.companyCache = {}; loadCompanies(); }
  } catch(e) { showToast('Import failed: ' + e.message, 'error'); }
};

/* ============================================================
   BACKUP & RESTORE
   ============================================================ */

/** Download a full JSON backup of all companies and related data. */
window.backupCompanies = async function() {
  try {
    showToast('Preparing backup…', 'info');
    const res = await fetch('/api/backup/companies', {
      headers: { 'Authorization': `Bearer ${State.token}` }
    });
    if (!res.ok) throw new Error('Backup failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `companies-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup downloaded', 'success');
  } catch(e) { showToast('Backup failed: ' + e.message, 'error'); }
};

/** Open the restore modal with a file picker and a preview of backup contents. */
window.openRestoreModal = function() {
  openModal('Restore from Backup', `
    <div>
      <div style="background:#fff8e1;border:1px solid #ffc107;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;">
        <i class="fas fa-exclamation-triangle" style="color:#f59e0b;margin-right:6px;"></i>
        <strong>Restore appends data</strong> — existing records are kept. All restored records are assigned to you. Relationships (contacts ↔ companies, deals, activities) are fully re-linked.
      </div>
      <div class="form-group">
        <label class="form-label">Select backup file (.json)</label>
        <input type="file" id="restore-file" accept=".json" style="display:block;width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
      </div>
      <div id="restore-preview" style="display:none;margin-top:12px;font-size:13px;"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="runRestore()"><i class="fas fa-upload"></i> Restore</button>
    </div>`, 'modal-lg');

  document.getElementById('restore-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.companies)) throw new Error('Missing companies array');
        document.getElementById('restore-preview').innerHTML = `
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;">
            <div style="font-weight:600;margin-bottom:8px;">Backup ready to restore:</div>
            <div style="display:flex;gap:18px;flex-wrap:wrap;">
              <span><i class="fas fa-building" style="color:var(--primary);margin-right:4px;"></i><strong>${(data.companies||[]).length}</strong> companies</span>
              <span><i class="fas fa-users" style="color:var(--primary);margin-right:4px;"></i><strong>${(data.contacts||[]).length}</strong> contacts</span>
              <span><i class="fas fa-handshake" style="color:var(--primary);margin-right:4px;"></i><strong>${(data.deals||[]).length}</strong> deals</span>
              <span><i class="fas fa-tasks" style="color:var(--primary);margin-right:4px;"></i><strong>${(data.activities||[]).length}</strong> activities</span>
            </div>
            ${data.exported_at ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted);">Exported: ${new Date(data.exported_at).toLocaleString()}</div>` : ''}
          </div>`;
        document.getElementById('restore-preview').style.display = '';
        document.getElementById('restore-file')._backupData = data;
      } catch(err) {
        showToast('Invalid backup file: ' + err.message, 'error');
        document.getElementById('restore-preview').style.display = 'none';
      }
    };
    reader.readAsText(file, 'UTF-8');
  });
};

/** Post the parsed backup JSON to the server and reload companies on success. */
window.runRestore = async function() {
  const input = document.getElementById('restore-file');
  const data = input?._backupData;
  if (!data || !Array.isArray(data.companies)) return showToast('Please select a valid backup file first', 'warning');
  try {
    const result = await api('/api/restore/companies', { method: 'POST', body: JSON.stringify(data) });
    if (!result) return;
    closeModal();
    showToast(
      `Restored: ${result.companies} companies, ${result.contacts} contacts, ${result.deals} deals, ${result.activities} activities`,
      'success'
    );
    State.companyCache = {};
    State.contactCache = {};
    loadCompanies();
  } catch(e) { showToast('Restore failed: ' + e.message, 'error'); }
};
