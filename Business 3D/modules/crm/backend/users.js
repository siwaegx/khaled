'use strict';
/**
 * @file routes/users.js
 * @description User management routes (manager only): list, create, update, delete.
 */

const { db } = require('../database/database');

/** Full SELECT for user rows including team leader name */
const USER_SELECT = `SELECT u.id,u.name,u.role,u.email,u.phone,u.team_leader_id,u.created_at,tl.name as team_leader_name FROM users u LEFT JOIN users tl ON u.team_leader_id=tl.id`;

/**
 * Register user routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, requireManager, managerCount, n }
 */
function register(app, _db, helpers) {
  const { requireAuth, requireManager, managerCount, n } = helpers;

  /** List all users ordered by role then name */
  app.get('/api/users', requireAuth, requireManager, (req, res) => {
    res.json(db.prepare(`${USER_SELECT} ORDER BY u.role DESC,u.name`).all());
  });

  /** Create a new user */
  app.post('/api/users', requireAuth, requireManager, (req, res) => {
    const {name,role,pin,email,phone,team_leader_id} = req.body;
    if (!name||!name.trim()) return res.status(400).json({error:'Name is required'});
    if (!['manager','team_leader','sales'].includes(role)) return res.status(400).json({error:'Invalid role'});
    if (!pin||!/^\d{4}$/.test(String(pin))) return res.status(400).json({error:'PIN must be exactly 4 digits'});
    if (db.prepare('SELECT id FROM users WHERE pin=?').get(String(pin))) return res.status(400).json({error:'PIN already in use'});
    const tlId = (role === 'sales' && team_leader_id) ? parseInt(team_leader_id) : null;
    const r = db.prepare('INSERT INTO users (name,role,pin,email,phone,team_leader_id) VALUES (?,?,?,?,?,?)').run(name.trim(), role, String(pin), n(email), n(phone), n(tlId));
    res.status(201).json(db.prepare(`${USER_SELECT} WHERE u.id=?`).get(r.lastInsertRowid));
  });

  /** Update an existing user */
  app.put('/api/users/:id', requireAuth, requireManager, (req, res) => {
    const {name,role,pin,email,phone,team_leader_id} = req.body;
    const userId = parseInt(req.params.id);
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
    if (!user) return res.status(404).json({error:'User not found'});
    if (!name||!name.trim()) return res.status(400).json({error:'Name is required'});
    if (!['manager','team_leader','sales'].includes(role)) return res.status(400).json({error:'Invalid role'});
    if (user.role==='manager'&&role!=='manager'&&managerCount()<=1) return res.status(400).json({error:'At least one manager must remain'});
    const tlId = (role === 'sales' && team_leader_id) ? parseInt(team_leader_id) : null;
    const updates = ['name=?','role=?','email=?','phone=?','team_leader_id=?'];
    const params = [name.trim(), role, n(email), n(phone), n(tlId)];
    if (pin!==undefined&&pin!=='') {
      if (!/^\d{4}$/.test(String(pin))) return res.status(400).json({error:'PIN must be exactly 4 digits'});
      if (db.prepare('SELECT id FROM users WHERE pin=? AND id!=?').get(String(pin),userId)) return res.status(400).json({error:'PIN already in use'});
      updates.push('pin=?'); params.push(String(pin));
    }
    params.push(userId);
    db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...params);
    res.json(db.prepare(`${USER_SELECT} WHERE u.id=?`).get(userId));
  });

  /** Delete a user (cannot delete last manager or self) */
  app.delete('/api/users/:id', requireAuth, requireManager, (req, res) => {
    const userId = parseInt(req.params.id);
    if (userId===req.user.id) return res.status(403).json({error:'Cannot delete your own account'});
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
    if (!user) return res.status(404).json({error:'User not found'});
    if (user.role==='manager'&&managerCount()<=1) return res.status(400).json({error:'Cannot delete the last manager'});
    db.prepare('DELETE FROM users WHERE id=?').run(userId);
    res.json({success:true});
  });
}

module.exports = { register, USER_SELECT };
