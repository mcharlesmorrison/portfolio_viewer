import { useState, useEffect, useCallback } from 'react'
import { fetchPortfolio } from '../api'
import type { Holding, PortfolioResponse } from '../types'

const CATEGORY_COLORS: Record<string, string> = {
  'US Large/Total Market': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'US Small Cap': 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  'Intl Developed': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'Emerging Markets': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Target-Date/Blends': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  'Commodities—Gold': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Commodities—Silver': 'bg-slate-400/20 text-slate-300 border-slate-400/30',
  Crypto: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Cash/Fixed Income': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Energy: 'bg-red-500/20 text-red-300 border-red-500/30',
  Other: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
}

function fmt(n: number | null, prefix = '$'): string {
  if (n == null) return '—'
  return `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtQty(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function fmtDelta(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${n >= 0 ? '+' : '-'}$${abs}`
}

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] ?? CATEGORY_COLORS['Other']
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {category}
    </span>
  )
}

function GainCell({ h, mode }: { h: Holding; mode: 'pct' | 'dollar' }) {
  if (h.ticker === 'CASH') {
    return <span className="text-slate-600">—</span>
  }
  if (mode === 'pct') {
    if (h.day_change_pct == null) return <span className="text-slate-600">—</span>
    const cls = h.day_change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'
    return (
      <span className={cls}>
        {h.day_change_pct >= 0 ? '+' : ''}{h.day_change_pct.toFixed(2)}%
      </span>
    )
  } else {
    if (h.day_change_dollar == null) return <span className="text-slate-600">—</span>
    const cls = h.day_change_dollar >= 0 ? 'text-emerald-400' : 'text-red-400'
    return <span className={cls}>{fmtDelta(h.day_change_dollar)}</span>
  }
}

const ACCOUNT_ORDER = [
  'Etrade Brokerage',
  'Etrade Roth IRA',
  'Etrade HYS',
  '401k / Employer Plan',
  'Robinhood',
  'Kraken',
  'Sofi HYS',
]

function AccountSection({
  account,
  holdings,
  totalPortfolio,
  gainMode,
  onToggleGainMode,
}: {
  account: string
  holdings: Holding[]
  totalPortfolio: number
  gainMode: 'pct' | 'dollar'
  onToggleGainMode: () => void
}) {
  const [open, setOpen] = useState(true)
  const subtotal = holdings.reduce((s, h) => s + (h.value ?? 0), 0)
  const pct = totalPortfolio > 0 ? (subtotal / totalPortfolio) * 100 : 0

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`transition-transform text-slate-400 ${open ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <span className="font-semibold text-slate-100">{account}</span>
          <span className="text-xs text-slate-500">{holdings.length} positions</span>
        </div>
        <div className="text-right">
          <span className="font-mono font-semibold text-slate-100 tabular-nums">
            {fmt(subtotal)}
          </span>
          <span className="text-xs text-slate-500 ml-2">({pct.toFixed(1)}%)</span>
        </div>
      </button>

      {open && (
        <div className="mt-1 rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
                <th className="text-left px-4 py-2 font-medium">Ticker</th>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Category</th>
                <th className="text-right px-4 py-2 font-medium">Quantity</th>
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th
                  className="text-right px-4 py-2 font-medium cursor-pointer hover:text-slate-300 select-none whitespace-nowrap"
                  onClick={onToggleGainMode}
                  title="Click to toggle % / $"
                >
                  Day's Gain {gainMode === 'pct' ? '%' : '$'} <span className="text-slate-600">⇅</span>
                </th>
                <th className="text-right px-4 py-2 font-medium">Value</th>
                <th className="text-right px-4 py-2 font-medium">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h, i) => (
                <tr
                  key={`${h.ticker}-${i}`}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono font-semibold text-slate-100">
                    {h.ticker}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 max-w-[180px] truncate">{h.name}</td>
                  <td className="px-4 py-2.5">
                    <CategoryBadge category={h.category} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 tabular-nums">
                    {fmtQty(h.quantity)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 tabular-nums">
                    {h.ticker === 'CASH' ? '—' : fmt(h.price)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    <GainCell h={h} mode={gainMode} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-100 tabular-nums">
                    {fmt(h.value)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-400 tabular-nums">
                    {h.pct_of_total.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function PortfolioTable() {
  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gainMode, setGainMode] = useState<'pct' | 'dollar'>('pct')

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      const result = await fetchPortfolio(refresh)
      setData(result)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleGainMode = useCallback(() => {
    setGainMode((m) => (m === 'pct' ? 'dollar' : 'pct'))
  }, [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => load()} />
  if (!data) return null

  // Group by account, preserving order
  const byAccount: Record<string, Holding[]> = {}
  for (const h of data.holdings) {
    if (!byAccount[h.account]) byAccount[h.account] = []
    byAccount[h.account].push(h)
  }
  const orderedAccounts = [
    ...ACCOUNT_ORDER.filter((a) => byAccount[a]),
    ...Object.keys(byAccount).filter((a) => !ACCOUNT_ORDER.includes(a)),
  ]

  const ts = new Date(data.last_updated * 1000).toLocaleTimeString()
  const gainDollar = data.total_day_gain_dollar
  const gainPct = data.total_day_gain_pct
  const gainPositive = gainDollar != null && gainDollar >= 0

  return (
    <div>
      {/* Hero total */}
      <div className="text-center mb-8">
        <p className="text-sm text-slate-500 uppercase tracking-widest font-medium mb-1">
          Total Portfolio Value
        </p>
        <p className="text-5xl font-bold text-slate-100 tabular-nums">
          {fmt(data.total_value)}
        </p>
        {gainDollar != null && (
          <p
            className={`text-lg font-semibold tabular-nums mt-2 cursor-pointer ${gainPositive ? 'text-emerald-400' : 'text-red-400'}`}
            onClick={toggleGainMode}
            title="Click to toggle % / $"
          >
            {gainMode === 'pct'
              ? `${gainPct != null ? (gainPct >= 0 ? '+' : '') + gainPct.toFixed(2) + '%' : '—'} today`
              : `${fmtDelta(gainDollar)} today`}
          </p>
        )}
        <p className="text-xs text-slate-600 mt-1">Prices as of {ts}</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors disabled:opacity-50"
        >
          <span className={refreshing ? 'animate-spin' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh Prices'}
        </button>
      </div>

      {/* Account sections */}
      {orderedAccounts.map((account) => (
        <AccountSection
          key={account}
          account={account}
          holdings={byAccount[account]}
          totalPortfolio={data.total_value}
          gainMode={gainMode}
          onToggleGainMode={toggleGainMode}
        />
      ))}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-500 text-sm">Fetching live prices…</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <p className="text-red-400 text-sm">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300"
      >
        Retry
      </button>
    </div>
  )
}
