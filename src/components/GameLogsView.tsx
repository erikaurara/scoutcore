import React, { useState } from 'react';
import { recentGameLogs } from '../data/mockData';
import { HistoricalGameLog } from '../types';

interface GameLogsViewProps {
  onOpenReport: () => void;
}

export const GameLogsView: React.FC<GameLogsViewProps> = ({ onOpenReport }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Pitcher' | 'Batter'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredLogs = recentGameLogs.filter((log) => {
    const matchesSearch =
      log.opponent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.playerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.date.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'ALL' || log.type === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#0b1326] text-[#dae2fd]">
      
      {/* Header Section */}
      <section className="relative px-8 py-8 flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden border-b border-[#3b494b]/10">
        <div className="relative z-10 max-w-2xl">
          <span className="font-label-caps text-xs text-[#00f0ff] uppercase tracking-[0.2em] mb-2 block font-bold">
            Archive Database // v2.4
          </span>
          <h1 className="font-display-lg text-[44px] text-[#dae2fd] tracking-tight uppercase font-bold leading-none">
            Historical <span className="text-[#00f0ff]">Game Logs</span>
          </h1>
          <p className="font-body-md text-sm text-[#b9cacb] mt-3 leading-relaxed">
            Aggregated performance metrics across all professional tiers. Data synchronized with live scouting feeds and Statcast integration.
          </p>
        </div>

        {/* Quick Stats Totals */}
        <div className="flex gap-6 relative z-10 bg-[#222a3d] p-4 rounded-xl shadow-xl border border-[#3b494b]/20 shrink-0">
          <div className="flex flex-col">
            <span className="font-label-caps text-[10px] text-[#849495] uppercase">Processed</span>
            <span className="font-data-numeric text-2xl text-[#00f0ff] tabular-nums font-bold">24,802</span>
          </div>
          <div className="w-[1px] h-10 bg-[#3b494b]/30" />
          <div className="flex flex-col">
            <span className="font-label-caps text-[10px] text-[#849495] uppercase">High Intent</span>
            <span className="font-data-numeric text-2xl text-[#65f2b5] tabular-nums font-bold">1,142</span>
          </div>
        </div>

        {/* Background Glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#00f0ff]/5 rounded-full blur-[120px] pointer-events-none" />
      </section>

      {/* Filter Bar */}
      <section className="px-8 my-6">
        <div className="bg-[#131b2e] p-3 rounded-xl flex flex-wrap items-center gap-4 shadow-sm border border-[#3b494b]/20">
          
          <div className="flex-1 min-w-[240px] relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#849495] text-[20px]">
              person_search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Player or Team..."
              className="w-full bg-[#2d3449] border-none rounded-lg pl-10 pr-4 py-2 text-xs font-body-sm text-[#dae2fd] placeholder:text-[#849495] focus:ring-1 focus:ring-[#00f0ff] outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="bg-[#2d3449] px-3 py-2 rounded-lg text-xs font-label-caps text-[#dae2fd] border border-[#3b494b]/30 focus:outline-none focus:border-[#00f0ff]"
            >
              <option value="ALL">POSITION: ALL</option>
              <option value="P">PITCHER (SP/RP)</option>
              <option value="B">BATTER</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-[#2d3449] px-3 py-2 rounded-lg text-xs font-label-caps text-[#dae2fd] border border-[#3b494b]/30 focus:outline-none focus:border-[#00f0ff]"
            >
              <option value="ALL">MATCHUP TYPE: ALL</option>
              <option value="Pitcher">PITCHER LOGS</option>
              <option value="Batter">BATTER LOGS</option>
            </select>
          </div>

          <button
            onClick={() => { setSearchTerm(''); setTypeFilter('ALL'); setSelectedPosition('ALL'); }}
            className="bg-[#00f0ff] text-[#00363a] px-4 py-2 rounded-lg font-label-caps text-xs uppercase hover:opacity-90 transition-opacity flex items-center gap-1.5 font-bold shadow-[0_2px_8px_rgba(0,240,255,0.2)]"
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            <span>Reset Filters</span>
          </button>
        </div>
      </section>

      {/* Main Content Grid with Floating Card */}
      <section className="px-8 pb-12 grid grid-cols-12 gap-8 items-start">
        
        {/* Table Container */}
        <div className="col-span-12 xl:col-span-9 bg-[#171f33] rounded-xl overflow-hidden shadow-2xl border border-[#3b494b]/20">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#222a3d]/60 border-b border-[#3b494b]/30 font-label-caps text-[10px] text-[#849495] uppercase">
                  <th className="px-4 py-3">Date / Opponent</th>
                  <th className="px-4 py-3 text-center">Result</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-3 py-3 text-center bg-[#00f0ff]/5 text-[#00f0ff]">IP / AB</th>
                  <th className="px-3 py-3 text-center bg-[#00f0ff]/5 text-[#00f0ff]">H</th>
                  <th className="px-3 py-3 text-center bg-[#00f0ff]/5 text-[#00f0ff]">R</th>
                  <th className="px-3 py-3 text-center bg-[#00f0ff]/5 text-[#00f0ff]">BB</th>
                  <th className="px-3 py-3 text-center bg-[#00f0ff]/5 text-[#00f0ff]">K</th>
                  <th className="px-3 py-3 text-center bg-[#00f0ff]/5 text-[#00f0ff]">ERA / AVG</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3b494b]/10 font-data-numeric text-xs">
                {filteredLogs.map((log: HistoricalGameLog) => (
                  <tr key={log.id} className="hover:bg-[#222a3d] transition-colors group">
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-[#dae2fd] font-bold">{log.date}</span>
                        <span className="font-body-sm text-[#849495] text-[11px] uppercase">{log.opponent}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-bold text-xs ${
                        log.result === 'W' 
                          ? 'bg-[#65f2b5]/10 border-[#65f2b5]/30 text-[#65f2b5]' 
                          : 'bg-[#ffb4ab]/10 border-[#ffb4ab]/30 text-[#ffb4ab]'
                      }`}>
                        <span>{log.result}</span>
                        <span className="text-[#dae2fd]">{log.score}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded font-label-caps text-[10px] uppercase border ${
                        log.type === 'Pitcher'
                          ? 'bg-[#2d3449] text-[#b9cacb] border-[#3b494b]/30'
                          : 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30'
                      }`}>
                        {log.type}
                      </span>
                    </td>

                    <td className="px-3 py-3.5 text-center text-[#dae2fd] font-bold">{log.ipOrAb}</td>
                    <td className="px-3 py-3.5 text-center text-[#dae2fd]">{log.hits}</td>
                    <td className="px-3 py-3.5 text-center text-[#dae2fd]">{log.runs}</td>
                    <td className="px-3 py-3.5 text-center text-[#dae2fd]">{log.bb}</td>
                    <td className="px-3 py-3.5 text-center text-[#00f0ff] font-bold">{log.so}</td>
                    <td className="px-3 py-3.5 text-center text-[#dae2fd]">{log.eraOrAvg}</td>

                    <td className="px-4 py-3.5 text-right">
                      <button 
                        onClick={onOpenReport}
                        className="opacity-80 group-hover:opacity-100 transition-opacity bg-[#2d3449] hover:bg-[#00f0ff] hover:text-[#00363a] p-1.5 rounded flex items-center justify-center ml-auto"
                        title="Analyze Game"
                      >
                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-6 py-4 bg-[#060e20] border-t border-[#3b494b]/20 flex items-center justify-between">
            <span className="font-body-sm text-[#849495] text-xs">Showing 1-15 of 24,802 logs</span>
            <div className="flex items-center gap-2">
              <button className="p-1 text-[#849495] hover:text-[#00f0ff] transition-colors"><span class="material-symbols-outlined">first_page</span></button>
              <button className="p-1 text-[#849495] hover:text-[#00f0ff] transition-colors"><span class="material-symbols-outlined">chevron_left</span></button>
              <div className="flex items-center gap-1 px-3">
                <span className="font-data-numeric text-xs text-[#00f0ff] font-bold">{currentPage}</span>
                <span className="font-data-numeric text-xs text-[#849495]">/</span>
                <span className="font-data-numeric text-xs text-[#849495]">1,654</span>
              </div>
              <button className="p-1 text-[#849495] hover:text-[#00f0ff] transition-colors"><span class="material-symbols-outlined">chevron_right</span></button>
              <button className="p-1 text-[#849495] hover:text-[#00f0ff] transition-colors"><span class="material-symbols-outlined">last_page</span></button>
            </div>
          </div>
        </div>

        {/* Floating Side Quick Analysis Card */}
        <div className="col-span-12 xl:col-span-3 bg-[#222a3d] border border-[#3b494b]/30 rounded-xl shadow-2xl p-5 space-y-5 sticky top-24">
          <div className="flex items-center justify-between border-b border-[#3b494b]/20 pb-3">
            <span className="font-label-caps text-[11px] text-[#00f0ff] uppercase font-bold tracking-wider">
              Quick Analysis
            </span>
            <span className="material-symbols-outlined text-[#849495] text-[18px]">info</span>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-body-sm text-[#849495] text-xs">Season Velocity Range</span>
              <div className="h-2 w-full bg-[#060e20] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#00f0ff] to-[#65f2b5] w-[85%]" />
              </div>
              <div className="flex justify-between font-data-numeric text-[10px] text-[#849495]">
                <span>92.4 MPH</span>
                <span>101.2 MPH</span>
              </div>
            </div>

            <div className="p-3 bg-[#131b2e] rounded-lg border border-[#3b494b]/20">
              <p className="font-body-sm text-[#dae2fd] text-xs leading-relaxed italic opacity-90">
                "Consistent strike zone command noted in previous 3 outings. K/9 ratio significantly above league average (11.4)."
              </p>
            </div>

            <button 
              onClick={onOpenReport}
              className="w-full py-2.5 bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] font-label-caps text-xs uppercase rounded-lg hover:bg-[#00f0ff] hover:text-[#00363a] transition-all font-bold tracking-wider shadow-[0_2px_10px_rgba(0,240,255,0.15)]"
            >
              Generate Full Report
            </button>
          </div>
        </div>

      </section>
    </div>
  );
};
