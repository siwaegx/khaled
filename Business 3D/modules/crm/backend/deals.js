'use strict';
/**
 * @file routes/deals.js
 * @description Deal CRUD routes. Stage changes are automatically logged as activities.
 */

const { db }   = require('../database/database');
const fs       = require('fs');
const path     = require('path');

const DEALS_DIR  = path.join(__dirname, '..', 'deals');
const CATEGORIES = ['quotation', 'po', 'survey', 'drawing', 'other'];

// ── Minimal multipart/form-data parser (no external deps) ──────────────────

function bufIndexOf(buf, search, start = 0) {
  outer: for (let i = start; i <= buf.length - search.length; i++) {
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const ct  = req.headers['content-type'] || '';
    const bm  = ct.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
    if (!bm) return reject(new Error('No multipart boundary'));
    const boundary  = bm[1] || bm[2];
    const chunks    = [];
    req.on('data', c => chunks.push(c));
    req.on('error', reject);
    req.on('end', () => {
      try {
        const raw       = Buffer.concat(chunks);
        const fields    = {}, files = [];
        const sep       = Buffer.from('\r\n--' + boundary);
        const firstLine = Buffer.from('--' + boundary + '\r\n');
        let pos = bufIndexOf(raw, firstLine, 0);
        if (pos === -1) return resolve({ fields, files });
        pos += firstLine.length;
        while (pos < raw.length) {
          const hEnd = bufIndexOf(raw, Buffer.from('\r\n\r\n'), pos);
          if (hEnd === -1) break;
          const hStr      = raw.slice(pos, hEnd).toString();
          const dataStart = hEnd + 4;
          const nBound    = bufIndexOf(raw, sep, dataStart);
          const data      = raw.slice(dataStart, nBound === -1 ? raw.length : nBound);
          const headers   = {};
          for (const line of hStr.split('\r\n')) {
            const ci = line.indexOf(':');
            if (ci > -1) headers[line.slice(0, ci).toLowerCase().trim()] = line.slice(ci + 1).trim();
          }
          const disp  = headers['content-disposition'] || '';
          const nameM = disp.match(/\bname="([^"]+)"/);
          const fileM = disp.match(/\bfilename="([^"]*?)"/);
          const name  = nameM?.[1];
          if (fileM && name && fileM[1]) {
            files.push({ fieldname: name, originalname: fileM[1],
              mimetype: headers['content-type'] || 'application/octet-stream', buffer: data });
          } else if (name) {
            fields[name] = data.toString();
          }
          if (nBound === -1) break;
          pos = nBound + sep.length;
          if (raw.slice(pos, pos + 2).toString() === '--') break;
          pos += 2;
        }
        resolve({ fields, files });
      } catch (e) { reject(e); }
    });
  });
}

/**
 * Register deal routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, ownerFilter, checkOwnership, n }
 */
