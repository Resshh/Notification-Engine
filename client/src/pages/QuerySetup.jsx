
import { useState, useEffect } from "react";
import api, { previewSavedQuery } from "../api/previewApi";
import { getConnections } from "../api/connectionApi";
import QueryPreview from "../components/QueryPreview";

export default function QuerySetup() {
  // =====================================================
  // SAVED DATABASE CONNECTIONS
  // =====================================================

  const [connections, setConnections] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectionsError, setConnectionsError] = useState("");

  // =====================================================
  // QUERY FORM STATE
  // =====================================================

  const [queryId, setQueryId] = useState("");
  const [name, setName] = useState("");
  const [connectionId, setConnectionId] = useState("");

  const [kind, setKind] = useState("odata");

  const [entity, setEntity] = useState("Invoices");
  const [filter, setFilter] = useState("DocStatus eq 'O'");

  const [select, setSelect] = useState(
    "DocNum,CardCode,CardName,DocTotal,DocDueDate"
  );

  const [queryText, setQueryText] = useState("");
  const [rowLimit, setRowLimit] = useState(1000);

  // =====================================================
  // QUERY EXECUTION STATE
  // =====================================================

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // =====================================================
  // LOAD SAVED CONNECTIONS FROM BACKEND
  // =====================================================

  useEffect(() => {
    let active = true;

    async function loadConnections() {
      setConnectionsLoading(true);
      setConnectionsError("");

      try {
        const data = await getConnections();

        if (!active) return;

        if (!Array.isArray(data)) {
          throw new Error("Invalid connections response.");
        }

        setConnections(data);
      } catch (err) {
        if (!active) return;

        const message =
          err.response?.status === 401
            ? "Authentication is required to load saved connections."
            : err.response?.status === 403
              ? "Administrator access is required to view connections."
              : err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                "Unable to load saved connections.";

        setConnectionsError(message);
      } finally {
        if (active) {
          setConnectionsLoading(false);
        }
      }
    }

    loadConnections();

    return () => {
      active = false;
    };
  }, []);

  // =====================================================
  // HANDLE DATABASE CONNECTION SELECTION
  // =====================================================

  function handleConnectionChange(event) {
    const selectedId = event.target.value;

    setConnectionId(selectedId);
    setQueryId("");
    setPreview(null);
    setError("");
    setSuccess("");

    const selectedConnection = connections.find(
      (connection) =>
        String(connection.id || connection._id) === selectedId
    );

    if (!selectedConnection) {
      return;
    }

    // Automatically select the appropriate query type.
    if (selectedConnection.type === "ServiceLayer") {
      setKind("odata");
    } else if (
      selectedConnection.type === "SQLServer" ||
      selectedConnection.type === "HANA"
    ) {
      setKind("sql");
    }
  }

  // =====================================================
  // VALIDATE QUERY FORM
  // =====================================================

  function validateForm() {
    if (!name.trim()) {
      throw new Error("Please enter a query name.");
    }

    if (!connectionId.trim()) {
      throw new Error(
        "Please select a saved database connection."
      );
    }

    if (kind === "odata" && !entity.trim()) {
      throw new Error(
        "Please select a Service Layer entity."
      );
    }

    if (kind === "sql" && !queryText.trim()) {
      throw new Error("Please enter an SQL query.");
    }

    const limit = Number(rowLimit);

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 1000
    ) {
      throw new Error(
        "Row limit must be between 1 and 1000."
      );
    }
  }

  // =====================================================
  // SAVE QUERY TO MONGODB
  // =====================================================

  async function saveQuery() {
    setSaving(true);
    setError("");
    setSuccess("");
    setPreview(null);

    try {
      validateForm();

      const queryData = {
        name: name.trim(),
        connectionId: connectionId.trim(),
        kind,

        queryText:
          kind === "sql" ? queryText.trim() : "",

        entity:
          kind === "odata" ? entity.trim() : "",

        filter:
          kind === "odata" ? filter.trim() : "",

        select:
          kind === "odata" ? select.trim() : "",

        rowLimit: Number(rowLimit),
      };

      const response = await api.post(
        "/queries",
        queryData
      );

      const savedQuery =
        response.data?.data ||
        response.data?.query ||
        response.data;

      const savedId =
        savedQuery?._id ||
        savedQuery?.id;

      if (!savedId) {
        throw new Error(
          "Query may have been saved, but the API did not return its ID."
        );
      }

      setQueryId(String(savedId));

      setSuccess(
        "Query saved successfully! You can now test your query."
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Unable to save query."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // TEST SAVED QUERY
  // =====================================================

  async function testQuery() {
    setLoading(true);
    setError("");
    setSuccess("");
    setPreview(null);

    try {
      if (!queryId.trim()) {
        throw new Error(
          "Please save a query or enter an existing saved query ID."
        );
      }

      const result = await previewSavedQuery(
        queryId.trim()
      );

      setPreview(result);

      setSuccess(
        "Query executed successfully."
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Unable to preview query."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // RENDER FRONTEND
  // =====================================================

  return (
    <div className="page-stack">

      {/* PAGE HEADER */}
      <header className="page-header">
        <div>
          <p className="eyebrow">
            BATCH 2 · DATA CONNECTORS
          </p>

          <h1>Query Setup and Testing</h1>

          <p>
            Create a saved query, select a database
            connection, and inspect source data before
            integration.
          </p>
        </div>
      </header>

      {/* QUERY CONFIGURATION */}
      <section className="panel">

        <h2>Query Configuration</h2>

        <div className="form-grid">

          {/* QUERY NAME */}
          <label>
            Saved Query Name *

            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Overdue invoices"
            />
          </label>

          {/* SAVED QUERY ID */}
          <label>
            Saved Query ID

            <input
              type="text"
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              placeholder="Automatically filled after saving"
            />
          </label>

          {/* DATABASE CONNECTION DROPDOWN */}
          <label>
            Database Connection *

            <select
              value={connectionId}
              onChange={handleConnectionChange}
              disabled={connectionsLoading}
              required
            >
              <option value="">
                {connectionsLoading
                  ? "Loading connections..."
                  : "Select a saved connection"}
              </option>

              {connections.map((connection) => {
                const id =
                  connection.id || connection._id;

                return (
                  <option
                    key={String(id)}
                    value={String(id)}
                  >
                    {connection.name} ({connection.type})
                  </option>
                );
              })}
            </select>
          </label>

          {/* QUERY TYPE */}
          <label>
            Query Type

            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setQueryId("");
                setPreview(null);
                setError("");
                setSuccess("");
              }}
            >
              <option value="odata">
                SAP Business One Service Layer (OData)
              </option>

              <option value="sql">
                SQL Server / SAP HANA
              </option>
            </select>
          </label>

          {/* ODATA QUERY CONFIGURATION */}
          {kind === "odata" && (
            <>
              <label>
                Service Layer Entity

                <select
                  value={entity}
                  onChange={(e) =>
                    setEntity(e.target.value)
                  }
                >
                  <option value="Invoices">
                    Invoices
                  </option>

                  <option value="PurchaseOrders">
                    Purchase Orders
                  </option>

                  <option value="Items">
                    Items
                  </option>
                </select>
              </label>

              <label>
                $select

                <input
                  type="text"
                  value={select}
                  onChange={(e) =>
                    setSelect(e.target.value)
                  }
                  placeholder="DocNum,CardName"
                />
              </label>

              <label className="full-width">
                $filter

                <input
                  type="text"
                  value={filter}
                  onChange={(e) =>
                    setFilter(e.target.value)
                  }
                  placeholder="DocStatus eq 'O'"
                />
              </label>
            </>
          )}

          {/* SQL QUERY CONFIGURATION */}
          {kind === "sql" && (
            <label className="full-width">
              SQL Query

              <textarea
                rows="5"
                value={queryText}
                onChange={(e) =>
                  setQueryText(e.target.value)
                }
                placeholder="Enter an approved read-only SELECT query"
              />
            </label>
          )}

          {/* ROW LIMIT */}
          <label>
            Row Limit

            <input
              type="number"
              min="1"
              max="1000"
              value={rowLimit}
              onChange={(e) => {
                const value = e.target.value;

                if (value === "") {
                  setRowLimit("");
                } else {
                  setRowLimit(
                    Math.min(
                      1000,
                      Math.max(1, Number(value))
                    )
                  );
                }
              }}
            />
          </label>

        </div>

        {/* CONNECTION LOADING ERROR */}
        {connectionsError && (
          <div
            className="error-panel"
            role="alert"
            style={{ marginTop: "16px" }}
          >
            {connectionsError}
          </div>
        )}

        {/* NO CONNECTIONS AVAILABLE */}
        {!connectionsLoading &&
          !connectionsError &&
          connections.length === 0 && (
            <p className="field-note">
              No saved database connections found.
              Create a connection from the
              Connection Settings page first.
            </p>
          )}

        {/* HELPER TEXT */}
        <p className="field-note">
          Select an existing database connection
          from MongoDB. Save your query before testing.
          The preview displays a maximum of 10 rows.
        </p>

        {/* SUCCESS MESSAGE */}
        {success && (
          <div
            className="success-panel"
            role="status"
          >
            {success}
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <div
            className="error-panel"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div className="actions">

          <button
            className="secondary"
            type="button"
            onClick={saveQuery}
            disabled={
              saving ||
              loading ||
              connectionsLoading
            }
          >
            {saving
              ? "Saving..."
              : "Save Query"}
          </button>

          <button
            type="button"
            onClick={testQuery}
            disabled={loading || saving}
          >
            {loading
              ? "Testing..."
              : "Test Query"}
          </button>

        </div>
      </section>

      {/* QUERY PREVIEW */}
      <QueryPreview
        result={preview}
        loading={loading}
        error={error}
      />

    </div>
  );
}
