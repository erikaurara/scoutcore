import React, { useEffect, useMemo, useState } from 'react';
import type { MlbScheduleGame } from '../services/mlbApi';
import { mlbTeamLogoUrl } from '../services/mlbMedia';
import { supabase } from '../services/supabaseClient';

type ScheduleFilter = 'All' | 'My Team' | 'Following' | 'Live' | 'Upcoming' | 'Final';
type TimeMode = 'ET' | 'Local';

interface ScheduleViewProps {
  onOpenGame: (game: MlbScheduleGame) => void;
  onOpenTeam: (teamId: number) => void;
}

const toDateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

const displayDate = (dateKey: string) => new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
}).format(new Date(`${dateKey}T12:00:00Z`));

const displayMonth = (dateKey: string) => new Intl.DateTimeFormat('en-US', {
  month: 'long', year: 'numeric', timeZone: 'America/New_York',
}).format(new Date(`${dateKey}T12:00:00Z`));

const shiftDate = (dateKey: string, days: number) => {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
};

const gameTime = (game: MlbScheduleGame, mode: TimeMode) => new Intl.DateTimeFormat('en-US', mode === 'ET'
  ? { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }
  : { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }
).format(new Date(game.gameDate));

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

const localFollowKey = 'scoutcore:followed-games';

