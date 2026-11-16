import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import './RunHistory.css'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function dateKey(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function resultLabel(status = '') {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function RunHistory() {
  const [runs, setRuns] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [jobFilter, setJobFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [expandedRunId, setExpandedRunId] = useState('')
  const [deliveryLogs, setDeliveryLogs] = useState([])
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [deliveryError, setDeliveryError] = useState('')

  useEffect(() => {
    let active = true

    async function loadHistory() {
      try {
        const data = await api('/run-history')
        if (active) {
          setRuns(Array.isArray(data.runs) ? data.runs : [])
          setJobs(Array.isArray(data.jobs) ? data.jobs : [])
          setError('')
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Unable to load run history.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadHistory()
    return () => {
      active = false
    }
  }, [reloadToken])

  const filteredRuns = useMemo(() => runs.filter((run) => {
    if (jobFilter && run.jobId !== jobFilter) return false
    if (resultFilter && run.status !== resultFilter) return false

    const key = dateKey(run.startTime)
    if (fromDate && key < fromDate) return false
    if (toDate && key > toDate) return false
    return true
  }), [runs, jobFilter, resultFilter, fromDate, toDate])

  async function toggleRun(run) {
    if (expandedRunId === run.id) {
      setExpandedRunId('')
      setDeliveryLogs([])
      setDeliveryError('')
      return
    }

    setExpandedRunId(run.id)
    setDeliveryLogs([])
    setDeliveryError('')
    setDeliveryLoading(true)
    try {
      const data = await api(`/run-history/${encodeURIComponent(run.id)}/deliveries`)
      setDeliveryLogs(Array.isArray(data.deliveryLogs) ? data.deliveryLogs : [])
    } catch (loadError) {
      setDeliveryError(loadError.message || 'Unable to load delivery log.')
    } finally {
      setDeliveryLoading(false)
    }
  }

  function retryLoad() {
    setLoading(true)
    setReloadToken((token) => token + 1)
  }

  return (
    <section className="run-history-page">
      <header className="run-history-heading">
        <div>
          <h1>Run history</h1>
          <p>Every run and email sent is recorded. Click a run to see its delivery log.</p>
        </div>
        <button type="button" className="run-history-refresh" onClick={retryLoad}>
          Refresh
        </button>
      </header>

      <section className="run-history-filters" aria-label="Filter run history">
        <label>
          Job
          <select value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
            <option value="">All jobs</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>{job.name}</option>
            ))}
          </select>
        </label>
        <label>
          Result
          <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}>
            <option value="">All results</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
          </select>
        </label>
        <label>
          From
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>
      </section>

      {error && (
        <div className="run-history-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={retryLoad}>Try again</button>
        </div>
      )}

      <div className="run-history-table-wrap">
        <table className="run-history-table">
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Job</th>
              <th>Fetched</th>
              <th>Matched</th>
              <th>Sent</th>
              <th>Skipped</th>
              <th>Failed</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="run-history-empty">Loading run history…</td></tr>
            ) : filteredRuns.length === 0 ? (
              <tr>
                <td colSpan="9" className="run-history-empty">
                  {runs.length ? 'No runs match these filters.' : 'No runs have been recorded yet.'}
                </td>
              </tr>
            ) : filteredRuns.map((run) => (
              <FragmentRunRow
                key={run.id}
                run={run}
                expanded={expandedRunId === run.id}
                deliveryLogs={deliveryLogs}
                deliveryLoading={deliveryLoading}
                deliveryError={deliveryError}
                onToggle={() => toggleRun(run)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="run-history-count">
        Showing {filteredRuns.length} of {runs.length} runs
      </p>
    </section>
  )
}

function FragmentRunRow({
  run,
  expanded,
  deliveryLogs,
  deliveryLoading,
  deliveryError,
  onToggle,
}) {
  return (
    <>
      <tr
        className="run-history-row"
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggle()
          }
        }}
        tabIndex={0}
        aria-expanded={expanded}
      >
        <td>{formatDate(run.startTime)}</td>
        <td>{formatDate(run.endTime)}</td>
        <td>
          {run.jobName}
          {run.manual && <span className="run-history-manual">Run now</span>}
        </td>
        <td>{run.rowsFetched ?? 0}</td>
        <td>{run.rowsMatched ?? 0}</td>
        <td>{run.emailsSent ?? 0}</td>
        <td>{run.skippedDuplicates ?? 0}</td>
        <td>{run.failed ?? 0}</td>
        <td>
          <span className={`run-history-result result-${run.status}`}>
            {resultLabel(run.status)}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="run-history-details-row">
          <td colSpan="9">
            {deliveryLoading ? (
              <p className="run-history-empty">Loading delivery log…</p>
            ) : deliveryError ? (
              <p className="run-history-detail-error" role="alert">{deliveryError}</p>
            ) : deliveryLogs.length === 0 ? (
              <p className="run-history-empty">No delivery records for this run.</p>
            ) : (
              <div className="run-history-deliveries">
                <h2>Delivery log</h2>
                <div className="run-history-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Recipient</th>
                        <th>Subject</th>
                        <th>Status</th>
                        <th>Retries</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{formatDate(log.createdAt)}</td>
                          <td>{log.recipient || '—'}</td>
                          <td>{log.subject || '—'}</td>
                          <td>
                            <span className={`run-history-result result-${log.status}`}>
                              {resultLabel(log.status)}
                            </span>
                          </td>
                          <td>{log.retryCount ?? 0}</td>
                          <td>{log.errorMessage || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
