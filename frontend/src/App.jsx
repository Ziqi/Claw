import { useState, useEffect, useRef } from 'react'
import { fetchEventSource } from '@microsoft/fetch-event-source'
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
function Sidebar({ assets, onSelect, selected, view }) {
  const critical = assets.filter(a => a.ports.some(p => [445, 3389, 21].includes(p.port)))
  const webHosts = assets.filter(a => a.ports.some(p => [80, 443, 8080, 8443].includes(p.port)))

  if (view === 'RC') {
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
      </div>
    )
  }

  if (view === 'AT') {
    return (
      <div className="sidebar-panel">
        <div className="p-head">[ 活跃资产清单 ]</div>
        {assets.map(a => (
          <div key={a.ip} className={`asset-row ${selected === a.ip ? 'active-row' : ''}`} onClick={() => onSelect(a.ip)}>
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

  if (view === 'AG') {
    return (
      <div className="sidebar-panel">
        <div className="p-head">[ COMMAND & CONTROL ]</div>
        <div style={{padding: '16px', color:'#999', fontSize:'12px', lineHeight:'1.5'}}>
          <div style={{color:'#00FFFF', marginBottom:'8px'}}>» Agentic Loop</div>
          <div>状态: <span style={{color:'#30D158'}}>Active (Waiting)</span></div>
          <div>工具池: 5/5 在线</div>
          <div>沙箱: Secure</div>
        </div>
      </div>
    )
  }

  return null
}

// ========== WORK AREA TABS ==========
const VIEW_TABS = {
  RC: ['侦察态势', '漏洞日志'],
  AT: ['全局资产库', '端口暴露面'],
  AG: ['执行轨道', 'AI审计树'],
}

function WorkArea({ assets, selectedIp, view }) {
  const [tab, setTab] = useState(0)
  
  // reset tab when view changes
  useEffect(() => { setTab(0) }, [view])

  const asset = assets.find(a => a.ip === selectedIp)
  const tabs = VIEW_TABS[view] || []

  return (
    <div className="activity-main">
      <div className="terminal-tab-bar">
        {tabs.map((t, i) => (
          <button key={t} className={`terminal-tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>
      <div className="tab-content-area">
        {view === 'RC' && tab === 0 && <ReconOverview assets={assets} asset={asset} />}
        {view === 'RC' && tab === 1 && <div style={{color:'#666', fontSize:'12px', padding:'16px'}}>[SYS] 暂无未修复的高危漏洞记录</div>}
        
        {view === 'AT' && tab === 0 && <AssetTable assets={assets} />}
        {view === 'AT' && tab === 1 && (asset ? <PortMatrix asset={asset} /> : <div style={{color:'#666', padding:'16px'}}>请从左侧选择资产...</div>)}

        {view === 'AG' && tab === 0 && <div style={{color:'#00FFFF', fontSize:'12px', padding:'16px'}}>[SYS] 智能体循环处于待命状态。请使用右侧 Copilot 下发战术指令。</div>}
        {view === 'AG' && tab === 1 && <div style={{color:'#666', fontSize:'12px', padding:'16px'}}>[SYS] 审计追踪服务已启动。等待 Agent 执行动作...</div>}
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
  const [interactionId, setInteractionId] = useState(null)
  const chatRef = useRef(null)
  const isDragging = useRef(false)
  const abortRef = useRef(null)

  const scrollBottom = () => setTimeout(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, 10)

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

  const sendMessage = async () => {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setStreaming(true)
    scrollBottom()

    let aiText = ''
    let toolCalls = []

    setMessages(prev => [...prev, {
      role: 'ai', text: '', tools: [], model: model.label, thinking: true,
    }])

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      await fetchEventSource('http://localhost:8000/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg, interaction_id: interactionId }),
        signal: ctrl.signal,
        openWhenHidden: true,

        onmessage(ev) {
          const data = JSON.parse(ev.data)
          switch (ev.event) {
            case 'thinking':
              setMessages(prev => {
                const msgs = [...prev]; const last = msgs[msgs.length - 1]
                if (last?.role === 'ai') { last.thinking = true; last.thinkingStatus = data.status }
                return msgs
              })
              scrollBottom()
              break
            case 'tool_call':
              toolCalls.push({ name: data.name, args: data.args, risk: data.risk_level || 'green', status: 'running' })
              setMessages(prev => {
                const msgs = [...prev]; const last = msgs[msgs.length - 1]
                if (last?.role === 'ai') { last.tools = [...toolCalls]; last.thinking = false }
                return msgs
              })
              scrollBottom()
              break
            case 'tool_result': {
              const tc = toolCalls.findLast(t => t.name === data.name)
              if (tc) { tc.status = data.status; tc.preview = data.preview }
              setMessages(prev => {
                const msgs = [...prev]; const last = msgs[msgs.length - 1]
                if (last?.role === 'ai') last.tools = [...toolCalls]
                return msgs
              })
              scrollBottom()
              break
            }
            case 'delta':
              aiText += data.text
              setMessages(prev => {
                const msgs = [...prev]; const last = msgs[msgs.length - 1]
                if (last?.role === 'ai') { last.text = aiText; last.thinking = false }
                return msgs
              })
              scrollBottom()
              break
            case 'done':
              if (data.interaction_id) setInteractionId(data.interaction_id)
              setMessages(prev => {
                const msgs = [...prev]; const last = msgs[msgs.length - 1]
                if (last?.role === 'ai') { last.thinking = false; last.done = true }
                return msgs
              })
              setStreaming(false)
              scrollBottom()
              break
            case 'error':
              setMessages(prev => {
                const msgs = [...prev]; const last = msgs[msgs.length - 1]
                if (last?.role === 'ai') { last.text = `⚠️ ${data.message}`; last.thinking = false; last.done = true; last.isError = true }
                return msgs
              })
              setStreaming(false)
              scrollBottom()
              break
          }
        },
        onerror(err) {
          console.error('SSE error:', err)
          setMessages(prev => {
            const msgs = [...prev]; const last = msgs[msgs.length - 1]
            if (last?.role === 'ai') { last.text = '⚠️ 连接中断，请重试'; last.thinking = false; last.done = true; last.isError = true }
            return msgs
          })
          setStreaming(false)
          throw err
        },
        onclose() { setStreaming(false) },
      })
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Agent stream failed:', e)
      setStreaming(false)
    }
  }

  const stopStream = () => { if (abortRef.current) abortRef.current.abort(); setStreaming(false) }
  const chips = ['列出所有资产', '分析攻击路径', '扫描高危端口', '查看最新漏洞']

  return (
    <>
      <div className="resizer" onMouseDown={startDrag}></div>
      <div className="col-right" style={{ width: width + 'px' }}>
        <div className="ai-header">
          <div className="ai-title"><span>✧</span> 作战副官 · Lynx</div>
          <div className="ai-tools">
            <div className="ai-tool-btn" onClick={() => { setMessages([]); setInteractionId(null) }}>[清空]</div>
          </div>
        </div>

        <div className="ai-chat-area" ref={chatRef}>
          {messages.length === 0 && (
            <div style={{marginTop:'auto'}}>
              <div style={{fontSize:'18px', color:'#00FFFF', fontWeight:'bold', fontFamily:'Consolas, monospace', marginBottom:'8px'}}>
                系统就绪
              </div>
              <div style={{fontSize:'12px', color:'#666', marginBottom:'4px'}}>
                连接 Gemini 3 Interactions API · 实时流式对话
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
                {m.thinking && (
                  <div className="thinking-indicator">
                    <span className="thinking-dot"></span>
                    <span style={{color:'#888', fontSize:'12px'}}>{m.thinkingStatus || 'Lynx 正在思考...'}</span>
                  </div>
                )}
                {m.tools?.map((tc, j) => <ToolCallCard key={j} tool={tc} />)}
                {m.text && <StreamingText text={m.text} done={m.done} isError={m.isError} />}
              </div>
            )
          ))}
        </div>

        <div className="ai-input-float">
          <div className="input-card">
            <textarea
              className="ai-input"
              placeholder="输入战术指令..."
              rows={1}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
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
                      <div key={m.key} className={`dd-item ${model.key === m.key ? 'active' : ''}`} onClick={() => { setModel(m); setMenuOpen(false) }}>
                        <span style={{color: m.color}}>● {m.label}</span>
                        <span style={{fontSize:'9px', color:'#666'}}>{m.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {streaming ? (
                <button className="send-btn" onClick={stopStream} style={{background:'#FF3B30'}}>
                  <svg className="send-icon" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                </button>
              ) : (
                <button className="send-btn" onClick={sendMessage} disabled={!input.trim()}>
                  <svg className="send-icon" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function ToolCallCard({ tool }) {
  const riskColors = { green: '#30D158', yellow: '#FF9900', red: '#FF3B30' }
  const riskLabels = { green: '🟢', yellow: '🟡', red: '🔴' }
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid #222',
      borderLeft: `3px solid ${riskColors[tool.risk] || '#333'}`,
      borderRadius: '4px', padding: '8px 10px', margin: '6px 0',
      fontSize: '12px', fontFamily: 'Consolas, monospace',
    }}>
      <div style={{display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px'}}>
        <span>{riskLabels[tool.risk] || '🔧'}</span>
        <span style={{color:'#00FFFF'}}>{tool.name}</span>
        <span style={{color: tool.status === 'ok' ? '#30D158' : tool.status === 'error' ? '#FF3B30' : '#888', fontSize: '10px'}}>
          {tool.status === 'running' ? '⏳ 执行中...' : tool.status === 'ok' ? '✓ 完成' : tool.status === 'error' ? '✗ 失败' : tool.status}
        </span>
      </div>
      <div style={{color:'#666', fontSize:'11px', wordBreak:'break-all'}}>
        {JSON.stringify(tool.args).slice(0, 120)}
      </div>
      {tool.preview && <div style={{color:'#888', fontSize:'11px', marginTop:'4px'}}>{tool.preview}</div>}
    </div>
  )
}

function StreamingText({ text, done, isError }) {
  return (
    <div style={{color: isError ? '#FF3B30' : '#D0D0D0'}}>
      {text.split('\n').map((line, i) => (
        <span key={i}>{line}{i < text.split('\n').length - 1 && <br/>}</span>
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
        <Sidebar assets={assets} onSelect={setSelectedIp} selected={selectedIp} view={view} />
        <WorkArea assets={assets} selectedIp={selectedIp} view={view} />
        <AiPanel width={aiWidth} onResize={setAiWidth} />
      </div>
    </div>
  )
}

export default App

