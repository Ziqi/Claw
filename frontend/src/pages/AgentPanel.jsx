import { useState, useRef, useEffect } from 'react'

const API = 'http://localhost:8000/api/v1'

export default function AgentPanel() {
  const [messages, setMessages] = useState([
    { role: 'system', text: 'CLAW Agent v7.0 · Gemini 3 · HITL Enabled' },
    { role: 'assistant', text: '🐱 Lynx 已上线。输入指令或问题开始作战。' },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || thinking) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setThinking(true)

    try {
      const res = await fetch(`${API}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', text: data.reply || data.error || '无响应' }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: '⚠ Agent 端点未就绪。CLI 模式请用: python3 claw-agent.py',
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: '⚠ 无法连接 Agent 后端。请确保 uvicorn 运行中。',
      }])
    }

    setThinking(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="agent-panel">
      <div className="agent-header">
        <span style={{color:'var(--green)'}}>⌐</span> AGENT · Lynx
        <span className="cursor" style={{marginLeft:'4px'}}></span>
      </div>

      <div className="agent-messages">
        {messages.map((m, i) => (
          <div key={i} className={`agent-msg agent-msg-${m.role}`}>
            {m.role === 'user' && <span className="agent-prompt">{'>'} </span>}
            {m.role === 'assistant' && <span className="agent-prompt" style={{color:'var(--cyan)'}}>{'◆'} </span>}
            {m.role === 'system' && <span className="agent-prompt" style={{color:'var(--text-dim)'}}>{'#'} </span>}
            <span className="agent-text">{m.text}</span>
          </div>
        ))}
        {thinking && (
          <div className="agent-msg agent-msg-assistant">
            <span className="agent-prompt" style={{color:'var(--cyan)'}}>◆ </span>
            <span style={{color:'var(--text-dim)'}}>thinking...</span>
            <span className="cursor"></span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="agent-input-area">
        <input
          type="text"
          className="agent-input"
          placeholder="Ask Lynx..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={thinking}
        />
      </div>
    </div>
  )
}
