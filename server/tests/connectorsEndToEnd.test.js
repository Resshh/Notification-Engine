/**
 * Story 7.3 - Backend testing for the data connectors (SQL Server and SAP HANA)
 * Owner: Joice Mary Ajith
 *
 * These tests run the same path the app uses (executeQuery -> connector -> formatter)
 * with the database layer faked, so they need no MongoDB, no Docker and no network.
 * Real SQL Server behaviour is checked separately by db/sqlserver/check-connector.js.
 *
 * Covers: common result format, correct connector chosen, passwords decrypted only for the
 * connector and never leaked (errors, console), read-only blocking, row limit,
 * production host block (BR-02), unknown connection type.
 */

const { executeQuery } = require("../core/executeQuery");
const Connection = require("../models/Connection");
const { encryptPassword } = require("../security/crypto");

const SECRET = "Sup3rSecret!Pass";

let sqlConnection;
let hanaConnection;
let prodConnection;
let oddConnection;

function fakeFindById(docs) {
  jest.spyOn(Connection, "findById").mockImplementation((id) => {
    const match = docs.find((d) => String(d._id) === String(id));
    return {
      select: jest.fn().mockReturnThis(),
      lean: () => Promise.resolve(match ? { ...match } : null),
    };
  });
}

function sqlQuery(overrides = {}) {
  return {
    _id: "q-sql",
    name: "SQL Server test query",
    connectionId: "c-sql",
    kind: "sql",
    queryText: "SELECT InvoiceNo, CustomerName, Amount FROM Invoices",
    params: [],
    ...overrides,
  };
}

beforeAll(() => {
  process.env.ENCRYPTION_KEY =
    "597001adc930d4a1750761523a49cd1ebbb2cce786e481718e7c242e1abb87a3";

  const enc = encryptPassword(SECRET);
  const base = { host: "localhost", username: "tester", passwordEncrypted: enc };

  sqlConnection = { ...base, _id: "c-sql", name: "SQL", type: "SQLServer", port: 1433, database: "SalesTest" };
  hanaConnection = { ...base, _id: "c-hana", name: "HANA", type: "HANA", port: 39015, database: "HANA_TEST" };
  prodConnection = { ...base, _id: "c-prod", name: "Prod", type: "SQLServer", host: "sql-prod-01.company.com", port: 1433, database: "SalesTest" };
  oddConnection = { ...base, _id: "c-odd", name: "Odd", type: "Oracle", port: 1521, database: "X" };
});

beforeEach(() => {
  jest.restoreAllMocks();
  fakeFindById([sqlConnection, hanaConnection, prodConnection, oddConnection]);
});

afterAll(async () => {
  jest.restoreAllMocks();
  await require("../connectors/sqlServer").closeAll();
});

describe("Story 7.3 - SQL Server through executeQuery", () => {
  test("returns the common format with source SQLServer (test/mock mode)", async () => {
    const result = await executeQuery(sqlQuery());

    expect(result.columns).toEqual(["InvoiceNo", "CustomerName", "Amount"]);
    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.meta.source).toBe("SQLServer");
    expect(result.meta.rowCount).toBe(result.rows.length);
  });

  test("uses the sqlServer connector for SQL Server connections", async () => {
    const connector = require("../connectors/sqlServer");
    const spy = jest.spyOn(connector, "executeQuery");

    await executeQuery(sqlQuery());

    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("applies the row limit", async () => {
    const result = await executeQuery(sqlQuery({ rowLimit: 3 }));
    expect(result.rows.length).toBe(3);
    expect(result.meta.rowCount).toBe(3);
  });

  test("applies a runtime limit over the saved limit", async () => {
    const result = await executeQuery(sqlQuery({ rowLimit: 10 }), {}, { limit: 2 });
    expect(result.rows.length).toBe(2);
  });
});

describe("Story 7.3 - SAP HANA through executeQuery", () => {
  test("returns the common format with source HANA", async () => {
    const result = await executeQuery({
      _id: "q-hana",
      name: "HANA test query",
      connectionId: "c-hana",
      kind: "sql",
      queryText: 'SELECT "Date", "Branch", "TotalSales" FROM "SALESSUMMARY"',
      params: [],
    });

    expect(result.columns).toEqual(["Date", "Branch", "TotalSales"]);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.meta.source).toBe("HANA");
  });

  test("uses the HANA connector for HANA connections", async () => {
    const connector = require("../connectors/hana");
    const spy = jest.spyOn(connector, "executeQuery");

    await executeQuery({
      _id: "q-hana",
      name: "HANA test query",
      connectionId: "c-hana",
      kind: "sql",
      queryText: 'SELECT "Branch" FROM "SALESSUMMARY"',
      params: [],
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("Story 7.3 - passwords and credentials", () => {
  test("the connector receives the decrypted password and no ciphertext", async () => {
    const connector = require("../connectors/sqlServer");
    const spy = jest.spyOn(connector, "executeQuery").mockResolvedValue({
      columns: ["InvoiceNo"],
      rows: [["INV-1"]],
    });

    await executeQuery(sqlQuery());

    const details = spy.mock.calls[0][0];
    expect(details.password).toBe(SECRET);
    expect(details).not.toHaveProperty("passwordEncrypted");
  });

  test("the result never contains the password or connection details", async () => {
    const result = await executeQuery(sqlQuery());
    const text = JSON.stringify(result);

    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("passwordEncrypted");
    expect(text).not.toContain("tester");
  });

  test("an error that mentions the password is cleaned before it leaves executeQuery", async () => {
    const connector = require("../connectors/sqlServer");
    jest
      .spyOn(connector, "executeQuery")
      .mockRejectedValue(new Error(`Login failed for user: password=${SECRET}`));

    let message = "";
    try {
      await executeQuery(sqlQuery());
    } catch (e) {
      message = e.message;
    }

    expect(message).not.toBe("");
    expect(message).not.toContain(SECRET);
  });

  test("nothing printed to the console contains the password", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    await executeQuery(sqlQuery());
    await executeQuery(sqlQuery({ queryText: "DELETE FROM Invoices" })).catch(() => {});

    const printed = [log, warn, error]
      .flatMap((spy) => spy.mock.calls)
      .map((args) => args.map(String).join(" "))
      .join("\n");

    expect(printed).not.toContain(SECRET);
  });
});

describe("Story 7.3 - safety rules", () => {
  test.each([
    ["DELETE", "DELETE FROM Invoices"],
    ["UPDATE", "UPDATE Invoices SET Amount = 0"],
    ["DROP", "DROP TABLE Invoices"],
    ["two statements", "SELECT 1; DROP TABLE Invoices"],
  ])("blocks %s before it reaches the connector", async (_name, queryText) => {
    const connector = require("../connectors/sqlServer");
    const spy = jest.spyOn(connector, "executeQuery");

    await expect(executeQuery(sqlQuery({ queryText }))).rejects.toThrow(/Query blocked/);
    expect(spy).not.toHaveBeenCalled();
  });

  test("a production-looking host is refused (BR-02)", async () => {
    await expect(
      executeQuery(sqlQuery({ connectionId: "c-prod" }))
    ).rejects.toThrow(/production/i);
  });

  test("an unknown connection type gives a clear error", async () => {
    await expect(
      executeQuery(sqlQuery({ connectionId: "c-odd" }))
    ).rejects.toThrow(/Unknown connection type/);
  });

  test("a missing connection gives a clear error", async () => {
    await expect(
      executeQuery(sqlQuery({ connectionId: "does-not-exist" }))
    ).rejects.toThrow(/Connection not found/);
  });
});
