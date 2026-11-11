
import { useEffect, useState } from 'react'
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'

import {
  LayoutDashboard,
  Users,
  FileText,
  History,
  Cable,
  SearchCode,
  Menu,
} from 'lucide-react'

import { useAuth } from './context/AuthContext.jsx'

import Login from './pages/Login.jsx'
import Jobs from './pages/Jobs.jsx'
import JobSetup from './pages/JobSetup.jsx'
import RecipientList from './pages/RecipientList.jsx'
import RunHistory from './pages/RunHistory.jsx'

export default function App() {
  const { user, logout, isAuthenticated } = useAuth()
  const location = useLocation()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [testMode, setTestMode] = useState(false)

  // Fetch the actual backend test mode status.
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

  // Show login without the dashboard layout.
  if (location.pathname === '/login') {
    return isAuthenticated
      ? <Navigate to="/" replace />
      : <Login />
  }

  // Redirect unauthenticated users.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div
      className={`layout ${
        sidebarCollapsed ? 'sidebar-collapsed' : ''
      }`}
    >

      {/* ================= HEADER ================= */}

      <header className="app-header">

        <div className="header-brand">

          <button
            type="button"
            className="hamburger-button"
            onClick={() => setSidebarCollapsed((previous) => !previous)}
            aria-label={
              sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
            }
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu size={23} strokeWidth={1.8} />
          </button>

          <span className="brand-mark">NE</span>

          <strong>Notification Engine</strong>

        </div>

        <div className="header-account">

          <span
            className={`test-mode-badge ${
              testMode ? '' : 'test-mode-off'
            }`}
          >
            TEST MODE: {testMode ? 'ON' : 'OFF'}
          </span>

          <span className="account-name">
            {user?.name} ({user?.role})
          </span>

          <button
            type="button"
            className="logout-button"
            onClick={logout}
          >
            Log out
          </button>

        </div>

      </header>

      {/* ================= SIDEBAR ================= */}

      <aside className="app-sidebar">

        <nav className="sidebar-navigation">

          <NavLink
            to="/"
            end
            title="Job Dashboard"
          >
            <LayoutDashboard className="nav-icon" />
            <span className="nav-label">Job Dashboard</span>
          </NavLink>

          <NavLink
            to="/recipientslist"
            title="Recipient Lists"
          >
            <Users className="nav-icon" />
            <span className="nav-label">Recipient Lists</span>
          </NavLink>

          <NavLink
            to="/templates"
            title="Templates"
          >
            <FileText className="nav-icon" />
            <span className="nav-label">Templates</span>
          </NavLink>

          <NavLink
            to="/history"
            title="Run History"
          >
            <History className="nav-icon" />
            <span className="nav-label">Run History</span>
          </NavLink>

          {/* Configuration section */}

          <div className="sidebar-divider" />

          <p className="sidebar-section-label">
            CONFIGURATION
          </p>

          <NavLink
            to="/connections"
            title="Connections"
          >
            <Cable className="nav-icon" />
            <span className="nav-label">Connections</span>
          </NavLink>

          <NavLink
            to="/queries"
            title="Queries"
          >
            <SearchCode className="nav-icon" />
            <span className="nav-label">Queries</span>
          </NavLink>

        </nav>

      </aside>

      {/* ================= MAIN CONTENT ================= */}

      <main className="app-content">

        <Routes>

          <Route
            path="/"
            element={<Jobs />}
          />

          <Route
            path="/jobs/new"
            element={
              isAdmin
                ? <JobSetup />
                : <h2>Admins only</h2>
            }
          />

          <Route
            path="/jobs/:id"
            element={
              isAdmin
                ? <JobSetup />
                : <h2>Admins only</h2>
            }
          />

          <Route
            path="/recipientslist"
            element={<RecipientList />}
          />

          <Route
            path="/history"
            element={<RunHistory />}
          />

          <Route
            path="/templates"
            element={
              <h2>Templates module is being integrated.</h2>
            }
          />

          <Route
            path="/connections"
            element={
              <h2>Connections module is being integrated.</h2>
            }
          />

          <Route
            path="/queries"
            element={
              <h2>Queries module is being integrated.</h2>
            }
          />

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>

      </main>

    </div>
  )
}
