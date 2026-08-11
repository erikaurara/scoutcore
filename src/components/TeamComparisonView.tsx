import React, { useState } from 'react';
import { teamComparisonData, TEAM_A_LOGO, TEAM_B_LOGO } from '../data/mockData';

export const TeamComparisonView: React.FC = () => {
  const [selectedMatchupKey, setSelectedMatchupKey] = useState<'lad-nym' | 'nyy-bos' | 'atl-phi'>('lad-nym');

  const matchOptions = {
    'lad-nym': teamComparisonData,
    'nyy-bos': {
      teamA: {
        city: 'NEW YORK',
        name: 'YANKEES',
        code: 'NYY',
        record: '77-59',
        standing: '2nd in League East',
        logoUrl: TEAM_A_LOGO,
        ops: 0.812,
        defEfficiency: 0.705,
        bullpenXFip: 3.65,
        era: 3.52,
      },
      teamB: {
        city: 'BOSTON',
        name: 'RED SOX',
        code: 'BOS',
        record: '71-65',
        standing: '3rd in League East',
        logoUrl: TEAM_B_LOGO,
        ops: 0.792,
        defEfficiency: 0.688,
        bullpenXFip: 4.12,
        era: 4.08,
      },
      winProbA: 58.2,
      winProbB: 41.8,
      keyMatchupNotes: [
        "Yankees' power hitting rating advantages Fenway Park green monster dimensions.",
        "Red Sox bullpen xFIP elevated in last 10 outings.",
      ],
    },
    'atl-phi': {
      teamA: {
        city: 'ATLANTA',
        name: 'BRAVES',
        code: 'ATL',
        record: '81-55',
        standing: '1st in League East',
        logoUrl: TEAM_A_LOGO,
        ops: 0.828,
        defEfficiency: 0.718,
        bullpenXFip: 3.32,
        era: 3.35,
      },
      teamB: {
        city: 'PHILADELPHIA',
        name: 'PHILLIES',
        code: 'PHI',
        record: '78-58',
        standing: '2nd in League East',
        logoUrl: TEAM_B_LOGO,
        ops: 0.805,
        defEfficiency: 0.710,
        bullpenXFip: 3.55,
        era: 3.42,
      },
      winProbA: 54.1,
      winProbB: 45.9,
      keyMatchupNotes: [
        "NLE rivalry matchup with high leverage impact on division standings.",
        "Both teams feature top-5 bullpen xFIP ratings in MLB.",
      ],
    },
  };

  const data = matchOptions[selectedMatchupKey];

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#0b1326] text-[#dae2fd]">
      
      {/* Top Selector Bar */}
      <div className="px-8 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-label-caps text-xs text-[#849495] uppercase">Select Team Matchup:</span>
          <div className="flex bg-[#131b2e] p-1 rounded-xl border border-[#3b494b]/30">
            <button
              onClick={() => setSelectedMatchupKey('lad-nym')}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps transition-all ${
                selectedMatchupKey === 'lad-nym'
                  ? 'bg-[#00f0ff] text-[#00363a] font-bold shadow-[0_2px_8px_rgba(0,240,255,0.3)]'
                  : 'text-[#b9cacb] hover:text-[#dae2fd]'
              }`}
            >
              LAD vs NYM
            </button>
            <button
              onClick={() => setSelectedMatchupKey('nyy-bos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps transition-all ${
                selectedMatchupKey === 'nyy-bos'
                  ? 'bg-[#00f0ff] text-[#00363a] font-bold shadow-[0_2px_8px_rgba(0,240,255,0.3)]'
                  : 'text-[#b9cacb] hover:text-[#dae2fd]'
              }`}
            >
              NYY vs BOS
            </button>
            <button
              onClick={() => setSelectedMatchupKey('atl-phi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps transition-all ${
                selectedMatchupKey === 'atl-phi'
                  ? 'bg-[#00f0ff] text-[#00363a] font-bold shadow-[0_2px_8px_rgba(0,240,255,0.3)]'
                  : 'text-[#b9cacb] hover:text-[#dae2fd]'
              }`}
            >
              ATL vs PHI
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#00f0ff] text-[18px]">verified</span>
          <span className="text-xs font-label-caps text-[#849495]">MODEL CONFIDENCE: HIGH</span>
        </div>
      </div>

      {/* Hero Matchup Logos Header */}
      <section className="relative w-full px-12 py-10 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-[#00f0ff]/20 to-transparent" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#65f2b5]/20 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-row items-center justify-between gap-8">
          {/* Team A */}
          <div className="flex-1 flex flex-col items-end text-right">
            <div className="font-label-caps text-xs text-[#b9cacb] mb-1 tracking-[0.2em] uppercase">
              {data.teamA.city}
            </div>
            <h2 className="font-display-lg text-[48px] text-[#dae2fd] leading-none mb-4 font-bold">
              {data.teamA.name}
            </h2>
            <div className="w-44 h-44 bg-[#222a3d] rounded-full flex items-center justify-center p-6 shadow-2xl group hover:scale-105 transition-transform duration-500 border border-[#00f0ff]/30">
              <img 
                src={data.teamA.logoUrl} 
                alt={data.teamA.name}
                className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(0,219,233,0.4)]"
              />
            </div>
            <div className="mt-6 font-data-numeric text-[56px] text-[#00dbe9] leading-none font-bold">
              {data.teamA.record}
            </div>
            <div className="font-label-caps text-xs text-[#849495] mt-1">{data.teamA.standing}</div>
          </div>

          {/* VS / Probability Center */}
          <div className="flex flex-col items-center gap-4 shrink-0">
            <div className="w-20 h-20 rounded-full border border-[#3b494b]/40 flex items-center justify-center relative bg-[#131b2e]">
              <div className="absolute inset-0 rounded-full border-t-2 border-[#00f0ff] animate-[spin_6s_linear_infinite]" />
              <span className="font-label-caps text-2xl text-[#dae2fd] italic font-bold">VS</span>
            </div>
            <div className="text-center">
              <div className="font-label-caps text-[11px] text-[#849495] mb-1 uppercase">Model Prediction</div>
              <div className="px-5 py-2 bg-[#2d3449] rounded-full shadow-xl border border-[#3b494b]/30 flex items-center gap-2">
                <span className="font-headline-lg text-[#00f0ff] text-xl font-bold">{data.winProbA}%</span>
                <span className="font-body-sm text-xs text-[#b9cacb]">Win Prob</span>
              </div>
            </div>
          </div>

          {/* Team B */}
          <div className="flex-1 flex flex-col items-start text-left">
            <div className="font-label-caps text-xs text-[#b9cacb] mb-1 tracking-[0.2em] uppercase">
              {data.teamB.city}
            </div>
            <h2 className="font-display-lg text-[48px] text-[#dae2fd] leading-none mb-4 font-bold">
              {data.teamB.name}
            </h2>
            <div className="w-44 h-44 bg-[#222a3d] rounded-full flex items-center justify-center p-6 shadow-2xl group hover:scale-105 transition-transform duration-500 border border-[#65f2b5]/30">
              <img 
                src={data.teamB.logoUrl} 
                alt={data.teamB.name}
                className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(78,222,163,0.4)]"
              />
            </div>
            <div className="mt-6 font-data-numeric text-[56px] text-[#4edea3] leading-none font-bold">
              {data.teamB.record}
            </div>
            <div className="font-label-caps text-xs text-[#849495] mt-1">{data.teamB.standing}</div>
          </div>
        </div>
      </section>

      {/* Comparison Metrics Grid */}
      <section className="grid grid-cols-12 gap-6 px-12 mb-12">
        {/* Left Metrics */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          <div className="bg-[#131b2e] p-4 rounded-xl flex flex-col gap-2 border border-[#3b494b]/20 hover:border-[#00f0ff]/40 transition-all">
            <div className="flex justify-between items-end">
              <span className="font-label-caps text-xs text-[#849495] uppercase">Team OPS</span>
              <span className="font-data-numeric text-2xl text-[#00f0ff] font-bold">.{Math.round(data.teamA.ops * 1000)}</span>
            </div>
            <div className="w-full h-1.5 bg-[#2d3449] rounded-full overflow-hidden">
              <div className="h-full bg-[#00f0ff] rounded-full" style={{ width: `${data.teamA.ops * 100}%` }} />
            </div>
          </div>

          <div className="bg-[#131b2e] p-4 rounded-xl flex flex-col gap-2 border border-[#3b494b]/20 hover:border-[#00f0ff]/40 transition-all">
            <div className="flex justify-between items-end">
              <span className="font-label-caps text-xs text-[#849495] uppercase">Def. Efficiency</span>
              <span className="font-data-numeric text-2xl text-[#00f0ff] font-bold">.{Math.round(data.teamA.defEfficiency * 1000)}</span>
            </div>
            <div className="w-full h-1.5 bg-[#2d3449] rounded-full overflow-hidden">
              <div className="h-full bg-[#00f0ff] rounded-full" style={{ width: `${data.teamA.defEfficiency * 100}%` }} />
            </div>
          </div>

          <div className="bg-[#131b2e] p-4 rounded-xl flex flex-col gap-2 border border-[#3b494b]/20 hover:border-[#00f0ff]/40 transition-all">
            <div className="flex justify-between items-end">
              <span className="font-label-caps text-xs text-[#849495] uppercase">Bullpen xFIP</span>
              <span className="font-data-numeric text-2xl text-[#00f0ff] font-bold">{data.teamA.bullpenXFip}</span>
            </div>
            <div className="w-full h-1.5 bg-[#2d3449] rounded-full overflow-hidden">
              <div className="h-full bg-[#00f0ff] rounded-full" style={{ width: '78%' }} />
            </div>
          </div>
        </div>

        {/* Win Probability Trend (Center Chart) */}
        <div className="col-span-12 lg:col-span-4 bg-[#131b2e] rounded-xl p-5 flex flex-col border border-[#3b494b]/20 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="font-label-caps text-xs text-[#dae2fd] uppercase font-bold">Win Probability Trend</span>
            <span className="material-symbols-outlined text-[#849495]">trending_up</span>
          </div>

          {/* Bar Chart Visualization */}
          <div className="flex-1 flex items-end justify-between gap-1.5 h-44 px-2 pt-4">
            <div className="w-full h-12 bg-[#00f0ff]/20 rounded-t-sm" />
            <div className="w-full h-16 bg-[#00f0ff]/30 rounded-t-sm" />
            <div className="w-full h-24 bg-[#00f0ff]/40 rounded-t-sm" />
            <div className="w-full h-20 bg-[#00f0ff]/30 rounded-t-sm" />
            <div className="w-full h-28 bg-[#00f0ff]/50 rounded-t-sm" />
            <div className="w-full h-36 bg-[#00f0ff]/60 rounded-t-sm" />
            <div className="w-full h-32 bg-[#00f0ff]/50 rounded-t-sm" />
            <div className="w-full h-40 bg-[#00f0ff]/80 rounded-t-sm border-t-2 border-[#00f0ff]" />
            <div className="w-full h-36 bg-[#65f2b5]/30 rounded-t-sm" />
            <div className="w-full h-24 bg-[#65f2b5]/20 rounded-t-sm" />
            <div className="w-full h-12 bg-[#65f2b5]/10 rounded-t-sm" />
            <div className="w-full h-8 bg-[#65f2b5]/5 rounded-t-sm" />
          </div>

          <div className="flex justify-between mt-3 border-t border-[#3b494b]/20 pt-2">
            <span className="font-label-caps text-[10px] text-[#849495]">INNING 1</span>
            <span className="font-label-caps text-[10px] text-[#00f0ff] font-bold">CURRENT</span>
            <span className="font-label-caps text-[10px] text-[#849495]">FINAL</span>
          </div>
        </div>

        {/* Right Metrics */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          <div className="bg-[#131b2e] p-4 rounded-xl flex flex-col gap-2 border border-[#3b494b]/20 hover:border-[#65f2b5]/40 transition-all">
            <div className="flex justify-between items-end">
              <span className="font-label-caps text-xs text-[#849495] uppercase">Team ERA</span>
              <span className="font-data-numeric text-2xl text-[#65f2b5] font-bold">{data.teamB.era}</span>
            </div>
            <div className="w-full h-1.5 bg-[#2d3449] rounded-full overflow-hidden">
              <div className="h-full bg-[#65f2b5] rounded-full" style={{ width: '88%' }} />
            </div>
          </div>

          <div className="bg-[#131b2e] p-4 rounded-xl flex flex-col gap-2 border border-[#3b494b]/20 hover:border-[#65f2b5]/40 transition-all">
            <div className="flex justify-between items-end">
              <span className="font-label-caps text-xs text-[#849495] uppercase">Def. Efficiency</span>
              <span className="font-data-numeric text-2xl text-[#65f2b5] font-bold">.{Math.round(data.teamB.defEfficiency * 1000)}</span>
            </div>
            <div className="w-full h-1.5 bg-[#2d3449] rounded-full overflow-hidden">
              <div className="h-full bg-[#65f2b5] rounded-full" style={{ width: `${data.teamB.defEfficiency * 100}%` }} />
            </div>
          </div>

          <div className="bg-[#131b2e] p-4 rounded-xl flex flex-col gap-2 border border-[#3b494b]/20 hover:border-[#65f2b5]/40 transition-all">
            <div className="flex justify-between items-end">
              <span className="font-label-caps text-xs text-[#849495] uppercase">Bullpen xFIP</span>
              <span className="font-data-numeric text-2xl text-[#65f2b5] font-bold">{data.teamB.bullpenXFip}</span>
            </div>
            <div className="w-full h-1.5 bg-[#2d3449] rounded-full overflow-hidden">
              <div className="h-full bg-[#65f2b5] rounded-full" style={{ width: '62%' }} />
            </div>
          </div>
        </div>
      </section>

      {/* Analytical Breakdown Notes */}
      <section className="px-12 pb-12">
        <div className="p-6 bg-[#171f33] rounded-xl border border-[#3b494b]/20 shadow-xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00f0ff]">lightbulb</span>
            <h3 className="font-headline-lg text-sm uppercase text-[#dae2fd] font-bold">ScoutCore Matchup Insights</h3>
          </div>
          <ul className="space-y-2 text-xs text-[#b9cacb] pl-6 list-disc">
            {data.keyMatchupNotes.map((note, idx) => (
              <li key={idx} className="leading-relaxed">{note}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
};
