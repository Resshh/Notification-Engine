/**
 * Unit and Integration Tests — Field Mapping
 * Story 5.5 | Sprint 2
 * Ref: FR-10, FR-12, FR-21, Backlog sub-tasks #164, #165, #166, #167
 *
 * Verifies that field mapping:
 * 1. Renames columns according to saved rules.
 * 2. Leaves unmapped columns untouched.
 * 3. Works across all three connectors: SQL Server, SAP HANA, and Service Layer.
 * 4. Is applied once inside the common formatter.
 * 5. Handles both array schemas and object dictionaries.
 */

const {
  normalizeMapping,
  toMappingArray,
  applyFieldMapping
} = require("../core/fieldMapping");

const { formatResult } = require("../core/formatter");

// ─── Unit Tests: fieldMapping utility ──────────────────────────────────────────

describe("Field Mapping Utility (server/core/fieldMapping.js)", () => {
  describe("normalizeMapping", () => {
    test("normalizes key-value dictionary object", () => {
      const input = { DocNum: "InvoiceNo", DocTotal: "Amount" };
      const map = normalizeMapping(input);
      expect(map.get("DocNum")).toBe("InvoiceNo");
      expect(map.get("DocTotal")).toBe("Amount");
      expect(map.size).toBe(2);
    });

    test("normalizes array of { source, common } objects (Mongoose schema)", () => {
      const input = [
        { source: "DocNum", common: "InvoiceNo" },
        { source: "CardName", common: "CustomerName" }
      ];
      const map = normalizeMapping(input);
      expect(map.get("DocNum")).toBe("InvoiceNo");
      expect(map.get("CardName")).toBe("CustomerName");
      expect(map.size).toBe(2);
    });

    test("normalizes array of [source, common] pairs", () => {
      const input = [
        ["DocNum", "InvoiceNo"],
        ["DocTotal", "Amount"]
      ];
      const map = normalizeMapping(input);
      expect(map.get("DocNum")).toBe("InvoiceNo");
      expect(map.get("DocTotal")).toBe("Amount");
      expect(map.size).toBe(2);
    });

    test("normalizes existing Map instance", () => {
      const input = new Map([["DocNum", "InvoiceNo"]]);
      const map = normalizeMapping(input);
      expect(map.get("DocNum")).toBe("InvoiceNo");
      expect(map.size).toBe(1);
    });

    test("trims whitespace from source and target names", () => {
      const input = { "  DocNum  ": "  InvoiceNo  " };
      const map = normalizeMapping(input);
      expect(map.get("DocNum")).toBe("InvoiceNo");
    });

    test("filters out empty or invalid mapping entries", () => {
      const input = [
        { source: "", common: "InvoiceNo" },
        { source: "DocTotal", common: "" },
        null,
        undefined,
        { source: "   ", common: "   " }
      ];
      const map = normalizeMapping(input);
      expect(map.size).toBe(0);
    });

    test("returns empty Map for null, undefined, or empty structures", () => {
      expect(normalizeMapping(null).size).toBe(0);
      expect(normalizeMapping(undefined).size).toBe(0);
      expect(normalizeMapping({}).size).toBe(0);
      expect(normalizeMapping([]).size).toBe(0);
    });
  });

  describe("toMappingArray", () => {
    test("converts dictionary object to Mongoose schema array", () => {
      const result = toMappingArray({ DocNum: "InvoiceNo", CardName: "CustomerName" });
      expect(result).toEqual([
        { source: "DocNum", common: "InvoiceNo" },
        { source: "CardName", common: "CustomerName" }
      ]);
    });

    test("normalizes array inputs and eliminates blanks", () => {
      const result = toMappingArray([
        { source: " DocNum ", common: " InvoiceNo " },
        { source: "", common: "Invalid" }
      ]);
      expect(result).toEqual([{ source: "DocNum", common: "InvoiceNo" }]);
    });
  });

  describe("applyFieldMapping", () => {
    test("renames mapped columns and leaves unmapped columns untouched", () => {
      const cols = ["DocNum", "CardName", "DocTotal", "CreatedDate"];
      const mapping = { DocNum: "InvoiceNo", DocTotal: "Amount" };
      const renamed = applyFieldMapping(cols, mapping);
      expect(renamed).toEqual(["InvoiceNo", "CardName", "Amount", "CreatedDate"]);
    });

    test("supports Mongoose array schema as mapping input", () => {
      const cols = ["DocNum", "CardName"];
      const mapping = [{ source: "DocNum", common: "InvoiceNo" }];
      const renamed = applyFieldMapping(cols, mapping);
      expect(renamed).toEqual(["InvoiceNo", "CardName"]);
    });

    test("returns original array when mapping is empty or null", () => {
      const cols = ["DocNum", "DocTotal"];
      expect(applyFieldMapping(cols, null)).toEqual(cols);
      expect(applyFieldMapping(cols, {})).toEqual(cols);
      expect(applyFieldMapping(cols, [])).toEqual(cols);
    });

    test("returns empty array when input columns is not an array", () => {
      expect(applyFieldMapping(null, { a: "b" })).toEqual([]);
    });
  });
});

