/**
 * Tests for Story 2.2 (SQL Server queries) and Story 7.2 (safe source switching).
 * These run without a database. The checks against the Docker test database are in
 * db/sqlserver/check-connector.js (plain Node), because the mssql package cannot be
 * loaded inside Jest.
 */

const fs = require("fs");
const path = require("path");
const { executeQuery, testConnection, closeAll } = require("../connectors/sqlServer");

const realConn = {
  host: "localhost",
  port: 1433,
  database: "NotificationsTest",
  username: "readonly_user",
  password: "not-used-in-these-tests",
};

afterAll(async () => {
  await closeAll();
});

describe("Unsafe queries are blocked before reaching the database (Story 2.2, #66)", () => {
  const bad = [
    "DELETE FROM dbo.Invoices",
    "DROP TABLE dbo.Invoices",
    "UPDATE dbo.Invoices SET Paid = 1",
    "INSERT INTO dbo.Items (ItemCode) VALUES ('X')",
    "ALTER TABLE dbo.Items ADD Extra INT",
    "TRUNCATE TABLE dbo.Invoices",
    "SELECT 1; DROP TABLE dbo.Invoices",
    "EXEC sp_who",
  ];
  test.each(bad)("blocks: %s", async (queryText) => {
    await expect(executeQuery(realConn, { kind: "sql", queryText }, {}, {})).rejects.toThrow(/Query blocked/);
  });
});

describe("Production-looking hosts are blocked (Story 7.2, #224)", () => {
  const prod = { ...realConn, host: "sql-prod-01.company.com" };
  test("executeQuery refuses it", async () => {
    await expect(executeQuery(prod, { kind: "sql", queryText: "SELECT 1" }, {}, {})).rejects.toThrow(/production/i);
  });
  test("testConnection refuses it", async () => {
    const r = await testConnection(prod);
    expect(r.ok).toBe(false);
  });
});

describe("Other databases still use the mock engine (Story 7.2, #222)", () => {
  const mockConn = { host: "localhost", port: 1433, database: "SalesTest", username: "sa", password: "x" };

  test("returns raw { columns, rows } from the demo data", async () => {
    const r = await executeQuery(mockConn, { kind: "sql", queryText: "SELECT InvoiceNo FROM Invoices" }, {}, { limit: 3 });
    expect(r.columns).toEqual(["InvoiceNo"]);
    expect(r.rows.length).toBeLessThanOrEqual(3);
    expect(r.rows.length).toBeGreaterThan(0);
  });

  test("testConnection answers ok in mock mode", async () => {
    const r = await testConnection(mockConn);
    expect(r.ok).toBe(true);
  });
});

describe("TLS validation is never switched off (Story 7.2, #226)", () => {
  function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "tests") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (entry.name.endsWith(".js")) out.push(full);
    }
    return out;
  }
  test("rejectUnauthorized:false does not appear in the server code", () => {
    const offenders = walk(path.join(__dirname, ".."))
      .filter((f) => /rejectUnauthorized\s*:\s*false/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});