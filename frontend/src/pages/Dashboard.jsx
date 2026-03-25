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

  if (loading) return <div className="loading">正在连接 CLAW 后端...</div>

  if (!stats) return <div className="loading">⚠️ 无法连接后端。请运行: uvicorn backend.main:app --reload</div>

  return (
    <>
      <div className="page-header">
        <h2>📊 Dashboard</h2>
        <p>Project CLAW 态势感知总览</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card hosts">
          <div className="label">Hosts</div>
          <div className="value">{stats.hosts}</div>
        </div>
        <div className="stat-card ports">
          <div className="label">Ports</div>
          <div className="value">{stats.ports}</div>
        </div>
        <div className="stat-card vulns">
          <div className="label">Vulns</div>
          <div className="value">{stats.vulns}</div>
        </div>
        <div className="stat-card scans">
          <div className="label">Scans</div>
          <div className="value">{stats.scans}</div>
        </div>
      </div>

      {stats.latest_scan && (
        <div className="scan-info">
          <div><span className="label">环境: </span><span className="val">{stats.latest_scan.env}</span></div>
          <div><span className="label">最新扫描: </span><span className="val">{stats.latest_scan.timestamp}</span></div>
        </div>
      )}

      <div className="page-header">
        <h2>🧠 Agent 审计日志</h2>
        <p>最近 10 条 Agent 操作记录</p>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>操作</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          {audit.length === 0 ? (
            <tr><td colSpan={3} style={{textAlign:'center', color:'var(--text-dim)'}}>暂无审计记录</td></tr>
          ) : audit.map((e, i) => (
            <tr key={i}>
              <td style={{fontFamily:'JetBrains Mono, monospace', fontSize:'0.8rem'}}>{e.timestamp}</td>
              <td><span className="badge badge-port">{e.action}</span></td>
              <td style={{color:'var(--text-secondary)', fontSize:'0.8rem'}}>{e.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
