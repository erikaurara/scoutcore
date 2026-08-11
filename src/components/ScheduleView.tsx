import React, { useEffect, useMemo, useState } from 'react';
import type { MlbScheduleGame } from '../services/mlbApi';
import { mlbTeamLogoUrl } from '../services/mlbMedia';

const toDateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const displayDate = (dateKey: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }).format(new Date(`${dateKey}T12:00:00Z`));
const displayMonth = (dateKey: string) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' }).format(new Date(`${dateKey}T12:00:00Z`));
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(`${toDateKey(new Date())}T12:00:00Z`));

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

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <section className="flex flex-col xl:flex-row xl:items-end justify-between gap-5 border-b border-[#3b494b]/20 pb-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center"><span className="material-symbols-outlined text-[#00f0ff] text-3xl">calendar_month</span></div>
        <div><span className="font-label-caps text-xs text-[#65f2b5]">LIVE MLB DATA</span><h1 className="font-display-lg text-4xl text-[#dbfcff]">MLB Schedule</h1><p className="text-base text-[#9aa9aa] mt-1">Daily games and results in ScoutCore's own design.</p></div>
      </div>
      <div className="flex items-center gap-5 text-sm font-semibold"><span className="flex items-center gap-2.5"><i className="w-3 h-3 rounded-full bg-[#ff5c68]"/>Live</span><span className="flex items-center gap-2.5"><i className="w-3 h-3 rounded-full bg-[#00f0ff]"/>Final</span></div>
    </section>

    <section className="relative bg-[#131b2e] border border-[#3b494b]/20 rounded-xl p-4">
      <div className="flex items-center max-w-max">
        <button onClick={() => setDate(shiftDate(date, -1))} className="p-3 rounded-l-lg bg-[#171f33] border border-[#3b494b]/30 hover:text-[#00f0ff]" aria-label="Previous day"><span className="material-symbols-outlined text-2xl">chevron_left</span></button>
        <button onClick={() => { setCalendarMonth(new Date(`${date}T12:00:00Z`)); setCalendarOpen(v => !v); }} className="px-7 py-3 bg-[#171f33] border-y border-[#3b494b]/30 text-base md:text-lg font-bold hover:text-[#00f0ff] min-w-[280px]">{displayDate(date)} <span className="material-symbols-outlined align-middle text-lg ml-2">expand_more</span></button>
        <button onClick={() => setDate(shiftDate(date, 1))} className="p-3 rounded-r-lg bg-[#171f33] border border-[#3b494b]/30 hover:text-[#00f0ff]" aria-label="Next day"><span className="material-symbols-outlined text-2xl">chevron_right</span></button>
      </div>
      {calendarOpen && <MonthCalendar month={calendarMonth} selectedDate={date} onChangeMonth={setCalendarMonth} onSelect={(key) => { setDate(key); setCalendarOpen(false); }} />}
    </section>

    <div className="flex items-center justify-between"><h2 className="font-headline-lg text-3xl font-bold">{displayDate(date)}</h2><span className="text-xs text-[#849495]">{updatedAt ? `UPDATED ${updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</span></div>
    {error && <div className="p-4 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-[#ffb4ab] text-base">{error}</div>}
    {loading ? <div className="p-10 text-center text-[#9aa9aa] text-base bg-[#171f33] rounded-xl">Loading MLB schedule…</div> : games.length === 0 ? <div className="p-10 text-center text-[#9aa9aa] text-base bg-[#171f33] rounded-xl">No MLB games are scheduled for this date.</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">{games.map((game) => <GameCard key={game.gamePk} game={game} />)}</div>}
    <div className="text-sm text-[#849495] flex gap-5"><span>All game times shown in Eastern Time (ET).</span><span>Scores refresh automatically.</span></div>
  </div>;
};

const MonthCalendar = ({ month, selectedDate, onChangeMonth, onSelect }: { month: Date; selectedDate: string; onChangeMonth: (d: Date) => void; onSelect: (key: string) => void }) => {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const first = new Date(Date.UTC(year, monthIndex, 1, 12));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
  const leading = first.getUTCDay();
  const cells = Array.from({ length: leading + daysInMonth }, (_, i) => i < leading ? null : i - leading + 1);
  const moveMonth = (amount: number) => onChangeMonth(new Date(Date.UTC(year, monthIndex + amount, 1, 12)));
  const today = toDateKey(new Date());

  return <div className="absolute z-50 top-[76px] left-4 w-[360px] max-w-[calc(100vw-5rem)] bg-[#10192b] border border-[#30415c] rounded-xl shadow-2xl p-4">
    <div className="flex items-center justify-between mb-4"><button onClick={() => moveMonth(-1)} className="w-10 h-10 rounded-lg bg-[#171f33] hover:text-[#00f0ff]"><span className="material-symbols-outlined">chevron_left</span></button><h3 className="text-lg font-bold">{displayMonth(toDateKey(month))}</h3><button onClick={() => moveMonth(1)} className="w-10 h-10 rounded-lg bg-[#171f33] hover:text-[#00f0ff]"><span className="material-symbols-outlined">chevron_right</span></button></div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-[#849495] mb-2">{['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => <span key={d}>{d}</span>)}</div>
    <div className="grid grid-cols-7 gap-1">{cells.map((day, i) => {
      if (!day) return <div key={`blank-${i}`} className="h-10"/>;
      const key = `${year}-${String(monthIndex + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const selected = key === selectedDate;
      const isToday = key === today;
      return <button key={key} onClick={() => onSelect(key)} className={`h-10 rounded-lg text-sm font-semibold transition-colors ${selected ? 'bg-[#00f0ff] text-[#002022]' : isToday ? 'border border-[#00f0ff]/60 text-[#00f0ff] hover:bg-[#17243a]' : 'hover:bg-[#17243a] text-[#d7e0f5]'}`}>{day}</button>;
    })}</div>
    <button onClick={() => onSelect(today)} className="mt-4 w-full py-2.5 rounded-lg bg-[#171f33] text-[#00f0ff] text-sm font-bold hover:bg-[#1d2940]">TODAY</button>
  </div>;
};

