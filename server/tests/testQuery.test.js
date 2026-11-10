/**
 * Tests for Story 5.2 - Test Queries and Preview Results
 * Ref: Backlog ID 141, Sub-tasks 142, 143, 144, 145, 146, FR-11, US-04, Figure 3.
 */

const { testQuery, testQueryTransient } = require("../services/queryService");
const Query = require("../models/Query");
const Connection = require("../models/Connection");
const { encryptPassword } = require("../security/crypto");

describe("Story 5.2 - Test Queries and Preview Results", () => {
  let mockHanaConnection;
  let mockSqlConnection;
  let mockServiceLayerConnection;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = "597001adc930d4a1750761523a49cd1ebbb2cce786e481718e7c242e1abb87a3";
    const encryptedPass = encryptPassword("SecretPass123!");

    mockHanaConnection = {
      _id: "672000000000000000000001",
      name: "Mock HANA DB",
      type: "HANA",
      host: "localhost",
      port: 39015,
      database: "HANA_TEST",
      username: "SYSTEM",
      passwordEncrypted: encryptedPass
    };

    mockSqlConnection = {
      _id: "672000000000000000000002",
      name: "Mock SQL Server",
      type: "SQLServer",
      host: "localhost",
      port: 1433,
      database: "SalesTest",
      username: "sa",
      passwordEncrypted: encryptedPass
    };

    mockServiceLayerConnection = {
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

    // Mock Connection.findById to resolve connection documents
    jest.spyOn(Connection, "findById").mockImplementation((id) => {
      const idStr = String(id);
      let match = null;
      if (idStr === String(mockHanaConnection._id)) match = mockHanaConnection;
      if (idStr === String(mockSqlConnection._id)) match = mockSqlConnection;
      if (idStr === String(mockServiceLayerConnection._id)) match = mockServiceLayerConnection;

      return {
        lean: () => Promise.resolve(match ? { ...match } : null)
      };
    });
  });

  // =========================================================================
  // Sub-task 142 & FR-11: Preview Limit (Maximum 10 rows in common format)
  // =========================================================================
  describe("Sub-task 142: Preview Row Limit (FR-11)", () => {
    test("returns at most 10 rows even when dataset contains more records", async () => {
      const mockQuery = {
        _id: "672000000000000000000010",
        name: "All Invoices Preview",
        connectionId: mockHanaConnection._id,
        kind: "sql",
        queryText: 'SELECT "InvoiceNo", "CustomerName", "Amount" FROM "INVOICES"',
        params: [],
        rowLimit: 1000
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(mockQuery)
      });

      const result = await testQuery(mockQuery._id);

      expect(result).toBeDefined();
      expect(Array.isArray(result.columns)).toBe(true);
      expect(Array.isArray(result.rows)).toBe(true);
      expect(result.rows.length).toBeLessThanOrEqual(10);
      expect(result.meta).toBeDefined();
      expect(result.meta.source).toBe("HANA");
      expect(result.meta.rowCount).toBe(result.rows.length);
    });

    test("throws 404 error if queryId does not exist", async () => {
      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(null)
      });

      await expect(testQuery("672000000000000000000099")).rejects.toThrow(/not found/i);
    });
  });

  // =========================================================================
  // Sub-task 143: Test Parameter Values
  // =========================================================================
  describe("Sub-task 143: Test Parameter Values", () => {
    test("merges runtime test parameters into query execution", async () => {
      const mockQuery = {
        _id: "672000000000000000000011",
        name: "Invoices Filtered by Date",
        connectionId: mockSqlConnection._id,
        kind: "sql",
        queryText: "SELECT InvoiceNo, CustomerName, DueDate, Amount FROM Invoices WHERE DueDate < @asOfDate",
        params: [{ name: "@asOfDate", defaultValue: "2026-10-01" }],
        rowLimit: 500
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(mockQuery)
      });

      const runtimeParams = { "@asOfDate": "2026-10-15" };
      const result = await testQuery(mockQuery._id, runtimeParams);

      expect(result).toBeDefined();
      expect(result.columns).toContain("InvoiceNo");
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.length).toBeLessThanOrEqual(10);
    });
  });

  // =========================================================================
  // Sub-task 145: Display Query Errors Clearly
  // =========================================================================
  describe("Sub-task 145: Query Error Handling and Sanitization", () => {
    test("rejects unsafe queries before execution and reports clear message", async () => {
      const unsafeQuery = {
        _id: "672000000000000000000012",
        name: "Unsafe Delete Query",
        connectionId: mockSqlConnection._id,
        kind: "sql",
        queryText: "DELETE FROM Invoices WHERE Amount > 1000",
        params: [],
        rowLimit: 100
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(unsafeQuery)
      });

      await expect(testQuery(unsafeQuery._id)).rejects.toThrow(/Query blocked/i);
    });

    test("transient query test rejects dangerous SQL injection attempts", async () => {
      const dangerousData = {
        name: "SQL Injection Probe",
        connectionId: mockSqlConnection._id,
        kind: "sql",
        queryText: "SELECT * FROM Invoices; DROP TABLE Invoices;"
      };

      await expect(testQueryTransient(dangerousData)).rejects.toThrow(/disallowed operation|DROP|Query blocked/i);
    });
  });

  // =========================================================================
  // Sub-task 146: Preview Across All Three Connectors
  // =========================================================================
  describe("Sub-task 146: Previews for SQL Server, HANA, and Service Layer", () => {
    test("previews SQL Server query results (capped at 10 rows)", async () => {
      const sqlQuery = {
        _id: "672000000000000000000013",
        name: "SQL Server Invoice Test",
        connectionId: mockSqlConnection._id,
        kind: "sql",
        queryText: "SELECT InvoiceNo, CustomerName, Amount FROM Invoices",
        params: []
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(sqlQuery)
      });

      const result = await testQuery(sqlQuery._id);
      expect(result.columns).toEqual(expect.arrayContaining(["InvoiceNo", "CustomerName", "Amount"]));
      expect(result.rows.length).toBeLessThanOrEqual(10);
      expect(result.meta.source).toBe("SQLServer");
    });

    test("previews SAP HANA query results (capped at 10 rows)", async () => {
      const hanaQuery = {
        _id: "672000000000000000000014",
        name: "SAP HANA Sales Summary Test",
        connectionId: mockHanaConnection._id,
        kind: "sql",
        queryText: 'SELECT "Date", "Branch", "TotalSales" FROM "SALESSUMMARY"',
        params: []
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(hanaQuery)
      });

      const result = await testQuery(hanaQuery._id);
      expect(result.columns).toEqual(expect.arrayContaining(["Date", "Branch", "TotalSales"]));
      expect(result.rows.length).toBeLessThanOrEqual(10);
      expect(result.meta.source).toBe("HANA");
    });

    test("previews SAP Service Layer OData query results (capped at 10 rows)", async () => {
      const serviceLayerQuery = {
        _id: "672000000000000000000015",
        name: "Service Layer Invoices Test",
        connectionId: mockServiceLayerConnection._id,
        kind: "odata",
        entity: "Invoices",
        filter: "Paid eq false",
        select: "InvoiceNo,CustomerName,Amount"
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(serviceLayerQuery)
      });

      const result = await testQuery(serviceLayerQuery._id);
      expect(result.columns).toEqual(expect.arrayContaining(["InvoiceNo", "CustomerName", "Amount"]));
      expect(result.rows.length).toBeLessThanOrEqual(10);
      expect(result.meta.source).toBe("ServiceLayer");
    });

    test("previews transient query directly from editor form before saving", async () => {
      const transientFormInput = {
        connectionId: mockHanaConnection._id,
        kind: "sql",
        queryText: 'SELECT "ItemCode", "ItemName", "QtyAvailable" FROM "ITEMS"',
        params: []
      };

      const result = await testQueryTransient(transientFormInput);
      expect(result.columns).toEqual(expect.arrayContaining(["ItemCode", "ItemName", "QtyAvailable"]));
      expect(result.rows.length).toBeLessThanOrEqual(10);
      expect(result.meta.source).toBe("HANA");
    });

    test("applies columnMapping during query preview", async () => {
      const queryWithMapping = {
        connectionId: mockSqlConnection._id,
        kind: "sql",
        queryText: "SELECT InvoiceNo, CustomerName, Amount FROM Invoices",
        params: [],
        columnMapping: [
          { source: "InvoiceNo", common: "BillNumber" },
          { source: "CustomerName", common: "ClientName" }
        ]
      };

      const result = await testQueryTransient(queryWithMapping);
      expect(result.columns).toEqual(["BillNumber", "ClientName", "Amount"]);
      expect(result.rows.length).toBeLessThanOrEqual(10);
      expect(result.meta.source).toBe("SQLServer");
    });
  });
});
