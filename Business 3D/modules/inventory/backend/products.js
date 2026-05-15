'use strict';

const { db } = require('../../crm/database/database');

const PRODUCT_COLUMNS = `
  id, name, description, category, unit, part_number, size, brand, origin,
  supplier, function_text, function_arabic, last_updated_price, dtu,
  last_modifier, cost_price, selling_price, stock_quantity, min_stock,
  sheet_id, created_at
`;

const IMPORT_HEADERS = [
  'Catogry', 'ITEM', 'PN', 'SIZE', 'Brand', 'made Origan', 'Price', 'SUPPLIER',
  'Description', 'Function', 'Function Arabic', 'last updated price', 'DTU',
  'last modifier',
];

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function pick(body, names) {
  for (const name of names) {
    if (body[name] !== undefined && body[name] !== null && String(body[name]).trim() !== '') {
      return body[name];
    }
  }
  return '';
}

function cleanProduct(body, helpers) {
  const n = helpers.n;
  const price = pick(body, ['selling_price', 'price', 'Price']);
  return {
    name: String(pick(body, ['name', 'item', 'ITEM']) || '').trim(),
    description: n(pick(body, ['description', 'Description'])),
    category: n(pick(body, ['category', 'Catogry', 'Category'])),
    unit: n(pick(body, ['unit', 'Unit'])),
    part_number: n(pick(body, ['part_number', 'pn', 'PN'])),
    size: n(pick(body, ['size', 'SIZE'])),
    brand: n(pick(body, ['brand', 'Brand'])),
    origin: n(pick(body, ['origin', 'made_origan', 'made Origan', 'made Origin'])),
    supplier: n(pick(body, ['supplier', 'SUPPLIER'])),
    function_text: n(pick(body, ['function_text', 'function', 'Function'])),
    function_arabic: n(pick(body, ['function_arabic', 'Function Arabic'])),
    last_updated_price: n(pick(body, ['last_updated_price', 'last updated price'])),
    dtu: n(pick(body, ['dtu', 'DTU'])),
    last_modifier: n(pick(body, ['last_modifier', 'last modifier'])),
    cost_price: toNumber(body.cost_price),
    selling_price: toNumber(price),
    stock_quantity: toNumber(body.stock_quantity),
    min_stock: toNumber(body.min_stock),
  };
}

function requireProductName(product, res) {
  if (product.name) return true;
  res.status(400).json({ error: 'Product name is required' });
  return false;
}

