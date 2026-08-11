import React, { useEffect, useState } from 'react';

interface GameLogsViewProps { onOpenReport: () => void; }

export const GameLogsView: React.FC<GameLogsViewProps> = ({ onOpenReport }) => {
  const [games, setGames] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [feed, setFeed] = useState<any>(null);

  const load = async () => {
    const response = await fetch('/api/games/today');
    const data = response.ok ? await response.json() : { games: [] };
    setGames(data.games ?? []);
    setSelected((current: any) => current ?? data.games?.[0] ?? null);
  };

  useEffect(() => { load(); const timer = window.setInterval(load, 5 * 60 * 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (selected) fetch(`/api/games/${selected.gamePk}`).then((r) => r.json()).then(setFeed).catch(() => setFeed(null)); }, [selected]);

  const lines = feed?.liveData?.linescore;
  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div className="flex justify-between items-start gap-4"><div><span className="font-label-caps text-xs text-[#65f2b5]">LIVE GAME LOG</span><h1 className="font-display-lg text-4xl">Game Logs</h1><p className="text-sm text-[#849495] mt-1">Actual MLB game state, score, inning and team data from today's schedule.</p></div><button onClick={onOpenReport} className="px-4 py-2 rounded-lg bg-[#00f0ff] text-[#002022] font-bold text-xs">SCOUT REPORT</button></div>
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-3 space-y-2">{games.map((game) => <button key={game.gamePk} onClick={() => setSelected(game)} className={`w-full text-left p-3 rounded-lg ${selected?.gamePk === game.gamePk ? 'bg-[#00f0ff]/10 border border-[#00f0ff]/30' : 'bg-[#131b2e]'}`}><p className="text-xs font-bold">{game.awayTeam.abbreviation ?? game.awayTeam.name} @ {game.homeTeam.abbreviation ?? game.homeTeam.name}</p><p className="text-[10px] text-[#849495] mt-1">{game.detailedState} · {game.awayScore ?? '—'} - {game.homeScore ?? '—'}</p></button>)}{!games.length && <p className="text-xs text-[#849495] p-3">No games today.</p>}</div>
      <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-6">{selected ? <><div className="flex justify-between items-center"><div><span className="text-[10px] text-[#849495]">{selected.detailedState}</span><h2 className="font-display-lg text-3xl">{selected.awayTeam.name} @ {selected.homeTeam.name}</h2></div><span className="font-data-numeric text-3xl text-[#00f0ff]">{selected.awayScore ?? 0} — {selected.homeScore ?? 0}</span></div><div className="grid grid-cols-2 gap-4 mt-8"><Info label="INNING" value={lines?.currentInning ?? '—'} /><Info label="HALF" value={lines?.inningHalf ?? '—'} /><Info label="OUTS" value={lines?.outs ?? '—'} /><Info label="STATUS" value={selected.detailedState} /></div><div className="mt-8 p-4 bg-[#131b2e] rounded-lg text-xs text-[#849495]">This panel is backed by the live MLB game feed and refreshes every 5 minutes.</div></> : <p className="text-[#849495]">Select a game.</p>}</div>
    </div>
  </div>;
};

const Info = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="bg-[#131b2e] rounded-lg p-4"><span className="text-[9px] text-[#849495]">{label}</span><p className="font-bold text-lg mt-1">{value}</p></div>;
