'use strict';
/**
 * @file routes/companies.js
 * @description Company CRUD, assignment, duplicate check, and merge routes.
 */

const { db } = require('../database/database');

/**
 * Register company routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, ownerFilter, checkOwnership, getTeamIds, n }
 */
function register(app, _db, helpers) {
  const { requireAuth, ownerFilter, checkOwnership, getTeamIds, n } = helpers;

  /** List companies with optional search, including contact/deal counts */
  app.get('/api/companies', requireAuth, (req, res) => {
    const {search} = req.query;
    const {clause, params} = ownerFilter(req,'c');
    let sql = `SELECT c.*,u.name as owner_name,
      (SELECT COUNT(*) FROM contacts WHERE company_id=c.id) as contact_count,
      (SELECT COUNT(*) FROM deals WHERE company_id=c.id) as deal_count,
      (SELECT COALESCE(SUM(value),0) FROM deals WHERE company_id=c.id AND stage NOT IN ('won','lost')) as pipeline_value
      FROM companies c LEFT JOIN users u ON c.user_id=u.id WHERE 1=1${clause}`;
    if (search) { sql+=` AND (c.name LIKE ? OR c.industry LIKE ? OR c.city LIKE ?)`; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
    res.json(db.prepare(sql+' ORDER BY c.name').all(...params));
  });

  /** Assign a company to a different owner (manager/team leader only) */
  app.post('/api/companies/:id/assign', requireAuth, (req, res) => {
    if (!['manager','team_leader'].includes(req.user.role)) return res.status(403).json({error:'Forbidden'});
    const {user_id} = req.body;
    const co = db.prepare('SELECT id,name,user_id FROM companies WHERE id=?').get(req.params.id);
    if (!co) return res.status(404).json({error:'Not found'});

    // Team leader can only assign to their own sales users
    if (req.user.role === 'team_leader' && user_id) {
      const teamIds = getTeamIds(req.user.id);
      if (!teamIds.includes(parseInt(user_id))) return res.status(403).json({error:'Can only assign to your own team members'});
    }

    const newUserId = user_id ? parseInt(user_id) : null;
    db.prepare('UPDATE companies SET user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(n(newUserId), req.params.id);

    // Log activity on the company
    const assignee = newUserId ? db.prepare('SELECT name FROM users WHERE id=?').get(newUserId) : null;
    const actTitle = assignee
      ? `Company assigned to ${assignee.name}`
      : 'Company unassigned';
    const actBody = assignee
      ? `${co.name} was assigned to ${assignee.name} by ${req.user.name}`
      : `${co.name} was unassigned by ${req.user.name}`;
    db.prepare(`INSERT INTO activities (type,title,description,company_id,user_id) VALUES (?,?,?,?,?)`)
      .run('note', actTitle, actBody, co.id, req.user.id);

    // Notify the new assignee (if it's a sales user, not self)
    if (newUserId && newUserId !== req.user.id) {
      db.prepare(`INSERT INTO notifications (user_id,type,title,body,link_type,link_id) VALUES (?,?,?,?,?,?)`)
        .run(newUserId, 'company_assigned',
          `Company assigned to you`,
          `${co.name} was assigned to you by ${req.user.name}`,
          'company', co.id);
    }

    res.json({success:true});
  });

  /** Get a single company with its related contacts, deals, activities, and team tasks */
  app.get('/api/companies/:id', requireAuth, (req, res) => {
    if (!checkOwnership('companies', req.params.id, req, res)) return;
    const company = db.prepare('SELECT * FROM companies WHERE id=?').get(req.params.id);
    if (!company) return res.status(404).json({error:'Not found'});
    const contacts = db.prepare(`SELECT c.*,u.name as owner_name FROM contacts c LEFT JOIN users u ON c.user_id=u.id WHERE c.company_id=? ORDER BY c.first_name`).all(req.params.id);
    const deals = db.prepare(`SELECT d.*,u.name as owner_name FROM deals d LEFT JOIN users u ON d.user_id=u.id WHERE d.company_id=? ORDER BY d.created_at DESC`).all(req.params.id);
    // Activities on the company OR on any of its contacts
    const activities = db.prepare(`
      SELECT a.*,u.name as user_name,(c.first_name||' '||c.last_name) as contact_name
      FROM activities a
      LEFT JOIN users u ON a.user_id=u.id
      LEFT JOIN contacts c ON a.contact_id=c.id
      WHERE a.company_id=?
         OR (a.contact_id IN (SELECT id FROM contacts WHERE company_id=?))
      ORDER BY a.created_at DESC`).all(req.params.id, req.params.id);
    // Tasks assigned to team members for this company
    const teamTasks = db.prepare(`
      SELECT a.*,u.name as user_name,au.name as assigned_to_name,
        (c.first_name||' '||c.last_name) as contact_name
      FROM activities a
      LEFT JOIN users u ON a.user_id=u.id
      LEFT JOIN users au ON a.assigned_to=au.id
      LEFT JOIN contacts c ON a.contact_id=c.id
      WHERE a.type='task' AND a.company_id=? AND a.assigned_to IS NOT NULL
      ORDER BY a.completed ASC, a.due_date ASC, a.created_at DESC`).all(req.params.id);
    res.json({...company, contacts, deals, activities, teamTasks});
  });

  /** Create a new company */
  app.post('/api/companies', requireAuth, (req, res) => {
    const {name,industry,website,phone,email,address,city,country,size,notes,category,status,custom_id,folder} = req.body;
    const r = db.prepare(`INSERT INTO companies (name,industry,website,phone,email,address,city,country,size,notes,category,status,custom_id,folder,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(name,n(industry),n(website),n(phone),n(email),n(address),n(city),n(country),n(size),n(notes),n(category),n(status),n(custom_id),n(folder),req.user.id);
    res.status(201).json(db.prepare('SELECT * FROM companies WHERE id=?').get(r.lastInsertRowid));
  });

  /** Update a company */
  app.put('/api/companies/:id', requireAuth, (req, res) => {
    if (!checkOwnership('companies', req.params.id, req, res)) return;
    const {name,industry,website,phone,email,address,city,country,size,notes,category,status,custom_id,folder} = req.body;
    db.prepare(`UPDATE companies SET name=?,industry=?,website=?,phone=?,email=?,address=?,city=?,country=?,size=?,notes=?,category=?,status=?,custom_id=?,folder=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(name,n(industry),n(website),n(phone),n(email),n(address),n(city),n(country),n(size),n(notes),n(category),n(status),n(custom_id),n(folder),req.params.id);
    res.json(db.prepare('SELECT * FROM companies WHERE id=?').get(req.params.id));
  });

  /** Delete a company */
  app.delete('/api/companies/:id', requireAuth, (req, res) => {
    if (!checkOwnership('companies', req.params.id, req, res)) return;
    db.prepare('DELETE FROM companies WHERE id=?').run(req.params.id);
    res.json({success:true});
  });

  /** Check for a potential duplicate company by name or phone */
  app.get('/api/companies/check-dup', requireAuth, (req, res) => {
    const {name, phone} = req.query;
    const {clause, params} = ownerFilter(req,'c');
    let row = null;
    if (name) row = db.prepare(`SELECT id,name,city FROM companies c WHERE LOWER(c.name) LIKE LOWER(?)${clause} LIMIT 1`).get(`%${name}%`, ...params);
    if (!row && phone) row = db.prepare(`SELECT id,name,city FROM companies c WHERE c.phone=?${clause} LIMIT 1`).get(phone, ...params);
    res.json({ duplicate: row || null });
  });

  /** Merge two companies â€” all related records move to the kept company */
  app.post('/api/merge/companies', requireAuth, (req, res) => {
    if (!['manager','team_leader'].includes(req.user.role)) return res.status(403).json({error:'Forbidden'});
    const {keep_id, merge_id} = req.body;
    if (!keep_id || !merge_id || keep_id === merge_id) return res.status(400).json({error:'Invalid IDs'});
    db.transaction(() => {
      db.prepare('UPDATE contacts   SET company_id=? WHERE company_id=?').run(keep_id, merge_id);
      db.prepare('UPDATE deals      SET company_id=? WHERE company_id=?').run(keep_id, merge_id);
      db.prepare('UPDATE activities SET company_id=? WHERE company_id=?').run(keep_id, merge_id);
      db.prepare('DELETE FROM companies WHERE id=?').run(merge_id);
    })();
    res.json({ success: true });
  });
}

module.exports = { register };
