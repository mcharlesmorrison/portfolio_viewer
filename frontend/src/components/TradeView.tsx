import { useState, useEffect } from 'react'
import { fetchAccounts, previewTrade, recordTrade } from '../api'
import type { TradePreview } from '../types'

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

function fmtQty(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

function CategoryDot({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS['Other']
  return <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: color }} />
}

function PreviewCard({ preview, action }: { preview: TradePreview; action: 'buy' | 'sell' }) {
  const delta = action === 'sell' ? -Math.abs(preview.delta_quantity) : Math.abs(preview.delta_quantity)
  const newQty = preview.exists ? (preview.current_quantity ?? 0) + delta : delta

  return (
    <div className={`rounded-xl border p-5 ${
      preview.would_go_negative
        ? 'border-red-500/40 bg-red-950/20'
        : preview.exists
          ? 'border-emerald-500/30 bg-emerald-950/10'
          : 'border-blue-500/30 bg-blue-950/10'
    }`}>
      {/* Badge */}
      <div className="flex items-center gap-2 mb-4">
        {preview.would_go_negative ? (
          <span className="text-xs font-semibold text-red-400 bg-red-500/15 border border-red-500/30 rounded-full px-3 py-0.5">
            ⚠ Would go negative
          </span>
        ) : preview.would_clear ? (
          <span className="text-xs font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-3 py-0.5">
            Position will be closed
          </span>
        ) : preview.exists ? (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-0.5">
            ✓ Existing position found
          </span>
        ) : (
          <span className="text-xs font-semibold text-blue-400 bg-blue-500/15 border border-blue-500/30 rounded-full px-3 py-0.5">
            + New position
          </span>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
        <div className="text-slate-500">Ticker</div>
        <div className="font-mono font-bold text-slate-100">{preview.ticker}</div>

        <div className="text-slate-500">Account</div>
        <div className="text-slate-200">{preview.account}</div>

        <div className="text-slate-500">Category</div>
        <div className="flex items-center gap-1.5">
          <CategoryDot category={preview.category} />
          <span className="text-slate-200">{preview.category}</span>
        </div>
      </div>

      {/* Quantity breakdown */}
      <div className="border-t border-slate-700/50 pt-4 space-y-1.5 font-mono text-sm">
        {preview.exists && (
          <div className="flex justify-between text-slate-400">
            <span>Current</span>
            <span className="tabular-nums">{fmtQty(preview.current_quantity ?? 0)} shares</span>
          </div>
        )}
        <div className={`flex justify-between font-medium ${
          action === 'buy' ? 'text-emerald-400' : 'text-red-400'
        }`}>
          <span>{action === 'buy' ? 'Adding' : 'Removing'}</span>
          <span className="tabular-nums">
            {action === 'buy' ? '+' : '−'}{fmtQty(Math.abs(preview.delta_quantity))} shares
          </span>
        </div>
        <div className={`flex justify-between font-bold border-t border-slate-700/50 pt-1.5 ${
          preview.would_go_negative ? 'text-red-400' : 'text-slate-100'
        }`}>
          <span>{preview.would_clear ? 'Result (position closed)' : 'New total'}</span>
          <span className="tabular-nums">{fmtQty(newQty)} shares</span>
        </div>
      </div>

      {preview.would_go_negative && (
        <p className="text-xs text-red-400 mt-3">
          This sell would result in a negative quantity. Reduce the amount or confirm to close the position.
        </p>
      )}
    </div>
  )
}

export default function TradeView() {
  const [accounts, setAccounts] = useState<string[]>([])
  const [action, setAction] = useState<'buy' | 'sell'>('buy')
  const [ticker, setTicker] = useState('')
  const [quantity, setQuantity] = useState('')
  const [account, setAccount] = useState('')
  const [customAccount, setCustomAccount] = useState('')
  const [isNewAccount, setIsNewAccount] = useState(false)

  const [preview, setPreview] = useState<TradePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  const [confirmLoading, setConfirmLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [confirmError, setConfirmError] = useState('')

  useEffect(() => {
    fetchAccounts().then(setAccounts).catch(() => {})
  }, [])

  // Clear preview whenever inputs change
  useEffect(() => {
    setPreview(null)
    setPreviewError('')
    setSuccessMessage('')
    setConfirmError('')
  }, [ticker, quantity, account, customAccount, action, isNewAccount])

  const resolvedAccount = isNewAccount ? customAccount.trim() : account

  const canPreview =
    ticker.trim().length > 0 &&
    parseFloat(quantity) > 0 &&
    resolvedAccount.length > 0

  const handlePreview = async () => {
    setPreviewLoading(true)
    setPreviewError('')
    setPreview(null)
    try {
      const qty = parseFloat(quantity)
      const result = await previewTrade(ticker.trim().toUpperCase(), qty, resolvedAccount)
      setPreview(result)
    } catch (e) {
      setPreviewError(String(e))
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview) return
    setConfirmLoading(true)
    setConfirmError('')
    try {
      const qty = action === 'sell' ? -Math.abs(parseFloat(quantity)) : Math.abs(parseFloat(quantity))
      const result = await recordTrade(ticker.trim().toUpperCase(), qty, resolvedAccount)
      setSuccessMessage(result.message)
      // Reset form
      setTicker('')
      setQuantity('')
      setPreview(null)
      // Refresh account list in case a new one was added
      fetchAccounts().then(setAccounts).catch(() => {})
    } catch (e) {
      setConfirmError(String(e))
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-100 mb-1">Record Trade</h2>
        <p className="text-slate-500 text-sm">
          Log a buy or sell. The CSV will be updated and prices will refresh automatically.
        </p>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="flex items-center gap-3 bg-emerald-900/30 border border-emerald-500/40 rounded-xl px-4 py-3 mb-6 text-sm text-emerald-300">
          <span className="text-lg">✓</span>
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="ml-auto text-emerald-600 hover:text-emerald-400">×</button>
        </div>
      )}

      {/* Form card */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-5">

        {/* Buy / Sell toggle */}
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Action</label>
          <div className="flex gap-2">
            {(['buy', 'sell'] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAction(a)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
                  action === a
                    ? a === 'buy'
                      ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-red-600/20 border-red-500/50 text-red-400'
                    : 'bg-transparent border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
              >
                {a === 'buy' ? '↑ Buy / Add' : '↓ Sell / Remove'}
              </button>
            ))}
          </div>
        </div>

        {/* Ticker */}
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Ticker</label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="e.g. VEA, BTC, SWPPX"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 font-mono font-semibold placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Shares / Units
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
            min="0"
            step="any"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
          />
        </div>

        {/* Account */}
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Account</label>
          {!isNewAccount ? (
            <div className="flex gap-2">
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-slate-500 transition-colors appearance-none"
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <button
                onClick={() => { setIsNewAccount(true); setAccount('') }}
                className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                + New
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={customAccount}
                onChange={(e) => setCustomAccount(e.target.value)}
                placeholder="e.g. Fidelity Roth IRA"
                autoFocus
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
              />
              <button
                onClick={() => { setIsNewAccount(false); setCustomAccount('') }}
                className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ← Back
              </button>
            </div>
          )}
        </div>

        {/* Preview button */}
        <button
          onClick={handlePreview}
          disabled={!canPreview || previewLoading}
          className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-slate-100 transition-colors"
        >
          {previewLoading ? 'Checking…' : 'Preview Trade'}
        </button>

        {previewError && (
          <p className="text-red-400 text-xs">{previewError}</p>
        )}
      </div>

      {/* Preview result */}
      {preview && (
        <div className="mt-4 space-y-3">
          <PreviewCard preview={preview} action={action} />

          {!preview.would_go_negative && (
            <button
              onClick={handleConfirm}
              disabled={confirmLoading}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                action === 'buy'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-red-700 hover:bg-red-600 text-white'
              }`}
            >
              {confirmLoading
                ? 'Saving…'
                : preview.would_clear
                  ? 'Confirm — Close Position'
                  : preview.exists
                    ? `Confirm — ${action === 'buy' ? 'Add to' : 'Reduce'} Position`
                    : 'Confirm — Record New Position'}
            </button>
          )}

          {confirmError && (
            <p className="text-red-400 text-xs text-center">{confirmError}</p>
          )}
        </div>
      )}
    </div>
  )
}
