/**
 * @file api.js
 * @description Central fetch wrapper. Injects the auth token, handles 401
 * by triggering logout, and throws on non-OK responses.
 */

/* ============================================================
   API HELPER
   ============================================================ */

/**
 * Fetch a JSON API endpoint with the current session token.
 * Managers/team leaders: automatically appends ?view_as= on GET calls
 * when a member is selected in the TL member bar.
 *
 * @param {string} path - API path, e.g. '/api/contacts'
 * @param {object} options - fetch options (method, body, _silent, etc.)
 * @returns {Promise<any>} Parsed JSON response
 */
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (State.token) headers['Authorization'] = `Bearer ${State.token}`;

  // Manager / team leader: inject view_as on GET requests to scope data to selected user
  const _role = State.currentUser?.role;
  const _noViewAs = ['/api/auth', '/api/team', '/api/users', '/api/lists', '/api/notifications'];
  if ((['manager', 'team_leader'].includes(_role)) && State.viewAsUserId &&
      (options.method === undefined || options.method === 'GET') &&
      path.startsWith('/api/') && !_noViewAs.some(p => path.startsWith(p))) {
    const sep = path.includes('?') ? '&' : '?';
    path = path + sep + 'view_as=' + State.viewAsUserId;
  }

  const res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    // Only force logout for explicit auth failures, not background poll errors
    if (State.token && !options._silent) doLogout();
    throw new Error(body.error || 'Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
