import React, { useState } from 'react';
import { samplePlayers, recentGameLogs } from '../data/mockData';
import { Player } from '../types';

interface MatchupsViewProps {
  onOpenReport: () => void;
}

export const MatchupsView: React.FC<MatchupsViewProps> = ({ onOpenReport }) => {
  const [selectedPitcherId, setSelectedPitcherId] = useState<string>('cole');
  const [selectedBatterId, setSelectedBatterId] = useState<string>('judge');

  const availablePitchers: Player[] = [
    samplePlayers.cole,
    samplePlayers.wheeler,
  ];

  const availableBatters: Player[] = [
    samplePlayers.judge,
    samplePlayers.devers,
    samplePlayers.lindor,
  ];

  const currentPitcher = samplePlayers[selectedPitcherId] || samplePlayers.cole;
  const currentBatter = samplePlayers[selectedBatterId] || samplePlayers.judge;

  // Calculate advantage gauge offset (64% pitcher = offset calculation)
  const advantagePct = selectedPitcherId === 'cole' && selectedBatterId === 'judge' ? 64 : 58;

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 gap-8">
      
      {/* Top Stat Ticker / Context Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#131b2e] p-4 rounded-xl border border-[#3b494b]/20 shadow-lg">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="font-label-caps text-[10px] text-[#849495] uppercase">Matchup Venue</span>
            <span className="font-headline-lg text-sm font-bold text-[#dae2fd] flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#00f0ff]">location_on</span>
              Oracle Park, San Francisco
            </span>
          </div>

          <div className="h-8 w-[1px] bg-[#3b494b]/30" />

          <div className="flex flex-col">
            <span className="font-label-caps text-[10px] text-[#849495] uppercase">Conditions</span>
            <span className="font-headline-lg text-sm font-bold text-[#dae2fd] flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#65f2b5]">thermostat</span>
              62°F · Wind: Out to CF 12mph
            </span>
          </div>

          <div className="h-8 w-[1px] bg-[#3b494b]/30" />

          {/* Selector Dropdowns */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-label-caps text-[#849495]">PITCHER:</span>
            <select
              value={selectedPitcherId}
              onChange={(e) => setSelectedPitcherId(e.target.value)}
              className="bg-[#171f33] border border-[#3b494b]/40 text-xs font-mono text-[#00f0ff] rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#00f0ff]"
            >
              {availablePitchers.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.team})</option>
              ))}
            </select>

            <span className="text-xs font-label-caps text-[#849495] ml-2">BATTER:</span>
            <select
              value={selectedBatterId}
              onChange={(e) => setSelectedBatterId(e.target.value)}
              className="bg-[#171f33] border border-[#3b494b]/40 text-xs font-mono text-[#b9c8de] rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#00f0ff]"
            >
              {availableBatters.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.team})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#222a3d] border border-[#3b494b]/30">
          <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
          <span className="font-label-caps text-[10px] text-[#b9cacb]">LIVE PROBABILITY</span>
        </div>
      </div>

      {/* Main Pitcher vs Batter Comparison Grid */}
      <div className="grid grid-cols-12 gap-6 items-stretch">
        
        {/* Pitcher Profile (Left) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col">
          <div className="relative overflow-hidden rounded-xl bg-[#171f33] shadow-2xl border border-[#3b494b]/20 p-6 flex flex-col gap-6 h-full">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#00dbe9]" />

            <div className="flex items-start justify-between">
              <div className="w-24 h-24 rounded-full bg-[#2d3449] overflow-hidden border-2 border-[#00dbe9]/30 shadow-2xl shrink-0">
                <img 
                  src={currentPitcher.avatarUrl} 
                  alt={currentPitcher.name} 
                  className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition-all duration-500"
                />
              </div>

              <div className="flex flex-col items-start gap-1">
                <span className="font-label-caps text-[10px] text-[#00dbe9] tracking-widest uppercase">
                  Starting Pitcher
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-[#00dbe9] text-[#002022] font-label-caps text-[10px] rounded font-bold">
                    {currentPitcher.throwsHand}HP
                  </span>
                  <span className="px-1.5 py-0.5 bg-[#00dbe9] text-[#002022] font-label-caps text-[10px] rounded font-bold">
                    {currentPitcher.position}
                  </span>
                </div>
                <h2 className="font-display-lg text-[32px] text-[#dae2fd] leading-tight font-bold">
                  {currentPitcher.name}
                </h2>
                <span className="font-label-caps text-xs text-[#849495]">
                  {currentPitcher.team} | {currentPitcher.throwsHand}HP | {currentPitcher.number}
                </span>
              </div>
            </div>

            {/* Pitcher Stat Boxes */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[#131b2e] rounded-lg border border-[#3b494b]/20 flex flex-col gap-1">
                <span className="font-label-caps text-[10px] text-[#849495]">AVG VELO</span>
                <span className="font-data-numeric text-xl text-[#dae2fd] font-bold">
                  {currentPitcher.stats.avgVelo || '97.4'}
                </span>
                <div className="w-full h-1 bg-[#2d3449] rounded-full overflow-hidden">
                  <div className="h-full bg-[#00dbe9] w-[92%]" />
                </div>
              </div>

              <div className="p-3 bg-[#131b2e] rounded-lg border border-[#3b494b]/20 flex flex-col gap-1">
                <span className="font-label-caps text-[10px] text-[#849495]">WHIFF %</span>
                <span className="font-data-numeric text-xl text-[#dae2fd] font-bold">
                  {currentPitcher.stats.whiffPct || '34.2'}
                </span>
                <div className="w-full h-1 bg-[#2d3449] rounded-full overflow-hidden">
                  <div className="h-full bg-[#4edea3] w-[88%]" />
                </div>
              </div>

              <div className="p-3 bg-[#131b2e] rounded-lg border border-[#3b494b]/20 flex flex-col gap-1">
                <span className="font-label-caps text-[10px] text-[#849495]">K / 9</span>
                <span className="font-data-numeric text-xl text-[#dae2fd] font-bold">
                  {currentPitcher.stats.kPerNine || '11.8'}
                </span>
                <div className="w-full h-1 bg-[#2d3449] rounded-full overflow-hidden">
                  <div className="h-full bg-[#b9c8de] w-[82%]" />
                </div>
              </div>
            </div>

            {/* Arsenal Distribution */}
            <div className="flex flex-col gap-2 mt-auto">
              <span className="font-label-caps text-[10px] text-[#849495] uppercase tracking-wider">
                Arsenal Distribution
              </span>
              <div className="flex h-10 w-full rounded-lg overflow-hidden gap-[2px] border border-[#3b494b]/30">
                {(currentPitcher.arsenalOrPitchPerf || [
                  { label: 'FB', value: 52, colorClass: 'bg-[#00f0ff] text-[#002022]' },
                  { label: 'SL', value: 22, colorClass: 'bg-[#b9c8de] text-[#0d1c2d]' },
                  { label: 'KC', value: 16, colorClass: 'bg-[#2d3449] text-[#dae2fd]' },
                  { label: 'CH', value: 10, colorClass: 'bg-[#3b494b] text-[#dae2fd]' },
                ]).map((pitch, idx) => (
                  <div 
                    key={idx} 
                    style={{ width: `${pitch.value}%` }} 
                    className={`h-full flex items-center justify-center text-[10px] font-bold ${pitch.colorClass}`}
                    title={`${pitch.label}: ${pitch.value}%`}
                  >
                    {pitch.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Central Matchup Advantage Gauge */}
        <div className="col-span-12 lg:col-span-2 flex flex-col items-center justify-center relative py-6 lg:py-0 bg-[#131b2e]/50 rounded-xl border border-[#3b494b]/20">
          <div className="relative z-10 flex flex-col items-center gap-4 text-center p-4">
            <span className="font-label-caps text-[10px] text-[#849495] uppercase">Advantage</span>

            {/* Circular Progress Meter */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle 
                  className="text-[#2d3449]" 
                  cx="50" cy="50" r="42" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="8" 
                />
                <circle 
                  className="text-[#00f0ff]" 
                  cx="50" cy="50" r="42" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="8"
                  strokeDasharray="263.8"
                  strokeDashoffset={263.8 - (263.8 * advantagePct) / 100}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-data-numeric text-2xl font-bold text-[#dae2fd]">{advantagePct}%</span>
                <span className="font-label-caps text-[9px] text-[#00f0ff] font-bold">PITCHER</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="material-symbols-outlined text-[#00f0ff] text-3xl animate-bounce">swap_horiz</span>
              <div className="px-3 py-1 bg-[#222a3d] rounded-full border border-[#3b494b]/30">
                <span className="font-label-caps text-[10px] text-[#dae2fd] font-bold">HIGH LEVERAGE</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1 mt-2">
              <span className="font-label-caps text-[10px] text-[#849495] uppercase">Key Factor</span>
              <p className="font-body-sm text-xs text-[#b9cacb] leading-relaxed">
                Pitcher's high-spin FB vs Batter's tendency to chase up-and-in.
              </p>
            </div>
          </div>
        </div>

        {/* Batter Profile (Right) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col">
          <div className="relative overflow-hidden rounded-xl bg-[#171f33] shadow-2xl border border-[#3b494b]/20 p-6 flex flex-col gap-6 h-full">
            <div className="absolute top-0 right-0 w-1.5 h-full bg-[#b9c8de]" />

            <div className="flex items-start justify-between flex-row-reverse">
              <div className="w-24 h-24 rounded-full bg-[#2d3449] overflow-hidden border-2 border-[#b9c8de]/30 shadow-2xl shrink-0">
                <img 
                  src={currentBatter.avatarUrl} 
                  alt={currentBatter.name} 
                  className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition-all duration-500"
                />
              </div>

              <div className="flex flex-col items-end gap-1 text-right">
                <span className="font-label-caps text-[10px] text-[#b9c8de] tracking-widest uppercase">
                  Cleanup Hitter
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-[#b9c8de] text-[#0d1c2d] font-label-caps text-[10px] rounded font-bold">
                    {currentBatter.batsHand}HH
                  </span>
                  <span className="px-1.5 py-0.5 bg-[#b9c8de] text-[#0d1c2d] font-label-caps text-[10px] rounded font-bold">
                    {currentBatter.position}
                  </span>
                </div>
                <h2 className="font-display-lg text-[32px] text-[#dae2fd] leading-tight font-bold">
                  {currentBatter.name}
                </h2>
                <span className="font-label-caps text-xs text-[#849495]">
                  {currentBatter.team} | {currentBatter.position} | {currentBatter.number}
                </span>
              </div>
            </div>

            {/* Batter Stat Boxes */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[#131b2e] rounded-lg border border-[#3b494b]/20 flex flex-col gap-1">
                <span className="font-label-caps text-[10px] text-[#849495]">EXIT VELO</span>
                <span className="font-data-numeric text-xl text-[#dae2fd] font-bold">
                  {currentBatter.stats.exitVelo || '114.2'}
                </span>
                <div className="w-full h-1 bg-[#2d3449] rounded-full overflow-hidden">
                  <div className="h-full bg-[#b9c8de] w-[98%]" />
                </div>
              </div>

              <div className="p-3 bg-[#131b2e] rounded-lg border border-[#3b494b]/20 flex flex-col gap-1">
                <span className="font-label-caps text-[10px] text-[#849495]">CHASE %</span>
                <span className="font-data-numeric text-xl text-[#dae2fd] font-bold">
                  {currentBatter.stats.chasePct || '18.5'}
                </span>
                <div className="w-full h-1 bg-[#2d3449] rounded-full overflow-hidden">
                  <div className="h-full bg-[#ffb4ab] w-[35%]" />
                </div>
              </div>

              <div className="p-3 bg-[#131b2e] rounded-lg border border-[#3b494b]/20 flex flex-col gap-1">
                <span className="font-label-caps text-[10px] text-[#849495]">BARREL %</span>
                <span className="font-data-numeric text-xl text-[#dae2fd] font-bold">
                  {currentBatter.stats.barrelPct || '15.2'}
                </span>
                <div className="w-full h-1 bg-[#2d3449] rounded-full overflow-hidden">
                  <div className="h-full bg-[#4edea3] w-[75%]" />
                </div>
              </div>
            </div>

            {/* Pitch Performance */}
            <div className="flex flex-col gap-2 mt-auto">
              <span className="font-label-caps text-[10px] text-[#849495] uppercase tracking-wider text-right">
                Pitch Performance
              </span>
              <div className="flex h-10 w-full rounded-lg overflow-hidden gap-[2px] flex-row-reverse border border-[#3b494b]/30">
                {(currentBatter.arsenalOrPitchPerf || [
                  { label: 'HEATER', value: 60, colorClass: 'bg-[#00f0ff] text-[#002022]' },
                  { label: 'SLIDER', value: 25, colorClass: 'bg-[#b9c8de] text-[#0d1c2d]' },
                  { label: 'CURVE', value: 15, colorClass: 'bg-[#2d3449] text-[#dae2fd]' },
                ]).map((pitch, idx) => (
                  <div 
                    key={idx} 
                    style={{ width: `${pitch.value}%` }} 
                    className={`h-full flex items-center justify-center text-[10px] font-bold ${pitch.colorClass}`}
                    title={`${pitch.label}: ${pitch.value}%`}
                  >
                    {pitch.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Recent Game Logs Table */}
      <div className="bg-[#131b2e] rounded-xl overflow-hidden border border-[#3b494b]/20 shadow-xl mt-4">
        <div className="p-4 bg-[#222a3d] border-b border-[#3b494b]/20 flex items-center justify-between">
          <h3 className="font-label-caps text-xs text-[#dae2fd] uppercase tracking-wider font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00f0ff] text-[18px]">history</span>
            Recent Game Logs
          </h3>
          <div className="flex gap-4">
            <span className="font-label-caps text-[10px] text-[#00f0ff] font-bold">COLE (P)</span>
            <span className="font-label-caps text-[10px] text-[#b9c8de] font-bold">JUDGE (B)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#060e20]">
              <tr className="font-label-caps text-[10px] text-[#849495] uppercase border-b border-[#3b494b]/20">
                <th className="p-4">Date</th>
                <th className="p-4">Opp</th>
                <th className="p-4">P: IP / K / ER</th>
                <th className="p-4">B: AB / H / HR</th>
                <th className="p-4 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="font-data-numeric text-xs text-[#b9cacb] divide-y divide-[#3b494b]/10">
              {recentGameLogs.slice(4).map((log) => (
                <tr key={log.id} className="hover:bg-[#2d3449]/40 transition-colors">
                  <td className="p-4 text-[#dae2fd] font-semibold">{log.date}</td>
                  <td className="p-4">{log.opponent}</td>
                  <td className="p-4">{log.ipOrAb} / {log.so} / {log.runs}</td>
                  <td className="p-4">4 / {log.hits} / {log.runs > 2 ? 1 : 0}</td>
                  <td className={`p-4 text-right font-bold ${log.result === 'W' ? 'text-[#00f0ff]' : 'text-[#ffb4ab]'}`}>
                    {log.result} {log.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
