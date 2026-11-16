import { useEffect, useState } from 'react'
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'

import { useAuth } from './context/AuthContext.jsx'
import Connections from './pages/Connections.jsx'
import JobSetup from './pages/JobSetup.jsx'
import Jobs from './pages/Jobs.jsx'
import Login from './pages/Login.jsx'
import QuerySetup from './pages/QuerySetup.jsx'
import RecipientList from './pages/RecipientList.jsx'
import RunHistory from './pages/RunHistory.jsx'
import Templates from './pages/Templates.jsx'

const navigation = [
  { to: '/', label: 'Job Dashboard', icon: 'dashboard', end: true },
  { to: '/recipientslist', label: 'Recipient Lists', icon: 'users' },
  { to: '/templates', label: 'Templates', icon: 'file' },
  { to: '/history', label: 'Run History', icon: 'history' },
  { to: '/connections', label: 'Connections', icon: 'connection' },
  { to: '/queries', label: 'Queries', icon: 'search' },
]

function SidebarIcon({ name }) {
  const paths = {
    dashboard: 'M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
    history: 'M3 12a9 9 0 1 0 2.64-6.36L3 8 M3 3v5h5 M12 7v5l3 2',
    connection: 'M8 7v5a4 4 0 0 0 8 0V7 M6 3v4 M10 3v4 M14 3v4 M18 3v4 M12 16v5',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-6-6',
  }

  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}

export default function App() {
  const { user, logout, isAuthenticated } = useAuth()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [testMode, setTestMode] = useState(false)

  useEffect(() => {
    let active = true

    async function checkHealth() {
      try {
        const response = await fetch('/api/health')

        if (!response.ok) {
          throw new Error('Health check failed')
        }

        const data = await response.json()

        if (active) {
          setTestMode(data.testMode === true)
        }
      } catch (error) {
        console.error('Health check error:', error)
      }
    }

    checkHealth()

    return () => {
      active = false
    }
  }, [])

  if (location.pathname === '/login') {
    return isAuthenticated ? <Navigate to="/" replace /> : <Login />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div className={`layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="app-header">
        <div className="header-brand">
          <button
            type="button"
            className="hamburger-button"
            onClick={() => setSidebarCollapsed((previous) => !previous)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <span className="brand-mark">NE</span>
          <strong>Notification Engine</strong>
        </div>

        <div className="header-account">
          <span className={`test-mode-badge ${testMode ? '' : 'test-mode-off'}`}>
            TEST MODE: {testMode ? 'ON' : 'OFF'}
          </span>
          <span className="account-name">
            {user?.name} ({user?.role})
          </span>
          <button type="button" className="logout-button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <aside className="app-sidebar">
        <nav className="sidebar-navigation">
          {navigation.map(({ to, label, icon, end }) => (
            <div key={to}>
              <NavLink to={to} end={end} title={label}>
                <SidebarIcon name={icon} />
                <span className="nav-label">{label}</span>
              </NavLink>
            </div>
          ))}
        </nav>
      </aside>

      <main className="app-content">
        <Routes>
          <Route path="/" element={<Jobs />} />
          <Route
            path="/jobs/new"
            element={isAdmin ? <JobSetup /> : <h2>Admins only</h2>}
          />
          <Route
            path="/jobs/:id"
            element={isAdmin ? <JobSetup /> : <h2>Admins only</h2>}
          />
          <Route path="/recipientslist" element={<RecipientList />} />
          <Route path="/history" element={<RunHistory />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/queries" element={<QuerySetup />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
