import React, { useEffect, useMemo, useState } from 'react';
import type { MlbScheduleGame } from '../services/mlbApi';
import { mlbTeamLogoUrl } from '../services/mlbMedia';

const toDateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const displayDate = (dateKey: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }).format(new Date(`${dateKey}T12:00:00Z`));
const shiftDate = (dateKey: string, days: number) => { const d = new Date(`${dateKey}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return toDateKey(d); };
const gameTime = (game: MlbScheduleGame) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }).format(new Date(game.gameDate));

function mapGame(game: any): MlbScheduleGame {
  const team = (side: 'away' | 'home') => game.teams?.[side]?.team ?? {};
  const probable = (side: 'away' | 'home') => game.teams?.[side]?.probablePitcher;
  return {
    gamePk: game.gamePk,
    gameDate: game.gameDate,
    status: game.status?.abstractGameState ?? 'Unknown',
    detailedState: game.status?.detailedState ?? 'Unknown',
    awayTeam: { id: team('away').id, name: team('away').name ?? 'Away Team', abbreviation: team('away').abbreviation },
    homeTeam: { id: team('home').id, name: team('home').name ?? 'Home Team', abbreviation: team('home').abbreviation },
    awayScore: game.teams?.away?.score,
    homeScore: game.teams?.home?.score,
    awayProbablePitcher: probable('away')?.id ? { id: probable('away').id, name: probable('away').fullName ?? 'TBD' } : undefined,
    homeProbablePitcher: probable('home')?.id ? { id: probable('home').id, name: probable('home').fullName ?? 'TBD' } : undefined,
  };
}

export const ScheduleView: React.FC = () => {
  const [date, setDate] = useState(toDateKey(new Date()));
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [filter, setFilter] = useState<'all' | 'live' | 'final' | 'scheduled'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=team,linescore,probablePitcher`);
      if (!response.ok) throw new Error('Unable to load MLB schedule.');
      const data = await response.json();
      setGames((data.dates ?? []).flatMap((day: any) => (day.games ?? []).map(mapGame)));
      setUpdatedAt(new Date());
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load schedule.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [date]);
  useEffect(() => { const id = window.setInterval(load, 5 * 60 * 1000); return () => window.clearInterval(id); }, [date]);

  const visibleGames = useMemo(() => games.filter((game) => {
    if (filter === 'all') return true;
    if (filter === 'live') return game.status === 'Live';
    if (filter === 'final') return game.detailedState === 'Final' || game.status === 'Final';
    return game.status !== 'Live' && game.detailedState !== 'Final' && game.status !== 'Final';
  }), [games, filter]);

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <section className="flex flex-col xl:flex-row xl:items-end justify-between gap-5 border-b border-[#3b494b]/20 pb-6">
      <div className="flex items-center gap-4"><div className="w-14 h-14 rounded-2xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center"><span className="material-symbols-outlined text-[#00f0ff] text-3xl">calendar_month</span></div><div><span className="font-label-caps text-[10px] text-[#65f2b5]">LIVE MLB DATA</span><h1 className="font-display-lg text-4xl text-[#dbfcff]">MLB Schedule</h1><p className="text-sm text-[#849495] mt-1">Daily games and results in ScoutCore's own design.</p></div></div>
      <div className="flex items-center gap-4 text-xs"><span className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-[#ff5c68]"/>Live</span><span className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-[#00f0ff]"/>Final</span><span className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-[#527aa1]"/>Scheduled</span></div>
    </section>

    <section className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between bg-[#131b2e] border border-[#3b494b]/20 rounded-xl p-4">
      <div className="flex items-center"><button onClick={() => setDate(shiftDate(date, -1))} className="p-3 rounded-l-lg bg-[#171f33] border border-[#3b494b]/30 hover:text-[#00f0ff]"><span className="material-symbols-outlined">chevron_left</span></button><button onClick={() => setDate(toDateKey(new Date()))} className="px-5 py-3 bg-[#171f33] border-y border-[#3b494b]/30 text-sm font-bold">{displayDate(date)}</button><button onClick={() => setDate(shiftDate(date, 1))} className="p-3 rounded-r-lg bg-[#171f33] border border-[#3b494b]/30 hover:text-[#00f0ff]"><span className="material-symbols-outlined">chevron_right</span></button></div>
      <div className="flex flex-wrap gap-2">{(['all','live','final','scheduled'] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${filter === item ? 'bg-[#00f0ff] text-[#002022]' : 'bg-[#171f33] text-[#b9cacb] border border-[#3b494b]/30'}`}>{item}</button>)}</div>
    </section>

    <div className="flex items-center justify-between"><h2 className="font-headline-lg text-2xl font-bold">{displayDate(date)}</h2><span className="text-[10px] text-[#849495]">{updatedAt ? `UPDATED ${updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</span></div>
    {error && <div className="p-4 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-[#ffb4ab]">{error}</div>}
    {loading ? <div className="p-10 text-center text-[#849495] bg-[#171f33] rounded-xl">Loading MLB schedule…</div> : visibleGames.length === 0 ? <div className="p-10 text-center text-[#849495] bg-[#171f33] rounded-xl">No games match this filter.</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">{visibleGames.map((game) => <GameCard key={game.gamePk} game={game} />)}</div>}
    <div className="text-[11px] text-[#849495] flex gap-4"><span>All game times shown in Eastern Time (ET).</span><span>Scores refresh automatically.</span></div>
  </div>;
};

const GameCard = ({ game }: { game: MlbScheduleGame }) => {
  const isFinal = game.detailedState === 'Final' || game.status === 'Final';
  const isLive = game.status === 'Live';
  const status = isFinal ? 'FINAL' : isLive ? 'LIVE' : game.detailedState === 'Postponed' ? 'POSTPONED' : gameTime(game);
  return <div className="bg-[#131b2e] border border-[#3b494b]/25 rounded-xl overflow-hidden hover:border-[#00f0ff]/40 transition-colors">
    <div className="px-4 py-3 border-b border-[#3b494b]/20 flex items-center justify-between"><span className={`font-label-caps text-[10px] font-bold ${isLive ? 'text-[#ff5c68]' : isFinal ? 'text-[#00f0ff]' : 'text-[#b9cacb]'}`}>{status}</span><span className="material-symbols-outlined text-[#849495] text-lg">star</span></div>
    <div className="p-4 space-y-4"><TeamRow team={game.awayTeam} score={game.awayScore} /><TeamRow team={game.homeTeam} score={game.homeScore} /><div className="pt-3 border-t border-[#3b494b]/20"><p className="text-[9px] text-[#849495] font-label-caps">PROBABLE STARTERS</p><p className="text-xs text-[#b9cacb] mt-1 truncate">{game.awayProbablePitcher?.name ?? 'TBD'} <span className="text-[#849495]">vs</span> {game.homeProbablePitcher?.name ?? 'TBD'}</p></div></div>
  </div>;
};
const TeamRow = ({ team, score }: { team: MlbScheduleGame['awayTeam']; score?: number }) => <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-white/95 p-1.5 flex items-center justify-center"><img src={mlbTeamLogoUrl(team.id)} alt={`${team.name} logo`} className="max-w-full max-h-full object-contain" /></div><div className="min-w-0 flex-1"><p className="font-bold text-sm truncate">{team.name}</p><p className="text-[10px] text-[#849495]">{team.abbreviation ?? ''}</p></div><span className="font-data-numeric text-2xl text-[#dbfcff]">{score ?? '—'}</span></div>;