// ─── Integration: Formatter & Connector Scenarios (Sub-task 167) ──────────────

describe("Field Mapping Across All Three Connectors (Sub-task #167)", () => {
  describe("SQL Server Connector Mapping", () => {
    test("maps SQL Server columns to common format", () => {
      const rawSqlServerResult = {
        columns: ["DocNum", "CardName", "DocTotal", "DocDueDate", "DaysOverdue"],
        rows: [
          ["INV-101", "ABC Supplies", 45000, "2026-10-15", 16],
          ["INV-102", "XYZ Global", 12500, "2026-10-20", 11]
        ]
      };

      const mapping = [
        { source: "DocNum", common: "InvoiceNo" },
        { source: "CardName", common: "CustomerName" },
        { source: "DocTotal", common: "Amount" }
      ];

      const formatted = formatResult(rawSqlServerResult, "SQLServer", mapping);

      expect(formatted.columns).toEqual([
        "InvoiceNo",
        "CustomerName",
        "Amount",
        "DocDueDate",
        "DaysOverdue"
      ]);
      expect(formatted.rows).toEqual([
        ["INV-101", "ABC Supplies", 45000, "2026-10-15", 16],
        ["INV-102", "XYZ Global", 12500, "2026-10-20", 11]
      ]);
      expect(formatted.meta).toEqual({
        source: "SQLServer",
        rowCount: 2
      });
    });
  });

  describe("SAP HANA Connector Mapping", () => {
    test("maps SAP HANA uppercase columns to common format", () => {
      const rawHanaResult = {
        columns: ["DOC_NUM", "CARD_NAME", "DOC_TOTAL", "POST_DATE"],
        rows: [
          ["HANA-5001", "Acme Industrial", 89000, "2026-11-01"],
          ["HANA-5002", "Global Tech", 34000, "2026-11-02"]
        ]
      };

      const mapping = [
        { source: "DOC_NUM", common: "InvoiceNo" },
        { source: "CARD_NAME", common: "CustomerName" },
        { source: "DOC_TOTAL", common: "TotalSales" }
      ];

      const formatted = formatResult(rawHanaResult, "HANA", mapping);

      expect(formatted.columns).toEqual([
        "InvoiceNo",
        "CustomerName",
        "TotalSales",
        "POST_DATE"
      ]);
      expect(formatted.rows.length).toBe(2);
      expect(formatted.meta.source).toBe("HANA");
      expect(formatted.meta.rowCount).toBe(2);
    });
  });

  describe("SAP Service Layer Connector Mapping", () => {
    test("maps SAP Service Layer OData entity fields to common format", () => {
      const rawServiceLayerResult = {
        columns: ["DocNum", "CardCode", "CardName", "DocDueDate", "DocTotal"],
        rows: [
          [2001, "C20000", "Microchip Corp", "2026-10-10", 7200],
          [2002, "C30000", "Solar Dynamics", "2026-10-12", 14500]
        ]
      };

      const mapping = {
        DocNum: "InvoiceNo",
        CardCode: "CustomerCode",
        CardName: "CustomerName",
        DocDueDate: "DueDate",
        DocTotal: "Amount"
      };

      const formatted = formatResult(rawServiceLayerResult, "ServiceLayer", mapping);

      expect(formatted.columns).toEqual([
        "InvoiceNo",
        "CustomerCode",
        "CustomerName",
        "DueDate",
        "Amount"
      ]);
      expect(formatted.rows[0]).toEqual([2001, "C20000", "Microchip Corp", "2026-10-10", 7200]);
      expect(formatted.meta.source).toBe("ServiceLayer");
      expect(formatted.meta.rowCount).toBe(2);
    });
  });
});
