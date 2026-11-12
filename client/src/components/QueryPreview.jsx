
export default function QueryPreview({
  result,
  loading = false,
  error = "",
}) {
  if (loading) {
    return (
      <section className="panel">
        <h3>Preview</h3>
        <p>Running query...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel error-panel">
        <h3>Preview failed</h3>
        <p>{error}</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="panel">
        <h3>Preview</h3>
        <p className="muted">
          Run Test Query to inspect up to the first 10 rows.
        </p>
      </section>
    );
  }

  const rows = Array.isArray(result.rows)
    ? result.rows
    : [];

  const columns = Array.isArray(result.columns)
    ? result.columns
    : [];

  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Preview Results</h3>
        <span>{rows.length} rows</span>
      </div>

      {rows.length === 0 ? (
        <p className="muted">No rows returned.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((column, index) => (
                  <th key={index}>{column}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column, colIndex) => (
                    <td key={colIndex}>
                      {(() => {
                        const value = Array.isArray(row)
                          ? row[colIndex]
                          : row?.[column];

                        return value == null
                          ? "—"
                          : String(value);
                      })()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="field-note">
        Source: {result.meta?.source || "Unknown"}
        {" | "}
        Preview Limit: 10 rows
      </p>
    </section>
  );
}
