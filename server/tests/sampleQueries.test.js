/**
 * Tests for Story 5.6 - Create Five Sample Saved Queries
 * Ref: Backlog ID 168, Sub-tasks 169 - 175, FR-22, FR-23, US-10
 *
 * Verifies that all 5 sample queries:
 * 1. Overdue Invoices (> 7 days) (SQL Server) - Sub-task 169
 * 2. Items Below Reorder Level (SQL Server) - Sub-task 170
 * 3. Open Receivables Summary (SQL Server) - Sub-task 171
 * 4. Purchase Orders Past Promised Date (Service Layer) - Sub-task 172
 * 5. Daily Sales Summary (SAP HANA) - Sub-task 173
 *
 * Execute cleanly against mock datasets and return the agreed common format:
 * { columns: string[], rows: any[][], meta: { source: string, rowCount: number } }
 */

const { executeQuery } = require("../core/executeQuery");
const { runQuery } = require("../core/runQuery");

const Query = require("../models/Query");
const Connection = require("../models/Connection");

const { encryptPassword } = require("../security/crypto");

const {
  SAMPLE_QUERIES,
  getSampleQueries,
  getSampleQueryByName
} = require("../sampleQueries/sampleQueries");

describe("Story 5.6 - Create Five Sample Saved Queries", () => {
  let mockConnections = {};

  beforeAll(() => {
    process.env.ENCRYPTION_KEY =
      "597001adc930d4a1750761523a49cd1ebbb2cce786e481718e7c242e1abb87a3";

    const encryptedPass = encryptPassword("Password123!");

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

    // Mock Connection.findById to resolve the appropriate connection document.
    // Supports the Mongoose query chain:
    // Connection.findById(id).select("+passwordEncrypted").lean()

    jest.spyOn(Connection, "findById").mockImplementation((id) => {
      const idStr = String(id);

      let match = null;

      for (const conn of Object.values(mockConnections)) {
        if (String(conn._id) === idStr) {
          match = conn;
        }
      }

      return {
        select: () => ({
          lean: () => Promise.resolve(match ? { ...match } : null)
        }),
        lean: () => Promise.resolve(match ? { ...match } : null)
      };
    });
  });

  // =========================================================================
  // Sub-task 174: Define expected output columns and mapping
  // =========================================================================

  describe("Sub-task 174: Define Expected Columns and Column Mapping", () => {
    test("defines exactly 5 sample queries with valid schemas and mappings", () => {
      const queries = getSampleQueries();

      expect(queries.length).toBe(5);

      for (const q of queries) {
        expect(q.name).toBeTruthy();

        expect(["sql", "odata"]).toContain(q.kind);

        expect(["SQLServer", "HANA", "ServiceLayer"]).toContain(
          q.targetConnectionType
        );

        expect(Array.isArray(q.expectedColumns)).toBe(true);

        expect(q.expectedColumns.length).toBeGreaterThan(0);

        expect(Array.isArray(q.columnMapping)).toBe(true);
      }
    });
  });

  // =========================================================================
  // Sub-task 169: Overdue Invoices Query (SQL Server)
  // =========================================================================

  describe("Sub-task 169: Overdue Invoices Query (SQL Server)", () => {
    test("derives DaysOverdue, filters unpaid invoices > 7 days, and returns common format", async () => {
      const querySpec = getSampleQueryByName("Overdue Invoices");

      expect(querySpec).toBeDefined();

      const queryDoc = {
        _id: "672000000000000000000010",
        ...querySpec,
        connectionId: mockConnections["SQLServer"]._id
      };

      const result = await executeQuery(queryDoc, {
        "@asOfDate": "2026-11-01",
        "@thresholdDays": 7
      });

      expect(result).toBeDefined();

      expect(result.columns).toEqual(querySpec.expectedColumns);

      expect(Array.isArray(result.rows)).toBe(true);

      expect(result.rows.length).toBeGreaterThan(0);

      expect(result.meta.source).toBe("SQLServer");

      expect(result.meta.rowCount).toBe(result.rows.length);

      // Verify every returned invoice is overdue by more than 7 days.

      const daysOverdueIdx = result.columns.indexOf("DaysOverdue");

      expect(daysOverdueIdx).toBeGreaterThanOrEqual(0);

      for (const row of result.rows) {
        expect(Number(row[daysOverdueIdx])).toBeGreaterThan(7);
      }
    });
  });

  // =========================================================================
  // Sub-task 170: Items Below Reorder Level Query (SQL Server)
  // =========================================================================

  describe("Sub-task 170: Items Below Reorder Level Query (SQL Server)", () => {
    test("filters items where QtyAvailable < ReorderLevel and returns common format", async () => {
      const querySpec = getSampleQueryByName("Items Below Reorder Level");

      expect(querySpec).toBeDefined();

      const queryDoc = {
        _id: "672000000000000000000020",
        ...querySpec,
        connectionId: mockConnections["SQLServer"]._id
      };

      const result = await executeQuery(queryDoc);

      expect(result).toBeDefined();

      expect(result.columns).toEqual(querySpec.expectedColumns);

      expect(Array.isArray(result.rows)).toBe(true);

      expect(result.rows.length).toBeGreaterThan(0);

      expect(result.meta.source).toBe("SQLServer");

      expect(result.meta.rowCount).toBe(result.rows.length);

      // Verify QtyAvailable is below ReorderLevel.

      const qtyIdx = result.columns.indexOf("QtyAvailable");

      const reorderIdx = result.columns.indexOf("ReorderLevel");

      expect(qtyIdx).toBeGreaterThanOrEqual(0);

      expect(reorderIdx).toBeGreaterThanOrEqual(0);

      for (const row of result.rows) {
        expect(Number(row[qtyIdx])).toBeLessThan(
          Number(row[reorderIdx])
        );
      }
    });
  });

  // =========================================================================
  // Sub-task 171: Open Receivables Summary Query (SQL Server)
  // =========================================================================

  describe("Sub-task 171: Open Receivables Summary Query (SQL Server)", () => {
    test("groups unpaid balances by customer and returns aggregated columns", async () => {
      const querySpec = getSampleQueryByName("Open Receivables Summary");

      expect(querySpec).toBeDefined();

      const queryDoc = {
        _id: "672000000000000000000030",
        ...querySpec,
        connectionId: mockConnections["SQLServer"]._id
      };

      const result = await executeQuery(queryDoc);

      expect(result).toBeDefined();

      expect(result.columns).toEqual(querySpec.expectedColumns);

      expect(Array.isArray(result.rows)).toBe(true);

      expect(result.rows.length).toBeGreaterThan(0);

      expect(result.meta.source).toBe("SQLServer");

      expect(result.meta.rowCount).toBe(result.rows.length);

      // Verify aggregated values are positive.

      const countIdx = result.columns.indexOf("OpenInvoicesCount");

      const totalIdx = result.columns.indexOf("TotalReceivable");

      for (const row of result.rows) {
        expect(Number(row[countIdx])).toBeGreaterThan(0);

        expect(Number(row[totalIdx])).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // Sub-task 172: Purchase Orders Past Promised Date (Service Layer)
  // =========================================================================

  describe("Sub-task 172: Purchase Orders Past Promised Date Query (Service Layer)", () => {
    test("retrieves pending purchase orders via OData filter and returns common format", async () => {
      const querySpec = getSampleQueryByName(
        "Purchase Orders Past Promised Date"
      );

      expect(querySpec).toBeDefined();

      const queryDoc = {
        _id: "672000000000000000000040",
        ...querySpec,
        connectionId: mockConnections["ServiceLayer"]._id
      };

      const result = await executeQuery(queryDoc);

      expect(result).toBeDefined();

      expect(result.columns).toEqual(querySpec.expectedColumns);

      expect(Array.isArray(result.rows)).toBe(true);

      expect(result.rows.length).toBeGreaterThan(0);

      expect(result.meta.source).toBe("ServiceLayer");

      expect(result.meta.rowCount).toBe(result.rows.length);

      // Verify returned purchase orders are pending.

      const statusIdx = result.columns.indexOf("Status");

      for (const row of result.rows) {
        expect(row[statusIdx]).toBe("Pending");
      }
    });
  });

  // =========================================================================
  // Sub-task 173: Daily Sales Summary (SAP HANA)
  // =========================================================================

  describe("Sub-task 173: Daily Sales Summary Query (SAP HANA)", () => {
    test("executes HANA-dialect query with quoted table and returns common format", async () => {
      const querySpec = getSampleQueryByName("Daily Sales Summary");

      expect(querySpec).toBeDefined();

      const queryDoc = {
        _id: "672000000000000000000050",
        ...querySpec,
        connectionId: mockConnections["HANA"]._id
      };

      const result = await executeQuery(queryDoc);

      expect(result).toBeDefined();

      expect(result.columns).toEqual(querySpec.expectedColumns);

      expect(Array.isArray(result.rows)).toBe(true);

      expect(result.rows.length).toBeGreaterThan(0);

      expect(result.meta.source).toBe("HANA");

      expect(result.meta.rowCount).toBe(result.rows.length);
    });
  });

  // =========================================================================
  // Sub-task 175: Integration Testing via runQuery()
  // =========================================================================

  describe("Sub-task 175: Integration Testing via runQuery()", () => {
    test("executes all 5 sample queries via runQuery(queryId, params)", async () => {
      const queries = getSampleQueries();

      for (let i = 0; i < queries.length; i++) {
        const q = queries[i];

        const fakeId = `67200000000000000000009${i}`;

        const queryDoc = {
          _id: fakeId,
          ...q,
          connectionId: mockConnections[q.targetConnectionType]._id
        };

        jest.spyOn(Query, "findById").mockReturnValue({
          lean: () => Promise.resolve(queryDoc)
        });

        const result = await runQuery(fakeId, {
          "@asOfDate": "2026-11-01"
        });

        expect(result).toBeDefined();

        expect(Array.isArray(result.columns)).toBe(true);

        expect(Array.isArray(result.rows)).toBe(true);

        expect(result.columns).toEqual(q.expectedColumns);

        expect(result.meta.rowCount).toBe(result.rows.length);

        expect(result.meta.source).toBe(q.targetConnectionType);
      }
    });
  });
});