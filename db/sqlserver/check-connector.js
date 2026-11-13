/**
 * Checks the real SQL Server connector against the Docker test database (Story 2.2, #65).
 * Needs: docker compose up -d (in this folder) and the mock data loaded.
 * Run from this folder:  node check-connector.js
 */
const path = require("path");
const { createRequire } = require("module");
const req = createRequire(path.join(__dirname, "../../server/package.json"));
req("dotenv").config({ path: path.join(__dirname, ".env") });
process.env.SQLSERVER_TRUST_LOCAL_CERT = "true"; // local Docker test database only

const { executeQuery, testConnection, closeAll } = req(
  "./connectors/sqlServer",
);

const conn = {
  host: "localhost",
  port: 1433,
  database: "NotificationsTest",
  username: "readonly_user",
  password: process.env.READONLY_PASSWORD,
};

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  await check("testConnection works for the read-only user", async () => {
    const r = await testConnection(conn);
    expect(r.ok === true, `expected ok, got: ${r.message}`);
  });

  await check("wrong password fails with a safe message", async () => {
    const r = await testConnection({ ...conn, password: "wrong-password" });
    expect(r.ok === false, "expected failure");
    expect(
      !/localhost|readonly_user|wrong-password/.test(r.message),
      `message leaks details: ${r.message}`,
    );
  });

  await check(
    "parameterised SELECT returns raw { columns, rows }",
    async () => {
      const q = {
        kind: "sql",
        queryText:
          "SELECT InvoiceNo, DATEDIFF(day, DueDate, @asOf) AS DaysOverdue FROM dbo.Invoices " +
          "WHERE Paid = 0 AND DATEDIFF(day, DueDate, @asOf) > 7",
      };
      const r = await executeQuery(conn, q, { asOf: "2026-11-01" }, {});
      expect(
        JSON.stringify(r.columns) ===
          JSON.stringify(["InvoiceNo", "DaysOverdue"]),
        `columns: ${r.columns}`,
      );
      expect(r.rows.length > 0, "expected at least one overdue invoice");
    },
  );

  await check("dates come back as YYYY-MM-DD text", async () => {
    const r = await executeQuery(
      conn,
      { kind: "sql", queryText: "SELECT TOP 1 DueDate FROM dbo.Invoices" },
      {},
      {},
    );
    expect(/^\d{4}-\d{2}-\d{2}$/.test(r.rows[0][0]), `got: ${r.rows[0][0]}`);
  });

  await check("row limit is applied", async () => {
    const r = await executeQuery(
      conn,
      { kind: "sql", queryText: "SELECT * FROM dbo.Invoices" },
      {},
      { limit: 3 },
    );
    expect(r.rows.length === 3, `expected 3 rows, got ${r.rows.length}`);
  });

  await check("DELETE is blocked", async () => {
    let blocked = false;
    try {
      await executeQuery(
        conn,
        { kind: "sql", queryText: "DELETE FROM dbo.Invoices" },
        {},
        {},
      );
    } catch (err) {
      blocked = /Query blocked/.test(err.message);
    }
    expect(blocked, "DELETE was not blocked");
  });

  await closeAll();
  console.log(
    failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`,
  );
  process.exit(failed === 0 ? 0 : 1);
})();
