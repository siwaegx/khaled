'use strict';
/**
 * @file routes/activities.js
 * @description Activity CRUD routes. Includes task assignment notifications.
 */

const { db } = require('../database/database');

/** Full SELECT for activity rows with joined context fields */
const ACTIVITY_SELECT = `SELECT a.*,
  (c.first_name||' '||c.last_name) as contact_name,
  comp.name as company_name,
  d.title as deal_title,
  u.name as user_name,
  au.name as assigned_to_name
  FROM activities a
  LEFT JOIN contacts c ON a.contact_id=c.id
  LEFT JOIN companies comp ON a.company_id=comp.id
  LEFT JOIN deals d ON a.deal_id=d.id
  LEFT JOIN users u ON a.user_id=u.id
  LEFT JOIN users au ON a.assigned_to=au.id`;

/**
 * Register activity routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, activityOwnerFilter, checkOwnership, n }
 */
function register(app, _db, helpers) {
  const { requireAuth, activityOwnerFilter, checkOwnership, n } = helpers;

  /** List activities with optional completed/type filters */
  app.get('/api/activities', requireAuth, (req, res) => {
    const {completed, type} = req.query;
    const {clause, params} = activityOwnerFilter(req,'a');
    let sql = `${ACTIVITY_SELECT} WHERE 1=1${clause}`;
    if (completed!==undefined) { sql+=` AND a.completed=?`; params.push(completed==='true'?1:0); }
    if (type) { sql+=` AND a.type=?`; params.push(type); }
    res.json(db.prepare(sql+' ORDER BY a.completed ASC,a.due_date ASC,a.created_at DESC').all(...params));
  });

  /** Create a new activity; notifies assignee if different from creator */
  app.post('/api/activities', requireAuth, (req, res) => {
    const {type,title,description,due_date,contact_id,company_id,deal_id,reminder_at,assigned_to} = req.body;
    const r = db.prepare(`INSERT INTO activities (type,title,description,due_date,contact_id,company_id,deal_id,reminder_at,assigned_to,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(type,title,n(description),n(due_date),n(contact_id),n(company_id),n(deal_id),n(reminder_at),n(assigned_to),req.user.id);

    // Notify assignee when a task is assigned to someone else
    if (type === 'task' && assigned_to && parseInt(assigned_to) !== req.user.id) {
      const coName = company_id ? db.prepare('SELECT name FROM companies WHERE id=?').get(company_id)?.name : null;
      db.prepare(`INSERT INTO notifications (user_id,type,title,body,link_type,link_id) VALUES (?,?,?,?,?,?)`)
        .run(parseInt(assigned_to), 'task_assigned',
          `New task assigned to you`,
          `"${title}" assigned by ${req.user.name}${coName ? ` â€” ${coName}` : ''}`,
          'task', r.lastInsertRowid);
    }

    res.status(201).json(db.prepare(`${ACTIVITY_SELECT} WHERE a.id=?`).get(r.lastInsertRowid));
  });

  /** Update an activity; assignees can only toggle completion */
  app.put('/api/activities/:id', requireAuth, (req, res) => {
    if (!checkOwnership('activities', req.params.id, req, res)) return;
    const {type,title,description,due_date,completed,contact_id,company_id,deal_id,reminder_at,assigned_to} = req.body;
    const row = db.prepare('SELECT user_id FROM activities WHERE id=?').get(req.params.id);
    // Partial update (only completed toggled) â€” or assignee marking complete
    const isAssigneeOnly = row?.user_id !== req.user.id && !['manager','team_leader'].includes(req.user.role);
    if (isAssigneeOnly || !type || !title) {
      db.prepare(`UPDATE activities SET completed=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(completed?1:0, req.params.id);
    } else {
      db.prepare(`UPDATE activities SET type=?,title=?,description=?,due_date=?,completed=?,contact_id=?,company_id=?,deal_id=?,reminder_at=?,assigned_to=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(type,title,n(description),n(due_date),completed?1:0,n(contact_id),n(company_id),n(deal_id),n(reminder_at),n(assigned_to),req.params.id);
    }
    res.json(db.prepare(`${ACTIVITY_SELECT} WHERE a.id=?`).get(req.params.id));
  });

  /** Delete an activity */
  app.delete('/api/activities/:id', requireAuth, (req, res) => {
    if (!checkOwnership('activities', req.params.id, req, res)) return;
    db.prepare('DELETE FROM activities WHERE id=?').run(req.params.id);
    res.json({success:true});
  });
}

module.exports = { register, ACTIVITY_SELECT };
