'use strict';

/** Route table — populated by app.get/post/put/delete calls */
const routeTable = [];

/** Minimal Express-like router */
const app = {
  get:    (p, ...fns) => routeTable.push({ method: 'GET',    pattern: p, fns }),
  post:   (p, ...fns) => routeTable.push({ method: 'POST',   pattern: p, fns }),
  put:    (p, ...fns) => routeTable.push({ method: 'PUT',    pattern: p, fns }),
  delete: (p, ...fns) => routeTable.push({ method: 'DELETE', pattern: p, fns }),
};

module.exports = { app, routeTable };
