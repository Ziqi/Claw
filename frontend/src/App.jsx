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
function AiPanel() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const chatRef = useRef(null)

  const scrollBottom = () => setTimeout(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, 10)

  const sendMessage = () => {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setStreaming(true)
    scrollBottom()

    // Simulate streaming response (replace with real API later)
    setTimeout(() => {
      const reply = `已扫描当前资产库。检测到 ${Math.floor(Math.random()*5+1)} 个高风险端口暴露。\n\n建议优先检查 SMB(445) 匿名访问和 RDP(3389) 弱口令。\n\n是否执行 Nuclei 深度漏洞扫描？`
      setMessages(prev => [...prev, { role: 'ai', text: reply, streaming: true }])
      setStreaming(false)
      scrollBottom()
    }, 800)
  }

  const chips = [
    '扫描当前资产的高危端口',
    '分析攻击路径',
    '生成渗透报告',
    '检查 SMB 匿名访问',
  ]

  return (
    <div className="col-right">
      <div className="ai-header">
        <div className="ai-title"><span>✧</span> LYNX Copilot</div>
        <div className="ai-tools">
          <div className="ai-tool-btn" onClick={() => setMessages([])}>[NEW]</div>
        </div>
      </div>

      <div className="ai-chat-area" ref={chatRef}>
        {messages.length === 0 && (
          <div style={{marginTop:'auto'}}>
            <div style={{fontSize:'20px', color:'#00FFFF', fontWeight:'bold', fontFamily:'Consolas, monospace', marginBottom:'8px'}}>
              SYSTEM.READY
            </div>
            <div style={{fontSize:'13px', color:'#666'}}>等待战术指令...</div>
            <div className="chip-group-title">── 快捷指令 ──</div>
            <div className="chips-wrap">
              {chips.map(c => (
                <div key={c} className="agent-chip" onClick={() => { setInput(c); }}>{c}</div>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} className="msg-user">{m.text}</div>
          ) : (
            <div key={i} className="msg-ai">
              <div className="ai-identity">✧ Flash 引擎</div>
              <StreamingText text={m.text} />
            </div>
          )
        ))}

        {streaming && (
          <div className="msg-ai">
            <div className="ai-identity">✧ Flash 引擎</div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
          </div>
        )}
      </div>

      <div className="input-wrapper">
        <div className="input-card">
          <input
            className="ai-input"
            placeholder="输入问题，或选择快捷指令..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
          />
          <div className="input-tools">
            <div className="model-selector">
              <span style={{color:'#00FFFF'}}>●</span>
              <span style={{color:'#D0D0D0'}}>Flash</span>
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
        <div className="resizer"></div>
        <AiPanel />
      </div>
    </div>
  )
}

export default App
