import { useState, useEffect } from 'react'

const API = 'http://localhost:8000/api/v1'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [audit, setAudit] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/stats`).then(r => r.json()),
      fetch(`${API}/audit?limit=10`).then(r => r.json()),
    ])
      .then(([s, a]) => { setStats(s); setAudit(a.entries || []); })
      .catch(err => console.error('API error:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading"> CONNECTING TO CLAW BACKEND... <span className="cursor"></span></div>

  if (!stats) return <div className="loading">⚠ CONNECTION REFUSED — run: uvicorn backend.main:app --reload</div>

  return (
    <>
      <div className="term-header">
        <div className="path">root@claw:~# cat /proc/status<span className="cursor"></span></div>
        <div className="desc">// 态势感知总览 — {stats.latest_scan?.env || 'unknown'} 环境</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card hosts">
          <div className="label">hosts.active</div>
          <div className="value">{stats.hosts}</div>
        </div>
        <div className="stat-card ports">
          <div className="label">ports.open</div>
          <div className="value">{stats.ports}</div>
        </div>
        <div className="stat-card vulns">
          <div className="label">vulns.found</div>
          <div className="value">{stats.vulns}</div>
        </div>
        <div className="stat-card scans">
          <div className="label">scans.total</div>
          <div className="value">{stats.scans}</div>
        </div>
      </div>

      {stats.latest_scan && (
        <div className="scan-info">
          <div><span className="label">env=</span><span className="val">{stats.latest_scan.env}</span></div>
          <div><span className="label">last_scan=</span><span className="val">{stats.latest_scan.timestamp}</span></div>
        </div>
      )}

      <div className="section-divider">[ AGENT AUDIT LOG ]</div>

      <table className="data-table">
        <thead>
          <tr>
            <th>timestamp</th>
            <th>action</th>
            <th>detail</th>
          </tr>
        </thead>
        <tbody>
          {audit.length === 0 ? (
            <tr><td colSpan={3} style={{textAlign:'center', color:'var(--text-dim)'}}>// no audit entries yet</td></tr>
          ) : audit.map((e, i) => (
            <tr key={i}>
              <td style={{color:'var(--text-dim)', fontSize:'0.7rem'}}>{e.timestamp}</td>
              <td><span className="badge badge-tool">{e.action}</span></td>
              <td style={{color:'var(--text-dim)', fontSize:'0.7rem'}}>{e.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
