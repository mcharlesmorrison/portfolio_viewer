import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Sector,
} from 'recharts'
import { fetchAllocation, fetchPortfolio } from '../api'
import type { AllocationResponse, AllocationRow, Holding } from '../types'

// ── colours ────────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  'US Large/Total Market': '#3b82f6',
  'US Small Cap': '#0ea5e9',
  'Intl Developed': '#8b5cf6',
  'Emerging Markets': '#a855f7',
  'Target-Date/Blends': '#6366f1',
  'Commodities—Gold': '#f59e0b',
  'Commodities—Silver': '#94a3b8',
  Crypto: '#f97316',
  'Cash/Fixed Income': '#10b981',
  Energy: '#ef4444',
  Other: '#64748b',
}
function getColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Other']
}
function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

// ── active (exploded) slice shape ──────────────────────────────────────────────
function ActiveSlice(props: unknown) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } =
    props as {
      cx: number; cy: number; innerRadius: number; outerRadius: number
      startAngle: number; endAngle: number; fill: string
    }
  return (
    <g>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius}
        outerRadius={(outerRadius as number) + 14}
        startAngle={startAngle} endAngle={endAngle}
        fill={fill}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={2}
      />
    </g>
  )
}

// ── tooltip ────────────────────────────────────────────────────────────────────
function SliceTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl pointer-events-none">
      <p className="font-medium text-slate-100">{payload[0].name}</p>
      <p className="text-slate-300">{payload[0].value.toFixed(1)}%</p>
    </div>
  )
}

// ── holdings breakdown panel ───────────────────────────────────────────────────
function CategoryBreakdown({
  category,
  holdings,
  totalValue,
  onClose,
}: {
  category: string
  holdings: Holding[]
  totalValue: number
  onClose: () => void
}) {
  const items = holdings
    .filter((h) => h.category === category && h.value != null && h.value > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const catTotal = items.reduce((s, h) => s + (h.value ?? 0), 0)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col min-w-[280px] max-w-[320px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getColor(category) }} />
          <span className="font-semibold text-slate-100 text-sm">{category}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        {fmt(catTotal)} · {((catTotal / totalValue) * 100).toFixed(1)}% of portfolio
      </p>
      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 340 }}>
        {items.map((h) => {
          const pct = catTotal > 0 ? ((h.value ?? 0) / catTotal) * 100 : 0
          return (
            <div key={`${h.ticker}-${h.account}`} className="flex items-center gap-3">
              {/* bar */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="font-mono font-semibold text-slate-200">{h.ticker}</span>
                  <span className="text-slate-400 tabular-nums">{fmt(h.value ?? 0)}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: getColor(category) }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-0.5">
                  <span className="text-slate-600 truncate max-w-[140px]">{h.account}</span>
                  <span className="text-slate-600 tabular-nums">{pct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )
        })}
        {items.length === 0 && (
          <p className="text-slate-600 text-xs text-center py-4">No holdings in this slice</p>
        )}
      </div>
    </div>
  )
}

