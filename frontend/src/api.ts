import type { PortfolioResponse, AllocationResponse, PerformanceResponse, ChatMessage, TradePreview } from './types'

export async function fetchPortfolio(refresh = false): Promise<PortfolioResponse> {
  const res = await fetch(`/api/portfolio${refresh ? '?refresh=true' : ''}`)
  if (!res.ok) throw new Error('Failed to fetch portfolio')
  return res.json()
}

export async function fetchAllocation(refresh = false): Promise<AllocationResponse> {
  const res = await fetch(`/api/allocation${refresh ? '?refresh=true' : ''}`)
  if (!res.ok) throw new Error('Failed to fetch allocation')
  return res.json()
}

export async function fetchPerformance(period: string): Promise<PerformanceResponse> {
  const res = await fetch(`/api/performance?period=${period}`)
  if (!res.ok) throw new Error('Failed to fetch performance')
  return res.json()
}

export async function fetchAccounts(): Promise<string[]> {
  const res = await fetch('/api/accounts')
  if (!res.ok) throw new Error('Failed to fetch accounts')
  const data = await res.json()
  return data.accounts
}

export async function previewTrade(ticker: string, quantity: number, account: string): Promise<TradePreview> {
  const res = await fetch('/api/trades/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, quantity, account }),
  })
  if (!res.ok) throw new Error('Preview failed')
  return res.json()
}

export async function recordTrade(ticker: string, quantity: number, account: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/trades/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, quantity, account }),
  })
  if (!res.ok) throw new Error('Failed to record trade')
  return res.json()
}

export function streamChat(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): () => void {
  const controller = new AbortController()

  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Chat request failed: ${res.status}`)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') { onDone(); return }
          try {
            const text = JSON.parse(payload) as string
            if (text.startsWith('[ERROR] ')) onError(text.slice(8))
            else onChunk(text)
          } catch { /* ignore malformed line */ }
        }
      }
      onDone()
    })
    .catch((err) => {
      if (err.name !== 'AbortError') onError(String(err))
    })

  return () => controller.abort()
}
