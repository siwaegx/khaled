'use strict';

const {
  requireAuth, requireManager,
  ownerFilter, activityOwnerFilter, checkOwnership,
  managerCount, n,
} = require('../middleware/auth');

/** Helpers object passed to every route register() call */
const helpers = {
  requireAuth,
  requireManager,
  ownerFilter,
  activityOwnerFilter,
  checkOwnership,
  managerCount,
  n,
};

/** CRM route modules (ordered: auth first, entities last) */
const crmRoutes = [
  '../backend/auth',
  '../backend/users',
  '../backend/lists',
  '../backend/settings',
  '../backend/team',
  '../backend/dashboard',
  '../backend/notifications',
  '../backend/goals',
  '../backend/custom-fields',
  '../backend/email',
  '../backend/search',
  '../backend/reports',
  '../backend/calendar',
  '../backend/tasks',
  '../backend/bulk',
  '../backend/import-export',
  '../backend/companies',
  '../backend/contacts',
  '../backend/deals',
  '../backend/activities',
];

/**
 * Register all CRM routes (and future ERP routes) onto the app router.
 * @param {object} app - Route registration object from core/app.js
 */
function loadRoutes(app) {
  for (const mod of crmRoutes) {
    require(mod).register(app, null, helpers);
  }
  require('../../inventory/backend/products').register(app, null, helpers);
}

module.exports = { loadRoutes, helpers };
