/**
 * Sample Saved Queries Definitions
 * Story 5.6 | Sprint 2
 * Ref: FR-22, FR-23, US-10, Backlog sub-tasks #168–#175
 *
 * Defines the five representative saved queries required for the demo,
 * powering the Notification Engine's 3 email workflows and 2 report workflows:
 *
 * 1. Customer Payment Reminder: Overdue invoices (> 7 days) (SQL Server) [Sub-task 169]
 * 2. Low Stock Alert: Items below reorder level (SQL Server) [Sub-task 170]
 * 3. Weekly Receivables Report: Open receivables summary (SQL Server) [Sub-task 171]
 * 4. Supplier PO Follow-up: Purchase orders past promised date (Service Layer) [Sub-task 172]
 * 5. Daily Sales Report: Daily sales summary (SAP HANA) [Sub-task 173]
 */

const SAMPLE_QUERIES = [
  {
    name: "Overdue Invoices",
    description: "Invoices overdue by more than 7 days. Feeds the Customer Payment Reminder email workflow.",
    targetConnectionType: "SQLServer",
    kind: "sql",
    queryText: `SELECT InvoiceNo, CustomerName, Email, DATEDIFF(day, DueDate, @asOfDate) AS DaysOverdue, Amount FROM Invoices WHERE Paid = 0 AND DATEDIFF(day, DueDate, @asOfDate) > @thresholdDays`,
    entity: "",
    filter: "",
    select: "",
    params: [
      { name: "@asOfDate", defaultValue: "2026-11-01" },
      { name: "@thresholdDays", defaultValue: "7" }
    ],
    columnMapping: [
      { source: "InvoiceNo", common: "InvoiceNo" },
      { source: "CustomerName", common: "CustomerName" },
      { source: "Email", common: "Email" },
      { source: "DaysOverdue", common: "DaysOverdue" },
      { source: "Amount", common: "Amount" }
    ],
    expectedColumns: ["InvoiceNo", "CustomerName", "Email", "DaysOverdue", "Amount"],
    rowLimit: 1000
  },
  {
    name: "Items Below Reorder Level",
    description: "Inventory stock items where quantity available is below the safety reorder level. Feeds the Low Stock Alert email workflow.",
    targetConnectionType: "SQLServer",
    kind: "sql",
    queryText: `SELECT ItemCode, ItemName, QtyAvailable, ReorderLevel FROM Items WHERE QtyAvailable < ReorderLevel`,
    entity: "",
    filter: "",
    select: "",
    params: [],
    columnMapping: [
      { source: "ItemCode", common: "ItemCode" },
      { source: "ItemName", common: "ItemName" },
      { source: "QtyAvailable", common: "QtyAvailable" },
      { source: "ReorderLevel", common: "ReorderLevel" }
    ],
    expectedColumns: ["ItemCode", "ItemName", "QtyAvailable", "ReorderLevel"],
    rowLimit: 1000
  },
  {
    name: "Open Receivables Summary",
    description: "Aggregation of outstanding unpaid invoices and balances grouped by customer. Feeds the Weekly Finance Report workflow.",
    targetConnectionType: "SQLServer",
    kind: "sql",
    queryText: `SELECT CustomerCode, CustomerName, COUNT(InvoiceNo) AS OpenInvoicesCount, SUM(Amount) AS TotalReceivable FROM Invoices WHERE Paid = 0 GROUP BY CustomerCode, CustomerName`,
    entity: "",
    filter: "",
    select: "",
    params: [],
    columnMapping: [
      { source: "CustomerCode", common: "CustomerCode" },
      { source: "CustomerName", common: "CustomerName" },
      { source: "OpenInvoicesCount", common: "OpenInvoicesCount" },
      { source: "TotalReceivable", common: "TotalReceivable" }
    ],
    expectedColumns: ["CustomerCode", "CustomerName", "OpenInvoicesCount", "TotalReceivable"],
    rowLimit: 1000
  },
  {
    name: "Purchase Orders Past Promised Date",
    description: "Pending supplier purchase orders where expected delivery date has passed. Feeds the Supplier PO Follow-up email workflow.",
    targetConnectionType: "ServiceLayer",
    kind: "odata",
    queryText: "",
    entity: "PurchaseOrders",
    filter: "Status eq 'Pending'",
    select: "PONumber,SupplierName,Email,PromisedDate,Status",
    params: [],
    columnMapping: [
      { source: "PONumber", common: "PONumber" },
      { source: "SupplierName", common: "SupplierName" },
      { source: "Email", common: "Email" },
      { source: "PromisedDate", common: "PromisedDate" },
      { source: "Status", common: "Status" }
    ],
    expectedColumns: ["PONumber", "SupplierName", "Email", "PromisedDate", "Status"],
    rowLimit: 1000
  },
  {
    name: "Daily Sales Summary",
    description: "Daily branch-level sales totals and order counts from SAP HANA. Feeds the Daily Sales Report workflow.",
    targetConnectionType: "HANA",
    kind: "sql",
    queryText: `SELECT "Date", "Branch", "TotalSales", "Orders" FROM "SALESSUMMARY" ORDER BY "Date" DESC`,
    entity: "",
    filter: "",
    select: "",
    params: [],
    columnMapping: [
      { source: "Date", common: "Date" },
      { source: "Branch", common: "Branch" },
      { source: "TotalSales", common: "TotalSales" },
      { source: "Orders", common: "Orders" }
    ],
    expectedColumns: ["Date", "Branch", "TotalSales", "Orders"],
    rowLimit: 1000
  }
];

function getSampleQueries() {
  return JSON.parse(JSON.stringify(SAMPLE_QUERIES));
}

function getSampleQueryByName(name) {
  const query = SAMPLE_QUERIES.find((q) => q.name.toLowerCase() === name.toLowerCase());
  return query ? JSON.parse(JSON.stringify(query)) : null;
}

module.exports = {
  SAMPLE_QUERIES,
  getSampleQueries,
  getSampleQueryByName,
};
