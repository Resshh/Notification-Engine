/**
 * Field Mapping Utility
 * Story 5.5 | Sprint 2
 * Ref: FR-10, FR-12, FR-21, Backlog sub-tasks #164, #165, #167
 *
 * Normalizes and applies column renaming rules per query.
 * Applied ONCE inside the common formatter for all three data connectors
 * (SQL Server, SAP HANA, SAP Service Layer).
 */

/**
 * Normalizes any supported mapping structure into a standard Map of source -> common.
 * Supports:
 *  - Array of objects: [{ source: "DocNum", common: "InvoiceNo" }] (Mongoose schema)
 *  - Plain object dictionary: { DocNum: "InvoiceNo" }
 *  - Array of pairs: [["DocNum", "InvoiceNo"]]
 *  - Map instance: new Map([["DocNum", "InvoiceNo"]])
 *
 * @param {Array|object|Map|null} mapping - Raw column mapping definition
 * @returns {Map<string, string>} Normalized lookup map of source -> common
 */
function normalizeMapping(mapping) {
  const normalized = new Map();
  if (!mapping) return normalized;

  if (mapping instanceof Map) {
    for (const [src, target] of mapping.entries()) {
      const s = String(src || "").trim();
      const t = String(target || "").trim();
      if (s && t) normalized.set(s, t);
    }
    return normalized;
  }

  if (Array.isArray(mapping)) {
    for (const item of mapping) {
      if (!item) continue;
      // Pair format: ["DocNum", "InvoiceNo"]
      if (Array.isArray(item) && item.length >= 2) {
        const s = String(item[0] || "").trim();
        const t = String(item[1] || "").trim();
        if (s && t) normalized.set(s, t);
      } else if (typeof item === "object") {
        // Object schema format: { source: "DocNum", common: "InvoiceNo" }
        const s = String(item.source || "").trim();
        const t = String(item.common || "").trim();
        if (s && t) normalized.set(s, t);
      }
    }
    return normalized;
  }

  if (typeof mapping === "object") {
    // Plain object dictionary: { "DocNum": "InvoiceNo" }
    for (const [src, target] of Object.entries(mapping)) {
      const s = String(src || "").trim();
      const t = String(target || "").trim();
      if (s && t) normalized.set(s, t);
    }
    return normalized;
  }

  return normalized;
}

/**
 * Converts a mapping structure into an array of { source, common } objects.
 * Useful for normalizing incoming API payloads before saving to MongoDB.
 *
 * @param {Array|object|Map|null} mapping
 * @returns {Array<{ source: string, common: string }>}
 */
function toMappingArray(mapping) {
  const map = normalizeMapping(mapping);
  const result = [];
  for (const [source, common] of map.entries()) {
    result.push({ source, common });
  }
  return result;
}

/**
 * Applies column mapping to a list of raw column names.
 * Columns present in the mapping are renamed to their common-format names;
 * unmapped columns remain unchanged.
 *
 * @param {string[]} columns - Raw column names from connector
 * @param {Array|object|Map|null} mapping - Mapping definition
 * @returns {string[]} Renamed columns array
 */
function applyFieldMapping(columns, mapping) {
  if (!Array.isArray(columns)) return [];
  if (!mapping) return [...columns];

  const lookup = normalizeMapping(mapping);
  if (lookup.size === 0) return [...columns];

  return columns.map((col) => {
    const trimmed = typeof col === "string" ? col.trim() : String(col);
    return lookup.has(trimmed) ? lookup.get(trimmed) : col;
  });
}

module.exports = {
  normalizeMapping,
  toMappingArray,
  applyFieldMapping,
};
