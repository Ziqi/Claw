import { useState, useEffect, useRef } from 'react'
import './index.css'

const API = 'http://localhost:8000/api/v1'

// === Streaming text helper ===
function useTypewriter(text, speed = 15) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!text) return
    setDisplayed('')
    setDone(false)
    let i = 0
    const timer = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) { clearInterval(timer); setDone(true) }
    }, speed)
    return () => clearInterval(timer)
  }, [text, speed])
  return { displayed, done }
}

// ========== HUD BAR ==========
function HudBar({ stats }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="hud-bar">
      <div className="hud-brand">CLAW V8.0</div>
      <div className="stat-item">
        <span className="stat-label">HOSTS</span>
        <span className="stat-value c-cyan">{stats?.hosts ?? '—'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">PORTS</span>
        <span className="stat-value c-up">{stats?.ports ?? '—'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">VULNS</span>
        <span className="stat-value" style={{color: (stats?.vulns || 0) > 0 ? '#FF3B30' : '#666'}}>{stats?.vulns ?? '0'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">SCANS</span>
        <span className="stat-value c-gold">{stats?.scans ?? '—'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">AGENT</span>
        <span className="stat-value c-up">ONLINE</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">SYS_TIME</span>
        <span className="stat-value c-gold">{time}</span>
      </div>
    </div>
  )
}

// ========== LEFT SIDEBAR ==========
function Sidebar({ assets, onSelect, selected }) {
  // Threat summary cells
  const critical = assets.filter(a => a.ports.some(p => [445, 3389, 21].includes(p.port)))
  const webHosts = assets.filter(a => a.ports.some(p => [80, 443, 8080, 8443].includes(p.port)))

  return (
    <div className="sidebar-panel">
      <div className="p-head">[ THREAT OVERVIEW ]</div>
      <div className="threat-grid">
        <div className="threat-cell" style={{background:'rgba(255,59,48,0.15)'}}>
          <span className="tc-label">CRITICAL</span>
          <span className="tc-value" style={{color:'#FF3B30'}}>{critical.length}</span>
        </div>
        <div className="threat-cell" style={{background:'rgba(0,255,255,0.08)'}}>
          <span className="tc-label">WEB SVC</span>
          <span className="tc-value" style={{color:'#00FFFF'}}>{webHosts.length}</span>
        </div>
        <div className="threat-cell" style={{background:'rgba(48,209,88,0.1)'}}>
          <span className="tc-label">TOTAL</span>
          <span className="tc-value" style={{color:'#30D158'}}>{assets.length}</span>
        </div>
        <div className="threat-cell" style={{background:'rgba(255,153,0,0.1)'}}>
          <span className="tc-label">AVG PORTS</span>
          <span className="tc-value" style={{color:'#FF9900'}}>
            {assets.length ? Math.round(assets.reduce((s,a) => s+a.port_count, 0)/assets.length) : 0}
          </span>
        </div>
      </div>

      <div className="p-head">[ ASSET LIST ]</div>
      {assets.map(a => (
        <div
          key={a.ip}
          className={`asset-row ${selected === a.ip ? 'active-row' : ''}`}
          onClick={() => onSelect(a.ip)}
        >
          <div>
            <span className="asset-ip">{a.ip}</span>
            <span className="asset-ports"> ({a.port_count})</span>
          </div>
          <div style={{color: a.ports.some(p=>[445,3389].includes(p.port)) ? '#FF3B30' : '#666', fontSize:'10px'}}>
            {a.ports.slice(0,3).map(p=>p.port).join(',')}
          </div>
        </div>
      ))}
    </div>
  )
}

// ========== WORK AREA TABS ==========
function WorkArea({ assets, selectedIp }) {
  const [tab, setTab] = useState(0)
  const asset = assets.find(a => a.ip === selectedIp)
  const tabs = ['RECON_OVERVIEW', 'ASSET_TABLE', 'PORT_MATRIX']

  return (
    <div className="activity-main">
      <div className="terminal-tab-bar">
        {tabs.map((t, i) => (
          <button key={t} className={`terminal-tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>
      <div className="tab-content-area">
        {tab === 0 && <ReconOverview assets={assets} asset={asset} />}
        {tab === 1 && <AssetTable assets={assets} />}
        {tab === 2 && asset && <PortMatrix asset={asset} />}
      </div>
    </div>
  )
}

function ReconOverview({ assets, asset }) {
  return (
    <>
      <div className="p-head">[ INDICATOR MATRIX ]</div>
      <div className="indicator-grid">
        <div className="ind-card" style={{borderTop:'2px solid #00FFFF'}}>
          <div className="ind-card-title" style={{color:'#00FFFF'}}>SCAN STATUS</div>
          <div className="m-row"><span className="lbl">HOSTS:</span><span className="val">{assets.length}</span></div>
          <div className="m-row"><span className="lbl">PORTS:</span><span className="val">{assets.reduce((s,a)=>s+a.port_count,0)}</span></div>
          <div className="m-row"><span className="lbl">ENGINE:</span><span className="val c-up">NMAP</span></div>
        </div>
        <div className="ind-card">
          <div className="ind-card-title">RISK EXPOSURE</div>
          <div className="m-row"><span className="lbl">SMB(445):</span><span className="val" style={{color:'#FF3B30'}}>{assets.filter(a=>a.ports.some(p=>p.port===445)).length}</span></div>
          <div className="m-row"><span className="lbl">RDP(3389):</span><span className="val" style={{color:'#FF3B30'}}>{assets.filter(a=>a.ports.some(p=>p.port===3389)).length}</span></div>
          <div className="m-row"><span className="lbl">FTP(21):</span><span className="val" style={{color:'#FF9900'}}>{assets.filter(a=>a.ports.some(p=>p.port===21)).length}</span></div>
        </div>
        <div className="ind-card">
          <div className="ind-card-title">WEB SERVICES</div>
          <div className="m-row"><span className="lbl">HTTP:</span><span className="val">{assets.filter(a=>a.ports.some(p=>p.port===80)).length}</span></div>
          <div className="m-row"><span className="lbl">HTTPS:</span><span className="val">{assets.filter(a=>a.ports.some(p=>p.port===443)).length}</span></div>
          <div className="m-row"><span className="lbl">PROXY:</span><span className="val">{assets.filter(a=>a.ports.some(p=>[8080,8443].includes(p.port))).length}</span></div>
        </div>
        <div className="ind-card" style={{borderTop:'2px solid #FF9900'}}>
          <div className="ind-card-title" style={{color:'#FF9900'}}>AGENT</div>
          <div className="m-row"><span className="lbl">MODE:</span><span className="val">M2</span></div>
          <div className="m-row"><span className="lbl">HITL:</span><span className="val c-up">ACTIVE</span></div>
          <div className="m-row"><span className="lbl">MODEL:</span><span className="val">FLASH</span></div>
        </div>
      </div>

      {asset && (
        <>
          <div className="p-head" style={{marginTop:'16px'}}>[ SELECTED: {asset.ip} ]</div>
          <PortMatrix asset={asset} />
        </>
      )}
    </>
  )
}

function AssetTable({ assets }) {
  return (
    <table className="data-table">
      <thead>
        <tr><th>IP_ADDR</th><th>OS</th><th>PORTS</th><th>SERVICES</th><th>RISK</th></tr>
      </thead>
      <tbody>
        {assets.map(a => (
          <tr key={a.ip}>
            <td style={{color:'#00FFFF'}}>{a.ip}</td>
            <td style={{color:'#666'}}>{a.os || '—'}</td>
            <td>{a.port_count}</td>
            <td style={{fontSize:'10px',color:'#999'}}>{a.ports.map(p=>p.port+'/'+p.service).join(', ')}</td>
            <td style={{color: a.ports.some(p=>[445,3389].includes(p.port)) ? '#FF3B30' : '#30D158'}}>
              {a.ports.some(p=>[445,3389].includes(p.port)) ? 'HIGH' : 'LOW'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PortMatrix({ asset }) {
  return (
    <table className="data-table">
      <thead>
        <tr><th>PORT</th><th>SERVICE</th><th>PRODUCT</th><th>VERSION</th></tr>
      </thead>
      <tbody>
        {asset.ports.map(p => (
          <tr key={p.port}>
            <td style={{color:'#00FFFF'}}>{p.port}</td>
            <td style={{color:[445,3389,21].includes(p.port)?'#FF3B30':'#30D158'}}>{p.service}</td>
            <td style={{color:'#999'}}>{p.product || '—'}</td>
            <td style={{color:'#666'}}>{p.version || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ========== AI COPILOT PANEL ==========
const MODELS = [
  { key: 'flash', label: 'Flash', color: '#00FFFF', desc: '快速' },
  { key: 'pro', label: 'Pro', color: '#FF9900', desc: '均衡' },
  { key: 'deep', label: 'Deep Think', color: '#FF3B30', desc: '深度' },
]

function AiPanel({ width, onResize }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [model, setModel] = useState(MODELS[0])
  const [menuOpen, setMenuOpen] = useState(false)
  const chatRef = useRef(null)
  const isDragging = useRef(false)

  const scrollBottom = () => setTimeout(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, 10)

  // Drag resize
  const startDrag = (e) => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev) => {
      if (!isDragging.current) return
      const newW = Math.max(280, Math.min(window.innerWidth - ev.clientX, 700))
      onResize(newW)
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const sendMessage = () => {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setStreaming(true)
    scrollBottom()

    setTimeout(() => {
      const reply = `已扫描当前资产库。检测到 ${Math.floor(Math.random()*5+1)} 个高风险端口暴露。\n\n建议优先检查 SMB(445) 匿名访问和 RDP(3389) 弱口令。\n\n是否执行 Nuclei 深度漏洞扫描？`
      setMessages(prev => [...prev, { role: 'ai', text: reply, model: model.label }])
      setStreaming(false)
      scrollBottom()
    }, 800)
  }

  const chips = ['扫描高危端口', '分析攻击路径', '生成渗透报告', '检查 SMB 匿名访问']

  return (
    <>
      <div className="resizer" onMouseDown={startDrag}></div>
      <div className="col-right" style={{ width: width + 'px' }}>
        <div className="ai-header">
          <div className="ai-title"><span>✧</span> LYNX Copilot</div>
          <div className="ai-tools">
            <div className="ai-tool-btn" onClick={() => setMessages([])}>[NEW]</div>
          </div>
        </div>

        <div className="ai-chat-area" ref={chatRef} style={{ paddingBottom: '120px' }}>
          {messages.length === 0 && (
            <div style={{marginTop:'auto'}}>
              <div style={{fontSize:'18px', color:'#00FFFF', fontWeight:'bold', fontFamily:'Consolas, monospace', marginBottom:'8px'}}>
                SYSTEM.READY
              </div>
              <div style={{fontSize:'12px', color:'#666', marginBottom:'4px'}}>
                FC 语义触发：无需精确关键词，自然语言描述即可
              </div>
              <div className="chip-group-title">── 快捷指令 ──</div>
              <div className="chips-wrap">
                {chips.map(c => (
                  <div key={c} className="agent-chip" onClick={() => setInput(c)}>{c}</div>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="msg-user">{m.text}</div>
            ) : (
              <div key={i} className="msg-ai">
                <div className="ai-identity">✧ {m.model || model.label} 引擎</div>
                <StreamingText text={m.text} />
              </div>
            )
          ))}

          {streaming && (
            <div className="msg-ai">
              <div className="ai-identity">✧ {model.label} 引擎</div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
            </div>
          )}
        </div>

        {/* Floating bottom input */}
        <div className="ai-input-float">
          <div className="input-card">
            <textarea
              className="ai-input"
              placeholder="输入问题，或 @ 引用上下文..."
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            />
            <div className="input-tools">
              <div style={{position:'relative'}}>
                <div className="model-selector" onClick={() => setMenuOpen(!menuOpen)}>
                  <span style={{color: model.color}}>●</span>
                  <span style={{color:'#D0D0D0'}}>{model.label}</span>
                </div>
                {menuOpen && (
                  <div className="model-dropdown">
                    {MODELS.map(m => (
                      <div
                        key={m.key}
                        className={`dd-item ${model.key === m.key ? 'active' : ''}`}
                        onClick={() => { setModel(m); setMenuOpen(false) }}
                      >
                        <span style={{color: m.color}}>● {m.label}</span>
                        <span style={{fontSize:'9px', color:'#666'}}>{m.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="send-btn" onClick={sendMessage} disabled={!input.trim()}>
                <svg className="send-icon" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function StreamingText({ text }) {
  const { displayed, done } = useTypewriter(text, 12)
  return (
    <div>
      {displayed.split('\n').map((line, i) => (
        <span key={i}>{line}{i < displayed.split('\n').length - 1 && <br/>}</span>
      ))}
      {!done && <span className="typing-cursor"></span>}
    </div>
  )
}

// ========== MAIN APP ==========
function App() {
  const [stats, setStats] = useState(null)
  const [assets, setAssets] = useState([])
  const [selectedIp, setSelectedIp] = useState(null)
  const [view, setView] = useState('RC')
  const [aiWidth, setAiWidth] = useState(380)

  useEffect(() => {
    fetch(`${API}/stats`).then(r => r.json()).then(setStats).catch(console.error)
    fetch(`${API}/assets`).then(r => r.json()).then(d => {
      setAssets(d.assets || [])
      if (d.assets?.length) setSelectedIp(d.assets[0].ip)
    }).catch(console.error)
  }, [])

  return (
    <div className="app-container">
      <HudBar stats={stats} />
      <div className="main-shell">
        <div className="activity-bar">
          {[['RC','侦察'],['AT','资产'],['AG','AI']].map(([k,label]) => (
            <div key={k} className={`activity-icon ${view===k?'active':''}`} onClick={() => setView(k)}>{k}</div>
          ))}
        </div>
        <Sidebar assets={assets} onSelect={setSelectedIp} selected={selectedIp} />
        <div className="resizer"></div>
        <WorkArea assets={assets} selectedIp={selectedIp} />
        <AiPanel width={aiWidth} onResize={setAiWidth} />
      </div>
    </div>
  )
}

export default App
