/**
 * @file pages/deals.js
 * @description Deals page: kanban board and list view, drag-drop stage updates,
 * deal form (add/edit/delete).
 */

/* ============================================================
   DEALS
   ============================================================ */

/** Fetch deals from the API and render the current view (kanban or list). */
async function loadDeals() {
  document.getElementById('deals-content').innerHTML = '<div class="spinner"></div>';
  try {
    const search = document.getElementById('dealSearch').value;
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    State.deals = await api('/api/deals' + params) || [];
    document.getElementById('deals-count').textContent = `${State.deals.length} deal${State.deals.length !== 1 ? 's' : ''}`;
    renderDealsContent();
  } catch (e) {
    document.getElementById('deals-content').innerHTML = emptyState('fa-exclamation-circle', 'Failed to load deals');
  }
}

/** Debounced version of loadDeals for the search input. */
const searchDeals = debounce(loadDeals, 350);

/** Switch between 'kanban' and 'list' view modes. */
window.setDealsView = function (view) {
  State.dealsView = view;
  document.getElementById('kanbanViewBtn').classList.toggle('active', view === 'kanban');
  document.getElementById('listViewBtn').classList.toggle('active', view === 'list');
  renderDealsContent();
};

/** Route to the correct renderer based on State.dealsView. */
function renderDealsContent() {
  if (State.dealsView === 'kanban') renderKanban(State.deals);
  else renderDealsList(State.deals);
}

/** ID of the deal currently being dragged (null when not dragging). */
let _dragDealId = null;

/** Store the dragged deal ID and mark the card as dragging. */
window.dragDeal = function(event, id) {
  _dragDealId = id;
  event.currentTarget.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
};

/** Drop a deal card onto a new stage column and persist the change. */
window.dropDeal = async function(event, stage) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  if (!_dragDealId) return;
  const deal = State.deals.find(d => d.id === _dragDealId);
  _dragDealId = null;
  if (!deal || deal.stage === stage) return;
  try {
    await api(`/api/deals/${deal.id}`, { method: 'PUT', body: JSON.stringify({ ...deal, stage }) });
    loadDeals();
  } catch(e) { showToast(e.message, 'error'); }
};

/** Render the kanban board grouped by pipeline stage. */
function renderKanban(deals) {
  const container = document.getElementById('deals-content');
  container.innerHTML = `<div class="kanban-board">
    ${STAGES.map(stage => {
      const stageDeals = deals.filter(d => d.stage === stage);
      const total = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
      return `<div class="kanban-col">
        <div class="kanban-col-header">
          <div class="kanban-col-title">
            <span class="stage-dot dot-${stage}"></span>${STAGE_LABELS[stage]}
            <span class="kanban-col-count">${stageDeals.length}</span>
          </div>
        </div>
        <div class="kanban-cards" data-stage="${stage}"
          ondragover="event.preventDefault();this.classList.add('drag-over')"
          ondragleave="this.classList.remove('drag-over')"
          ondrop="dropDeal(event,'${stage}')">
          ${stageDeals.map(d => `
            <div class="kanban-card" draggable="true"
              ondragstart="dragDeal(event,${d.id})"
              ondragend="document.querySelectorAll('.kanban-card').forEach(c=>c.classList.remove('dragging'));document.querySelectorAll('.kanban-cards').forEach(c=>c.classList.remove('drag-over'))"
              onclick="openDealForm(${d.id})">
              <div class="kanban-card-title">${esc(d.title)}</div>
              ${d.company_name ? `<div class="kanban-card-company"><i class="fas fa-building" style="font-size:10px;margin-right:3px;opacity:.5;"></i>${esc(d.company_name)}</div>` : ''}
              ${d.contact_name ? `<div class="kanban-card-company" style="margin-top:2px;"><i class="fas fa-user" style="font-size:10px;margin-right:3px;opacity:.5;"></i>${esc(d.contact_name)}</div>` : ''}
              <div class="kanban-card-footer">
                <span class="kanban-card-value">${fmtMoney(d.value)}</span>
                <span class="kanban-card-date">${fmtDate(d.close_date)}</span>
              </div>
              <button class="kanban-card-files-btn" title="Files"
                onclick="event.stopPropagation();openDealFiles(${d.id})">
                <i class="fas fa-paperclip"></i> Files
              </button>
            </div>`).join('')}
        </div>
        <div class="kanban-total">${fmtMoney(total)}</div>
      </div>`;
    }).join('')}
  </div>`;
}

