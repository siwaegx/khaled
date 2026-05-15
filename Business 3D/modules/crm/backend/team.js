'use strict';
/**
 * @file routes/team.js
 * @description Team leader view â€” returns members with their stats and recent activities.
 */

const { db } = require('../database/database');
const { USER_SELECT } = require('./users');

/**
 * Register team routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth }
 */
function register(app, _db, helpers) {
  const { requireAuth } = helpers;

  /** Team leader: returns their sales members with per-member stats */
  app.get('/api/team', requireAuth, (req, res) => {
    if (req.user.role !== 'team_leader') return res.status(403).json({error:'Forbidden'});
    const members = db.prepare(`${USER_SELECT} WHERE u.team_leader_id=? ORDER BY u.name`).all(req.user.id);
    const stats = members.map(m => {
      const companies  = db.prepare('SELECT COUNT(*) as c FROM companies WHERE user_id=?').get(m.id).c;
      const contacts   = db.prepare('SELECT COUNT(*) as c FROM contacts WHERE user_id=?').get(m.id).c;
      const deals      = db.prepare("SELECT COUNT(*) as c, COALESCE(SUM(value),0) as pipeline FROM deals WHERE user_id=? AND stage NOT IN ('won','lost')").get(m.id);
      const wonRevenue = db.prepare("SELECT COALESCE(SUM(value),0) as s FROM deals WHERE user_id=? AND stage='won'").get(m.id).s;
      const tasks      = db.prepare("SELECT COUNT(*) as c FROM activities WHERE (user_id=? OR assigned_to=?) AND type='task' AND completed=0").get(m.id, m.id).c;
      const recentActs = db.prepare(`SELECT a.type,a.title,a.created_at,a.completed,
        (c.first_name||' '||c.last_name) as contact_name, comp.name as company_name
        FROM activities a
        LEFT JOIN contacts c ON a.contact_id=c.id
        LEFT JOIN companies comp ON a.company_id=comp.id
        WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 5`).all(m.id);
      return { ...m, companies, contacts, deals: deals.c, pipeline: deals.pipeline, wonRevenue, tasks, recentActs };
    });
    res.json({ members: stats });
  });
}

module.exports = { register };
