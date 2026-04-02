import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { streamChat } from '../api'
import type { ChatMessage } from '../types'

const SUGGESTIONS = [
  'Give me a full portfolio analysis — strengths, weaknesses, and risk rating.',
  'Am I on track for my house fund goal of $150k by 2029?',
  'How should I rebalance to hit my 2026 target allocation?',
  'What are the biggest risks in my current portfolio?',
  'VB vs VTWO for small cap — which makes more sense for my strategy?',
  'How does my crypto allocation affect my overall risk profile?',
]

function Message({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${
          isUser ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
        }`}
      >
        {isUser ? 'M' : 'G'}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-emerald-600/20 border border-emerald-500/30 text-slate-100'
            : 'bg-slate-800/80 border border-slate-700/50 text-slate-200'
        }`}
      >
        {isUser ? (
          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none
            prose-headings:text-slate-100 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-1
            prose-h2:text-sm prose-h3:text-sm
            prose-p:text-slate-200 prose-p:leading-relaxed prose-p:my-1
            prose-li:text-slate-200 prose-li:my-0
            prose-strong:text-slate-100
            prose-ul:my-1 prose-ol:my-1
            prose-code:text-emerald-300 prose-code:bg-slate-900/60 prose-code:px-1 prose-code:rounded">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5 rounded-sm" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AnalysisView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const cancelRef = useRef<(() => void) | null>(null)

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = (text: string) => {
    if (!text.trim() || isStreaming) return
    setError('')
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    const allMessages = [...messages, userMsg]

    cancelRef.current = streamChat(
      allMessages,
      (chunk) => {
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: next[next.length - 1].content + chunk,
          }
          return next
        })
      },
      () => setIsStreaming(false),
      (err) => {
        setError(err)
        setIsStreaming(false)
        // Remove the empty assistant message on error
        setMessages((prev) => prev.slice(0, -1))
      },
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">AI Advisor</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Powered by Gemini · Your portfolio data is injected automatically
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setError('') }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div>
              <p className="text-slate-400 text-sm mb-1">Ask anything about your portfolio</p>
              <p className="text-slate-600 text-xs">
                Your holdings, allocation, and investment strategy are already in context.
              </p>
            </div>
            {/* Suggestion chips */}
            <div className="flex flex-col gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left px-4 py-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl text-sm text-slate-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <Message
                key={i}
                msg={msg}
                isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
              />
            ))}
            {error && (
              <div className="text-red-400 text-xs text-center py-2">{error}</div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 pt-3 border-t border-slate-800">
        <div className="flex gap-2 items-end bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-slate-500 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your portfolio…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none outline-none leading-relaxed disabled:opacity-50"
            style={{ maxHeight: '120px' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${el.scrollHeight}px`
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isStreaming}
            className="w-8 h-8 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors flex-shrink-0"
          >
            {isStreaming ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1.5 text-center">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  )
}
