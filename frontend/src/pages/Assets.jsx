import { useState, useEffect } from 'react'

const API = 'http://localhost:8000/api/v1'

export default function Assets() {
  const [assets, setAssets] = useState([])
  const [total, setTotal] = useState(0)
  const [scanId, setScanId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const fetchAssets = (q = '') => {
    setLoading(true)
    const url = q ? `${API}/assets?search=${encodeURIComponent(q)}` : `${API}/assets`
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setAssets(data.assets || [])
        setTotal(data.total || 0)
        setScanId(data.scan_id || '')
      })
      .catch(err => console.error('API error:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAssets() }, [])

  const handleSearch = (e) => {
    const val = e.target.value
    setSearch(val)
    // Debounce
    clearTimeout(window._searchTimer)
    window._searchTimer = setTimeout(() => fetchAssets(val), 300)
  }

  return (
    <>
      <div className="page-header">
        <h2>🖥️ Assets</h2>
        <p>{total} 个资产 · Scan: {scanId || '—'}</p>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="🔍 搜索 IP 或 OS..."
          value={search}
          onChange={handleSearch}
        />
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>IP</th>
              <th>OS</th>
              <th>端口数</th>
              <th>Services</th>
            </tr>
          </thead>
          <tbody>
            {assets.map(a => (
              <>
                <tr
                  key={a.ip}
                  onClick={() => setExpanded(expanded === a.ip ? null : a.ip)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{fontFamily:'JetBrains Mono, monospace', color:'var(--accent-cyan)'}}>
                    {expanded === a.ip ? '▼' : '▶'} {a.ip}
                  </td>
                  <td>{a.os || '—'}</td>
                  <td>
                    <span className="badge badge-port">{a.port_count}</span>
                  </td>
                  <td>
                    {a.ports.slice(0, 5).map(p => (
                      <span key={p.port} className="badge badge-port">{p.port}/{p.service}</span>
                    ))}
                    {a.ports.length > 5 && <span style={{color:'var(--text-dim)', fontSize:'0.75rem'}}> +{a.ports.length - 5}</span>}
                  </td>
                </tr>
                {expanded === a.ip && (
                  <tr key={a.ip + '-detail'}>
                    <td colSpan={4} style={{background:'var(--bg-secondary)', padding:'12px 24px'}}>
                      <table style={{width:'100%', fontSize:'0.8rem'}}>
                        <thead>
                          <tr>
                            <th style={{padding:'4px 8px', color:'var(--text-dim)'}}>Port</th>
                            <th style={{padding:'4px 8px', color:'var(--text-dim)'}}>Service</th>
                            <th style={{padding:'4px 8px', color:'var(--text-dim)'}}>Product</th>
                            <th style={{padding:'4px 8px', color:'var(--text-dim)'}}>Version</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.ports.map(p => (
                            <tr key={p.port}>
                              <td style={{padding:'4px 8px', color:'var(--accent-green)', fontFamily:'JetBrains Mono, monospace'}}>{p.port}</td>
                              <td style={{padding:'4px 8px'}}>{p.service}</td>
                              <td style={{padding:'4px 8px', color:'var(--text-secondary)'}}>{p.product || '—'}</td>
                              <td style={{padding:'4px 8px', color:'var(--text-secondary)'}}>{p.version || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
