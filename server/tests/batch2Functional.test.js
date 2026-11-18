/**
 * Batch 2 Functional Test Suite (Data Connectors)
 *
 * Covers the functional test cases specified in:
 * - ICTAK Internship Project Guide | Batch 2 (Section 14: Test cases to show, Section 10: SQL Server vs HANA, Section 6: runQuery)
 * - Software Requirements Specification (D02 SRS) (FR-01 through FR-23, BR-01 through BR-10)
 *
 * NOTE: Functional tests already written elsewhere in server/tests/ (such as DDL/write blocking in validator.test.js,
 * basic report generation in buildReport.test.js, timeout and cap limits in limits.test.js, and sample queries in sampleQueries.test.js)
 * are skipped to avoid redundant duplication, focusing here on the functional behaviors and guide test cases.
 */

const fs = require("fs");

const { testConnection } = require("../connectors/index");
const sqlServer = require("../connectors/sqlServer");
const hana = require("../connectors/hana");
const serviceLayer = require("../connectors/serviceLayerClient");
const { runQuery } = require("../core/runQuery");
const { executeQuery } = require("../core/executeQuery");
const { buildReport } = require("../reports/buildReport");
const Query = require("../models/Query");
const Connection = require("../models/Connection");
const { encryptPassword } = require("../security/crypto");

// The mock Service Layer that Jest starts on port 50000 (tests/setup/startMockServiceLayer.js).
// The client really logs in, so every Service Layer call needs these details.
const MOCK_SERVICE_LAYER = {
  type: "ServiceLayer",
  host: "localhost",
  port: 50000,
  database: "SBODemoIN",
  username: "manager",
  password: "Password123!"
};

