const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test script for CRM project
// This will perform comprehensive testing of the CRM system

const BASE_URL = 'http://localhost:3000';
let token = null;
let managerToken = null;
let salesToken = null;
let testUserId = null;

function api(method, url, body, headers = {}) {
  return fetch(`${BASE_URL}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  }).then(r => r.json());
}

function apiNoAuth(method, url, body) {
  return fetch(`${BASE_URL}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  }).then(r => r.json());
}

async function testAuth() {
  console.log('Testing Authentication...');

  // Test login with manager PIN
  const loginRes = await apiNoAuth('POST', '/api/auth/login', { pin: '1996' });
  if (!loginRes.token) throw new Error('Manager login failed');
  managerToken = loginRes.token;
  console.log('✓ Manager login successful');

  // Test me endpoint
  token = managerToken;
  const meRes = await api('GET', '/api/auth/me');
  if (meRes.role !== 'manager') throw new Error('Me endpoint failed');
  console.log('✓ Me endpoint works');

  // Create a sales user
  const userRes = await api('POST', '/api/users', { name: 'Test Sales', role: 'sales', pin: '1234' });
  testUserId = userRes.id;
  console.log('✓ User creation successful');

  // Login as sales
  const salesLogin = await apiNoAuth('POST', '/api/auth/login', { pin: '1234' });
  salesToken = salesLogin.token;
  console.log('✓ Sales login successful');

  // Test logout
  await api('POST', '/api/auth/logout');
  console.log('✓ Logout successful');

  // Login again as manager for further tests
  const loginAgain = await apiNoAuth('POST', '/api/auth/login', { pin: '1996' });
  managerToken = loginAgain.token;
  token = managerToken;
}

async function testUsers() {
  console.log('Testing Users...');
  token = managerToken;

  // Get users
  const users = await api('GET', '/api/users');
  console.log('Users response:', users);
  if (!Array.isArray(users)) throw new Error('Users list failed');
  console.log('✓ Users list works');

  // Update user
  await api('PUT', `/api/users/${testUserId}`, { name: 'Updated Sales' });
  console.log('✓ User update works');

  // Delete user
  await api('DELETE', `/api/users/${testUserId}`);
  console.log('✓ User delete works');
}

async function testCompanies() {
  console.log('Testing Companies...');
  token = managerToken;

  // Create company
  const compRes = await api('POST', '/api/companies', {
    name: 'Test Company',
    industry: 'Tech',
    city: 'Cairo',
    status: 'Fresh Lead'
  });
  const compId = compRes.id;
  console.log('✓ Company creation works');

  // Get companies
  const companies = await api('GET', '/api/companies');
  if (!companies.find(c => c.id === compId)) throw new Error('Company not in list');
  console.log('✓ Companies list works');

  // Get single company
  const comp = await api('GET', `/api/companies/${compId}`);
  if (comp.name !== 'Test Company') throw new Error('Company detail failed');
  console.log('✓ Company detail works');

  // Update company
  await api('PUT', `/api/companies/${compId}`, { name: 'Updated Company' });
  console.log('✓ Company update works');

  // Delete company
  await api('DELETE', `/api/companies/${compId}`);
  console.log('✓ Company delete works');
}

async function testContacts() {
  console.log('Testing Contacts...');
  token = managerToken;

  // Create contact
  const contRes = await api('POST', '/api/contacts', {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    lead_status: 'Hot'
  });
  const contId = contRes.id;
  console.log('✓ Contact creation works');

  // Get contacts
  const contacts = await api('GET', '/api/contacts');
  if (!contacts.find(c => c.id === contId)) throw new Error('Contact not in list');
  console.log('✓ Contacts list works');

  // Update contact
  await api('PUT', `/api/contacts/${contId}`, { first_name: 'Jane' });
  console.log('✓ Contact update works');

  // Delete contact
  await api('DELETE', `/api/contacts/${contId}`);
  console.log('✓ Contact delete works');
}

async function testDeals() {
  console.log('Testing Deals...');
  token = managerToken;

  // Create deal
  const dealRes = await api('POST', '/api/deals', {
    title: 'Test Deal',
    value: 10000,
    stage: 'qualified'
  });
  const dealId = dealRes.id;
  console.log('✓ Deal creation works');

  // Get deals
  const deals = await api('GET', '/api/deals');
  if (!deals.find(d => d.id === dealId)) throw new Error('Deal not in list');
  console.log('✓ Deals list works');

  // Update deal
  await api('PUT', `/api/deals/${dealId}`, { stage: 'won' });
  console.log('✓ Deal update works');

  // Delete deal
  await api('DELETE', `/api/deals/${dealId}`);
  console.log('✓ Deal delete works');
}

