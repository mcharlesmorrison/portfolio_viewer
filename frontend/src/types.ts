export interface Holding {
  ticker: string
  name: string
  quantity: number | null
  price: number | null
  value: number | null
  category: string
  account: string
  fund_class?: string
  pct_of_total: number
  day_change_pct: number | null
  day_change_dollar: number | null
}

export interface PortfolioResponse {
  holdings: Holding[]
  total_value: number
  total_day_gain_dollar: number | null
  total_day_gain_pct: number | null
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

export interface HouseFundItem {
  ticker: string
  name: string
  value: number
  account: string
}

export interface AllocationResponse {
  total_value: number
  rows: AllocationRow[]
  targets: Record<string, number>
  house_fund: HouseFundItem[]
  house_fund_total: number
}

export interface PerformancePoint {
  date: string
  portfolioValue: number | null
  spyValue: number | null
  diaValue: number | null
}

export interface PerformanceStats {
  total_return_dollar: number | null
  total_return_pct: number | null
  annualized_return: number | null
  max_drawdown: number | null
  alpha_vs_spy: number | null
  alpha_vs_dia: number | null
}

export interface AccountBreakdownRow {
  account: string
  return_pct: number | null
  return_dollar: number | null
}

export interface PerformanceResponse {
  data: PerformancePoint[]
  disclaimer: string
  stats: PerformanceStats
  account_breakdown: AccountBreakdownRow[]
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
