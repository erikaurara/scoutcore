import React, { useState } from 'react';
import { scoutingSignals } from '../data/mockData';

export const ScoutingFeedView: React.FC = () => {
  const [filter, setFilter] = useState<string>('ALL');

  const extraSignals = [
    ...scoutingSignals,
    {
      id: 'sig-5',
      type: 'PROSPECT ALERT' as const,
      title: 'Exit Velocity Peak',
      player: 'Roman Anthony (BOS)',
      team: 'BOS',
      timeAgo: '1h ago',
      description: 'Recorded 115.4 MPH exit velocity home run in Triple-A Worcester. Highest recorded in Red Sox farm system this season.',
      severity: 'high' as const,
      icon: 'star',
      accentColor: 'border-[#65f2b5] text-[#65f2b5]',
    },
    {
      id: 'sig-6',
      type: 'PERFORMANCE SPIKE' as const,
      title: 'Whiff Rate Dominance',
      player: 'Chase Burns (CIN)',
      team: 'CIN',
      timeAgo: '2h ago',
      description: 'Slider generated 62% whiff rate in 6-inning start (12 Ks). Vertical break improved by 2.4 inches.',
      severity: 'high' as const,
      icon: 'auto_graph',
      accentColor: 'border-[#00f0ff] text-[#00f0ff]',
    },
  ];

  const filtered = extraSignals.filter(s => filter === 'ALL' || s.type === filter);

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3b494b]/20 pb-6">
        <div>
          <span className="font-label-caps text-xs text-[#00f0ff] uppercase tracking-widest font-bold">
            Real-Time Intelligence
          </span>
          <h1 className="font-display-lg text-[36px] text-[#dae2fd] font-bold leading-tight">
            Scouting Signal Feed
          </h1>
          <p className="text-sm text-[#b9cacb]">
            Live automated Statcast alerts, scout radar tags, and physical metric deviations.
          </p>
        </div>

        <div className="flex gap-2 bg-[#131b2e] p-1.5 rounded-xl border border-[#3b494b]/30">
          {['ALL', 'PERFORMANCE SPIKE', 'PROSPECT ALERT', 'VELOCITY DEVIATION'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps transition-all ${
                filter === cat
                  ? 'bg-[#00f0ff] text-[#00363a] font-bold'
                  : 'text-[#849495] hover:text-[#dae2fd]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Signal list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((signal) => (
          <div 
            key={signal.id}
            className="p-5 bg-[#171f33] rounded-xl border border-[#3b494b]/20 hover:border-[#00f0ff]/40 transition-all flex items-start gap-4 shadow-lg"
          >
            <div className="w-12 h-12 bg-[#222a3d] rounded-xl flex items-center justify-center shrink-0 text-[#00f0ff] border border-[#3b494b]/30">
              <span className="material-symbols-outlined text-[24px]">{signal.icon}</span>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-label-caps text-xs text-[#00f0ff] font-bold uppercase">{signal.type}</span>
                <span className="font-label-caps text-[10px] text-[#849495]">{signal.timeAgo}</span>
              </div>
              <h3 className="font-headline-lg text-sm text-[#dae2fd] font-bold">{signal.player}</h3>
              <p className="text-xs text-[#b9cacb] leading-relaxed">{signal.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
