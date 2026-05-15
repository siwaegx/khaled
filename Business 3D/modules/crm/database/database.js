'use strict';
/**
 * @file database.js
 * @description DatabaseSync setup, schema initialization, migrations, and seed data.
 * Uses node:sqlite (built-in, no native compilation needed).
 */

const path = require('path');
const { DatabaseSync } = require('node:sqlite');

/** Open the SQLite database in WAL mode with foreign keys enabled */
const db = new DatabaseSync(path.join(__dirname, 'crm.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/** Create all base tables if they don't already exist */
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      industry TEXT,
      website TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      country TEXT,
      size TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      title TEXT,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'active',
      source TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      value REAL DEFAULT 0,
      stage TEXT DEFAULT 'lead',
      probability INTEGER DEFAULT 0,
      close_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date DATETIME,
      completed INTEGER DEFAULT 0,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('manager','sales')),
      pin TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );
    CREATE TABLE IF NOT EXISTS list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_type TEXT NOT NULL,
      value TEXT NOT NULL,
      color TEXT,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/** Run incremental schema migrations — safe to call on every startup */
function migrateDatabase() {
  const addCol = (table, col, def) => {
    try { db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`).run(); }
    catch (e) { if (!e.message.includes('duplicate column name')) throw e; }
  };
  ['companies','contacts','deals','activities'].forEach(t => addCol(t, 'user_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL'));
  addCol('companies', 'category', 'TEXT');
  addCol('companies', 'status', 'TEXT');
  addCol('companies', 'custom_id', 'TEXT');
  addCol('companies', 'folder', 'TEXT');
  addCol('contacts', 'lead_status', 'TEXT');
  addCol('users', 'email', 'TEXT');
  addCol('users', 'phone', 'TEXT');
  addCol('activities', 'reminder_at', 'DATETIME');
  addCol('activities', 'notified', 'INTEGER DEFAULT 0');
  addCol('activities', 'assigned_to', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
  addCol('users', 'team_leader_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');

  db.exec(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link_type TEXT,
    link_id INTEGER,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    target_revenue REAL DEFAULT 0,
    target_deals INTEGER DEFAULT 0,
    target_activities INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, month)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS custom_field_defs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT DEFAULT 'text',
    options TEXT,
    order_index INTEGER DEFAULT 0
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS custom_field_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    field_def_id INTEGER NOT NULL REFERENCES custom_field_defs(id) ON DELETE CASCADE,
    value TEXT,
    UNIQUE(entity_type, entity_id, field_def_id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS deal_files (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id       INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    category      TEXT NOT NULL DEFAULT 'other',
    original_name TEXT NOT NULL,
    stored_name   TEXT NOT NULL,
    uploaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS products (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    description    TEXT,
    category       TEXT,
    unit           TEXT,
    part_number    TEXT,
    size           TEXT,
    brand          TEXT,
    origin         TEXT,
    supplier       TEXT,
    function_text  TEXT,
    function_arabic TEXT,
    last_updated_price TEXT,
    dtu            TEXT,
    last_modifier  TEXT,
    cost_price     REAL DEFAULT 0,
    selling_price  REAL DEFAULT 0,
    stock_quantity REAL DEFAULT 0,
    min_stock      REAL DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS inventory_categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS product_price_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_price   REAL,
    new_price   REAL NOT NULL,
    changed_by  TEXT,
    changed_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  [
    ['part_number', 'TEXT'],
    ['size', 'TEXT'],
    ['brand', 'TEXT'],
    ['origin', 'TEXT'],
    ['supplier', 'TEXT'],
    ['function_text', 'TEXT'],
    ['function_arabic', 'TEXT'],
    ['last_updated_price', 'TEXT'],
    ['dtu', 'TEXT'],
    ['last_modifier', 'TEXT'],
  ].forEach(([col, def]) => addCol('products', col, def));

  // Seed defaults (INSERT OR IGNORE so existing values are kept)
  db.prepare(`INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)`).run('currency', 'EGP');
  db.prepare(`INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)`).run('currency_symbol', 'EGP');

  // Widen role CHECK to include 'team_leader' (original only had 'manager','sales')
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (schema?.sql?.includes("'manager','sales'")) {
    db.exec(`
      PRAGMA foreign_keys=OFF;
      CREATE TABLE users_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        pin TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        team_leader_id INTEGER REFERENCES users_v2(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users_v2 (id,name,role,pin,email,phone,created_at)
        SELECT id,name,role,pin,email,phone,created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_v2 RENAME TO users;
      PRAGMA foreign_keys=ON;
    `);
  }
}

/** Seed default manager account and assign orphan records */
function seedData() {
  const mgr = db.prepare("SELECT id FROM users WHERE role='manager' LIMIT 1").get();
  if (!mgr) db.prepare("INSERT INTO users (name,role,pin) VALUES (?,?,?)").run('Manager','manager','1996');
  const manager = mgr || db.prepare("SELECT id FROM users WHERE role='manager' LIMIT 1").get();
  ['companies','contacts','deals','activities'].forEach(t => {
    db.prepare(`UPDATE ${t} SET user_id=? WHERE user_id IS NULL`).run(manager.id);
  });
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

/** Seed dropdown list items with Egyptian-market defaults (only if table is empty) */
function seedLists() {
  const count = db.prepare("SELECT COUNT(*) as c FROM list_items").get().c;
  if (count > 0) return;
  const ins = db.prepare("INSERT INTO list_items (list_type,value,order_index) VALUES (?,?,?)");
  const s = (type, items) => items.forEach((v,i) => ins.run(type,v,i));
  s('city',['10th of Ramadan City','Ain Sokhna','6th of October City','Borg El Arab','Tanta','Beni Suef','Hurghada','Badr City','Suez SCZone','Elsadat','Amreya','Mansoura','Minya','Sharm El Sheikh','Obour City','East Port Said','Abo Rawash','Dekheila','Damietta','Assiut','Sinai (general)','New Cairo','Cairo','Alexandria City','Kafr El Sheikh','Sohag','Red Sea','Ismailia','Sharqia','Helwan']);
  s('industry',['F&B','Textile','Chemicals & Petrochemicals','Hotels & Resorts','Drinking water treatment plants','Farms & Greenhouses','Water','Cosmetics','Paper & Pulp','Fertilizers','Malls','Wastewater treatment plants','Landscape Irrigation','Waste water','Batteries','Mining & Primary Metals','Office Buildings','Irrigation water systems','Golf Courses','Contractors','Oil & Gas','Residential Compounds','Desalination plants','HIGH END AGRI','Architecture','LABS','Power Plants','Pharmaceuticals','Pools','Tires','Hospitals','B2C Villas','FMCGs']);
  s('contact_title',['Owner','General MNG','Maintenance MNG','Purchasing MNG','Engineer','Utility Engineer','Electrical Engineer','Water Engineer','CEO','Director']);
  s('lead_status',['Fresh Lead','Cold','Hot','Need Visit','Not Interested','VIP','RFQ','Done Sales','Registered']);
  s('source',['Visits','DALEL','Connections','LinkedIn','Facebook','Exhibition','Cold Data','Referral']);
  s('category',['WT','WWT','CHEM','SPARE','INSTRUMENT','CONTROL','GENERAL']);
  s('company_status',['Fresh Lead','Cold','Hot','Need Visit','Not Interested','VIP','RFQ','Done Sales','Registered','Customer']);
}

module.exports = { db, initDatabase, migrateDatabase, seedData, seedLists };
