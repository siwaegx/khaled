'use strict';
/**
 * @file routes/settings.js
 * @description Application settings routes (currency symbol, etc.).
 */

const { db } = require('../database/database');

/**
 * Register settings routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, requireManager }
 */
function register(app, _db, helpers) {
  const { requireAuth, requireManager } = helpers;

  /** Return all settings as a keyâ†’value object */
  app.get('/api/settings', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const obj  = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    res.json(obj);
  });

  /** Update allowed settings (manager only) */
  app.put('/api/settings', requireAuth, requireManager, (req, res) => {
    const allowed = ['currency', 'currency_symbol'];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    if (!updates.length) return res.status(400).json({ error: 'No valid settings provided' });
    for (const [key, value] of updates) {
      db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(key, String(value).trim());
    }
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const obj  = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    res.json(obj);
  });
}

module.exports = { register };
