import React from 'react';

/**
 * Query Preview Component
 * Story 5.2 | Sub-tasks 144, 145 | Ref: FR-11, Figure 3
 * Displays the first 10 rows returned by the Test Query execution in common format.
 */
export default function QueryPreview({ result, loading = false, error = '' }) {
  if (loading) {
    return (
      <section className="panel">
        <h3>Query Preview</h3>
        <p>Running query against data source…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel error-panel" role="alert">
        <h3>Preview Failed</h3>
        <p>{error}</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="panel muted">
        <h3>Query Preview</h3>
        <p>Click <strong>Test Query</strong> to inspect the first 10 rows in the common format.</p>
      </section>
    );
  }

  const columns = result.columns?.length
    ? result.columns
    : (Array.isArray(result.rows?.[0]) ? [] : Object.keys(result.rows?.[0] || {}));

  const rows = result.rows || [];

  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Preview Results</h3>
        <span>{rows.length} row{rows.length === 1 ? '' : 's'} (capped at 10)</span>
      </div>

      {!columns.length || !rows.length ? (
        <p>No rows returned for this query.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column, colIdx) => {
                    const cellVal = Array.isArray(row) ? row[colIdx] : row[column];
                    return (
                      <td key={column}>
                        {cellVal == null ? '—' : String(cellVal)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748B' }}>
        <span>Data Source: <strong>{result.meta?.source || '—'}</strong></span>
        {' · '}
        <span>Preview limit: <strong>10 rows</strong> (Ref: FR-11)</span>
      </div>
    </section>
  );
}
