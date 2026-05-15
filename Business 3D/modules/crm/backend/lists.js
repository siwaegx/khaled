'use strict';
/**
 * @file routes/lists.js
 * @description Dynamic dropdown list routes.
 * Read access for all authenticated users; write access for managers only.
 */

const { db } = require('../database/database');

/**
 * Register list routes on the app router.
 * @param {object} app - Route registration object
 * @param {object} _db - (unused)
 * @param {object} helpers - { requireAuth, requireManager, n }
 */
function register(app, _db, helpers) {
  const { requireAuth, requireManager, n } = helpers;

  /** Return all list items grouped by list_type */
  app.get('/api/lists', requireAuth, (req, res) => {
    const items = db.prepare('SELECT * FROM list_items ORDER BY list_type,order_index,value').all();
    const grouped = {};
    items.forEach(item => { if (!grouped[item.list_type]) grouped[item.list_type]=[]; grouped[item.list_type].push(item); });
    res.json(grouped);
  });

  /** Return items for a specific list type */
  app.get('/api/lists/:type', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM list_items WHERE list_type=? ORDER BY order_index,value').all(req.params.type));
  });

  /** Add a new item to a list type */
  app.post('/api/lists/:type', requireAuth, requireManager, (req, res) => {
    const {value, color} = req.body;
    if (!value||!value.trim()) return res.status(400).json({error:'Value is required'});
    const existing = db.prepare('SELECT id FROM list_items WHERE list_type=? AND value=?').get(req.params.type, value.trim());
    if (existing) return res.status(400).json({error:'Value already exists'});
    const max = db.prepare('SELECT MAX(order_index) as m FROM list_items WHERE list_type=?').get(req.params.type).m || 0;
    const r = db.prepare('INSERT INTO list_items (list_type,value,color,order_index) VALUES (?,?,?,?)').run(req.params.type, value.trim(), n(color), max+1);
    res.status(201).json(db.prepare('SELECT * FROM list_items WHERE id=?').get(r.lastInsertRowid));
  });

  /** Update a list item's value or color */
  app.put('/api/list-items/:id', requireAuth, requireManager, (req, res) => {
    const {value, color} = req.body;
    if (!value||!value.trim()) return res.status(400).json({error:'Value is required'});
    const item = db.prepare('SELECT * FROM list_items WHERE id=?').get(req.params.id);
    if (!item) return res.status(404).json({error:'Not found'});
    db.prepare('UPDATE list_items SET value=?,color=? WHERE id=?').run(value.trim(), n(color), req.params.id);
    res.json(db.prepare('SELECT * FROM list_items WHERE id=?').get(req.params.id));
  });

  /** Delete a list item */
  app.delete('/api/list-items/:id', requireAuth, requireManager, (req, res) => {
    const item = db.prepare('SELECT * FROM list_items WHERE id=?').get(req.params.id);
    if (!item) return res.status(404).json({error:'Not found'});
    db.prepare('DELETE FROM list_items WHERE id=?').run(req.params.id);
    res.json({success:true});
  });
}

module.exports = { register };
