import { useState } from 'react'
import './index.css'
import Dashboard from './pages/Dashboard'
import Assets from './pages/Assets'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'assets', label: 'Assets', icon: '🖥️' },
]

function App() {
  const [page, setPage] = useState('dashboard')

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🐱 CLAW</h1>
          <div className="version">V8.0-alpha · A2.0</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <a
              key={item.id}
              href="#"
              className={page === item.id ? 'active' : ''}
              onClick={e => { e.preventDefault(); setPage(item.id) }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        {page === 'dashboard' && <Dashboard />}
        {page === 'assets' && <Assets />}
      </main>
    </div>
  )
}

export default App
