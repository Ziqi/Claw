import React, { useState, useEffect, useRef } from 'react'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { Network } from 'vis-network'
// [REMOVED in V9.3] Terminal/xterm imports removed - SSH into Kali for terminal
import { Radar, AlertTriangle, Crown, Signal, Search, ClipboardList, Swords, BarChart, Settings, RefreshCw, Globe, Crosshair, Loader2, Rocket, Zap, Building, Flame, FlaskConical, Skull, KeyRound, Monitor, ShieldAlert, Copy, X, Info, Bug, Lock, Target, Radio, FileText, Wrench, Maximize2, Minimize2, Square, PanelBottom, ArrowUpRight, Terminal as TerminalIcon, Archive, Bot, MessageSquare, Trash2, Activity, Wifi, Send, Menu } from 'lucide-react'
import useStore from './store'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  const theaterMenuRef = useRef(null)
  const [showCreateTheater, setShowCreateTheater] = useState(false)
  const [showTheaterConfig, setShowTheaterConfig] = useState(false)
  const [alignment, setAlignment] = useState(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (theaterMenuRef.current && !theaterMenuRef.current.contains(e.target)) {
        setShowTheaterMenu(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])
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
    return fetch(`${API}/env/list`).then(r => r.json()).then(d => {
      setTheaters(d.theaters || [])
      const curr = d.current || 'default'
      // 核心：同时写透 window 全局变量 + Zustand Store，确保 refreshAssets 的 Drift Guard 不误杀
      window.__claw_current_theater = curr
      setCurrentTheater(curr)
      useStore.getState().setCurrentTheater(curr)
    }).catch(console.error)
  }
  useEffect(() => { refreshTheaters() }, [])

  // Expose currentTheater globally for OP Pipeline & OP Sidebar & Zustand Store
  useEffect(() => {
    window.__claw_current_theater = currentTheater
    useStore.getState().setCurrentTheater(currentTheater)
    // Update alignment sensor on env change
    fetch(`${API}/env/network_alignment`).then(r => r.json()).then(setAlignment).catch(() => {})
  }, [currentTheater])

  const switchTheater = (name) => {
    fetch(`${API}/env/switch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      .then(r => r.json()).then(() => {
        // [Hotfix] 强行同步注入 window 全局变量，打断 React 的 useState 延迟
        window.__claw_current_theater = name;
        setCurrentTheater(name)  // 这会触发 useEffect([currentTheater])，由它来负责刷新数据
        setShowTheaterMenu(false)
        refreshTheaters()
        // 注意：不再在此处调用 onRefreshAssets()！
        // 由 useEffect([currentTheater]) 统一调度，避免竞态导致旧战区 Hash 污染新战区
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
        CLAW V9.3
        
        <div style={{ marginLeft: '12px', padding: '2px 6px', background: sudoPassword ? 'rgba(48,209,88,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${sudoPassword ? '#30D158' : '#444'}`, borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
             onClick={() => {
               const pwd = window.prompt("[!] 配置全局 Root (Sudo) 提权密码\n用于 Kali 执行端底层模块的自动化提权调用:", sudoPassword || "")
               if (pwd !== null) setSudoPassword(pwd)
             }}
             title="全局提权钥匙环">
          <KeyRound size={12} color={sudoPassword ? '#30D158' : '#888'} /> 
          <span style={{ fontSize: '11px', color: sudoPassword ? '#30D158' : '#888' }}>{sudoPassword ? 'ROOT: ON' : 'ROOT: OFF'}</span>
        </div>

        {alignment && alignment.aligned === false && (
          <div style={{ marginLeft: '12px', padding: '2px 8px', background: 'rgba(255,153,0,0.15)', border: '1px solid #FF9900', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'help', animation: 'pulse 2s infinite' }} title={`本机网关 (${alignment.local_ips.join(', ')}) 与当前战区主频段 (${alignment.theater_subnets.join(', ')}) 疑似错位！\n请检查您的 VPN 连接或物理网络环境，谨防在公网对错落目标发射载荷。`}>
            <AlertTriangle size={12} color="#FF9900" />
            <span style={{ fontSize: '11px', color: '#FF9900', fontWeight: 'bold', letterSpacing: '0.5px' }}>拓扑偏离警告</span>
          </div>
        )}

        <div className="cat-tip" style={{ display: 'none', position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '16px 20px', zIndex: 9999, whiteSpace: 'pre', fontFamily: 'Consolas, monospace', fontSize: '13px', lineHeight: '1.4', boxShadow: '0 8px 24px rgba(0,0,0,0.8)', minWidth: '340px' }}>
          <span style={{ color: '#00FFFF' }}>{"         /\\_/\\\n"}</span>
          <span style={{ color: '#00FFFF' }}>{"        ( o.o ) "}</span><span style={{ color: '#FFF', fontWeight: 'bold' }}>Project CLAW</span> <span style={{ color: '#30D158' }}>V9.3</span>{"\n"}
          <span style={{ color: '#00FFFF' }}>{"         > ^ <  "}</span><span style={{ color: '#666' }}>CatTeam Lateral Arsenal Weapon</span>{"\n"}
          <span style={{ color: '#00FFFF' }}>{"        /|   |\\\n"}</span>
          <span style={{ color: '#00FFFF' }}>{"       (_|   |_) "}</span><span style={{ color: '#999' }}>Codename: Lynx</span>
        </div>
      </div>

      <div ref={theaterMenuRef} style={{ position: 'relative', marginLeft: '8px', borderLeft: '1px solid #333', paddingLeft: '12px' }}>
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
      <ProbeHealthIndicator />
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
          {godMode ? <>[!] 上帝模式 (无限制)</> : <>Scope: {scopeList.length} 项</>}
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
              <span>[SCOPE] 作战授权范围</span>
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
      {showCreateTheater && <CreateTheaterModal onClose={() => setShowCreateTheater(false)} onCreated={() => { refreshTheaters().then(() => onRefreshAssets()); setShowCreateTheater(false) }} />}
      {showTheaterConfig && <TheaterConfigModal theater={currentTheater} onClose={() => setShowTheaterConfig(false)} onUpdated={() => { refreshTheaters().then(() => onRefreshAssets()); setShowTheaterConfig(false) }} />}
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

  const mappedView = view === 'HQ' ? 'RC' : view === 'DP' ? 'AT' : view;

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
  AM: ['作战兵器库 (Armory)'],
  C2: ['控制中心 (Sessions)', '监听器 (Listeners)'],
  VS: ['星图拓扑 (Network)', 'ATT&CK 杀伤链'],
}

function CampaignPipeline({ stats }) {
  const [openDropdown, setOpenDropdown] = useState(null)
  
  // V9.3 C4ISR 4阶段侦察-研判管线 (去武器化)
  const steps = [
    { icon: <Target size={16} />, label: '战区锚定', actions: [
      '对目标子网发起存活探测 (fping/Nmap)',
      '枚举 C 段网段分布与拓扑',
      '识别网关与关键基础设施节点'
    ]},
    { icon: <Search size={16} />, label: '服务指纹', actions: [
      '全端口 TCP/UDP 服务版本识别',
      '提取 HTTP/HTTPS 证书与 Web 指纹',
      '识别 SMB/SSH/RDP 等高危协议'
    ]},
    { icon: <Crosshair size={16} />, label: '威胁研判', actions: [
      'AI 综合态势评估与攻击面分析',
      '基于已知 CVE 的风险等级评估',
      '生成优先侦察目标建议清单'
    ]},
    { icon: <FileText size={16} />, label: '战报输出', actions: [
      '导出资产清单 (Markdown/CSV)',
      '生成 PTES 格式渗透测试报告',
      '多次扫描差异对比分析'
    ]}
  ]
  
  // Dynamically compute the active stage based on current stats
  let active = 0
  if (stats) {
    if ((stats.hosts || 0) > 0) active = 1
    if ((stats.ports || 0) > 0) active = 2
    // Stage 3 (威胁研判) and 4 (战报输出) are manual triggers
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
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '12px', background: 'rgba(10,10,10,0.95)', border: `1px solid ${i < active ? '#30D158' : '#00FFFF'}`, borderRadius: '6px', zIndex: 9999, width: '260px', boxShadow: '0 8px 32px rgba(0,0,0,0.9)', padding: '6px 0', textShadow: 'none', fontWeight: 'normal', color: '#D0D0D0', backdropFilter: 'blur(10px)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '6px 14px', fontSize: '10px', color: '#666', marginBottom: '4px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '6px' }}><Crosshair size={10} /> AI Copilot 战术推演</div>
                  {st.actions.map((act, j) => (
                    <div key={j} style={{ padding: '10px 14px', fontSize: '12px', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,255,255,0.1)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'} onClick={() => {
                        window.dispatchEvent(new CustomEvent('claw-exec-cmd', { detail: act }));
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

// [REMOVED] AlfaRadarView — 旧版 SSE 组件已废弃，替换为 RadioRadarPanel (L885)
// RadioRadarPanel 使用 /sensors/wifi/radar 轮询 SQLite，与 Kali 探针数据流对齐


function WorkArea() {
  const stats = useStore(s => s.stats)
  const assets = useStore(s => s.assets)
  const selectedIp = useStore(s => s.selectedIp)
  const view = useStore(s => s.view)
  const onExecCommand = cmd => useStore.getState().setExternalCommand({ id: Date.now(), cmd })

  const [tab, setTab] = useState(0)

  // V9.3: Mission Briefing Pipeline
  const missionBriefing = useStore(s => s.missionBriefing)
  const setMissionBriefing = useStore(s => s.setMissionBriefing)
  const [missionInput, setMissionInput] = useState("")
  const [missionPushStatus, setMissionPushStatus] = useState(null)
  // Initialize input when briefing changes from outside (if any)
  useEffect(() => { setMissionInput(missionBriefing) }, [missionBriefing])

  const submitMission = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/api/v1/mission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefing: missionInput || "待命中... (Waiting for Commander Intent)" })
      })
      const data = await res.json()
      setMissionBriefing(data.current_mission)
      setMissionInput(data.current_mission)
    } catch (e) {
      console.error("Failed to push mission briefing:", e)
    }
  }

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
      
      {/* [V9.3] Commander Top-Down Intent Broadcaster — Enhanced */}
      {(() => {
        const INTENT_CHIPS = [
          { label: '全域资产盘点', intent: '对所有目标子网发起存活探测与服务指纹识别，更新资产基线' },
          { label: '高危端口猎杀', intent: '聚焦 445/3389/22/8080 等高危端口，识别暴露面与弱口令风险' },
          { label: 'Web 攻击面分析', intent: '针对 Web 服务进行目录枚举、指纹识别、已知 CVE 匹配分析' },
          { label: '内网横向侦察', intent: '以已控节点为跳板，对内网 C 段进行 ARP 探测与拓扑绘制' },
          { label: '无线频谱审计', intent: '启动 ALFA 射频探针，捕获周围 AP 握手包与客户端关联信息' },
          { label: '战报整理输出', intent: '停止主动探测，对已有情报进行汇总分析并生成 PTES 格式报告' },
        ]
        const isActive = missionInput && !missionInput.includes('待命中')
        
        const handleMissionSubmit = async () => {
          await submitMission()
          setMissionPushStatus('ok')
          setTimeout(() => setMissionPushStatus(null), 2000)
        }
        
        return (
          <div style={{ background: '#1c1c1e', borderBottom: '1px solid #333', padding: '8px 16px', flexShrink: 0 }}>
            {/* Row 1: Label + Input + Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                {isActive && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#30D158', boxShadow: '0 0 6px #30D158', animation: 'pulse 2s infinite' }} />}
                <span style={{ color: '#0A84FF', fontWeight: 'bold', fontSize: '12px' }}>
                  {isActive ? 'ACTIVE BRIEFING' : 'MISSION BRIEFING'}
                </span>
              </div>
              <input 
                type="text" 
                value={missionInput}
                onChange={e => setMissionInput(e.target.value)}
                placeholder="输入全局战略意图，分发至 AI Copilot 与 Kali 边缘探针..."
                style={{ flex: 1, background: '#000', border: `1px solid ${isActive ? '#0A84FF' : '#333'}`, color: '#0A84FF', padding: '5px 10px', fontSize: '13px', outline: 'none', transition: 'border 0.3s' }}
                onKeyDown={e => e.key === 'Enter' && handleMissionSubmit()}
              />
              <button 
                onClick={handleMissionSubmit}
                style={{ 
                  background: missionPushStatus === 'ok' ? 'rgba(48, 209, 88, 0.2)' : 'rgba(10, 132, 255, 0.15)', 
                  color: missionPushStatus === 'ok' ? '#30D158' : '#0A84FF', 
                  border: `1px solid ${missionPushStatus === 'ok' ? '#30D158' : '#0A84FF'}`, 
                  padding: '5px 14px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 'bold',
                  transition: 'all 0.3s'
                }}
              >
                {missionPushStatus === 'ok' ? '✓ 已下发' : '全域推送'}
              </button>
            </div>
            {/* Row 2: Quick Intent Chips */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              {INTENT_CHIPS.map((chip, i) => (
                <button 
                  key={i}
                  onClick={() => setMissionInput(chip.intent)}
                  style={{ 
                    background: missionInput === chip.intent ? 'rgba(10,132,255,0.15)' : 'transparent', 
                    color: missionInput === chip.intent ? '#0A84FF' : '#666', 
                    border: `1px solid ${missionInput === chip.intent ? '#0A84FF' : '#333'}`, 
                    padding: '3px 10px', fontSize: '10px', cursor: 'pointer', 
                    transition: 'all 0.2s', letterSpacing: '0.3px'
                  }}
                  onMouseOver={e => { if (missionInput !== chip.intent) { e.currentTarget.style.color = '#999'; e.currentTarget.style.borderColor = '#555' }}}
                  onMouseOut={e => { if (missionInput !== chip.intent) { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#333' }}}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )
      })()}
      
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
          {view === 'DP' && ['靶标资产', 'Kali 工具手册'].map((t, i) => (
            <button key={t} className={`terminal-tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
      )}
      
      <div className="tab-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {view === 'HQ' && <ReconOverview stats={stats} assets={assets} asset={asset} onExecCommand={onExecCommand} />}
        {view === 'RF' && <RadioRadarPanel onExecCommand={onExecCommand} />}

        {view === 'DP' && tab === 0 && <AssetTable assets={assets} onExecCommand={onExecCommand} selectedIp={selectedIp} />}
        {view === 'DP' && tab === 1 && <ArmoryViewTab assets={assets} selectedIp={selectedIp} onExecCommand={onExecCommand} />}


        {/* [REMOVED in V9.3] TheaterKanban (VS view) — 伪杀伤链看板已拆除，与 C4ISR 纯态势定位冲突 */}

      </div>
    </div>
  )
}

// V9.3 Sprint 1: Probe Health Indicator for HudBar
function ProbeHealthIndicator() {
  const [health, setHealth] = useState(null)
  useEffect(() => {
    const fetchHealth = () => fetch(`${API}/sensors/health`).then(r => r.json()).then(d => setHealth(d.wifi_probe)).catch(() => {})
    fetchHealth()
    const t = setInterval(fetchHealth, 10000)
    return () => clearInterval(t)
  }, [])
  const status = health?.status || 'offline'
  const dotColor = status === 'online' ? '#30D158' : status === 'delayed' ? '#FF9900' : '#666'
  const label = status === 'online' ? 'ONLINE' : status === 'delayed' ? 'DELAYED' : 'OFFLINE'
  return (
    <div className="stat-item">
      <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, boxShadow: status === 'online' ? `0 0 6px ${dotColor}` : 'none', animation: status === 'online' ? 'pulse 2s infinite' : 'none' }} />
        ALFA 探针
      </span>
      <span className="stat-value" style={{ color: dotColor, fontSize: '11px' }}>{label} ({health?.nodes_count || 0})</span>
    </div>
  )
}

function RadioRadarPanel({ onExecCommand }) {
  const [nodes, setNodes] = useState([])
  const [lastUpdate, setLastUpdate] = useState('')
  const [expandedBssid, setExpandedBssid] = useState(null)
  const [rssiCache, setRssiCache] = useState({})
  const [probeHealth, setProbeHealth] = useState(null)
  const globalTargets = useStore(s => s.globalTargets || [])
  const toggleGlobalTarget = useStore(s => s.toggleGlobalTarget)

  useEffect(() => {
    const fetchRadar = () => {
      fetch(`${API}/sensors/wifi/radar`)
        .then(res => res.json())
        .then(data => {
          const enriched = (data.active_nodes || []).map(node => {
            // V9.3 Ghosting: calculate staleness from last_seen
            let stale = 'live'
            if (node.last_seen) {
              // SQLite CURRENT_TIMESTAMP 返回 UTC，追加 'Z' 确保 JS 按 UTC 解析
              const lastSeenUtc = node.last_seen.endsWith('Z') ? node.last_seen : node.last_seen + 'Z'
              const diff = (Date.now() - new Date(lastSeenUtc).getTime()) / 1000
              if (diff > 300) stale = 'ghost'
              else if (diff > 60) stale = 'fading'
              else if (diff > 10) stale = 'mild'
            }
            return { ...node, stale }
          })
          setNodes(enriched)
          setLastUpdate(new Date().toLocaleTimeString())
          // V9.3: Auto-fetch RSSI for top 10 visible nodes (with 15s TTL cache)
          const now = Date.now()
          enriched.slice(0, 10).forEach(n => {
            const cached = rssiCache[n.bssid]
            const lastFetch = cached?._ts || 0
            if (!cached || (now - lastFetch > 15000)) {
              fetch(`${API}/sensors/wifi/rssi_history?bssid=${encodeURIComponent(n.bssid)}&limit=20`)
                .then(r => r.json())
                .then(d => setRssiCache(prev => ({ ...prev, [n.bssid]: { data: d.history || [], _ts: Date.now() } })))
                .catch(() => {})
            }
          })
        })
        .catch(console.error)
    }
    const fetchHealth = () => {
      fetch(`${API}/sensors/health`).then(r => r.json()).then(d => setProbeHealth(d.wifi_probe)).catch(() => {})
    }
    fetchRadar()
    fetchHealth()
    const timer = setInterval(fetchRadar, 3000)
    const healthTimer = setInterval(fetchHealth, 10000)
    return () => { clearInterval(timer); clearInterval(healthTimer) }
  }, [])

  // V9.3: Fetch RSSI history for sparkline when a row is expanded
  useEffect(() => {
    if (expandedBssid && !rssiCache[expandedBssid]?.data) {
      fetch(`${API}/sensors/wifi/rssi_history?bssid=${encodeURIComponent(expandedBssid)}&limit=20`)
        .then(r => r.json())
        .then(d => setRssiCache(prev => ({ ...prev, [expandedBssid]: { data: d.history || [], _ts: Date.now() } })))
        .catch(() => {})
    }
  }, [expandedBssid])

  // V9.3: Inline SVG Sparkline component
  const Sparkline = ({ data }) => {
    if (!data || data.length < 2) return <span style={{ color: '#666', fontSize: '10px' }}>数据不足</span>
    const values = data.map(d => d.signal_strength)
    const min = Math.min(...values), max = Math.max(...values)
    const range = max - min || 1
    const w = 120, h = 28
    const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
    return (
      <svg width={w} height={h} style={{ verticalAlign: 'middle' }}>
        <polyline points={points} fill="none" stroke="#00FFFF" strokeWidth="1.5" opacity="0.8" />
        <circle cx={w} cy={h - ((values[values.length - 1] - min) / range) * h} r="2.5" fill="#00FFFF" />
      </svg>
    )
  }

  // V9.3: Encryption color logic
  const encColor = (enc) => {
    if (!enc) return '#666'
    const e = enc.toUpperCase()
    if (e === 'OPN' || e.includes('WEP')) return '#FF3B30'
    if (e.includes('WPA3')) return '#30D158'
    if (e.includes('WPA2')) return '#FF9900'
    return '#aaa'
  }

  // V9.3: Copy to clipboard helper
  const copyCmd = (cmd, e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(cmd).catch(() => {})
    // Brief visual feedback via the button
    const btn = e.currentTarget
    const orig = btn.textContent
    btn.textContent = '✓ 已复制'
    setTimeout(() => { btn.textContent = orig }, 1200)
  }

  const healthDotColor = probeHealth ? (probeHealth.status === 'online' ? '#30D158' : probeHealth.status === 'delayed' ? '#FF9900' : '#666') : '#444'

  // V9.3: Separate live / ghosted nodes
  const liveNodes = nodes.filter(n => n.stale !== 'ghost')
  const ghostNodes = nodes.filter(n => n.stale === 'ghost')
  const [showGhosts, setShowGhosts] = useState(false)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ color: '#00FFFF', fontSize: '14px', fontWeight: 'bold' }}>[RF] 态势感知雷达</span>
          <span style={{ color: '#666', fontSize: '10px', marginLeft: '8px' }}>边缘探针 ALFA 网卡 | 3s 自动刷新</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: healthDotColor, boxShadow: probeHealth?.status === 'online' ? `0 0 6px ${healthDotColor}` : 'none' }} />
            探针: {probeHealth?.status || 'unknown'} ({probeHealth?.nodes_count || 0} AP)
          </span>
          <span style={{ color: '#30D158', fontSize: '11px', fontFamily: 'monospace' }}>SYNC: {lastUpdate || '...'}</span>
        </div>
      </div>
      
      <div style={{ padding: '0 16px', flex: 1 }}>
        {nodes.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', marginTop: '100px', fontFamily: 'monospace' }}>
            <Radio size={48} opacity={0.2} style={{ marginBottom: '16px' }} />
            <div>NO SIGNAL DETECTED</div>
            <div style={{ fontSize: '11px', marginTop: '8px' }}>请确保 Kali 前线探针 <code>claw_wifi_sensor.py</code> 已上线并正在发送心跳</div>
          </div>
        ) : (
          <>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '140px' }}>信号 / RSSI</th>
                <th>BSSID</th>
                <th>ESSID</th>
                <th>CH</th>
                <th>加密</th>
                <th>状态</th>
                <th>Kali 参考</th>
              </tr>
            </thead>
            <tbody>
              {liveNodes.map(node => {
                const pwr = node.power;
                let color = '#30D158';
                if (pwr > -60) color = '#FF3B30';
                else if (pwr > -80) color = '#FF9900';
                
                const isSelected = globalTargets.includes(node.bssid);
                const isExpanded = expandedBssid === node.bssid;
                const staleOpacity = node.stale === 'fading' ? 0.35 : node.stale === 'mild' ? 0.6 : 1;
                const staleBorder = node.stale === 'fading' ? '1px dashed #333' : 'none';
                
                return (
                  <React.Fragment key={node.bssid}>
                    <tr style={{ background: isSelected ? 'rgba(0, 255, 255, 0.1)' : 'transparent', cursor: 'pointer', transition: 'all 0.4s', opacity: staleOpacity, borderBottom: staleBorder }} onClick={() => setExpandedBssid(isExpanded ? null : node.bssid)}>
                      <td style={{ color: color, fontWeight: 'bold' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{isSelected ? '✓' : ''} {pwr}</span>
                          <Sparkline data={rssiCache[node.bssid]?.data} />
                        </div>
                      </td>
                      <td style={{ color: '#00FFFF', fontFamily: 'monospace', fontSize: '11px' }}>{node.bssid}</td>
                      <td style={{ color: '#fff' }}>{node.essid === '<HIDDEN>' ? <span style={{ color: '#666', fontStyle: 'italic' }}>隐藏网域</span> : node.essid}</td>
                      <td style={{ color: '#aaa' }}>{node.channel}</td>
                      <td><span style={{ color: encColor(node.encryption), background: `${encColor(node.encryption)}15`, padding: '2px 6px', fontSize: '10px', fontWeight: 'bold' }}>{node.encryption}</span></td>
                      <td><span style={{ fontSize: '10px', color: node.handshake_captured ? '#30D158' : '#666' }}>{node.handshake_captured ? '[CAPTURED]' : '—'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button style={{ background: 'transparent', color: '#00FFFF', border: '1px solid #333', padding: '2px 8px', cursor: 'pointer', fontSize: '10px', transition: 'all 0.2s' }} onClick={(e) => copyCmd(`sudo airodump-ng --bssid ${node.bssid} -c ${node.channel} -w capture wlan0mon`, e)}>
                            ▸ 锁频
                          </button>
                          <button style={{ background: 'transparent', color: '#FF9900', border: '1px solid #333', padding: '2px 8px', cursor: 'pointer', fontSize: '10px', transition: 'all 0.2s' }} onClick={(e) => copyCmd(`sudo aireplay-ng --deauth 10 -a ${node.bssid} wlan0mon`, e)}>
                            ▸ Deauth
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: 'rgba(0,255,255,0.03)' }}>
                        <td colSpan="7" style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '32px', alignItems: 'center', fontSize: '11px' }}>
                            <div><span style={{ color: '#666' }}>制造商:</span> <span style={{ color: '#ccc' }}>{node.manufacturer || '未知'}</span></div>
                            <div><span style={{ color: '#666' }}>客户端:</span> <span style={{ color: '#ccc' }}>{node.clients_count || 0}</span></div>
                            <div><span style={{ color: '#666' }}>首次发现:</span> <span style={{ color: '#ccc' }}>{node.first_seen || '—'}</span></div>
                            <div><span style={{ color: '#666' }}>最后活跃:</span> <span style={{ color: '#ccc' }}>{node.last_seen || '—'}</span></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>

          {/* V9.3 Ghosting: Collapsed archive for ghost nodes */}
          {ghostNodes.length > 0 && (
            <div style={{ margin: '8px 0', borderTop: '1px dashed #333', paddingTop: '8px' }}>
              <div style={{ cursor: 'pointer', color: '#666', fontSize: '11px', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowGhosts(g => !g)}>
                <span>{showGhosts ? '▼' : '▶'}</span>
                <span>历史残影 ({ghostNodes.length} 个已断联 AP)</span>
              </div>
              {showGhosts && ghostNodes.map(node => (
                <div key={node.bssid} style={{ display: 'flex', gap: '16px', padding: '4px 8px', opacity: 0.3, fontSize: '11px', fontFamily: 'monospace', borderBottom: '1px dashed #1a1a1a' }}>
                  <span style={{ color: '#666' }}>{node.power} dBm</span>
                  <span style={{ color: '#444' }}>{node.bssid}</span>
                  <span style={{ color: '#555' }}>{node.essid}</span>
                  <span style={{ color: '#444' }}>CH {node.channel}</span>
                  <span style={{ color: '#555' }}>{node.encryption}</span>
                  <span style={{ color: '#444', marginLeft: 'auto' }}>最后: {node.last_seen}</span>
                </div>
              ))}
            </div>
          )}
          </>
        )}
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
          <button style={{ background: 'transparent', color: '#FF9900', border: '1px solid #FF9900', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }} onClick={() => onExecCommand("请调用 tcpdump/tshark 监听并解析当前局域网内的 UDP/ARP 隐蔽广播探测数据包（约1分钟），不要主动发包，分析潜在的隐藏 IoT 设备或私有云节点。")} onMouseOver={e => e.currentTarget.style.background='rgba(255,153,0,0.1)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
            <Radio size={14} /> 隐蔽广播嗅探
          </button>
          <button style={{ background: 'transparent', color: '#FF3B30', border: '1px solid #FF3B30', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }} onClick={() => {
            if (window.confirm("[!] 警告：系统将抹杀所有超过 48 小时未回应的机器。\n\n如果您最近 48 小时内没有重新发起过全域探测（点名盘点），\n此举可能会清空大盘！强烈建议清理前先跑一遍探测。\n\n确认执行 48H 静默残影物理剔除吗？")) {
                fetch(`${API}/assets/cleanup`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({inactive_hours: 48}) })
                  .then(r=>r.json()).then(d=>{
                    if(d.status === 'ok') { 
                      alert(`清理成功！共分离 ${d.deleted_count} 台物理离线/幽灵节点.`); 
                      // Trigger data flush
                      window.__claw_refresh_assets?.()
                    }
                }).catch(console.error);
            }
          }} onMouseOver={e => e.currentTarget.style.background='rgba(255,59,48,0.1)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
            <Trash2 size={14} /> 清除 48H 残影
          </button>
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
            <th>威胁评级</th>
            <th>AI 研判</th>
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
                  <button style={{ background: '#222', color: '#FF9900', border: '1px solid #333', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', transition: 'background 0.2s', whiteSpace: 'nowrap' }} onClick={() => onExecCommand(`请对目标资产 ${a.ip} 进行安全态势研判分析：列出开放端口的风险等级、潜在攻击面、建议的侦察方向。`)} onMouseOver={e => e.currentTarget.style.background = '#333'} onMouseOut={e => e.currentTarget.style.background = '#222'}>
                    AI 研判
                  </button>
                </td>
              </tr>
              {expandedIp === a.ip && (
                <tr key={a.ip + '_detail'}>
                  <td colSpan="7" style={{ padding: 0 }}>
                    <div style={{ background: 'rgba(0,255,255,0.03)', padding: '12px 16px', borderTop: '1px dashed #333', borderBottom: '1px dashed #333' }}>
                      {/* Section 1: Port Details (full width) */}
                      <div style={{ marginBottom: '12px' }}>
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

                      {/* Section 2: Kali Reference Commands (grid with descriptions + copy toast) */}
                      <div style={{ fontSize: '11px', color: '#FF9900', marginBottom: '8px', fontWeight: 'bold' }}>-- Kali 执行端参考指令 --</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px' }}>
                        {/* Context-aware suggestions based on detected ports */}
                        {a.ports.some(p => [80, 443, 8080, 8443].includes(p.port)) && <>
                          {[{icon: Search, name: 'Nuclei', desc: '基于模板的批量漏洞扫描', cmd: `nuclei -u http://${a.ip} -severity medium,high,critical`},
                            {icon: Globe, name: 'Nikto', desc: 'Web 服务器配置缺陷检测', cmd: `nikto -h http://${a.ip}`},
                            {icon: Bug, name: 'SQLMap', desc: 'SQL 注入自动化检测', cmd: `sqlmap -u "http://${a.ip}/" --batch --crawl=2`}].map(t => {
                            const Icon = t.icon;
                            return <button key={t.name} style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '2px' }}
                              onClick={(e) => { navigator.clipboard.writeText(t.cmd); const b = e.currentTarget; b.style.borderColor = '#00FFFF'; const orig = b.querySelector('.cmd-hint').textContent; b.querySelector('.cmd-hint').textContent = '✓ 已复制到剪贴板'; setTimeout(() => { b.style.borderColor = '#222'; b.querySelector('.cmd-hint').textContent = orig }, 1200) }}
                              onMouseOver={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#151515' }}
                              onMouseOut={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.background = '#111' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00FFFF', fontSize: '11px', fontWeight: 'bold' }}><Icon size={11} /> {t.name}</div>
                              <div style={{ color: '#666', fontSize: '9px' }}>{t.desc}</div>
                              <div className="cmd-hint" style={{ color: '#444', fontSize: '9px', fontFamily: 'monospace', marginTop: '2px' }}>$ {t.cmd.substring(0, 40)}...</div>
                            </button>
                          })}
                        </>}
                        {a.ports.some(p => p.port === 445) && <>
                          {[{icon: Lock, name: 'Impacket SMB', desc: '匿名/凭据 SMB 连接探测', cmd: `impacket-smbclient ${a.ip} -no-pass`},
                            {icon: ClipboardList, name: 'enum4linux', desc: '域用户/共享/策略枚举', cmd: `enum4linux -a ${a.ip}`}].map(t => {
                            const Icon = t.icon;
                            return <button key={t.name} style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '2px' }}
                              onClick={(e) => { navigator.clipboard.writeText(t.cmd); const b = e.currentTarget; b.style.borderColor = '#00FFFF'; const orig = b.querySelector('.cmd-hint').textContent; b.querySelector('.cmd-hint').textContent = '✓ 已复制到剪贴板'; setTimeout(() => { b.style.borderColor = '#222'; b.querySelector('.cmd-hint').textContent = orig }, 1200) }}
                              onMouseOver={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#151515' }}
                              onMouseOut={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.background = '#111' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00FFFF', fontSize: '11px', fontWeight: 'bold' }}><Icon size={11} /> {t.name}</div>
                              <div style={{ color: '#666', fontSize: '9px' }}>{t.desc}</div>
                              <div className="cmd-hint" style={{ color: '#444', fontSize: '9px', fontFamily: 'monospace', marginTop: '2px' }}>$ {t.cmd}</div>
                            </button>
                          })}
                        </>}
                        {a.ports.some(p => p.port === 22) &&
                          <button style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '2px' }}
                            onClick={(e) => { navigator.clipboard.writeText(`hydra -L users.txt -P pass.txt ssh://${a.ip}`); const b = e.currentTarget; b.style.borderColor = '#00FFFF'; const orig = b.querySelector('.cmd-hint').textContent; b.querySelector('.cmd-hint').textContent = '✓ 已复制到剪贴板'; setTimeout(() => { b.style.borderColor = '#222'; b.querySelector('.cmd-hint').textContent = orig }, 1200) }}
                            onMouseOver={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#151515' }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.background = '#111' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00FFFF', fontSize: '11px', fontWeight: 'bold' }}><KeyRound size={11} /> Hydra SSH</div>
                            <div style={{ color: '#666', fontSize: '9px' }}>SSH 登录凭据在线爆破</div>
                            <div className="cmd-hint" style={{ color: '#444', fontSize: '9px', fontFamily: 'monospace', marginTop: '2px' }}>{`$ hydra ... ssh://${a.ip}`}</div>
                          </button>
                        }
                        {a.ports.some(p => p.port === 3389) &&
                          <button style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '2px' }}
                            onClick={(e) => { navigator.clipboard.writeText(`nmap --script rdp-vuln-ms12-020 -p 3389 ${a.ip}`); const b = e.currentTarget; b.style.borderColor = '#00FFFF'; const orig = b.querySelector('.cmd-hint').textContent; b.querySelector('.cmd-hint').textContent = '✓ 已复制到剪贴板'; setTimeout(() => { b.style.borderColor = '#222'; b.querySelector('.cmd-hint').textContent = orig }, 1200) }}
                            onMouseOver={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#151515' }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.background = '#111' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00FFFF', fontSize: '11px', fontWeight: 'bold' }}><Monitor size={11} /> RDP 漏洞检测</div>
                            <div style={{ color: '#666', fontSize: '9px' }}>MS12-020 远程桌面漏洞扫描</div>
                            <div className="cmd-hint" style={{ color: '#444', fontSize: '9px', fontFamily: 'monospace', marginTop: '2px' }}>{`$ nmap --script rdp-vuln... ${a.ip}`}</div>
                          </button>
                        }
                        {/* Universal tools - always shown */}
                        <button style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '2px' }}
                          onClick={(e) => { navigator.clipboard.writeText(`nmap -sV -sC -O ${a.ip}`); const b = e.currentTarget; b.style.borderColor = '#00FFFF'; const orig = b.querySelector('.cmd-hint').textContent; b.querySelector('.cmd-hint').textContent = '✓ 已复制到剪贴板'; setTimeout(() => { b.style.borderColor = '#222'; b.querySelector('.cmd-hint').textContent = orig }, 1200) }}
                          onMouseOver={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#151515' }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.background = '#111' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#30D158', fontSize: '11px', fontWeight: 'bold' }}><Radar size={11} /> Nmap 深度扫描</div>
                          <div style={{ color: '#666', fontSize: '9px' }}>端口 + 服务版本 + OS 指纹</div>
                          <div className="cmd-hint" style={{ color: '#444', fontSize: '9px', fontFamily: 'monospace', marginTop: '2px' }}>{`$ nmap -sV -sC -O ${a.ip}`}</div>
                        </button>
                        <button style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '2px' }}
                          onClick={(e) => { navigator.clipboard.writeText(`msfconsole -q -x "use auxiliary/scanner/portscan/tcp; set RHOSTS ${a.ip}; run; exit"`); const b = e.currentTarget; b.style.borderColor = '#FF3B30'; const orig = b.querySelector('.cmd-hint').textContent; b.querySelector('.cmd-hint').textContent = '✓ 已复制到剪贴板'; setTimeout(() => { b.style.borderColor = '#222'; b.querySelector('.cmd-hint').textContent = orig }, 1200) }}
                          onMouseOver={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#151515' }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.background = '#111' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FF3B30', fontSize: '11px', fontWeight: 'bold' }}><Skull size={11} /> Metasploit</div>
                          <div style={{ color: '#666', fontSize: '9px' }}>MSF 辅助模块端口扫描</div>
                          <div className="cmd-hint" style={{ color: '#444', fontSize: '9px', fontFamily: 'monospace', marginTop: '2px' }}>$ msfconsole -q -x "..."</div>
                        </button>
                        <button style={{ background: '#111', border: '1px solid #FF990030', borderRadius: '4px', padding: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '2px' }}
                          onClick={() => onExecCommand(`请对目标资产 ${a.ip} 进行安全态势研判分析：列出开放端口的风险等级、潜在攻击面、建议的侦察方向。`)}
                          onMouseOver={e => { e.currentTarget.style.borderColor = '#FF9900'; e.currentTarget.style.background = '#151515' }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = '#FF990030'; e.currentTarget.style.background = '#111' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FF9900', fontSize: '11px', fontWeight: 'bold' }}><Crosshair size={11} /> AI 研判分析</div>
                          <div style={{ color: '#666', fontSize: '9px' }}>Gemini 综合态势评估与建议</div>
                          <div className="cmd-hint" style={{ color: '#FF990060', fontSize: '9px', marginTop: '2px' }}>▸ 发送至 AI Copilot 面板</div>
                        </button>
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

// [REMOVED in V9.3] XTermConsole — SSH 进 Kali 用原生终端更好


function ArmoryViewTab({ assets, selectedIp, onExecCommand }) {
  // Global Multi-Select Hub
  const globalTargets = useStore(s => s.globalTargets)
  const [expanded, setExpanded] = useState(null) // track expanded card key

  const armoryData = [
    {
      cat: '侦察 (Recon)', color: '#00FFFF', mods: [
        { label: '存活探测', desc: 'fping/ping 目标存活心跳扫描', cmd: 'make fast',
          usage: '快速判定目标 IP/子网内哪些主机在线。适合渗透初期大范围筛选。',
          input: '目标 IP 或 CIDR 子网 (如 192.168.1.0/24)',
          output: '存活主机列表 → 自动写入 claw.db assets 表',
          ttp: 'T1018 Remote System Discovery' },
        { label: 'Nmap 深扫', desc: '全端口 TCP/UDP 指纹探测', cmd: 'nmap -sV -sC -O',
          usage: '对单个目标进行深度端口扫描 + 服务版本识别 + OS 指纹检测。耗时较长但信息最全。',
          input: '目标 IP (如 192.168.1.100)',
          output: 'XML 扫描报告 → 用 make parse 导入数据库 → HQ 大屏可视',
          ttp: 'T1046 Network Service Discovery' },
        { label: '服务识别', desc: '低频协议报文特征提取', cmd: 'make probe',
          usage: '对已发现端口进行细粒度协议握手探测，获取 Banner 和版本号。',
          input: '已有扫描结果中的 IP:Port 列表',
          output: '服务版本详情更新到 ports 表的 product/version 字段',
          ttp: 'T1046 Network Service Discovery' },
        { label: '结果解析', desc: 'Nmap XML 解析写入数据库', cmd: 'make parse',
          usage: '将 Nmap 生成的 XML 输出文件解析并批量导入 CLAW 资产大盘。',
          input: 'CatTeam_Loot/ 下的 .xml 扫描文件',
          output: '资产、端口、OS 信息落库 → HQ 指挥座舱实时刷新',
          ttp: 'T1018 Remote System Discovery' },
        { label: 'Gobuster', desc: '目录/DNS/VHost 高速枚举', cmd: 'gobuster dir -u http://<TARGET> -w /usr/share/wordlists/dirb/common.txt',
          usage: '对 Web 服务进行目录遍历，发现隐藏路径如 /admin、/backup 等。',
          input: '目标 URL + 字典文件路径',
          output: '发现的有效路径列表（HTTP 200/301/403 等）',
          ttp: 'T1595.003 Wordlist Scanning' },
        { label: 'FFuf', desc: 'Web Fuzzer 路径与参数爆破', cmd: 'ffuf -u http://<TARGET>/FUZZ -w /usr/share/wordlists/dirb/common.txt',
          usage: 'Fuzz 测试 URL 路径、POST 参数、Header 值等，适合发现隐匿接口。',
          input: '带 FUZZ 占位的 URL + 字典',
          output: '匹配到的有效路径/参数及其响应大小',
          ttp: 'T1595.003 Wordlist Scanning' },
        { label: 'enum4linux', desc: 'Windows/Samba 信息枚举', cmd: 'enum4linux -a',
          usage: '枚举 Windows 域/Samba 共享的用户、组、策略、共享目录等信息。',
          input: '目标 IP（需开放 139/445 端口）',
          output: '域用户列表、共享目录、密码策略等情报',
          ttp: 'T1087 Account Discovery' },
      ]
    },
    {
      cat: '漏洞利用 (Exploit)', color: '#FF3B30', mods: [
        { label: 'Nuclei', desc: '模板驱动漏洞批量扫描', cmd: 'nuclei -u http://<TARGET>',
          usage: '基于 YAML 模板的快速漏洞扫描器，支持 CVE/CNVD 等数千种检测。',
          input: '目标 URL 或 URL 列表文件',
          output: '漏洞匹配结果（含严重等级、CVE 编号、修复建议）',
          ttp: 'T1190 Exploit Public-Facing Application' },
        { label: 'Nikto', desc: 'Web 服务器安全扫描器', cmd: 'nikto -h http://<TARGET>',
          usage: '检测 Web 服务器配置缺陷、过时版本、默认页面、XSS 等。',
          input: '目标 URL',
          output: '安全缺陷条目列表（含 OSVDB 编号）',
          ttp: 'T1595.002 Vulnerability Scanning' },
        { label: 'SQLMap', desc: 'SQL 注入自动化检测利用', cmd: 'sqlmap -u "http://<TARGET>/page?id=1"',
          usage: '自动检测并利用 SQL 注入漏洞，支持数据库提取和 OS Shell。',
          input: '含可疑参数的 URL 或 HTTP 请求文件',
          output: '注入类型判定 + 数据库表/列/数据提取结果',
          ttp: 'T1190 Exploit Public-Facing Application' },
        { label: 'Metasploit', desc: 'MSF 世界级渗透框架', cmd: 'msfconsole',
          usage: '集成漏洞利用、Payload 生成、后渗透模块的全链路渗透平台。[!] 交互式工具，需在终端手动使用。',
          input: '手动在 MSF 控制台内选择模块并配置 RHOSTS/LPORT 等',
          output: '成功利用后获得 Meterpreter/Shell 会话',
          ttp: 'T1203 Exploitation for Client Execution' },
      ]
    },
    {
      cat: '密码破解 (Cracking)', color: '#FF9900', mods: [
        { label: 'Hashcat', desc: 'GPU 加速哈希破解引擎', cmd: 'hashcat -m 2500 capture.hccapx /usr/share/wordlists/rockyou.txt',
          usage: '利用 GPU 并行计算暴力破解各种哈希格式（WPA、NTLM、SHA 等）。',
          input: '哈希文件 + 字典文件 (或掩码规则)',
          output: '明文密码（如果命中字典）',
          ttp: 'T1110.002 Password Cracking' },
        { label: 'John', desc: 'John the Ripper 密码破解', cmd: 'john --wordlist=/usr/share/wordlists/rockyou.txt',
          usage: 'CPU 密码破解，支持自动检测哈希格式。适合快速尝试少量哈希。',
          input: '包含哈希的文件（如 /etc/shadow 格式）',
          output: '已破解的用户名:密码对',
          ttp: 'T1110.002 Password Cracking' },
        { label: 'Hydra', desc: '在线多协议暴力破解', cmd: 'hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://<TARGET>',
          usage: '在线爆破登录接口，支持 SSH/FTP/HTTP/SMB 等 50+ 协议。[!] 会产生大量登录日志。',
          input: '目标服务地址 + 用户名 + 字典',
          output: '成功登录的用户名:密码组合',
          ttp: 'T1110.001 Password Guessing' },
        { label: 'Responder', desc: 'LLMNR/NBT-NS 投毒抓哈希', cmd: 'sudo responder -I eth0',
          usage: '在局域网内毒化名称解析请求，捕获 NTLMv2 哈希。需要 root 权限。',
          input: '监听网卡接口名 (如 eth0)',
          output: 'NTLMv2 哈希 → 存入 Responder/logs/ → 转交 Hashcat 破解',
          ttp: 'T1557.001 LLMNR/NBT-NS Poisoning' },
      ]
    },
    {
      cat: '横向移动 (Pivot)', color: '#9D00FF', mods: [
        { label: 'Impacket', desc: 'PsExec/SMBExec 获取 Shell', cmd: 'impacket-psexec domain/user:pass@<TARGET>',
          usage: '利用已获取的凭据通过 SMB 在远程 Windows 主机执行命令。',
          input: '域/用户名:密码@目标IP',
          output: '远程交互式 CMD Shell',
          ttp: 'T1021.002 Remote Services: SMB' },
        { label: 'Kerberoast', desc: 'SPN TGS 提取与离线破解', cmd: 'impacket-GetUserSPNs domain/user:pass -dc-ip <DC_IP> -request',
          usage: '请求域内 SPN 对应的 TGS 票据，导出后离线破解服务账户密码。',
          input: '域凭据 + DC IP',
          output: 'Kerberos TGS 哈希 → 转交 Hashcat -m 13100 破解',
          ttp: 'T1558.003 Kerberoasting' },
        { label: 'SMBClient', desc: 'SMB 共享枚举与文件操作', cmd: 'smbclient -L //<TARGET> -U user',
          usage: '列出远程 SMB 共享目录并进行文件上传下载操作。',
          input: '目标 IP + 用户凭据',
          output: '共享列表 + 文件内容',
          ttp: 'T1021.002 Remote Services: SMB' },
      ]
    },
    {
      cat: '无线与固件 (Wireless/IoT)', color: '#30D158', mods: [
        { label: 'Aircrack-ng', desc: 'WiFi WEP/WPA 破解套件', cmd: 'aircrack-ng -w /usr/share/wordlists/rockyou.txt capture.cap',
          usage: '对抓取到的 WiFi 握手包进行离线字典破解。需先用 airodump-ng 抓包。',
          input: '.cap/.pcap 握手包文件 + 字典',
          output: 'WiFi 明文密码（如果命中字典）',
          ttp: 'T1110.002 Password Cracking' },
        { label: 'Wifite', desc: '无线审计自动化工具', cmd: 'sudo wifite',
          usage: '全自动 WiFi 渗透：扫描 → 抓握手 → 破解，一键完成。需要监听网卡。',
          input: '无线监听网卡（自动检测）',
          output: '已破解的 WiFi ESSID + 密码',
          ttp: 'T1110 Brute Force' },
        { label: 'Binwalk', desc: '固件逆向分析与提取', cmd: 'binwalk -e firmware.bin',
          usage: '从嵌入式设备固件中提取文件系统、密钥、配置文件等。',
          input: '固件二进制文件 (.bin/.img)',
          output: '提取出的文件系统目录树',
          ttp: 'T1592.002 Gather Victim Host Information: Hardware' },
      ]
    },
    {
      cat: 'AI 参谋部 + 报告', color: '#FF9900', mods: [
        { label: 'AI 攻击研判', desc: '大模型靶标分析与链路推演', cmd: 'make ai-analyze',
          usage: '调用 Gemini 对当前战区的资产和端口进行威胁评估和攻击路径推演。',
          input: '当前战区 claw.db 中的资产数据',
          output: 'AI 生成的攻击路径推荐报告',
          ttp: 'TA0043 Reconnaissance' },
        { label: '渗透报告', desc: '基于审计日志自动生成报告', cmd: 'make report',
          usage: '聚合当前战区的扫描结果、漏洞发现、利用记录，生成结构化渗透测试报告。',
          input: 'claw.db + agent_audit.log 数据',
          output: 'Markdown/PDF 格式渗透报告',
          ttp: 'N/A' },
        { label: '差异对比', desc: '多次扫描差异分析', cmd: 'make diff',
          usage: '比较两次扫描结果之间的差异：新增主机、消失端口、变更服务等。',
          input: '两个 scan_id (自动选取最近两次)',
          output: '差异报告（新增/删除/变更项）',
          ttp: 'N/A' },
      ]
    },
  ]

  const copyCmd = (cmd, e) => {
    const target = selectedIp || globalTargets[0] || '<TARGET_IP>'
    const fullCmd = cmd.replace(/<TARGET>/g, target).replace(/<TARGET_IP>/g, target).replace(/<DC_IP>/g, target)
    navigator.clipboard.writeText(fullCmd).catch(() => {})
    const btn = e.currentTarget
    const orig = btn.textContent
    btn.textContent = '✓ 已复制'
    btn.style.color = '#00FFFF'
    setTimeout(() => { btn.textContent = orig; btn.style.color = '' }, 1200)
  }

  return (
    <div style={{ flex: 1, padding: '16px', overflowY: 'auto', minHeight: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '16px', color: '#00FFFF', fontWeight: 'bold' }}>Kali 执行端 · 工具手册 (V9.3)</span>
        <span style={{ fontSize: '10px', color: '#666' }}>
          {armoryData.reduce((s, g) => s + g.mods.length, 0)} 模块已装填 · 点击卡片查看用法 · <span style={{ color: '#FF9900' }}>点 [COPY] 复制命令到 Kali 终端执行</span>
        </span>
      </div>
      {armoryData.map(group => (
        <div key={group.cat} style={{ marginBottom: '20px' }}>
          <div style={{ color: group.color, fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', padding: '4px 10px', background: `${group.color}15`, borderRadius: '4px', display: 'inline-block' }}>{group.cat}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
            {group.mods.map(m => {
              const isOpen = expanded === m.label
              return (
              <div key={m.label} style={{ background: isOpen ? '#0d1117' : '#111', border: `1px solid ${isOpen ? group.color + '60' : '#222'}`, borderRadius: '4px', padding: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setExpanded(isOpen ? null : m.label)}
                onMouseOver={e => { if (!isOpen) { e.currentTarget.style.borderColor = group.color + '40'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}}
                onMouseOut={e => { if (!isOpen) { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.background = '#111' }}}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: group.color, fontWeight: 'bold' }}>{m.label}</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyCmd(m.cmd, e) }}
                    style={{ background: '#222', color: '#888', border: '1px solid #333', padding: '2px 8px', fontSize: '10px', cursor: 'pointer', borderRadius: '3px', transition: 'color 0.2s', whiteSpace: 'nowrap' }}
                    onMouseOver={e => e.currentTarget.style.color = '#00FFFF'}
                    onMouseOut={e => e.currentTarget.style.color = '#888'}
                  >▸ COPY</button>
                </div>
                <div style={{ fontSize: '10px', color: '#666', lineHeight: '1.4', marginTop: '4px' }}>{m.desc}</div>

                {isOpen && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #333', fontSize: '11px', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div><span style={{ color: '#00FFFF', fontWeight: 'bold' }}>▶ 用法：</span><span style={{ color: '#aaa' }}>{m.usage}</span></div>
                    <div><span style={{ color: '#30D158', fontWeight: 'bold' }}>▸ 输入：</span><span style={{ color: '#aaa' }}>{m.input}</span></div>
                    <div><span style={{ color: '#FF9900', fontWeight: 'bold' }}>◂ 输出：</span><span style={{ color: '#aaa' }}>{m.output}</span></div>
                    {m.ttp && m.ttp !== 'N/A' && (
                      <div><span style={{ color: '#9D00FF', fontWeight: 'bold' }}>✧ ATT&CK：</span><span style={{ color: '#777' }}>{m.ttp}</span></div>
                    )}
                    <div style={{ marginTop: '4px', padding: '6px 8px', background: '#0a0a0a', border: '1px solid #222', borderRadius: '3px', fontFamily: 'monospace', fontSize: '10px', color: '#00FFFF', wordBreak: 'break-all' }}>
                      $ {m.cmd}
                    </div>
                  </div>
                )}

                {!isOpen && (
                  <div style={{ fontSize: '9px', color: '#444', marginTop: '8px', fontFamily: 'monospace' }}>$ {m.cmd}</div>
                )}
              </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// [REMOVED in V9.3] SliverViewTab — 无实际 C2 数据源


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
                 <iframe srcDoc={result.html} style={{ width: '100%', border: '1px solid #333', background: '#fff', minHeight: '400px' }} title="Live Render" sandbox="allow-scripts"/>
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
               <div style={{ color: '#FF9900', fontSize: '11px' }}>[ 攻击路径推演 ]</div>
               <button 
                 onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`nmap -sV -sC -O ${a.ip}`); const b = e.currentTarget; b.textContent = '✓ Nmap 命令已复制'; setTimeout(() => b.textContent = '▸ 复制 Nmap 深扫命令', 1200) }}
                 style={{ background: '#222', color: '#00FFFF', border: '1px solid #333', padding: '3px 8px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: 0 }}>
                 ▸ 复制 Nmap 深扫命令
               </button>
            </div>
            <div style={{ background: '#111', padding: '12px', color: '#666', fontSize: '10px', border: '1px solid #222', borderRadius: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <CognitiveGraphRenderer targetIp={a.ip} />
            </div>
            <div style={{ marginTop: '8px', color: '#444', fontSize: '9px', textAlign: 'right' }}>Powered by Gemini 3.1 Pro // Structured Output</div>
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
      {/* [REMOVED in V9.3] A2UIForgeModal - /agent/forge 端点已删除 */}
    </>
  )
}



// [REMOVED in V9.3] AttackMatrixView — 无数据驱动，纯静态展示

// ========== AI COPILOT PANEL ==========
const MODELS = [
  { key: 'flash', label: 'Flash', color: '#00FFFF', desc: '极速执行 (自动升级思考)' },
  { key: 'think', label: 'Think', color: '#30D158', desc: '深度推理分析' },
  { key: 'pro', label: 'Pro', color: '#FF9900', desc: '最强模型' },
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
  const [model, setModel] = useState(MODELS[0])  // 默认 Flash 引擎
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
      role: 'ai', text: '', tools: [], model: model.label, thinking: true, startTs: Date.now(),
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
              toolCalls.push({ id: data.id || Math.random().toString(36).substr(2, 9), name: data.name, args: data.args, risk: data.risk_level || 'green', status: 'running' })
              // V9.3: 同步推送到 OUTPUT LOGS 监控台
              window.dispatchEvent(new CustomEvent('CLAW_MCP_LOG', { detail: { level: 'SYS', text: `[MCP] ${data.risk_level?.toUpperCase() || 'GREEN'} >> ${data.name}(${JSON.stringify(data.args || {}).substring(0, 120)})` } }))
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
              // V9.3: 推送工具执行结果到 OUTPUT LOGS
              const statusIcon = data.status === 'success' ? '+' : 'x';
              const previewText = data.preview ? `\n${data.preview}` : '';
              window.dispatchEvent(new CustomEvent('CLAW_MCP_LOG', { detail: { level: data.status === 'success' ? 'OUT' : 'ERR', text: `[${statusIcon}] ${data.name} → ${data.status}${previewText}` } }))
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
                if (last?.role === 'ai') { last.thinking = false; last.done = true; last.endTs = Date.now() }
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

  const stopStream = () => {
    if (abortRef.current) abortRef.current.abort()
    setStreaming(false)
    // 同时杀掉后端可能正在运行的子进程
    fetch(`http://${window.location.hostname}:8000/api/v1/agent/cancel`, { method: 'POST', body: JSON.stringify({}) }).catch(() => {})
    // 标记最后一条 AI 消息为已完成
    setMessages(prev => {
      const msgs = [...prev]; const last = msgs[msgs.length - 1]
      if (last?.role === 'ai') { last.thinking = false; last.done = true; last.endTs = Date.now() }
      return msgs
    })
  }
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
                <div className="ai-identity" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>✧ {m.model || model.label} 引擎</span>
                  {m.endTs && m.startTs && <span style={{ color: '#666', fontSize: '10px' }}>Worked for {Math.round((m.endTs - m.startTs) / 1000)}s</span>}
                </div>
                {m.thinking && (
                  <div className="thinking-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Loader2 size={12} className="spin" style={{ color: '#00FFFF' }} />
                    <span style={{ color: '#888', fontSize: '12px' }}>{m.thinkingStatus || 'Lynx 正在思考...'}</span>
                  </div>
                )}
                {m.tools?.length > 0 && (
                  <details open={m.tools.some(t => t.status === 'running')} style={{ marginBottom: '12px' }}>
                    <summary style={{ outline: 'none', cursor: 'pointer', fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Bot size={12} /> {m.tools.some(t => t.status === 'running') ? `Executing ${m.tools.length} commands...` : `Explored ${m.tools.length} commands`}
                    </summary>
                    <div style={{ paddingLeft: '8px', borderLeft: '2px solid #222', marginTop: '6px' }}>
                      {m.tools.map((tc, j) => <ToolCallCard key={j} tool={tc} />)}
                    </div>
                  </details>
                )}
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
                    AUTO
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
    claw_execute_shell: '执行命令',
    claw_run_module: '模块调用',
    claw_sliver_execute: '远控指令',
    claw_delegate_agent: 'A2A 子智能体委派',
  }
  const cnName = TOOL_CN[tool.name] || ''
  const isRunning = tool.status === 'running'
  
  // 主动拉取活动日志
  const [activeLog, setActiveLog] = useState('')
  useEffect(() => {
    if (!isRunning) return
    const timer = setInterval(() => {
      fetch(`http://${window.location.hostname}:8000/api/v1/agent/active_log`)
        .then(r => r.json())
        .then(d => { if (d.log) setActiveLog(d.log) })
        .catch(() => {})
    }, 800)
    return () => clearInterval(timer)
  }, [isRunning])
  const [cancelling, setCancelling] = useState(false)

  const handleCancel = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setCancelling(true)
    try {
      await fetch(`http://${window.location.hostname}:8000/api/v1/agent/cancel`, { method: 'POST', body: JSON.stringify({}) })
    } catch(err) {}
  }

  return (
    <details open={isRunning || tool.status === 'error' || tool.status === 'failed'} style={{
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
        <span style={{ color: (tool.status === 'ok' || tool.status === 'success') ? '#30D158' : (tool.status === 'error' || tool.status === 'failed') ? '#FF3B30' : '#D0D0D0', fontSize: '10px', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isRunning ? <><Loader2 size={11} className="spin" /> 运行中</> : (tool.status === 'ok' || tool.status === 'success') ? '> 完成' : (tool.status === 'error' || tool.status === 'failed') ? 'x 失败' : tool.status === 'blocked' ? '⏸ 待审批' : tool.status}
          {isRunning && <button onClick={handleCancel} disabled={cancelling} style={{ background: cancelling ? '#333' : 'transparent', border: `1px solid ${cancelling ? '#666' : '#FF3B30'}`, color: cancelling ? '#666' : '#FF3B30', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', cursor: cancelling ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>{cancelling ? 'Cancelling...' : 'Cancel'}</button>}
        </span>
      </summary>
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #333' }}>
        {tool.args && Object.entries(tool.args).map(([k, v]) => (
          <div key={k} style={{ marginBottom: '4px' }}>
            <span style={{ color: '#999' }}>{k}:</span> <span style={{ color: '#D0D0D0' }}>{v}</span>
          </div>
        ))}
        {/* Inline Terminal Block for active execution */}
        {(isRunning && activeLog) && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ color: '#00FFFF', background: '#050505', border: '1px solid #333', padding: '8px', borderRadius: '4px', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto', fontSize: '11px', lineHeight: '1.4', fontFamily: 'Consolas', userSelect: 'text' }}>
              {activeLog}
            </div>
          </div>
        )}
        {/* Preview for finished execution */}
        {(!isRunning && tool.preview) && (
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
          <div key={i} className="markdown-body" style={{ margin: '8px 0', lineHeight: '1.6' }}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({node, ...props}) => <h1 style={{fontSize: '16px', color: '#FF9900', marginTop: '16px', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px'}} {...props} />,
                h2: ({node, ...props}) => <h2 style={{fontSize: '14px', color: '#00FFFF', marginTop: '14px', marginBottom: '6px'}} {...props} />,
                h3: ({node, ...props}) => <h3 style={{fontSize: '13px', color: '#D0D0D0', marginTop: '12px', marginBottom: '4px'}} {...props} />,
                strong: ({node, ...props}) => <strong style={{color: '#FFF'}} {...props} />,
                ul: ({node, ...props}) => <ul style={{paddingLeft: '16px', margin: '4px 0', listStyleType: 'disc'}} {...props} />,
                ol: ({node, ...props}) => <ol style={{paddingLeft: '16px', margin: '4px 0', listStyleType: 'decimal'}} {...props} />,
                li: ({node, ...props}) => <li style={{marginBottom: '4px'}} {...props} />,
                table: ({node, ...props}) => <div style={{overflowX: 'auto'}}><table className="data-table" style={{margin: '12px 0'}} {...props} /></div>,
                tr: ({node, ...props}) => <tr {...props} />,
                th: ({node, ...props}) => <th {...props} />,
                td: ({node, ...props}) => <td {...props} />,
                p: ({node, ...props}) => <p style={{margin: '8px 0', lineHeight: '1.6'}} {...props} />,
                a: ({node, ...props}) => <a href={props.href} target="_blank" rel="noreferrer" style={{color: '#00FFFF', textDecoration: 'underline'}} {...props} />,
                code: ({node, inline, ...props}) => inline ? <code style={{background: '#1A1A1A', padding: '2px 4px', color: '#FF9900', borderRadius: '3px'}} {...props} /> : <code {...props} />
              }}
            >
              {seg.content}
            </ReactMarkdown>
          </div>
        )
      })}
      {!done && segments.length > 0 && segments[segments.length-1].type === 'text' && <span className="typing-cursor"></span>}
    </div>
  )
}

// [REMOVED in V9.3] DockerPanel — Kali VM 替代 Docker



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

    // V9.3: 同时监听来自 AI Copilot 的 MCP 工具调用日志
    const handleMcpLog = (e) => {
      const { text, level } = e.detail || {}
      if (text) {
        setLogs(prev => [...prev.slice(-499), { time: new Date().toLocaleTimeString(), level: level || 'OUT', msg: text }])
      }
    }

    window.addEventListener('CLAW_START_SSE_LOG', handleStartLog)
    window.addEventListener('CLAW_MCP_LOG', handleMcpLog)
    return () => {
      window.removeEventListener('CLAW_START_SSE_LOG', handleStartLog)
      window.removeEventListener('CLAW_MCP_LOG', handleMcpLog)
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
    <div ref={containerRef} style={{ background: '#050505', color: '#D0D0D0', fontSize: '12px', fontFamily: '"Cascadia Code", Consolas, monospace', padding: '12px 16px', overflowY: 'auto', height: '100%', lineHeight: '1.6', whiteSpace: 'pre-wrap', letterSpacing: '0.2px' }}>
      <div style={{ color: '#00FFFF', fontWeight: 'bold', borderBottom: '1px dashed #333', paddingBottom: '8px', marginBottom: '12px' }}>
        ✧ MCP 工具调用监控台 (Tool Execution Monitor)
      </div>
      {!activeJob && logs.length === 0 && (
        <div style={{ color: '#666', fontStyle: 'italic', marginTop: '12px' }}>
          等待 AI Copilot 调用 MCP 工具... (在右侧 Copilot 面板发送指令)
        </div>
      )}
      {logs.map((l, i) => (
        <div key={i} style={{ display: 'flex', marginBottom: '4px' }}>
          <span style={{ color: l.level === 'SYS' ? '#00FFFF' : l.level === 'ERR' ? '#FF3B30' : '#888', marginRight: '10px', minWidth: '40px', userSelect: 'none' }}>
            {l.level === 'OUT' ? '  |' : `[${l.level}]`}
          </span>
          <span style={{ color: l.level === 'ERR' ? '#FF6B6B' : l.level === 'SYS' ? '#00FFFF' : '#C0C0C0', wordBreak: 'break-all' }}>
            {l.msg}
          </span>
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
          <span style={{ cursor: 'pointer', padding: '4px 0', color: '#00FFFF', fontWeight: 'bold', borderBottom: '2px solid #00FFFF', letterSpacing: '0.5px' }}>OUTPUT LOGS</span>
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
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: '#050505' }}>
        <OutputConsole />
      </div>
    </div>
  )
}


// ========== MAIN APP ==========
// [REMOVED in V9.3] MemoXTerm 已删除

function App() {
  const currentTheater = useStore(state => state.currentTheater)
  const setStats = useStore(state => state.setStats)
  const setAssets = useStore(state => state.setAssets)
  const view = useStore(state => state.view)
  const setView = useStore(state => state.setView)

  const [isDocked, setIsDocked] = useState(true)

  // V9.3: 移动端伴侣模式
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)
  const [mobileView, setMobileView] = useState('RF') // 'RF' | 'AI' | 'MISSION' | 'STATUS'

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
    // 战区发生切换时：先清空旧战区的残影数据，再强制拉取新战区
    dataHashRef.current = null;
    setAssets([]);           // 立即清空，防止切换瞬间残留旧战区的幽灵资产
    setStats({ hosts: 0, ports: 0, vulns: 0, scans: 0, latest_scan: null });
    refreshAssets(true);     // 强制全量拉取（忽略 Hash 短路）

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

  // 移动端面板可见性判断
  const showWorkArea = !isMobile || mobileView === 'RF' || mobileView === 'STATUS'
  const showAiPanel = !isMobile || mobileView === 'AI' || mobileView === 'MISSION'
  const showSidebar = !isMobile // 移动端不显示侧边栏

  // 移动端自动切换视图
  useEffect(() => {
    if (isMobile) {
      if (mobileView === 'RF') setView('RF')
      else if (mobileView === 'STATUS') setView('HQ')
    }
  }, [mobileView, isMobile])

  return (
    <div className="app-container">
      <HudBar onRefreshAssets={refreshAssets} />
      <div className="main-shell" style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden' }}>

        {/* Left pane: Activities, Sidebar, Center WorkArea OVER Terminal */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }} className={showWorkArea ? '' : 'mobile-hidden'}>
          
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <div className="activity-bar">
              {[['HQ', TerminalIcon, '指挥座舱'], ['RF', Radio, '无线电场'], ['DP', Archive, '数字兵站']].map(([k, Icon, label]) => (
                <div key={k} className={`activity-icon ${view === k ? 'active' : ''}`} onClick={() => setView(k)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Icon size={20} strokeWidth={1.5} />
                  <div style={{ fontSize: '10px' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Sidebar conditionally renders based on view mappings; for RF, it renders null to maximize radar width */}
            {showSidebar && <Sidebar onRefreshAssets={refreshAssets} />}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: isMobile ? 'none' : '1px solid #333' }}>
              <WorkArea />
              
              {/* Terminal renders natively inside flex column when Docked, keeping scroll bars constrained */}
              {isDocked && !isMobile && <FloatingConsole isDocked={isDocked} setIsDocked={setIsDocked} />}
            </div>
          </div>
        </div>

        {/* Right pane: AI Panel - Reverted to native outer block so it spans full height */}
        <div className={showAiPanel ? '' : 'mobile-hidden'} style={{ display: 'flex', flexDirection: 'column', flex: isMobile ? 1 : undefined, minHeight: 0 }}>
          <AiPanel isHqMode={isMobile} />
        </div>

      </div>
      <Spotlight />
      {!isDocked && !isMobile && <FloatingConsole isDocked={isDocked} setIsDocked={setIsDocked} />}

      {/* V9.3: 移动端底部导航栏 */}
      <div className="mobile-nav">
        {[
          { key: 'RF', icon: Radio, label: '雷达' },
          { key: 'AI', icon: Bot, label: 'AI' },
          { key: 'MISSION', icon: Target, label: '任务' },
          { key: 'STATUS', icon: Activity, label: '状态' },
        ].map(tab => (
          <div
            key={tab.key}
            className={`mobile-nav-item ${mobileView === tab.key ? 'active' : ''}`}
            onClick={() => setMobileView(tab.key)}
          >
            <tab.icon size={22} />
            <span>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App

