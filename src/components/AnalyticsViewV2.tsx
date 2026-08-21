import React, { useEffect, useMemo, useState } from 'react';
import { mlbPlayerCutoutUrl, mlbPlayerHeadshotUrl, playerInitials } from '../services/mlbMedia';
import { AnalyticsTeamPicker, type AnalyticsTeamOption } from './AnalyticsTeamPicker';

type Range = 'TODAY' | 'YESTERDAY' | 'LAST 3 DAYS' | 'LAST 7 DAYS';
const ALL_TEAMS = 'ALL TEAMS';
const day = (offset = 0) => { const date = new Date(); date.setDate(date.getDate() + offset); return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); };
const json = async (url: string) => { const response = await fetch(url); if (!response.ok) throw new Error(`MLB request failed (${response.status})`); return response.json(); };

const rowsFromFeed = (feed: any, date: string) => {
  const rows: any[] = [];
  const gamePk = feed?.gameData?.game?.pk;
  const venue = feed?.gameData?.venue?.name ?? '—';
  const gameStatus = feed?.gameData?.status?.detailedState ?? 'Status unavailable';
  const abstractState = feed?.gameData?.status?.abstractGameState;
  const teams = feed?.liveData?.boxscore?.teams ?? {};
  const awayRuns = Number(feed?.liveData?.linescore?.teams?.away?.runs ?? teams?.away?.teamStats?.batting?.runs);
  const homeRuns = Number(feed?.liveData?.linescore?.teams?.home?.runs ?? teams?.home?.teamStats?.batting?.runs);
  const scoresAvailable = Number.isFinite(awayRuns) && Number.isFinite(homeRuns);
  (['away', 'home'] as const).forEach((side) => {
    const block = teams?.[side] ?? {};
    const other = side === 'away' ? 'home' : 'away';
    const team = block?.team?.name ?? feed?.gameData?.teams?.[side]?.name ?? 'Unknown Team';
    const opponent = teams?.[other]?.team?.name ?? feed?.gameData?.teams?.[other]?.name ?? 'Unknown opponent';
    const teamRuns = side === 'away' ? awayRuns : homeRuns;
    const opponentRuns = side === 'away' ? homeRuns : awayRuns;
    const gameResult = scoresAvailable
      ? abstractState === 'Final'
        ? `${teamRuns > opponentRuns ? 'W' : teamRuns < opponentRuns ? 'L' : 'T'} ${teamRuns}-${opponentRuns}`
        : `${gameStatus} · ${teamRuns}-${opponentRuns}`
      : gameStatus;
    for (const player of Object.values(block?.players ?? {}) as any[]) {
      const id = player?.person?.id;
      const name = player?.person?.fullName ?? 'MLB Player';
      const position = player?.position?.abbreviation ?? player?.allPositions?.[0]?.abbreviation ?? '—';
      const bat = player?.stats?.batting;
      if (bat && Number(bat.plateAppearances ?? 0) > 0) {
        const h = Number(bat.hits ?? 0), hr = Number(bat.homeRuns ?? 0), rbi = Number(bat.rbi ?? 0), bb = Number(bat.baseOnBalls ?? 0), tb = Number(bat.totalBases ?? 0), so = Number(bat.strikeOuts ?? 0), ab = Number(bat.atBats ?? 0), runs = Number(bat.runs ?? 0);
        const index = Math.max(0, Math.min(100, Math.round(45 + h * 9 + hr * 16 + rbi * 5 + bb * 3 + tb * 1.5 - so * 2)));
        rows.push({
          key: `${gamePk}-h-${id}`, playerId: id, player: name, team, opponent, venue, date, position, gameResult, type: 'HITTER', index,
          summary: `${h} H · ${hr} HR · ${rbi} RBI${runs ? ` · ${runs} R` : ''}`,
          detail: `${ab} AB · ${bb} BB · ${so} SO · ${tb} TB`,
          stats: [['H', h], ['HR', hr], ['RBI', rbi], ['R', runs], ['AB', ab], ['BB', bb], ['SO', so], ['TB', tb]],
          indexNote: 'Hits, power, run production, walks and total bases raise the index. Strikeouts lower it.',
        });
      }
      const pitch = player?.stats?.pitching;
      if (pitch && Number.parseFloat(String(pitch.inningsPitched ?? '0')) > 0) {
        const ip = Number.parseFloat(String(pitch.inningsPitched ?? '0')) || 0, k = Number(pitch.strikeOuts ?? 0), er = Number(pitch.earnedRuns ?? 0), h = Number(pitch.hits ?? 0), bb = Number(pitch.baseOnBalls ?? 0), pitches = Number(pitch.numberOfPitches ?? 0);
        const index = Math.max(0, Math.min(100, Math.round(50 + ip * 5 + k * 4 - er * 9 - h * 2 - bb * 2)));
        rows.push({
          key: `${gamePk}-p-${id}`, playerId: id, player: name, team, opponent, venue, date, position: position === '—' ? 'P' : position, gameResult, type: 'PITCHER', index,
          summary: `${pitch.inningsPitched} IP · ${k} K · ${er} ER`,
          detail: `${h} H · ${bb} BB · ${pitches || '—'} P`,
          stats: [['IP', pitch.inningsPitched], ['K', k], ['ER', er], ['H', h], ['BB', bb], ['P', pitches || '—']],
          indexNote: 'Innings and strikeouts raise the index. Earned runs, hits and walks lower it.',
        });
      }
    }
  });
  return rows;
};

