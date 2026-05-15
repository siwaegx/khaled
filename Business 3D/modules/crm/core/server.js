'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const { initDatabase, migrateDatabase, seedData, seedLists } = require('../database/database');
const { app, routeTable } = require('./app');
const { loadRoutes } = require('./routeLoader');
const { startReminderInterval } = require('../backend/email');

// ==================== DATABASE INIT ====================

initDatabase();
migrateDatabase();
seedData();
seedLists();

// ==================== ROUTE REGISTRATION ====================

loadRoutes(app);

// ==================== HTTP LAYER ====================

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

const CRM_FRONTEND    = path.join(__dirname, '..', 'frontend');
const ERP_FRONTEND    = path.join(__dirname, '..', '..');
const GLOBAL_FRONTEND = path.join(__dirname, '..', '..', '..', 'main');

function readBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch { resolve({}); } });
  });
}

function augmentRes(res) {
  res._sc = 200;
  res.status = function (code) { this._sc = code; return this; };
  res.json = function (data) {
    if (!this.headersSent) {
      this.writeHead(this._sc, { 'Content-Type': 'application/json' });
      this.end(JSON.stringify(data));
    }
  };
}

function matchRoute(pattern, pathname) {
  const names = [];
  const re = new RegExp('^' + pattern.replace(/:([^/]+)/g, (_, name) => { names.push(name); return '([^/]+)'; }) + '$');
  const m = pathname.match(re);
  if (!m) return null;
  return Object.fromEntries(names.map((name, i) => [name, m[i + 1]]));
}

const AI_WIDGET_INJECT =
  '<link rel="stylesheet" href="/css/ai-chat.css">' +
  '<script src="/js/ai-chat.js"></script>';

/** Serve a static file from a base directory; falls back to index.html for SPA routes */
function serveStatic(baseDir, urlPath, res) {
  let fp = path.join(baseDir, urlPath || 'index.html');
  try {
    const st = fs.statSync(fp);
    if (st.isDirectory()) fp = path.join(fp, 'index.html');
  } catch {
    fp = path.join(baseDir, 'index.html');
  }
  try {
    let content = fs.readFileSync(fp);
    const ext = path.extname(fp);
    if (ext === '.html') {
      let html = content.toString('utf8');
      html = html.includes('</body>')
        ? html.replace('</body>', AI_WIDGET_INJECT + '</body>')
        : html + AI_WIDGET_INJECT;
      content = Buffer.from(html, 'utf8');
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  augmentRes(res);
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end('Bad Request'); }
  const pathname = url.pathname;

  // ---- API routes ----
  if (pathname.startsWith('/api/') || pathname.startsWith('/erp/inventory/')) {
    try {
      if (req.method !== 'GET' && req.method !== 'DELETE') {
        const ct = req.headers['content-type'] || '';
        // Leave multipart streams unconsumed so the route handler can parse them
        if (!ct.startsWith('multipart/')) req.body = await readBody(req);
        else req.body = {};
      } else req.body = {};
      req.query = Object.fromEntries(url.searchParams);

      for (const r of routeTable) {
        if (r.method !== req.method) continue;
        const params = matchRoute(r.pattern, pathname);
        if (params === null) continue;
        req.params = params;
        let i = 0;
        const next = () => { if (i < r.fns.length) r.fns[i++](req, res, next); };
        next();
        return;
      }
      res.status(404).json({ error: 'Not found' });
    } catch (err) {
      console.error('Request error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message || 'Internal server error' });
    }
    return;
  }

  // ---- /crm — CRM SPA (exact) ----
  if (pathname === '/crm' || pathname === '/crm/') {
    if (serveStatic(CRM_FRONTEND, 'index.html', res)) return;
    res.writeHead(404); return res.end('Not Found');
  }

  // ---- /crm/* — CRM static assets (css, js, images, sw, manifest…) ----
  if (pathname.startsWith('/crm/')) {
    const relPath = pathname.slice(5); // strip leading '/crm/'
    if (serveStatic(CRM_FRONTEND, relPath, res)) return;
    res.writeHead(404); return res.end('Not Found');
  }

  // ---- /erp/<submodule> — ERP submodule SPA stubs ----
  const erpMatch = pathname.match(/^\/erp\/([^/]+)(\/.*)?$/);
  if (erpMatch) {
    const submod  = erpMatch[1];
    const subPath = erpMatch[2] || '/';
    const subDir  = path.join(ERP_FRONTEND, submod, 'frontend');
    if (serveStatic(subDir, subPath.slice(1) || 'index.html', res)) return;
    res.writeHead(404); return res.end('Not Found');
  }

  // ---- / — global login ----
  if (pathname === '/') {
    if (serveStatic(GLOBAL_FRONTEND, 'login.html', res)) return;
    res.writeHead(404); return res.end('Not Found');
  }

  // ---- /dashboard — legacy redirect ----
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    res.writeHead(301, { Location: '/home' }); return res.end();
  }

  // ---- /home — global home ----
  if (pathname === '/home' || pathname === '/home/') {
    if (serveStatic(GLOBAL_FRONTEND, 'home.html', res)) return;
    res.writeHead(404); return res.end('Not Found');
  }

  // ---- Everything else — global frontend static assets (/css/*, /js/*, …) ----
  const relPath = pathname.slice(1);
  if (serveStatic(GLOBAL_FRONTEND, relPath, res)) return;
  res.writeHead(404); res.end('Not Found');
});

// ==================== BACKGROUND TASKS ====================

startReminderInterval();

function cleanupSessions() {
  const { db } = require('../database/database');
  try {
    const r = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
    if (r.changes > 0) console.log(`Session cleanup: removed ${r.changes} expired session(s)`);
  } catch (e) { console.error('Session cleanup error:', e.message); }
}
cleanupSessions();
setInterval(cleanupSessions, 6 * 60 * 60 * 1000);

// ==================== LISTEN ====================

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = (process.env.HOST || '0.0.0.0').trim();
server.listen(PORT, HOST, () => {
  console.log(`CRM/ERP running at http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log(`Network access: http://<your-ip>:${PORT}`);
    console.log(`Find your IP with: ipconfig (Windows) or ifconfig/ip addr (Linux/Mac)`);
  }
});
