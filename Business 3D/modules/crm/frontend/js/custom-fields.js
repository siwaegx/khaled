/**
 * @file custom-fields.js
 * @description Custom field definitions and values: fetch definitions into
 * State, render read-only display panels, render form inputs, and save values.
 */

/* ============================================================
   CUSTOM FIELDS
   ============================================================ */

/** Fetch custom field definitions for both entity types and cache in State. */
async function loadCustomFields() {
  try {
    const [contact, company] = await Promise.all([
      api('/api/custom-fields/contact', {_silent:true}),
      api('/api/custom-fields/company', {_silent:true}),
    ]);
    State.customFields = { contact: contact||[], company: company||[] };
  } catch(_) { State.customFields = { contact:[], company:[] }; }
}

/** Fetch saved custom field values for a specific record. */
async function loadCustomValues(entityType, entityId) {
  try {
    const vals = await api(`/api/custom-values/${entityType}/${entityId}`, {_silent:true});
    return vals || [];
  } catch(_) { return []; }
}

/** Render saved custom field values as read-only display rows. */
function renderCustomFieldsView(entityType, entityId, values) {
  const defs = State.customFields?.[entityType] || [];
  if (!defs.length) return '';
  const valMap = Object.fromEntries((values||[]).map(v => [v.field_def_id, v.value]));
  const fields = defs.map(d => {
    const val = valMap[d.id];
    if (!val) return '';
    return `<div class="dp-field"><i class="fas fa-tag"></i><div><div style="font-size:10px;color:var(--text-light);text-transform:uppercase;letter-spacing:.03em;">${esc(d.label)}</div><div class="dp-field-val">${esc(val)}</div></div></div>`;
  }).filter(Boolean).join('');
  return fields ? `<div class="dp-fields-grid">${fields}</div>` : '';
}

/** Render custom field inputs inside a form, pre-filled with existing values. */
function renderCustomFieldInputs(entityType, values) {
  const defs = State.customFields?.[entityType] || [];
  if (!defs.length) return '';
  const valMap = Object.fromEntries((values||[]).map(v => [v.field_def_id, v.value]));
  return `<div class="form-group" style="grid-column:1/-1;">
    <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Custom Fields</div>
    ${defs.map(d => `<div class="form-group" style="margin-bottom:8px;">
      <label class="form-label">${esc(d.label)}</label>
      ${d.field_type === 'select' && d.options
        ? `<select class="form-control cf-input" data-def-id="${d.id}"><option value="">— select —</option>${JSON.parse(d.options||'[]').map(o => `<option ${valMap[d.id]===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`
        : `<input class="form-control cf-input" data-def-id="${d.id}" type="${d.field_type==='number'?'number':d.field_type==='date'?'date':'text'}" value="${esc(valMap[d.id]||'')}">`}
    </div>`).join('')}
  </div>`;
}

/** Persist all custom field inputs currently in the DOM for the given record. */
async function saveCustomValues(entityType, entityId) {
  const inputs = document.querySelectorAll('.cf-input');
  for (const inp of inputs) {
    const field_def_id = parseInt(inp.dataset.defId);
    const value = inp.value?.trim() || null;
    if (field_def_id) {
      await api('/api/custom-values', { method:'POST', body: JSON.stringify({ entity_type: entityType, entity_id: entityId, field_def_id, value }) });
    }
  }
}