/** Render deals as a sortable table. */
function renderDealsList(deals) {
  const container = document.getElementById('deals-content');
  if (!deals.length) {
    container.innerHTML = emptyState('fa-handshake', 'No deals found', 'Add your first deal to get started');
    return;
  }
  container.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr>
      <th>Title</th><th>Company</th><th>Contact</th><th>Stage</th><th>Value</th><th>Close Date</th><th></th>
    </tr></thead>
    <tbody>${deals.map(dealRow).join('')}</tbody>
  </table></div>`;
}

/** Render a single deal as a table row. */
function dealRow(d) {
  return `<tr>
    <td><div class="name-cell">${esc(d.title)}</div></td>
    <td>${esc(fmt(d.company_name))}</td>
    <td>${esc(fmt(d.contact_name))}</td>
    <td><span class="badge badge-${d.stage}">${esc(STAGE_LABELS[d.stage] || d.stage)}</span></td>
    <td style="font-weight:600;color:var(--primary);">${fmtMoney(d.value)}</td>
    <td>${fmtDate(d.close_date)}</td>
    <td><div class="td-actions">
      <button class="btn-icon" onclick="openDealForm(${d.id})" title="Edit"><i class="fas fa-pen"></i></button>
      <button class="btn-icon" onclick="openDealFiles(${d.id})" title="Files"><i class="fas fa-paperclip"></i></button>
      <button class="btn-icon danger" onclick="deleteDeal(${d.id})" title="Delete"><i class="fas fa-trash"></i></button>
    </div></td>
  </tr>`;
}

/** Open the deal add/edit modal, pre-filled with existing data when editing. */
function openDealForm(id) {
  const deal = id ? State.deals.find(d => d.id === id) : null;
  const companyOptions = State.companies.map(co =>
    `<option value="${co.id}" ${deal?.company_id === co.id ? 'selected' : ''}>${esc(co.name)}</option>`
  ).join('');
  const contactOptions = State.contacts.map(c =>
    `<option value="${c.id}" ${deal?.contact_id === c.id ? 'selected' : ''}>${esc(c.first_name)} ${esc(c.last_name)}</option>`
  ).join('');

  openModal(deal ? 'Edit Deal' : 'Add Deal', `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Title *</label>
        <input id="df_title" class="form-control" value="${esc(deal?.title || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <select id="df_company" class="form-control">
          <option value="">— None —</option>${companyOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Contact</label>
        <select id="df_contact" class="form-control">
          <option value="">— None —</option>${contactOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Value ($)</label>
        <input id="df_value" class="form-control" type="number" min="0" value="${deal?.value || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Stage</label>
        <select id="df_stage" class="form-control">
          ${STAGES.map(s => `<option value="${s}" ${(deal?.stage || 'lead') === s ? 'selected' : ''}>${STAGE_LABELS[s]}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Probability (%)</label>
        <input id="df_prob" class="form-control" type="number" min="0" max="100" value="${deal?.probability || 0}">
      </div>
      <div class="form-group">
        <label class="form-label">Close Date</label>
        <input id="df_date" class="form-control" type="date" value="${deal?.close_date ? deal.close_date.slice(0, 10) : ''}">
      </div>
      <div class="form-group full">
        <label class="form-label">Notes</label>
        <textarea id="df_notes" class="form-control">${esc(deal?.notes || '')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveDeal(${id || 'null'})">Save</button>
    </div>`);
}

/** Save a new or edited deal then refresh the list. */
window.saveDeal = async function (id) {
  const body = {
    title:      document.getElementById('df_title').value.trim(),
    company_id: document.getElementById('df_company').value || null,
    contact_id: document.getElementById('df_contact').value || null,
    value:      parseFloat(document.getElementById('df_value').value) || 0,
    stage:      document.getElementById('df_stage').value,
    probability:parseInt(document.getElementById('df_prob').value) || 0,
    close_date: document.getElementById('df_date').value || null,
    notes:      document.getElementById('df_notes').value.trim(),
  };
  if (!body.title) { showToast('Deal title is required', 'error'); return; }
  try {
    if (id) {
      await api(`/api/deals/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Deal updated');
    } else {
      await api('/api/deals', { method: 'POST', body: JSON.stringify(body) });
      showToast('Deal added');
    }
    if (body.company_id) delete State.companyCache[body.company_id];
    if (State.selectedCompanyId) delete State.companyCache[State.selectedCompanyId];
    closeModal();
    loadDeals();
  } catch (e) { showToast(e.message, 'error'); }
};

/** Confirm and delete a deal, then refresh the list. */
window.deleteDeal = function (id) {
  const d = State.deals.find(x => x.id === id);
  confirmDialog(`Delete "${d?.title}"?`, 'This action cannot be undone.', async () => {
    try {
      await api(`/api/deals/${id}`, { method: 'DELETE' });
      showToast('Deal deleted');
      loadDeals();
    } catch (e) { showToast(e.message, 'error'); }
  });
};

/* ============================================================
   DEAL FILES
   ============================================================ */

const FILE_CATS = {
  quotation: { label: 'Quotations',      icon: 'fa-file-invoice-dollar' },
  po:        { label: 'Purchase Orders', icon: 'fa-file-contract'       },
  survey:    { label: 'Survey',          icon: 'fa-map-marked-alt'      },
  drawing:   { label: 'Drawings',        icon: 'fa-drafting-compass'    },
  other:     { label: 'Other',           icon: 'fa-folder-open'         },
};

window.openDealFiles = async function(dealId) {
  const deal = State.deals.find(d => d.id === dealId);
  openModal(
    `<i class="fas fa-paperclip" style="margin-right:6px;color:var(--primary)"></i>Files — ${esc(deal?.title || 'Deal')}`,
    buildFilesModalHtml(dealId),
    'modal-xl'
  );
  loadDealFiles(dealId);
};

function buildFilesModalHtml(dealId) {
  const catOptions = Object.entries(FILE_CATS)
    .map(([v, {label}]) => `<option value="${v}">${label}</option>`).join('');
  return `
    <div class="df-upload-bar">
      <div class="form-group" style="margin:0;flex:0 0 170px">
        <label class="form-label">Category</label>
        <select id="df-category" class="form-control">${catOptions}</select>
      </div>
      <div class="df-drop-zone" id="df-drop-zone"
        ondragover="event.preventDefault();this.classList.add('dz-over')"
        ondragleave="this.classList.remove('dz-over')"
        ondrop="handleDealFileDrop(event,${dealId})">
        <i class="fas fa-cloud-upload-alt"></i>
        <span>Drop files here or
          <label for="df-file-input" class="df-browse-link">browse</label>
        </span>
        <input type="file" id="df-file-input" multiple style="display:none"
          onchange="handleDealFileSelect(event,${dealId})">
      </div>
    </div>
    <div id="df-status" class="df-status"></div>
    <div id="df-files-body" style="margin-top:4px"><div class="spinner"></div></div>`;
}

async function loadDealFiles(dealId) {
  const el = document.getElementById('df-files-body');
  if (!el) return;
  el.innerHTML = '<div class="spinner"></div>';
  try {
    const grouped = await api(`/api/deals/${dealId}/files`);
    el.innerHTML = renderFileSections(grouped, dealId);
  } catch (e) {
    el.innerHTML = `<p style="color:var(--danger);padding:12px">${esc(e.message)}</p>`;
  }
}

function renderFileSections(grouped, dealId) {
  return Object.entries(FILE_CATS).map(([cat, {label, icon}]) => {
    const files = grouped[cat] || [];
    return `<div class="df-section">
      <div class="df-section-header">
        <i class="fas ${icon}"></i> ${label}
        <span class="df-count">${files.length}</span>
      </div>
      ${files.length
        ? `<div class="df-list">${files.map(f => renderFileItem(f)).join('')}</div>`
        : `<div class="df-empty">No files</div>`}
    </div>`;
  }).join('');
}

function renderFileItem(f) {
  const ext     = (f.original_name.split('.').pop() || '').toLowerCase();
  const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext);
  const isPdf   = ext === 'pdf';
  return `<div class="df-item">
    <i class="fas ${fileTypeIcon(ext)} df-item-icon"></i>
    <span class="df-item-name" title="${esc(f.original_name)}">${esc(f.original_name)}</span>
    <span class="df-item-date">${fmtDate(f.uploaded_at)}</span>
    <div class="df-item-actions">
      ${isImage || isPdf
        ? `<button class="btn-icon" title="Preview" onclick="previewDealFile(${f.id},'${ext}')"><i class="fas fa-eye"></i></button>`
        : ''}
      <button class="btn-icon" title="Download" onclick="downloadDealFile(${f.id},${JSON.stringify(f.original_name)})"><i class="fas fa-download"></i></button>
      <button class="btn-icon danger" title="Delete" onclick="deleteDealFile(${f.id},${f.deal_id})"><i class="fas fa-trash"></i></button>
    </div>
  </div>`;
}

function fileTypeIcon(ext) {
  const m = {
    pdf:'fa-file-pdf', png:'fa-file-image', jpg:'fa-file-image', jpeg:'fa-file-image',
    gif:'fa-file-image', webp:'fa-file-image',
    xlsx:'fa-file-excel', xls:'fa-file-excel',
    doc:'fa-file-word',  docx:'fa-file-word',
    txt:'fa-file-alt',   csv:'fa-file-csv',
    zip:'fa-file-archive', rar:'fa-file-archive',
  };
  return m[ext] || 'fa-file';
}

window.handleDealFileDrop = async function(event, dealId) {
  event.preventDefault();
  document.getElementById('df-drop-zone')?.classList.remove('dz-over');
  const files = [...event.dataTransfer.files];
  if (files.length) await doDealUpload(dealId, files);
};

window.handleDealFileSelect = async function(event, dealId) {
  const files = [...event.target.files];
  event.target.value = '';
  if (files.length) await doDealUpload(dealId, files);
};

async function doDealUpload(dealId, files) {
  const category = document.getElementById('df-category')?.value || 'other';
  const status   = document.getElementById('df-status');
  if (status) status.innerHTML =
    `<span class="df-uploading"><i class="fas fa-spinner fa-spin"></i> Uploading ${files.length} file${files.length !== 1 ? 's' : ''}…</span>`;

  const fd = new FormData();
  fd.append('category', category);
  files.forEach(f => fd.append('files', f));

  try {
    const resp = await fetch(`/api/deals/${dealId}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${State.token}` },
      body: fd,
    });
    if (!resp.ok) throw new Error(((await resp.json()).error) || 'Upload failed');
    if (status) {
      status.innerHTML = `<span class="df-ok"><i class="fas fa-check-circle"></i> ${files.length} file${files.length !== 1 ? 's' : ''} uploaded</span>`;
      setTimeout(() => { if (status) status.innerHTML = ''; }, 3000);
    }
    loadDealFiles(dealId);
  } catch (e) {
    if (status) status.innerHTML =
      `<span class="df-err"><i class="fas fa-exclamation-circle"></i> ${esc(e.message)}</span>`;
  }
}

window.previewDealFile = function(fileId, ext) {
  const url = `/api/deal-files/${fileId}/content?token=${encodeURIComponent(State.token)}`;
  const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext);
  if (isImage) {
    const ov = document.createElement('div');
    ov.className = 'df-preview-overlay';
    ov.onclick = () => document.body.removeChild(ov);
    ov.innerHTML = `<img src="${url}" class="df-preview-img"><div class="df-preview-close">✕</div>`;
    document.body.appendChild(ov);
  } else {
    window.open(url, '_blank');
  }
};

window.downloadDealFile = function(fileId, name) {
  const url = `/api/deal-files/${fileId}/content?download=1&token=${encodeURIComponent(State.token)}`;
  const a   = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

window.deleteDealFile = function(fileId, dealId) {
  confirmDialog('Delete file?', 'This cannot be undone.', async () => {
    try {
      await api(`/api/deal-files/${fileId}`, { method: 'DELETE' });
      showToast('File deleted');
      loadDealFiles(dealId);
    } catch (e) { showToast(e.message, 'error'); }
  });
};