// ── single pie (used both inline and in modal) ─────────────────────────────────
function PieInner({
  data,
  size,
  onSliceClick,
  activeIndex,
}: {
  data: { name: string; value: number }[]
  size: 'small' | 'large'
  onSliceClick: (index: number | null) => void
  activeIndex: number | null
}) {
  const height = size === 'large' ? 460 : 300
  const inner = size === 'large' ? 90 : 60
  const outer = size === 'large' ? 160 : 110

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={inner} outerRadius={outer}
          paddingAngle={2}
          dataKey="value"
          activeIndex={activeIndex ?? undefined}
          activeShape={ActiveSlice}
          onClick={(_, index) => onSliceClick(activeIndex === index ? null : index)}
          style={{ cursor: 'pointer' }}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={getColor(entry.name)}
              opacity={activeIndex === null || activeIndex === data.indexOf(entry) ? 1 : 0.4}
            />
          ))}
        </Pie>
        <Tooltip content={<SliceTooltip />} />
        <Legend formatter={(v) => <span className="text-xs text-slate-400">{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── modal ──────────────────────────────────────────────────────────────────────
function PieModal({
  label,
  data,
  holdings,
  totalValue,
  onClose,
}: {
  label: string
  data: { name: string; value: number }[]
  holdings: Holding[]
  totalValue: number
  onClose: () => void
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const selectedCategory = activeIndex !== null ? data[activeIndex]?.name ?? null : null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="font-semibold text-slate-100">{label}</h3>
          <div className="flex items-center gap-4">
            {activeIndex !== null && (
              <span className="text-xs text-slate-500">Click the slice again to deselect</span>
            )}
            {activeIndex === null && (
              <span className="text-xs text-slate-500">Click a slice to see its holdings</span>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100 text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chart */}
          <div className="flex-1 p-6">
            <PieInner
              data={data}
              size="large"
              onSliceClick={setActiveIndex}
              activeIndex={activeIndex}
            />
          </div>

          {/* Breakdown panel — slides in when slice selected */}
          {selectedCategory && (
            <div className="p-6 pl-0 flex items-center">
              <CategoryBreakdown
                category={selectedCategory}
                holdings={holdings}
                totalValue={totalValue}
                onClose={() => setActiveIndex(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── chart card (clickable thumbnail) ──────────────────────────────────────────
function ChartCard({
  label,
  data,
  holdings,
  totalValue,
}: {
  label: string
  data: { name: string; value: number }[]
  holdings: Holding[]
  totalValue: number
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const selectedCategory = activeIndex !== null ? data[activeIndex]?.name ?? null : null

  return (
    <>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">{label}</h3>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-400 transition-colors"
            title="Expand"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
            Expand
          </button>
        </div>
        <p className="text-xs text-slate-600 mb-2 text-center">Click a slice to see holdings</p>

        <PieInner
          data={data}
          size="small"
          onSliceClick={setActiveIndex}
          activeIndex={activeIndex}
        />

        {selectedCategory && (
          <div className="mt-3">
            <CategoryBreakdown
              category={selectedCategory}
              holdings={holdings}
              totalValue={totalValue}
              onClose={() => setActiveIndex(null)}
            />
          </div>
        )}
      </div>

      {modalOpen && (
        <PieModal
          label={label}
          data={data}
          holdings={holdings}
          totalValue={totalValue}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

// ── delta table row ────────────────────────────────────────────────────────────
function DeltaRow({ row }: { row: AllocationRow }) {
  const isOver = row.delta_pct > 0.5
  const isUnder = row.delta_pct < -0.5
  const deltaColor = isOver ? 'text-red-400' : isUnder ? 'text-emerald-400' : 'text-slate-400'

  return (
    <tr className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getColor(row.category) }} />
          <span className="text-slate-200 text-sm">{row.category}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300 text-sm">{row.current_pct.toFixed(1)}%</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300 text-sm">
        {row.target_pct > 0 ? `${row.target_pct.toFixed(1)}%` : '—'}
      </td>
      <td className={`px-4 py-3 text-right font-mono tabular-nums text-sm font-medium ${deltaColor}`}>
        {row.target_pct > 0 ? (row.delta_pct >= 0 ? '+' : '') + row.delta_pct.toFixed(1) + '%' : '—'}
      </td>
      <td className={`px-4 py-3 text-right font-mono tabular-nums text-sm ${deltaColor}`}>
        {row.target_pct > 0 ? (row.delta_value >= 0 ? '+' : '') + fmt(row.delta_value) : '—'}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-400 text-sm">{fmt(row.current_value)}</td>
    </tr>
  )
}

// ── main view ──────────────────────────────────────────────────────────────────
export default function AllocationView() {
  const [allocation, setAllocation] = useState<AllocationResponse | null>(null)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [allocData, portData] = await Promise.all([fetchAllocation(), fetchPortfolio()])
      setAllocation(allocData)
      setHoldings(portData.holdings)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading)
    return <div className="flex items-center justify-center py-32"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
  if (error)
    return <div className="text-center py-32 text-red-400 text-sm">{error}<button onClick={load} className="block mx-auto mt-4 underline">Retry</button></div>
  if (!allocation) return null

  const currentData = allocation.rows
    .filter((r) => r.current_pct > 0)
    .map((r) => ({ name: r.category, value: parseFloat(r.current_pct.toFixed(1)) }))

  const targetData = allocation.rows
    .filter((r) => r.target_pct > 0)
    .map((r) => ({ name: r.category, value: r.target_pct }))

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-100 mb-6">Portfolio Allocation</h2>

      {/* Pie charts */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
        <div className="flex gap-8 items-start">
          <ChartCard label="Current Allocation" data={currentData} holdings={holdings} totalValue={allocation.total_value} />
          <div className="w-px bg-slate-800 self-stretch" />
          <ChartCard label="Target Allocation (2026)" data={targetData} holdings={holdings} totalValue={allocation.total_value} />
        </div>
      </div>

      {/* Delta table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-100">Current vs. Target</h3>
          <div className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /> Overweight</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Underweight</span>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
              <th className="text-left px-4 py-2 font-medium">Category</th>
              <th className="text-right px-4 py-2 font-medium">Current</th>
              <th className="text-right px-4 py-2 font-medium">Target</th>
              <th className="text-right px-4 py-2 font-medium">Delta %</th>
              <th className="text-right px-4 py-2 font-medium">Delta $</th>
              <th className="text-right px-4 py-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {allocation.rows.map((row) => <DeltaRow key={row.category} row={row} />)}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-700 bg-slate-900/40">
              <td className="px-4 py-3 font-semibold text-slate-200 text-sm">Total</td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-slate-200 text-sm tabular-nums">
                {allocation.rows.reduce((s, r) => s + r.current_pct, 0).toFixed(1)}%
              </td>
              <td colSpan={3} />
              <td className="px-4 py-3 text-right font-mono font-semibold text-slate-200 text-sm tabular-nums">
                ${allocation.total_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-slate-600 mt-3 text-center">
        Target allocation from Investment Strategy 2026 plan. Energy has no explicit target.
      </p>
    </div>
  )
}
