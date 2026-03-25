import { useState } from 'react'
import './index.css'
import Dashboard from './pages/Dashboard'
import Assets from './pages/Assets'
import Topology from './pages/Topology'
import AgentPanel from './pages/AgentPanel'

const NAV_ITEMS = [
  { id: 'dashboard', label: '$ dashboard' },
  { id: 'assets', label: '$ assets' },
  { id: 'topology', label: '$ topology' },
]

function App() {
  const [page, setPage] = useState('dashboard')
  const [agentOpen, setAgentOpen] = useState(true)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>⌐ CLAW</h1>
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
              <span>{page === item.id ? '▶' : '▸'}</span>
              <span>{item.label}</span>
            </a>
          ))}
          <a
            href="#"
            style={{ marginTop: '12px', borderTop: '1px solid var(--border-dim)', paddingTop: '12px' }}
            className={agentOpen ? 'active' : ''}
            onClick={e => { e.preventDefault(); setAgentOpen(!agentOpen) }}
          >
            <span>🧠</span>
            <span>$ agent {agentOpen ? '[ON]' : '[OFF]'}</span>
          </a>
        </nav>
        <div className="sidebar-status">
          <div><span className="online">● </span>SYS ONLINE</div>
          <div style={{marginTop:'2px', fontSize:'0.6rem'}}>claw.db · 8 scans</div>
        </div>
      </aside>

      <main className="main-content" style={{ marginRight: agentOpen ? '340px' : '0' }}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'assets' && <Assets />}
        {page === 'topology' && <Topology />}
      </main>

      {agentOpen && <AgentPanel />}
    </div>
  )
}

export default App
