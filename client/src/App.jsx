import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import QuerySetup from './pages/QuerySetup'
import RecipientList from './pages/RecipientList.jsx'
import './styles.css'

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">N</div>
        <strong>Notification Engine</strong>
        <span className="batch-label">BATCH 2 – DATA CONNECTORS</span>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <p className="nav-caption">WORKSPACE</p>
          <NavLink className="nav-item" to="/queries">Queries</NavLink>
          <NavLink className="nav-item" to="/recipient-lists">Recipient Lists</NavLink>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/queries" replace />} />
            <Route path="/queries" element={<QuerySetup />} />
            <Route path="/recipient-lists" element={<RecipientList />} />
            <Route path="/recipientslist" element={<Navigate to="/recipient-lists" replace />} />
            <Route path="*" element={<Navigate to="/queries" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
