'use strict';
/**
 * @file routes/bulk.js
 * @description Bulk action routes for contacts and companies (delete, status change, assign).
 */

const { db } = require('../database/database');

/**
 * Register bulk action routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth }
 */
function register(app, _db, helpers) {
  const { requireAuth } = helpers;

  /** Bulk action on contacts: delete, lead_status change, or assign */
  app.post('/api/bulk/contacts', requireAuth, (req, res) => {
    const { ids, action, value } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No IDs' });
    const placeholders = ids.map(() => '?').join(',');
    // Verify ownership for sales users
    if (req.user.role === 'sales') {
      const owned = db.prepare(`SELECT id FROM contacts WHERE id IN (${placeholders}) AND user_id=?`).all(...ids, req.user.id);
      if (owned.length !== ids.length) return res.status(403).json({ error: 'Forbidden' });
    }
    if (action === 'delete') {
      db.prepare(`DELETE FROM contacts WHERE id IN (${placeholders})`).run(...ids);
    } else if (action === 'lead_status') {
      db.prepare(`UPDATE contacts SET lead_status=?,updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(value, ...ids);
    } else if (action === 'assign' && ['manager','team_leader'].includes(req.user.role)) {
      db.prepare(`UPDATE contacts SET user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(value, ...ids);
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }
    res.json({ success: true, affected: ids.length });
  });

  /** Bulk action on companies: delete, status change, or assign */
  app.post('/api/bulk/companies', requireAuth, (req, res) => {
    const { ids, action, value } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No IDs' });
    const placeholders = ids.map(() => '?').join(',');
    if (req.user.role === 'sales') {
      const owned = db.prepare(`SELECT id FROM companies WHERE id IN (${placeholders}) AND user_id=?`).all(...ids, req.user.id);
      if (owned.length !== ids.length) return res.status(403).json({ error: 'Forbidden' });
    }
    if (action === 'delete') {
      db.prepare(`DELETE FROM companies WHERE id IN (${placeholders})`).run(...ids);
    } else if (action === 'status') {
      db.prepare(`UPDATE companies SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(value, ...ids);
    } else if (action === 'assign' && ['manager','team_leader'].includes(req.user.role)) {
      db.prepare(`UPDATE companies SET user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(value, ...ids);
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }
    res.json({ success: true, affected: ids.length });
  });
}

module.exports = { register };