function getProduct(id) {
  return db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id=?`).get(id);
}

function normalizeCategory(value) {
  return String(value || '').trim();
}

function ensureCategory(value) {
  const category = normalizeCategory(value);
  if (!category) return;
  db.prepare('INSERT OR IGNORE INTO inventory_categories (name) VALUES (?)').run(category);
}

function syncExistingProductCategories() {
  db.prepare(`
    INSERT OR IGNORE INTO inventory_categories (name)
    SELECT DISTINCT TRIM(category)
    FROM products
    WHERE category IS NOT NULL AND TRIM(category) <> ''
  `).run();
}

function listCategories() {
  syncExistingProductCategories();
  return db.prepare(`
    SELECT c.id, c.name, c.created_at, COUNT(p.id) as product_count
    FROM inventory_categories c
    LEFT JOIN products p ON TRIM(p.category)=c.name
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE
  `).all();
}

function recordPriceHistory(productId, oldPrice, newPrice, changedBy) {
  db.prepare(`
    INSERT INTO product_price_history (product_id, old_price, new_price, changed_by)
    VALUES (?, ?, ?, ?)
  `).run(productId, oldPrice, newPrice, changedBy || null);
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function productToSheetRow(p) {
  return [
    p.category,
    p.name,
    p.part_number,
    p.size,
    p.brand,
    p.origin,
    p.selling_price,
    p.supplier,
    p.description,
    p.function_text,
    p.function_arabic,
    p.last_updated_price,
    p.dtu,
    p.last_modifier,
  ];
}

function register(app, _db, helpers) {
  const { requireAuth } = helpers;

  // Create tables if not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      change REAL NOT NULL,
      action TEXT NOT NULL DEFAULT 'adjust',
      user TEXT,
      note TEXT,
      date TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS inventory_sheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filters_json TEXT NOT NULL DEFAULT '{}',
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // Migrate: add sheet_id to products if missing
  try { db.exec('ALTER TABLE products ADD COLUMN sheet_id INTEGER'); } catch (_) {}

  // ── Products CRUD ─────────────────────────────────────────────────────────

  app.post('/erp/inventory/products', requireAuth, (req, res) => {
    const p = cleanProduct(req.body, helpers);
    if (!requireProductName(p, res)) return;
    ensureCategory(p.category);
    const sheetId = req.body.sheet_id != null && req.body.sheet_id !== '' ? Number(req.body.sheet_id) || null : null;

    const r = db.prepare(`
      INSERT INTO products
        (name, description, category, unit, part_number, size, brand, origin,
         supplier, function_text, function_arabic, last_updated_price, dtu,
         last_modifier, cost_price, selling_price, stock_quantity, min_stock, sheet_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      p.name, p.description, p.category, p.unit, p.part_number, p.size,
      p.brand, p.origin, p.supplier, p.function_text, p.function_arabic,
      p.last_updated_price, p.dtu, p.last_modifier, p.cost_price,
      p.selling_price, p.stock_quantity, p.min_stock, sheetId
    );
    if (p.selling_price) recordPriceHistory(r.lastInsertRowid, null, p.selling_price, req.user?.name);

    res.status(201).json(getProduct(r.lastInsertRowid));
  });

  app.get('/erp/inventory/products', requireAuth, (req, res) => {
    const { sheetId } = req.query;
    if (sheetId && sheetId !== 'null') {
      return res.json(db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE sheet_id=? ORDER BY name COLLATE NOCASE`).all(Number(sheetId)));
    }
    res.json(db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY name COLLATE NOCASE`).all());
  });

  app.put('/erp/inventory/products/:id', requireAuth, (req, res) => {
    const existing = getProduct(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const p = cleanProduct(req.body, helpers);
    if (!requireProductName(p, res)) return;
    ensureCategory(p.category);

    db.prepare(`
      UPDATE products
      SET name=?, description=?, category=?, unit=?, part_number=?, size=?,
          brand=?, origin=?, supplier=?, function_text=?, function_arabic=?,
          last_updated_price=?, dtu=?, last_modifier=?, cost_price=?,
          selling_price=?, stock_quantity=?, min_stock=?
      WHERE id=?
    `).run(
      p.name, p.description, p.category, p.unit, p.part_number, p.size,
      p.brand, p.origin, p.supplier, p.function_text, p.function_arabic,
      p.last_updated_price, p.dtu, p.last_modifier, p.cost_price,
      p.selling_price, p.stock_quantity, p.min_stock,
      req.params.id
    );
    if (Number(existing.selling_price || 0) !== Number(p.selling_price || 0)) {
      recordPriceHistory(req.params.id, existing.selling_price, p.selling_price, req.user?.name);
    }

    res.json(getProduct(req.params.id));
  });

  app.delete('/erp/inventory/products/:id', requireAuth, (req, res) => {
    const r = db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  });

  // ── Stock update (records history) ────────────────────────────────────────

  app.post('/erp/inventory/stock/update', requireAuth, (req, res) => {
    const productId = Number(req.body.product_id);
    const quantityChange = Number(req.body.quantity_change);
    const note = String(req.body.note || '').trim() || null;

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Valid product_id is required' });
    }
    if (!Number.isFinite(quantityChange) || quantityChange === 0) {
      return res.status(400).json({ error: 'quantity_change must be a non-zero number' });
    }

    const existing = getProduct(productId);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const nextStock = Number(existing.stock_quantity || 0) + quantityChange;
    if (nextStock < 0) return res.status(400).json({ error: 'Stock cannot go below zero' });

    db.prepare('UPDATE products SET stock_quantity=? WHERE id=?').run(nextStock, productId);

    db.prepare('INSERT INTO stock_history (product_id, change, action, user, note) VALUES (?, ?, ?, ?, ?)').run(
      productId, quantityChange, quantityChange > 0 ? 'add' : 'remove', req.user?.name || null, note
    );

    res.json(getProduct(productId));
  });

  // ── Stock history ──────────────────────────────────────────────────────────

  app.get('/erp/inventory/products/:id/stock-history', requireAuth, (req, res) => {
    const product = getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const rows = db.prepare(`
      SELECT id, product_id, change, action, user, note, date
      FROM stock_history
      WHERE product_id=?
      ORDER BY date DESC, id DESC
      LIMIT 100
    `).all(req.params.id);
    res.json(rows);
  });

  // ── Bulk operations ────────────────────────────────────────────────────────

  app.post('/erp/inventory/products/bulk-delete', requireAuth, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
    if (!ids.length) return res.status(400).json({ error: 'No ids provided' });
    const placeholders = ids.map(() => '?').join(',');
    const r = db.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).run(...ids);
    res.json({ deleted: r.changes });
  });

  app.post('/erp/inventory/products/bulk-category', requireAuth, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
    const category = String(req.body?.category || '').trim();
    if (!ids.length) return res.status(400).json({ error: 'No ids provided' });
    if (!category) return res.status(400).json({ error: 'Category is required' });
    ensureCategory(category);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE products SET category=? WHERE id IN (${placeholders})`).run(category, ...ids);
    res.json({ updated: ids.length });
  });

  app.post('/erp/inventory/products/bulk-price', requireAuth, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
    const price = toNumber(req.body?.price);
    if (!ids.length) return res.status(400).json({ error: 'No ids provided' });
    const placeholders = ids.map(() => '?').join(',');
    const products = db.prepare(`SELECT id, selling_price FROM products WHERE id IN (${placeholders})`).all(...ids);
    db.prepare(`UPDATE products SET selling_price=? WHERE id IN (${placeholders})`).run(price, ...ids);
    products.forEach(p => {
      if (Number(p.selling_price || 0) !== price) {
        recordPriceHistory(p.id, p.selling_price, price, req.user?.name);
      }
    });
    res.json({ updated: ids.length });
  });

  app.post('/erp/inventory/products/export-selected', requireAuth, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
    if (!ids.length) return res.status(400).json({ error: 'No ids provided' });
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id IN (${placeholders}) ORDER BY category COLLATE NOCASE, name COLLATE NOCASE`).all(...ids);
    const csv = [
      IMPORT_HEADERS.map(csvCell).join(','),
      ...rows.map(p => productToSheetRow(p).map(csvCell).join(',')),
    ].join('\r\n');
    const today = new Date().toISOString().slice(0, 10);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inventory-selected-${today}.csv"`,
    });
    res.end('﻿' + csv);
  });

  // ── Alerts ─────────────────────────────────────────────────────────────────

  app.get('/erp/inventory/alerts', requireAuth, (_req, res) => {
    const rows = db.prepare(`
      SELECT ${PRODUCT_COLUMNS}
      FROM products
      WHERE stock_quantity < min_stock
      ORDER BY (min_stock - stock_quantity) DESC, name COLLATE NOCASE
    `).all();
    res.json(rows);
  });

  // ── Export all ─────────────────────────────────────────────────────────────

  app.get('/erp/inventory/products/export', requireAuth, (_req, res) => {
    const rows = db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY category COLLATE NOCASE, name COLLATE NOCASE`).all();
    const csv = [
      IMPORT_HEADERS.map(csvCell).join(','),
      ...rows.map(p => productToSheetRow(p).map(csvCell).join(',')),
    ].join('\r\n');
    const today = new Date().toISOString().slice(0, 10);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inventory-products-${today}.csv"`,
    });
    res.end('﻿' + csv);
  });

  // ── Categories ─────────────────────────────────────────────────────────────

  app.get('/erp/inventory/categories', requireAuth, (_req, res) => {
    res.json(listCategories());
  });

  app.post('/erp/inventory/categories', requireAuth, (req, res) => {
    const name = normalizeCategory(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    ensureCategory(name);
    res.status(201).json(db.prepare('SELECT * FROM inventory_categories WHERE name=?').get(name));
  });

  app.delete('/erp/inventory/categories/:id', requireAuth, (req, res) => {
    const category = db.prepare('SELECT * FROM inventory_categories WHERE id=?').get(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    const used = db.prepare('SELECT COUNT(*) as c FROM products WHERE TRIM(category)=?').get(category.name).c;
    if (used > 0) return res.status(400).json({ error: 'Category is used by products' });
    db.prepare('DELETE FROM inventory_categories WHERE id=?').run(req.params.id);
    res.json({ success: true });
  });

  // ── Price history ──────────────────────────────────────────────────────────

  app.get('/erp/inventory/products/:id/price-history', requireAuth, (req, res) => {
    const product = getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const rows = db.prepare(`
      SELECT id, product_id, old_price, new_price, changed_by, changed_at
      FROM product_price_history
      WHERE product_id=?
      ORDER BY changed_at DESC, id DESC
    `).all(req.params.id);
    res.json(rows);
  });

  // ── Import ─────────────────────────────────────────────────────────────────

  app.post('/erp/inventory/products/import', requireAuth, (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : Array.isArray(req.body) ? req.body : null;
    const mode = req.body?.mode === 'replace' ? 'replace' : 'append';
    const sheetId = req.body?.sheetId != null && req.body.sheetId !== '' ? Number(req.body.sheetId) || null : null;
    if (!rows) return res.status(400).json({ error: 'Expected rows array' });

    let created = 0;
    let skipped = 0;
    const errors = [];

    db.exec('BEGIN');
    try {
      if (mode === 'replace') {
        if (sheetId) {
          db.prepare('DELETE FROM products WHERE sheet_id=?').run(sheetId);
        } else {
          db.prepare('DELETE FROM products').run();
        }
      }

      const insert = db.prepare(`
        INSERT INTO products
          (name, description, category, unit, part_number, size, brand, origin,
           supplier, function_text, function_arabic, last_updated_price, dtu,
           last_modifier, cost_price, selling_price, stock_quantity, min_stock, sheet_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      rows.forEach((row, index) => {
        const p = cleanProduct(row, helpers);
        if (!p.name && !p.part_number && !p.category) {
          skipped++;
          return;
        }
        if (!p.name) {
          errors.push({ row: index + 1, error: 'Missing ITEM/name' });
          skipped++;
          return;
        }
        insert.run(
          p.name, p.description, p.category, p.unit, p.part_number, p.size,
          p.brand, p.origin, p.supplier, p.function_text, p.function_arabic,
          p.last_updated_price, p.dtu, p.last_modifier, p.cost_price,
          p.selling_price, p.stock_quantity, p.min_stock, sheetId
        );
        ensureCategory(p.category);
        created++;
      });

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    res.json({ created, skipped, errors });
  });

  // ── Sheets ─────────────────────────────────────────────────────────────────

  app.get('/erp/inventory/sheets', requireAuth, (_req, res) => {
    res.json(db.prepare('SELECT * FROM inventory_sheets ORDER BY order_index, id').all());
  });

  app.post('/erp/inventory/sheets', requireAuth, (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Sheet name is required' });
    const filters = JSON.stringify(req.body?.filters || {});
    const orderIndex = Number(req.body?.order_index ?? 0);
    const r = db.prepare('INSERT INTO inventory_sheets (name, filters_json, order_index) VALUES (?, ?, ?)').run(name, filters, orderIndex);
    res.status(201).json(db.prepare('SELECT * FROM inventory_sheets WHERE id=?').get(r.lastInsertRowid));
  });

  app.put('/erp/inventory/sheets/:id', requireAuth, (req, res) => {
    const sheet = db.prepare('SELECT * FROM inventory_sheets WHERE id=?').get(req.params.id);
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    const name = String(req.body?.name ?? sheet.name).trim() || sheet.name;
    const filters = req.body?.filters !== undefined ? JSON.stringify(req.body.filters) : sheet.filters_json;
    db.prepare('UPDATE inventory_sheets SET name=?, filters_json=? WHERE id=?').run(name, filters, req.params.id);
    res.json(db.prepare('SELECT * FROM inventory_sheets WHERE id=?').get(req.params.id));
  });

  app.delete('/erp/inventory/sheets/:id', requireAuth, (req, res) => {
    const sheet = db.prepare('SELECT * FROM inventory_sheets WHERE id=?').get(req.params.id);
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    // Move this sheet's products back to All Products
    db.prepare('UPDATE products SET sheet_id=NULL WHERE sheet_id=?').run(req.params.id);
    db.prepare('DELETE FROM inventory_sheets WHERE id=?').run(req.params.id);
    res.json({ success: true });
  });
}

module.exports = { register };
