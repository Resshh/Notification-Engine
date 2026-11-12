import React, { useState, useEffect } from 'react';
import {
  getConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection
} from '../api/connectionApi';

const DEFAULT_PORTS = {
  SQLServer: 1433,
  HANA: 39015,
  ServiceLayer: 50000
};

export default function Connections() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'SQLServer',
    host: 'localhost',
    port: 1433,
    database: '',
    username: '',
    password: ''
  });

  const [formTesting, setFormTesting] = useState(false);
  const [formTestResult, setFormTestResult] = useState(null);
  const [formSaving, setFormSaving] = useState(false);
  const [testingRowId, setTestingRowId] = useState(null);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
    setLoading(true);
    setError('');
    try {
      const data = await getConnections();
      setConnections(data);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || 'Failed to load connections.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleOpenAddModal() {
    setEditingId(null);
    setFormData({
      name: '',
      type: 'SQLServer',
      host: 'localhost',
      port: 1433,
      database: '',
      username: '',
      password: ''
    });
    setFormTestResult(null);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(conn) {
    setEditingId(conn.id || conn._id);
    setFormData({
      name: conn.name || '',
      type: conn.type || 'SQLServer',
      host: conn.host || '',
      port: conn.port || DEFAULT_PORTS[conn.type] || 1433,
      database: conn.database || '',
      username: conn.username || '',
      password: '' // Kept empty per Story 1.2 Sub-task 27
    });
    setFormTestResult(null);
    setIsModalOpen(true);
  }

  function handleTypeChange(newType) {
    setFormData((prev) => ({
      ...prev,
      type: newType,
      port: DEFAULT_PORTS[newType] || prev.port
    }));
  }

  // Story 1.3: Test connection from modal form
  async function handleTestForm() {
    setFormTesting(true);
    setFormTestResult(null);
    try {
      const payload = {
        ...formData,
        id: editingId || undefined
      };
      const res = await testConnection(payload);
      setFormTestResult({
        ok: res.ok,
        message: res.message || (res.ok ? 'Connection test passed!' : 'Connection test failed.')
      });
    } catch (err) {
      setFormTestResult({
        ok: false,
        message: err.response?.data?.message || err.message || 'Connection test failed.'
      });
    } finally {
      setFormTesting(false);
    }
  }

  // Story 1.3: Test connection directly from list row
  async function handleTestRow(conn) {
    const connId = conn.id || conn._id;
    setTestingRowId(connId);
    setError('');
    setSuccess('');
    try {
      const res = await testConnection({ id: connId });
      setSuccess(`Connection '${conn.name}': ${res.message || 'Test successful!'}`);
      loadConnections(); // Reload to refresh lastTestStatus & lastTestedAt
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || `Test failed for '${conn.name}'.`
      );
      loadConnections();
    } finally {
      setTestingRowId(null);
    }
  }

  // Story 1.1 & 1.2: Save / Update Connection
  async function handleSaveConnection(e) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.host.trim() || !formData.database.trim() || !formData.username.trim()) {
      setError('Please fill in all mandatory connection fields.');
      return;
    }
    if (!editingId && !formData.password.trim()) {
      setError('Password is required when creating a new connection.');
      return;
    }

    setFormSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editingId) {
        // Story 1.2: Update
        const payload = { ...formData };
        if (!payload.password.trim()) {
          delete payload.password; // Omit blank password to keep stored password
        }
        await updateConnection(editingId, payload);
        setSuccess(`Connection '${formData.name}' updated successfully.`);
      } else {
        // Story 1.1: Create
        await createConnection(formData);
        setSuccess(`Connection '${formData.name}' created successfully.`);
      }
      setIsModalOpen(false);
      loadConnections();
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || 'Failed to save connection.'
      );
    } finally {
      setFormSaving(false);
    }
  }

  // Story 1.2: Delete connection with BR-04 check
  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    const targetId = deleteTarget.id || deleteTarget._id;
    try {
      await deleteConnection(targetId);
      setSuccess(`Connection '${deleteTarget.name}' deleted successfully.`);
      setDeleteTarget(null);
      loadConnections();
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || 'Failed to delete connection.'
      );
    } finally {
      setDeleting(false);
    }
  }

  function formatTimestamp(ts) {
    if (!ts) return 'Never';
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 'Never' : d.toLocaleString();
  }

  function renderStatusBadge(status) {
    if (status === 'SUCCESS') {
      return <span className="status-badge status-success">● Connected</span>;
    }
    if (status === 'FAILED') {
      return <span className="status-badge status-failed">● Failed</span>;
    }
    return <span className="status-badge status-neutral">● Not Tested</span>;
  }

  return (
    <div className="page-stack">
      {/* Page Header */}
      <header className="page-header panel-heading">
        <div>
          <p className="eyebrow">BATCH 2 · DATA CONNECTORS</p>
          <h1>Database Connection Management</h1>
          <p>
            Configure, test, and manage secure connections to SQL Server, SAP HANA, and SAP Service Layer.
          </p>
        </div>
        <button onClick={handleOpenAddModal} className="btn-primary">
          + Add Connection
        </button>
      </header>

      {/* Global Alerts */}
      {success && (
        <div className="alert-banner alert-success">
          <span>✓ {success}</span>
          <button className="btn-close" onClick={() => setSuccess('')}>×</button>
        </div>
      )}

      {error && (
        <div className="alert-banner alert-error">
          <span>⚠ {error}</span>
          <button className="btn-close" onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Connections List Panel */}
      <section className="panel">
        <div className="panel-heading">
          <h3>Saved Connections</h3>
          <span className="muted">Total: {connections.length}</span>
        </div>

        {loading ? (
          <p className="muted">Loading connections...</p>
        ) : connections.length === 0 ? (
          <div className="empty-state">
            <p className="muted">No database connections found.</p>
            <button onClick={handleOpenAddModal} className="btn-secondary-sm">
              Add your first connection
            </button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="connections-table">
              <thead>
                <tr>
                  <th>Connection Name</th>
                  <th>Type</th>
                  <th>Host & Port</th>
                  <th>Database / Schema</th>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Last Tested</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => {
                  const connId = c.id || c._id;
                  const isTestingThis = testingRowId === connId;

                  return (
                    <tr key={connId}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>
                        <span className={`type-tag type-${c.type?.toLowerCase()}`}>
                          {c.type === 'ServiceLayer' ? 'Service Layer' : c.type}
                        </span>
                      </td>
                      <td>
                        <code>{c.host}:{c.port}</code>
                      </td>
                      <td>{c.database}</td>
                      <td>{c.username}</td>
                      <td>{renderStatusBadge(c.lastTestStatus)}</td>
                      <td className="muted">{formatTimestamp(c.lastTestedAt)}</td>
                      <td>
                        <div className="action-buttons-group">
                          <button
                            type="button"
                            onClick={() => handleTestRow(c)}
                            disabled={isTestingThis}
                            className="btn-action btn-action-test"
                            title="Test connection"
                          >
                            {isTestingThis ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(c)}
                            className="btn-action btn-action-edit"
                            title="Edit connection"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            className="btn-action btn-action-delete"
                            title="Delete connection"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add / Edit Connection Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>{editingId ? 'Edit Connection' : 'Add New Connection'}</h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => setIsModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveConnection}>
              <div className="form-grid modal-body">
                {/* Connection Name */}
                <label className="full-width">
                  Connection Name *
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Sales SQL Server"
                  />
                </label>

                {/* Connection Type */}
                <label>
                  Connection Type *
                  <select
                    value={formData.type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                  >
                    <option value="SQLServer">Microsoft SQL Server</option>
                    <option value="HANA">SAP HANA</option>
                    <option value="ServiceLayer">SAP Service Layer (OData)</option>
                  </select>
                </label>

                {/* Port */}
                <label>
                  Port *
                  <input
                    type="number"
                    required
                    min="1"
                    max="65535"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                  />
                </label>

                {/* Host */}
                <label>
                  Host / Server *
                  <input
                    type="text"
                    required
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="e.g. localhost or 192.168.1.50"
                  />
                </label>

                {/* Database */}
                <label>
                  Database / Schema *
                  <input
                    type="text"
                    required
                    value={formData.database}
                    onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                    placeholder="e.g. SalesTest or SBODemoIN"
                  />
                </label>

                {/* Username */}
                <label>
                  Username *
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. sa, SYSTEM, or manager"
                  />
                </label>

                {/* Password */}
                <label>
                  {editingId ? 'New Password (Optional)' : 'Password *'}
                  <input
                    type="password"
                    required={!editingId}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingId ? 'Leave blank to keep stored password' : 'Enter connection password'}
                  />
                </label>
              </div>

              {/* In-Modal Test Feedback */}
              {formTestResult && (
                <div
                  className={`modal-alert ${
                    formTestResult.ok ? 'modal-alert-success' : 'modal-alert-error'
                  }`}
                >
                  {formTestResult.ok ? '✓ ' : '⚠ '}
                  {formTestResult.message}
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={handleTestForm}
                  disabled={formTesting}
                  className="btn-secondary-sm"
                >
                  {formTesting ? 'Testing...' : 'Test Connection'}
                </button>

                <div className="modal-footer-actions">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSaving}
                    className="btn-primary"
                  >
                    {formSaving ? 'Saving...' : editingId ? 'Update Connection' : 'Save Connection'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3>Delete Connection</h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => setDeleteTarget(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete connection <strong>{deleteTarget.name}</strong>?
              </p>
              <p className="muted" style={{ fontSize: '12px' }}>
                Note: Per rule BR-04, connections currently assigned to saved queries cannot be deleted.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="mapping-delete"
              >
                {deleting ? 'Deleting...' : 'Delete Connection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
