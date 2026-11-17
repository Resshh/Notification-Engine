
import { createContext, useContext, useState } from 'react'
import { api } from '../api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('user')) || null
    } catch {
      return null
    }
  })

  const [token, setToken] = useState(
    () => sessionStorage.getItem('token') || ''
  )

  const isAuthenticated = Boolean(token && user)

  async function login(email, password) {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email, password },
    })

    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('user', JSON.stringify(data.user))

    setToken(data.token)
    setUser(data.user)

    return data.user
  }

  function logout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')

    setToken('')
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// The hook lives next to its provider on purpose (standard React context pattern).
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
