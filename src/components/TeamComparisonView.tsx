import React, { useEffect, useState } from 'react';

export const TeamComparisonView: React.FC = () => {
  const [games, setGames] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/games/today').then((r) => r.json()).then((data) => { const next = data.games ?? []; setGames(next); setSelected(next[0]?.gamePk ?? null); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/games/${selected}/analytics`).then((r) => r.json()).then(setAnalytics).catch(() => setAnalytics(null));
  }, [selected]);

  const side = (name: 'away' | 'home') => analytics?.teams?.find((team: any) => team.side === name);
  const away = side('away');
  const home = side('home');
  const average = (team: any) => team?.matchups?.length ? team.matchups.reduce((sum: number, m: any) => sum + (m.analysis?.score ?? 0), 0) / team.matchups.length : null;

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div><span className="font-label-caps text-xs text-[#65f2b5]">LIVE TEAM VIEW</span><h1 className="font-display-lg text-4xl">Team Comparison</h1><p className="text-sm text-[#849495] mt-1">Compare today's scheduled opponents using live game and matchup data.</p></div>
    <select value={selected ?? ''} onChange={(e) => setSelected(Number(e.target.value))} className="bg-[#171f33] border border-[#3b494b]/40 text-sm text-[#00f0ff] rounded-lg px-3 py-2">{games.map((game) => <option key={game.gamePk} value={game.gamePk}>{game.awayTeam.name} vs {game.homeTeam.name}</option>)}</select>
    {loading && <p className="text-[#849495]">Loading games…</p>}
    {analytics && away && home && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {[away, home].map((team: any) => <div key={team.side} className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-6"><span className="text-[10px] text-[#849495]">{team.side.toUpperCase()}</span><h2 className="font-display-lg text-3xl mt-1">{team.team}</h2><div className="mt-6"><p className="text-[10px] text-[#849495]">STARTING PITCHER</p><p className="font-bold text-lg">{team.pitcher?.name ?? 'TBD'}</p><p className="text-xs text-[#849495]">ERA {team.pitcher?.stats?.era ?? '—'} · WHIP {team.pitcher?.stats?.whip ?? '—'} · K/9 {team.pitcher?.stats?.strikeoutsPer9Inn ?? '—'}</p></div><div className="mt-6"><p className="text-[10px] text-[#849495]">AVERAGE MATCHUP SCORE</p><p className="font-data-numeric text-4xl text-[#00f0ff]">{average(team)?.toFixed(1) ?? '—'}</p></div><div className="mt-6 space-y-2">{team.matchups?.slice(0,5).map((m: any) => <div key={m.batter.id} className="flex justify-between text-xs bg-[#131b2e] rounded-lg p-2"><span>{m.batter.name}</span><b className="text-[#65f2b5]">{m.analysis?.score ?? '—'}</b></div>)}</div></div>)}
      <div className="bg-[#131b2e] rounded-xl border border-[#3b494b]/20 p-6 flex flex-col justify-center"><span className="text-[10px] text-[#849495]">SCOUTCORE READ</span><h2 className="font-headline-lg text-2xl mt-2">{(average(away) ?? 0) > (average(home) ?? 0) ? away.team : home.team} has the higher current matchup index.</h2><p className="text-sm text-[#849495] mt-3">This is a matchup index, not a guaranteed win probability. Confidence depends on how much verified data is available.</p><div className="mt-5 text-xs text-[#65f2b5]">DATA QUALITY: {analytics.summary?.dataQuality ?? 0}%</div></div>
    </div>}
    {!games.length && !loading && <div className="p-8 bg-[#171f33] rounded-xl text-center text-[#849495]">No games scheduled today.</div>}
  </div>;
};
