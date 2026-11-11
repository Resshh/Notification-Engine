async function runQuery(queryId, params) {
  return {
    columns: [
      "InvoiceNo",
      "CustomerName",
      "Email",
      "DaysOverdue",
      "Amount"
    ],
    rows: [
      ["INV-101", "ABC Traders", "abc@test.com", 10, 25000],
      ["INV-102", "XYZ Stores", "xyz@test.com", 3, 8000]
    ],
    meta: {
      source: "Fake",
      rowCount: 2
    }
  };
}

module.exports = { runQuery };
