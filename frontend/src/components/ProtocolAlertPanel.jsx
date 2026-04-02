import React, { useState, useEffect } from 'react'
import { RefreshCw, Loader2, ShieldAlert, Copy } from 'lucide-react'
import useStore from '../store'

const API = `http://${window.location.hostname}:8000/api/v1`

function ProtocolAlertPanel() {
  const [alerts, setAlerts] = useState([])
  const [alertStats, setAlertStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ severity: 'ALL', type: 'ALL' })
  const [expandedId, setExpandedId] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const SEVERITY_COLORS = {
    CRITICAL: '#FF3B30',
    HIGH: '#FF9500',
    MEDIUM: '#FFD60A',
    LOW: '#30D158',
    INFO: '#0A84FF'
  }

  const fetchAlerts = (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams({ page: p, per_page: 20 })
    if (filter.severity !== 'ALL') params.append('severity', filter.severity)
    if (filter.type !== 'ALL') params.append('alert_type', filter.type)
    fetch(`${API}/alerts/list?${params}`)
      .then(r => r.json())
      .then(d => {
        setAlerts(d.alerts || [])
        setTotalPages(d.total_pages || 1)
        setPage(d.page || 1)
        setLoading(false)
      })
      .catch(err => { console.error('Failed to fetch alerts:', err); setLoading(false) })
  }

  const fetchStats = () => {
    fetch(`${API}/alerts/stats`)
      .then(r => r.json())
      .then(d => setAlertStats(d))
      .catch(console.error)
  }

  useEffect(() => { fetchAlerts(1); fetchStats() }, [filter])

  const handleAcknowledge = (id) => {
    fetch(`${API}/alerts/${id}/acknowledge`, { method: 'POST' })
      .then(r => r.json())
      .then(() => { fetchAlerts(page); fetchStats() })
      .catch(console.error)
  }

  const handleGenerateRule = (alert) => {
    const rulePrompt = `根据以下协议告警生成 Suricata IDS 规则:\n- 类型: ${alert.alert_type}\n- 协议: ${alert.protocol}\n- 来源IP: ${alert.source_ip}\n- MITRE TTP: ${alert.mitre_ttp}\n- 详情: ${JSON.stringify(alert.details)}\n请输出标准 Suricata rule 格式。`
    useStore.getState().setExternalCommand({ id: Date.now(), cmd: rulePrompt })
  }

  const formatTime = (t) => {
    if (!t) return '—'
    const d = new Date(t)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
      {/* Stats Overview */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ background: '#111', border: '1px solid #333', padding: '12px 20px', flex: 1, minWidth: '120px' }}>
          <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>总告警数</div>
          <div style={{ color: '#00FFFF', fontSize: '24px', fontWeight: 'bold', fontFamily: 'Consolas, monospace' }}>{alertStats?.total ?? '—'}</div>
        </div>
        <div style={{ background: '#111', border: '1px solid #333', padding: '12px 20px', flex: 1, minWidth: '120px' }}>
          <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>未确认</div>
          <div style={{ color: '#FF3B30', fontSize: '24px', fontWeight: 'bold', fontFamily: 'Consolas, monospace' }}>{alertStats?.unacknowledged ?? '—'}</div>
        </div>
        {alertStats?.by_type && Object.entries(alertStats.by_type).map(([type, count]) => (
          <div key={type} style={{ background: '#111', border: '1px solid #333', padding: '12px 20px', flex: 1, minWidth: '120px' }}>
            <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>{type}</div>
            <div style={{ color: '#FF9500', fontSize: '24px', fontWeight: 'bold', fontFamily: 'Consolas, monospace' }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#666', fontSize: '11px' }}>筛选:</span>
        {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
          <button key={s} onClick={() => setFilter(f => ({ ...f, severity: s }))}
            style={{
              background: filter.severity === s ? (SEVERITY_COLORS[s] || '#00FFFF') + '22' : 'transparent',
              color: filter.severity === s ? (SEVERITY_COLORS[s] || '#00FFFF') : '#666',
              border: `1px solid ${filter.severity === s ? (SEVERITY_COLORS[s] || '#00FFFF') : '#333'}`,
              padding: '3px 10px', fontSize: '10px', cursor: 'pointer', transition: 'all 0.2s'
            }}>{s === 'ALL' ? '全部等级' : s}</button>
        ))}
        <span style={{ color: '#333' }}>|</span>
        {['ALL', 'LLMNR_POISON', 'ARP_SPOOF', 'BRUTE_FORCE', 'DTP_ATTACK'].map(t => (
          <button key={t} onClick={() => setFilter(f => ({ ...f, type: t }))}
            style={{
              background: filter.type === t ? 'rgba(0,255,255,0.1)' : 'transparent',
              color: filter.type === t ? '#00FFFF' : '#666',
              border: `1px solid ${filter.type === t ? '#00FFFF' : '#333'}`,
              padding: '3px 10px', fontSize: '10px', cursor: 'pointer', transition: 'all 0.2s'
            }}>{t === 'ALL' ? '全部类型' : t.replace('_', ' ')}</button>
        ))}
        <button onClick={() => { fetchAlerts(page); fetchStats() }}
          style={{ background: 'transparent', color: '#666', border: '1px solid #333', padding: '3px 10px', fontSize: '10px', cursor: 'pointer', marginLeft: 'auto' }}>
          <RefreshCw size={10} /> 刷新
        </button>
      </div>

      {/* Alert Timeline */}
      {loading ? (
        <div style={{ color: '#666', textAlign: 'center', padding: '40px', fontSize: '13px' }}>
          <Loader2 size={20} className="spin" style={{ marginBottom: '8px' }} /> 加载协议告警数据...
        </div>
      ) : alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#444' }}>
          <ShieldAlert size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>暂无协议告警</div>
          <div style={{ fontSize: '11px' }}>在 Kali 终端启动探针: <code style={{ color: '#00FFFF' }}>sudo python3 claw_llmnr_probe.py -i eth0</code></div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.map(alert => {
            const sevColor = SEVERITY_COLORS[alert.severity] || '#666'
            const isExpanded = expandedId === alert.id
            let details = {}
            try { details = typeof alert.details === 'string' ? JSON.parse(alert.details) : alert.details } catch {}

            return (
              <div key={alert.id} style={{
                background: alert.acknowledged ? '#0a0a0a' : '#111',
                border: `1px solid ${alert.acknowledged ? '#222' : sevColor + '44'}`,
                transition: 'all 0.2s',
                opacity: alert.acknowledged ? 0.6 : 1
              }}>
                {/* Alert Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', cursor: 'pointer' }}
                     onClick={() => setExpandedId(isExpanded ? null : alert.id)}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sevColor, boxShadow: !alert.acknowledged ? `0 0 8px ${sevColor}` : 'none', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: sevColor, fontWeight: 'bold', fontSize: '12px' }}>{alert.severity}</span>
                      <span style={{ color: '#D0D0D0', fontSize: '12px', fontWeight: 'bold' }}>{alert.alert_type?.replace(/_/g, ' ')}</span>
                      <span style={{ color: '#666', fontSize: '10px' }}>({alert.protocol})</span>
                      {alert.mitre_ttp && alert.mitre_ttp !== 'N/A' && (
                        <span style={{ color: '#0A84FF', fontSize: '10px', background: 'rgba(10,132,255,0.1)', padding: '1px 6px', border: '1px solid rgba(10,132,255,0.3)' }}>{alert.mitre_ttp}</span>
                      )}
                      {alert.acknowledged && <span style={{ color: '#30D158', fontSize: '9px' }}>✓ 已确认</span>}
                    </div>
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '4px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span>来源: <span style={{ color: '#00FFFF' }}>{alert.source_ip || '—'}</span> {alert.source_mac && `(${alert.source_mac})`}</span>
                      {alert.target_ip && <span>目标: <span style={{ color: '#FF9500' }}>{alert.target_ip}</span></span>}
                      <span>探针: {alert.probe_id}</span>
                    </div>
                  </div>
                  <div style={{ color: '#555', fontSize: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatTime(alert.detected_at)}</div>
                  <div style={{ color: '#444', fontSize: '10px', flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #222', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Object.keys(details).length > 0 && (
                      <div>
                        <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>[ 检测详情 ]</div>
                        <div style={{ background: '#050505', padding: '8px', fontSize: '11px', color: '#999', fontFamily: 'Consolas, monospace', overflowX: 'auto' }}>
                          {Object.entries(details).map(([k, v]) => (
                            <div key={k}><span style={{ color: '#00FFFF' }}>{k}</span>: <span style={{ color: '#D0D0D0' }}>{JSON.stringify(v)}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                    {alert.raw_evidence && (
                      <div>
                        <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>[ 原始证据 ]</div>
                        <pre style={{ background: '#050505', padding: '8px', fontSize: '10px', color: '#666', fontFamily: 'Consolas, monospace', whiteSpace: 'pre-wrap', margin: 0, maxHeight: '120px', overflowY: 'auto' }}>{alert.raw_evidence}</pre>
                      </div>
                    )}
                    {alert.remediation && (
                      <div>
                        <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>[ 修复建议 ]</div>
                        <div style={{ color: '#30D158', fontSize: '11px', background: 'rgba(48,209,88,0.05)', padding: '8px', border: '1px solid rgba(48,209,88,0.2)' }}>{alert.remediation}</div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      {!alert.acknowledged && (
                        <button onClick={(e) => { e.stopPropagation(); handleAcknowledge(alert.id) }}
                          style={{ background: 'rgba(48,209,88,0.1)', color: '#30D158', border: '1px solid #30D158', padding: '4px 12px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ✓ 确认告警
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleGenerateRule(alert) }}
                        style={{ background: 'rgba(0,255,255,0.1)', color: '#00FFFF', border: '1px solid #00FFFF', padding: '4px 12px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ⚡ 生成 IDS 规则
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(alert, null, 2)) }}
                        style={{ background: 'transparent', color: '#666', border: '1px solid #333', padding: '4px 12px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Copy size={10} /> 复制 JSON
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
              <button disabled={page <= 1} onClick={() => fetchAlerts(page - 1)}
                style={{ background: '#111', color: page <= 1 ? '#333' : '#999', border: '1px solid #333', padding: '4px 12px', fontSize: '11px', cursor: page <= 1 ? 'default' : 'pointer' }}>« 上一页</button>
              <span style={{ color: '#666', fontSize: '11px', padding: '4px 8px' }}>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => fetchAlerts(page + 1)}
                style={{ background: '#111', color: page >= totalPages ? '#333' : '#999', border: '1px solid #333', padding: '4px 12px', fontSize: '11px', cursor: page >= totalPages ? 'default' : 'pointer' }}>下一页 »</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ProtocolAlertPanel