export const AnalyticsViewV2: React.FC = () => {
  const [range, setRange] = useState<Range>('YESTERDAY');
  const [team, setTeam] = useState(ALL_TEAMS);
  const [teamOptions, setTeamOptions] = useState<AnalyticsTeamOption[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dates = useMemo(() => range === 'TODAY' ? [day()] : range === 'YESTERDAY' ? [day(-1)] : range === 'LAST 3 DAYS' ? [day(-1), day(-2), day(-3)] : Array.from({ length: 7 }, (_, index) => day(-(index + 1))), [range]);

  useEffect(() => { json('https://statsapi.mlb.com/api/v1/teams?sportId=1&season=2026').then((data) => setTeamOptions((data?.teams ?? []).map((item: any) => ({ id: Number(item.id), name: String(item.name) })).sort((a: AnalyticsTeamOption, b: AnalyticsTeamOption) => a.name.localeCompare(b.name)))).catch(() => setTeamOptions([])); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const schedules = await Promise.all(dates.map(async (date) => ({ date, data: await json(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`) })));
      const gameList = schedules.flatMap(({ date, data }) => (data?.dates ?? []).flatMap((item: any) => (item.games ?? []).map((game: any) => ({ ...game, _date: date }))));
      setGames(gameList);
      const feeds = await Promise.all(gameList.map((game: any) => json(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`).then((feed) => ({ feed, date: game._date })).catch(() => null)));
      setRows(feeds.filter(Boolean).flatMap((item: any) => rowsFromFeed(item.feed, item.date)).sort((a: any, b: any) => b.index - a.index));
    } catch (err) { setRows([]); setError(err instanceof Error ? err.message : 'Unable to load analytics.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { setTeam(ALL_TEAMS); setSelected(null); void load(); const timer = window.setInterval(() => void load(), 10 * 60 * 1000); return () => window.clearInterval(timer); }, [range]);

  const visible = useMemo(() => team === ALL_TEAMS ? rows : rows.filter((row) => row.team === team), [rows, team]);
  const visibleGames = useMemo(() => team === ALL_TEAMS ? games : games.filter((game) => game?.teams?.away?.team?.name === team || game?.teams?.home?.team?.name === team), [games, team]);
  const hitters = visible.filter((row) => row.type === 'HITTER').length;
  const pitchers = visible.filter((row) => row.type === 'PITCHER').length;
  const standouts = visible.filter((row) => row.index >= 75).length;
  const average = visible.length ? (visible.reduce((sum, row) => sum + row.index, 0) / visible.length).toFixed(1) : '—';

  return (
    <div className="min-h-screen space-y-3 bg-[#0b1326] px-3 py-3 text-[#dae2fd] sm:space-y-6 sm:p-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div>
          <p className="text-[11px] font-extrabold tracking-[.14em] text-[#65f2b5] sm:text-xs">VERIFIED MLB DATA</p>
          <h1 className="mt-1 text-[32px] font-extrabold leading-none text-white sm:text-4xl">Analytics</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#b7c4d1] sm:text-sm">Verified MLB performance analytics from live and completed games.</p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 lg:w-auto lg:items-end">
          <div className="ml-auto grid w-full grid-cols-4 gap-1 rounded-xl bg-[#131b2e] p-1 sm:w-auto">
            {(['TODAY', 'YESTERDAY', 'LAST 3 DAYS', 'LAST 7 DAYS'] as Range[]).map((item) => (
              <button key={item} type="button" onClick={() => setRange(item)} className={`h-8 whitespace-nowrap rounded-lg px-1 text-[8px] font-extrabold leading-none sm:px-4 sm:text-xs ${range === item ? 'bg-[#63e9ef] text-[#042d33]' : 'text-[#c5d0da] hover:text-white'}`}>{item}</button>
            ))}
          </div>
          <AnalyticsTeamPicker options={teamOptions} value={team} allLabel={ALL_TEAMS} onChange={setTeam} />
        </div>
      </header>

      {error && <div className="rounded-xl border border-[#ff9c9c]/30 bg-[#ff9c9c]/10 p-4 text-sm text-[#ffc1c1]">{error}</div>}

      <section className="grid grid-cols-5 gap-1.5 sm:gap-3">
        <Metric label="GAMES" value={visibleGames.length} />
        <Metric label="HITTERS" value={hitters} />
        <Metric label="PITCHERS" value={pitchers} />
        <Metric label="STANDOUTS" value={standouts} />
        <Metric label="AVG INDEX" value={average} />
      </section>

      <section className="rounded-xl border border-[#2c3e57] bg-[#121c2f] p-3 sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-end justify-between gap-3 sm:mb-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[.05em] text-[#b5c2cf] sm:text-xs">TOP PERFORMANCE SIGNALS</p>
            <h2 className="mt-1 text-xl font-extrabold leading-tight text-white sm:text-2xl">{team === ALL_TEAMS ? 'Best verified performances' : `${team} performances`}</h2>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#31516c] bg-[#0d1729] px-3 text-[11px] font-extrabold text-[#63e9ef] disabled:opacity-60">
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            REFRESH
          </button>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-[#b4c1cd]">Loading MLB analytics…</p>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {visible.slice(0, 20).map((row, index) => <PerformanceCard key={row.key} row={row} rank={index + 1} onClick={() => setSelected(row)} />)}
            {!visible.length && <p className="py-8 text-center text-sm text-[#b4c1cd]">No player performance data is available for this team and period yet.</p>}
          </div>
        )}
      </section>

      {selected && <PerformanceModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

const PerformanceCard = ({ row, rank, onClick }: { row: any; rank: number; onClick: () => void }) => (
  <button type="button" aria-label={`View ${row.player} performance details`} onClick={onClick} className="grid w-full grid-cols-[22px_62px_minmax(0,1fr)_48px] items-center gap-2 rounded-xl border border-[#2c3e57] bg-[#0d1729] p-2.5 text-left transition hover:border-[#63e9ef]/60 sm:grid-cols-[44px_82px_minmax(0,1fr)_72px] sm:gap-3 sm:p-3">
    <span className="self-start pt-1 font-mono text-[11px] text-[#b7c4d0] sm:self-center sm:pt-0 sm:text-sm">#{rank}</span>
    <AnalyticsPlayerImage playerId={row.playerId} name={row.player} />
    <span className="min-w-0">
      <strong className="block break-words text-[15px] font-extrabold leading-[1.15] text-white sm:text-lg">{row.player}</strong>
      <span className="mt-1 block text-[11px] font-semibold leading-[1.3] text-[#c6d1db] sm:text-sm">{row.team}</span>
      <span className="mt-0.5 block text-[10px] leading-[1.3] text-[#aebdca] sm:text-xs">vs {row.opponent}</span>
      <span className="mt-2 block text-[13px] font-bold leading-[1.35] text-[#eef4fa] sm:text-base">{row.summary}</span>
      <span className="mt-1 block text-[11px] leading-[1.35] text-[#b8c5d1] sm:text-sm">{row.detail}</span>
    </span>
    <span className="self-start pt-1 text-right sm:self-center sm:pt-0">
      <small className="block text-[8px] font-bold tracking-[.05em] text-[#aebcca] sm:text-xs">INDEX</small>
      <strong className="font-mono text-[24px] leading-none text-[#63e9ef] sm:text-3xl">{row.index}</strong>
    </span>
  </button>
);

const PerformanceModal = ({ row, onClose }: { row: any; onClose: () => void }) => {
  const tier = row.index >= 90 ? 'ELITE GAME' : row.index >= 75 ? 'STANDOUT' : row.index >= 60 ? 'STRONG GAME' : 'SOLID GAME';
  const formattedDate = (() => {
    const parsed = new Date(`${row.date}T12:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? row.date : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parsed);
  })();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-[2px] sm:p-5" onClick={onClose}>
      <article role="dialog" aria-modal="true" aria-labelledby="performance-modal-title" onClick={(event) => event.stopPropagation()} className="max-h-[calc(100dvh-20px)] w-full max-w-[390px] overflow-y-auto rounded-2xl border border-[#63e9ef]/35 bg-[#101a2d] p-3 shadow-[0_24px_80px_rgba(0,0,0,.7)] sm:max-w-[440px] sm:p-4">
        <div className="grid grid-cols-[62px_minmax(0,1fr)_34px] items-start gap-2 sm:grid-cols-[78px_minmax(0,1fr)_38px] sm:gap-3">
          <AnalyticsPlayerImage playerId={row.playerId} name={row.player} modal />
          <div className="min-w-0 pt-0.5">
            <p className="text-[9px] font-extrabold tracking-[.08em] text-[#63e9ef] sm:text-[10px]">{row.type} PERFORMANCE</p>
            <h2 id="performance-modal-title" className="mt-0.5 break-words text-[16px] font-extrabold leading-[1.1] text-white sm:text-lg">{row.player}</h2>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-[#c5d0da] sm:text-xs">{row.team}</p>
            <p className="text-[10px] leading-4 text-[#aebdca] sm:text-[11px]">vs {row.opponent}</p>
          </div>
          <button type="button" aria-label="Close player performance" onClick={onClose} className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#3a4d68] bg-[#0b1526] text-[#dce6ee] sm:h-[38px] sm:w-[38px]">
            <span className="material-symbols-outlined text-[19px]">close</span>
          </button>
        </div>

        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_72px] items-stretch gap-2">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#2c3e57] bg-[#0c1628] p-2">
            <ModalFact label="RESULT" value={row.gameResult} />
            <ModalFact label="POSITION" value={row.position} />
            <ModalFact label="DATE" value={formattedDate.split(',')[0]} />
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-[#63e9ef]/30 bg-[#63e9ef]/[.06] px-2 py-2 text-center">
            <span className="text-[8px] font-extrabold tracking-[.08em] text-[#9baaba]">INDEX</span>
            <strong className="font-mono text-[23px] leading-none text-[#63e9ef]">{row.index}</strong>
            <span className="mt-1 text-[8px] font-extrabold text-[#65f2b5]">{tier}</span>
          </div>
        </div>

        <section className="mt-2 rounded-xl border border-[#2c3e57] bg-[#0c1628] p-2">
          <p className="text-[9px] font-extrabold tracking-[.08em] text-[#aebdca]">FULL GAME STATS</p>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {(row.stats ?? []).map(([label, value]: [string, React.ReactNode]) => (
              <div key={label} className="rounded-lg bg-[#121f34] px-1 py-1.5 text-center">
                <strong className="block font-mono text-[13px] leading-none text-white sm:text-sm">{value}</strong>
                <span className="mt-1 block text-[8px] font-bold text-[#91a2b3]">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-2 rounded-xl border border-[#2c3e57] bg-[#0c1628] p-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-[#63e9ef]">info</span>
            <p className="text-[9px] font-extrabold tracking-[.07em] text-[#c8d3dd]">WHY THIS INDEX?</p>
          </div>
          <p className="mt-1 text-[9px] leading-[13px] text-[#aebdca] sm:text-[10px] sm:leading-[14px]">{row.indexNote}</p>
          <p className="mt-1 text-[9px] leading-[14px] text-[#778b9e]">It compares this single-game performance—not player quality or a future prediction.</p>
        </section>

        <div className="mt-1.5 flex items-center justify-between gap-3 text-[8px] leading-3 text-[#8295a7]">
          <span className="min-w-0 truncate">{row.venue}</span>
          <span className="shrink-0">Tap outside to close</span>
        </div>
      </article>
    </div>
  );
};

const ModalFact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="min-w-0">
    <span className="block text-[7px] font-extrabold tracking-[.05em] text-[#7f91a3] sm:text-[8px]">{label}</span>
    <strong className="mt-1 block break-words text-[9px] font-bold leading-[12px] text-[#eef4fa] sm:text-[10px] sm:leading-[13px]">{value}</strong>
  </div>
);

const AnalyticsPlayerImage = ({ playerId, name, modal = false }: { playerId?: number | null; name: string; modal?: boolean }) => {
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFallback(false); setFailed(false); }, [playerId]);
  const width = modal ? 200 : 160;
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden bg-transparent ${modal ? 'h-[72px] w-[62px] sm:h-[84px] sm:w-[78px]' : 'h-20 w-[62px] sm:w-20'}`}>
      {playerId && !failed ? (
        <img src={fallback ? mlbPlayerHeadshotUrl(playerId, width) : mlbPlayerCutoutUrl(playerId, width)} alt={name} onError={() => fallback ? setFailed(true) : setFallback(true)} className="h-full w-full object-contain object-bottom" />
      ) : (
        <span className="grid h-12 w-12 place-items-center rounded-full border border-[#31516c] text-[11px] font-bold text-[#63e9ef]">{playerInitials(name)}</span>
      )}
    </span>
  );
};

const Metric = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="min-w-0 rounded-lg border border-[#2c3e57] bg-[#121c2f] px-1 py-2 text-center sm:rounded-xl sm:p-5 sm:text-left">
    <p className="truncate text-[7px] font-bold tracking-[-.01em] text-[#b4c1cd] sm:text-xs sm:tracking-[.04em]">{label}</p>
    <p className="mt-1 truncate text-[17px] font-extrabold leading-none text-white sm:text-3xl">{value}</p>
  </div>
);