function register(app, _db, helpers) {
  const { requireAuth, ownerFilter, checkOwnership, n } = helpers;

  // ── GET /api/deals/:deal_id/files — list files grouped by category ──────────
  app.get('/api/deals/:deal_id/files', requireAuth, (req, res) => {
    const files   = db.prepare('SELECT * FROM deal_files WHERE deal_id=? ORDER BY uploaded_at DESC').all(req.params.deal_id);
    const grouped = Object.fromEntries(CATEGORIES.map(c => [c, []]));
    files.forEach(f => { if (grouped[f.category]) grouped[f.category].push(f); });
    res.json(grouped);
  });

  // ── POST /api/deals/:deal_id/files — upload one or more files ──────────────
  app.post('/api/deals/:deal_id/files', requireAuth, async (req, res) => {
    try {
      const { fields, files: uploads } = await parseMultipart(req);
      const category = CATEGORIES.includes(fields.category) ? fields.category : 'other';
      const dealDir  = path.join(DEALS_DIR, String(req.params.deal_id), category);
      fs.mkdirSync(dealDir, { recursive: true });
      const saved = [];
      for (const f of uploads) {
        const ext    = path.extname(f.originalname) || '';
        const stored = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        fs.writeFileSync(path.join(dealDir, stored), f.buffer);
        const r = db.prepare(
          'INSERT INTO deal_files (deal_id,category,original_name,stored_name) VALUES (?,?,?,?)'
        ).run(req.params.deal_id, category, f.originalname, stored);
        saved.push(db.prepare('SELECT * FROM deal_files WHERE id=?').get(r.lastInsertRowid));
      }
      res.status(201).json(saved);
    } catch (e) {
      console.error('Upload error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/deal-files/:file_id/content — serve file (inline or download) ─
  // Accepts token via Authorization header OR ?token= query param (needed for <a href> links)
  app.get('/api/deal-files/:file_id/content', (req, res) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /,'').trim() || (req.query.token || '');
    const sess  = token ? db.prepare(
      "SELECT u.id FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND s.expires_at>datetime('now')"
    ).get(token) : null;
    if (!sess) { res.writeHead(401); return res.end('Unauthorized'); }

    const file = db.prepare('SELECT * FROM deal_files WHERE id=?').get(req.params.file_id);
    if (!file) { res.writeHead(404); return res.end('Not found'); }
    const fp = path.join(DEALS_DIR, String(file.deal_id), file.category, file.stored_name);
    try {
      const content = fs.readFileSync(fp);
      const ext     = path.extname(file.original_name).toLowerCase();
      const MIMES   = {
        '.pdf':  'application/pdf',
        '.png':  'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif':  'image/gif', '.webp': 'image/webp',
        '.txt':  'text/plain', '.csv': 'text/csv',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls':  'application/vnd.ms-excel',
        '.doc':  'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      const mime = MIMES[ext] || 'application/octet-stream';
      const dl   = req.query.download === '1';
      res.writeHead(200, {
        'Content-Type':        mime,
        'Content-Disposition': `${dl ? 'attachment' : 'inline'}; filename="${encodeURIComponent(file.original_name)}"`,
        'Content-Length':      content.length,
        'Cache-Control':       'private, max-age=300',
      });
      res.end(content);
    } catch { res.writeHead(404); res.end('File not found on disk'); }
  });

  // ── DELETE /api/deal-files/:file_id — delete file from disk + DB ──────────
  app.delete('/api/deal-files/:file_id', requireAuth, (req, res) => {
    const file = db.prepare('SELECT * FROM deal_files WHERE id=?').get(req.params.file_id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    const fp = path.join(DEALS_DIR, String(file.deal_id), file.category, file.stored_name);
    try { fs.unlinkSync(fp); } catch (_) {}
    db.prepare('DELETE FROM deal_files WHERE id=?').run(req.params.file_id);
    res.json({ success: true });
  });

  /** List deals with optional search and stage filter */
  app.get('/api/deals', requireAuth, (req, res) => {
    const {search,stage} = req.query;
    const {clause, params} = ownerFilter(req,'d');
    let sql = `SELECT d.*,comp.name as company_name,(c.first_name||' '||c.last_name) as contact_name FROM deals d LEFT JOIN companies comp ON d.company_id=comp.id LEFT JOIN contacts c ON d.contact_id=c.id WHERE 1=1${clause}`;
    if (search) { sql+=` AND (d.title LIKE ? OR comp.name LIKE ?)`; params.push(`%${search}%`,`%${search}%`); }
    if (stage)  { sql+=` AND d.stage=?`; params.push(stage); }
    res.json(db.prepare(sql+' ORDER BY d.created_at DESC').all(...params));
  });

  /** Create a new deal */
  app.post('/api/deals', requireAuth, (req, res) => {
    const {title,company_id,contact_id,value,stage,probability,close_date,notes} = req.body;
    const r = db.prepare(`INSERT INTO deals (title,company_id,contact_id,value,stage,probability,close_date,notes,user_id) VALUES (?,?,?,?,?,?,?,?,?)`).run(title,n(company_id),n(contact_id),value||0,stage||'lead',probability||0,n(close_date),n(notes),req.user.id);
    res.status(201).json(db.prepare(`SELECT d.*,comp.name as company_name,(c.first_name||' '||c.last_name) as contact_name FROM deals d LEFT JOIN companies comp ON d.company_id=comp.id LEFT JOIN contacts c ON d.contact_id=c.id WHERE d.id=?`).get(r.lastInsertRowid));
  });

  /** Update a deal; logs a stage_change activity if the stage changes */
  app.put('/api/deals/:id', requireAuth, (req, res) => {
    if (!checkOwnership('deals', req.params.id, req, res)) return;
    const {title,company_id,contact_id,value,stage,probability,close_date,notes} = req.body;
    const old = db.prepare('SELECT stage,company_id,contact_id FROM deals WHERE id=?').get(req.params.id);
    db.prepare(`UPDATE deals SET title=?,company_id=?,contact_id=?,value=?,stage=?,probability=?,close_date=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(title,n(company_id),n(contact_id),value||0,stage,probability||0,n(close_date),n(notes),req.params.id);
    if (old && old.stage !== stage) {
      const labels = {lead:'Lead',qualified:'Qualified',proposal:'Proposal',negotiation:'Negotiation',won:'Won',lost:'Lost'};
      db.prepare(`INSERT INTO activities (type,title,description,deal_id,company_id,contact_id,user_id) VALUES (?,?,?,?,?,?,?)`)
        .run('stage_change',
          `Stage: ${labels[old.stage]||old.stage} â†’ ${labels[stage]||stage}`,
          `Deal "${String(title).trim()}" moved from ${old.stage} to ${stage}`,
          req.params.id, n(company_id ?? old.company_id), n(contact_id ?? old.contact_id), req.user.id);
    }
    res.json(db.prepare(`SELECT d.*,comp.name as company_name,(c.first_name||' '||c.last_name) as contact_name FROM deals d LEFT JOIN companies comp ON d.company_id=comp.id LEFT JOIN contacts c ON d.contact_id=c.id WHERE d.id=?`).get(req.params.id));
  });

  /** Delete a deal */
  app.delete('/api/deals/:id', requireAuth, (req, res) => {
    if (!checkOwnership('deals', req.params.id, req, res)) return;
    db.prepare('DELETE FROM deals WHERE id=?').run(req.params.id);
    res.json({success:true});
  });
}

module.exports = { register };
