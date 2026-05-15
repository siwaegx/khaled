'use strict';
/**
 * @file routes/custom-fields.js
 * @description Custom field definition and value endpoints.
 */

const { db } = require('../database/database');

/**
 * Register custom fields routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, requireManager }
 */
function register(app, _db, helpers) {
  const { requireAuth, requireManager } = helpers;

  /** Return all custom field definitions for an entity type */
  app.get('/api/custom-fields/:entity_type', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM custom_field_defs WHERE entity_type=? ORDER BY order_index,id').all(req.params.entity_type));
  });

  /** Create a new custom field definition (manager only) */
  app.post('/api/custom-fields', requireAuth, requireManager, (req, res) => {
    const { entity_type, label, field_type, options } = req.body;
    if (!entity_type || !label) return res.status(400).json({ error: 'entity_type and label required' });
    const r = db.prepare('INSERT INTO custom_field_defs (entity_type,label,field_type,options) VALUES (?,?,?,?)').run(entity_type, label, field_type || 'text', options || null);
    res.status(201).json(db.prepare('SELECT * FROM custom_field_defs WHERE id=?').get(r.lastInsertRowid));
  });

  /** Delete a custom field definition (manager only) */
  app.delete('/api/custom-fields/:id', requireAuth, requireManager, (req, res) => {
    db.prepare('DELETE FROM custom_field_defs WHERE id=?').run(req.params.id);
    res.json({ success: true });
  });

  /** Return all custom field values for a specific entity */
  app.get('/api/custom-values/:entity_type/:entity_id', requireAuth, (req, res) => {
    const vals = db.prepare('SELECT * FROM custom_field_values WHERE entity_type=? AND entity_id=?').all(req.params.entity_type, req.params.entity_id);
    res.json(vals);
  });

  /** Upsert a custom field value for an entity */
  app.post('/api/custom-values', requireAuth, (req, res) => {
    const { entity_type, entity_id, field_def_id, value } = req.body;
    db.prepare(`INSERT INTO custom_field_values (entity_type,entity_id,field_def_id,value) VALUES (?,?,?,?)
      ON CONFLICT(entity_type,entity_id,field_def_id) DO UPDATE SET value=excluded.value`)
      .run(entity_type, entity_id, field_def_id, value || null);
    res.json({ success: true });
  });
}

module.exports = { register };