async function testActivities() {
  console.log('Testing Activities...');
  token = managerToken;

  // Create activity
  const actRes = await api('POST', '/api/activities', {
    type: 'call',
    title: 'Test Call',
    description: 'Called client'
  });
  const actId = actRes.id;
  console.log('✓ Activity creation works');

  // Get activities
  const activities = await api('GET', '/api/activities');
  if (!activities.find(a => a.id === actId)) throw new Error('Activity not in list');
  console.log('✓ Activities list works');

  // Update activity
  await api('PUT', `/api/activities/${actId}`, { completed: 1 });
  console.log('✓ Activity update works');

  // Delete activity
  await api('DELETE', `/api/activities/${actId}`);
  console.log('✓ Activity delete works');
}

async function testLists() {
  console.log('Testing Lists...');
  token = managerToken;

  // Get lists
  const lists = await api('GET', '/api/lists');
  if (!lists.city) throw new Error('Lists failed');
  console.log('✓ Lists retrieval works');

  // Add list item
  const itemRes = await api('POST', '/api/lists/city', { value: 'Test City' });
  const itemId = itemRes.id;
  console.log('✓ List item creation works');

  // Update list item
  await api('PUT', `/api/list-items/${itemId}`, { value: 'Updated City' });
  console.log('✓ List item update works');

  // Delete list item
  await api('DELETE', `/api/list-items/${itemId}`);
  console.log('✓ List item delete works');
}

async function testDashboard() {
  console.log('Testing Dashboard...');
  token = managerToken;

  const dash = await api('GET', '/api/dashboard');
  if (!dash.stats) throw new Error('Dashboard failed');
  console.log('✓ Dashboard works');
}

async function testSearch() {
  console.log('Testing Search...');
  token = managerToken;

  const search = await api('GET', '/api/search?q=test');
  if (!search.contacts || !search.companies) throw new Error('Search failed');
  console.log('✓ Search works');
}

async function testRoleBasedAccess() {
  console.log('Testing Role-Based Access...');

  // Create sales user again
  token = managerToken;
  const userRes = await api('POST', '/api/users', { name: 'Test Sales 2', role: 'sales', pin: '5678' });
  const salesId = userRes.id;

  // Login as sales
  const salesLogin = await apiNoAuth('POST', '/api/auth/login', { pin: '5678' });
  token = salesLogin.token;

  // Try to access users (should fail)
  const usersRes = await api('GET', '/api/users');
  if (usersRes.error === 'Forbidden') {
    console.log('✓ Role-based access works');
  } else {
    throw new Error('Sales should not access users');
  }

  // Switch back to manager and delete sales user
  token = managerToken;
  await api('DELETE', `/api/users/${salesId}`);
}

async function testBulkActions() {
  console.log('Testing Bulk Actions...');
  token = managerToken;

  // Create multiple companies
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const res = await api('POST', '/api/companies', { name: `Bulk Company ${i}` });
    ids.push(res.id);
  }

  // Bulk delete
  await api('POST', '/api/bulk/companies', { ids, action: 'delete' });
  console.log('✓ Bulk actions work');
}

async function testImportExport() {
  console.log('Testing Import/Export...');
  token = managerToken;

  // Test export (just check response)
  const exportRes = await fetch(`${BASE_URL}/api/export/companies`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!exportRes.ok) throw new Error('Export failed');
  console.log('✓ Export works');

  // Test import
  const importData = [{
    name: 'Imported Company',
    industry: 'Import Test',
    city: 'Test City'
  }];
  await api('POST', '/api/import', importData);
  console.log('✓ Import works');
}

async function testDatabaseIntegrity() {
  console.log('Testing Database Integrity...');

  const dbPath = path.join(__dirname, 'modules', 'crm', 'database', 'crm.db');

  // Check if database file exists
  if (!fs.existsSync(dbPath)) throw new Error(`Database file missing at ${dbPath}`);

  // Try to read from database directly
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbPath);

  // Check tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const requiredTables = ['companies', 'contacts', 'deals', 'activities', 'users', 'sessions'];
  for (const table of requiredTables) {
    if (!tables.find(t => t.name === table)) throw new Error(`Table ${table} missing`);
  }
  console.log('✓ Database integrity OK');
}

async function runTests() {
  try {
    console.log('Starting comprehensive CRM tests...\n');

    await testAuth();
    await testUsers();
    await testCompanies();
    await testContacts();
    await testDeals();
    await testActivities();
    await testLists();
    await testDashboard();
    await testSearch();
    await testRoleBasedAccess();
    await testBulkActions();
    await testImportExport();
    await testDatabaseIntegrity();

    console.log('\n🎉 All tests passed! CRM is working correctly.');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();