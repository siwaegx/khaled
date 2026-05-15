'use strict';
/**
 * @file auth.js
 * @description Authentication and authorization middleware.
 * Exports: requireAuth, requireManager, getTeamIds, ownerFilter,
 *          activityOwnerFilter, checkOwnership, managerCount, n
 */

const { db } = require('../database/database');

/** Null-coerce helper — converts undefined to null for SQLite binding */
const n = v => v ?? null;

/** Returns count of manager-role users */
function managerCount() {
  return db.prepare("SELECT COUNT(*) as c FROM users WHERE role='manager'").get().c;
}

/** Validates Bearer token and attaches req.user; also rolls the session expiry */
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /,'').trim();
  if (!token) return res.status(401).json({error:'Unauthorized'});
  const session = db.prepare(`
    SELECT s.token, u.id as uid, u.name, u.role
    FROM sessions s JOIN users u ON s.user_id=u.id
    WHERE s.token=? AND s.expires_at>datetime('now')
  `).get(token);
  if (!session) return res.status(401).json({error:'Unauthorized'});
  req.user = {id:session.uid, name:session.name, role:session.role};
  // Rolling session: extend expiry to 30 days from now on every request
  db.prepare("UPDATE sessions SET expires_at=datetime('now','+30 days') WHERE token=?").run(token);
  next();
}

/** Rejects non-manager users with 403 */
function requireManager(req, res, next) {
  if (req.user?.role !== 'manager') return res.status(403).json({error:'Forbidden'});
  next();
}

/** Returns all user IDs a team leader is responsible for (self + their sales) */
function getTeamIds(userId) {
  return db.prepare('SELECT id FROM users WHERE id=? OR team_leader_id=?').all(userId, userId).map(u => u.id);
}

/**
 * Builds a WHERE clause fragment that scopes records by owner.
 * - Manager: no filter (or filter by view_as if provided)
 * - Team leader: their team or specific member via view_as
 * - Sales: only own records
 */
function ownerFilter(req, alias) {
  const col = alias ? `${alias}.user_id` : 'user_id';
  if (req.user.role === 'manager') {
    const viewAs = parseInt(req.query?.view_as);
    if (viewAs && !isNaN(viewAs)) return {clause:` AND ${col}=?`, params:[viewAs]};
    return {clause:'', params:[]};
  }
  if (req.user.role === 'team_leader') {
    const viewAs = parseInt(req.query?.view_as);
    if (viewAs) {
      // Validate: viewAs must be in the TL's team
      const teamIds = getTeamIds(req.user.id);
      if (teamIds.includes(viewAs)) return {clause:` AND ${col}=?`, params:[viewAs]};
    }
    if (!req.query?.view_as) {
      // "My Data" — only TL's own records
      return {clause:` AND ${col}=?`, params:[req.user.id]};
    }
    const ids = getTeamIds(req.user.id);
    const ph  = ids.map(() => '?').join(',');
    return {clause:` AND ${col} IN (${ph})`, params: ids};
  }
  return {clause:` AND ${col}=?`, params:[req.user.id]};
}

/**
 * Builds a WHERE clause for activities that checks both user_id and assigned_to.
 * Scoping rules mirror ownerFilter but include the assigned_to column.
 */
function activityOwnerFilter(req, alias = 'a') {
  if (req.user.role === 'manager') {
    const viewAs = parseInt(req.query?.view_as);
    if (viewAs && !isNaN(viewAs))
      return {clause:` AND (${alias}.user_id=? OR ${alias}.assigned_to=?)`, params:[viewAs, viewAs]};
    return {clause:'', params:[]};
  }
  if (req.user.role === 'team_leader') {
    const viewAs = parseInt(req.query?.view_as);
    if (viewAs) {
      const teamIds = getTeamIds(req.user.id);
      if (teamIds.includes(viewAs))
        return {clause:` AND (${alias}.user_id=? OR ${alias}.assigned_to=?)`, params:[viewAs, viewAs]};
    }
    if (!req.query?.view_as) {
      return {clause:` AND (${alias}.user_id=? OR ${alias}.assigned_to=?)`, params:[req.user.id, req.user.id]};
    }
    const ids = getTeamIds(req.user.id);
    const ph  = ids.map(() => '?').join(',');
    return {clause:` AND (${alias}.user_id IN (${ph}) OR ${alias}.assigned_to IN (${ph}))`, params:[...ids,...ids]};
  }
  return {clause:` AND (${alias}.user_id=? OR ${alias}.assigned_to=?)`, params:[req.user.id, req.user.id]};
}

/**
 * Verifies the requesting user has access to a specific record.
 * Returns true if allowed, false (and sends response) if not.
 */
function checkOwnership(table, id, req, res) {
  if (req.user.role === 'manager') return true;
  const cols = table === 'activities' ? 'user_id, assigned_to' : 'user_id';
  const row = db.prepare(`SELECT ${cols} FROM ${table} WHERE id=?`).get(id);
  if (!row) { res.status(404).json({error:'Not found'}); return false; }
  if (req.user.role === 'team_leader') {
    const ids = getTeamIds(req.user.id);
    if (ids.includes(row.user_id) || (row.assigned_to && ids.includes(row.assigned_to))) return true;
    res.status(403).json({error:'Forbidden'}); return false;
  }
  if (row.user_id !== req.user.id && row.assigned_to !== req.user.id) {
    res.status(403).json({error:'Forbidden'}); return false;
  }
  return true;
}

module.exports = { requireAuth, requireManager, getTeamIds, ownerFilter, activityOwnerFilter, checkOwnership, managerCount, n };