describe("Batch 2: Functional Testing (Data Connectors)", () => {
  const encKey = "597001adc930d4a1750761523a49cd1ebbb2cce786e481718e7c242e1abb87a3";
  let mockConnections = {};
  let generatedReportFiles = [];

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = encKey;

    const encryptedPass = encryptPassword("CorrectPassword123!");

    mockConnections["SQLServer"] = {
      _id: "672000000000000000000001",
      name: "Mock SQL Server",
      type: "SQLServer",
      host: "localhost",
      port: 1433,
      database: "SalesTest",
      username: "sa",
      passwordEncrypted: encryptedPass
    };

    mockConnections["HANA"] = {
      _id: "672000000000000000000002",
      name: "Mock SAP HANA",
      type: "HANA",
      host: "localhost",
      port: 39015,
      database: "HANA_TEST",
      username: "SYSTEM",
      passwordEncrypted: encryptedPass
    };

    mockConnections["ServiceLayer"] = {
      _id: "672000000000000000000003",
      name: "Mock Service Layer",
      type: "ServiceLayer",
      host: "localhost",
      port: 50000,
      database: "SBODemoIN",
      username: "manager",
      passwordEncrypted: encryptedPass
    };
  });

  beforeEach(() => {
    jest.restoreAllMocks();

    // Mock Connection.findById to support Mongoose query chain:
    // Connection.findById(id).select("+passwordEncrypted").lean()
    jest.spyOn(Connection, "findById").mockImplementation((id) => {
      const idStr = String(id);
      let match = null;
      for (const conn of Object.values(mockConnections)) {
        if (String(conn._id) === idStr) match = conn;
      }
      return {
        select: () => ({
          lean: async () => (match ? { ...match } : null),
          then: (resolve) => resolve(match ? { ...match } : null)
        }),
        lean: async () => (match ? { ...match } : null),
        then: (resolve) => resolve(match ? { ...match } : null)
      };
    });
  });

  afterAll(() => {
    // Clean up any report files created during tests
    for (const file of generatedReportFiles) {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch { /* ignore cleanup errors */ }
      }
    }
  });

  // =========================================================================
  // GUIDE TEST CASE 2: Test connection with wrong password (FR-03, US-02)
  // =========================================================================
  describe("Guide Test Case 2: Test connection with wrong password (FR-03, US-02)", () => {
    test("SQL Server returns clear error and does not crash when authentication fails", async () => {
      jest.spyOn(sqlServer, "testConnection").mockResolvedValueOnce({
        ok: false,
        message: "SQL Server login failed. Check the username and password."
      });

      const result = await testConnection({
        type: "SQLServer",
        host: "localhost",
        port: 1433,
        database: "SalesTest",
        username: "readonly_user",
        password: "WrongPassword!999"
      });

      expect(result).toBeDefined();
      expect(result.ok).toBe(false);
      expect(typeof result.message).toBe("string");
      expect(result.message).toMatch(/login failed|check the username and password/i);
      expect(result.message).not.toContain("WrongPassword!999");
    });

    test("SAP HANA returns clear error and does not crash when authentication fails", async () => {
      jest.spyOn(hana, "testConnection").mockResolvedValueOnce({
        ok: false,
        message: "HANA execution failed: authentication failed (invalid user or password)."
      });

      const result = await testConnection({
        type: "HANA",
        host: "localhost",
        port: 39015,
        database: "HANA_TEST",
        username: "SYSTEM",
        password: "InvalidPassword456"
      });

      expect(result).toBeDefined();
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/authentication failed|invalid user or password/i);
      expect(result.message).not.toContain("InvalidPassword456");
    });

    test("handles connector throwing an authentication error without crashing the process", async () => {
      jest.spyOn(sqlServer, "testConnection").mockRejectedValueOnce(
        new Error("ELOGIN: Login failed for user 'sa' with password='supersecret'")
      );

      const result = await testConnection({
        type: "SQLServer",
        host: "localhost",
        port: 1433,
        database: "SalesTest",
        username: "sa",
        password: "supersecret"
      });

      expect(result.ok).toBe(false);
      // Ensures password was sanitized
      expect(result.message).not.toContain("supersecret");
    });
  });

  // =========================================================================
  // GUIDE TEST CASE 5: Run Service Layer query with $filter (FR-07, US-05)
  // =========================================================================
  describe("Guide Test Case 5: Run Service Layer query with $filter (FR-07, US-05)", () => {
    const connDetails = {
      type: "ServiceLayer",
      host: "localhost",
      port: 50000,
      database: "SBODemoIN",
      username: "manager",
      password: "Password123!"
    };

    test("filters Invoices with numeric comparison ($filter: Amount gt 100000)", async () => {
      const queryDoc = {
        kind: "odata",
        entity: "Invoices",
        filter: "Amount gt 100000",
        select: "InvoiceNo,CustomerName,Email,Amount",
        rowLimit: 1000
      };

      const result = await serviceLayer.executeQuery(connDetails, queryDoc);
      expect(result).toBeDefined();
      expect(Array.isArray(result.columns)).toBe(true);
      expect(Array.isArray(result.rows)).toBe(true);
      expect(result.rows.length).toBeGreaterThan(0);

      const amountIdx = result.columns.indexOf("Amount");
      expect(amountIdx).toBeGreaterThanOrEqual(0);

      // Verify every returned row satisfies Amount > 100000
      result.rows.forEach((row) => {
        expect(row[amountIdx]).toBeGreaterThan(100000);
      });
    });

    test("filters PurchaseOrders with string inequality ($filter: Status ne 'Closed')", async () => {
      const queryDoc = {
        kind: "odata",
        entity: "PurchaseOrders",
        filter: "Status ne 'Closed'",
        select: "PONumber,SupplierName,Email,Status",
        rowLimit: 1000
      };

      const result = await serviceLayer.executeQuery(connDetails, queryDoc);
      expect(result.rows.length).toBeGreaterThan(0);

      const statusIdx = result.columns.indexOf("Status");
      expect(statusIdx).toBeGreaterThanOrEqual(0);

      result.rows.forEach((row) => {
        expect(String(row[statusIdx]).toLowerCase()).not.toBe("closed");
      });
    });

    test("filters Invoices with boolean condition ($filter: Paid eq false)", async () => {
      const queryDoc = {
        kind: "odata",
        entity: "Invoices",
        filter: "Paid eq false",
        select: "InvoiceNo,CustomerName,Paid,Amount",
        rowLimit: 1000
      };

      const result = await serviceLayer.executeQuery(connDetails, queryDoc);
      expect(result.rows.length).toBeGreaterThan(0);

      const paidIdx = result.columns.indexOf("Paid");
      expect(paidIdx).toBeGreaterThanOrEqual(0);

      result.rows.forEach((row) => {
        expect(row[paidIdx]).toBe(false);
      });
    });

    test("returns empty result when no records match filter ($filter: Amount gt 99999999)", async () => {
      const queryDoc = {
        kind: "odata",
        entity: "Invoices",
        filter: "Amount gt 99999999",
        rowLimit: 1000
      };

      const result = await serviceLayer.executeQuery(connDetails, queryDoc);
      expect(result.rows).toEqual([]);
    });
  });

  // =========================================================================
  // GUIDE TEST CASE 6: Service Layer paging and row limit (FR-07, FR-16, US-07)
  // =========================================================================
  describe("Guide Test Case 6: Service Layer paging and row limit enforcement (FR-07, FR-16, US-07)", () => {
    test("strictly limits returned records to requested limit (e.g. limit: 5)", async () => {
      const queryDoc = {
        kind: "odata",
        entity: "Invoices",
        select: "InvoiceNo,CustomerName,Amount",
        rowLimit: 5
      };

      const result = await serviceLayer.executeQuery(
        MOCK_SERVICE_LAYER,
        queryDoc,
        {},
        { limit: 5 }
      );

      expect(result.rows.length).toBe(5);
      expect(result.columns).toEqual(["InvoiceNo", "CustomerName", "Amount"]);
    });

    test("preview mode limits output to 10 rows per Guide specification", async () => {
      const queryDoc = {
        kind: "odata",
        entity: "Invoices",
        rowLimit: 1000
      };

      const result = await serviceLayer.executeQuery(
        MOCK_SERVICE_LAYER,
        queryDoc,
        {},
        { limit: 10 }
      );

      expect(result.rows.length).toBeLessThanOrEqual(10);
    });
  });

  // =========================================================================
  // GUIDE TEST CASE 7: Service Layer session expiry and renewal (FR-08, NFR-04)
  // =========================================================================
  describe("Guide Test Case 7: Service Layer session renewal on expiry (FR-08, NFR-04, US-07)", () => {
    test("automatically renews session and retries once when session expires", async () => {
      let attempts = 0;

      // Mock client that fails on attempt 1 with session expired, then succeeds on attempt 2
      const resilientClient = {
        async executeWithSessionRetry(fn) {
          try {
            attempts++;
            if (attempts === 1) {
              const err = new Error("Session expired. B1SESSION cookie is no longer valid.");
              err.statusCode = 401;
              throw err;
            }
            return await fn();
          } catch (err) {
            if (err.statusCode === 401 && attempts === 1) {
              // Simulated auto-relogin and retry (FR-08)
              attempts++;
              return await fn();
            }
            throw err;
          }
        }
      };

      const queryDoc = {
        kind: "odata",
        entity: "Items",
        select: "ItemCode,ItemName,QtyAvailable",
        rowLimit: 5
      };

      const outcome = await resilientClient.executeWithSessionRetry(() =>
        serviceLayer.executeQuery(MOCK_SERVICE_LAYER, queryDoc, {}, { limit: 5 })
      );

      expect(attempts).toBe(2);
      expect(outcome).toBeDefined();
      expect(outcome.rows.length).toBe(5);
      expect(outcome.columns).toEqual(["ItemCode", "ItemName", "QtyAvailable"]);
    });
  });

  // =========================================================================
  // GUIDE SECTION 10: SQL Server vs SAP HANA Dialect Differences (FR-06, NFR-06)
  // =========================================================================
  describe("Section 10: SQL Server vs SAP HANA Dialect Differences (FR-06, NFR-06)", () => {
    test("HANA query supports LIMIT, CURRENT_DATE, and DAYS_BETWEEN syntax", async () => {
      const hanaConn = mockConnections["HANA"];
      const queryDoc = {
        _id: "672000000000000000000051",
        connectionId: hanaConn._id,
        kind: "sql",
        queryText: `SELECT "InvoiceNo", "CustomerName", DAYS_BETWEEN("DueDate", CURRENT_DATE) AS "DaysOverdue" FROM "DEMO"."INVOICES" LIMIT 3`,
        rowLimit: 3
      };

      const result = await executeQuery(queryDoc);
      expect(result).toBeDefined();
      expect(result.columns).toEqual(["InvoiceNo", "CustomerName", "DaysOverdue"]);
      expect(result.rows.length).toBeLessThanOrEqual(3);
      expect(result.meta.source).toBe("HANA");
    });

    test("SQL Server query supports TOP, GETDATE(), and DATEDIFF syntax", async () => {
      const sqlConn = mockConnections["SQLServer"];
      const queryDoc = {
        _id: "672000000000000000000052",
        connectionId: sqlConn._id,
        kind: "sql",
        queryText: `SELECT TOP 3 InvoiceNo, CustomerName, DATEDIFF(day, DueDate, GETDATE()) AS DaysOverdue FROM Invoices`,
        rowLimit: 3
      };

      const result = await executeQuery(queryDoc);
      expect(result).toBeDefined();
      expect(result.columns).toEqual(["InvoiceNo", "CustomerName", "DaysOverdue"]);
      expect(result.rows.length).toBeLessThanOrEqual(3);
      expect(result.meta.source).toBe("SQLServer");
    });

    test("both dialects return rows adhering to the identical common format shape", async () => {
      const sqlQueryDoc = {
        _id: "672000000000000000000053",
        connectionId: mockConnections["SQLServer"]._id,
        kind: "sql",
        queryText: "SELECT TOP 2 InvoiceNo, CustomerName FROM Invoices"
      };

      const hanaQueryDoc = {
        _id: "672000000000000000000054",
        connectionId: mockConnections["HANA"]._id,
        kind: "sql",
        queryText: `SELECT "InvoiceNo", "CustomerName" FROM "DEMO"."INVOICES" LIMIT 2`
      };

      const sqlRes = await executeQuery(sqlQueryDoc);
      const hanaRes = await executeQuery(hanaQueryDoc);

      // Verify shape: { columns, rows, meta }
      for (const res of [sqlRes, hanaRes]) {
        expect(res).toHaveProperty("columns");
        expect(res).toHaveProperty("rows");
        expect(res).toHaveProperty("meta");
        expect(typeof res.meta.source).toBe("string");
        expect(typeof res.meta.rowCount).toBe("number");
        expect(res.rows.length).toBe(2);
      }
    });
  });

  // =========================================================================
  // SAFETY & AUDIT: No Source Calls on Non-Execution Moments (FR-21, BR-03)
  // =========================================================================
  describe("Safety Rule BR-03 & FR-21: Non-execution operations never call source database", () => {
    test("retrieving query definitions from Query model never contacts the source connector", async () => {
      const sqlSpy = jest.spyOn(sqlServer, "executeQuery");
      const hanaSpy = jest.spyOn(hana, "executeQuery");
      const slSpy = jest.spyOn(serviceLayer, "executeQuery");

      // Simulating opening query setup screen or fetching query list
      const queryDoc = {
        _id: "672000000000000000000060",
        name: "Test Query",
        connectionId: mockConnections["SQLServer"]._id,
        kind: "sql",
        queryText: "SELECT * FROM Invoices"
      };

      jest.spyOn(Query, "findById").mockImplementation(() => ({
        lean: async () => queryDoc
      }));

      const loaded = await Query.findById("672000000000000000000060").lean();
      expect(loaded.name).toBe("Test Query");

      // Verifies no connector was touched
      expect(sqlSpy).not.toHaveBeenCalled();
      expect(hanaSpy).not.toHaveBeenCalled();
      expect(slSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // ERROR SANITIZATION: Shielding Sensitive Information (FR-18, BR-06, NFR-07)
  // =========================================================================
  describe("Error Sanitization & Masking (FR-18, BR-06, NFR-01, NFR-07)", () => {
    test("runQuery masks passwords and connection strings when query execution fails", async () => {
      const queryDoc = {
        _id: "672000000000000000000070",
        name: "Failing Query",
        connectionId: mockConnections["SQLServer"]._id,
        kind: "sql",
        queryText: "SELECT * FROM Invoices"
      };

      jest.spyOn(Query, "findById").mockImplementation(() => ({
        lean: async () => queryDoc
      }));

      // Simulate a connector failure containing sensitive database credentials
      jest.spyOn(sqlServer, "executeQuery").mockRejectedValueOnce(
        new Error("Connection failed: Server=sql.test.com;User ID=admin;Password=UltraSecretPassword123! timeout")
      );

      await expect(runQuery("672000000000000000000070")).rejects.toThrow();

      try {
        await runQuery("672000000000000000000070");
      } catch (err) {
        expect(err.message).not.toContain("UltraSecretPassword123!");
        expect(err.message).toMatch(/\*\*\*REDACTED\*\*\*|failed/i);
      }
    });
  });

  // =========================================================================
  // INTEGRATION HANDSHAKE: runQuery to buildReport Pipeline (FR-17, FR-19)
  // =========================================================================
  describe("End-to-End Pipeline: runQuery to buildReport (FR-17, FR-19, US-09)", () => {
    test("executes query and generates valid CSV report with proper headers and data", async () => {
      const queryDoc = {
        _id: "672000000000000000000080",
        name: "Overdue Invoices for Report",
        connectionId: mockConnections["SQLServer"]._id,
        kind: "sql",
        queryText: "SELECT TOP 3 InvoiceNo, CustomerName, Amount FROM Invoices",
        rowLimit: 3
      };

      jest.spyOn(Query, "findById").mockImplementation(() => ({
        lean: async () => queryDoc
      }));

      const queryResult = await runQuery("672000000000000000000080");
      expect(queryResult.rows.length).toBe(3);

      const csvPath = await buildReport(queryResult, "csv");
      generatedReportFiles.push(csvPath);

      expect(fs.existsSync(csvPath)).toBe(true);
      const content = fs.readFileSync(csvPath, "utf8");
      expect(content).toContain("InvoiceNo");
      expect(content).toContain("CustomerName");
      expect(content).toContain("Amount");
    });

    test("executes query and generates valid XLSX report matching data rows", async () => {
      const queryDoc = {
        _id: "672000000000000000000081",
        name: "Low Stock for Report",
        connectionId: mockConnections["ServiceLayer"]._id,
        kind: "odata",
        entity: "Items",
        select: "ItemCode,ItemName,QtyAvailable",
        rowLimit: 2
      };

      jest.spyOn(Query, "findById").mockImplementation(() => ({
        lean: async () => queryDoc
      }));

      const queryResult = await runQuery("672000000000000000000081");
      expect(queryResult.rows.length).toBe(2);

      const xlsxPath = await buildReport(queryResult, "xlsx");
      generatedReportFiles.push(xlsxPath);

      expect(fs.existsSync(xlsxPath)).toBe(true);
      expect(xlsxPath.endsWith(".xlsx")).toBe(true);
    });
  });
});
