'use strict';
/**
 * @file routes/contacts.js
 * @description Contact CRUD, duplicate check, merge, and contacts-only CSV import.
 */

const { db } = require('../database/database');

/**
 * Register contact routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, requireManager, ownerFilter, checkOwnership, n }
 */
function register(app, _db, helpers) {
  const { requireAuth, requireManager, ownerFilter, checkOwnership, n } = helpers;

  /** List contacts with optional search */
  app.get('/api/contacts', requireAuth, (req, res) => {
    const {search} = req.query;
    const {clause, params} = ownerFilter(req,'c');
    let sql = `SELECT c.*,comp.name as company_name FROM contacts c LEFT JOIN companies comp ON c.company_id=comp.id WHERE 1=1${clause}`;
    if (search) { sql+=` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR comp.name LIKE ?)`; params.push(`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`); }
    res.json(db.prepare(sql+' ORDER BY c.first_name').all(...params));
  });

  /** Get a single contact with their deals and activities */
  app.get('/api/contacts/:id', requireAuth, (req, res) => {
    if (!checkOwnership('contacts', req.params.id, req, res)) return;
    const contact = db.prepare(`SELECT c.*,comp.name as company_name FROM contacts c LEFT JOIN companies comp ON c.company_id=comp.id WHERE c.id=?`).get(req.params.id);
    if (!contact) return res.status(404).json({error:'Not found'});
    const deals = db.prepare('SELECT * FROM deals WHERE contact_id=? ORDER BY created_at DESC').all(req.params.id);
    const activities = db.prepare(`SELECT a.*,u.name as user_name FROM activities a LEFT JOIN users u ON a.user_id=u.id WHERE a.contact_id=? ORDER BY a.created_at DESC`).all(req.params.id);
    res.json({...contact, deals, activities});
  });

  /** Create a new contact (also logs a "Contact added" activity) */
  app.post('/api/contacts', requireAuth, (req, res) => {
    const {first_name,last_name,email,phone,title,company_id,status,source,notes,lead_status} = req.body;
    const r = db.prepare(`INSERT INTO contacts (first_name,last_name,email,phone,title,company_id,status,source,notes,lead_status,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(first_name,last_name,n(email),n(phone),n(title),n(company_id),status||'active',n(source),n(notes),n(lead_status),req.user.id);
    const cid = r.lastInsertRowid;
    db.prepare(`INSERT INTO activities (type,title,description,contact_id,company_id,user_id) VALUES (?,?,?,?,?,?)`)
      .run('note','Contact added',`${String(first_name).trim()} ${String(last_name||'').trim()} added to CRM`,cid,n(company_id),req.user.id);
    res.status(201).json(db.prepare(`SELECT c.*,comp.name as company_name FROM contacts c LEFT JOIN companies comp ON c.company_id=comp.id WHERE c.id=?`).get(cid));
  });

  /** Update a contact */
  app.put('/api/contacts/:id', requireAuth, (req, res) => {
    if (!checkOwnership('contacts', req.params.id, req, res)) return;
    const {first_name,last_name,email,phone,title,company_id,status,source,notes,lead_status} = req.body;
    db.prepare(`UPDATE contacts SET first_name=?,last_name=?,email=?,phone=?,title=?,company_id=?,status=?,source=?,notes=?,lead_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(first_name,last_name||'',n(email),n(phone),n(title),n(company_id),status||'active',n(source),n(notes),n(lead_status),req.params.id);
    res.json(db.prepare(`SELECT c.*,comp.name as company_name FROM contacts c LEFT JOIN companies comp ON c.company_id=comp.id WHERE c.id=?`).get(req.params.id));
  });

  /** Delete a contact */
  app.delete('/api/contacts/:id', requireAuth, (req, res) => {
    if (!checkOwnership('contacts', req.params.id, req, res)) return;
    db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id);
    res.json({success:true});
  });

  /** Check for a potential duplicate contact by phone or email */
  app.get('/api/contacts/check-dup', requireAuth, (req, res) => {
    const {phone, email} = req.query;
    const {clause, params} = ownerFilter(req,'c');
    let row = null;
    if (phone) row = db.prepare(`SELECT c.id,(c.first_name||' '||c.last_name) as name,comp.name as company_name FROM contacts c LEFT JOIN companies comp ON c.company_id=comp.id WHERE c.phone=?${clause} LIMIT 1`).get(phone, ...params);
    if (!row && email) row = db.prepare(`SELECT c.id,(c.first_name||' '||c.last_name) as name,comp.name as company_name FROM contacts c LEFT JOIN companies comp ON c.company_id=comp.id WHERE c.email=?${clause} LIMIT 1`).get(email, ...params);
    res.json({ duplicate: row || null });
  });

  /** Merge two contacts â€” deals and activities move to the kept contact */
  app.post('/api/merge/contacts', requireAuth, (req, res) => {
    if (!['manager','team_leader'].includes(req.user.role)) return res.status(403).json({error:'Forbidden'});
    const {keep_id, merge_id} = req.body;
    if (!keep_id || !merge_id || keep_id === merge_id) return res.status(400).json({error:'Invalid IDs'});
    db.transaction(() => {
      db.prepare('UPDATE deals      SET contact_id=? WHERE contact_id=?').run(keep_id, merge_id);
      db.prepare('UPDATE activities SET contact_id=? WHERE contact_id=?').run(keep_id, merge_id);
      db.prepare('DELETE FROM contacts WHERE id=?').run(merge_id);
    })();
    res.json({ success: true });
  });

  /** Import contacts from a CSV-parsed array (manager only) */
  app.post('/api/import/contacts', requireAuth, requireManager, (req, res) => {
    const rows = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({error:'Expected array'});
    let created = 0, skipped = 0, errors = [];
    for (const row of rows) {
      const first = String(row.first_name || '').trim();
      const last  = String(row.last_name  || '').trim();
      if (!first) { skipped++; continue; }
      try {
        let company_id = null;
        const cname = String(row.company_name || row.company || '').trim();
        if (cname) {
          const co = db.prepare('SELECT id FROM companies WHERE name=?').get(cname);
          if (co) company_id = co.id;
        }
        db.prepare(`INSERT INTO contacts (first_name,last_name,email,phone,title,company_id,lead_status,source,notes,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)`)
          .run(first, last, n(row.email), n(row.phone), n(row.title), n(company_id), n(row.lead_status), n(row.source), n(row.notes), req.user.id);
        created++;
      } catch(e) { errors.push({name:`${first} ${last}`.trim(), error:e.message}); skipped++; }
    }
    res.json({created, skipped, errors});
  });
}

module.exports = { register };
