import React, { useEffect, useState } from 'react';

export const ScoutingFeedView: React.FC = () => {
  const [signals, setSignals] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const response = await fetch('/api/analytics/today');
      const data = response.ok ? await response.json() : { games: [] };
      const rows = (data.games ?? []).flatMap((game: any) => game.teams?.flatMap((team: any) => team.matchups?.filter((m: any) => m.analysis).map((m: any) => {
        const score = m.analysis.score;
        const type = score >= 65 ? 'MATCHUP EDGE' : score <= 35 ? 'PITCHER EDGE' : 'NEUTRAL';
        const severity = score >= 75 || score <= 25 ? 'HIGH' : 'MEDIUM';
        return { id: `${game.gamePk}-${team.side}-${m.batter.id}`, player: m.batter.name, team: team.team, score, confidence: m.analysis.confidence, type, severity, description: `${type === 'MATCHUP EDGE' ? 'Strong offensive matchup signal' : type === 'PITCHER EDGE' ? 'Pitching suppression signal' : 'Balanced matchup'} based on available season OPS/AVG/SLG and opposing pitcher ERA/WHIP/K9.` };
      }) ?? []) ?? []);
      setSignals(rows.sort((a: any, b: any) => Math.abs(b.score - 50) - Math.abs(a.score - 50)));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); const timer = window.setInterval(load, 10 * 60 * 1000); return () => window.clearInterval(timer); }, []);
  const filtered = signals.filter((s) => filter === 'ALL' || s.type === filter);

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div className="flex flex-wrap justify-between gap-4 border-b border-[#3b494b]/20 pb-6"><div><span className="font-label-caps text-xs text-[#00f0ff]">AUTOMATED LIVE FEED</span><h1 className="font-display-lg text-4xl">Scouting Signal Feed</h1><p className="text-sm text-[#849495] mt-1">Signals are generated from verified MLB data; they are not fabricated news alerts.</p></div><div className="flex gap-2 bg-[#131b2e] p-1.5 rounded-xl">{['ALL','MATCHUP EDGE','PITCHER EDGE','NEUTRAL'].map((cat) => <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 rounded-lg text-xs ${filter === cat ? 'bg-[#00f0ff] text-[#00363a] font-bold' : 'text-[#849495]'}`}>{cat}</button>)}</div></div>
    {loading ? <div className="text-[#849495]">Generating signals…</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filtered.map((signal) => <div key={signal.id} className="p-5 bg-[#171f33] rounded-xl border border-[#3b494b]/20"><div className="flex justify-between"><span className="text-[10px] text-[#00f0ff] font-bold">{signal.type}</span><span className={`text-[10px] ${signal.severity === 'HIGH' ? 'text-[#ffb4ab]' : 'text-[#65f2b5]'}`}>{signal.severity}</span></div><h3 className="font-bold mt-2">{signal.player} <span className="text-[#849495] font-normal">· {signal.team}</span></h3><p className="text-xs text-[#b9cacb] mt-2 leading-relaxed">{signal.description}</p><div className="flex gap-5 mt-4 text-[10px] text-[#849495]"><span>MODEL SCORE <b className="text-[#dbfcff]">{signal.score}</b></span><span>CONFIDENCE <b className="text-[#65f2b5]">{signal.confidence}%</b></span></div></div>)}{!filtered.length && <div className="col-span-full p-8 bg-[#171f33] rounded-xl text-center text-[#849495]">No signals match this filter.</div>}</div>}
  </div>;
};
