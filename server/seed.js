// Fills the database with login users and the 5 demo workflows (FR-20, FR-21).
// The workflows use Batch 2's 5 saved queries, so run Batch 2's seed first: npm run seed, then npm run seed:batch1.
// Safe to run again - it updates by name instead of duplicating.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Query, Template, RecipientList, Job } = require('./models');

const users = [
  { name: 'Admin User', email: 'admin@test.com', role: 'admin' },
  { name: 'Normal User', email: 'user@test.com', role: 'user' },
];
// Public Yopmail test inboxes, so the demo can open each one at yopmail.com and show who got what.
// Never put real people's addresses here.
const lists = [
  { name: 'Finance Team', emails: ['nedemo-finance-team@yopmail.com'], cc: ['nedemo-accounts-head@yopmail.com'], bcc: [] },
  { name: 'Sales Management', emails: ['nedemo-sales-head@yopmail.com', 'nedemo-sales-manager@yopmail.com'], cc: [], bcc: [] },
  { name: 'Purchase Team', emails: ['nedemo-purchase-team@yopmail.com'], cc: [], bcc: [] },
  { name: 'Store Managers', emails: ['nedemo-kochi-store@yopmail.com', 'nedemo-tvm-store@yopmail.com'], cc: [], bcc: [] },
];

// Placeholders match the columns of Batch 2's saved queries (sampleQueries/sampleQueries.js).
const templates = [
  {
    name: 'Payment Reminder',
    subject: 'Payment reminder: invoice {{InvoiceNo}} is {{DaysOverdue}} days overdue',
    body: 'Dear {{CustomerName}},\n\nOur records show that invoice {{InvoiceNo}} for Rs {{Amount}} is {{DaysOverdue}} days overdue.\nPlease arrange payment at the earliest.\n\nRegards,\nFinance Team',
  },
  {
    name: 'PO Follow-up',
    subject: 'Follow-up: purchase order {{PONumber}} is past its promised date',
    body: 'Dear {{SupplierName}},\n\nPurchase order {{PONumber}} was promised for {{PromisedDate}} and is still {{Status}}.\nPlease confirm the new delivery date.\n\nRegards,\nPurchase Team',
  },
  {
    name: 'Low Stock Alert',
    subject: 'Low stock: {{ItemName}} ({{ItemCode}})',
    body: 'Hello,\n\n{{ItemName}} ({{ItemCode}}) has {{QtyAvailable}} units left, below the reorder level of {{ReorderLevel}}.\nPlease raise a purchase request.\n\nNotification Engine',
  },
  {
    name: 'Daily Sales Report',
    subject: 'Daily sales report - {{Date}}',
    body: 'Hello,\n\nPlease find attached the daily sales report for {{Date}} ({{RowCount}} rows).\n\nNotification Engine',
  },
  {
    name: 'Weekly Receivables Report',
    subject: 'Weekly receivables ageing - {{Date}}',
    body: 'Hello,\n\nPlease find attached the receivables ageing report ({{RowCount}} customers) as of {{Date}}.\n\nNotification Engine',
  },
];

const daily = (time) => ({ frequency: 'daily', time, timezone: 'Asia/Kolkata' });
// query = name of Batch 2's saved query
const jobs = [
  { name: 'Payment Reminder', query: 'Overdue Invoices', template: 'Payment Reminder', mode: 'message',
    rule: [{ column: 'DaysOverdue', op: '>', value: 7 }], schedule: daily('10:00'),
    recipients: { from: 'column', column: 'Email', cc: [], bcc: [] } },
  { name: 'PO Follow-up', query: 'Purchase Orders Past Promised Date', template: 'PO Follow-up', mode: 'message',
    rule: [{ column: 'Status', op: '!=', value: 'Closed' }], schedule: daily('10:30'),
    recipients: { from: 'column', column: 'Email', cc: ['nedemo-purchase-team@yopmail.com'], bcc: [] } },
  { name: 'Low Stock Alert', query: 'Items Below Reorder Level', template: 'Low Stock Alert', mode: 'message',
    rule: [], schedule: daily('08:00'), // the query already returns only items below reorder level
    recipients: { from: 'list', list: 'Store Managers', cc: [], bcc: [] } },
  { name: 'Daily Sales Report', query: 'Daily Sales Summary', template: 'Daily Sales Report', mode: 'report',
    rule: [], schedule: daily('19:00'), recipients: { from: 'list', list: 'Sales Management', cc: [], bcc: [] } },
  { name: 'Weekly Receivables Report', query: 'Open Receivables Summary', template: 'Weekly Receivables Report', mode: 'report',
    rule: [], schedule: { frequency: 'weekly', time: '09:00', days: [1], timezone: 'Asia/Kolkata' },
    recipients: { from: 'list', list: 'Finance Team', cc: [], bcc: [] } },
];

const upsert = (Model, filter, doc) => Model.findOneAndUpdate(filter, doc, { upsert: true, returnDocument: 'after', runValidators: true });

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD || 'Test@123', 10);
  for (const u of users) await User.updateOne({ email: u.email }, { ...u, passwordHash }, { upsert: true });
  const listIds = {};
  for (const l of lists) listIds[l.name] = (await upsert(RecipientList, { name: l.name }, l))._id;
  const templateIds = {};
  for (const t of templates) templateIds[t.name] = (await upsert(Template, { name: t.name }, t))._id;

  for (const { query, template, recipients: { list, ...recipients }, ...job } of jobs) {
    const q = await Query.findOne({ name: query }, '_id');
    if (!q) throw new Error(`Saved query "${query}" not found - run Batch 2's seed first (npm run seed)`);
    await upsert(Job, { name: job.name }, {
      ...job,
      queryId: q._id,
      templateId: templateIds[template],
      recipients: { ...recipients, listId: list ? listIds[list] : undefined },
      enabled: true,
    });
  }
  console.log('Seeded: admin@test.com / user@test.com, 4 recipient lists, 5 templates, 5 jobs');
  await mongoose.disconnect();
})();
