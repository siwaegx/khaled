'use strict';
/**
 * @file routes/notifications.js
 * @description Notification endpoints â€” fetch and mark-as-read.
 */

const { db } = require('../database/database');

/**
 * Register notification routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} _helpers - (unused)
 */
function register(app, _db, _helpers) {
  const { requireAuth } = _helpers;

  /** Return last 30 notifications for the current user plus unread count */
  app.get('/api/notifications', requireAuth, (req, res) => {
    const notifs = db.prepare(`SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30`).all(req.user.id);
    const unread  = db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND read=0`).get(req.user.id).c;
    res.json({ notifications: notifs, unread });
  });

  /** Mark all notifications for the current user as read */
  app.put('/api/notifications/read', requireAuth, (req, res) => {
    db.prepare(`UPDATE notifications SET read=1 WHERE user_id=?`).run(req.user.id);
    res.json({ success: true });
  });
}

module.exports = { register };
