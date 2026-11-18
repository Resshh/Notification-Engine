/**
 * PDF Builder
 * Converts a common-format result { columns, rows } into a PDF table, with no extra dependency.
 * A4 landscape, Courier (fixed width) so columns line up, header repeated on every page, page numbers.
 *
 * ponytail: plain text table, Latin-1 characters only (others print as "?"), long cells are cut with "~".
 * If the client wants logos, colours or wrapped cells, switch this file to pdfkit; buildReport stays the same.
 */

const fs = require("fs");
const path = require("path");

const PAGE_W = 842;          // A4 landscape, in points
const PAGE_H = 595;
const MARGIN = 36;
const FONT_SIZE = 8;
const LEADING = 12;          // line height
const CHAR_W = FONT_SIZE * 0.6; // every Courier character is 0.6 em wide
const MAX_CHARS = Math.floor((PAGE_W - 2 * MARGIN) / CHAR_W);
const GAP = 2;               // spaces between columns
const LINES_PER_PAGE = Math.floor((PAGE_H - 2 * MARGIN) / LEADING) - 4; // minus title, blank, header, rule

const cellText = (v) => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, " ");
};

// PDF string literal: keep Latin-1, escape \ ( )
const pdfString = (s) => `(${s.replace(/[^\x20-\x7e\xa0-\xff]/g, "?").replace(/[\\()]/g, "\\$&")})`;

function layout(columns, rows) {
  const texts = rows.map((r) => columns.map((_, i) => cellText(Array.isArray(r) ? r[i] : "")));
  const widths = columns.map((c, i) => texts.reduce((w, t) => Math.max(w, t[i].length), String(c).length));
  const total = () => widths.reduce((a, b) => a + b, 0) + GAP * (widths.length - 1);
  // Shrink the widest column one character at a time until a line fits the page.
  while (total() > MAX_CHARS) {
    const i = widths.indexOf(Math.max(...widths));
    if (widths[i] <= 4) break;
    widths[i]--;
  }
  const fit = (s, n) => (s.length <= n ? s.padEnd(n) : s.slice(0, n - 1) + "~");
  const line = (cells) => cells.map((c, i) => fit(c, widths[i])).join(" ".repeat(GAP)).trimEnd();
  return {
    header: line(columns.map(String)),
    rule: "-".repeat(Math.min(total(), MAX_CHARS)),
    body: texts.length ? texts.map(line) : ["(no rows)"],
  };
}

/**
 * Writes a PDF file from common-format data and returns its absolute path.
 *
 * @param {{ columns: string[], rows: any[][], meta?: object }} result
 * @param {string} outputDir
 * @returns {string} Absolute path to the generated PDF file
 */
function writePdf(result, outputDir) {
  const columns = result.columns.length ? result.columns : ["Message"];
  const rows = result.columns.length ? result.rows : [["No data available"]];
  const { header, rule, body } = layout(columns, rows);

  const pages = [];
  for (let i = 0; i < body.length; i += LINES_PER_PAGE) pages.push(body.slice(i, i + LINES_PER_PAGE));

  const source = result.meta?.source ? ` | Source: ${result.meta.source}` : "";
  const title = `Report | Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC | ${rows.length} row(s)${source}`;

  // PDF objects; object number = index + 1. 1 = catalog, 2 = page tree, 3/4 = fonts.
  const objects = [null, null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>"];
  const add = (obj) => objects.push(obj);
  const pageIds = [];

  pages.forEach((lines, p) => {
    const stream = [
      `BT ${LEADING} TL ${MARGIN} ${PAGE_H - MARGIN - FONT_SIZE} Td`,
      `/F2 ${FONT_SIZE + 2} Tf ${pdfString(title)} Tj T* T*`,
      `/F2 ${FONT_SIZE} Tf ${pdfString(header)} Tj T*`,
      `/F1 ${FONT_SIZE} Tf ${pdfString(rule)} Tj T*`,
      ...lines.map((l) => `${pdfString(l)} Tj T*`),
      "ET",
      `BT /F1 ${FONT_SIZE} Tf ${MARGIN} ${MARGIN / 2} Td ${pdfString(`Page ${p + 1} of ${pages.length}`)} Tj ET`,
    ].join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`));
  });

  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets = objects.map((obj, i) => {
    const at = Buffer.byteLength(out, "latin1");
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    return at;
  });
  const xrefAt = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(outputDir, `report_${timestamp}_${Math.random().toString(36).substring(2, 7)}.pdf`);
  fs.writeFileSync(filePath, out, "latin1");
  return filePath;
}

module.exports = { writePdf };
