import { useState } from 'react'
import PortfolioTable from './components/PortfolioTable'
import AllocationView from './components/AllocationView'
import PerformanceView from './components/PerformanceView'
import AnalysisView from './components/AnalysisView'
import TradeView from './components/TradeView'

const TABS = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'allocation', label: 'Allocation' },
  { id: 'performance', label: 'Performance' },
  { id: 'analysis', label: 'AI Analysis' },
  { id: 'trade', label: 'Record Trade' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('portfolio')

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <span className="text-slate-100 font-semibold tracking-tight text-lg">
              Portfolio Viewer
            </span>

            {/* Tabs */}
            <nav className="flex gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {activeTab === 'portfolio' && <PortfolioTable />}
        {activeTab === 'allocation' && <AllocationView />}
        {activeTab === 'performance' && <PerformanceView />}
        {activeTab === 'analysis' && <AnalysisView />}
        {activeTab === 'trade' && <TradeView />}
      </main>
    </div>
  )
}
