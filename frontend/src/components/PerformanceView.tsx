import { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { fetchPerformance } from '../api'
import type { PerformanceResponse, PerformanceStats, AccountBreakdownRow } from '../types'

const PERIODS = [
  { label: '1M', value: '1m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: '2Y', value: '2y' },
  { label: '5Y', value: '5y' },
  { label: '10Y', value: '10y' },
]

function formatDate(dateStr: string, period: string): string {
  const date = new Date(dateStr)
  if (period === '1m' || period === '6m') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function formatDollar(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function colorFor(n: number | null): string {
  if (n == null) return 'text-slate-500'
  return n >= 0 ? 'text-emerald-400' : 'text-red-400'
}

function fmtPct(n: number | null): string {
  if (n == null) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function fmtDeltaDollar(n: number | null): string {
  if (n == null) return '—'
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${n >= 0 ? '+' : '-'}$${abs}`
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 shadow-xl text-sm min-w-[180px]">
      <p className="text-slate-400 text-xs mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-slate-100 tabular-nums">
            {p.value != null ? formatDollar(p.value) : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

function StatsCards({ stats, loading }: { stats: PerformanceStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-xl h-[72px] animate-pulse" />
        ))}
      </div>
    )
  }
  if (!stats) return null

  const cards = [
    {
      label: 'Total Return',
      primary: fmtPct(stats.total_return_pct),
      secondary: fmtDeltaDollar(stats.total_return_dollar),
      color: colorFor(stats.total_return_pct),
    },
    {
      label: 'Annualized',
      primary: stats.annualized_return != null ? fmtPct(stats.annualized_return) : '< 1 yr',
      secondary: null,
      color: stats.annualized_return != null ? colorFor(stats.annualized_return) : 'text-slate-500',
    },
    {
      label: 'vs S&P 500',
      primary: fmtPct(stats.alpha_vs_spy),
      secondary: null,
      color: colorFor(stats.alpha_vs_spy),
    },
    {
      label: 'vs Dow Jones',
      primary: fmtPct(stats.alpha_vs_dia),
      secondary: null,
      color: colorFor(stats.alpha_vs_dia),
    },
    {
      label: 'Max Drawdown',
      primary: stats.max_drawdown != null ? `${stats.max_drawdown.toFixed(2)}%` : '—',
      secondary: null,
      color: 'text-red-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3"
        >
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{card.label}</p>
          <p className={`text-xl font-bold font-mono tabular-nums ${card.color}`}>{card.primary}</p>
          {card.secondary && (
            <p className={`text-xs font-mono tabular-nums mt-0.5 ${card.color}`}>{card.secondary}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function AccountBreakdown({ rows }: { rows: AccountBreakdownRow[] }) {
  if (!rows.length) return null
  return (
    <details open className="mt-6">
      <summary className="text-sm font-medium text-slate-400 cursor-pointer hover:text-slate-200 mb-3 list-none flex items-center gap-2">
        <span className="text-slate-600">▶</span> Account Breakdown
      </summary>
      <div className="mt-3 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
              <th className="text-left px-4 py-2 font-medium">Account</th>
              <th className="text-right px-4 py-2 font-medium">Period Return %</th>
              <th className="text-right px-4 py-2 font-medium">Period Return $</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.account} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-2.5 text-slate-300">{row.account}</td>
                <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${colorFor(row.return_pct)}`}>
                  {fmtPct(row.return_pct)}
                </td>
                <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${colorFor(row.return_dollar)}`}>
                  {fmtDeltaDollar(row.return_dollar)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export default function PerformanceView() {
  const [period, setPeriod] = useState('1y')
  const [data, setData] = useState<PerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState({ portfolio: true, spy: true, dia: true })

  const load = useCallback(
    async (p: string) => {
      try {
        setLoading(true)
        const result = await fetchPerformance(p)
        setData(result)
        setError(null)
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    load(period)
  }, [load, period])

  const changePeriod = (p: string) => {
    setPeriod(p)
  }

  const toggleLine = (key: keyof typeof visible) => {
    setVisible((v) => ({ ...v, [key]: !v[key] }))
  }

  const chartData = data?.data.map((d) => ({
    ...d,
    date: formatDate(d.date, period),
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-100">Historical Performance</h2>
        {/* Period selector */}
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => changePeriod(p.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 mb-6">
        <span className="text-amber-400 text-sm mt-0.5">⚠</span>
        <p className="text-amber-300/80 text-sm">
          {data?.disclaimer ?? 'Simulated using current holdings — not actual historical positions.'}
        </p>
      </div>

      {/* Stats cards */}
      <StatsCards stats={data?.stats ?? null} loading={loading} />

      {/* Legend toggles */}
      <div className="flex gap-4 mb-4">
        {[
          { key: 'portfolio' as const, label: 'My Portfolio', color: '#10b981' },
          { key: 'spy' as const, label: 'S&P 500 (SPY)', color: '#3b82f6' },
          { key: 'dia' as const, label: 'Dow Jones (DIA)', color: '#8b5cf6' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggleLine(key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
              visible[key]
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'border-slate-800 text-slate-600'
            }`}
          >
            <span
              className="w-3 h-0.5 rounded"
              style={{ backgroundColor: visible[key] ? color : '#475569' }}
            />
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        {loading ? (
          <div className="flex items-center justify-center h-80">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-80 text-red-400 text-sm">{error}</div>
        ) : !chartData?.length ? (
          <div className="flex items-center justify-center h-80 text-slate-500 text-sm">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatDollar}
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip content={<CustomTooltip />} />
              {visible.portfolio && (
                <Line
                  type="monotone"
                  dataKey="portfolioValue"
                  name="My Portfolio"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981' }}
                />
              )}
              {visible.spy && (
                <Line
                  type="monotone"
                  dataKey="spyValue"
                  name="S&P 500 (SPY)"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  activeDot={{ r: 4, fill: '#3b82f6' }}
                />
              )}
              {visible.dia && (
                <Line
                  type="monotone"
                  dataKey="diaValue"
                  name="Dow Jones (DIA)"
                  stroke="#8b5cf6"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  activeDot={{ r: 4, fill: '#8b5cf6' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Account breakdown */}
      {!loading && data?.account_breakdown && (
        <AccountBreakdown rows={data.account_breakdown} />
      )}
    </div>
  )
}
