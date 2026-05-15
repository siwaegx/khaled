'use strict';
/**
 * @file routes/tasks.js
 * @description Tasks and reminders list endpoints (filtered activity views).
 */

const { db } = require('../database/database');
const { ACTIVITY_SELECT } = require('./activities');

/**
 * Register tasks and reminders routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, activityOwnerFilter }
 */
function register(app, _db, helpers) {
  const { requireAuth, activityOwnerFilter } = helpers;

  /** List tasks (type='task') with optional completed filter */
  app.get('/api/tasks', requireAuth, (req, res) => {
    const {completed} = req.query;
    const {clause, params} = activityOwnerFilter(req,'a');
    let sql = `${ACTIVITY_SELECT} WHERE a.type='task'${clause}`;
    if (completed!==undefined) { sql+=` AND a.completed=?`; params.push(completed==='true'?1:0); }
    res.json(db.prepare(sql+' ORDER BY a.completed ASC,a.due_date ASC,a.created_at DESC').all(...params));
  });

  /** List pending activities that have a reminder_at set */
  app.get('/api/reminders', requireAuth, (req, res) => {
    const {clause, params} = activityOwnerFilter(req,'a');
    const sql = `SELECT a.*,(c.first_name||' '||c.last_name) as contact_name,comp.name as company_name,d.title as deal_title,u.name as user_name FROM activities a LEFT JOIN contacts c ON a.contact_id=c.id LEFT JOIN companies comp ON a.company_id=comp.id LEFT JOIN deals d ON a.deal_id=d.id LEFT JOIN users u ON a.user_id=u.id WHERE a.reminder_at IS NOT NULL AND a.completed=0${clause} ORDER BY a.reminder_at ASC`;
    res.json(db.prepare(sql).all(...params));
  });
}

module.exports = { register };
