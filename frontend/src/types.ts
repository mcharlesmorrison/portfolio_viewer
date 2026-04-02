export interface Holding {
  ticker: string
  name: string
  quantity: number | null
  price: number | null
  value: number | null
  category: string
  account: string
  pct_of_total: number
}

export interface PortfolioResponse {
  holdings: Holding[]
  total_value: number
  last_updated: number
}

export interface AllocationRow {
  category: string
  current_value: number
  current_pct: number
  target_pct: number
  delta_pct: number
  delta_value: number
}

export interface AllocationResponse {
  total_value: number
  rows: AllocationRow[]
  targets: Record<string, number>
}

export interface PerformancePoint {
  date: string
  portfolioValue: number | null
  spyValue: number | null
  diaValue: number | null
}

export interface PerformanceResponse {
  data: PerformancePoint[]
  disclaimer: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TradePreview {
  exists: boolean
  ticker: string
  account: string
  category: string
  current_quantity: number | null
  delta_quantity: number
  new_quantity: number
  would_go_negative: boolean
  would_clear: boolean
}
