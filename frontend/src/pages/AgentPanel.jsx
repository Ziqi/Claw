import { useState, useRef, useEffect } from 'react'
import { fetchEventSource } from '@microsoft/fetch-event-source'

const API = 'http://localhost:8000/api'

const ToolCallNode = ({ call }) => {
  const risk = call.args?.risk_level || call.risk_level || 'UNKNOWN'
  return (
    <details className="agent-tool-node" style={{ marginLeft: '1rem', marginTop: '0.5rem', marginBottom: '0.5rem', borderLeft: '2px solid var(--border)', paddingLeft: '0.5rem' }}>
      <summary style={{ cursor: 'pointer', color: 'var(--cyan)' }}>
        <span className={`risk-badge`} style={{ color: risk === 'RED' ? '#FF4444' : risk === 'YELLOW' ? '#FF9900' : '#00FF00', marginRight: '8px', fontSize: '0.8em', border: '1px solid', padding: '1px 4px', borderRadius: '3px' }}>
          {risk}
        </span>
        <span className="tool-name">{call.name}</span>
        {call.status && <span style={{ marginLeft: '8px', color: 'var(--text-dim)' }}>[{call.status}]</span>}
      </summary>
      <div className="tool-details" style={{ fontSize: '0.85em', color: 'var(--text-dim)', marginTop: '4px' }}>
        {call.args && Object.entries(call.args).map(([k, v]) => (
          <div key={k} style={{ marginBottom: '2px' }}>
            <span style={{ color: 'var(--text)' }}>{k}:</span> {v}
          </div>
        ))}
        {call.resultPreview && (
          <div style={{ marginTop: '4px', color: 'var(--green)' }}>
            ↳ {call.resultPreview}
          </div>
        )}
      </div>
    </details>
  )
}

export default function AgentPanel() {
  const [messages, setMessages] = useState([
    { id: 'init-1', role: 'system', text: 'CLAW Agent v8.0 · Gemini 3 · HITL Enabled' },
    { id: 'init-2', role: 'assistant', text: '🐱 Lynx 已上线。基于 Interactions API 运行中。' },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [challengeMsg, setChallengeMsg] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (overrideInput = null) => {
    const userMsg = overrideInput !== null ? overrideInput : input.trim()
    if (!userMsg || thinking) return
    if (overrideInput === null) setInput('')
    
    const msgId = Date.now().toString()
    setMessages(prev => [...prev, { id: `u-${msgId}`, role: 'user', text: userMsg }])
    setThinking(true)
    
    // Create new assistant message
    const asstMsgId = `a-${msgId}`
    setMessages(prev => [...prev, {
      id: asstMsgId,
      role: 'assistant',
      text: '',
      thinkingStatus: 'Lynx is thinking...',
      toolCalls: []
    }])

    const ctrl = new AbortController()
    
    try {
      await fetchEventSource(`${API}/agent/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          query: userMsg,
          campaign_id: 'default'
        }),
        signal: ctrl.signal,
        onmessage(ev) {
          const data = JSON.parse(ev.data)
          
          setMessages(prev => prev.map(msg => {
            if (msg.id !== asstMsgId) return msg
            
            const newMsg = { ...msg }
            if (ev.event === 'thinking') {
              newMsg.thinkingStatus = data.status
            } else if (ev.event === 'delta') {
              newMsg.text += data.text
            } else if (ev.event === 'tool_call') {
              newMsg.toolCalls = [...(newMsg.toolCalls || []), {
                name: data.name,
                args: data.args,
                risk_level: data.risk_level,
                status: 'pending'
              }]
            } else if (ev.event === 'tool_result') {
              if (data.requires_approval) {
                setChallengeMsg({ command: newMsg.toolCalls[newMsg.toolCalls.length - 1]?.args?.command || '未知高危操作' })
              }
              const calls = [...(newMsg.toolCalls || [])]
              if (calls.length > 0) {
                calls[calls.length - 1].status = data.status
                calls[calls.length - 1].resultPreview = data.preview
              }
              newMsg.toolCalls = calls
            } else if (ev.event === 'error') {
              newMsg.text += `\n[Error]: ${data.message}`
            }
            return newMsg
          }))
          
          if (ev.event === 'done') {
            setThinking(false)
            setMessages(prev => prev.map(msg => {
              if (msg.id !== asstMsgId) return msg
              return { ...msg, thinkingStatus: null }
            }))
            ctrl.abort()
          }
        },
        onerror(err) {
          console.error('SSE Error:', err)
          setThinking(false)
          ctrl.abort()
          throw err
        }
      })
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        text: '⚠ 无法连接 Agent 后端 SSE 接口。',
      }])
      setThinking(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleChallenge = () => {
    if (!input.trim()) return
    const override = `审批通过: ${challengeMsg.command} (口令: ${input.trim()})`
    setChallengeMsg(null)
    setInput('')
    sendMessage(override)
  }

  return (
    <div className="agent-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="agent-header" style={{ padding: '8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-lighter)' }}>
        <span style={{color:'var(--green)'}}>⌐</span> AGENT · Lynx
        <span className="cursor" style={{marginLeft:'4px'}}></span>
      </div>

      <div className="agent-messages" style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {messages.map((m) => (
          <div key={m.id} className={`agent-msg agent-msg-${m.role}`} style={{ marginBottom: '16px' }}>
            {m.role === 'user' && <span className="agent-prompt" style={{color:'var(--text)'}}>{'>'} </span>}
            {m.role === 'assistant' && <span className="agent-prompt" style={{color:'var(--cyan)'}}>{'◆'} </span>}
            {m.role === 'system' && <span className="agent-prompt" style={{color:'var(--text-dim)'}}>{'#'} </span>}
            
            <span className="agent-text" style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
            
            {m.toolCalls && m.toolCalls.map((call, idx) => (
              <ToolCallNode key={idx} call={call} />
            ))}
            
            {m.thinkingStatus && (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.9em', marginTop: '4px', fontStyle: 'italic' }}>
                {m.thinkingStatus} <span className="cursor"></span>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {challengeMsg && (
        <div style={{ padding: '12px', background: 'rgba(255, 68, 68, 0.1)', borderTop: '1px solid #ff4444' }}>
          <div style={{ color: '#ff4444', fontWeight: 'bold', marginBottom: '8px' }}>
            ⚠ 高危指令需要人工授权 (RED L4/L5)
          </div>
          <div style={{ color: 'var(--text)', fontSize: '0.9em', marginBottom: '8px' }}>
            指令: <code>{challengeMsg.command}</code>
          </div>
          <div style={{ fontSize: '0.85em', color: 'var(--text-dim)' }}>
            请输入目标 IP 的最后一段数字以确认执行核弹指令:
          </div>
        </div>
      )}

      <div className="agent-input-area" style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <input
          type="text"
          className="agent-input"
          style={{ width: '100%', padding: '8px', background: 'var(--bg-lighter)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
          placeholder={challengeMsg ? "输入口令并按回车或点击 Approve..." : "Ask Lynx..."}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (challengeMsg) handleChallenge()
              else sendMessage()
            }
          }}
          disabled={thinking && !challengeMsg}
        />
        {challengeMsg && (
          <button onClick={handleChallenge} style={{ marginTop: '8px', width: '100%', padding: '8px', background: '#ff4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
            [Approve] 强制执行
          </button>
        )}
      </div>
    </div>
  )
}
