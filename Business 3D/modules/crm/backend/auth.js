'use strict';
/**
 * @file routes/auth.js
 * @description Authentication routes: login, logout, and current-user.
 */

const crypto = require('crypto');
const { db } = require('../database/database');

/**
 * Register auth routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused, db imported directly)
 * @param {object} helpers - { requireAuth }
 */
function register(app, _db, helpers) {
  const { requireAuth } = helpers;

  /** Login with a 4-digit PIN; returns session token and user info */
  app.post('/api/auth/login', (req, res) => {
    const {pin} = req.body;
    if (!pin) return res.status(400).json({error:'PIN required'});
    const user = db.prepare('SELECT * FROM users WHERE pin=?').get(String(pin));
    if (!user) return res.status(401).json({error:'Invalid PIN'});
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare("INSERT INTO sessions (user_id,token,expires_at) VALUES (?,?,datetime('now','+30 days'))").run(user.id, token);
    res.json({token, user:{id:user.id, name:user.name, role:user.role}});
  });

  /** Destroy the current session */
  app.post('/api/auth/logout', requireAuth, (req, res) => {
    const token = (req.headers.authorization||'').replace(/^Bearer /,'').trim();
    db.prepare('DELETE FROM sessions WHERE token=?').run(token);
    res.json({success:true});
  });

  /** Return the currently authenticated user */
  app.get('/api/auth/me', requireAuth, (req, res) => res.json(req.user));
}

module.exports = { register };
