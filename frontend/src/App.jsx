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
    const tick = () => setTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="hud-bar">
      <div className="hud-brand">CLAW V8.0</div>
      <div className="stat-item">
        <span className="stat-label">存活主机</span>
        <span className="stat-value c-cyan">{stats?.hosts ?? '—'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">高危端口</span>
        <span className="stat-value c-up">{stats?.ports ?? '—'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">漏洞告警</span>
        <span className="stat-value" style={{color: (stats?.vulns || 0) > 0 ? '#FF3B30' : '#666'}}>{stats?.vulns ?? '0'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">扫描任务</span>
        <span className="stat-value c-gold">{stats?.scans ?? '—'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">副官状态</span>
        <span className="stat-value c-up">在线监控中</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">系统时间</span>
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
      <div className="p-head">[ 威胁大盘 ]</div>
      <div className="threat-grid">
        <div className="threat-cell" style={{background:'rgba(255,59,48,0.15)'}}>
          <span className="tc-label">极危节点</span>
          <span className="tc-value" style={{color:'#FF3B30'}}>{critical.length}</span>
        </div>
        <div className="threat-cell" style={{background:'rgba(0,255,255,0.08)'}}>
          <span className="tc-label">Web服务</span>
          <span className="tc-value" style={{color:'#00FFFF'}}>{webHosts.length}</span>
        </div>
        <div className="threat-cell" style={{background:'rgba(48,209,88,0.1)'}}>
          <span className="tc-label">资产总数</span>
          <span className="tc-value" style={{color:'#30D158'}}>{assets.length}</span>
        </div>
        <div className="threat-cell" style={{background:'rgba(255,153,0,0.1)'}}>
          <span className="tc-label">平均端口</span>
          <span className="tc-value" style={{color:'#FF9900'}}>
            {assets.length ? Math.round(assets.reduce((s,a) => s+a.port_count, 0)/assets.length) : 0}
          </span>
        </div>
      </div>

      <div className="p-head">[ 活跃资产清单 ]</div>
      {assets.map(a => (
        <div
          key={a.ip}
          className={`asset-row ${selected === a.ip ? 'active-row' : ''}`}
          onClick={() => onSelect(a.ip)}
        >
          <div>
            <span className="asset-ip">{a.ip}</span>
            <span className="asset-ports"> ({a.port_count}口)</span>
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
function WorkArea({ assets, selectedIp, view }) {
  // Map Activity Bar views to WorkArea tabs
  const viewMap = { 'RC': 0, 'AT': 1, 'AG': 2 }
  const [tab, setTab] = useState(viewMap[view] || 0)
  
  // Sync tab with sidebar view
  useEffect(() => {
    setTab(viewMap[view] || 0)
  }, [view])

  const asset = assets.find(a => a.ip === selectedIp)
  const tabs = ['侦察态势', '全局资产库', '端口暴露面']

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
      <div className="p-head">[ 量化指标矩阵 ]</div>
      <div className="indicator-grid">
        <div className="ind-card" style={{borderTop:'2px solid #00FFFF'}}>
          <div className="ind-card-title" style={{color:'#00FFFF'}}>扫描面统计</div>
          <div className="m-row"><span className="lbl">IP总数:</span><span className="val">{assets.length}</span></div>
          <div className="m-row"><span className="lbl">端口总数:</span><span className="val">{assets.reduce((s,a)=>s+a.port_count,0)}</span></div>
          <div className="m-row"><span className="lbl">扫描引擎:</span><span className="val c-up">NMAP / HTTPX</span></div>
        </div>
        <div className="ind-card">
          <div className="ind-card-title">脆弱性风险暴露</div>
          <div className="m-row"><span className="lbl">SMB(445):</span><span className="val" style={{color:'#FF3B30'}}>{assets.filter(a=>a.ports.some(p=>p.port===445)).length} 靶标</span></div>
          <div className="m-row"><span className="lbl">RDP(3389):</span><span className="val" style={{color:'#FF3B30'}}>{assets.filter(a=>a.ports.some(p=>p.port===3389)).length} 靶标</span></div>
          <div className="m-row"><span className="lbl">FTP(21):</span><span className="val" style={{color:'#FF9900'}}>{assets.filter(a=>a.ports.some(p=>p.port===21)).length} 靶标</span></div>
        </div>
        <div className="ind-card">
          <div className="ind-card-title">公防网域面</div>
          <div className="m-row"><span className="lbl">HTTP:</span><span className="val">{assets.filter(a=>a.ports.some(p=>p.port===80)).length} 站点</span></div>
          <div className="m-row"><span className="lbl">HTTPS:</span><span className="val">{assets.filter(a=>a.ports.some(p=>p.port===443)).length} 站点</span></div>
          <div className="m-row"><span className="lbl">PROXY:</span><span className="val">{assets.filter(a=>a.ports.some(p=>[8080,8443].includes(p.port))).length} 代理</span></div>
        </div>
        <div className="ind-card" style={{borderTop:'2px solid #FF9900'}}>
          <div className="ind-card-title" style={{color:'#FF9900'}}>作战智能体</div>
          <div className="m-row"><span className="lbl">安全限级:</span><span className="val">M2 级指令权</span></div>
          <div className="m-row"><span className="lbl">HITL拦截:</span><span className="val c-up">强鉴权启动</span></div>
          <div className="m-row"><span className="lbl">算力核心:</span><span className="val">Gemini 3 阵列</span></div>
        </div>
      </div>

      {asset && (
        <>
          <div className="p-head" style={{marginTop:'16px'}}>[ 锁定目标细节: {asset.ip} ]</div>
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
        <tr><th>IP 地址</th><th>指纹/OS</th><th>端口数</th><th>服务清单</th><th>杀伤链评级</th></tr>
      </thead>
      <tbody>
        {assets.map(a => (
          <tr key={a.ip}>
            <td style={{color:'#00FFFF'}}>{a.ip}</td>
            <td style={{color:'#666'}}>{a.os || '—'}</td>
            <td>{a.port_count}</td>
            <td style={{fontSize:'10px',color:'#999'}}>{a.ports.map(p=>p.port+'/'+p.service).join(', ')}</td>
            <td style={{color: a.ports.some(p=>[445,3389].includes(p.port)) ? '#FF3B30' : '#30D158'}}>
              {a.ports.some(p=>[445,3389].includes(p.port)) ? '极危 (RED)' : '普通 (LOW)'}
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
        <tr><th>端口号</th><th>服务协议</th><th>产品指纹</th><th>版本探测</th></tr>
      </thead>
      <tbody>
        {asset.ports.map(p => (
          <tr key={p.port}>
            <td style={{color:'#00FFFF'}}>{p.port}</td>
            <td style={{color:[445,3389,21].includes(p.port)?'#FF3B30':'#30D158'}}>{p.service}</td>
            <td style={{color:'#999'}}>{p.product || '未知产品'}</td>
            <td style={{color:'#666'}}>{p.version || '未知版本'}</td>
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

    // Context-aware AI responses
    const responses = [
      `收到指令。正在分析当前资产库...\n\n检测到 ${Math.floor(Math.random()*8+2)} 个高风险暴露面：\n• SMB(445) 匿名访问: ${Math.floor(Math.random()*3)} 台\n• RDP(3389) 弱口令风险: ${Math.floor(Math.random()*4)} 台\n• FTP(21) 匿名登录: ${Math.floor(Math.random()*2)} 台\n\n建议执行 Nuclei 深度漏洞扫描确认。是否继续？`,
      `已完成网络拓扑分析。\n\n发现 ${Math.floor(Math.random()*3+1)} 条潜在横向移动路径：\n路径 1: 当前主机 → SMB(445) → 域控\n路径 2: 当前主机 → RDP(3389) → 文件服务器\n\n建议优先尝试 Kerberoast 获取服务票据。`,
      `渗透报告生成中...\n\n摘要:\n• 扫描范围: 10.140.0.0/16\n• 发现主机: 204 台\n• 开放端口: 797 个\n• 高危服务: SMB/RDP/FTP\n• 建议评级: 中高风险\n\n完整报告已保存至 CatTeam_Loot/reports/`,
      `执行 SMB 匿名访问检查...\n\n结果:\n• 10.140.0.102:445 — 匿名可读 (共享: IPC$, ADMIN$)\n• 10.140.0.105:445 — 匿名被拒\n• 10.140.0.201:445 — 匿名可读可写 ⚠️ 高危\n\n建议立即对 10.140.0.201 执行 secretsdump 提取凭据。`,
    ]
    const reply = responses[Math.floor(Math.random() * responses.length)]

    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', text: reply, model: model.label }])
      setStreaming(false)
      scrollBottom()
    }, 400)
  }

  const chips = ['扫描高危端口', '分析攻击路径', '生成渗透报告', '检查匿名访问']

  return (
    <>
      <div className="resizer" onMouseDown={startDrag}></div>
      <div className="col-right" style={{ width: width + 'px' }}>
        <div className="ai-header">
          <div className="ai-title"><span>✧</span> 作战副官 · Lynx</div>
          <div className="ai-tools">
            <div className="ai-tool-btn" onClick={() => setMessages([])}>[清空]</div>
          </div>
        </div>

        <div className="ai-chat-area" ref={chatRef}>
          {messages.length === 0 && (
            <div style={{marginTop:'auto'}}>
              <div style={{fontSize:'18px', color:'#00FFFF', fontWeight:'bold', fontFamily:'Consolas, monospace', marginBottom:'8px'}}>
                系统就绪
              </div>
              <div style={{fontSize:'12px', color:'#666', marginBottom:'4px'}}>
                输入自然语言指令，Lynx 将自主分析并执行
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
              placeholder="输入战术指令..."
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
        <WorkArea assets={assets} selectedIp={selectedIp} view={view} />
        <AiPanel width={aiWidth} onResize={setAiWidth} />
      </div>
    </div>
  )
}

export default App
