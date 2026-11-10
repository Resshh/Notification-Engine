
function toObjects(data) {
  if (!data || !Array.isArray(data.columns) || !Array.isArray(data.rows)) {
    throw new Error('Invalid data format: expected columns and rows arrays');
  }

  return data.rows.map((row) => {
    return Object.fromEntries(
      data.columns.map((column, index) => [column, row[index]])
    );
  });
}

function matches(row, conditions = []) {
  if (!Array.isArray(conditions)) {
    throw new Error('Conditions must be an array');
  }

  // An empty rule matches every row.
  if (conditions.length === 0) return true;

  return conditions.every((condition) => {
    const field = condition.field ?? condition.column;
    const operator = condition.operator ?? condition.op;
    const expected = condition.value;
    const actual = row[field];

    switch (operator) {
      case '>':
        return actual > expected;

      case '>=':
        return actual >= expected;

      case '<':
        return actual < expected;

      case '<=':
        return actual <= expected;

      case '=':
        return actual === expected;

      case '!=':
        return actual !== expected;

      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  });
}

module.exports = { toObjects, matches };
