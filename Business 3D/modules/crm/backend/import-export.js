'use strict';
/**
 * @file routes/import-export.js
 * @description CSV export, JSON backup/restore, and company+contact CSV import routes.
 */

const { db } = require('../database/database');

/**
 * Register import/export and backup/restore routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, requireManager, n }
 */
function register(app, _db, helpers) {
  const { requireAuth, requireManager, n } = helpers;

  /** Export all companies as a multi-column CSV with contact and activity data */
  app.get('/api/export/companies', requireAuth, requireManager, (req, res) => {
    // Wrap any value in double-quotes, escaping internal quotes
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

    // Format SQLite datetime string (YYYY-MM-DD HH:MM:SS) â†’ DD/MM/YYYY HH:MM
    const fmtDT = raw => {
      if (!raw) return '';
      const s = String(raw);
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (!m) return '';
      return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
    };
    const fmtD = raw => {
      if (!raw) return '';
      const s = String(raw);
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return '';
      return `${m[3]}/${m[2]}/${m[1]}`;
    };

    const companies = db.prepare(`
      SELECT c.id, c.custom_id, c.name, c.industry, c.city, c.address,
             c.status, c.folder, c.notes, u.name as owner_name
      FROM companies c LEFT JOIN users u ON c.user_id=u.id ORDER BY c.name
    `).all();

    // Fixed header row â€” 23 columns, NOT quoted (plain text header)
    const headerLine = 'ID,Company,Industry,Area,Status,con1,Ph1,pos1,con2,Ph2,pos2,con3,Ph3,pos3,Note,Activity,LOCATION,LST VISIT,LST CALL,DTVisit,Source,FOLDER,Owner';

    const rows = companies.map(co => {
      // Up to 3 contacts
      const cts = db.prepare(
        'SELECT first_name, last_name, title, phone, source FROM contacts WHERE company_id=? ORDER BY id LIMIT 3'
      ).all(co.id);

      // Activity log: one line per activity, oldest first
      const acts = db.prepare(
        'SELECT title, created_at FROM activities WHERE company_id=? ORDER BY created_at ASC'
      ).all(co.id);
      const actLog = acts.map(a => `${fmtDT(a.created_at)} - ${a.title}`).join('\n');

      // Last visit and last call dates
      const lstVisitRow = db.prepare(
        "SELECT due_date FROM activities WHERE company_id=? AND type='visit' ORDER BY due_date DESC LIMIT 1"
      ).get(co.id);
      const lstCallRow = db.prepare(
        "SELECT due_date FROM activities WHERE company_id=? AND type='call' ORDER BY due_date DESC LIMIT 1"
      ).get(co.id);

      const ct  = i => cts[i] || {};
      const nm  = i => { const c = ct(i); return c.first_name ? `${c.first_name} ${c.last_name || ''}`.trim() : ''; };

      // 23 columns exactly
      const cells = [
        q(co.custom_id),         // 1  ID
        q(co.name),              // 2  Company
        q(co.industry),          // 3  Industry
        q(co.city),              // 4  Area
        q(co.status),            // 5  Status
        q(nm(0)),                // 6  con1
        q(ct(0).phone  || ''),   // 7  Ph1
        q(ct(0).title  || ''),   // 8  pos1
        q(nm(1)),                // 9  con2
        q(ct(1).phone  || ''),   // 10 Ph2
        q(ct(1).title  || ''),   // 11 pos2
        q(nm(2)),                // 12 con3
        q(ct(2).phone  || ''),   // 13 Ph3
        q(ct(2).title  || ''),   // 14 pos3
        q(co.notes),             // 15 Note
        q(actLog),               // 16 Activity
        q(co.address),           // 17 LOCATION
        q(fmtD(lstVisitRow?.due_date)),  // 18 LST VISIT
        q(fmtD(lstCallRow?.due_date)),   // 19 LST CALL
        q(fmtD(lstVisitRow?.due_date)),  // 20 DTVisit (= last visit)
        q(ct(0).source || ''),   // 21 Source
        q(co.folder),            // 22 FOLDER
        q(co.owner_name),        // 23 Owner
      ];
      return cells.join(',');
    });

    const today = new Date().toISOString().slice(0, 10);
    const csv   = [headerLine, ...rows].join('\r\n');
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="companies-${today}.csv"`,
    });
    res.end('ï»¿' + csv); // BOM so Excel opens in UTF-8
  });

  /** Export contacts as CSV (for import-template compatibility) */
  app.get('/api/export/contacts', requireAuth, requireManager, (req, res) => {
    const rows = db.prepare(`SELECT c.*,comp.name as company_name,u.name as owner FROM contacts c LEFT JOIN companies comp ON c.company_id=comp.id LEFT JOIN users u ON c.user_id=u.id ORDER BY c.first_name`).all();
    const esc = v => `"${String(v??'').replace(/"/g,'""')}"`;
    const cols = ['id','first_name','last_name','title','company_name','lead_status','source','email','phone','notes','owner','created_at'];
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\r\n');
    res.writeHead(200, {'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="contacts.csv"'});
    res.end('ï»¿' + csv);
  });

  /** Bulk import companies (and their contacts) from a CSV-parsed array */
  app.post('/api/import', requireAuth, requireManager, (req, res) => {
    const rows = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({error:'Expected array'});
    let created = 0, skipped = 0, errors = [];

    // Build a nameâ†’id map of all users once (case-insensitive lookup)
    const usersByName = {};
    db.prepare('SELECT id, name FROM users').all().forEach(u => {
      usersByName[u.name.toLowerCase().trim()] = u.id;
    });

    const importOne = (row) => {
      // Support both new format (Company/Area/Note/LOCATION/Owner) and old format (name/city/notes/address)
      const name     = String(row.company || row.name || '').trim();
      const city     = row.area      || row.city     || '';
      const notes    = row.note      || row.notes    || '';
      const address  = row.location  || row.address  || '';
      const customId = row.id        || row.custom_id || '';
      const source   = row.source    || '';

      // Resolve owner by name (case-insensitive), fall back to importing manager
      const ownerName = String(row.owner || '').trim().toLowerCase();
      const ownerId   = (ownerName && usersByName[ownerName]) ? usersByName[ownerName] : req.user.id;

      db.exec('BEGIN');
      try {
        const r = db.prepare(
          `INSERT INTO companies (name,industry,city,address,country,status,category,folder,phone,email,website,notes,custom_id,user_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).run(name, n(row.industry), n(city), n(address),
              n(row.country), n(row.status), n(row.category),
              n(row.folder), n(row.phone), n(row.email),
              n(row.website), n(notes), n(customId), ownerId);
        const cid = r.lastInsertRowid;

        // Contacts from new format: con1/Ph1/pos1, con2/Ph2/pos2, con3/Ph3/pos3
        const newCts = [
          { name: row.con1||'', phone: row.ph1||'', title: row.pos1||'' },
          { name: row.con2||'', phone: row.ph2||'', title: row.pos2||'' },
          { name: row.con3||'', phone: row.ph3||'', title: row.pos3||'' },
        ].filter(c => c.name || c.phone);

        // Contacts from old format: contact_1_name, contact_1_phone, ...
        const oldCts = [];
        for (let i = 1; i <= 10; i++) {
          const cn = row[`contact_${i}_name`], cp = row[`contact_${i}_phone`];
          if (cn || cp) oldCts.push({ name: cn||'', phone: cp||'', title: row[`contact_${i}_title`]||'', source: row[`contact_${i}_source`]||'' });
        }

        const legacyCts = Array.isArray(row.contacts) ? row.contacts : [];

        for (const c of [...newCts, ...oldCts, ...legacyCts]) {
          if (!c.name && !c.phone) continue;
          const parts = String(c.name||'').trim().split(/\s+/);
          db.prepare(
            `INSERT INTO contacts (first_name,last_name,phone,title,company_id,lead_status,source,user_id) VALUES (?,?,?,?,?,?,?,?)`
          ).run(parts[0]||'?', parts.slice(1).join(' ')||'', n(c.phone), n(c.title),
                cid, n(row.status), n(c.source||source), ownerId);
        }

        if (row.activity_note) {
          db.prepare(`INSERT INTO activities (type,title,description,company_id,user_id) VALUES (?,?,?,?,?)`)
            .run('note', 'Import note', String(row.activity_note), cid, req.user.id);
        }
        db.exec('COMMIT');
      } catch(e) {
        db.exec('ROLLBACK');
        throw e;
      }
    };

    for (const row of rows) {
      const name = String(row.company || row.name || '').trim();
      if (!name) { skipped++; continue; }
      try { importOne(row); created++; }
      catch(e) { errors.push({name: row.company||row.name, error:e.message}); skipped++; }
    }
    res.json({created, skipped, errors});
  });

  /** Download a full JSON backup of companies, contacts, deals, and activities */
  app.get('/api/backup/companies', requireAuth, requireManager, (req, res) => {
    const companies  = db.prepare('SELECT * FROM companies  ORDER BY id').all();
    const contacts   = db.prepare('SELECT * FROM contacts   ORDER BY id').all();
    const deals      = db.prepare('SELECT * FROM deals      ORDER BY id').all();
    const activities = db.prepare('SELECT * FROM activities ORDER BY id').all();
    const date = new Date().toISOString().slice(0, 10);
    const payload = JSON.stringify({
      version: 2,
      exported_at: new Date().toISOString(),
      companies, contacts, deals, activities
    }, null, 2);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="crm-backup-${date}.json"`
    });
    res.end(payload);
  });

  /** Restore companies, contacts, deals, and activities from a JSON backup */
  app.post('/api/restore/companies', requireAuth, requireManager, (req, res) => {
    const { companies = [], contacts = [], deals = [], activities = [] } = req.body;
    if (!Array.isArray(companies)) return res.status(400).json({ error: 'Invalid backup format' });

    const restore = db.transaction(() => {
      const coMap  = {};  // old company_id  â†’ new
      const ctMap  = {};  // old contact_id  â†’ new
      const dealMap = {}; // old deal_id     â†’ new

      for (const co of companies) {
        if (!co.name || !String(co.name).trim()) continue;
        const r = db.prepare(`
          INSERT INTO companies (name,industry,website,phone,email,address,city,country,size,notes,category,status,custom_id,folder,user_id,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          String(co.name).trim(), n(co.industry), n(co.website), n(co.phone), n(co.email),
          n(co.address), n(co.city), n(co.country), n(co.size), n(co.notes),
          n(co.category), n(co.status), n(co.custom_id), n(co.folder),
          req.user.id, n(co.created_at), n(co.updated_at)
        );
        if (co.id) coMap[co.id] = r.lastInsertRowid;
      }

      for (const ct of contacts) {
        if (!ct.first_name) continue;
        const r = db.prepare(`
          INSERT INTO contacts (first_name,last_name,email,phone,title,company_id,status,source,notes,lead_status,user_id,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          ct.first_name, ct.last_name || '', n(ct.email), n(ct.phone), n(ct.title),
          n(ct.company_id ? (coMap[ct.company_id] || null) : null),
          ct.status || 'active', n(ct.source), n(ct.notes), n(ct.lead_status),
          req.user.id, n(ct.created_at), n(ct.updated_at)
        );
        if (ct.id) ctMap[ct.id] = r.lastInsertRowid;
      }

      for (const d of deals) {
        if (!d.title) continue;
        const r = db.prepare(`
          INSERT INTO deals (title,value,stage,probability,company_id,contact_id,close_date,notes,user_id,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          d.title, d.value || 0, d.stage || 'lead', d.probability || 0,
          n(d.company_id  ? (coMap[d.company_id]   || null) : null),
          n(d.contact_id  ? (ctMap[d.contact_id]   || null) : null),
          n(d.close_date), n(d.notes), req.user.id, n(d.created_at), n(d.updated_at)
        );
        if (d.id) dealMap[d.id] = r.lastInsertRowid;
      }

      for (const a of activities) {
        if (!a.title) continue;
        db.prepare(`
          INSERT INTO activities (type,title,description,due_date,completed,contact_id,company_id,deal_id,reminder_at,user_id,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          a.type || 'note', a.title, n(a.description), n(a.due_date), a.completed || 0,
          n(a.contact_id ? (ctMap[a.contact_id]   || null) : null),
          n(a.company_id ? (coMap[a.company_id]   || null) : null),
          n(a.deal_id    ? (dealMap[a.deal_id]    || null) : null),
          n(a.reminder_at), req.user.id, n(a.created_at), n(a.updated_at)
        );
      }

      return {
        companies:  Object.keys(coMap).length,
        contacts:   Object.keys(ctMap).length,
        deals:      Object.keys(dealMap).length,
        activities: activities.filter(a => a.title).length
      };
    });

    try {
      const counts = restore();
      res.json({ success: true, ...counts });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { register };
