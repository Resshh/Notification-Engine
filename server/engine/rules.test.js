
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { toObjects, matches } = require('../engine/rules');
const overdueInvoices = require('../../mock-data/overdue-invoices.json');

test('toObjects converts rows into objects', () => {
  const result = toObjects(overdueInvoices);

  assert.equal(result[0].InvoiceNo, 'INV-101');
  assert.equal(result[0].DaysOverdue, 10);
});

test('DaysOverdue > 7 returns the expected invoices', () => {
  const rows = toObjects(overdueInvoices);

  const result = rows
    .filter((row) =>
      matches(row, [
        { field: 'DaysOverdue', operator: '>', value: 7 },
      ])
    )
    .map((row) => row.InvoiceNo);

  assert.deepEqual(result, ['INV-101', 'INV-103', 'INV-105']);
});

test('multiple conditions use AND', () => {
  const row = { DaysOverdue: 10, Amount: 25000 };

  assert.equal(
    matches(row, [
      { field: 'DaysOverdue', operator: '>', value: 7 },
      { field: 'Amount', operator: '>=', value: 20000 },
    ]),
    true
  );
});

test('empty conditions match every row', () => {
  assert.equal(matches({ InvoiceNo: 'INV-101' }, []), true);
});

test('supports all six operators', () => {
  const row = { amount: 100 };

  assert.equal(matches(row, [{ field: 'amount', operator: '>', value: 50 }]), true);
  assert.equal(matches(row, [{ field: 'amount', operator: '>=', value: 100 }]), true);
  assert.equal(matches(row, [{ field: 'amount', operator: '<', value: 150 }]), true);
  assert.equal(matches(row, [{ field: 'amount', operator: '<=', value: 100 }]), true);
  assert.equal(matches(row, [{ field: 'amount', operator: '=', value: 100 }]), true);
  assert.equal(matches(row, [{ field: 'amount', operator: '!=', value: 50 }]), true);
});
