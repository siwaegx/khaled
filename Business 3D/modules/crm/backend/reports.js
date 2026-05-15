'use strict';
/**
 * @file routes/reports.js
 * @description Analytics and reporting endpoint with date-range filtering.
 */

const { db } = require('../database/database');

/**
 * Register reports route on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, ownerFilter, activityOwnerFilter }
 */
function register(app, _db, helpers) {
  const { requireAuth, ownerFilter, activityOwnerFilter } = helpers;

  /** Return multi-dimensional report data scoped by user role and optional date range */
  app.get('/api/reports', requireAuth, (req, res) => {
    const oc  = ownerFilter(req);
    const ocd = ownerFilter(req, 'd');
    const oca = ownerFilter(req, 'a');
    const { from, to } = req.query;

    // Date range helpers
    const dD = []; let cD = '';
    const dA = []; let cA = '';
    if (from) { cD += ` AND date(d.updated_at)>=?`; dD.push(from); cA += ` AND date(a.created_at)>=?`; dA.push(from); }
    if (to)   { cD += ` AND date(d.updated_at)<=?`; dD.push(to);   cA += ` AND date(a.created_at)<=?`; dA.push(to); }
    const dDC = []; let cDC = '';
    if (from) { cDC += ` AND date(d.close_date)>=?`; dDC.push(from); }
    if (to)   { cDC += ` AND date(d.close_date)<=?`; dDC.push(to); }

    // Revenue by month (last 12 months)
    const revenueByMonth = db.prepare(`
      SELECT strftime('%Y-%m', d.updated_at) as month,
             COALESCE(SUM(d.value),0) as revenue,
             COUNT(*) as deals_count
      FROM deals d WHERE d.stage='won'${ocd.clause}${cD}
      GROUP BY month ORDER BY month DESC LIMIT 12`).all(...ocd.params,...dD).reverse();

    // Lead funnel: count contacts by lead_status
    const leadFunnel = db.prepare(`
      SELECT lead_status, COUNT(*) as count
      FROM contacts WHERE lead_status IS NOT NULL AND lead_status != ''${oc.clause}
      GROUP BY lead_status ORDER BY count DESC LIMIT 10`).all(...oc.params);

    // Activity breakdown by type
    const activityByType = db.prepare(`
      SELECT a.type, COUNT(*) as total, SUM(CASE WHEN a.completed=1 THEN 1 ELSE 0 END) as done
      FROM activities a WHERE 1=1${oca.clause}${cA}
      GROUP BY a.type ORDER BY total DESC`).all(...oca.params,...dA);

    // Activity breakdown by user
    const activityByUser = db.prepare(`
      SELECT u.name as user_name,
             COUNT(*) as total,
             SUM(CASE WHEN a.completed=1 THEN 1 ELSE 0 END) as done,
             SUM(CASE WHEN a.type='call'  THEN 1 ELSE 0 END) as calls,
             SUM(CASE WHEN a.type='visit' THEN 1 ELSE 0 END) as visits,
             SUM(CASE WHEN a.type='email' THEN 1 ELSE 0 END) as emails
      FROM activities a LEFT JOIN users u ON a.user_id=u.id
      WHERE 1=1${oca.clause}${cA}
      GROUP BY a.user_id ORDER BY total DESC`).all(...oca.params,...dA);

    // Deal stage summary
    const dealStages = db.prepare(`
      SELECT d.stage, COUNT(*) as count, COALESCE(SUM(d.value),0) as value
      FROM deals d WHERE 1=1${ocd.clause}
      GROUP BY d.stage`).all(...ocd.params);

    // Top companies by deal value
    const topCompanies = db.prepare(`
      SELECT comp.name, COALESCE(SUM(d.value),0) as total_value, COUNT(d.id) as deal_count
      FROM deals d JOIN companies comp ON d.company_id=comp.id
      WHERE d.stage='won'${ocd.clause}${cD}
      GROUP BY d.company_id ORDER BY total_value DESC LIMIT 8`).all(...ocd.params,...dD);

    // Won vs lost this period
    const winLoss = db.prepare(`
      SELECT d.stage, COUNT(*) as count, COALESCE(SUM(d.value),0) as value
      FROM deals d WHERE d.stage IN ('won','lost')${ocd.clause}${cD}
      GROUP BY d.stage`).all(...ocd.params,...dD);

    res.json({ revenueByMonth, leadFunnel, activityByType, activityByUser, dealStages, topCompanies, winLoss });
  });
}

module.exports = { register };
