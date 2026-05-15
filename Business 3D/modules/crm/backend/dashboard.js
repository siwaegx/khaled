'use strict';
/**
 * @file routes/dashboard.js
 * @description Dashboard summary endpoint â€” stats, pipeline, upcoming activities, leaderboard.
 */

const { db } = require('../database/database');

/**
 * Register dashboard route on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, ownerFilter, activityOwnerFilter }
 */
function register(app, _db, helpers) {
  const { requireAuth, ownerFilter, activityOwnerFilter } = helpers;

  /** Return aggregated dashboard data scoped by the requesting user's role */
  app.get('/api/dashboard', requireAuth, (req, res) => {
    const oc = ownerFilter(req);
    const oca = ownerFilter(req,'a');
    const occ = ownerFilter(req,'c');
    const ocd = ownerFilter(req,'d');
    const stats = {
      totalContacts:     db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE 1=1${oc.clause}`).get(...oc.params).c,
      totalCompanies:    db.prepare(`SELECT COUNT(*) as c FROM companies WHERE 1=1${oc.clause}`).get(...oc.params).c,
      totalDeals:        db.prepare(`SELECT COUNT(*) as c FROM deals d WHERE d.stage NOT IN ('won','lost')${ocd.clause}`).get(...ocd.params).c,
      wonDeals:          db.prepare(`SELECT COUNT(*) as c FROM deals d WHERE d.stage='won'${ocd.clause}`).get(...ocd.params).c,
      wonRevenue:        db.prepare(`SELECT COALESCE(SUM(d.value),0) as s FROM deals d WHERE d.stage='won'${ocd.clause}`).get(...ocd.params).s,
      pipelineValue:     db.prepare(`SELECT COALESCE(SUM(d.value),0) as s FROM deals d WHERE d.stage NOT IN ('won','lost')${ocd.clause}`).get(...ocd.params).s,
      pendingActivities: db.prepare(`SELECT COUNT(*) as c FROM activities a WHERE a.completed=0${oca.clause}`).get(...oca.params).c,
      forecastValue:     db.prepare(`SELECT COALESCE(SUM(d.value * d.probability / 100.0),0) as s FROM deals d WHERE d.stage NOT IN ('won','lost')${ocd.clause}`).get(...ocd.params).s,
    };
    const dealsByStage = db.prepare(`SELECT stage,COUNT(*) as count,COALESCE(SUM(value),0) as value FROM deals d WHERE 1=1${ocd.clause} GROUP BY stage`).all(...ocd.params);
    const recentContacts = db.prepare(`SELECT c.*,comp.name as company_name FROM contacts c LEFT JOIN companies comp ON c.company_id=comp.id WHERE 1=1${occ.clause} ORDER BY c.created_at DESC LIMIT 5`).all(...occ.params);
    const upcomingActivities = db.prepare(`SELECT a.*,(c.first_name||' '||c.last_name) as contact_name,comp.name as company_name,u.name as user_name FROM activities a LEFT JOIN contacts c ON a.contact_id=c.id LEFT JOIN companies comp ON a.company_id=comp.id LEFT JOIN users u ON a.user_id=u.id WHERE a.completed=0${oca.clause} ORDER BY a.due_date ASC LIMIT 5`).all(...oca.params);
    const recentDeals = db.prepare(`SELECT d.*,comp.name as company_name FROM deals d LEFT JOIN companies comp ON d.company_id=comp.id WHERE 1=1${ocd.clause} ORDER BY d.created_at DESC LIMIT 5`).all(...ocd.params);
    // Overdue tasks
    const overdueCount = db.prepare(`SELECT COUNT(*) as c FROM activities a WHERE a.completed=0 AND a.due_date < datetime('now')${oca.clause}`).get(...oca.params).c;
    // Recent activity feed
    const activityFeed = db.prepare(`SELECT a.*,(c.first_name||' '||c.last_name) as contact_name,comp.name as company_name,u.name as user_name FROM activities a LEFT JOIN contacts c ON a.contact_id=c.id LEFT JOIN companies comp ON a.company_id=comp.id LEFT JOIN users u ON a.user_id=u.id WHERE 1=1${oca.clause} ORDER BY a.created_at DESC LIMIT 10`).all(...oca.params);
    // Leaderboard (manager/TL: per-user stats)
    let leaderboard = [];
    if (['manager','team_leader'].includes(req.user.role)) {
      const teamClause = req.user.role === 'team_leader' ? ' AND u.team_leader_id=?' : '';
      const teamParams = req.user.role === 'team_leader' ? [req.user.id] : [];
      leaderboard = db.prepare(`
        SELECT u.id, u.name, u.role,
          (SELECT COUNT(*) FROM activities WHERE user_id=u.id) as activity_count,
          (SELECT COUNT(*) FROM activities WHERE user_id=u.id AND completed=1) as done_count,
          (SELECT COUNT(*) FROM deals WHERE user_id=u.id AND stage NOT IN ('won','lost')) as deal_count,
          (SELECT COALESCE(SUM(value),0) FROM deals WHERE user_id=u.id AND stage='won') as won_revenue
        FROM users u
        WHERE u.role IN ('sales','team_leader')${teamClause}
        ORDER BY activity_count DESC LIMIT 10
      `).all(...teamParams);
    }
    res.json({stats, dealsByStage, recentContacts, upcomingActivities, recentDeals, overdueCount, activityFeed, leaderboard});
  });
}

module.exports = { register };