const GameCard = ({ game }: { game: MlbScheduleGame }) => {
  const isFinal = game.detailedState === 'Final' || game.status === 'Final';
  const isLive = game.status === 'Live';
  const status = isFinal ? 'FINAL' : isLive ? 'LIVE' : game.detailedState === 'Postponed' ? 'POSTPONED' : gameTime(game);
  return <div className="bg-[#131b2e] border border-[#3b494b]/25 rounded-xl overflow-hidden hover:border-[#00f0ff]/40 transition-colors">
    <div className="px-4 py-3 border-b border-[#3b494b]/20 flex items-center justify-between"><span className={`flex items-center gap-2 font-label-caps text-sm font-bold ${isLive ? 'text-[#ff5c68]' : isFinal ? 'text-[#00f0ff]' : 'text-[#c7d2d3]'}`}>{(isLive || isFinal) && <i className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-[#ff5c68]' : 'bg-[#00f0ff]'}`}/>} {status}</span><span className="material-symbols-outlined text-[#849495] text-xl">star</span></div>
    <div className="p-4 space-y-4"><TeamRow team={game.awayTeam} score={game.awayScore} /><TeamRow team={game.homeTeam} score={game.homeScore} /><div className="pt-3 border-t border-[#3b494b]/20"><p className="text-xs text-[#849495] font-label-caps">PROBABLE STARTERS</p><p className="text-sm text-white mt-1 truncate">{game.awayProbablePitcher?.name ?? 'TBD'} <span className="text-[#849495]">vs</span> {game.homeProbablePitcher?.name ?? 'TBD'}</p></div></div>
  </div>;
};
const TeamRow = ({ team, score }: { team: MlbScheduleGame['awayTeam']; score?: number }) => <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-white/95 p-1.5 flex items-center justify-center"><img src={mlbTeamLogoUrl(team.id)} alt={`${team.name} logo`} className="max-w-full max-h-full object-contain" /></div><div className="min-w-0 flex-1"><p className="font-bold text-base truncate">{team.name}</p><p className="text-xs text-[#849495]">{team.abbreviation ?? ''}</p></div><span className="font-data-numeric text-3xl text-[#dbfcff]">{score ?? '—'}</span></div>;
