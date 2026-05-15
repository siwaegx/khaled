'use strict';
/**
 * @file routes/calendar.js
 * @description Calendar events endpoint â€” returns activities with due dates for a given month.
 */

const { db } = require('../database/database');

/**
 * Register calendar route on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, activityOwnerFilter }
 */
function register(app, _db, helpers) {
  const { requireAuth, activityOwnerFilter } = helpers;

  /** Return activities with due_date for the given month (YYYY-MM) */
  app.get('/api/calendar', requireAuth, (req, res) => {
    const { month } = req.query;
    const oa = activityOwnerFilter(req, 'a');
    const monthClause = month ? ` AND strftime('%Y-%m', a.due_date)=?` : '';
    const monthParams = month ? [month] : [];
    const events = db.prepare(`
      SELECT a.id, a.type, a.title, a.due_date, a.completed, a.description,
             (c.first_name||' '||c.last_name) as contact_name,
             comp.name as company_name, u.name as user_name
      FROM activities a
      LEFT JOIN contacts c ON a.contact_id=c.id
      LEFT JOIN companies comp ON a.company_id=comp.id
      LEFT JOIN users u ON a.user_id=u.id
      WHERE a.due_date IS NOT NULL${oa.clause}${monthClause}
      ORDER BY a.due_date ASC
    `).all(...oa.params, ...monthParams);
    res.json({ events });
  });
}

module.exports = { register };
