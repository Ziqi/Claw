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
    clearTimeout(window._searchTimer)
    window._searchTimer = setTimeout(() => fetchAssets(val), 300)
  }

  return (
    <>
      <div className="term-header">
        <div className="path">root@claw:~# nmap --list-targets | wc -l<span className="cursor"></span></div>
        <div className="desc">// {total} targets enumerated — scan_id: {scanId || '—'}</div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="grep -i 'pattern' assets.db ..."
          value={search}
          onChange={handleSearch}
        />
      </div>

      {loading ? (
        <div className="loading"> QUERYING claw.db... <span className="cursor"></span></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ip_addr</th>
              <th>os_detect</th>
              <th>ports</th>
              <th>services[]</th>
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
                  <td style={{color:'var(--cyan)'}}>
                    {expanded === a.ip ? '[-]' : '[+]'} {a.ip}
                  </td>
                  <td style={{color:'var(--text-dim)'}}>{a.os || '—'}</td>
                  <td>
                    <span className="badge badge-port">{a.port_count}</span>
                  </td>
                  <td>
                    {a.ports.slice(0, 6).map(p => (
                      <span key={p.port} className="badge badge-port">{p.port}/{p.service}</span>
                    ))}
                    {a.ports.length > 6 && <span style={{color:'var(--text-dim)'}}> +{a.ports.length - 6}</span>}
                  </td>
                </tr>
                {expanded === a.ip && (
                  <tr key={a.ip + '-detail'}>
                    <td colSpan={4} style={{background:'var(--bg-dark)', padding:'8px 16px', borderLeft:'2px solid var(--green-dark)'}}>
                      <div style={{color:'var(--green-dark)', fontSize:'0.65rem', marginBottom:'6px'}}>
                        {'>'} nmap -sV {a.ip} — {a.ports.length} open ports
                      </div>
                      <table style={{width:'100%'}}>
                        <tbody>
                          {a.ports.map(p => (
                            <tr key={p.port}>
                              <td style={{padding:'2px 8px', color:'var(--green)', width:'60px', fontSize:'0.75rem'}}>{p.port}</td>
                              <td style={{padding:'2px 8px', color:'var(--cyan)', fontSize:'0.75rem'}}>{p.service}</td>
                              <td style={{padding:'2px 8px', color:'var(--text-dim)', fontSize:'0.7rem'}}>{p.product || ''} {p.version || ''}</td>
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
