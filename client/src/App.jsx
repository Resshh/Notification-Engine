
import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, Navigate, useNavigate } from 'react-router-dom'

import Login from './pages/Login.jsx'
import Jobs from './pages/Jobs.jsx'
import JobSetup from './pages/JobSetup.jsx'
import Recipients from './pages/Recipients.jsx'
import Templates from './pages/Templates.jsx'
import Connections from './pages/Connections.jsx'
import QuerySetup from './pages/QuerySetup.jsx'
import RunHistory from './pages/RunHistory.jsx'

import ProtectedRoute from './components/ProtectedRoute.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { api } from './api.js'

// Simple line icons for the side menu (same set the project used before; no icon library needed).
const ICON_PATHS = {
  dashboard: 'M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
  history: 'M3 12a9 9 0 1 0 2.64-6.36L3 8 M3 3v5h5 M12 7v5l3 2',
  connection: 'M8 7v5a4 4 0 0 0 8 0V7 M6 3v4 M10 3v4 M14 3v4 M18 3v4 M12 16v5',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-6-6',
}

function NavIcon({ name }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [testMode, setTestMode] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isAdmin = user?.role === 'admin'
  // Same message style as the Job setup screen uses for normal users.
  const adminOnly = (what) => (
    <p className="notice notice-error" role="alert">Admins only. You don't have permission to {what}.</p>
  )

  useEffect(() => {
    let active = true

    async function loadHealth() {
      try {
        const response = await api('/health')
        if (active) setTestMode(response.testMode)
      } catch {
        if (active) setTestMode(null)
      }
    }

    loadHealth()

    return () => {
      active = false
    }
  }, [])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <header className="app-header">
        <div className="header-brand">
          <button
  type="button"
  className="menu-toggle"
  onClick={() => setSidebarOpen((previous) => !previous)}
  aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
  aria-expanded={sidebarOpen}
>
  ☰
</button>
          <strong>Notification Engine</strong>
        </div>

        <div className="header-account">
          {testMode === true && (
            <span className="test-mode-badge">TEST MODE: ON</span>
          )}

          {testMode === false && (
            <span className="test-mode-badge test-mode-off">
              TEST MODE: OFF
            </span>
          )}

          <span className="account-name">
            {user?.name || 'User'} ({user?.role || 'user'})
          </span>

          <button className="logout-button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <aside className="app-sidebar">
        <nav className="sidebar-navigation">
          <NavLink to="/" end>
            <NavIcon name="dashboard" />
            Job Dashboard
          </NavLink>

          <NavLink to="/recipients">
            <NavIcon name="users" />
            Recipient Lists
          </NavLink>

          <NavLink to="/templates">
            <NavIcon name="file" />
            Templates
          </NavLink>

          <NavLink to="/history">
            <NavIcon name="history" />
            Run History
          </NavLink>

          {/* Connections and queries are admin settings (Common Guide: only admins change them) */}
          {isAdmin && (
            <>
              <NavLink to="/connections">
                <NavIcon name="connection" />
                Connections
              </NavLink>

              <NavLink to="/queries">
                <NavIcon name="search" />
                Queries
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      <main className="app-content">
        <Routes>
          <Route path="/" element={<Jobs />} />
          <Route path="/jobs/new" element={<JobSetup />} />
          <Route path="/jobs/:id" element={<JobSetup />} />
          <Route path="/recipients" element={<Recipients />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/connections" element={isAdmin ? <div className="batch2"><Connections /></div> : adminOnly('manage connections')} />
          <Route path="/queries" element={isAdmin ? <div className="batch2"><QuerySetup /></div> : adminOnly('manage queries')} />
          <Route path="/history" element={<RunHistory />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<DashboardLayout />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
