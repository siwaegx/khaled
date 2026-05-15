'use strict';
/**
 * @file routes/goals.js
 * @description Goals/targets endpoints â€” per-user monthly targets with actual performance.
 */

const { db } = require('../database/database');

/**
 * Register goals routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, requireManager }
 */
function register(app, _db, helpers) {
  const { requireAuth, requireManager } = helpers;

  /** Return goals for the given month (YYYY-MM) merged with actual performance */
  app.get('/api/goals', requireAuth, (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    let goals;
    if (req.user.role === 'sales') {
      goals = db.prepare('SELECT * FROM goals WHERE user_id=? AND month=?').all(req.user.id, month);
    } else {
      const teamClause = req.user.role === 'team_leader' ? ' AND (u.team_leader_id=? OR u.id=?)' : '';
      const teamParams = req.user.role === 'team_leader' ? [req.user.id, req.user.id] : [];
      goals = db.prepare(`SELECT g.*,u.name as user_name FROM goals g JOIN users u ON g.user_id=u.id WHERE g.month=?${teamClause}`).all(month, ...teamParams);
    }

    // Calculate actual performance per user for this month
    const perfMap = {};
    const usersInGoals = [...new Set(goals.map(g => g.user_id))];
    for (const uid of usersInGoals) {
      const from = `${month}-01`, to = `${month}-31`;
      perfMap[uid] = {
        actual_revenue:    db.prepare(`SELECT COALESCE(SUM(value),0) as s FROM deals WHERE user_id=? AND stage='won' AND updated_at BETWEEN ? AND ?`).get(uid, from, to).s,
        actual_deals:      db.prepare(`SELECT COUNT(*) as c FROM deals WHERE user_id=? AND stage='won' AND updated_at BETWEEN ? AND ?`).get(uid, from, to).c,
        actual_activities: db.prepare(`SELECT COUNT(*) as c FROM activities WHERE user_id=? AND created_at BETWEEN ? AND ?`).get(uid, from, to).c,
      };
    }
    res.json({ goals: goals.map(g => ({ ...g, ...(perfMap[g.user_id] || {}) })) });
  });

  /** Upsert a monthly goal for a user (manager only) */
  app.post('/api/goals', requireAuth, requireManager, (req, res) => {
    const { user_id, month, target_revenue, target_deals, target_activities } = req.body;
    if (!user_id || !month) return res.status(400).json({ error: 'user_id and month required' });
    db.prepare(`INSERT INTO goals (user_id,month,target_revenue,target_deals,target_activities,created_by) VALUES (?,?,?,?,?,?)
      ON CONFLICT(user_id,month) DO UPDATE SET target_revenue=excluded.target_revenue,target_deals=excluded.target_deals,target_activities=excluded.target_activities`)
      .run(user_id, month, target_revenue || 0, target_deals || 0, target_activities || 0, req.user.id);
    res.json({ success: true });
  });
}

module.exports = { register };