export const ScheduleView: React.FC<ScheduleViewProps> = ({ onOpenGame, onOpenTeam }) => {
  const [date, setDate] = useState(toDateKey(new Date()));
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(`${toDateKey(new Date())}T12:00:00Z`));
  const [filter, setFilter] = useState<ScheduleFilter>('All');
  const [timeMode, setTimeMode] = useState<TimeMode>('ET');
  const [followedGames, setFollowedGames] = useState<Set<number>>(new Set());
  const [accountUser, setAccountUser] = useState<any | null>(null);
  const [favoriteTeamId, setFavoriteTeamId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=team,linescore,probablePitcher`);
      if (!response.ok) throw new Error('Unable to load MLB schedule.');
      const data = await response.json();
      setGames((data.dates ?? []).flatMap((day: any) => (day.games ?? []).map(mapGame)));
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [date]);
  useEffect(() => {
    const id = window.setInterval(() => void load(), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [date]);

  useEffect(() => {
    let localIds: number[] = [];
    try {
      const raw = window.localStorage.getItem(localFollowKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) localIds = parsed.map(Number).filter(Number.isFinite);
    } catch {}

    const applyLocal = () => setFollowedGames(new Set(localIds));
    if (!supabase) {
      applyLocal();
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      const user = data.user ?? null;
      setAccountUser(user);
      const metadata = user?.user_metadata ?? {};
      const saved = Array.isArray(metadata.followed_games)
        ? metadata.followed_games.map(Number).filter(Number.isFinite)
        : [];
      const merged = [...new Set([...localIds, ...saved])];
      setFollowedGames(new Set(merged));
      setFavoriteTeamId(Number(metadata.favorite_team?.id) || null);
      try { window.localStorage.setItem(localFollowKey, JSON.stringify(merged)); } catch {}
    }).catch(applyLocal);
  }, []);

  const toggleFollow = async (gamePk: number) => {
    const next = new Set(followedGames);
    if (next.has(gamePk)) next.delete(gamePk); else next.add(gamePk);
    setFollowedGames(next);
    const ids = [...next];
    try { window.localStorage.setItem(localFollowKey, JSON.stringify(ids)); } catch {}

    if (supabase && accountUser) {
      const metadata = accountUser.user_metadata ?? {};
      const { data } = await supabase.auth.updateUser({ data: { ...metadata, followed_games: ids } });
      if (data.user) setAccountUser(data.user);
    }
  };

  const visibleGames = useMemo(() => games.filter((game) => {
    const isLive = game.status === 'Live';
    const isFinal = game.detailedState === 'Final' || game.status === 'Final';
    if (filter === 'Live') return isLive;
    if (filter === 'Final') return isFinal;
    if (filter === 'Upcoming') return !isLive && !isFinal && game.detailedState !== 'Postponed';
    if (filter === 'Following') return followedGames.has(game.gamePk);
    if (filter === 'My Team') return Boolean(favoriteTeamId && (game.awayTeam.id === favoriteTeamId || game.homeTeam.id === favoriteTeamId));
    return true;
  }), [games, filter, followedGames, favoriteTeamId]);

  const filters: ScheduleFilter[] = ['All', 'My Team', 'Following', 'Live', 'Upcoming', 'Final'];
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-4 sm:p-6 space-y-5">
    <section className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-[#3b494b]/20 pb-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center"><span className="material-symbols-outlined text-[#00f0ff] text-2xl">calendar_month</span></div>
        <div><span className="font-label-caps text-[10px] text-[#65f2b5]">LIVE MLB DATA</span><h1 className="font-display-lg text-3xl text-[#dbfcff]">MLB Schedule</h1><p className="text-sm text-[#9aa9aa] mt-0.5">Open any game, follow it, or jump directly to a team.</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
        <span className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-[#ff5c68]"/>Live</span>
        <span className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-[#00f0ff]"/>Final</span>
        <div className="flex rounded-lg border border-[#30415c] overflow-hidden ml-1">
          {(['ET','Local'] as TimeMode[]).map(mode => <button key={mode} onClick={() => setTimeMode(mode)} className={`px-3 py-2 text-[10px] font-bold ${timeMode === mode ? 'bg-[#00f0ff] text-[#002c31]' : 'bg-[#111a2d] text-[#9ba9b7] hover:text-white'}`}>{mode === 'ET' ? 'ET' : 'LOCAL'}</button>)}
        </div>
      </div>
    </section>

    <section className="relative bg-[#131b2e] border border-[#3b494b]/20 rounded-xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center max-w-full">
          <button onClick={() => setDate(shiftDate(date, -1))} className="p-2.5 rounded-l-lg bg-[#171f33] border border-[#3b494b]/30 hover:text-[#00f0ff]" aria-label="Previous day"><span className="material-symbols-outlined text-xl">chevron_left</span></button>
          <button onClick={() => { setCalendarMonth(new Date(`${date}T12:00:00Z`)); setCalendarOpen(v => !v); }} className="px-3 sm:px-5 py-2.5 bg-[#171f33] border-y border-[#3b494b]/30 text-xs sm:text-sm font-bold hover:text-[#00f0ff] min-w-0 sm:min-w-[250px]">{displayDate(date)} <span className="material-symbols-outlined align-middle text-base ml-1">expand_more</span></button>
          <button onClick={() => setDate(shiftDate(date, 1))} className="p-2.5 rounded-r-lg bg-[#171f33] border border-[#3b494b]/30 hover:text-[#00f0ff]" aria-label="Next day"><span className="material-symbols-outlined text-xl">chevron_right</span></button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto max-w-full pb-0.5">
          {filters.map(item => {
            const disabled = item === 'My Team' && !favoriteTeamId;
            return <button key={item} disabled={disabled} title={disabled ? 'Choose a favorite team in your profile first.' : undefined} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full border px-3 py-2 text-[10px] font-bold transition-colors ${filter === item ? 'border-[#00f0ff] bg-[#00f0ff] text-[#002c31]' : 'border-[#30415c] bg-[#10192b] text-[#aebbc8] hover:border-[#00f0ff]/45 hover:text-white'} disabled:cursor-not-allowed disabled:opacity-35`}>{item.toUpperCase()}</button>;
          })}
        </div>
      </div>
      {calendarOpen && <MonthCalendar month={calendarMonth} selectedDate={date} onChangeMonth={setCalendarMonth} onSelect={(key) => { setDate(key); setCalendarOpen(false); }} />}
    </section>

    <div className="flex items-center justify-between gap-3"><h2 className="font-headline-lg text-xl sm:text-2xl font-bold">{filter === 'All' ? displayDate(date) : `${filter} · ${displayDate(date)}`}</h2><span className="text-[10px] text-[#849495] shrink-0">{updatedAt ? `UPDATED ${updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</span></div>
    {error && <div className="p-3 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-[#ffb4ab] text-sm">{error}</div>}
    {loading ? <div className="p-8 text-center text-[#9aa9aa] text-sm bg-[#171f33] rounded-xl">Loading MLB schedule…</div>
      : visibleGames.length === 0 ? <div className="p-8 text-center text-[#9aa9aa] text-sm bg-[#171f33] rounded-xl">No games match this filter for the selected date.</div>
      : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">{visibleGames.map((game) => <GameCard key={game.gamePk} game={game} timeMode={timeMode} followed={followedGames.has(game.gamePk)} onOpen={() => onOpenGame(game)} onToggleFollow={() => void toggleFollow(game.gamePk)} onOpenTeam={onOpenTeam} />)}</div>}

    <div className="text-xs text-[#849495] flex flex-wrap gap-4"><span>{timeMode === 'ET' ? 'Game times shown in Eastern Time (ET).' : `Game times shown in your local timezone (${localZone}).`}</span><span>Scores refresh automatically.</span><span>★ Followed games are saved on this device and synced to your account when signed in.</span></div>
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
  return <div className="absolute z-50 top-[66px] left-3 w-[340px] max-w-[calc(100vw-5rem)] bg-[#10192b] border border-[#30415c] rounded-xl shadow-2xl p-3">
    <div className="flex items-center justify-between mb-3"><button onClick={() => moveMonth(-1)} className="w-9 h-9 rounded-lg bg-[#171f33] hover:text-[#00f0ff]"><span className="material-symbols-outlined">chevron_left</span></button><h3 className="text-base font-bold">{displayMonth(toDateKey(month))}</h3><button onClick={() => moveMonth(1)} className="w-9 h-9 rounded-lg bg-[#171f33] hover:text-[#00f0ff]"><span className="material-symbols-outlined">chevron_right</span></button></div>
    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#849495] mb-2">{['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => <span key={d}>{d}</span>)}</div>
    <div className="grid grid-cols-7 gap-1">{cells.map((day, i) => { if (!day) return <div key={`blank-${i}`} className="h-9"/>; const key = `${year}-${String(monthIndex + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`; const selected = key === selectedDate; const isToday = key === today; return <button key={key} onClick={() => onSelect(key)} className={`h-9 rounded-lg text-xs font-semibold transition-colors ${selected ? 'bg-[#00f0ff] text-[#002022]' : isToday ? 'border border-[#00f0ff]/60 text-[#00f0ff] hover:bg-[#17243a]' : 'hover:bg-[#17243a] text-[#d7e0f5]'}`}>{day}</button>; })}</div>
    <button onClick={() => onSelect(today)} className="mt-3 w-full py-2 rounded-lg bg-[#171f33] text-[#00f0ff] text-xs font-bold hover:bg-[#1d2940]">TODAY</button>
  </div>;
};

const GameCard = ({ game, timeMode, followed, onOpen, onToggleFollow, onOpenTeam }: { game: MlbScheduleGame; timeMode: TimeMode; followed: boolean; onOpen: () => void; onToggleFollow: () => void; onOpenTeam: (teamId: number) => void }) => {
  const isFinal = game.detailedState === 'Final' || game.status === 'Final';
  const isLive = game.status === 'Live';
  const status = isFinal ? 'FINAL' : isLive ? 'LIVE' : game.detailedState === 'Postponed' ? 'POSTPONED' : gameTime(game, timeMode);
  const openFromKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };
  return <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={openFromKeyboard} className="group cursor-pointer bg-[#131b2e] border border-[#3b494b]/25 rounded-xl overflow-hidden hover:border-[#00f0ff]/55 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,240,255,.08)] focus:outline-none focus:border-[#00f0ff] transition-all">
    <div className="px-3 py-2.5 border-b border-[#3b494b]/20 flex items-center justify-between gap-2">
      <span className={`flex items-center gap-2 font-label-caps text-xs font-bold ${isLive ? 'text-[#ff5c68]' : isFinal ? 'text-[#00f0ff]' : 'text-[#c7d2d3]'}`}>{(isLive || isFinal) && <i className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-[#ff5c68]' : 'bg-[#00f0ff]'}`}/>} {status}</span>
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold text-[#718090] group-hover:text-[#00f0ff] transition-colors">VIEW GAME →</span>
        <button type="button" aria-label={followed ? 'Unfollow this game' : 'Follow this game'} aria-pressed={followed} onClick={(event) => { event.stopPropagation(); onToggleFollow(); }} className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${followed ? 'border-[#00f0ff]/55 bg-[#00f0ff]/15 text-[#00f0ff]' : 'border-transparent text-[#849495] hover:text-[#00f0ff] hover:border-[#00f0ff]/30'}`}><span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: followed ? "'FILL' 1" : "'FILL' 0" }}>star</span></button>
      </div>
    </div>
    <div className="p-3 space-y-3">
      <TeamRow team={game.awayTeam} score={game.awayScore} onOpen={() => onOpenTeam(game.awayTeam.id)} />
      <TeamRow team={game.homeTeam} score={game.homeScore} onOpen={() => onOpenTeam(game.homeTeam.id)} />
      <div className="pt-2.5 border-t border-[#3b494b]/20"><p className="text-[10px] text-[#849495] font-label-caps">PROBABLE STARTERS</p><p className="text-xs text-white mt-1 truncate">{game.awayProbablePitcher?.name ?? 'TBD'} <span className="text-[#849495]">vs</span> {game.homeProbablePitcher?.name ?? 'TBD'}</p></div>
    </div>
  </div>;
};

const TeamRow = ({ team, score, onOpen }: { team: MlbScheduleGame['awayTeam']; score?: number; onOpen: () => void }) => <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} className="w-full flex items-center gap-3 rounded-lg p-1 -m-1 text-left hover:bg-[#1a263a] transition-colors group/team" title={`Open ${team.name} team profile`}><div className="w-10 h-10 rounded-lg bg-[#e7ebf0] p-1.5 flex items-center justify-center"><img src={mlbTeamLogoUrl(team.id)} alt={`${team.name} logo`} className="max-w-full max-h-full object-contain" /></div><div className="min-w-0 flex-1"><p className="font-bold text-sm truncate group-hover/team:text-[#00f0ff]">{team.name}</p><p className="text-[10px] text-[#849495]">{team.abbreviation ?? ''} · TEAM PROFILE →</p></div><span className="font-data-numeric text-2xl text-[#dbfcff]">{score ?? '—'}</span></button>;
