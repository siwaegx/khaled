/**
 * @file state.js
 * @description Global application state object and shared constants.
 * Loaded first — all other modules depend on State and these constants.
 */

/* ============================================================
   STATE — single source of truth for the running app
   ============================================================ */
const State = {
  currentUser: null,        // Authenticated user object
  token: null,              // Session token from localStorage
  currentPage: null,        // Active page name (e.g. 'dashboard')
  dealsView: 'kanban',      // 'kanban' or 'list'
  activityFilter: 'all',    // 'all' | 'pending' | 'completed'
  activityType: '',         // Activity type filter string
  taskFilter: 'all',        // 'all' | 'pending' | 'completed'
  contacts: [],
  companies: [],
  deals: [],
  activities: [],
  tasks: [],
  reminders: [],
  users: [],
  lists: {},                // Keyed by list_type
  dealChart: null,          // Chart.js instance for the dashboard pipeline chart
  selectedCompanyId: null,
  selectedContactId: null,
  companyCache: {},         // id → full company detail object
  contactCache: {},         // id → full contact detail object
  companyStatusFilter: '',
  contactStatusFilter: '',
  bulkContacts: [],         // IDs selected for bulk action
  bulkCompanies: [],
  viewAsUserId: null,       // Manager/TL: scope data to this user's records
  teamMembers: [],          // Team leader's sales users
  customFields: { contact: [], company: [] },
  settings: { currency: 'EGP', currency_symbol: 'EGP' },
};

/* ============================================================
   LIST LABELS — human-readable names for each list_type
   ============================================================ */
const LIST_LABELS = {
  city: 'Cities',
  industry: 'Industries',
  contact_title: 'Contact Titles',
  lead_status: 'Lead Status',
  source: 'Sources',
  category: 'Categories',
  company_status: 'Company Status',
};

/* ============================================================
   DEAL PIPELINE — stage ordering, labels, and colors
   ============================================================ */
const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

const STAGE_LABELS = {
  lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal',
  negotiation: 'Negotiation', won: 'Won', lost: 'Lost',
};

const STAGE_COLORS = {
  lead: '#f59e0b', qualified: '#3b82f6', proposal: '#8b5cf6',
  negotiation: '#ec4899', won: '#10b981', lost: '#ef4444',
};

/* ============================================================
   ACTIVITY TYPE ICONS — Font Awesome icon class per type
   ============================================================ */
const TYPE_ICONS = {
  call: 'fa-phone', email: 'fa-envelope', meeting: 'fa-calendar-alt',
  task: 'fa-check-square', visit: 'fa-map-marker-alt', note: 'fa-sticky-note',
  stage_change: 'fa-exchange-alt',
};

/* ============================================================
   LEAD STATUS COLORS — badge background colors per status
   ============================================================ */
const STATUS_COLORS = {
  'fresh lead': '#3b82f6',
  'hot': '#ef4444',
  'cold': '#94a3b8',
  'vip': '#8b5cf6',
  'rfq': '#10b981',
  'need visit': '#f59e0b',
  'not interested': '#6b7280',
  'done sales': '#059669',
  'registered': '#0ea5e9',
  'customer': '#7c3aed',
};

/** Return the hex color for a given lead/company status string. */
function statusColor(status) {
  if (!status) return '#e2e8f0';
  return STATUS_COLORS[status.toLowerCase()] || '#6b7280';
}
