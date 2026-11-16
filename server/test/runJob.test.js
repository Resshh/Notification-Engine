// Full job runs (Batch 1 guide, section 10 "Test cases to show"), with the database, the data
// source and the mail server replaced by in-memory fakes. Nothing touches MongoDB or SMTP.
const test = require('node:test');
const assert = require('node:assert');

// ---- Fakes. Installed BEFORE the runner loads, because it reads these at require time. ----
const data = {
  columns: ['InvoiceNo', 'CustomerName', 'Email', 'DaysOverdue', 'Amount'],
  rows: [
    ['INV-101', 'ABC Traders', 'abc@test.com', 10, 25000],
    ['INV-102', 'XYZ Stores', 'xyz@test.com', 3, 8000],
    ['INV-103', 'PQR Ltd', 'pqr@test.com', 15, 12000],
  ],
  meta: { source: 'Fake', rowCount: 3 },
};
let queryError = null;
require('../core/runQuery').runQuery = async () => {
  if (queryError) throw queryError;
  return structuredClone(data);
};

let mailServerDown = false;
let mailAttempts = 0;
require('../engine/mailer').sendMail = async () => {
  mailAttempts++;
  if (mailServerDown) throw new Error('connect ECONNREFUSED 127.0.0.1:587');
};

const models = require('../models');
let job;
let logs;
let sentKeys;
let savedRuns;
const template = { subject: 'Invoice {{InvoiceNo}}', body: 'Dear {{CustomerName}}, {{DaysOverdue}} days overdue.' };

models.Job.findById = async () => job;
models.Template.findById = async () => template;
models.RecipientList.findById = async () => null;
models.JobRun.create = async (doc) => ({
  ...doc, _id: 'run' + savedRuns.length, rowsFetched: 0, rowsMatched: 0, emailsSent: 0, skippedDuplicates: 0, failed: 0,
  status: 'running', save() { savedRuns.push(this); return this; },
});
models.DeliveryLog.create = async (doc) => { logs.push(doc); return doc; };
models.SentHistory.create = async ({ dedupeKey }) => {
  if (sentKeys.has(dedupeKey)) throw Object.assign(new Error('duplicate key'), { code: 11000 });
  sentKeys.add(dedupeKey);
};
models.SentHistory.deleteOne = async ({ dedupeKey }) => { sentKeys.delete(dedupeKey); };

const { runJob } = require('../engine/runner');
const run = () => runJob('job1', { retryOptions: { delayMs: 0 } });

test.beforeEach(() => {
  job = {
    _id: 'job1', name: 'Payment Reminder', queryId: 'q1', templateId: 't1', mode: 'message',
    rule: [{ column: 'DaysOverdue', op: '>', value: 7 }],
    recipients: { from: 'column', column: 'Email', cc: [], bcc: [] },
    schedule: { timezone: 'Asia/Kolkata' },
  };
  logs = [];
  sentKeys = new Set();
  savedRuns = [];
  queryError = null;
  mailServerDown = false;
  mailAttempts = 0;
});

test('job with matching rows: emails are sent and the log shows success', async () => {
  const r = await run();
  assert.strictEqual(r.status, 'success');
  assert.strictEqual(r.rowsFetched, 3);
  assert.strictEqual(r.rowsMatched, 2); // INV-101 (10) and INV-103 (15); INV-102 (3) fails the rule
  assert.strictEqual(r.emailsSent, 2);
  assert.deepStrictEqual(logs.map((l) => [l.recipient, l.status]), [['abc@test.com', 'sent'], ['pqr@test.com', 'sent']]);
  assert.strictEqual(logs[0].subject, 'Invoice INV-101');
  assert.strictEqual(savedRuns.length, 1);
});

test('job with no matching rows: no emails, log shows 0 sent', async () => {
  job.rule = [{ column: 'DaysOverdue', op: '>', value: 999 }];
  const r = await run();
  assert.strictEqual(r.status, 'success');
  assert.strictEqual(r.rowsMatched, 0);
  assert.strictEqual(r.emailsSent, 0);
  assert.strictEqual(mailAttempts, 0);
  assert.strictEqual(logs.length, 0);
  assert.strictEqual(savedRuns.length, 1); // the run is still logged
});

test('same job run twice: the second run sends nothing (duplicates skipped)', async () => {
  await run();
  logs = [];
  mailAttempts = 0;
  const second = await run();
  assert.strictEqual(second.emailsSent, 0);
  assert.strictEqual(second.skippedDuplicates, 2);
  assert.strictEqual(mailAttempts, 0);
  assert.deepStrictEqual(logs.map((l) => l.status), ['skipped', 'skipped']);
});

test('email server is down: each email is retried, then the failure is logged', async () => {
  mailServerDown = true;
  const r = await run();
  assert.strictEqual(r.status, 'failed');
  assert.strictEqual(r.emailsSent, 0);
  assert.strictEqual(r.failed, 2);
  assert.strictEqual(mailAttempts, 8); // 2 emails x (1 try + 3 retries)
  for (const l of logs) {
    assert.strictEqual(l.status, 'failed');
    assert.strictEqual(l.retryCount, 3);
    assert.match(l.errorMessage, /ECONNREFUSED/);
  }
  // The failed emails are not marked as sent, so the next run tries them again.
  mailServerDown = false;
  const next = await run();
  assert.strictEqual(next.emailsSent, 2);
});

test('data source fails: the run is still saved as failed with a safe error', async () => {
  queryError = new Error('Connection refused');
  const r = await run();
  assert.strictEqual(r.status, 'failed');
  assert.strictEqual(r.error, 'Connection refused');
  assert.ok(r.endTime instanceof Date);
  assert.strictEqual(savedRuns.length, 1);
});
