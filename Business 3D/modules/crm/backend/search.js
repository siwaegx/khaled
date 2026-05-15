'use strict';
/**
 * @file routes/search.js
 * @description Global search across contacts, companies, and deals.
 */

const { db } = require('../database/database');

/**
 * Register search route on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, ownerFilter }
 */
function register(app, _db, helpers) {
  const { requireAuth, ownerFilter } = helpers;

  /** Search contacts, companies, and deals by a query string (min 2 chars) */
  app.get('/api/search', requireAuth, (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ contacts: [], companies: [], deals: [] });
    const like = `%${q}%`;
    const oc  = ownerFilter(req);
    const ocd = ownerFilter(req, 'd');
    const contacts  = db.prepare(`SELECT id,first_name,last_name,phone,lead_status FROM contacts WHERE (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)${oc.clause} LIMIT 5`).all(like, like, like, ...oc.params);
    const companies = db.prepare(`SELECT id,name,city,status FROM companies WHERE (name LIKE ? OR city LIKE ? OR custom_id LIKE ?)${oc.clause} LIMIT 5`).all(like, like, like, ...oc.params);
    const deals     = db.prepare(`SELECT d.id,d.title,d.value,d.stage FROM deals d WHERE d.title LIKE ?${ocd.clause} LIMIT 5`).all(like, ...ocd.params);
    res.json({ contacts, companies, deals });
  });
}

module.exports = { register };
