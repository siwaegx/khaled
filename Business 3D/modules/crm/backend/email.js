'use strict';
/**
 * @file routes/email.js
 * @description Email composer endpoint, reminder email helpers, and reminder polling interval.
 */

const { db } = require('../database/database');

let nodemailer;
try { nodemailer = require('nodemailer'); } catch (e) { nodemailer = null; }

/**
 * Create a nodemailer transporter from SMTP_* env vars.
 * @returns {object|null} transporter or null if SMTP not configured
 */
function createMailTransporter() {
  if (!nodemailer) return null;
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port: parseInt(process.env.SMTP_PORT || '587'), secure: process.env.SMTP_SECURE === 'true', auth: { user, pass } });
}

/**
 * Send a reminder email for a due activity.
 * @param {object} a - Activity row (with contact_name, company_name joined)
 * @param {string} toEmail - Recipient email address
 */
async function sendReminderEmail(a, toEmail) {
  const t = createMailTransporter();
  if (!t || !toEmail) return;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmail,
      subject: `â° Reminder: ${a.title}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <div style="background:#4f46e5;padding:18px 24px;color:white;"><h2 style="margin:0;font-size:16px;">CRM Reminder</h2></div>
        <div style="padding:20px 24px;">
          <h3 style="margin:0 0 8px;">${a.title}</h3>
          ${a.description ? `<p style="color:#6b7280;margin:0 0 12px;">${a.description}</p>` : ''}
          ${a.contact_name ? `<p style="margin:4px 0;font-size:13px;"><strong>Contact:</strong> ${a.contact_name}</p>` : ''}
          ${a.company_name ? `<p style="margin:4px 0;font-size:13px;"><strong>Company:</strong> ${a.company_name}</p>` : ''}
          ${a.due_date ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Due: ${new Date(a.due_date).toLocaleString()}</p>` : ''}
        </div>
      </div>`,
    });
  } catch (e) { console.error('Reminder email failed:', e.message); }
}

/**
 * Start the reminder polling interval (runs every 60 seconds).
 * Finds activities whose reminder_at has passed, marks them notified, and sends email.
 */
function startReminderInterval() {
  setInterval(() => {
    try {
      const due = db.prepare(`SELECT a.*,u.email as user_email,(c.first_name||' '||c.last_name) as contact_name,comp.name as company_name FROM activities a LEFT JOIN users u ON a.user_id=u.id LEFT JOIN contacts c ON a.contact_id=c.id LEFT JOIN companies comp ON a.company_id=comp.id WHERE a.reminder_at IS NOT NULL AND a.notified=0 AND a.completed=0 AND a.reminder_at<=datetime('now')`).all();
      for (const a of due) {
        db.prepare('UPDATE activities SET notified=1 WHERE id=?').run(a.id);
        if (a.user_email) sendReminderEmail(a, a.user_email);
      }
      if (due.length) console.log(`Reminder: sent ${due.length} notification(s)`);
    } catch (e) { console.error('Reminder check error:', e.message); }
  }, 60000);
}

/**
 * Register email composer route on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth }
 */
function register(app, _db, helpers) {
  const { requireAuth } = helpers;

  /** Send an email to a contact and log it as an activity */
  app.post('/api/send-email', requireAuth, async (req, res) => {
    const { contact_id, subject, body_text } = req.body;
    if (!contact_id || !subject) return res.status(400).json({ error: 'contact_id and subject required' });
    const contact = db.prepare('SELECT * FROM contacts WHERE id=?').get(contact_id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    if (!contact.email) return res.status(400).json({ error: 'Contact has no email address' });
    const t = createMailTransporter();
    if (!t) return res.status(503).json({ error: 'Email not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)' });
    try {
      await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: contact.email, subject, text: body_text });
      db.prepare(`INSERT INTO activities (type,title,description,contact_id,user_id) VALUES (?,?,?,?,?)`)
        .run('email', subject, body_text, contact_id, req.user.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { register, createMailTransporter, sendReminderEmail, startReminderInterval };
