const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('./crm.db');

// Query contacts
console.log('Contacts:');
const contacts = db.prepare('SELECT * FROM contacts').all();
console.log(contacts);

// Query companies
console.log('\nCompanies:');
const companies = db.prepare('SELECT * FROM companies').all();
console.log(companies);

// Query deals
console.log('\nDeals:');
const deals = db.prepare('SELECT * FROM deals').all();
console.log(deals);

// Query activities
console.log('\nActivities:');
const activities = db.prepare('SELECT * FROM activities').all();
console.log(activities);

// Query users
console.log('\nUsers:');
const users = db.prepare('SELECT * FROM users').all();
console.log(users);

// Query list_items
console.log('\nList Items:');
const listItems = db.prepare('SELECT * FROM list_items').all();
console.log(listItems);

db.close();