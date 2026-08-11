import React from 'react';
import { sampleMatchups, scoutingSignals, teamPowerIndex } from '../data/mockData';
import { NavigationTab, MatchupCardData } from '../types';

interface DashboardViewProps {
  onSelectTab: (tab: NavigationTab) => void;
  onSelectMatchup: (matchup: MatchupCardData) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectTab, onSelectMatchup }) => {
  return (
    <div className="flex flex-col w-full min-h-screen bg-[#0b1326] text-[#dae2fd]">
      {/* Hero Summary */}
      <section className="relative px-8 py-8 overflow-hidden border-b border-[#3b494b]/10">
        <div className="absolute inset-0 bg-gradient-to-r from-[#060e20] via-[#0b1326] to-transparent z-0 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-1 bg-[#d8ffe7]/10 border border-[#d8ffe7]/20 text-[#65f2b5] rounded-full font-label-caps text-[10px] tracking-widest animate-pulse">
                LIVE GAME ENGINE
              </span>
              <span className="text-[#849495] font-label-caps text-[10px]">SYSTEM TIME: 14:22 ET</span>
            </div>
            <h1 className="font-display-lg text-[44px] text-[#dbfcff] mb-2 leading-none">
              Gameday <span className="text-[#b9cacb] font-light italic">Intelligence</span>
            </h1>
            <p className="text-sm text-[#b9cacb] max-w-xl leading-relaxed">
              High-leverage analysis active for <span className="text-[#00f0ff] font-semibold">14 scheduled matchups</span>. Significant pitch-velocity deviations detected in <span className="text-[#00f0ff] font-semibold">NYY @ BOS</span> and <span className="text-[#65f2b5] font-semibold">LAD @ SD</span>.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="bg-[#171f33] p-4 rounded-xl border border-[#3b494b]/20 shadow-xl min-w-[200px]">
              <span className="font-label-caps text-[#849495] block mb-2 text-[10px]">LEAGUE AVG EXIT VELO</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-data-numeric text-[32px] text-[#dbfcff] leading-none">89.4</span>
                <span className="text-[#65f2b5] font-label-caps text-xs">+0.2%</span>
              </div>
              <div className="w-full h-1 bg-[#3b494b]/20 mt-3 overflow-hidden rounded-full">
                <div className="h-full bg-[#00f0ff] w-[72%] rounded-full" />
              </div>
            </div>

            <div className="bg-[#171f33] p-4 rounded-xl border border-[#3b494b]/20 shadow-xl min-w-[200px]">
              <span className="font-label-caps text-[#849495] block mb-2 text-[10px]">STRIKEOUT RATE (K/9)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-data-numeric text-[32px] text-[#65f2b5] leading-none">9.12</span>
                <span className="text-[#ffb4ab] font-label-caps text-xs">-1.1%</span>
              </div>
              <div className="w-full h-1 bg-[#3b494b]/20 mt-3 overflow-hidden rounded-full">
                <div className="h-full bg-[#65f2b5] w-[64%] rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-6 p-8">
        {/* Left Column: High Leverage Matchups & Signal Feed */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
          
          {/* Active High Leverage Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00f0ff]">bolt</span>
              <h2 className="font-headline-lg text-[22px] text-[#dae2fd] uppercase tracking-tight font-bold">
                Active High-Leverage Matchups
              </h2>
            </div>
            <button 
              onClick={() => onSelectTab('matchups')}
              className="font-label-caps text-xs text-[#00f0ff] hover:underline transition-all flex items-center gap-1"
            >
              <span>VIEW ALL 14 GAMES</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          {/* Symmetrical Matchup Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sampleMatchups.slice(0, 2).map((matchup) => (
              <div 
                key={matchup.id}
                onClick={() => {
                  onSelectMatchup(matchup);
                  onSelectTab('matchups');
                }}
                className="group relative bg-[#131b2e] rounded-xl overflow-hidden hover:shadow-2xl hover:shadow-[#00f0ff]/10 transition-all duration-300 border border-[#3b494b]/20 cursor-pointer"
              >
                <div className="p-3.5 flex items-center justify-between border-b border-[#3b494b]/20 bg-[#222a3d]/40">
                  <span className="font-label-caps text-[10px] text-[#65f2b5] font-bold">{matchup.gameStatus}</span>
                  <span className="font-label-caps text-[10px] text-[#849495]">{matchup.leverage}</span>
                </div>

                <div className="p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4 relative">
                    {/* Pitcher */}
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <div className="w-20 h-20 rounded-full bg-[#2d3449] flex items-center justify-center p-1 relative overflow-hidden group-hover:scale-105 transition-transform border border-[#00f0ff]/30 shadow-lg">
                        <img 
                          src={matchup.pitcher.avatarUrl} 
                          alt={matchup.pitcher.name} 
                          className="w-full h-full object-cover rounded-full"
                        />
                      </div>
                      <div className="text-center">
                        <p className="font-label-caps text-[#849495] text-[10px] uppercase">{matchup.pitcher.name}</p>
                        <p className="font-headline-lg text-[18px] text-[#00f0ff] font-bold">{matchup.pitcher.team}</p>
                      </div>
                    </div>

                    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col items-center z-10 pointer-events-none">
                      <span className="text-[16px] font-display-lg italic text-[#849495]/40 select-none font-bold">VS</span>
                    </div>

                    {/* Batter */}
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <div className="w-20 h-20 rounded-full bg-[#2d3449] flex items-center justify-center p-1 relative overflow-hidden group-hover:scale-105 transition-transform border border-[#b9c8de]/30 shadow-lg">
                        <img 
                          src={matchup.batter.avatarUrl} 
                          alt={matchup.batter.name} 
                          className="w-full h-full object-cover rounded-full"
                        />
                      </div>
                      <div className="text-center">
                        <p className="font-label-caps text-[#849495] text-[10px] uppercase">{matchup.batter.name}</p>
                        <p className="font-headline-lg text-[18px] text-[#b9c8de] font-bold">{matchup.batter.team}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats Comparison Matrix */}
                  <div className="space-y-2 bg-[#060e20]/60 p-3 rounded-lg border border-[#3b494b]/10">
                    <div className="flex justify-between items-center text-[11px] font-label-caps">
                      <span className="text-[#00f0ff] font-bold">{matchup.pitcherVelo}</span>
                      <span className="text-[#849495]">{matchup.pitcherStatLabel}</span>
                      <span className="text-[#b9c8de] font-bold">{matchup.batterStatVal1}</span>
                    </div>

                    <div className="h-1.5 flex gap-1 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00f0ff] flex-[0.65] rounded-full" />
                      <div className="h-full bg-[#b9c8de] flex-[0.35] rounded-full" />
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-label-caps">
                      <span className="text-[#00f0ff] font-bold">{matchup.pitcherStatVal}</span>
                      <span className="text-[#849495]">{matchup.batterStatLabel}</span>
                      <span className="text-[#b9c8de] font-bold">{matchup.batterStatVal2}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Prospect / Scouting Signal Feed */}
          <div className="bg-[#171f33] p-6 rounded-xl flex flex-col gap-4 border border-[#3b494b]/20 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#65f2b5]">radar</span>
                <h2 className="font-headline-lg text-[20px] text-[#dae2fd] uppercase tracking-tight font-bold">
                  Scouting Signal Feed
                </h2>
              </div>
              <button 
                onClick={() => onSelectTab('scouting-feed')}
                className="text-xs font-label-caps text-[#00f0ff] hover:underline"
              >
                LIVE FEED
              </button>
            </div>

            <div className="space-y-3">
              {scoutingSignals.map((signal) => (
                <div 
                  key={signal.id} 
                  className="flex items-start gap-4 p-4 bg-[#131b2e] rounded-lg border-l-4 border-[#00f0ff] hover:bg-[#222a3d]/50 transition-colors"
                >
                  <div className="w-10 h-10 bg-[#2d3449] rounded-lg flex items-center justify-center shrink-0 text-[#00f0ff]">
                    <span className="material-symbols-outlined">{signal.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className={`font-label-caps text-[10px] uppercase font-bold text-[#00f0ff]`}>
                        {signal.type}
                      </span>
                      <span className="font-label-caps text-[10px] text-[#849495]">{signal.timeAgo}</span>
                    </div>
                    <p className="text-sm text-[#b9cacb] mt-1 leading-relaxed">
                      {signal.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Sidebar (Power Index + Global Trends) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          
          {/* Team Power Index */}
          <div className="bg-[#171f33] rounded-xl overflow-hidden shadow-xl border border-[#3b494b]/20">
            <div className="p-4 bg-[#222a3d] border-b border-[#3b494b]/20 flex justify-between items-center">
              <span className="font-label-caps text-[12px] text-[#00f0ff] tracking-widest font-bold">TEAM POWER INDEX</span>
              <span className="material-symbols-outlined text-[#849495] text-[18px]">bar_chart</span>
            </div>

            <div className="divide-y divide-[#3b494b]/10">
              {teamPowerIndex.map((team) => (
                <div 
                  key={team.code}
                  onClick={() => onSelectTab('team-comparison')}
                  className="group flex items-center gap-4 p-4 hover:bg-[#2d3449]/50 transition-colors cursor-pointer"
                >
                  <span className="font-data-numeric text-[#00f0ff] text-[20px] w-6 font-bold">{team.rank}</span>
                  <div className="w-10 h-10 bg-[#2d3449] rounded-lg flex items-center justify-center font-bold text-[#dae2fd] text-xs font-mono border border-[#3b494b]/30">
                    {team.code}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-caps text-[12px] text-[#dae2fd] truncate font-semibold">{team.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1 bg-[#3b494b]/30 w-full rounded-full overflow-hidden">
                        <div className="h-full bg-[#65f2b5] rounded-full" style={{ width: team.pctWidth }} />
                      </div>
                      <span className="font-data-numeric text-[11px] text-[#65f2b5]">{team.score}</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#849495] group-hover:text-[#00f0ff] transition-colors text-[20px]">
                    swap_horiz
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-[#222a3d]/50 text-center border-t border-[#3b494b]/20">
              <button 
                onClick={() => onSelectTab('team-comparison')}
                className="text-xs font-label-caps text-[#849495] hover:text-[#00f0ff] transition-all font-bold tracking-wider"
              >
                SEE FULL RANKINGS
              </button>
            </div>
          </div>

          {/* Advanced Metrics / Global Trends */}
          <div className="bg-[#060e20] p-6 rounded-xl border border-[#00f0ff]/20 relative overflow-hidden shadow-2xl">
            <div className="absolute -right-8 -bottom-8 opacity-5 pointer-events-none">
              <span className="material-symbols-outlined text-[160px] text-[#00f0ff]">analytics</span>
            </div>
            
            <h3 className="font-label-caps text-[#00f0ff] mb-4 tracking-wider text-xs font-bold uppercase">GLOBAL TRENDS</h3>
            
            <div className="space-y-5 relative z-10">
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-[#849495]">League BABIP</span>
                  <span className="font-data-numeric text-[#dae2fd] text-sm font-bold">.297</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-[#171f33] rounded-full overflow-hidden">
                    <div className="h-full bg-[#00f0ff]" style={{ width: '58%' }} />
                  </div>
                  <span className="material-symbols-outlined text-[#65f2b5] text-[18px]">arrow_drop_up</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-[#849495]">Whiff Rate %</span>
                  <span className="font-data-numeric text-[#dae2fd] text-sm font-bold">25.8%</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-[#171f33] rounded-full overflow-hidden">
                    <div className="h-full bg-[#00f0ff]" style={{ width: '42%' }} />
                  </div>
                  <span className="material-symbols-outlined text-[#ffb4ab] text-[18px]">arrow_drop_down</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-[#849495]">Hard Hit %</span>
                  <span className="font-data-numeric text-[#dae2fd] text-sm font-bold">39.1%</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-[#171f33] rounded-full overflow-hidden">
                    <div className="h-full bg-[#00f0ff]" style={{ width: '76%' }} />
                  </div>
                  <span className="material-symbols-outlined text-[#65f2b5] text-[18px]">arrow_drop_up</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
