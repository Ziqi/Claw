import React, { useState, useEffect, useRef } from 'react'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { Network } from 'vis-network'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Radar, AlertTriangle, Crown, Signal, Search, ClipboardList, Swords, BarChart, Settings, RefreshCw, Globe, Crosshair, Loader2, Rocket, Zap, Building, Flame, FlaskConical, Skull, KeyRound, Monitor, ShieldAlert, Copy, X, Info, Bug, Lock, Target, Radio, FileText, Wrench, Maximize2, Minimize2, Square, PanelBottom, ArrowUpRight, Terminal as TerminalIcon, Archive, Bot, MessageSquare } from 'lucide-react'
import useStore from './store'
import 'xterm/css/xterm.css'
import './index.css'

const API = `http://${window.location.hostname}:8000/api/v1`

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
function HudBar({ onRefreshAssets }) {
  const stats = useStore(s => s.stats)
  const onToggleTerminal = () => useStore.getState().setTerminalOpen(!useStore.getState().terminalOpen)
  const [time, setTime] = useState('')
  const [showScope, setShowScope] = useState(false)
  const [scopeList, setScopeList] = useState([])
  const [scopeInput, setScopeInput] = useState('')
  const [godMode, setGodMode] = useState(true)
  const [scopeStatus, setScopeStatus] = useState('')
  // Theater state
  const [theaters, setTheaters] = useState([])
  const [currentTheater, setCurrentTheater] = useState('default')
  const [showTheaterMenu, setShowTheaterMenu] = useState(false)
  const [showCreateTheater, setShowCreateTheater] = useState(false)
  const [showTheaterConfig, setShowTheaterConfig] = useState(false)
  const sudoPassword = useStore(s => s.sudoPassword)
  const setSudoPassword = useStore(s => s.setSudoPassword)
  
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // Fetch theaters on mount
  const refreshTheaters = () => {
    fetch(`${API}/env/list`).then(r => r.json()).then(d => {
      setTheaters(d.theaters || [])
      setCurrentTheater(d.current || 'default')
    }).catch(console.error)
  }
  useEffect(() => { refreshTheaters() }, [])

  // Expose currentTheater globally for OP Pipeline & OP Sidebar
  useEffect(() => { window.__claw_current_theater = currentTheater }, [currentTheater])

  const switchTheater = (name) => {
    fetch(`${API}/env/switch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      .then(r => r.json()).then(() => {
        setCurrentTheater(name)
        setShowTheaterMenu(false)
        refreshTheaters()
        onRefreshAssets()
      })
  }
  const handleExportReport = async () => {
    try {
      const res = await fetch(`${API}/report/generate`);
      const data = await res.json();
      const blob = new Blob([data.report], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CLAW_PTES_Report_${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to export report", err);
      alert("Report generation failed.");
    }
  }

  return (
    <div className="hud-bar">
      <div className="hud-brand" style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Consolas, monospace', color: '#FF9900', marginRight: '6px', fontSize: '13px' }} onMouseOver={e => { const tip = e.currentTarget.parentElement.querySelector('.cat-tip'); if (tip) tip.style.display = 'block' }} onMouseOut={e => { const tip = e.currentTarget.parentElement.querySelector('.cat-tip'); if (tip) tip.style.display = 'none' }}>{'/\\_/\\'}</span>
        <span style={{ fontFamily: 'Consolas, monospace', color: '#00FFFF', marginRight: '6px', fontSize: '13px' }}>{'( o.o )'}</span>
        CLAW V9.1
        
        <div style={{ marginLeft: '12px', padding: '2px 6px', background: sudoPassword ? 'rgba(48,209,88,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${sudoPassword ? '#30D158' : '#444'}`, borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
             onClick={() => {
               const pwd = window.prompt("⚠️ 配置全局 Root (Sudo) 提权密码\n用于底层模块与 AI 渗透模块的自动化提权调用:", sudoPassword || "")
               if (pwd !== null) setSudoPassword(pwd)
             }}
             title="全局提权钥匙环">
          <KeyRound size={12} color={sudoPassword ? '#30D158' : '#888'} /> 
          <span style={{ fontSize: '11px', color: sudoPassword ? '#30D158' : '#888' }}>{sudoPassword ? 'ROOT: ON' : 'ROOT: OFF'}</span>
        </div>

        <div className="cat-tip" style={{ display: 'none', position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '16px 20px', zIndex: 9999, whiteSpace: 'pre', fontFamily: 'Consolas, monospace', fontSize: '13px', lineHeight: '1.4', boxShadow: '0 8px 24px rgba(0,0,0,0.8)', minWidth: '340px' }}>
          <span style={{ color: '#00FFFF' }}>{"         /\\_/\\\n"}</span>
          <span style={{ color: '#00FFFF' }}>{"        ( o.o ) "}</span><span style={{ color: '#FFF', fontWeight: 'bold' }}>Project CLAW</span> <span style={{ color: '#30D158' }}>V8.2</span>{"\n"}
          <span style={{ color: '#00FFFF' }}>{"         > ^ <  "}</span><span style={{ color: '#666' }}>CatTeam Lateral Arsenal Weapon</span>{"\n"}
          <span style={{ color: '#00FFFF' }}>{"        /|   |\\\n"}</span>
          <span style={{ color: '#00FFFF' }}>{"       (_|   |_) "}</span><span style={{ color: '#999' }}>Codename: Lynx</span>
        </div>
      </div>

      <div style={{ position: 'relative', marginLeft: '8px', borderLeft: '1px solid #333', paddingLeft: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowTheaterMenu(o => !o)}>
            <span style={{ fontSize: '10px', color: '#666' }}>战区</span>
            <span style={{ fontSize: '12px', color: '#FF9900', fontWeight: 'bold' }}>{currentTheater}</span>
            <span style={{ fontSize: '10px', color: '#666' }}>▾</span>
          </div>
          <button style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} onClick={() => { setShowTheaterMenu(false); setShowScope(false); setShowTheaterConfig(true); }} title="战区配置">
            <Settings size={14} />
          </button>
        </div>
        {showTheaterMenu && (
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '6px', background: '#111', border: '1px solid #333', borderRadius: '6px', padding: '4px', zIndex: 9999, minWidth: '220px', boxShadow: '0 8px 24px rgba(0,0,0,0.8)' }}>
            {theaters.map(t => (
              <div key={t.name} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '4px', background: t.active ? 'rgba(255,153,0,0.1)' : 'transparent', transition: 'all 0.15s' }}
                onClick={() => switchTheater(t.name)}
                onMouseOver={e => { if (!t.active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseOut={e => { if (!t.active) e.currentTarget.style.background = 'transparent' }}>
                <div>
                  <span style={{ color: t.active ? '#FF9900' : '#D0D0D0', fontSize: '12px', fontWeight: t.active ? 'bold' : 'normal' }}>{t.active ? '● ' : ''}{t.name}</span>
                </div>
                <span style={{ fontSize: '10px', color: '#666' }}>{t.asset_count} 台</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #222', marginTop: '4px', paddingTop: '4px' }}>
              <div style={{ padding: '8px 12px', cursor: 'pointer', color: '#00FFFF', fontSize: '12px', borderRadius: '4px', transition: 'all 0.15s' }}
                onClick={() => { setShowTheaterMenu(false); setShowCreateTheater(true) }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(0,255,255,0.05)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}>+ 新建战区</div>
            </div>
          </div>
        )}
      </div>
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
        <span className="stat-value" style={{ color: (stats?.vulns || 0) > 0 ? '#FF3B30' : '#666' }}>{stats?.vulns ?? '0'}</span>
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
      <div className="stat-item" style={{ cursor: 'pointer', marginLeft: 'auto', borderLeft: '1px solid #333', paddingLeft: '16px' }}>
        <button style={{ background: godMode ? 'rgba(255,59,48,0.15)' : 'rgba(48,209,88,0.1)', color: godMode ? '#FF3B30' : '#30D158', border: `1px solid ${godMode ? '#FF3B30' : '#30D158'}`, padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => {
          fetch(`${API}/scope`).then(r => r.json()).then(d => { setScopeList(d.scope); setGodMode(d.god_mode); setScopeInput(d.scope.join('\n')); setShowScope(true) })
        }}>
          {godMode ? <>⚠ 上帝模式 (无限制)</> : <>🛡 Scope: {scopeList.length} 项</>}
        </button>
      </div>
      <div className="stat-item" style={{ cursor: 'pointer', borderLeft: '1px solid #333', paddingLeft: '16px' }}>
        <button style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,255,255,0.1)', color: '#00FFFF', border: '1px solid #00FFFF', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }} onClick={handleExportReport} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,255,255,0.2)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(0,255,255,0.1)'}>
          ⭳ 导出报告
        </button>
      </div>
      <div className="stat-item" style={{ cursor: 'pointer', borderLeft: '1px solid #333', paddingLeft: '16px' }} onClick={onToggleTerminal}>
        <span className="stat-label">控制台</span>
        <span className="stat-value" style={{ color: '#D0D0D0' }}>[Cmd+J] 切换</span>
      </div>

      {/* Scope Config Modal */}
      {showScope && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998 }} onClick={() => setShowScope(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '24px', zIndex: 9999, width: '440px', boxShadow: '0 8px 32px rgba(0,0,0,0.9)' }}>
            <div style={{ fontSize: '16px', color: '#00FFFF', fontWeight: 'bold', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🛡 作战授权范围 (Scope)</span>
              <span style={{ fontSize: '11px', color: godMode ? '#FF3B30' : '#30D158', background: godMode ? 'rgba(255,59,48,0.1)' : 'rgba(48,209,88,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                {godMode ? '上帝模式: 无限制' : `限定 ${scopeList.length} 项`}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '12px' }}>每行一个 IP 或 CIDR 子网，留空 = 上帝模式 (无限制扫描)</div>
            <textarea style={{ width: '100%', height: '120px', background: '#0A0A0A', color: '#D0D0D0', border: '1px solid #333', borderRadius: '4px', padding: '8px', fontFamily: 'Consolas, monospace', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box' }} value={scopeInput} onChange={e => setScopeInput(e.target.value)} placeholder={'例如:\n10.140.0.0/16\n192.168.1.0/24\n8.8.8.8'} />
            {scopeStatus && <div style={{ color: '#30D158', fontSize: '11px', marginTop: '8px' }}>{scopeStatus}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <button style={{ background: '#222', color: '#999', border: '1px solid #333', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => setShowScope(false)}>取消</button>
              <button style={{ background: 'rgba(0,255,255,0.1)', color: '#00FFFF', border: '1px solid #00FFFF', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} onClick={() => {
                const lines = scopeInput.split('\n').filter(l => l.trim())
                fetch(`${API}/scope`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: lines }) })
                  .then(r => r.json()).then(d => { setScopeList(lines); setGodMode(d.god_mode); setScopeStatus('✓ 已保存'); setTimeout(() => { setScopeStatus(''); setShowScope(false) }, 1000) })
              }}>保存 Scope</button>
            </div>
          </div>
        </>
      )}

      {/* Create / Config Theater Modal */}
      {showCreateTheater && <CreateTheaterModal onClose={() => setShowCreateTheater(false)} onCreated={() => { refreshTheaters(); onRefreshAssets(); setShowCreateTheater(false) }} />}
      {showTheaterConfig && <TheaterConfigModal theater={currentTheater} onClose={() => setShowTheaterConfig(false)} onUpdated={() => { refreshTheaters(); onRefreshAssets(); setShowTheaterConfig(false) }} />}
    </div>
  )
}

function TheaterConfigModal({ theater, onClose, onUpdated }) {
  const [name, setName] = useState(theater)
  const [status, setStatus] = useState(null)

  const handleRename = () => {
    if (!name.trim() || name === theater) return
    setStatus('更名中...')
    fetch(`${API}/env/rename`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ old_name: theater, new_name: name.trim() }) })
      .then(r => r.json()).then(d => {
        if (d.error) { setStatus(`✗ ${d.error}`); return }
        setStatus('✓ 已重命名')
        setTimeout(onUpdated, 500)
      }).catch(e => setStatus(`✗ ${e.message}`))
  }

  const handleDelete = () => {
    if (!confirm('WARNING: 将彻底删除战区 [' + theater + '] 及所有资产扫描数据? 此操作不可恢复！')) return
    setStatus('删除中...')
    fetch(`${API}/env/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: theater }) })
      .then(r => r.json()).then(d => {
        if (d.error) { setStatus(`✗ ${d.error}`); return }
        setStatus('✓ 已删除')
        setTimeout(onUpdated, 500)
      }).catch(e => setStatus(`✗ ${e.message}`))
  }

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '24px', zIndex: 9999, width: '420px', boxShadow: '0 8px 32px rgba(0,0,0,0.9)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', color: '#FF9900', fontWeight: 'bold', marginBottom: '16px' }}>
          <Settings size={18} /> 战区配置: {theater}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>重命名战区</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={{ flex: 1, background: '#0A0A0A', color: '#D0D0D0', border: '1px solid #333', borderRadius: '4px', padding: '8px', fontFamily: 'Consolas', fontSize: '12px' }} value={name} onChange={e => setName(e.target.value)} disabled={theater === 'default'} />
            <button style={{ background: '#2A2A2A', color: '#00FFFF', border: '1px solid #333', padding: '0 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={handleRename} disabled={theater === 'default' || name === theater}>修改</button>
          </div>
          {theater === 'default' && <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>注: 系统默认战区无法重命名</div>}
        </div>

        <div style={{ marginBottom: '16px', borderTop: '1px solid #222', paddingTop: '16px' }}>
          <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>高危操作</div>
          <button style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: '1px solid #FF3B30', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', width: '100%' }} onClick={handleDelete} disabled={theater === 'default'}>
            🗑 彻底删除战区数据
          </button>
        </div>

        {status && <div style={{ fontSize: '11px', color: status.includes('✗') ? '#FF3B30' : '#30D158', marginBottom: '12px' }}>{status}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button style={{ background: '#222', color: '#D0D0D0', border: '1px solid #333', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>关闭</button>
        </div>
      </div>
    </>
  )
}

function CreateTheaterModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [envType, setEnvType] = useState('lan')
  const [targets, setTargets] = useState('')
  const [status, setStatus] = useState(null)

  const handleCreate = () => {
    if (!name.trim()) { setStatus('⚠ 战区名称不能为空'); return }
    setStatus('创建中...')
    fetch(`${API}/env/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), env_type: envType, targets }) })
      .then(r => r.json()).then(d => {
        if (d.error) { setStatus(`✗ ${d.error}`); return }
        setStatus('✓ 已创建')
        setTimeout(onCreated, 500)
      }).catch(e => setStatus(`✗ ${e.message}`))
  }

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '24px', zIndex: 9999, width: '440px', boxShadow: '0 8px 32px rgba(0,0,0,0.9)' }}>
        <div style={{ fontSize: '16px', color: '#FF9900', fontWeight: 'bold', marginBottom: '16px' }}>+ 新建作战战区 (Theater)</div>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '16px' }}>每个战区独立隔离资产数据。切换网络或开展新任务时创建新战区。</div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>战区名称</div>
          <input style={{ width: '100%', background: '#0A0A0A', color: '#D0D0D0', border: '1px solid #333', borderRadius: '4px', padding: '8px', fontFamily: 'Consolas', fontSize: '12px', boxSizing: 'border-box' }} value={name} onChange={e => setName(e.target.value)} placeholder="如: IoT-Lab / AscottLot / 公网VPS" />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>战区类型</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[['lan', 'LAN', Building], ['public', 'WAN', Globe], ['lab', 'LAB', FlaskConical]].map(([k, label, Icon]) => (
              <button key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flex: 1, background: envType === k ? 'rgba(255,153,0,0.15)' : '#0A0A0A', color: envType === k ? '#FF9900' : '#666', border: `1px solid ${envType === k ? '#FF9900' : '#333'}`, borderRadius: '4px', padding: '6px', cursor: 'pointer', fontSize: '11px', transition: 'all 0.2s' }} onClick={() => setEnvType(k)}><Icon size={12} /> {label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>初始目标 (可选, 每行一个 IP/CIDR)</div>
          <textarea style={{ width: '100%', height: '80px', background: '#0A0A0A', color: '#D0D0D0', border: '1px solid #333', borderRadius: '4px', padding: '8px', fontFamily: 'Consolas', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box' }} value={targets} onChange={e => setTargets(e.target.value)} placeholder={'10.140.0.0/24\n192.168.1.100\n45.76.x.x'} />
        </div>

        {status && <div style={{ fontSize: '11px', color: status.includes('✗') || status.includes('⚠') ? '#FF3B30' : '#30D158', marginBottom: '8px' }}>{status}</div>}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button style={{ background: '#222', color: '#999', border: '1px solid #333', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>取消</button>
          <button style={{ background: 'rgba(255,153,0,0.15)', color: '#FF9900', border: '1px solid #FF9900', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} onClick={handleCreate}>创建并切换</button>
        </div>
      </div>
    </>
  )
}

// ========== LEFT SIDEBAR ==========
function Sidebar({ onRefreshAssets }) {
  const assets = useStore(s => s.assets)
  const onSelect = useStore(s => s.setSelectedIp)
  const selected = useStore(s => s.selectedIp)
  const view = useStore(s => s.view)
  const onNavigate = useStore(s => s.setView)

  const critical = assets.filter(a => a.ports.some(p => [445, 3389, 21].includes(p.port)))
  const webHosts = assets.filter(a => a.ports.some(p => [80, 443, 8080, 8443].includes(p.port)))
  const [probeTarget, setProbeTarget] = useState('')
  const [probeProfile, setProbeProfile] = useState('default')
  const [probeStatus, setProbeStatus] = useState(null)
  const [envMode, setEnvMode] = useState('current')

  // AT filters (Global Zustand Sync)
  const search = useStore(state => state.searchFilter)
  const setSearch = useStore(state => state.setSearchFilter)
  const riskFilter = useStore(state => state.riskFilter)
  const setRiskFilter = useStore(state => state.setRiskFilter)
  const portFilter = useStore(state => state.portFilter)
  const setPortFilter = useStore(state => state.setPortFilter)

  const globalTargets = useStore(state => state.globalTargets || [])
  const toggleGlobalTarget = useStore(state => state.toggleGlobalTarget)

  const critCount = assets.filter(a => a.ports.some(p => [445, 3389, 21].includes(p.port))).length

  const mappedView = view === 'HQ' || view === 'VS' ? 'RC' : view === 'DP' ? 'AT' : view;

  if (mappedView === 'RC') {
    const isCritical = (a) => a.ports.some(p => [445, 3389, 21].includes(p.port))
    return (
      <div className="sidebar-panel">
        <div className="p-head">[ 威胁大盘 ]</div>
        <div className="threat-grid">
          <div className="threat-cell" style={{ background: 'rgba(255,59,48,0.15)', cursor: 'pointer' }} title="开放了 SMB(445)/RDP(3389)/FTP(21) 等高危端口的主机" onClick={() => { if (critical.length > 0) onSelect(critical[0].ip) }}>
            <span className="tc-label">极危节点</span>
            <span className="tc-value" style={{ color: '#FF3B30' }}>{critical.length}</span>
            <span style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>含 SMB/RDP/FTP 高危端口</span>
          </div>
          <div className="threat-cell" style={{ background: 'rgba(0,255,255,0.08)', cursor: 'pointer' }} title="开放了 HTTP/HTTPS 类 Web 端口的主机总数" onClick={() => { if (webHosts.length > 0) onSelect(webHosts[0].ip) }}>
            <span className="tc-label">Web服务</span>
            <span className="tc-value" style={{ color: '#00FFFF' }}>{webHosts.length}</span>
            <span style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>含 80/443/8080 端口</span>
          </div>
          <div className="threat-cell" style={{ background: 'rgba(48,209,88,0.1)', cursor: 'pointer' }} title="本次扫描中发现的所有存活 IP 总数" onClick={() => { if (assets.length > 0) onSelect(assets[0].ip) }}>
            <span className="tc-label">资产总数</span>
            <span className="tc-value" style={{ color: '#30D158' }}>{assets.length}</span>
            <span style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>本次扫描存活 IP</span>
          </div>
          <div className="threat-cell" style={{ background: 'rgba(255,153,0,0.1)' }} title="每台主机平均开放的端口数量，越高说明攻击面越大">
            <span className="tc-label">平均端口</span>
            <span className="tc-value" style={{ color: '#FF9900' }}>
              {assets.length ? Math.round(assets.reduce((s, a) => s + a.port_count, 0) / assets.length) : 0}
            </span>
            <span style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>平均暴露面指标</span>
          </div>
        </div>

        {/* 全量资产列表 — 点击即在 RC 页面展开目标细节 */}
        <div style={{ marginTop: '12px' }}>
          <div className="p-head">[ 资产节点 ({assets.length}) ]</div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {assets.length === 0 && <div style={{ fontSize: '10px', color: '#666', padding: '8px' }}>暂无资产数据</div>}
            {[...assets].sort((a, b) => {
              const critA = isCritical(a) ? 1000 : 0
              const critB = isCritical(b) ? 1000 : 0
              if (critA !== critB) return critB - critA
              
              // Safe IP parsing to avoid React unmount crashes on malformed assets
              const parseIp = (ipStr) => {
                if (!ipStr || typeof ipStr !== 'string') return 0;
                const parts = ipStr.split('.');
                if (parts.length !== 4) return 0;
                return parts.reduce((acc, oct) => (acc << 8) + (parseInt(oct, 10) || 0), 0);
              }
              
              return parseIp(a.ip) - parseIp(b.ip)
            }).map(a => {
              const crit = isCritical(a)
              const isActive = selected === a.ip
              const isTargeted = globalTargets.includes(a.ip)
              return (
                <div key={a.ip} className={`asset-row ${isActive ? 'active-row' : ''}`} onClick={() => onSelect(isActive ? null : a.ip)} style={{ borderLeft: crit ? '2px solid #FF3B30' : isActive ? '2px solid #00FFFF' : '2px solid transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div 
                      onClick={(e) => { e.stopPropagation(); toggleGlobalTarget(a.ip); }} 
                      style={{ cursor: 'pointer', width: '12px', height: '12px', border: `1px solid ${isTargeted ? '#FF3B30' : '#444'}`, background: isTargeted ? '#FF3B30' : 'transparent', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      title="加入锁定目标"
                    >
                      {isTargeted && <X size={10} color="#000" style={{ fontWeight: 'bold' }} />}
                    </div>
                    <span>
                      <span className="asset-ip">{a.ip}</span>
                      {crit && <span style={{ color: '#FF3B30', fontSize: '9px', marginLeft: '4px', fontWeight: 'bold' }}>RED</span>}
                    </span>
                  </div>
                  <span className="asset-ports" style={{ flexShrink: 0 }}>{a.port_count}p</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Target Probe */}
        <div style={{ marginTop: '12px', padding: '12px 0 0', borderTop: '1px solid #222' }}>
          <div className="p-head" style={{ marginBottom: '8px' }}>[ 目标探测 ]</div>
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>输入 IP 或 CIDR，发起实弹 Nmap 扫描</div>
          <input type="text" value={probeTarget} onChange={e => setProbeTarget(e.target.value)} placeholder="例如: 192.168.1.1 或 10.0.0.0/24" style={{ width: '100%', background: '#0A0A0A', color: '#D0D0D0', border: '1px solid #333', borderRadius: '4px', padding: '6px 8px', fontFamily: 'Consolas, monospace', fontSize: '12px', boxSizing: 'border-box', marginBottom: '6px' }} onKeyDown={e => { if (e.key === 'Enter' && probeTarget.trim()) { document.getElementById('probe-btn')?.click() } }} />
          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
            {['default', 'iot', 'full'].map(p => (
              <button key={p} style={{ flex: 1, background: probeProfile === p ? 'rgba(0,255,255,0.15)' : '#111', color: probeProfile === p ? '#00FFFF' : '#666', border: `1px solid ${probeProfile === p ? '#00FFFF' : '#333'}`, borderRadius: '4px', padding: '4px', fontSize: '10px', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setProbeProfile(p)}>
                {p === 'default' ? '常规 (7口)' : p === 'iot' ? 'IoT (11口)' : '全量 (30口)'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', border: '1px solid #333', borderRadius: '4px', padding: '4px' }}>
            <button style={{ flex: 1, background: envMode === 'current' ? 'rgba(255,255,255,0.05)' : 'transparent', color: envMode === 'current' ? '#D0D0D0' : '#666', border: 'none', borderRadius: '4px', padding: '6px', fontSize: '11px', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setEnvMode('current')}>并入当前战区</button>
            <button style={{ flex: 1, background: envMode === 'sandbox' ? 'rgba(255,153,0,0.15)' : 'transparent', color: envMode === 'sandbox' ? '#FF9900' : '#666', border: 'none', borderRadius: '4px', padding: '6px', fontSize: '11px', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setEnvMode('sandbox')}>新建独立沙盒</button>
          </div>
          <button id="probe-btn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: '1px solid #FF3B30', borderRadius: '4px', padding: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }} disabled={!probeTarget.trim() || probeStatus === 'scanning'} onClick={() => {
            setProbeStatus('scanning')
            fetch(`${API}/probe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: probeTarget.trim(), profile: probeProfile, env_mode: envMode }) })
              .then(r => r.json()).then(d => {
                setProbeStatus(`✓ ${d.message}`)
                setTimeout(() => { if (onRefreshAssets) onRefreshAssets(); setProbeStatus(null) }, 30000)
              }).catch(e => { setProbeStatus(`✗ 失败: ${e.message}`); setTimeout(() => setProbeStatus(null), 5000) })
          }} onMouseOver={e => { if (probeTarget.trim()) e.currentTarget.style.background = 'rgba(255,59,48,0.2)' }} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,59,48,0.1)'}>
            {probeStatus === 'scanning' ? <><Loader2 size={12} className="spin" /> 扫描中...</> : <><Crosshair size={12} /> 发起探测</>}
          </button>
          {probeStatus && probeStatus !== 'scanning' && <div style={{ fontSize: '10px', color: '#30D158', marginTop: '6px' }}>{probeStatus}</div>}
        </div>
      </div>
    )
  }

  if (mappedView === 'AT') {

    return (
      <div className="sidebar-panel">
        <div className="p-head">[ 筛选与探测 ]</div>

        {/* Search */}
        <div style={{ padding: '8px 8px 0' }}>
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); onSelect(null) }} placeholder="搜索 IP 地址..." style={{ width: '100%', background: '#0A0A0A', color: '#D0D0D0', border: '1px solid #333', borderRadius: '4px', padding: '6px 8px', fontFamily: 'Consolas, monospace', fontSize: '11px', boxSizing: 'border-box' }} />
        </div>

        {/* Risk Filter */}
        <div style={{ padding: '8px' }}>
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>风险等级</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[['all', '全部', assets.length, '#D0D0D0'], ['red', '极危', critCount, '#FF3B30'], ['low', '普通', assets.length - critCount, '#30D158']].map(([k, label, count, color]) => (
              <button key={k} style={{ flex: 1, background: riskFilter === k ? 'rgba(0,255,255,0.1)' : '#111', color: riskFilter === k ? '#00FFFF' : '#666', border: `1px solid ${riskFilter === k ? '#00FFFF' : '#333'}`, borderRadius: '4px', padding: '6px 4px', fontSize: '10px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }} onClick={() => setRiskFilter(k)}>
                <div>{label}</div>
                <div style={{ color, fontSize: '14px', fontWeight: 'bold' }}>{count}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Port Type Filter */}
        <div style={{ padding: '0 8px 8px' }}>
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>端口类型快筛</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {[[null, '全部'], [80, 'Web'], [445, 'SMB'], [3389, 'RDP'], [22, 'SSH'], [3306, 'DB']].map(([port, label]) => (
              <button key={label} style={{ background: portFilter === port ? 'rgba(0,255,255,0.1)' : '#111', color: portFilter === port ? '#00FFFF' : '#666', border: `1px solid ${portFilter === port ? '#00FFFF' : '#333'}`, borderRadius: '4px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setPortFilter(port)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding: '8px', borderTop: '1px solid #222' }}>
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>当前筛选结果</div>
          <div style={{ fontSize: '12px', color: '#00FFFF' }}>
            {assets.filter(a => {
              if (search && !a.ip.includes(search)) return false
              if (riskFilter === 'red' && !a.ports.some(p => [445, 3389, 21].includes(p.port))) return false
              if (riskFilter === 'low' && a.ports.some(p => [445, 3389, 21].includes(p.port))) return false
              if (portFilter && !a.ports.some(p => p.port === portFilter)) return false
              return true
            }).length} / {assets.length} 台主机
          </div>
        </div>

        {/* Target Probe */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid #222' }}>
          <div style={{ fontSize: '10px', color: '#FF9900', fontWeight: 'bold', marginBottom: '6px' }}>目标探测</div>
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '6px' }}>输入 IP 或 CIDR 发起实弹 Nmap 扫描</div>
          <input type="text" value={probeTarget} onChange={e => setProbeTarget(e.target.value)} placeholder="例: 192.168.1.1" style={{ width: '100%', background: '#0A0A0A', color: '#D0D0D0', border: '1px solid #333', borderRadius: '4px', padding: '6px 8px', fontFamily: 'Consolas, monospace', fontSize: '11px', boxSizing: 'border-box', marginBottom: '6px' }} onKeyDown={e => { if (e.key === 'Enter' && probeTarget.trim()) document.getElementById('probe-btn-at')?.click() }} />
          <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
            {['default', 'iot', 'full'].map(p => (
              <button key={p} style={{ flex: 1, background: probeProfile === p ? 'rgba(0,255,255,0.15)' : '#111', color: probeProfile === p ? '#00FFFF' : '#666', border: `1px solid ${probeProfile === p ? '#00FFFF' : '#333'}`, borderRadius: '4px', padding: '3px', fontSize: '9px', cursor: 'pointer' }} onClick={() => setProbeProfile(p)}>
                {p === 'default' ? '常规' : p === 'iot' ? 'IoT' : '全量'}
              </button>
            ))}
          </div>
          <button id="probe-btn-at" style={{ width: '100%', background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: '1px solid #FF3B30', borderRadius: '4px', padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }} disabled={!probeTarget.trim() || probeStatus === 'scanning'} onClick={() => {
            setProbeStatus('scanning')
            fetch(`${API}/probe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: probeTarget.trim(), profile: probeProfile }) })
              .then(r => r.json()).then(d => {
                setProbeStatus(`✓ ${d.message}`)
                setTimeout(() => { if (onRefreshAssets) onRefreshAssets(); setProbeStatus(null) }, 30000)
              }).catch(e => { setProbeStatus(`✗ ${e.message}`); setTimeout(() => setProbeStatus(null), 5000) })
          }}>
            {probeStatus === 'scanning' ? '⟳ 扫描中...' : '▸ 发起探测'}
          </button>
          {probeStatus && probeStatus !== 'scanning' && <div style={{ fontSize: '10px', color: '#30D158', marginTop: '4px' }}>{probeStatus}</div>}
        </div>
      </div>
    )
  }

  // OP: 轻量作战侧边栏
  if (mappedView === 'OP') {
    return (
      <div className="sidebar-panel">
        <div className="p-head">[ 作战上下文 ]</div>
        <div style={{ padding: '8px 4px', fontSize: '11px', color: '#D0D0D0' }}>
          <div className="m-row"><span className="lbl">当前战区:</span><span className="val c-gold">{window.__claw_current_theater || 'default'}</span></div>
          <div className="m-row"><span className="lbl">资产总数:</span><span className="val">{assets.length}</span></div>
          <div className="m-row"><span className="lbl">高危节点:</span><span className="val" style={{ color: '#FF3B30' }}>{critical.length}</span></div>
          <div className="m-row"><span className="lbl">Web 站点:</span><span className="val" style={{ color: '#00FFFF' }}>{webHosts.length}</span></div>
        </div>
        <div className="p-head" style={{ marginTop: '16px' }}>[ 快速跳转 ]</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
          <button style={{ background: '#111', color: '#00FFFF', border: '1px solid #333', padding: '6px 8px', cursor: 'pointer', fontSize: '11px', textAlign: 'left', transition: 'all 0.2s' }} onClick={() => onNavigate('RC')} onMouseOver={e => e.currentTarget.style.borderColor = '#00FFFF'} onMouseOut={e => e.currentTarget.style.borderColor = '#333'}>← 返回侦察态势</button>
          <button style={{ background: '#111', color: '#FF9900', border: '1px solid #333', padding: '6px 8px', cursor: 'pointer', fontSize: '11px', textAlign: 'left', transition: 'all 0.2s' }} onClick={() => onNavigate('AT')} onMouseOver={e => e.currentTarget.style.borderColor = '#FF9900'} onMouseOut={e => e.currentTarget.style.borderColor = '#333'}>→ 资产台账操作</button>
        </div>
        <div className="p-head" style={{ marginTop: '16px' }}>[ 使用说明 ]</div>
        <div style={{ padding: '4px', fontSize: '10px', color: '#666', lineHeight: '1.6' }}>
          选择作战阶段 → 点击「▶ 执行」按钮 → 控制台自动显示实时输出。<br />完成后资产列表会自动刷新。
        </div>
      </div>
    )
  }

  return null
}

const VIEW_TABS = {
  RC: ['侦察态势'],
  AT: ['全局资产库'],
  AM: ['作战兵器库 (Armory)', '云端战车 (Docker)'],
  C2: ['控制中心 (Sessions)', '监听器 (Listeners)'],
  VS: ['星图拓扑 (Network)', 'ATT&CK 杀伤链'],
}

function CampaignPipeline({ stats }) {
  const [openDropdown, setOpenDropdown] = useState(null)
  
  const steps = [
    { icon: <Target size={16} />, label: '战区锚定', actions: ['探测全段存活主机 (Nmap)', '枚举 C 段网段分布', '生成子域结构树'] },
    { icon: <Radio size={16} />, label: '射频嗅探', actions: ['扫描所有高危端口', '识别 HTTP/Web指纹', '提取服务端证书参数'] },
    { icon: <Search size={16} />, label: '脆弱性指纹', actions: ['全自动化 Nuclei 猎潜', '执行 MSF 漏扫', '针对 SSH/RDP/SMB 弱口令爆破'] },
    { icon: <Swords size={16} />, label: 'Alfa 注入', actions: ['部署 Sliver 远控节点', '下发生存免杀 Shellcode', '挂载代理隧道打入内网'] },
    { icon: <FileText size={16} />, label: '战报生成', actions: ['导出资产 Markdown', '一键生成 PTES 攻防审计战报'] }
  ]
  
  // Dynamically compute the active stage based on current stats
  let active = 1
  if (stats) {
    if ((stats.hosts || 0) > 0) active = 2
    if ((stats.ports || 0) > 0) active = 3
    if ((stats.vulns || 0) > 0) active = 4
  }

  // Handle outside clicks
  useEffect(() => {
    const handleOutsideClick = () => setOpenDropdown(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <div style={{ background: '#050505', borderBottom: '1px solid #222', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', width: '100%', maxWidth: '800px' }}>
        {steps.map((st, i) => (
          <React.Fragment key={i}>
            <div 
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                color: i < active ? '#30D158' : i === active ? '#00FFFF' : '#666',
                fontWeight: i <= active ? 'bold' : 'normal',
                textShadow: i === active ? '0 0 10px rgba(0,255,255,0.4)' : 'none',
                opacity: i > active ? 0.4 : 1,
                transition: 'all 0.3s'
              }}
              onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === i ? null : i) }}
            >
              <div style={{ 
                width: '32px', height: '32px', borderRadius: '50%', background: i === active ? 'rgba(0,255,255,0.1)' : '#111', 
                border: `2px solid ${i < active ? '#30D158' : i === active ? '#00FFFF' : '#333'}`, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                boxShadow: i === active ? '0 0 12px rgba(0,255,255,0.2)' : 'none'
              }}>
                {i < active ? '✓' : st.icon}
              </div>
              <span style={{ fontSize: '13px' }}>{st.label} ▾</span>

              {openDropdown === i && (
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '12px', background: 'rgba(10,10,10,0.95)', border: `1px solid ${i < active ? '#30D158' : '#00FFFF'}`, borderRadius: '6px', zIndex: 9999, width: '220px', boxShadow: '0 8px 32px rgba(0,0,0,0.9)', padding: '6px 0', textShadow: 'none', fontWeight: 'normal', color: '#D0D0D0', backdropFilter: 'blur(10px)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '6px 14px', fontSize: '10px', color: '#666', marginBottom: '4px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '6px' }}><Crosshair size={10} /> 智能体战术推演菜单</div>
                  {st.actions.map((act, j) => (
                    <div key={j} style={{ padding: '10px 14px', fontSize: '12px', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,255,255,0.1)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'} onClick={() => {
                        window.dispatchEvent(new CustomEvent('claw-exec-cmd', { detail: `请求对当前锁定资产启动: ${act}` }));
                        setOpenDropdown(null);
                    }}>
                      <span style={{ color: '#FF9900' }}>▸</span> {act}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: i < active ? '#30D158' : '#222', margin: '0 16px', position: 'relative' }}>
                {i === active - 1 && <div style={{ position: 'absolute', right: 0, top: '-2px', width: '6px', height: '6px', borderRadius: '50%', background: '#00FFFF', boxShadow: '0 0 8px #00FFFF' }}></div>}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

function AlfaRadarView() {
  const rfTargets = useStore(s => s.rfTargets || [])
  const toggleRfTarget = useStore(s => s.toggleRfTarget)
  const clearRfTargets = useStore(s => s.clearRfTargets)
  
  const [bssids, setBssids] = useState([])

  useEffect(() => {
    const ctrl = new AbortController()
    
    // 复用系统内已封装好的 fetchEventSource
    import('@microsoft/fetch-event-source').then(({ fetchEventSource }) => {
      fetchEventSource(`${API}/wifi/stream`, {
        method: 'GET',
        signal: ctrl.signal,
        onmessage(ev) {
          const data = JSON.parse(ev.data)
          if (data.targets) {
              // 过滤掉无效值，并按信号强度(PWR)动态排序
              const valid = data.targets.filter(t => parseInt(t.pwr) > -95 && parseInt(t.pwr) < 0)
              valid.sort((a, b) => parseInt(b.pwr) - parseInt(a.pwr))
              setBssids(valid)
          }
        }
      })
    })
    
    return () => ctrl.abort()
  }, [])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', background: '#050505', padding: '16px' }}>
      <div style={{ paddingBottom: '16px', borderBottom: '1px solid #222', marginBottom: '16px' }}>
        <div style={{ color: '#BF5AF2', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={16} /> ALFA 无线射频雷达 (Monitor Mode)
        </div>
        <div style={{ fontSize: '11px', color: '#666', marginTop: '6px' }}>
          网卡: <span style={{ color: '#D0D0D0' }}>wlan1</span> | 型号: <span style={{ color: '#D0D0D0' }}>AWUS036ACM</span> | 状态: <span style={{ color: '#30D158', fontWeight: 'bold' }}>SNIFFING</span>
        </div>
      </div>

      {rfTargets.length > 0 && (
        <div style={{ background: 'rgba(191, 90, 242, 0.1)', borderBottom: '1px solid #BF5AF2', padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderRadius: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#BF5AF2', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={14} /> 锁定的物理源 MAC ({rfTargets.length})
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {rfTargets.map(mac => (
                <span key={mac} style={{ background: 'rgba(191,90,242,0.2)', color: '#BF5AF2', border: '1px solid #BF5AF2', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => toggleRfTarget(mac)}>
                  {mac} <X size={10} color="#BF5AF2" />
                </span>
              ))}
            </div>
          </div>
          <button style={{ background: '#222', color: '#BF5AF2', border: '1px solid #BF5AF2', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={clearRfTargets}>
            <X size={12} /> 清空队列
          </button>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: '40px', textAlign: 'center' }}><Target size={14} color="#666" /></th>
            <th>SSID (Network Name)</th>
            <th>BSSID (MAC Address)</th>
            <th>PWR (dBm)</th>
            <th>CHANNEL</th>
            <th>CRYPTO</th>
          </tr>
        </thead>
        <tbody>
          {bssids.map(t => {
            const isSelected = rfTargets.includes(t.bssid)
            return (
              <tr key={t.bssid} style={{ cursor: 'pointer', background: isSelected ? 'rgba(191,90,242,0.05)' : 'transparent', borderLeft: isSelected ? '2px solid #BF5AF2' : 'none' }}>
                <td style={{ textAlign: 'center' }} onClick={e => { e.stopPropagation(); toggleRfTarget(t.bssid); }}>
                  <div style={{ width: '14px', height: '14px', border: `1px solid ${isSelected ? '#BF5AF2' : '#444'}`, background: isSelected ? '#BF5AF2' : 'transparent', borderRadius: '3px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isSelected && <X size={10} color="#000" style={{ fontWeight: 'bold' }} />}
                  </div>
                </td>
                <td style={{ color: t.enc === 'OPEN' ? '#FF3B30' : '#00FFFF' }}>{t.ssid}</td>
                <td style={{ fontFamily: 'monospace', color: '#D0D0D0' }}>{t.bssid}</td>
                <td style={{ color: parseInt(t.pwr) > -60 ? '#30D158' : '#FF9900' }}>{t.pwr}</td>
                <td style={{ color: '#FF9900' }}>{t.ch}</td>
                <td style={{ color: '#666' }}>{t.enc}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      
      <div style={{ marginTop: '24px', borderTop: '1px solid #222', paddingTop: '16px' }}>
        <div style={{ color: '#FF9900', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>[ 战利品缓存栈 (Captured Material) ]</div>
        <div style={{ background: '#111', padding: '12px', borderRadius: '6px', border: '1px solid #333', fontSize: '11px', color: '#999', lineHeight: '1.6' }}>
          没有任何 EAPOL 或 WPA2 Handshake 被捕获。<br/>
          请锁定目标热点后，呼叫副驾驶发射 <strong>Deauthentication (干扰/反认证)</strong> 阵列波，强制下属终端断链重连以剥离加密握手包片段。
        </div>
      </div>
    </div>
  )
}

function WorkArea() {
  const stats = useStore(s => s.stats)
  const assets = useStore(s => s.assets)
  const selectedIp = useStore(s => s.selectedIp)
  const view = useStore(s => s.view)
  const onExecCommand = cmd => useStore.getState().setExternalCommand({ id: Date.now(), cmd })

  const [tab, setTab] = useState(0)

  // Global Multi-Select Hub
  const globalTargets = useStore(s => s.globalTargets)
  const toggleGlobalTarget = useStore(s => s.toggleGlobalTarget)
  const clearGlobalTargets = useStore(s => s.clearGlobalTargets)

  // reset tab when view changes
  useEffect(() => { setTab(0) }, [view])

  const asset = assets.find(a => a.ip === selectedIp)
  const tabs = VIEW_TABS[view] || []

  return (
    <div className="activity-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* 🎯 [NEW] HUD Pipeline is exclusively rendered in HQ mode */}
      {view === 'HQ' && <CampaignPipeline stats={stats} />}
      
      {/* 🎯 [NEW] Persistent Target Pod */}
      {globalTargets.length > 0 && (
        <div style={{ background: 'rgba(255, 59, 48, 0.1)', borderBottom: '1px solid #FF3B30', padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#FF3B30', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={14} /> 高危锁定节点 ({globalTargets.length})
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {globalTargets.map(ip => (
                <span key={ip} style={{ background: 'rgba(255,59,48,0.2)', color: '#FF3B30', border: '1px solid #FF3B30', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => toggleGlobalTarget(ip)}>
                  {ip} <X size={10} color="#FF3B30" />
                </span>
              ))}
            </div>
          </div>
          <button style={{ background: '#222', color: '#FF3B30', border: '1px solid #FF3B30', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={clearGlobalTargets}>
            <X size={12} /> 清空兵装槽
          </button>
        </div>
      )}

      {view !== 'HQ' && (
        <div className="terminal-tab-bar">
          {view === 'DP' && ['靶标资产', '战术武库', '云端战车', '远控节点'].map((t, i) => (
            <button key={t} className={`terminal-tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
          ))}
          {view === 'VS' && ['战区概览', '作战图谱'].map((t, i) => (
            <button key={t} className={`terminal-tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
      )}
      
      <div className="tab-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {view === 'HQ' && <ReconOverview stats={stats} assets={assets} asset={asset} onExecCommand={onExecCommand} />}

        {view === 'DP' && tab === 0 && <AssetTable assets={assets} onExecCommand={onExecCommand} selectedIp={selectedIp} />}
        {view === 'DP' && tab === 1 && <ArmoryViewTab assets={assets} selectedIp={selectedIp} onExecCommand={onExecCommand} />}
        {view === 'DP' && tab === 2 && <DockerPanel />}
        {view === 'DP' && tab === 3 && <SliverViewTab onExecCommand={onExecCommand} />}

        {view === 'VS' && tab === 0 && <TheaterKanban assets={assets} theater={window.__claw_current_theater || 'default'} />}
        {view === 'VS' && tab === 1 && <AttackMatrixView />}

      </div>
    </div>
  )
}

function ReconOverview({ stats, assets, asset, onExecCommand }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
      {/* 统一战术标头 (Standard Header Convention) */}
      <div style={{ padding: '16px', borderBottom: '1px solid #222', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ color: '#00FFFF', fontSize: '14px', fontWeight: 'bold' }}>全域侦察总览</span>
          <span style={{ color: '#666', fontSize: '10px', marginLeft: '8px' }}>当前视图: 宏观量化指标与威胁热点分布</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button style={{ background: 'rgba(0,255,255,0.1)', color: '#00FFFF', border: '1px solid #00FFFF', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }} onClick={() => onExecCommand("调用探测模块扫描当前战区全网段的存活资产 (Nmap 智能嗅探)")} onMouseOver={e => e.currentTarget.style.background='rgba(0,255,255,0.2)'} onMouseOut={e => e.currentTarget.style.background='rgba(0,255,255,0.1)'}>
            <Zap size={14} /> 全域资产智能探测
          </button>
        </div>
      </div>

      {assets.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', background: 'rgba(0,255,255,0.02)', border: '1px dashed rgba(0,255,255,0.2)', marginBottom: '24px', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', color: '#00FFFF', marginBottom: '12px', fontWeight: 'bold' }}>战区网格未初始化 (Empty Horizon)</div>
          <div style={{ color: '#666', fontSize: '13px', marginBottom: '24px' }}>当前环境资产台账为空。请点击右上角按钮启动全局声呐扫网，建立基础拓扑与攻击平面。</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', padding: '0 16px' }}>

        {/* 左侧: 量化指标 */}
        <div style={{ flex: '1 1 400px' }}>
          <div className="p-head" style={{ marginBottom: '16px' }}>[ 量化指标矩阵 ]</div>
          <div className="indicator-grid">
            <div className="ind-card" style={{ borderTop: '2px solid #00FFFF' }}>
              <div className="ind-card-title" style={{ color: '#00FFFF' }}>扫描面统计</div>
              <div className="m-row"><span className="lbl">IP总数:</span><span className="val">{stats?.hosts || assets.length}</span></div>
              <div className="m-row"><span className="lbl">端口总数:</span><span className="val">{stats?.ports || assets.reduce((s, a) => s + a.port_count, 0)}</span></div>
              <div className="m-row"><span className="lbl">扫描引擎:</span><span className="val c-up">NMAP / HTTPX</span></div>
            </div>
            <div className="ind-card">
              <div className="ind-card-title">脆弱性风险暴露</div>
              <div className="m-row"><span className="lbl">SMB(445):</span><span className="val" style={{ color: '#FF3B30' }}>{assets.filter(a => a.ports.some(p => p.port === 445)).length} 靶标</span></div>
              <div className="m-row"><span className="lbl">RDP(3389):</span><span className="val" style={{ color: '#FF3B30' }}>{assets.filter(a => a.ports.some(p => p.port === 3389)).length} 靶标</span></div>
              <div className="m-row"><span className="lbl">FTP(21):</span><span className="val" style={{ color: '#FF9900' }}>{assets.filter(a => a.ports.some(p => p.port === 21)).length} 靶标</span></div>
            </div>
            <div className="ind-card">
              <div className="ind-card-title">公防网域面</div>
              <div className="m-row"><span className="lbl">HTTP:</span><span className="val">{assets.filter(a => a.ports.some(p => p.port === 80)).length} 站点</span></div>
              <div className="m-row"><span className="lbl">HTTPS:</span><span className="val">{assets.filter(a => a.ports.some(p => p.port === 443)).length} 站点</span></div>
              <div className="m-row"><span className="lbl">PROXY:</span><span className="val">{assets.filter(a => a.ports.some(p => [8080, 8443].includes(p.port))).length} 代理</span></div>
            </div>
            <div className="ind-card" style={{ borderTop: '2px solid #FF9900' }}>
              <div className="ind-card-title" style={{ color: '#FF9900' }}>作战智能体</div>
              <div className="m-row"><span className="lbl">安全限级:</span><span className="val">M2 级指令权</span></div>
              <div className="m-row"><span className="lbl">HITL拦截:</span><span className="val c-up">强鉴权启动</span></div>
              <div className="m-row"><span className="lbl">算力核心:</span><span className="val">Gemini 3 阵列</span></div>
            </div>
          </div>

          {/* 威胁热点 TOP5 */}
          <div className="p-head" style={{ marginTop: '24px', marginBottom: '12px' }}>[ 威胁热点 TOP5 (风险排序) ]</div>
          <div style={{ background: '#050505', border: '1px solid #222', padding: '12px' }}>
            {(() => {
              const ranked = [...assets].sort((a, b) => {
                const scoreA = a.ports.filter(p => [445, 3389, 21, 22, 23, 80, 443, 8080, 3306, 1433, 5432, 6379, 27017].includes(p.port)).length
                const scoreB = b.ports.filter(p => [445, 3389, 21, 22, 23, 80, 443, 8080, 3306, 1433, 5432, 6379, 27017].includes(p.port)).length
                return scoreB - scoreA
              }).slice(0, 5)
              if (ranked.length === 0) return <div style={{ color: '#666', fontSize: '11px' }}>暂无资产数据</div>
              return ranked.map((a, i) => (
                <div key={a.ip} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px dashed #222', fontSize: '12px' }}>
                  <span style={{ color: i < 2 ? '#FF3B30' : '#FF9900', fontWeight: 'bold', width: '20px' }}>{i + 1}.</span>
                  <span style={{ color: '#00FFFF', flex: '1' }}>{a.ip}</span>
                  <span style={{ color: '#666', fontSize: '10px' }}>{a.ports.map(p => p.port).join(', ')}</span>
                  <span style={{ color: i < 2 ? '#FF3B30' : '#FF9900', fontSize: '10px', fontWeight: 'bold' }}>{i < 2 ? 'CRITICAL' : 'HIGH'}</span>
                </div>
              ))
            })()}
          </div>

          {/* OS 分布概览 */}
          <div className="p-head" style={{ marginTop: '24px', marginBottom: '12px' }}>[ OS 分布概览 ]</div>
          <div style={{ background: '#050505', border: '1px solid #222', padding: '12px' }}>
            {(() => {
              const osCounts = {}
              assets.forEach(a => { const os = a.os || 'Unknown'; osCounts[os] = (osCounts[os] || 0) + 1 })
              const entries = Object.entries(osCounts).sort((a, b) => b[1] - a[1])
              if (entries.length === 0) return <div style={{ color: '#666', fontSize: '11px' }}>暂无 OS 识别数据</div>
              return entries.map(([os, count]) => (
                <div key={os} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                    <span style={{ color: '#D0D0D0' }}>{os}</span>
                    <span style={{ color: '#FF9900', fontWeight: 'bold' }}>{count} 台 ({Math.round(count / assets.length * 100)}%)</span>
                  </div>
                  <div style={{ width: '100%', background: '#222', height: '6px' }}>
                    <div style={{ width: `${count / assets.length * 100}%`, background: os.toLowerCase().includes('windows') ? '#00FFFF' : os.toLowerCase().includes('linux') ? '#30D158' : '#FF9900', height: '100%' }}></div>
                  </div>
                </div>
              ))
            })()}
          </div>

          {asset && (
            <>
              <div className="p-head" style={{ marginTop: '24px', marginBottom: '16px' }}>[ 锁定目标细节: {asset.ip} ]</div>
              <PortMatrix asset={asset} />
            </>
          )}
        </div>

        {/* 右侧: 实战流数据馈送 */}
        <div style={{ flex: '0 1 280px', background: '#0A0A0A', border: '1px solid #222', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', height: 'auto', maxWidth: '320px', minWidth: '220px' }}>
          <div style={{ fontSize: '14px', color: '#FF9900', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#FF3B30', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
            实时动态日志
          </div>
          <div style={{ flex: 1, overflowY: 'auto', color: '#D0D0D0', fontSize: '12px', fontFamily: 'Consolas, monospace', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(() => {
              const now = new Date()
              const fmt = (minAgo) => {
                const d = new Date(now.getTime() - minAgo * 60000)
                return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
              }
              return <>
                <div style={{ borderLeft: '2px solid #30D158', paddingLeft: '12px' }}>
                  <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>{fmt(10)}</div>
                  <div style={{ color: '#30D158', fontWeight: 'bold' }}>[侦察] 新资产发现</div>
                  <div>探测到 {assets.length} 个存活主机节点</div>
                </div>
                <div style={{ borderLeft: '2px solid #00FFFF', paddingLeft: '12px' }}>
                  <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>{fmt(8)}</div>
                  <div style={{ color: '#00FFFF', fontWeight: 'bold' }}>[扫描] 网络端口拓扑更新</div>
                  <div>扫描完毕，共发现 {assets.reduce((s, a) => s + a.port_count, 0)} 个开放端口</div>
                </div>
                <div style={{ borderLeft: '2px solid #FF3B30', paddingLeft: '12px' }}>
                  <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>{fmt(5)}</div>
                  <div style={{ color: '#FF3B30', fontWeight: 'bold' }}>[告警] 高危服务暴露</div>
                  <div>发现 {assets.filter(a => a.ports.some(p => p.port === 445 || p.port === 3389)).length} 台主机存在 SMB/RDP 高危暴露</div>
                </div>
              </>
            })()}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px dashed #333', color: '#666', fontSize: '11px' }}>
              [系统提示] 点击 "OP 作战" 面板执行自动漏洞审计
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}



function AssetTable({ assets, onExecCommand, onSelectAsset, selectedIp }) {
  const [osintStatus, setOsintStatus] = useState(null)
  const [expandedIp, setExpandedIp] = useState(null)

  // Global Multi-Select Hub
  const globalTargets = useStore(s => s.globalTargets)
  const toggleGlobalTarget = useStore(s => s.toggleGlobalTarget)

  // Global Sync for Left-Sidebar Filtering
  const search = useStore(s => s.searchFilter)
  const riskFilter = useStore(s => s.riskFilter)
  const portFilter = useStore(s => s.portFilter)
  const filters = { search, riskFilter, portFilter }

  // 左侧 sidebar 选择联动右侧展开 + 自动滚动
  useEffect(() => {
    if (selectedIp) {
      setExpandedIp(selectedIp)
      setTimeout(() => {
        const el = document.getElementById(`asset-row-${selectedIp}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }
  }, [selectedIp])

  // Apply filters
  const filtered = assets.filter(a => {
    if (filters.search && !a.ip.includes(filters.search)) return false
    if (filters.riskFilter === 'red' && !a.ports.some(p => [445, 3389, 21].includes(p.port))) return false
    if (filters.riskFilter === 'low' && a.ports.some(p => [445, 3389, 21].includes(p.port))) return false
    if (filters.portFilter && !a.ports.some(p => p.port === filters.portFilter)) return false
    return true
  })

  const handleDeepResearch = () => {
    setOsintStatus('指令已下发...')
    fetch(`${API}/osint/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: "GLOBAL OSINT SWEEP" })
    }).then(r => r.json()).then(d => {
      setOsintStatus(d.message)
      setTimeout(() => setOsintStatus(null), 3000)
    }).catch(console.error)
  }

  const expanded = expandedIp ? assets.find(a => a.ip === expandedIp) : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ color: '#00FFFF', fontSize: '14px', fontWeight: 'bold' }}>资产台账</span>
          <span style={{ color: '#666', fontSize: '10px', marginLeft: '8px' }}>显示 {filtered.length}/{assets.length} 台 · 点击行展开详情</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {osintStatus && <span style={{ color: '#FF9900', fontSize: '12px' }}>{osintStatus}</span>}
          <button style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: '1px solid #FF3B30', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={handleDeepResearch}>
            OSINT 深网侦察
          </button>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: '40px', textAlign: 'center' }}>
              <Target size={14} color="#666" />
            </th>
            <th>IP 地址</th>
            <th>指纹/OS</th>
            <th>端口数</th>
            <th>服务清单</th>
            <th>杀伤链评级</th>
            <th>快捷操作</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(a => {
            const isSelected = globalTargets.includes(a.ip)
            return (
            <React.Fragment key={a.ip}>
              <tr id={`asset-row-${a.ip}`} style={{ cursor: 'pointer', background: expandedIp === a.ip ? 'rgba(0,255,255,0.05)' : (isSelected ? 'rgba(255,59,48,0.05)' : 'transparent'), borderLeft: isSelected ? '2px solid #FF3B30' : 'none' }} onClick={() => { setExpandedIp(expandedIp === a.ip ? null : a.ip); if (onSelectAsset) onSelectAsset(a.ip) }}>
                <td style={{ textAlign: 'center' }} onClick={e => { e.stopPropagation(); toggleGlobalTarget(a.ip); }}>
                  <div style={{ width: '14px', height: '14px', border: `1px solid ${isSelected ? '#FF3B30' : '#444'}`, background: isSelected ? '#FF3B30' : 'transparent', borderRadius: '3px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isSelected && <X size={10} color="#000" style={{ fontWeight: 'bold' }} />}
                  </div>
                </td>
                <td style={{ color: '#00FFFF' }}>{expandedIp === a.ip ? '[-] ' : '[+] '}{a.ip}</td>
                <td style={{ color: '#666' }}>{a.os || '—'}</td>
                <td>{a.port_count}</td>
                <td style={{ fontSize: '10px', color: '#999' }}>{a.ports.map(p => p.port + '/' + p.service).join(', ')}</td>
                <td style={{ color: a.ports.some(p => [445, 3389].includes(p.port)) ? '#FF3B30' : '#30D158' }}>
                  {a.ports.some(p => [445, 3389].includes(p.port)) ? '极危 (RED)' : '普通 (LOW)'}
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <button style={{ background: '#222', color: '#FF9900', border: '1px solid #333', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', transition: 'background 0.2s', whiteSpace: 'nowrap' }} onClick={() => onExecCommand(`请对目标资产 ${a.ip} 进行深度渗透和漏洞探测。如果存在高危端口，请直接尝试漏洞利用。`)} onMouseOver={e => e.currentTarget.style.background = '#333'} onMouseOut={e => e.currentTarget.style.background = '#222'}>
                    AI 渗透
                  </button>
                </td>
              </tr>
              {expandedIp === a.ip && (
                <tr key={a.ip + '_detail'}>
                  <td colSpan="7" style={{ padding: 0 }}>
                    <div style={{ background: 'rgba(0,255,255,0.03)', padding: '12px 16px', borderTop: '1px dashed #333', borderBottom: '1px dashed #333' }}>
                      <div style={{ display: 'flex', gap: '24px', marginBottom: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '11px', color: '#FF9900', marginBottom: '8px', fontWeight: 'bold' }}>-- 端口详情 --</div>
                          <table style={{ width: '100%', fontSize: '11px' }}>
                            <thead><tr style={{ color: '#666' }}><th style={{ textAlign: 'left', padding: '2px 8px' }}>端口</th><th style={{ textAlign: 'left', padding: '2px 8px' }}>服务</th><th style={{ textAlign: 'left', padding: '2px 8px' }}>产品</th><th style={{ textAlign: 'left', padding: '2px 8px' }}>版本</th></tr></thead>
                            <tbody>
                              {a.ports.map(p => (
                                <tr key={p.port}>
                                  <td style={{ color: [445, 3389, 21].includes(p.port) ? '#FF3B30' : '#00FFFF', padding: '2px 8px' }}>{p.port}</td>
                                  <td style={{ color: '#D0D0D0', padding: '2px 8px' }}>{p.service}</td>
                                  <td style={{ color: '#999', padding: '2px 8px' }}>{p.product || '未知'}</td>
                                  <td style={{ color: '#999', padding: '2px 8px' }}>{p.version || '未知'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ width: '260px', flexShrink: 0 }}>
                          <div style={{ fontSize: '11px', color: '#FF9900', marginBottom: '8px', fontWeight: 'bold' }}>-- 武器选择 --</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px' }}>
                            {/* Smart suggestions based on ports */}
                            {a.ports.some(p => [80, 443, 8080, 8443].includes(p.port)) && <>
                              <button style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', textAlign: 'left', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onExecCommand(`使用 Nuclei 对 ${a.ip} 进行 Web 漏洞扫描`)} onMouseOver={e => e.currentTarget.style.background = '#333'} onMouseOut={e => e.currentTarget.style.background = '#222'}><Search size={11} /> Nuclei 漏洞扫描</button>
                              <button style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', textAlign: 'left', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onExecCommand(`使用 Nikto 对 ${a.ip} 进行 Web 服务安全扫描`)} onMouseOver={e => e.currentTarget.style.background = '#333'} onMouseOut={e => e.currentTarget.style.background = '#222'}><Globe size={11} /> Nikto Web 扫描</button>
                              <button style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', textAlign: 'left', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onExecCommand(`使用 SQLMap 对 ${a.ip} 的 Web 服务进行 SQL 注入检测`)} onMouseOver={e => e.currentTarget.style.background = '#333'} onMouseOut={e => e.currentTarget.style.background = '#222'}><Bug size={11} /> SQLMap 注入检测</button>
                            </>}
                            {a.ports.some(p => p.port === 445) && <>
                              <button style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', textAlign: 'left', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onExecCommand(`使用 Impacket 对 ${a.ip} 进行 SMB 枚举和横向移动探测`)} onMouseOver={e => e.currentTarget.style.background = '#333'} onMouseOut={e => e.currentTarget.style.background = '#222'}><Lock size={11} /> Impacket SMB</button>
                              <button style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', textAlign: 'left', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onExecCommand(`使用 enum4linux 对 ${a.ip} 进行 Windows/Samba 信息枚举`)} onMouseOver={e => e.currentTarget.style.background = '#333'} onMouseOut={e => e.currentTarget.style.background = '#222'}><ClipboardList size={11} /> enum4linux 枚举</button>
                            </>}
                            {a.ports.some(p => p.port === 22) &&
                              <button style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', textAlign: 'left', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onExecCommand(`使用 Hydra 对 ${a.ip}:22 进行 SSH 弱口令暴破`)} onMouseOver={e => e.currentTarget.style.background = '#333'} onMouseOut={e => e.currentTarget.style.background = '#222'}><KeyRound size={11} /> Hydra SSH 暴破</button>
                            }
                            {a.ports.some(p => p.port === 3389) &&
                              <button style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', textAlign: 'left', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onExecCommand(`检查 ${a.ip} 的 RDP 是否存在 BlueKeep (CVE-2019-0708) 漏洞`)} onMouseOver={e => e.currentTarget.style.background = '#333'} onMouseOut={e => e.currentTarget.style.background = '#222'}><Monitor size={11} /> RDP BlueKeep</button>
                            }
                            {/* Universal tools */}
                            <button style={{ background: '#222', color: '#FF3B30', border: '1px solid #333', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', textAlign: 'left', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onExecCommand(`使用 Metasploit (msfconsole) 对 ${a.ip} 进行全面漏洞利用扫描`)} onMouseOver={e => e.currentTarget.style.background = '#333'} onMouseOut={e => e.currentTarget.style.background = '#222'}><Skull size={11} /> Metasploit 扫描</button>
                            <button style={{ background: '#222', color: '#FF9900', border: '1px solid #333', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', textAlign: 'left', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onExecCommand(`对 ${a.ip} 进行全面的深度安全分析，综合所有可用工具`)} onMouseOver={e => e.currentTarget.style.background = '#333'} onMouseOut={e => e.currentTarget.style.background = '#222'}><Crosshair size={11} /> AI 全面分析</button>
                          </div>
                          {/* More weapons dropdown */}
                          <details style={{ fontSize: '10px' }}>
                            <summary style={{ color: '#666', cursor: 'pointer', padding: '4px 0' }}>更多武器 ▾</summary>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                              {[['Nmap 深扫', 'nmap -sV -sC -O'], ['Gobuster 目录', 'gobuster dir'], ['FFuf Fuzzer', 'ffuf'], ['Hashcat 破解', 'hashcat'], ['Responder 投毒', 'responder'], ['Binwalk 固件', 'binwalk'], ['Socat 隧道', 'socat']].map(([label, cmd]) => (
                                <button key={label} style={{ background: '#1a1a1a', color: '#999', border: '1px solid #222', padding: '4px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '9px', textAlign: 'left', transition: 'all 0.2s' }} onClick={() => onExecCommand(`使用 ${label} (${cmd}) 对 ${a.ip} 进行操作`)} onMouseOver={e => { e.currentTarget.style.color = '#00FFFF'; e.currentTarget.style.borderColor = '#333' }} onMouseOut={e => { e.currentTarget.style.color = '#999'; e.currentTarget.style.borderColor = '#222' }}>{label}</button>
                              ))}
                            </div>
                          </details>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          )})}
        </tbody>
      </table>
    </div>
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
            <td style={{ color: '#00FFFF' }}>{p.port}</td>
            <td style={{ color: [445, 3389, 21].includes(p.port) ? '#FF3B30' : '#30D158' }}>{p.service}</td>
            <td style={{ color: '#999' }}>{p.product || '未知产品'}</td>
            <td style={{ color: '#666' }}>{p.version || '未知版本'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ========== TERMINAL PANEL ==========
function XTermConsole() {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    let ws = null;
    let ro = null;
    const fitAddon = new FitAddon()
    const terminal = new Terminal({
      theme: { background: '#000', foreground: '#00FFFF', cursor: '#FF9900' },
      fontFamily: 'Consolas, monospace',
      fontSize: 14
    })
    terminal.loadAddon(fitAddon)

    const initId = setTimeout(() => {
      try {
        terminal.open(containerRef.current)
        fitAddon.fit()
      } catch (e) {}

      ws = new WebSocket(`ws://${window.location.hostname}:8000/api/v1/terminal`)
      ws.onopen = () => {
        terminal.writeln('\x1b[33m✧ Eavesdropping Shell / PTY Bridge Connected \x1b[0m\r\n')
        ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
      }

      ro = new ResizeObserver(() => {
        try {
          fitAddon.fit()
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
          }
        } catch (e) { }
      })
      ro.observe(containerRef.current)

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'output') terminal.write(msg.data)
      }

      terminal.onData(data => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }))
        }
      })
    }, 100)

    return () => {
      clearTimeout(initId)
      if (ro) ro.disconnect()
      if (ws) ws.close()
      terminal.dispose()
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />
}

function ArmoryViewTab({ assets, selectedIp, onExecCommand }) {
  // Global Multi-Select Hub
  const globalTargets = useStore(s => s.globalTargets)

  const armoryData = [
    {
      cat: '侦察 (Recon)', color: '#00FFFF', mods: [
        { label: '存活探测', desc: 'fping/ping 目标存活心跳扫描', cmd: 'make fast' },
        { label: 'Nmap 深扫', desc: '全端口 TCP/UDP 指纹探测', cmd: 'nmap -sV -O' },
        { label: '服务识别', desc: '低频协议报文特征提取', cmd: 'make probe' },
        { label: '结果解析', desc: 'Nmap XML 解析写入数据库', cmd: 'make parse' },
        { label: '幽灵侦察', desc: '被动侦察降低 IDS 触发', cmd: 'make ghost_recon' },
        { label: 'Gobuster', desc: '目录/DNS/VHost 高速枚举', cmd: 'gobuster dir' },
        { label: 'FFuf', desc: 'Web Fuzzer 路径与参数爆破', cmd: 'ffuf' },
        { label: 'enum4linux', desc: 'Windows/Samba 信息枚举', cmd: 'enum4linux' },
      ]
    },
    {
      cat: '漏洞利用 (Exploit)', color: '#FF3B30', mods: [
        { label: 'Metasploit', desc: 'MSF 6.4 世界级渗透框架', cmd: 'msfconsole' },
        { label: 'Nuclei', desc: '模板驱动漏洞批量扫描', cmd: 'nuclei' },
        { label: 'Nikto', desc: 'Web 服务器安全扫描器', cmd: 'nikto' },
        { label: 'SQLMap', desc: 'SQL 注入自动化检测利用', cmd: 'sqlmap' },
        { label: 'Web 审计', desc: 'XSS/RCE 专项漏洞审计', cmd: 'make web' },
        { label: '定制 Exploit', desc: '目标定制化漏洞利用脚本', cmd: 'make exploit' },
        { label: '代理穿透', desc: '认证绕过 Payload 生成器', cmd: 'make proxy-unlock' },
      ]
    },
    {
      cat: '密码破解 (Cracking)', color: '#FF9900', mods: [
        { label: 'Hashcat', desc: 'GPU 加速哈希破解引擎', cmd: 'hashcat' },
        { label: 'John', desc: 'John the Ripper 密码破解', cmd: 'john' },
        { label: 'Hydra', desc: '在线多协议暴力破解', cmd: 'hydra' },
        { label: 'Responder', desc: 'LLMNR/NBT-NS 投毒抓哈希', cmd: 'responder' },
        { label: 'Crunch', desc: '自定义字典生成器', cmd: 'crunch' },
        { label: 'Wordlists', desc: 'RockYou + SecLists 字典库', cmd: 'ls /usr/share/wordlists/' },
      ]
    },
    {
      cat: '横向移动 (Pivot)', color: '#FF3B30', mods: [
        { label: 'Impacket', desc: 'PsExec/SMBExec 获取 Shell', cmd: 'impacket-psexec' },
        { label: '凭据搜刮', desc: 'SAM/SYSTEM/LSA 注册表导出', cmd: 'make loot' },
        { label: 'Kerberoast', desc: 'SPN TGS 提取与离线破解', cmd: 'make kerberoast' },
        { label: 'SMBClient', desc: 'SMB 共享枚举与文件操作', cmd: 'smbclient' },
        { label: '幽灵点火', desc: '持久化植入与隐蔽通道', cmd: 'make ghost_ignition' },
        { label: 'Socat/Netcat', desc: '隧道转发与反弹 Shell', cmd: 'socat/nc' },
      ]
    },
    {
      cat: '无线与固件 (Wireless/IoT)', color: '#30D158', mods: [
        { label: 'Aircrack-ng', desc: 'WiFi WEP/WPA 破解套件', cmd: 'aircrack-ng' },
        { label: 'Wifite', desc: '无线审计自动化工具', cmd: 'wifite' },
        { label: 'Binwalk', desc: '固件逆向分析与提取', cmd: 'binwalk' },
      ]
    },
    {
      cat: 'AI 参谋部 + 报告', color: '#FF9900', mods: [
        { label: 'AI 攻击研判', desc: '大模型靶标分析与链路推演', cmd: 'make ai-analyze' },
        { label: 'AI 血猎犬', desc: 'AD 域图谱分析与路径推演', cmd: 'make bloodhound' },
        { label: 'Lynx 战术问答', desc: '高权限红队 AI 评估引擎', cmd: 'make ask-lynx' },
        { label: '渗透报告', desc: '基于审计日志自动生成报告', cmd: 'make report' },
        { label: '差异对比', desc: '多次扫描差异分析', cmd: 'make diff' },
        { label: 'Webhook', desc: '关键事件推送外部平台', cmd: 'make webhook' },
      ]
    },
  ]

  return (
    <div style={{ flex: 1, padding: '16px', overflowY: 'auto', minHeight: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '16px', color: '#00FFFF', fontWeight: 'bold' }}>全域武器库阵列</span>
        <span style={{ fontSize: '10px', color: '#666' }}>
          {armoryData.reduce((s, g) => s + g.mods.length, 0)} 模块就绪 · 点击卡片调用 AI 执行 · 锁定管线: <span style={{ color: globalTargets.length > 0 ? '#FF3B30' : '#00FFFF' }}>{globalTargets.length > 0 ? `${globalTargets.length} 靶向并发` : (selectedIp || '全局泛扫')}</span>
        </span>
      </div>
      {armoryData.map(group => (
        <div key={group.cat} style={{ marginBottom: '20px' }}>
          <div style={{ color: group.color, fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', padding: '4px 10px', background: `${group.color}15`, borderRadius: '4px', display: 'inline-block' }}>{group.cat}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {group.mods.map(m => (
              <div key={m.label} style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '10px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }} onClick={() => {
                alert(`⚠️ 指控官约束:【${m.label}】模块已在战备舱注册。\n\n按照 V9.1 Hacker Copilot 规程，如果需要发起实际渗透打击，请返回 [指挥座舱]，交给 Lynx 大模型副官为您装配参数。`);
              }} onMouseOver={e => { e.currentTarget.style.borderColor = group.color; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }} onMouseOut={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.background = '#111' }}>
                <div style={{ fontSize: '12px', color: group.color, fontWeight: 'bold', marginBottom: '4px' }}>{m.label}</div>
                <div style={{ fontSize: '10px', color: '#666', lineHeight: '1.4' }}>{m.desc}</div>
                <div style={{ fontSize: '9px', color: '#00FFFF', marginTop: '10px', paddingTop: '6px', borderTop: '1px dashed #333' }}>+ 参数配置详情 (点击查阅)</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SliverViewTab({ onExecCommand }) {
  const [sessions, setSessions] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const fetchSessions = () => {
    setRefreshing(true)
    fetch(`${API}/sliver/sessions`).then(r => r.json()).then(d => setSessions(d.sessions || [])).catch(console.error).finally(() => setRefreshing(false))
  }
  useEffect(() => { fetchSessions() }, [])
  return (
    <div style={{ flex: 1, padding: '24px', overflowY: 'auto', minHeight: 0, boxSizing: 'border-box' }}>
      <div style={{ fontSize: '18px', color: '#FF3B30', fontWeight: 'bold', borderBottom: '1px solid #333', paddingBottom: '12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>C2 控制中心 (Sliver Sessions)</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }} onClick={fetchSessions} disabled={refreshing} onMouseOver={e => e.currentTarget.style.borderColor = '#00FFFF'} onMouseOut={e => e.currentTarget.style.borderColor = '#333'}>
            <RefreshCw size={12} className={refreshing ? 'spin' : ''} /> 刷新
          </button>
          <span style={{ fontSize: '10px', color: '#FF9900', background: 'rgba(255,153,0,0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'normal' }}>MOCK 演示数据</span>
        </div>
      </div>
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '16px' }}>远程控制面板：显示通过 Sliver 信标成功上线的被控主机。当前为模拟数据，V8.3 将对接真实 Sliver Server。</div>
      <table className="data-table">
        <thead>
          <tr><th>ID / Node</th><th>主机名</th><th>OS</th><th>内网 IP</th><th>权限 (User)</th><th>最后心跳</th><th>操作</th></tr>
        </thead>
        <tbody>
          {sessions.map(s => (
            <tr key={s.id}>
              <td style={{ color: '#00FFFF', fontFamily: 'Consolas', fontWeight: 'bold' }}>{s.id}</td>
              <td style={{ color: '#D0D0D0' }}>{s.name}</td>
              <td style={{ color: '#999' }}>{s.os}</td>
              <td style={{ color: '#30D158' }}>{s.ip}</td>
              <td style={{ color: s.user.toLowerCase().includes('system') || s.user === 'root' ? '#FF3B30' : '#FF9900' }}>{s.user}</td>
              <td style={{ color: '#666' }}>{s.last_checkin}</td>
              <td>
                <button style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', transition: 'all 0.2s' }} onClick={() => onExecCommand(`利用 Sliver 远控向 session ${s.id} (${s.ip}) 凭证节点下发信息收集和维持指令`)} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,255,255,0.1)'} onMouseOut={e => e.currentTarget.style.background = '#222'}>
                  <Rocket size={12} style={{ verticalAlign: 'middle' }} /> X-Pivot 横向扩展
                </button>
              </td>
            </tr>
          ))}
          {sessions.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', color: '#666', padding: '16px' }}>暂无上线的主机 / Waiting for beacon...</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

// ========== VISUALIZATION PANELS ==========
function A2UIForgeModal({ isOpen, onClose, targetIp, targetOs, targetPorts }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (isOpen && status === "idle") {
      setStatus("generating");
      fetch(`http://${window.location.hostname}:8000/api/v1/agent/forge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_ip: targetIp,
          target_info: { os: targetOs, ports: targetPorts },
          concept: "企业内部员工身份验证门户"
        })
      })
      .then(res => res.json())
      .then(data => {
        setResult(data);
        setStatus("done");
      })
      .catch(err => {
        setResult(err.message);
        setStatus("error");
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (status === "generating") {
      const t1 = setTimeout(() => setStatus("screenshotting"), 5000);
      const t2 = setTimeout(() => setStatus("reflecting"), 12000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [status]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0a0a0a', border: '1px solid #333', width: '90%', maxWidth: '1000px', height: '80vh', display: 'flex', flexDirection: 'column', borderRadius: 0 }}>
        <div style={{ padding: '12px 16px', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#00FFFF', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Monitor size={16} /> A2UI 视觉自我博弈伪造引擎 (Generative Payload Forge)
          </div>
          <button onClick={onClose} style={{ background: 'transparent', color: '#666', border: 'none', cursor: 'pointer', borderRadius: 0 }}><X size={16}/></button>
        </div>
        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #222', paddingBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#999', fontSize: '11px', marginBottom: '8px' }}>[ 当前行动步骤 ]</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ color: status !== "idle" ? '#00FFFF' : '#444', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   {status === "generating" ? <Loader2 size={12} className="spin" /> : <span>[✓]</span>} 1. Text-to-Code 大模型零日源码撰写
                </div>
                <div style={{ color: ["screenshotting", "reflecting", "done"].includes(status) ? '#30D158' : '#444', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   {status === "screenshotting" ? <Monitor size={12} className="spin" /> : (["reflecting", "done"].includes(status) ? <span>[✓]</span> : <span>[WAIT]</span>)} 2. Playwright 无缝无头截图挂载
                </div>
                <div style={{ color: ["reflecting", "done"].includes(status) ? '#FF9900' : '#444', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   {status === "reflecting" ? <RefreshCw size={12} className="spin" /> : (status === "done" ? <span>[✓]</span> : <span>[WAIT]</span>)} 3. Gemini Multimodal 多模态视觉自纠错
                </div>
              </div>
            </div>
            <div style={{ flex: 1, borderLeft: '1px solid #222', paddingLeft: '16px' }}>
              <div style={{ color: '#999', fontSize: '11px', marginBottom: '8px' }}>[ 针对目标属性 ]</div>
              <div style={{ color: '#ccc', fontSize: '12px' }}>IP: <span style={{ color: '#00FFFF' }}>{targetIp}</span></div>
              <div style={{ color: '#ccc', fontSize: '12px' }}>OS: {targetOs}</div>
              <div style={{ color: '#ccc', fontSize: '12px' }}>暴露端口数: {targetPorts?.length || 0}</div>
            </div>
          </div>

          {status === "done" && result && result.screenshot && (
             <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: '400px' }}>
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                 <div style={{ color: '#FF9900', fontSize: '11px', marginBottom: '8px' }}>[ 视觉自纠错快照 (Playwright Vision) ]</div>
                 <img src={result.screenshot} style={{ width: '100%', objectFit: 'contain', border: '1px solid #333', background: '#000' }} alt="Preview" />
               </div>
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                 <div style={{ color: '#30D158', fontSize: '11px', marginBottom: '8px' }}>[ A2UI 渲染验收靶面 (Interactive HTML) ]</div>
                 <iframe srcDoc={result.html} style={{ width: '100%', border: '1px solid #333', background: '#fff', minHeight: '400px' }} title="Live Render" sandbox="allow-scripts allow-same-origin"/>
               </div>
             </div>
          )}
          {status === "error" && (
             <div style={{ color: '#FF3B30', padding: '20px', border: '1px dashed #FF3B30', background: 'rgba(255,59,48,0.1)' }}>
               Forge Failed: {result}
             </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CognitiveGraphRenderer({ targetIp }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`http://localhost:5000/api/v1/agent/graph?target_ip=${targetIp}`)
      .then(r => r.json())
      .then(d => {
        if (!active) return;
        setNodes(d.nodes || []);
        setLoading(false);
      })
      .catch(e => {
        if (!active) return;
        setError(e.message);
        setLoading(false);
      });
    return () => { active = false; };
  }, [targetIp]);

  if (loading) return <div style={{ color: '#00FFFF', fontSize: '10px' }}>Lynx 正在利用 Pydantic 蒸馏杀伤链图谱... ⚡</div>;
  if (error) return <div style={{ color: '#FF3B30', fontSize: '10px' }}>图谱蒸馏失败: {error}</div>;
  if (!nodes || nodes.length === 0) return <div style={{ color: '#666', fontSize: '10px' }}>未能推演出有效的杀伤链路径。</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {nodes.map((n, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: i === 0 ? '#00FFFF' : (i === nodes.length - 1 ? '#FF3B30' : '#FF9900') }}>
            [{i === 0 ? '起源' : (i === nodes.length - 1 ? '靶标' : '路由')}] {i === 0 ? n.source_ip : n.target_ip}
          </div>
          {i < nodes.length && (
            <div style={{ paddingLeft: '8px', borderLeft: '1px dashed #555', margin: '4px 0', color: '#999', fontSize: '9px' }}>
              ↓ {n.technique} ({n.severity})<br/>
              <span style={{ color: '#555' }}>{n.description}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TheaterKanban({ assets, theater }) {
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [forgeTarget, setForgeTarget] = useState(null)
  const [armoryOpen, setArmoryOpen] = useState(false)
  const [osintOpen, setOsintOpen] = useState(false)

  // Global Multi-Select Hub
  const globalTargets = useStore(s => s.globalTargets)
  const toggleGlobalTarget = useStore(s => s.toggleGlobalTarget)
  const clearGlobalTargets = useStore(s => s.clearGlobalTargets)

  // Kanban Classification Logic
  // Column 1: Recon (Just IP, no extreme vulns or valuable ports)
  // Column 2: Exposed (Has 445, 3389, FTP, proxy etc.)
  // Column 3: Exploited (Has vulns mapping to high severity or specific flags)
  // Column 4: High Value (Domain Controllers, Gateways)
  
  const cols = [[], [], [], []]
  
  const getProximity = (ip) => {
    // Deterministic mock RF proximity based on last digit of IP
    const last = parseInt((ip || '').split('.').pop() || '0', 10)
    if (last % 3 === 0) return { val: '极近 (极强)', color: '#FF3B30' }
    if (last % 3 === 1) return { val: '正常 (中等)', color: '#FF9900' }
    return { val: '远程 (微弱)', color: '#30D158' }
  }

  (assets || []).forEach(a => {
    let hasVuln = a.vulns && a.vulns.length > 0;
    let isExposed = (a.ports || []).some(p => [445, 3389, 21, 23, 1433, 3306].includes(p?.port));
    let isHighValue = (a.os || '').toLowerCase().includes('server') || (a.ports || []).some(p => p?.port === 88 || p?.port === 389); // Kerberos/LDAP
    
    // We arbitrarily place them for demonstration of the kill chain
    if (isHighValue) cols[3].push(a)
    else if (hasVuln) cols[2].push(a)
    else if (isExposed) cols[1].push(a)
    else cols[0].push(a)
  })

  const renderCard = (a) => {
    const prox = getProximity(a.ip)
    const isSelected = selectedAsset?.ip === a.ip
    const isMultiSelected = globalTargets.includes(a.ip)
    return (
      <div key={a.ip || Math.random()} style={{ background: '#050505', border: `1px solid ${isSelected ? '#00FFFF' : (isMultiSelected ? '#FF9900' : '#222')}`, borderRadius: 0, padding: '12px', paddingLeft: '32px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }} onClick={() => setSelectedAsset(isSelected ? null : a)}>
        <div style={{ position: 'absolute', top: '12px', left: '10px' }}>
           <input type="checkbox" checked={isMultiSelected} onChange={(e) => { e.stopPropagation(); toggleGlobalTarget(a.ip); }} onClick={e => e.stopPropagation()} style={{ cursor: 'pointer', accentColor: '#FF9900' }} title="框选资产" />
        </div>
        <div style={{ position: 'absolute', top: '8px', right: '8px', color: prox.color, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }} title={`模拟 RF 信号: ${prox.val}`}>
          <Signal size={12} />
        </div>
        <div style={{ color: isSelected ? '#00FFFF' : '#ccc', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>{a.ip || 'Unknown IP'}</div>
        <div style={{ color: '#666', fontSize: '11px' }}>{a.os || 'Unknown OS'}</div>
        <div style={{ color: '#00FFFF', fontSize: '10px', marginTop: '6px' }}>{(a.ports || []).length} 个端口点亮</div>
        
        {isSelected && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
               <div style={{ color: '#FF9900', fontSize: '11px' }}>[ A2UI 大模型路径推演 (Powered by Pydantic) ]</div>
               <button 
                 onClick={(e) => { e.stopPropagation(); setForgeTarget(a); }}
                 style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', padding: '3px 8px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: 0 }}>
                 <Monitor size={10} /> ▸ 锻造 A2UI 钓鱼靶面
               </button>
            </div>
            <div style={{ background: '#111', padding: '12px', color: '#666', fontSize: '10px', border: '1px solid #222', borderRadius: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <CognitiveGraphRenderer targetIp={a.ip} />
            </div>
            <div style={{ marginTop: '8px', color: '#444', fontSize: '9px', textAlign: 'right' }}>Powered by Gemini 3.1 Pro ✖️ Structured Output</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', background: '#050505', borderRadius: 0, position: 'relative', minHeight: 0 }}>
      
      {globalTargets.length > 0 && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#111', border: '1px solid #FF9900', boxShadow: '0 4px 20px rgba(0,0,0,0.8)', padding: '12px 24px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ color: '#FF9900', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Crosshair size={14} /> 战役火控授权 ({globalTargets.length} 节点就绪)
            <X size={14} color="#666" style={{ cursor: 'pointer', marginLeft: 'auto' }} onClick={clearGlobalTargets} />
          </span>
          
          <button onClick={() => setArmoryOpen(true)} style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: '1px solid #FF3B30', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,59,48,0.2)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,59,48,0.1)'}>
            <Wrench size={14} /> 发射全量渗透矩阵
          </button>

          <button onClick={() => setOsintOpen(true)} style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Skull size={14} /> 执行近源 OSINT 脱水
          </button>
        </div>
      )}

      <div style={{ padding: '16px', borderBottom: '1px solid #222', color: '#00FFFF', fontSize: '14px', fontWeight: 'bold', flexShrink: 0 }}>
        全域杀伤链看板 (Cyber Kill Chain Kanban) —— 战区: {theater}
      </div>
      <div style={{ flex: 1, display: 'flex', gap: '0', overflowX: 'auto', minHeight: 0 }}>
        
        {/* Col 1 */}
        <div style={{ flex: '1 1 250px', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '6px', color: '#999', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
            <Radar size={14} /> 刚嗅探到 <span style={{ background: '#222', padding: '2px 6px', fontSize: '10px', color: '#00FFFF', borderRadius: 0 }}>{cols[0].length}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px', background: '#0a0a0a', minHeight: 0 }}>
            {cols[0].map(renderCard)}
          </div>
        </div>

        {/* Col 2 */}
        <div style={{ flex: '1 1 250px', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '6px', color: '#FF9900', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
            <AlertTriangle size={14} /> 高危暴露面 <span style={{ background: '#222', padding: '2px 6px', fontSize: '10px', color: '#00FFFF', borderRadius: 0 }}>{cols[1].length}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px', background: '#0a0a0a', minHeight: 0 }}>
            {cols[1].map(renderCard)}
          </div>
        </div>

        {/* Col 3 */}
        <div style={{ flex: '1 1 250px', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '6px', color: '#FF3B30', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
            <Skull size={14} /> 已拿下据点 <span style={{ background: '#222', padding: '2px 6px', fontSize: '10px', color: '#00FFFF', borderRadius: 0 }}>{cols[2].length}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px', background: '#0a0a0a', minHeight: 0 }}>
            {cols[2].map(renderCard)}
          </div>
        </div>

        {/* Col 4 */}
        <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '6px', color: '#9D00FF', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
            <Crown size={14} /> 核心高价值 <span style={{ background: '#222', padding: '2px 6px', fontSize: '10px', color: '#00FFFF', borderRadius: 0 }}>{cols[3].length}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px', background: '#0a0a0a', minHeight: 0 }}>
            {cols[3].map(renderCard)}
          </div>
        </div>

        </div>
      </div>
      {forgeTarget && (
        <A2UIForgeModal 
          isOpen={!!forgeTarget} 
          onClose={() => setForgeTarget(null)} 
          targetIp={forgeTarget.ip} 
          targetOs={forgeTarget.os || 'Unknown OS'} 
          targetPorts={forgeTarget.ports || []} 
        />
      )}
      {armoryOpen && (
        <TacticalArmoryModal 
          isOpen={armoryOpen} 
          onClose={() => setArmoryOpen(false)} 
          targets={Array.from(multiSelected)} 
          theater={theater} 
        />
      )}
      {osintOpen && (
        <OsintTerminalModal 
          isOpen={osintOpen} 
          onClose={() => setOsintOpen(false)} 
          targets={Array.from(multiSelected)} 
        />
      )}
    </>
  )
}

function OsintTerminalModal({ isOpen, onClose, targets }) {
  const [log, setLog] = useState([])
  const [dict, setDict] = useState(null)
  
  useEffect(() => {
    if (!isOpen) return
    setLog(['[SYS] 正在向司令部申请派发 OSINT 幽灵特工...'])
    setDict(null)
    
    // 创建中断器，支持长官中途关闭弹窗撤销打击
    const ctrl = new AbortController()

    import('@microsoft/fetch-event-source').then(({ fetchEventSource }) => {
      fetchEventSource(`${API}/agent/osint/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }),
        signal: ctrl.signal,
        onmessage(ev) {
          const data = JSON.parse(ev.data)
          if (data.type === 'log') {
            // 真实流式追加特工日志
            setLog(l => [...l, data.msg])
          } else if (data.type === 'done') {
            // 接收靶向字典
            setLog(l => [...l, '-----------------------------'])
            setDict(data.dictionary)
            ctrl.abort() // 任务达成，主动切断神经元连接
          } else if (data.type === 'error') {
            setLog(l => [...l, `[ERROR] ${data.msg}`])
            ctrl.abort()
          }
        },
        onerror(err) {
          setLog(l => [...l, `[SYS ERROR] 战术链路断裂: ${err.message}`])
          throw err // 阻止底层疯狂重连
        }
      })
    })

    return () => ctrl.abort() // UI 销毁时，切断底层请求
  }, [isOpen, targets])

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ width: '800px', height: '500px', background: '#050505', border: '1px solid #00FFFF', boxShadow: '0 0 30px rgba(0,255,255,0.2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111' }}>
          <div style={{ color: '#00FFFF', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Crosshair size={16} /> 语义凭证靶向锻造 (Semantic Dictionary)
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}><X size={16} /></button>
        </div>
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', fontFamily: 'Consolas, monospace', fontSize: '12px', color: '#30D158' }}>
          {log.map((line, i) => <div key={i} style={{ marginBottom: '6px' }}>{line}</div>)}
          {dict && (
            <div style={{ marginTop: '20px', padding: '16px', border: '1px dashed #00FFFF', background: 'rgba(0,255,255,0.05)' }}>
              <div style={{ color: '#FF9900', marginBottom: '12px', fontWeight: 'bold' }}>// 已生成跨域定制化弱口令 (符合 Pydantic Schema):</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#fff' }}>
                {JSON.stringify(dict, null, 2)}
              </pre>
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                <button onClick={() => navigator.clipboard.writeText(dict.join('\\n'))} style={{ background: '#222', border: '1px solid #00FFFF', color: '#00FFFF', padding: '6px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Copy size={14}/> 复制字典 (Copy to Clipboard)</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TacticalArmoryModal({ isOpen, onClose, targets, theater }) {
  const [activeStage, setActiveStage] = useState(0)
  const [runningJob, setRunningJob] = useState(null)
  
  const sudoPassword = useStore(s => s.sudoPassword)
  const setSudoPassword = useStore(s => s.setSudoPassword)

  const stages = [
    { name: '① 侦察 (Recon)', icon: <Radar size={24} />, steps: [{ id: 'passive', label: '被动嗅探 (tcpdump)', cmd: './catteam.sh 1' }, { id: 'active', label: '主动探活 (nmap -sn)', cmd: './catteam.sh 2' }] },
    { name: '② 扫描 (Scan)', icon: <Search size={24} />, steps: [{ id: 'port', label: '全端口发现 (make probe)', cmd: './catteam.sh 3' }] },
    { name: '③ 审计 (Audit)', icon: <ClipboardList size={24} />, steps: [{ id: 'web', label: 'Web指纹清扫 (make audit)', cmd: './catteam.sh 4' }, { id: 'nuclei', label: 'Nuclei 深度漏洞扫描', cmd: './catteam.sh 5' }] },
    { name: '④ 攻击 (Exploit)', icon: <Swords size={24} />, steps: [{ id: 'poison', label: '投毒陷阱 (Responder)', cmd: './catteam.sh 6' }, { id: 'crack', label: '算力破解 (Hashcat)', cmd: './catteam.sh 7' }, { id: 'lateral', label: '横向移动 (Impacket)', cmd: './catteam.sh 8' }, { id: 'ad', label: 'AD域攻击 (Kerberoast)', cmd: './catteam.sh 10' }] },
    { name: '⑤ 报告 (Report)', icon: <BarChart size={24} />, steps: [{ id: 'report', label: '生成渗透战报', cmd: './catteam.sh 11' }, { id: 'diff', label: '资产变化检测', cmd: './catteam.sh 12' }] }
  ]

  useEffect(() => {
    const handleFinished = () => {
      setRunningJob(null)
      if (window.__claw_refresh_assets) window.__claw_refresh_assets()
    }
    window.addEventListener('CLAW_OP_FINISHED', handleFinished)
    return () => window.removeEventListener('CLAW_OP_FINISHED', handleFinished)
  }, [])

  const executeStep = async (step) => {
    try {
      let pwd = sudoPassword
      if (!pwd) {
        pwd = window.prompt("⚠️ 此战术底层需提权 (Root)\n请解锁授权:")
        if (!pwd) return
        setSudoPassword(pwd)
      }
      const evt = new CustomEvent('CLAW_SWITCH_CONSOLE_TAB', { detail: 'output' })
      window.dispatchEvent(evt)

      const res = await fetch(`${API}/ops/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: step.cmd, theater, sudo_pass: pwd, target_ips: targets }) // Passing specifically selected targets
      })
      const data = await res.json()
      if (data.job_id) {
        setRunningJob(data.job_id)
        setTimeout(() => {
          const logEvt = new CustomEvent('CLAW_START_SSE_LOG', { detail: { job_id: data.job_id, theater } })
          window.dispatchEvent(logEvt)
        }, 300)
      }
      onClose() // Auto-close modal to watch the logs
    } catch (err) {
      console.error(err)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '900px', background: '#050505', border: '1px solid #333', borderRadius: 0, padding: 0, display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.9)' }}>
        
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111' }}>
          <div style={{ color: '#FF3B30', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench size={18} /> 情境实体火控中心 (The Tactical Armory)
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto' }}>
          <div style={{ color: '#00FFFF', fontSize: '12px', marginBottom: '24px' }}>
            已锁定 <span style={{ background: '#222', padding: '2px 6px', color: '#FF9900' }}>{targets.length}</span> 个目标主机: {targets.join(', ')}
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
            {stages.map((st, idx) => (
              <div key={idx} onClick={() => setActiveStage(idx)} style={{ flex: 1, cursor: 'pointer', padding: '12px', background: activeStage === idx ? 'rgba(255,59,48,0.1)' : '#111', border: `1px solid ${activeStage === idx ? '#FF3B30' : '#333'}`, borderRadius: '6px', textAlign: 'center', transition: 'all 0.2s', position: 'relative' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px', color: activeStage === idx ? '#FF3B30' : '#999' }}>{st.icon}</div>
                <div style={{ fontSize: '13px', color: activeStage === idx ? '#FF3B30' : '#999', fontWeight: activeStage === idx ? 'bold' : 'normal' }}>{st.name}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#0A0A0A', border: '1px solid #333', borderRadius: '8px', padding: '24px' }}>
            <div style={{ fontSize: '15px', color: '#00FFFF', fontWeight: 'bold', marginBottom: '20px' }}>指令集：{stages[activeStage].name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {stages[activeStage].steps.map(s => (
                <div key={s.id} style={{ background: '#111', border: '1px solid #222', borderRadius: '6px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#E0E0E0', fontWeight: 'bold', marginBottom: '6px' }}>{s.label}</div>
                    <div style={{ fontSize: '11px', color: '#666', fontFamily: 'Consolas, monospace' }}>{s.cmd} [针对 {targets.length} 台]</div>
                  </div>
                  <button style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: '1px solid #FF3B30', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} onClick={() => executeStep(s)}>
                    ▶ 发射
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AttackMatrixView() {
  const [data, setData] = useState({ matrix: {}, active: [] })
  const [selectedTech, setSelectedTech] = useState(null)
  useEffect(() => { fetch(`${API}/attack_matrix`).then(r => r.json()).then(setData).catch(console.error) }, [])
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
      <div style={{ padding: '8px 16px', fontSize: '10px', color: '#666', borderBottom: '1px solid #222' }}>
        MITRE ATT&CK 杀伤链：安全行业标准攻击分类框架。红色高亮 = 当前行动已覆盖的攻击阶段。点击查看技术说明。
      </div>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '16px', flex: 1, alignItems: 'flex-start' }}>
        {Object.entries(data.matrix).map(([tactic, techniques]) => (
          <div key={tactic} style={{ minWidth: '140px', flex: 1 }}>
            <div style={{ background: '#111', borderTop: '2px solid #FF9900', padding: '8px', color: '#FF9900', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>{tactic}</div>
            {techniques.map(t => {
              const isActive = data.active.includes(t)
              return (
                <div key={t} style={{ padding: '8px 4px', marginBottom: '6px', fontSize: '11px', color: isActive ? '#000' : '#888', background: isActive ? '#FF3B30' : selectedTech === t ? 'rgba(0,255,255,0.1)' : 'rgba(255,255,255,0.02)', borderRadius: '2px', textAlign: 'center', cursor: 'pointer', border: isActive ? '1px solid #FF3B30' : selectedTech === t ? '1px solid #00FFFF' : '1px solid #222', fontWeight: isActive ? 'bold' : 'normal', transition: 'all 0.3s' }} onClick={() => setSelectedTech(selectedTech === t ? null : t)}>
                  {t}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {selectedTech && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #333', background: '#0A0A0A', fontSize: '11px' }}>
          <span style={{ color: '#00FFFF', fontWeight: 'bold' }}>{selectedTech}</span>
          <span style={{ color: '#666', marginLeft: '8px' }}>
            {data.active.includes(selectedTech) ? <><Zap size={12} style={{ verticalAlign: 'middle' }} /> 已在本次行动中使用</> : '未覆盖 — 可作为下一步战术方向'}
          </span>
        </div>
      )}
    </div>
  )
}

// ========== AI COPILOT PANEL ==========
const MODELS = [
  { key: 'lite', label: 'Flash-Lite', color: '#B0B0B0', desc: '首选: 极速吞吐抗并发' },
  { key: 'flash', label: 'Flash', color: '#00FFFF', desc: '常规响应' },
  { key: 'think', label: 'Think', color: '#30D158', desc: 'Flash 深度推理' },
  { key: 'pro', label: 'Pro 3.1', color: '#FF9900', desc: '大模型均衡' },
  { key: 'deep', label: 'Deep Think', color: '#FF3B30', desc: '最强推理' },
]

function AiPanel({ isHqMode }) {
  const width = useStore(s => s.aiWidth)
  const onResize = useStore(s => s.setAiWidth)
  const selectedIp = useStore(s => s.selectedIp)
  const assets = useStore(s => s.assets)
  const externalCommand = useStore(s => s.externalCommand)
  const agentMode = useStore(s => s.agentMode)
  const toggleAgentMode = useStore(s => s.toggleAgentMode)
  const sudoPassword = useStore(s => s.sudoPassword)
  
  // ✅ [修复点 1] 挂载兵装槽里的全局并发靶向状态
  const globalTargets = useStore(s => s.globalTargets || [])
  
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [model, setModel] = useState(MODELS[0])
  const [menuOpen, setMenuOpen] = useState(false)
  const [interactionId, setInteractionId] = useState(null)
  const [challengeMsg, setChallengeMsg] = useState(null)
  const [campaignId, setCampaignId] = useState(`camp_${Math.random().toString(36).slice(2, 8)}`)
  const [campaignTitle, setCampaignTitle] = useState('New Session')
  const [campaigns, setCampaigns] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [showArmory, setShowArmory] = useState(false)
  const chatRef = useRef(null)
  const isDragging = useRef(false)
  const abortRef = useRef(null)
  const inputRef = useRef(null)
  const sendRef = useRef(null)

  useEffect(() => {
    if (externalCommand && sendRef.current) sendRef.current(externalCommand.cmd)
  }, [externalCommand])

  const scrollBottom = () => setTimeout(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, 10)

  // Listen for code block "Execute" button clicks
  useEffect(() => {
    const handler = (e) => {
      if (e.detail && sendRef.current) sendRef.current(`请执行以下命令:\n${e.detail}`)
    }
    window.addEventListener('claw-exec-cmd', handler)
    return () => window.removeEventListener('claw-exec-cmd', handler)
  }, [])

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

  const sendMessage = async (overrideInput = null) => {
    const userMsg = overrideInput !== null ? overrideInput : input.trim()
    if (!userMsg) return
    if (streaming) { console.warn('[LYNX] Agent is busy, queued command ignored.'); return }
    if (overrideInput === null) setInput('')

    if (messages.length === 0) {
      setCampaignTitle(userMsg.length > 20 ? userMsg.slice(0, 20) + '...' : userMsg)
    }

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

    // ✅ [修复点 2] 动态计算火力覆盖面（多选优先级 > 单点 > 空）
    const activeTargets = globalTargets.length > 0 ? globalTargets : (selectedIp ? [selectedIp] : [])

    try {
      await fetchEventSource(`http://${window.location.hostname}:8000/api/agent/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userMsg, 
          campaign_id: campaignId, 
          model: model.key, 
          theater: window.__claw_current_theater || 'default', 
          agent_mode: agentMode, 
          sudo_pass: sudoPassword,
          // ✅ [修复点 3] 将靶向数组发给后端
          target_ips: activeTargets 
        }),
        signal: ctrl.signal,
        openWhenHidden: true,

        onmessage(ev) {
          if (!ev.data) return; // Safely ignore empty data frames (e.g., SSE heartbeats)
          let data;
          try {
            data = JSON.parse(ev.data)
          } catch (e) {
            console.error('[SSE Parse Fault] Raw data:', ev.data);
            throw new Error('JSON 解析失真(截断): ' + e.message + ' | 头部内容: ' + ev.data.substring(0, 100));
          }
          switch (ev.event) {
            case 'RUN_STARTED':
              setMessages(prev => {
                const msgs = [...prev]; const last = msgs[msgs.length - 1]
                if (last?.role === 'ai') { last.thinking = true; last.thinkingStatus = data.status || 'Lynx 正在思考...' }
                return msgs
              })
              scrollBottom()
              break
            case 'TOOL_CALL_START':
              toolCalls.push({ name: data.name, args: data.args, risk: data.risk_level || 'green', status: 'running' })
              setMessages(prev => {
                const msgs = [...prev]; const last = msgs[msgs.length - 1]
                if (last?.role === 'ai') { last.tools = [...toolCalls]; last.thinking = false }
                return msgs
              })
              scrollBottom()
              break
            case 'TOOL_CALL_RESULT': {
              const tc = toolCalls.findLast(t => t.name === data.name)
              if (tc) { tc.status = data.status; tc.preview = data.preview }
              if (data.requires_approval) setChallengeMsg({ command: tc?.args?.command || tc?.args?.module || tc?.args?.sql || '未知高危操作' })
              setMessages(prev => {
                const msgs = [...prev]; const last = msgs[msgs.length - 1]
                if (last?.role === 'ai') last.tools = [...toolCalls]
                return msgs
              })
              scrollBottom()
              break
            }
            case 'TEXT_MESSAGE_CONTENT':
              aiText += (data.delta || '')
              setMessages(prev => {
                const msgs = [...prev]; const last = msgs[msgs.length - 1]
                if (last?.role === 'ai') { last.text = aiText; last.thinking = false }
                return msgs
              })
              scrollBottom()
              break
            case 'RUN_FINISHED':
              if (data.interaction_id) setInteractionId(data.interaction_id)
              setMessages(prev => {
                const msgs = [...prev]; const last = msgs[msgs.length - 1]
                if (last?.role === 'ai') { last.thinking = false; last.done = true }
                return msgs
              })
              setStreaming(false)
              scrollBottom()
              abortRef.current?.abort()
              break
            case 'error':
              setMessages(prev => {
                const msgs = [...prev]; const last = msgs[msgs.length - 1]
                if (last?.role === 'ai') { last.text = `[ERR] ${data.message}`; last.thinking = false; last.done = true; last.isError = true }
                return msgs
              })
              setStreaming(false)
              scrollBottom()
              abortRef.current?.abort()
              break
          }
        },
        onerror(err) {
          console.error('SSE error:', err)
          setMessages(prev => {
            const msgs = [...prev]; const last = msgs[msgs.length - 1]
            if (last?.role === 'ai') { 
                const errText = err.message ? err.message : '连接中断，请重试';
                last.text += `\n\n[ERR] 执行总线异常: ${errText}`; 
                last.thinking = false; last.done = true; last.isError = true;
            }
            return msgs
          })
          setStreaming(false)
          throw err
        },
        onclose() {
          if (!ctrl.signal.aborted && streamingRef.current) {
            setMessages(prev => {
              const msgs = [...prev]; const last = msgs[msgs.length - 1]
              if (last?.role === 'ai' && !last.isError) {
                last.text += `\n\n[ERR] 连接中断，请重试`
                last.thinking = false; last.done = true; last.isError = true
              }
              return msgs
            })
          }
          setStreaming(false)
        },
      })
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Agent stream failed:', e)
      setStreaming(false)
    }
  }

  const stopStream = () => { if (abortRef.current) abortRef.current.abort(); setStreaming(false) }
  sendRef.current = sendMessage
  const asset = selectedIp ? assets.find(a => a.ip === selectedIp) : null;
  let dynamicChips = [
    '全面侦察该资产',
    '端口指纹识别',
    '扫描常见高危漏洞',
    '分析操作系统和服务版本',
    '识别 WAF / CDN 类型',
  ]
  if (asset?.ports) {
    if (asset.ports.some(p => p.port === 445)) dynamicChips.push('执行 SMB 弱口令探测', '检查 SMBGhost / EternalBlue', '枚举共享目录')
    if (asset.ports.some(p => p.port === 3389)) dynamicChips.push('扫描 RDP 漏洞', '试探 RDP 弱凭证')
    if (asset.ports.some(p => [80, 443, 8080, 8443].includes(p.port))) dynamicChips.push('启动目录爆破', '扫描常规 Web 漏洞', 'Nuclei 自动化扫描', '识别 Web 框架与 CMS')
    if (asset.ports.some(p => p.port === 21)) dynamicChips.push('尝试 FTP 匿名登录')
    if (asset.ports.some(p => p.port === 22)) dynamicChips.push('SSH 版本探测与弱口令', '检查 SSH 密钥泄露风险')
    if (asset.ports.some(p => p.port === 53)) dynamicChips.push('DNS 区域传送测试')
    if (asset.ports.some(p => p.port === 161)) dynamicChips.push('SNMP 社区字符串枚举')
    if (asset.ports.some(p => p.port === 1433)) dynamicChips.push('MSSQL 弱口令与 xp_cmdshell')
    if (asset.ports.some(p => p.port === 3306)) dynamicChips.push('MySQL 弱口令 / UDF 提权')
    if (asset.ports.some(p => [5432].includes(p.port))) dynamicChips.push('PostgreSQL 弱口令探测')
    if (asset.ports.some(p => p.port === 6379)) dynamicChips.push('Redis 未授权访问检测')
    if (asset.ports.some(p => [139, 445].includes(p.port))) dynamicChips.push('NetBIOS / NTLM 信息泄露')
  }
  const chips = asset ? dynamicChips.slice(0, 6) : [
    '列出所有资产',
    '分析攻击路径',
    '扫描高危端口',
    '查看最新漏洞',
    '全局攻击面报告',
    '查看 Agent 审计日志',
  ]

  const handleChallenge = () => {
    if (!input.trim()) return
    const override = `审批通过: ${challengeMsg.command} (口令: ${input.trim()})`
    setChallengeMsg(null)
    setInput('')
    sendMessage(override)
  }

  return (
    <>
      {!isHqMode && <div className="resizer" onMouseDown={startDrag}></div>}
      <div className="col-right" style={isHqMode ? { flex: 1, minWidth: 0 } : { width: typeof width === 'number' ? width + 'px' : width }}>
        <div className="ai-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 100 }}>
          <div className="ai-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', flexShrink: 1, overflow: 'hidden' }}>
            <span style={{ flexShrink: 0 }}>✧</span> <span style={{ flexShrink: 0 }}>LYNX AI</span>
            <span style={{ fontSize: '10px', color: '#666', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'Consolas, monospace', fontWeight: 'normal', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '180px' }} title={campaignTitle !== 'New Session' ? campaignTitle : campaignId}>
              {campaignTitle !== 'New Session' ? campaignTitle : campaignId}
            </span>
          </div>
          <div className="ai-tools" style={{ display: 'flex', gap: '8px', position: 'relative', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '8px' }}>
            <div className="ai-tool-btn" onClick={() => {
              setCampaignId(`camp_${Math.random().toString(36).slice(2, 8)}`);
              setCampaignTitle('New Session');
              setMessages([]);
              setInteractionId(null);
            }}>[+]</div>
            <div className="ai-tool-btn" onClick={() => {
              fetch(`${API}/campaigns`).then(r => r.json()).then(d => { setCampaigns(d.campaigns); setShowHistory(!showHistory); setShowArmory(false) })
            }}>[历史]</div>
            <div className="ai-tool-btn" onClick={() => { setShowArmory(!showArmory); setShowHistory(false) }}>[武器库]</div>
            {showHistory && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setShowHistory(false)} />
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#111', border: '1px solid #333', borderRadius: '4px', zIndex: 100, width: '240px', maxHeight: '300px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.8)' }}>
                  {campaigns.length === 0 ? <div style={{ padding: '12px', color: '#666', fontSize: '12px', textAlign: 'center' }}>NO RECORDS</div> : null}
                  {campaigns.map(c => (
                    <div key={c.campaign_id} style={{ padding: '8px 12px', borderBottom: '1px solid #222', cursor: 'pointer', fontSize: '12px', color: c.campaign_id === campaignId ? '#00FFFF' : '#999', transition: 'background 0.2s', display: 'flex', flexDirection: 'column', gap: '4px' }} onClick={() => {
                      setCampaignId(c.campaign_id);
                      setCampaignTitle(c.title || c.campaign_id);
                      setMessages([{ role: 'ai', text: `[SYS] 已恢复会话上下文: ${c.title || c.campaign_id}\n(底层模型推理数据流由服务端记忆)`, thinking: false, done: true }]);
                      setShowHistory(false);
                    }} onMouseOver={e => e.currentTarget.style.background = '#222'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || c.campaign_id}</div>
                      <div style={{ fontSize: '10px', color: '#666' }}>ID: {c.campaign_id} • {new Date(c.updated_at + 'Z').toLocaleString('zh-CN', { hour12: false })}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {showArmory && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setShowArmory(false)} />
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#111', border: '1px solid #333', borderRadius: '4px', zIndex: 100, width: '300px', maxHeight: '500px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.8)', padding: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#00FFFF', marginBottom: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>TACTICAL ARMORY (战术武器库)</span>
                  </div>
                  {Object.entries({
                    '侦察 (Recon)': [
                      { id: '00-armory', label: '基础网段连通性探测' },
                      { id: '01-recon', label: '全端口指纹深度扫描' },
                      { id: '02-probe', label: '特殊服务与组件识别' },
                      { id: '02.5-parse', label: 'Nmap 结果数据解析' }
                    ],
                    '打点 (Weaponize)': [
                      { id: '03-audit', label: '常用高危漏洞自动化审计' },
                      { id: '04-phantom', label: 'Web 应用目录与接口发现' },
                      { id: '05-cracker', label: '弱口令协议在线字典暴破' },
                      { id: '12-nuclei', label: 'Nuclei 模板漏洞扫描' },
                      { id: '23-hp-proxy-unlocker', label: '特殊设备代理穿透漏洞利用' }
                    ],
                    '渗透 (Pivot)': [
                      { id: '06-psexec', label: '内网横向 Psexec 指令执行' },
                      { id: '09-loot', label: '实战主机密码票据全面搜刮' },
                      { id: '10-kerberoast', label: 'Kerberoast AD票据攻击' }
                    ],
                    '系统 (System)': [
                      { id: '07-report', label: '渗透审计报告生成' },
                      { id: '08-diff', label: '资产变更差异对比' },
                      { id: '11-webhook', label: '执行结果 Webhook 推送' }
                    ],
                    '智能 (AI)': [
                      { id: '16-ai-analyze', label: '全域攻击面结构化关联归纳' },
                      { id: '17-ask-lynx', label: '申请参谋部高权限接管 / 问答' }
                    ]
                  }).map(([cat, mods]) => (
                    <div key={cat} style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#FF9900', marginBottom: '6px', opacity: 0.9, fontWeight: 'bold' }}>{cat}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                        {mods.map(m => (
                          <div key={m.id} className="ai-tool-btn" style={{ textAlign: 'left', fontSize: '11px', padding: '8px 10px' }} onClick={() => {
                            setShowArmory(false);
                            sendMessage(`调用模块 ${m.id} 对 ${selectedIp ? selectedIp : '全局范围'} 进行操作`);
                          }}>
                            <span style={{ color: '#666', marginRight: '6px', fontFamily: 'Consolas' }}>{m.id.split('-')[0]}</span>
                            <span style={{ color: '#D0D0D0' }}>{m.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="ai-tool-btn" onClick={() => { setMessages([]); setInteractionId(null) }}>[-]</div>
          </div>
        </div>

        <div className="ai-chat-area" ref={chatRef}>
          {messages.length === 0 && (
            <div style={{ marginTop: 'auto' }}>
              <div style={{ fontSize: '18px', color: '#00FFFF', fontWeight: 'bold', fontFamily: 'Consolas, monospace', marginBottom: '8px' }}>
                系统就绪
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                连接 Gemini 3 Interactions API · 实时流式对话<br />
                战役通信 ID: {campaignId}
              </div>
              <div className="chip-group-title">── 快捷指令 ──</div>
              <div className="chips-wrap">
                {chips.map(c => (
                  <div key={c} className="agent-chip" onClick={() => { setInput(c); setTimeout(() => { if (inputRef.current) inputRef.current.focus() }, 50) }}>{c}</div>
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
                    <span style={{ color: '#888', fontSize: '12px' }}>{m.thinkingStatus || 'Lynx 正在思考...'}</span>
                  </div>
                )}
                {m.tools?.map((tc, j) => <ToolCallCard key={j} tool={tc} />)}
                {m.text && <StreamingText text={m.text} done={m.done} isError={m.isError} />}
              </div>
            )
          ))}
        </div>

        <div className="ai-input-float">
          {challengeMsg && (
            <div style={{ padding: '8px 12px', background: 'rgba(255, 68, 68, 0.1)', borderTop: '2px solid #ff4444', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
              <div style={{ color: '#ff4444', fontWeight: 'bold', marginBottom: '4px', fontSize: '13px' }}>
                ⚠ 高危操作人工授权 (RED)
              </div>
              <div style={{ color: '#d0d0d0', fontSize: '12px', marginBottom: '6px' }}>
                目标指令: <code style={{ color: '#ff9900' }}>{challengeMsg.command}</code>
              </div>
              <div style={{ fontSize: '11px', color: '#999' }}>请输入审批口令 (如 CONFIRM/回车) 确认：</div>
            </div>
          )}
          <div className="input-card" style={{ borderTopLeftRadius: challengeMsg ? 0 : 8, borderTopRightRadius: challengeMsg ? 0 : 8 }}>
            <textarea
              ref={inputRef}
              className="ai-input"
              placeholder={challengeMsg ? "输入验证码并回车..." : "输入战术指令..."}
              rows={1}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); challengeMsg ? handleChallenge() : sendMessage() } }}
            />
            <div className="input-tools">
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="model-selector" onClick={() => setMenuOpen(!menuOpen)}>
                  <span style={{ color: model.color }}>●</span>
                  <span style={{ color: '#D0D0D0' }}>{model.label}</span>
                </div>
                {menuOpen && (
                  <div className="model-dropdown">
                    {MODELS.map(m => (
                      <div key={m.key} className={`dd-item ${model.key === m.key ? 'active' : ''}`} onClick={() => { setModel(m); setMenuOpen(false) }}>
                        <span style={{ color: m.color }}>● {m.label}</span>
                        <span style={{ fontSize: '9px', color: '#666' }}>{m.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div 
                  className="agent-toggle" 
                  onClick={toggleAgentMode}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                    padding: '4px 8px', borderRadius: '4px', border: `1px solid ${agentMode ? '#FF9900' : '#333'}`,
                    background: agentMode ? 'rgba(255,153,0,0.1)' : 'rgba(255,255,255,0.05)',
                    fontSize: '11px', fontWeight: 'bold', fontFamily: 'Consolas, monospace',
                    transition: 'all 0.2s', userSelect: 'none'
                  }}
                  title={agentMode ? "Autonomous Execution Allowed" : "Read-Only Conversational Mode"}
                >
                  {agentMode ? <Bot size={13} color="#FF9900" /> : <MessageSquare size={13} color="#30D158" />}
                  <span style={{ color: agentMode ? '#FF9900' : '#888' }}>
                    [ AUTONOMY: {agentMode ? 'ON' : 'OFF'} ]
                  </span>
                </div>
              </div>
              {streaming ? (
                <button className="send-btn" onClick={stopStream} style={{ background: '#FF3B30' }}>
                  <svg className="send-icon" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                </button>
              ) : (
                <button className="send-btn" onClick={challengeMsg ? handleChallenge : () => sendMessage(null)} disabled={!input.trim()} style={{ background: challengeMsg ? '#ff4444' : '' }}>
                  <svg className="send-icon" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
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
  const riskColor = tool.risk?.toLowerCase() === 'red' ? '#FF3B30' : tool.risk?.toLowerCase() === 'yellow' ? '#FF9900' : '#30D158'
  const TOOL_CN = {
    claw_query_db: '数据库查询',
    claw_read_file: '文件读取',
    claw_list_assets: '资产列举',
    claw_execute_shell: '命令执行',
    claw_run_module: '模块调用',
    claw_sliver_execute: '远控指令',
    claw_delegate_agent: 'A2A 子智能体委派',
  }
  const cnName = TOOL_CN[tool.name] || ''
  return (
    <details style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid #222',
      borderLeft: `3px solid ${riskColor}`,
      borderRadius: '4px', padding: '8px 10px', margin: '6px 0',
      fontSize: '12px', fontFamily: 'Consolas, monospace',
    }}>
      <summary style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', outline: 'none' }}>
        <span style={{ background: riskColor, color: '#000', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold' }}>
          {tool.risk?.toUpperCase() || 'GREEN'}
        </span>
        <span style={{ color: '#00FFFF' }}>{tool.name}</span>
        {cnName && <span style={{ color: '#666', fontSize: '10px' }}>({cnName})</span>}
        <span style={{ color: (tool.status === 'ok' || tool.status === 'success') ? '#30D158' : (tool.status === 'error' || tool.status === 'failed') ? '#FF3B30' : '#D0D0D0', fontSize: '10px', marginLeft: 'auto' }}>
          {tool.status === 'running' ? <><Loader2 size={11} className="spin" /> 执行中...</> : (tool.status === 'ok' || tool.status === 'success') ? '> 完成' : (tool.status === 'error' || tool.status === 'failed') ? 'x 失败' : tool.status}
        </span>
      </summary>
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #333' }}>
        {tool.args && Object.entries(tool.args).map(([k, v]) => (
          <div key={k} style={{ marginBottom: '4px' }}>
            <span style={{ color: '#999' }}>{k}:</span> <span style={{ color: '#D0D0D0' }}>{v}</span>
          </div>
        ))}
        {tool.preview && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ color: '#30D158', background: 'rgba(48,209,88,0.1)', padding: '8px', borderRadius: '4px', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto', fontSize: '11px', lineHeight: '1.5', cursor: 'text', userSelect: 'text' }}>
              {tool.preview}
            </div>
          </div>
        )}
      </div>
    </details>
  )
}

function A2UIRenderer({ data }) {
  if (!data) return null
  const renderNode = (node, idx) => {
    if (typeof node === 'string') return <span key={idx}>{node}</span>
    if (Array.isArray(node)) return node.map(renderNode)
    if (!node || typeof node !== 'object') return null

    switch (node.type) {
      case 'card':
        return (
          <div key={node.id || idx} style={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: '8px', padding: '12px', margin: '12px 0', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            {node.title && <div style={{ color: '#00FFFF', fontWeight: 'bold', marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '6px', display: 'flex', alignItems: 'center' }}>
              {node.icon && <span style={{ marginRight: '8px' }}>{node.icon}</span>}
              {node.title}
            </div>}
            {renderNode(node.children || node.content, 0)}
          </div>
        )
      case 'row':
        return <div key={node.id || idx} style={{ display: 'flex', gap: node.gap || '12px', alignItems: node.align || 'center', flexWrap: 'wrap', margin: '6px 0' }}>{renderNode(node.children, 0)}</div>
      case 'col':
        return <div key={node.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: node.gap || '8px', margin: '6px 0' }}>{renderNode(node.children, 0)}</div>
      case 'text':
        return <span key={node.id || idx} style={{ color: node.color || '#D0D0D0', fontSize: node.size || '12px', fontWeight: node.weight || 'normal' }}>{node.content}</span>
      case 'button':
        return (
          <button key={node.id || idx} onClick={() => { if (node.action) window.dispatchEvent(new CustomEvent('claw-exec-cmd', { detail: node.action })) }}
            style={{ background: '#2A2A2A', border: `1px solid ${node.color || '#00FFFF'}`, color: node.color || '#00FFFF', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s', ...node.style }}
            onMouseOver={(e) => Object.assign(e.target.style, { background: node.color || '#00FFFF', color: '#000' })}
            onMouseOut={(e) => Object.assign(e.target.style, { background: '#2A2A2A', color: node.color || '#00FFFF' })}>
            {node.icon && <span style={{ marginRight: '6px' }}>{node.icon}</span>}
            {node.label}
          </button>
        )
      case 'table':
        return (
          <div key={node.id || idx} style={{ overflowX: 'auto', margin: '8px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead><tr style={{ background: '#222', color: '#00FFFF' }}>{node.headers?.map((h, i) => <th key={i} style={{ padding: '8px', borderBottom: '2px solid #333' }}>{h}</th>)}</tr></thead>
              <tbody>{node.rows?.map((r, i) => <tr key={i} style={{ borderBottom: '1px solid #222' }}>{r.map((c, j) => <td key={j} style={{ padding: '8px', color: '#ccc' }}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )
      case 'badge':
        return <span key={node.id || idx} style={{ background: node.bg || '#333', color: node.color || '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', border: `1px solid ${node.color || '#fff'}` }}>{node.content}</span>
      case 'progress':
        return (
          <div key={node.id || idx} style={{ width: '100%', background: '#222', borderRadius: '4px', overflow: 'hidden', height: '8px', margin: '4px 0' }}>
            <div style={{ width: `${node.percent}%`, background: node.color || '#30D158', height: '100%' }}></div>
          </div>
        )
      default:
        return <div key={idx} style={{ color: '#FF3B30', fontSize: '11px' }}>⚠ Unknown A2UI Component: {node.type}</div>
    }
  }
  return renderNode(data, 'root')
}

// ✅ [防御点 2] 彻底重写 StreamingText，完美兼容流式“半截”未闭合状态
function StreamingText({ text, done, isError }) {
  const segments = [];
  const textStr = text || '';
  
  // 利用 ``` 分割：偶数索引永远是普通文本，奇数索引永远是代码块（无论是否闭合）
  const parts = textStr.split('```');
  
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) segments.push({ type: 'text', content: parts[i] });
    } else {
      // 奇数索引是代码块。如果流未结束且是最后一段，则处于「未闭合接收中」状态
      const isUnclosed = (i === parts.length - 1) && !done;
      const firstNewline = parts[i].indexOf('\n');
      
      let lang = 'text', content = parts[i];
      if (firstNewline !== -1) {
        lang = parts[i].slice(0, firstNewline).trim() || 'bash';
        content = parts[i].slice(firstNewline + 1);
      } else {
        lang = parts[i].trim() || 'bash'; // 换行符还没推过来
        content = ''; 
      }
      segments.push({ type: 'code', lang, content, isUnclosed });
    }
  }

  const handleCopy = (code) => { navigator.clipboard.writeText(code).catch(() => {}) }
  const handleExec = (code) => { window.dispatchEvent(new CustomEvent('claw-exec-cmd', { detail: code })) }

  return (
    <div style={{ color: isError ? '#FF3B30' : '#D0D0D0' }}>
      {segments.map((seg, i) => {
        if (seg.type === 'code') {
          // ✅ [防御点 3] A2UI 渐进式渲染保护 (优雅吞咽 JSON Parse 报错)
          if (seg.lang === 'a2ui') {
            try {
              return <A2UIRenderer key={i} data={JSON.parse(seg.content)} />
            } catch (e) {
              if (seg.isUnclosed) {
                return (
                  <div key={i} style={{ color: '#00FFFF', fontSize: '11px', background: 'rgba(0,255,255,0.05)', padding: '8px', border: '1px dashed #00FFFF', marginTop: '4px' }}>
                    <Loader2 size={12} className="spin" style={{marginRight: '6px', verticalAlign: 'middle'}}/>
                    [A2UI] 视觉拓扑阵列数据流折跃中...
                  </div>
                )
              }
              return <div key={i} style={{ color: '#FF3B30', fontSize: '11px', background: '#222', padding: '8px', marginTop: '4px' }}>[A2UI Parse Error] {e.message}</div>
            }
          }

          const isBash = ['bash', 'sh', 'shell', ''].includes(seg.lang)
          return (
            <div key={i} style={{ background: '#0A0A0A', border: seg.isUnclosed ? '1px dashed #FF9900' : '1px solid #333', borderRadius: '4px', margin: '8px 0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: '#111', borderBottom: '1px solid #222' }}>
                <span style={{ color: seg.isUnclosed ? '#FF9900' : '#666', fontSize: '10px' }}>
                  {seg.lang || 'code'} {seg.isUnclosed && <span className="blink">...</span>}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', borderRadius: '3px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }} onClick={() => handleCopy(seg.content)}><Copy size={10} /> 复制</button>
                  {/* 仅当代码块闭合后，才允许发送到 AI 执行 */}
                  {isBash && !seg.isUnclosed && <button style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: '1px solid #333', borderRadius: '3px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer' }} onClick={() => handleExec(seg.content)}>▶ 执行</button>}
                </div>
              </div>
              <pre style={{ margin: 0, padding: '8px 10px', color: '#D0D0D0', fontSize: '12px', fontFamily: 'Consolas, monospace', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                {seg.content}
                {seg.isUnclosed && <span className="typing-cursor" style={{ background: '#FF9900' }}></span>}
              </pre>
            </div>
          )
        }
        return (
          <span key={i}>
            {seg.content.split('\n').map((line, j) => (
              <span key={j}>{line}{j < seg.content.split('\n').length - 1 && <br />}</span>
            ))}
          </span>
        )
      })}
      {!done && segments.length > 0 && segments[segments.length-1].type === 'text' && <span className="typing-cursor"></span>}
    </div>
  )
}

// ========== DOCKER PANEL ==========
function DockerPanel() {
  const [data, setData] = useState({ images: [], containers: [] })
  const [loading, setLoading] = useState(true)
  const [actionStatus, setActionStatus] = useState(null)

  const fetchStatus = () => {
    fetch(`${API}/docker/status`).then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(e => { setLoading(false) })
  }

  useEffect(() => { fetchStatus() }, [])

  const handleAction = (action, name) => {
    setActionStatus(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}中...`)
    fetch(`${API}/docker/${action}/${name}`, { method: 'POST' })
      .then(r => r.json()).then(d => {
        setActionStatus(d.error ? `✗ ${d.error}` : `✓ ${action} 完成`)
        setTimeout(() => { fetchStatus(); setActionStatus(null) }, 2000)
      }).catch(e => { setActionStatus(`✗ ${e.message}`); setTimeout(() => setActionStatus(null), 3000) })
  }

  if (loading) return <div style={{ color: '#666', padding: '24px' }}>正在查询 Docker 状态...</div>

  return (
    <div style={{ flex: 1, padding: '24px', overflowY: 'auto', minHeight: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '16px', color: '#FF9900', fontWeight: 'bold' }}>云端战车 (Docker Arsenal)</span>
          <span style={{ fontSize: '10px', color: '#666', marginLeft: '8px' }}>{data.images?.length || 0} 镜像 · {data.containers?.length || 0} 容器</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {actionStatus && <span style={{ fontSize: '11px', color: '#30D158' }}>{actionStatus}</span>}
          <button style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', borderRadius: '4px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer' }} onClick={fetchStatus}>🔄 刷新</button>
        </div>
      </div>

      {/* Containers */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: '#00FFFF', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #222', paddingBottom: '4px' }}>容器 (Containers)</div>
        {(!data.containers || data.containers.length === 0) ? (
          <div style={{ color: '#666', fontSize: '12px', padding: '8px' }}>无运行容器</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>名称</th><th>镜像</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {data.containers.map(c => (
                <tr key={c.id}>
                  <td style={{ color: '#00FFFF', fontWeight: 'bold' }}>{c.name}</td>
                  <td style={{ color: '#D0D0D0' }}>{c.image}</td>
                  <td>
                    <span style={{ color: c.running ? '#30D158' : '#FF9900', background: c.running ? 'rgba(48,209,88,0.1)' : 'rgba(255,153,0,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>
                      {c.running ? '● 运行中' : '○ 已停止'}
                    </span>
                    <span style={{ color: '#666', fontSize: '10px', marginLeft: '6px' }}>{c.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {!c.running && <button style={{ background: 'rgba(48,209,88,0.1)', color: '#30D158', border: '1px solid #333', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer' }} onClick={() => handleAction('start', c.name)}>▶ 启动</button>}
                      {c.running && <button style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: '1px solid #333', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer' }} onClick={() => handleAction('stop', c.name)}>⏹ 停止</button>}
                      <button style={{ background: '#222', color: '#FF9900', border: '1px solid #333', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer' }} onClick={() => handleAction('restart', c.name)}>🔄 重启</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Images */}
      <div>
        <div style={{ fontSize: '12px', color: '#FF9900', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #222', paddingBottom: '4px' }}>镜像库 (Images)</div>
        <table className="data-table">
          <thead><tr><th>镜像名称</th><th>ID</th><th>大小</th><th>构建时间</th></tr></thead>
          <tbody>
            {(data.images || []).map(img => (
              <tr key={img.id}>
                <td style={{ color: img.name.includes('arsenal') ? '#FF3B30' : img.name.includes('dvwa') ? '#FF9900' : '#D0D0D0', fontWeight: img.name.includes('v4') ? 'bold' : 'normal' }}>
                  {img.name}
                  {img.name.includes(':v4') && <span style={{ marginLeft: '6px', fontSize: '9px', color: '#30D158', background: 'rgba(48,209,88,0.1)', padding: '1px 6px', borderRadius: '3px' }}>LATEST</span>}
                </td>
                <td style={{ color: '#666', fontFamily: 'Consolas' }}>{img.id}</td>
                <td style={{ color: '#00FFFF' }}>{img.size}</td>
                <td style={{ color: '#666' }}>{img.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const ALL_MODULES = [
  '00-armory', '01-recon', '02-probe', '02.5-parse', '03-audit', '04-phantom', '05-cracker',
  '06-psexec', '07-report', '08-diff', '09-loot', '10-kerberoast',
  '11-webhook', '12-nuclei', '16-ai-analyze', '17-ask-lynx', '23-hp-proxy-unlocker'
];

function OutputConsole() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeJob, setActiveJob] = useState(null)
  const containerRef = useRef(null)
  const abortRef = useRef(null)
  const activeJobRef = useRef(null) // used for keydown listener

  useEffect(() => {
    activeJobRef.current = activeJob
  }, [activeJob])

  useEffect(() => {
    const handleStartLog = async (e) => {
      const { job_id, theater } = e.detail
      setActiveJob(job_id)
      setLogs([{ time: new Date().toLocaleTimeString(), level: 'SYS', msg: `[CLAW] 连接到作战任务流: ${job_id}` }])

      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        await fetchEventSource(`http://${window.location.hostname}:8000/api/v1/ops/log/${job_id}?theater=${theater}`, {
          method: 'GET',
          signal: ctrl.signal,
          openWhenHidden: true,
          onmessage(ev) {
            const data = JSON.parse(ev.data)
            if (data.text) {
              setLogs(prev => [...prev.slice(-499), { time: new Date().toLocaleTimeString(), level: 'OUT', msg: data.text }])
            }
            if (data.done) {
              ctrl.abort()
              // 发送完成信号，由面板捕获并刷新资产
              window.dispatchEvent(new CustomEvent('CLAW_OP_FINISHED'))
            }
          },
          onerror(err) {
            console.error('Ops log SSE error:', err)
            setLogs(prev => [...prev.slice(-499), { time: new Date().toLocaleTimeString(), level: 'ERR', msg: '[CLAW] 日志流连接中断' }])
            window.dispatchEvent(new CustomEvent('CLAW_OP_FINISHED')) // 防止卡死在运行中状态
            throw err // auto retry unless we abort
          }
        })
      } catch (err) {
        // aborted or failed
      }
    }

    window.addEventListener('CLAW_START_SSE_LOG', handleStartLog)
    return () => {
      window.removeEventListener('CLAW_START_SSE_LOG', handleStartLog)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only intercept Ctrl+C when OUTPUT tab is active (not xterm/debug)
      // Check if the OUTPUT console tab is currently visible
      const outputTab = document.querySelector('[data-console-tab="output"]')
      if (e.ctrlKey && e.key === 'c' && activeJobRef.current && outputTab) {
        e.preventDefault()
        fetch(`http://${window.location.hostname}:8000/api/v1/ops/stop/${activeJobRef.current}`, { method: 'POST' })
        setLogs(prev => [...prev.slice(-499), { level: 'SYS', msg: '[CLAW] 键盘中断: 发送 SIGTERM 终止信号...' }])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (containerRef.current) {
      // only scroll if we are near the bottom to avoid fighting user scroll
      const isScrolledNearBottom = containerRef.current.scrollHeight - containerRef.current.clientHeight <= containerRef.current.scrollTop + 50;
      if (isScrolledNearBottom) containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div ref={containerRef} style={{ color: '#D0D0D0', fontSize: '11px', fontFamily: 'Consolas, monospace', padding: '4px', overflowY: 'auto', height: '100%', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
      <div style={{ color: '#FF9900', marginBottom: '8px' }}>--- 作战控制台输出 (Operation Output) ---</div>
      {!activeJob && <div style={{ color: '#666' }}>等待执行作战指令... (在「OP 作战」面板点击执行模块)</div>}
      {logs.map((l, i) => (
        <div key={i} style={{ marginBottom: '2px' }}>
          <span style={{ color: l.level === 'SYS' ? '#00FFFF' : l.level === 'ERR' ? '#FF3B30' : '#666', marginRight: '8px' }}>
            {l.level === 'OUT' ? '' : `[${l.level}]`}
          </span>
          <span style={{ color: l.level === 'ERR' ? '#FF3B30' : l.level === 'SYS' ? '#00FFFF' : '#D0D0D0' }}>{l.msg}</span>
        </div>
      ))}
    </div>
  )
}

function Spotlight() {
  const assets = useStore(s => s.assets)
  const open = useStore(s => s.spotlightOpen)
  const onClose = () => useStore.getState().setSpotlightOpen(false)
  const onSelectAsset = (ip) => useStore.getState().setSelectedIp(ip)
  const onSelectModule = cmd => useStore.getState().setExternalCommand({ id: Date.now(), cmd })

  if (!open) return null;
  const [query, setQuery] = useState('')
  const filteredAssets = assets.filter(a => a.ip.includes(query) || a.os.toLowerCase().includes(query.toLowerCase()))
  const filteredModules = query ? ALL_MODULES.filter(m => m.includes(query.toLowerCase())) : []

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', justifyContent: 'center', paddingTop: '15vh' }} onClick={onClose}>
      <div style={{ width: '500px', background: '#111', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
        <input autoFocus placeholder="Cmd+K 搜索资产 IP / 操作系统 / 战术模块..." value={query} onChange={e => setQuery(e.target.value)} style={{ width: '100%', padding: '16px', background: '#1a1a1a', border: 'none', borderBottom: '1px solid #333', color: '#00FFFF', fontSize: '16px', outline: 'none', fontFamily: 'Consolas, monospace' }} />
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {filteredModules.length > 0 && <div style={{ padding: '4px 16px', fontSize: '10px', color: '#00FFFF', background: '#1a1a1a' }}>战术模块 (TACTICAL MODULES)</div>}
          {filteredModules.map(m => (
            <div key={m} onClick={() => { onSelectModule(`调用模块 ${m} 进行操作`); onClose() }} style={{ padding: '12px 16px', borderBottom: '1px solid #222', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: '#FF9900', transition: 'background 0.2s', fontWeight: 'bold' }} onMouseOver={e => e.currentTarget.style.background = '#222'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              <span>{m}</span>
              <span style={{ fontSize: '12px', color: '#666' }}>执行模块</span>
            </div>
          ))}

          {filteredAssets.length > 0 && <div style={{ padding: '4px 16px', fontSize: '10px', color: '#00FFFF', background: '#1a1a1a' }}>已知资产 (TARGET ASSETS)</div>}
          {filteredAssets.slice(0, 8).map(a => (
            <div key={a.ip} onClick={() => { onSelectAsset(a.ip); onClose() }} style={{ padding: '12px 16px', borderBottom: '1px solid #222', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: '#d0d0d0', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#222'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ color: '#30D158' }}>{a.ip}</span>
              <span style={{ color: '#666', fontSize: '12px' }}>{a.os || 'Unknown OS'} · {a.port_count} ports</span>
            </div>
          ))}
          {filteredAssets.length === 0 && filteredModules.length === 0 && <div style={{ padding: '16px', color: '#666', textAlign: 'center', fontSize: '13px' }}>无匹配记录</div>}
        </div>
      </div>
    </div>
  )
}

// ========== FLOATING CONSOLE ==========
function FloatingConsole({ isDocked, setIsDocked }) {
  const terminalOpen = useStore(state => state.terminalOpen)
  const setTerminalOpen = useStore(state => state.setTerminalOpen)
  const consoleTab = useStore(state => state.consoleTab)
  const setConsoleTab = useStore(state => state.setConsoleTab)
  const terminalHeight = useStore(state => state.terminalHeight)
  const setTerminalHeight = useStore(state => state.setTerminalHeight)
  const stats = useStore(state => state.stats)
  
  const [maximized, setMaximized] = useState(false)
  const [minimized, setMinimized] = useState(false)

  const isTermDragging = useRef(false)
  const startTerminalDrag = (e) => {
    e.stopPropagation()
    isTermDragging.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev) => {
      if (!isTermDragging.current) return
      const newH = Math.max(100, Math.min(window.innerHeight - ev.clientY, window.innerHeight * 0.8))
      setTerminalHeight(newH)
    }
    const onUp = () => {
      isTermDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  if (!terminalOpen) return null

  if (minimized && !isDocked) {
    return (
      <div style={{ position: 'fixed', bottom: 20, right: '400px', zIndex: 9999, background: '#111', border: '1px solid #00FFFF', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 20px rgba(0,255,255,0.2)', cursor: 'pointer' }} onClick={() => setMinimized(false)}>
        <span style={{ color: '#00FFFF', fontSize: '13px', fontWeight: 'bold' }}><Zap size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/>CLAW Console Active</span>
        <button style={{ border: 'none', background: 'transparent', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={(e) => { e.stopPropagation(); setTerminalOpen(false) }} title="彻底关闭"><X size={14}/></button>
      </div>
    )
  }

  const dockedStyles = {
    position: 'relative',
    height: `${Math.max(150, terminalHeight)}px`,
    width: '100%',
    background: '#050505',
    borderTop: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  }

  const floatingWidth = maximized ? '98vw' : '800px'
  const floatingHeight = maximized ? '96vh' : `${Math.max(300, terminalHeight)}px`
  const positionStyles = maximized ? 
    { top: '2vh', left: '1vw' } : 
    { bottom: 20, right: '400px' } // Keep clear of AiPanel which is ~350px wide

  const floatingStyles = {
    position: 'fixed',
    ...positionStyles,
    width: floatingWidth,
    height: floatingHeight,
    background: '#050505',
    border: '1px solid #00FFFF',
    borderRadius: '8px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 50px rgba(0,0,0,0.8)',
    overflow: 'hidden',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  }

  const currentStyles = isDocked ? dockedStyles : floatingStyles

  return (
    <div style={currentStyles}>
      {/* Header */}
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 16px', borderBottom: '1px solid #222', backgroundColor: '#111', fontSize: '12px', cursor: isDocked ? 'row-resize' : 'default', userSelect: 'none' }}
        onMouseDown={isDocked ? startTerminalDrag : undefined}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }} onMouseDown={e => e.stopPropagation()}>
          {[['xterm', 'XTERM CONSOLE'], ['output', 'OUTPUT'], ['debug', 'DEBUG CONSOLE']].map(([k, label]) => (
            <span key={k} data-console-tab={consoleTab === k ? k : undefined} style={{ cursor: 'pointer', padding: '4px 0', color: consoleTab === k ? '#00FFFF' : '#666', fontWeight: consoleTab === k ? 'bold' : 'normal', borderBottom: consoleTab === k ? '2px solid #00FFFF' : '2px solid transparent', transition: 'all 0.2s' }} onClick={() => setConsoleTab(k)}>{label}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }} onMouseDown={e => e.stopPropagation()}>
          {isDocked ? (
            <button style={{ background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setIsDocked(false)} title="漂浮弹出 (Float)"><ArrowUpRight size={13}/></button>
          ) : (
            <>
              <button style={{ background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setIsDocked(true)} title="停靠到底部 (Dock)"><PanelBottom size={13}/></button>
              <button style={{ background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setMinimized(true)} title="最小化"><Minimize2 size={13}/></button>
              <button style={{ background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setMaximized(!maximized)} title="最大化">{maximized ? <Square size={13}/> : <Maximize2 size={13}/>}</button>
            </>
          )}
          <button style={{ background: 'transparent', border: 'none', color: '#FF3B30', cursor: 'pointer', marginLeft: '8px', display: 'flex', alignItems: 'center' }} onClick={() => setTerminalOpen(false)} title="关闭 (Close)"><X size={14}/></button>
        </div>
      </div>
      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '8px' }}>
        {consoleTab === 'xterm' && <MemoXTerm />}
        {consoleTab === 'output' && <OutputConsole />}
        {consoleTab === 'debug' && (
          <div style={{ color: '#666', fontSize: '12px', fontFamily: 'Consolas, monospace', padding: '8px', overflowY: 'auto', height: '100%' }}>
            <div style={{ color: '#00FFFF', fontWeight: 'bold', marginBottom: '12px' }}>系统连接状态</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#30D158', display: 'inline-block' }}></span><span>后端 API: {API}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#30D158', display: 'inline-block' }}></span><span>Agent: Gemini 3 Flash (MCP)</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF9900', display: 'inline-block' }}></span><span>HITL: Enabled (RED 操作需审批)</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FFFF', display: 'inline-block' }}></span><span>WebSocket (PTY): ws://localhost:8000/api/v1/terminal</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#30D158', display: 'inline-block' }}></span><span>Scope: God Mode (无限制)</span></div>
            </div>
            <div style={{ marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #222', color: '#444', fontSize: '10px' }}>
              当前战区: {window.__claw_current_theater || 'default'} | 资产: {stats?.hosts ?? '?'} 台 | 端口: {stats?.ports ?? '?'} 个
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ========== MAIN APP ==========
const MemoXTerm = React.memo(XTermConsole)

function App() {
  const currentTheater = useStore(state => state.currentTheater)
  const setStats = useStore(state => state.setStats)
  const setAssets = useStore(state => state.setAssets)
  const view = useStore(state => state.view)
  const setView = useStore(state => state.setView)

  const [isDocked, setIsDocked] = useState(true)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        useStore.getState().setSpotlightOpen(!useStore.getState().spotlightOpen)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        useStore.getState().setTerminalOpen(!useStore.getState().terminalOpen)
      }
      if (e.key === 'Escape') useStore.getState().setSpotlightOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 1. 在 App 组件顶层引入两个防御守卫 Ref
  const abortCtrlRef = useRef(null);
  const dataHashRef = useRef(null);

  // 2. 重构带有“防串台”与“熔断机制”的同步引擎
  const refreshAssets = async (forceUpdate = false) => {
    // 【守卫 A：请求溯源】获取发起请求瞬间的真实战区，取代对后端的隐式推断
    const reqTheater = useStore.getState().currentTheater || window.__claw_current_theater || 'default';

    // 【守卫 B：网络拥塞阻断】斩断上一个在途的老旧请求，防止网络积压引发并发雪崩
    if (abortCtrlRef.current) abortCtrlRef.current.abort();
    abortCtrlRef.current = new AbortController();
    const signal = abortCtrlRef.current.signal;

    try {
      const clientHash = forceUpdate ? '' : (dataHashRef.current || '');
      const res = await fetch(`${API}/sync?theater=${reqTheater}&client_hash=${clientHash}`, { signal });
      const data = await res.json();

      // 【守卫 C：战区幻影拦截 (Theater Drift Check)】
      // 若异步等待期间，用户已经切走了战区，则无情丢弃这份迟到的旧数据，彻底根治串台污染！
      if (useStore.getState().currentTheater !== reqTheater) {
        console.warn(`[Drift Guard] 拦截并丢弃战区 ${reqTheater} 的滞后幻影数据`);
        return; 
      }

      // 更新基础轻量指标 (保证时间跳动等)
      if (data.stats) setStats(data.stats);

      // 【守卫 D：OOM 终结者】
      // 若后端判定大表数据未变，立刻 return。这就免去了 React 对成百上千个 DOM 节点的无意义 Diff 重绘
      if (!data.changed) return;

      // 确认为新数据，放行渲染
      dataHashRef.current = data.hash;
      if (data.assets) setAssets(data.assets);

    } catch (err) {
      // 忽略因主动掐断产生的 AbortError
      if (err.name !== 'AbortError') console.error('[CLAW Sync Error]', err);
    }
  };

  // 全局暴露以供作战模块 (如 Nmap 扫描结束) 强制刷新
  useEffect(() => { window.__claw_refresh_assets = () => refreshAssets(true) }, []); // eslint-disable-line

  // 3. 唯一的全局轮询节拍器
  useEffect(() => {
    // 战区发生切换时：清空旧 Hash 并强制拉取新战区数据
    dataHashRef.current = null;
    refreshAssets(true);

    // 挂载稳定轮询
    const timer = setInterval(() => refreshAssets(false), 3000);
    
    return () => {
      clearInterval(timer);
      if (abortCtrlRef.current) abortCtrlRef.current.abort();
    };
  }, [currentTheater]);

  useEffect(() => {
    const handleSwitchConsole = (e) => {
      useStore.getState().setTerminalOpen(true)
      useStore.getState().setConsoleTab(e.detail)
    }
    window.addEventListener('CLAW_SWITCH_CONSOLE_TAB', handleSwitchConsole)
    return () => window.removeEventListener('CLAW_SWITCH_CONSOLE_TAB', handleSwitchConsole)
  }, [])

  return (
    <div className="app-container">
      <HudBar onRefreshAssets={refreshAssets} />
      <div className="main-shell" style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden' }}>

        {/* Left pane: Activities, Sidebar, Center WorkArea OVER Terminal */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <div className="activity-bar">
              {[['HQ', TerminalIcon, '指挥座舱'], ['RF', Radio, '无线电场'], ['DP', Archive, '数字兵站'], ['VS', Globe, '全域透视']].map(([k, Icon, label]) => (
                <div key={k} className={`activity-icon ${view === k ? 'active' : ''}`} onClick={() => setView(k)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Icon size={20} strokeWidth={1.5} />
                  <div style={{ fontSize: '10px' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Sidebar conditionally renders based on view mappings; for RF, it renders null to maximize radar width */}
            <Sidebar onRefreshAssets={refreshAssets} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: '1px solid #333' }}>
              {view === 'RF' ? (
                <AlfaRadarView />
              ) : (
                <WorkArea />
              )}
              
              {/* Terminal renders natively inside flex column when Docked, keeping scroll bars constrained */}
              {isDocked && <FloatingConsole isDocked={isDocked} setIsDocked={setIsDocked} />}
            </div>
          </div>
        </div>

        {/* Right pane: AI Panel - Reverted to native outer block so it spans full height */}
        <AiPanel isHqMode={false} />

      </div>
      <Spotlight />
      {!isDocked && <FloatingConsole isDocked={isDocked} setIsDocked={setIsDocked} />}
    </div>
  )
}

export default App

