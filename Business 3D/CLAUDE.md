# CRM Project

Full-featured web CRM system built with Node.js (native http), SQLite, and a vanilla JS frontend. No build step.

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js v24+ native `http` module |
| Database | `node:sqlite` (built-in, `DatabaseSync`) — NOT `better-sqlite3` |
| Frontend | Vanilla HTML/CSS/JS, Chart.js, Font Awesome |
| Auth | PIN-based sessions stored in SQLite |

**Critical:** Never suggest installing `better-sqlite3` or other native sqlite packages. The user's machine cannot compile native addons (missing C++ workload). `node:sqlite` is built into Node.js v24 and works without compilation.

## Start / Run

```bash
npm run dev        # nodemon — auto-restarts on every file change (use this for development)
npm start          # node --no-warnings server.js (one-shot, no auto-restart)
# Server runs on http://localhost:3000 (or PORT env var)
```

> Always use `npm run dev` during development. nodemon watches `server.js` and all JS files, ignores the SQLite DB files, and restarts automatically on every save — no manual kill/restart needed.

## node:sqlite Quirks

- Use `db.exec("PRAGMA ...")` not `db.pragma(...)` (that's a better-sqlite3 API)
- `undefined` values throw "Provided value cannot be bound to SQLite parameter N" — always coerce with `const n = v => v ?? null` and wrap optional params
- `DatabaseSync` is synchronous; no async/await needed for DB calls

## Project Structure

```
crm/
├── server.js                        # Root entry point — one-line shim into backend/core/server.js
├── package.json
└── backend/
    ├── core/
    │   ├── server.js                # HTTP server, static serving, API dispatch
    │   ├── app.js                   # Minimal Express-like router (routeTable + app object)
    │   └── routeLoader.js           # Loads CRM routes; future ERP routes wired here
    ├── middleware/
    │   └── auth.js                  # requireAuth, requireManager, ownerFilter, etc.
    ├── database/
    │   ├── database.js              # DatabaseSync setup, initDatabase, migrateDatabase, seed
    │   └── crm.db                   # SQLite database file
    ├── modules/
    │   ├── crm/
    │   │   ├── backend/             # All CRM route modules (auth, companies, contacts, …)
    │   │   └── frontend/            # CRM SPA (index.html, css/, js/, images/, etc.)
    │   └── erp/
    │       ├── inventory/backend/   # (stub — no logic yet)
    │       ├── inventory/frontend/  # Placeholder index.html
    │       ├── purchasing/…
    │       ├── finance/…
    │       ├── service/…
    │       └── machine_data/…
    └── uploads/                     # File upload storage (reserved)
```

**URL routing:**
- `/` and `/crm` → CRM SPA (`backend/modules/crm/frontend/index.html`)
- `/css/…`, `/js/…`, etc. → CRM static assets
- `/erp/<submodule>` → ERP submodule frontend stub
- `/api/…` → API routes (unchanged)

**Adding a new CRM route:** create `backend/modules/crm/backend/<name>.js` with a `register(app, _db, helpers)` export, then add it to the `crmRoutes` array in `backend/core/routeLoader.js`.

## Database Schema

Tables auto-created in `initDatabase()`, migrated in `migrateDatabase()`:

| Table | Purpose |
|---|---|
| `users` | id, name, role ('manager'\|'sales'), pin (4-digit string) |
| `sessions` | id, user_id, token (unique hex), expires_at |
| `companies` | id, name, industry, website, phone, email, address, city, country, size, notes, category, status, custom_id, folder, user_id, timestamps |
| `contacts` | id, first_name, last_name, email, phone, title, company_id, status, source, notes, lead_status, user_id, timestamps |
| `deals` | id, title, value, stage, probability, company_id, contact_id, close_date, notes, user_id, timestamps |
| `activities` | id, type (call/email/meeting/task), title, description, due_date, completed, contact_id, company_id, deal_id, user_id, timestamps |
| `list_items` | id, list_type, value, color, order_index — dynamic dropdown options managed by managers |

**Default manager account:** name='Manager', role='manager', PIN='1996' (seeded on first run if no users exist).

## Auth System

- PIN login → server returns a 32-byte hex session token → stored in `localStorage` as `crm_token`
- All API calls send `Authorization: Bearer <token>`
- Sessions expire after 24 hours
- `requireAuth` middleware validates token on protected routes
- `requireManager` middleware restricts routes to manager role

## Role-Based Access

| Role | Access |
|---|---|
| `manager` | All records, user management, list management, CSV import/export |
| `sales` | Own records only (filtered by `user_id`), no user/list management |

Every record (company, contact, deal, activity) has a `user_id`. The `ownerFilter()` helper in `backend/middleware/auth.js` auto-appends `WHERE user_id = ?` for sales users.

## API Endpoints

```
POST   /api/auth/login          — login with PIN
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/dashboard           — stats + recent items

GET    /api/companies           — search/filter, includes contact/deal counts
GET    /api/companies/:id       — detail + related contacts/deals/activities
POST   /api/companies
PUT    /api/companies/:id
DELETE /api/companies/:id

GET    /api/contacts
GET    /api/contacts/:id
POST   /api/contacts
PUT    /api/contacts/:id
DELETE /api/contacts/:id

GET    /api/deals               — filter by stage/search
POST   /api/deals
PUT    /api/deals/:id
DELETE /api/deals/:id

GET    /api/activities          — filter by completion/type
POST   /api/activities
PUT    /api/activities/:id
DELETE /api/activities/:id

GET    /api/users               — manager only
POST   /api/users               — manager only
PUT    /api/users/:id           — manager only
DELETE /api/users/:id           — manager only

GET    /api/lists               — all dropdown lists grouped by type
GET    /api/lists/:type
POST   /api/lists/:type         — manager only
PUT    /api/list-items/:id      — manager only
DELETE /api/list-items/:id      — manager only

GET    /api/export/companies    — CSV download (manager only)
GET    /api/export/contacts     — CSV download (manager only)
POST   /api/import              — bulk import companies + contacts (manager only)
```

## Frontend Patterns

- Global `State` object tracks current user, auth token, current page, cached data, and UI state
- `api(method, path, body)` — fetch wrapper with auth headers
- Hash-based routing via `navigateTo(page)`
- Deal pipeline stages: `lead → qualified → proposal → negotiation → won/lost`
- Kanban board (drag-drop) + list view for deals
- Split-view layout (list panel + detail panel) for companies and contacts

## List Types (Dynamic Dropdowns)

Managed by managers via the Lists page. Seeded with Egyptian-market defaults:
- `city` — 30 Egyptian cities
- `industry` — 32 industry types
- `contact_title` — Owner, CEO, Engineer, etc.
- `lead_status` — Fresh Lead, Cold, Hot, VIP, RFQ, etc.
- `source` — Visits, LinkedIn, Exhibition, etc.
- `category` — WT, WWT, CHEM, SPARE, INSTRUMENT, CONTROL, GENERAL
- `company_status` — 10 statuses
