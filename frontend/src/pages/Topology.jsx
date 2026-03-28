import { useState, useEffect, useRef } from 'react'
import { Network, DataSet } from 'vis-network/standalone'

const API = `http://${window.location.hostname}:8000/api/v1`

export default function Topology() {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    fetch(`${API}/assets`)
      .then(r => r.json())
      .then(data => {
        if (!containerRef.current) return
        const assets = data.assets || []

        // Build nodes: gateway + hosts
        const nodes = new DataSet()
        const edges = new DataSet()

        // Central gateway node
        nodes.add({
          id: 'gateway',
          label: '⌐ GATEWAY\n' + (assets[0]?.ip?.replace(/\.\d+$/, '.1') || '10.0.0.1'),
          shape: 'diamond',
          color: { background: '#00ff4120', border: '#00ff41', highlight: { background: '#00ff4140', border: '#00ff41' } },
          font: { color: '#00ff41', face: 'JetBrains Mono, monospace', size: 11 },
          size: 30,
          borderWidth: 2,
          shadow: { enabled: true, color: '#00ff4130', size: 20 },
        })

        // Host nodes
        assets.forEach((a, i) => {
          const hasMany = a.port_count > 5
          const hasCritical = a.ports.some(p => [445, 3389, 22, 21].includes(p.port))
          const nodeColor = hasCritical ? '#ff3333' : hasMany ? '#ff9900' : '#00e5ff'

          nodes.add({
            id: a.ip,
            label: a.ip + '\n' + a.ports.map(p => p.port).slice(0, 4).join(',') + (a.port_count > 4 ? '...' : ''),
            shape: 'dot',
            color: {
              background: nodeColor + '20',
              border: nodeColor,
              highlight: { background: nodeColor + '50', border: nodeColor },
            },
            font: { color: '#c0c0c0', face: 'JetBrains Mono, monospace', size: 9 },
            size: 8 + Math.min(a.port_count * 2, 20),
            borderWidth: 1,
            title: `${a.ip}\nOS: ${a.os || '?'}\nPorts: ${a.ports.map(p => p.port + '/' + p.service).join(', ')}`,
          })

          edges.add({
            from: 'gateway',
            to: a.ip,
            color: { color: '#1a2332', highlight: nodeColor + '60' },
            width: 1,
            smooth: { type: 'continuous' },
          })
        })

        const options = {
          physics: {
            forceAtlas2Based: { gravitationalConstant: -40, centralGravity: 0.005, springLength: 120 },
            solver: 'forceAtlas2Based',
            stabilization: { iterations: 150 },
          },
          interaction: { hover: true, tooltipDelay: 100 },
          layout: { improvedLayout: true },
        }

        const network = new Network(containerRef.current, { nodes, edges }, options)

        network.on('click', params => {
          if (params.nodes.length > 0) {
            const ip = params.nodes[0]
            const asset = assets.find(a => a.ip === ip)
            if (asset) setInfo(asset)
          } else {
            setInfo(null)
          }
        })

        setLoading(false)
      })
      .catch(err => { console.error(err); setLoading(false) })
  }, [])

  return (
    <>
      <div className="term-header">
        <div className="path">root@claw:~# netdiscover -r 10.0.0.0/16<span className="cursor"></span></div>
        <div className="desc">// 网络拓扑图 — 点击节点查看详情 · 红色=高危端口 · 橙色=多端口 · 青色=正常</div>
      </div>

      <div style={{ display: 'flex', gap: '12px', height: 'calc(100vh - 120px)' }}>
        <div
          ref={containerRef}
          style={{
            flex: 1,
            background: '#0a0a0a',
            border: '1px solid #1a2332',
            position: 'relative',
          }}
        >
          {loading && <div className="loading" style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)'}}> 渲染拓扑图... <span className="cursor"></span></div>}
        </div>

        {info && (
          <div style={{
            width: '280px',
            background: '#0d1117',
            border: '1px solid #1a2332',
            borderLeft: '2px solid #00e5ff',
            padding: '12px',
            overflowY: 'auto',
            fontSize: '0.75rem',
          }}>
            <div style={{color:'#00e5ff', marginBottom:'8px', fontSize:'0.85rem'}}>
              {'>'} {info.ip}
            </div>
            <div style={{color:'#606060', marginBottom:'8px'}}>
              OS: {info.os || 'Unknown'}
            </div>
            <div style={{color:'#003d10', marginBottom:'6px'}}>
              ── open ports ({info.ports.length}) ──
            </div>
            {info.ports.map(p => (
              <div key={p.port} style={{padding:'2px 0', display:'flex', gap:'8px'}}>
                <span style={{color:'#00ff41', width:'40px'}}>{p.port}</span>
                <span style={{color:'#00e5ff'}}>{p.service}</span>
                <span style={{color:'#606060'}}>{p.product} {p.version}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
