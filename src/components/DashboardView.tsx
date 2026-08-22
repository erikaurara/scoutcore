import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavigationTab } from '../types';
import type { MlbScheduleGame } from '../services/mlbApi';
import { fetchSchedule } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl, playerInitials } from '../services/mlbMedia';
import { useLanguage } from '../i18n/LanguageContext';
import { translateUiText } from '../i18n/uiTranslations';

type SignalKind = 'MATCHUP EDGE' | 'HOT HITTER' | 'PITCHER WATCH' | 'BULLPEN WATCH';
type GameStatusFilter = 'all' | 'live' | 'upcoming' | 'final';
type GameStatusBucket = Exclude<GameStatusFilter, 'all'>;

type DailySignal = {
  kind?: SignalKind | string;
  gamePk?: number;
  playerId?: number;
  teamId?: number;
  team?: string;
  player?: string;
  opponentPitcher?: string;
  score?: number;
  value?: string;
  confidence?: number;
  reason?: string;
};

const KNOWN_PLAYER_IDS: Record<string, number> = {
  'Jahmai Jones': 663330,
  'Griffin Conine': 665052,
  'Alec Gamboa': 687941,
  'Martín Pérez': 527048,
  'Shota Imanaga': 684007,
  'Sean Newcomb': 656794,
  'Steven Matz': 571927,
};

const signalPlayerId = (signal: DailySignal) => signal.playerId ?? KNOWN_PLAYER_IDS[signal.player ?? ''];

interface DailyReport {
  generatedAt: string | null;
  report: {
    headline?: string;
    summary?: string;
    signals?: DailySignal[];
    watchList?: string[];
    caveats?: string[];
    breakdown?: { matchupEdges?: number; hotHitters?: number; pitcherWatch?: number; bullpenWatch?: number };
  } | null;
}

interface DashboardViewProps {
  onSelectTab: (tab: NavigationTab) => void;
  onSelectMatchup: (matchup: any) => void;
}

const formatGameTime = (gameDate: string) => new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
}).format(new Date(gameDate));

const isFinalGame = (game: MlbScheduleGame) => {
  const detailedState = String(game.detailedState ?? '').toLowerCase();
  return game.status === 'Final'
    || detailedState.includes('final')
    || detailedState === 'game over'
    || detailedState.includes('completed early');
};

const gameStatusFilter = (game: MlbScheduleGame): GameStatusBucket => game.status === 'Live'
  ? 'live'
  : isFinalGame(game)
    ? 'final'
    : 'upcoming';

const rememberedGameFilter = (): GameStatusFilter | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem('scoutcore:dashboard-game-filter');
    return stored === 'all' || stored === 'live' || stored === 'upcoming' || stored === 'final' ? stored : null;
  } catch {
    return null;
  }
};

const gameLabel = (game: MlbScheduleGame) => isFinalGame(game)
  ? 'FINAL'
  : game.status === 'Live'
    ? 'LIVE'
    : formatGameTime(game.gameDate);

const gameDestinationLabel = (game: MlbScheduleGame) => game.status === 'Live'
  ? '● LIVE VIEW →'
  : isFinalGame(game)
    ? 'FINAL · VIEW BOX SCORE →'
    : 'VIEW MATCHUP →';

const normalizedKind = (signal: DailySignal): SignalKind => {
  const kind = String(signal.kind || 'MATCHUP EDGE').toUpperCase();
  if (kind === 'HOT HITTER') return 'HOT HITTER';
  if (kind === 'PITCHER WATCH') return 'PITCHER WATCH';
  if (kind === 'BULLPEN WATCH') return 'BULLPEN WATCH';
  return 'MATCHUP EDGE';
};

const signalIcon = (kind: SignalKind) => {
  if (kind === 'HOT HITTER') return 'local_fire_department';
  if (kind === 'PITCHER WATCH') return 'sports_baseball';
  if (kind === 'BULLPEN WATCH') return 'warning';
  return 'query_stats';
};

const signalAccent = (kind: SignalKind) => {
  if (kind === 'HOT HITTER') return 'text-[#ffb86b] border-[#ffb86b]/25 bg-[#ffb86b]/5';
  if (kind === 'PITCHER WATCH') return 'text-[#8db4ff] border-[#8db4ff]/25 bg-[#8db4ff]/5';
  if (kind === 'BULLPEN WATCH') return 'text-[#ff8c9a] border-[#ff8c9a]/25 bg-[#ff8c9a]/5';
  return 'text-[#00f0ff] border-[#00f0ff]/25 bg-[#00f0ff]/5';
};

const compactSignalKind = (kind: SignalKind) => {
  if (kind === 'HOT HITTER') return 'HOT';
  if (kind === 'PITCHER WATCH') return 'PITCHER';
  if (kind === 'BULLPEN WATCH') return 'BULLPEN';
  return 'EDGE';
};

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectTab, onSelectMatchup }) => {
  const { locale } = useLanguage();
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [briefInfoOpen, setBriefInfoOpen] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<DailySignal | null>(null);
  const [selectedGameFilter, setSelectedGameFilter] = useState<GameStatusFilter | null>(rememberedGameFilter);
  const userSelectedGameFilter = useRef(false);

  const openGameMatchup = (game: MlbScheduleGame) => {
    const selection = {
      gamePk: game.gamePk,
      gameDate: game.gameDate,
      status: game.status,
      detailedState: game.detailedState,
      awayScore: game.awayScore,
      homeScore: game.homeScore,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      awayProbablePitcher: game.awayProbablePitcher,
      homeProbablePitcher: game.homeProbablePitcher,
    };
    onSelectMatchup(selection);
    try { window.sessionStorage.setItem('scoutcore:selected-game', JSON.stringify(selection)); } catch {}
    setReportOpen(false);
    onSelectTab(game.status === 'Live' || isFinalGame(game) ? 'live-game' : 'matchups');
  };

  const loadGames = async () => {
    try {
      setError(null);
      setGames(await fetchSchedule());
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load MLB games.');
    } finally {
      setLoading(false);
    }
  };

  const loadDailyReport = async () => {
    try {
      const response = await fetch(`/data/daily-intelligence.json?ts=${Date.now()}`);
      if (response.ok) setDailyReport(await response.json());
    } catch {}
  };

  useEffect(() => {
    void loadGames();
    void loadDailyReport();
    const timer = window.setInterval(() => {
      void loadGames();
      void loadDailyReport();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedSignal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedSignal(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedSignal]);

  const liveCount = useMemo(() => games.filter((game) => game.status === 'Live').length, [games]);
  const connectionSummary = translateUiText(
    `IXMetrics is connected directly to MLB data. ${games.length} games are scheduled today${liveCount ? `, with ${liveCount} live` : ''}.`,
    locale,
  );
  const gameCounts = useMemo<Record<GameStatusFilter, number>>(() => games.reduce((counts, game) => {
    counts[gameStatusFilter(game)] += 1;
    return counts;
  }, { all: games.length, live: 0, upcoming: 0, final: 0 }), [games]);
  const activeGameFilter = selectedGameFilter
    ?? (gameCounts.live > 0 ? 'live' : gameCounts.upcoming > 0 ? 'upcoming' : 'final');
  const filteredGames = useMemo(
    () => activeGameFilter === 'all'
      ? games
      : games.filter((game) => gameStatusFilter(game) === activeGameFilter),
    [activeGameFilter, games],
  );

  useEffect(() => {
    if (loading || games.length === 0 || userSelectedGameFilter.current) return;
    const selectedCount = selectedGameFilter ? gameCounts[selectedGameFilter] : 0;
    if (selectedGameFilter && selectedCount > 0) return;
    const nextFilter: GameStatusFilter = gameCounts.live > 0
      ? 'live'
      : gameCounts.upcoming > 0
        ? 'upcoming'
        : 'final';
    setSelectedGameFilter(nextFilter);
    try { window.sessionStorage.setItem('scoutcore:dashboard-game-filter', nextFilter); } catch {}
  }, [gameCounts, games.length, loading, selectedGameFilter]);

  const selectGameFilter = (filter: GameStatusFilter) => {
    userSelectedGameFilter.current = true;
    setSelectedGameFilter(filter);
    try { window.sessionStorage.setItem('scoutcore:dashboard-game-filter', filter); } catch {}
  };
  const report = dailyReport?.report;
  const signals = report?.signals ?? [];
  const scheduleSignals = useMemo<DailySignal[]>(() => games.slice(0, 6).map((game) => {
    const starters = [game.awayProbablePitcher?.name, game.homeProbablePitcher?.name].filter(Boolean);
    return {
      kind: 'PITCHER WATCH', gamePk: game.gamePk,
      team: `${game.awayTeam.abbreviation ?? game.awayTeam.name} @ ${game.homeTeam.abbreviation ?? game.homeTeam.name}`,
      player: starters.length === 2 ? `${starters[0]} vs ${starters[1]}` : `${game.awayTeam.name} at ${game.homeTeam.name}`,
      value: gameLabel(game),
      reason: starters.length === 2
        ? 'Both probable starters are posted. Open the matchup to review the latest verified team and player data.'
        : 'Today’s matchup is confirmed. Probable-pitcher details will update automatically when MLB posts them.',
    };
  }), [games]);
  const displaySignals = signals.length > 0 ? signals : scheduleSignals;
  const edgeCount = useMemo(() => displaySignals.filter(signal => normalizedKind(signal) === 'MATCHUP EDGE').length, [displaySignals]);
  const hotCount = useMemo(() => displaySignals.filter(signal => normalizedKind(signal) === 'HOT HITTER').length, [displaySignals]);
  const watchCount = useMemo(() => displaySignals.filter(signal => ['PITCHER WATCH', 'BULLPEN WATCH'].includes(normalizedKind(signal))).length, [displaySignals]);

  const autoHeadline = 'IXMetrics is scanning today’s verified matchup data';
  const autoSummary = 'Matchup edges, hot hitters and pitching watch alerts will appear here only when IXMetrics has enough verified MLB data to support them.';
  const displayHeadline = signals.length ? report?.headline : games.length ? `IXMetrics is watching ${games.length} MLB games today` : autoHeadline;
  const verifiedSummary = `${edgeCount} matchup ${edgeCount === 1 ? 'edge' : 'edges'}, ${hotCount} hot ${hotCount === 1 ? 'player' : 'players'} and ${watchCount} pitcher/bullpen watch ${watchCount === 1 ? 'alert is' : 'alerts are'} currently verified.`;
  const displaySummary = signals.length ? verifiedSummary : games.length ? 'Today’s confirmed games and probable-pitcher matchups are ready. Stronger analytics signals will appear as verified lineup and game-log data clears IXMetrics’ thresholds.' : autoSummary;

  const openSignal = (signal: DailySignal) => {
    setSelectedSignal(signal);
  };

  return <div className="flex flex-col w-full min-h-screen bg-[#0b1326] text-[#dae2fd]">
    <section className="relative px-4 sm:px-6 lg:px-8 py-8 overflow-hidden border-b border-[#3b494b]/10">
      <div className="absolute inset-0 bg-gradient-to-r from-[#060e20] via-[#0b1326] to-transparent" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl flex gap-5 items-start">
          <div>
            <div className="flex items-center gap-3 mb-3"><span className="px-2.5 py-1 bg-[#d8ffe7]/10 border border-[#d8ffe7]/20 text-[#65f2b5] rounded-full text-[10px]">LIVE GAME ENGINE</span><span className="text-[#849495] text-[10px]">{lastUpdated ? `UPDATED ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'UPDATING'}</span></div>
            <h1 data-i18n-skip className="font-display-lg text-[38px] sm:text-[44px] text-[#dbfcff] mb-2 leading-none">{translateUiText('AI Game Intelligence', locale)}</h1>
            <p className="text-sm text-[#b9cacb]">{connectionSummary}</p>
          </div>
        </div>
        <div className="flex gap-3 sm:gap-4"><Metric label="TODAY'S GAMES" value={loading ? '—' : games.length}/><Metric label="LIVE NOW" value={loading ? '—' : liveCount} accent/></div>
      </div>
    </section>

    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <section className="bg-[#131b2e] rounded-2xl border border-[#00f0ff]/20 overflow-visible shadow-[0_0_30px_rgba(0,240,255,.04)]">
        <div className="px-4 sm:px-6 py-4 border-b border-[#3b494b]/20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg">Daily Intelligence</h2>
                <div>
                  <button type="button" aria-label="What is Daily Intelligence?" aria-expanded={briefInfoOpen} onClick={() => setBriefInfoOpen(value => !value)} className="w-5 h-5 rounded-full border border-[#00f0ff]/45 text-[#00f0ff] text-[12px] font-bold leading-none flex items-center justify-center hover:bg-[#00f0ff]/10">i</button>
                  {briefInfoOpen && <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#020813]/75 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setBriefInfoOpen(false); }}>
                    <article role="dialog" aria-modal="true" aria-labelledby="daily-intel-info-title" className="sc-dashboard-info-modal relative w-full max-w-sm rounded-2xl border border-[#00f0ff]/30 bg-[#0d172b] p-5 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
                      <button type="button" aria-label="Close information" onClick={() => setBriefInfoOpen(false)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-[#8f9dac]/35 text-[#c8d4e2] hover:border-[#00f0ff] hover:text-white"><span className="material-symbols-outlined text-[18px]">close</span></button>
                      <h3 id="daily-intel-info-title" className="sc-dashboard-info-title pr-10 text-base font-bold text-[#dbfcff]">What is this?</h3>
                      <p className="sc-dashboard-info-body mt-3 text-sm leading-6 text-[#b9cacb]">This is IXMetrics’ signal board — not another schedule. It highlights verified matchup edges, recent hitter form, pitcher trends and bullpen watch items that may deserve a deeper look.</p>
                      <p className="sc-dashboard-info-note mt-3 text-xs leading-5 text-[#65f2b5]">Signals appear only when the data pipeline has enough verified information.</p>
                    </article>
                  </div>}
                </div>
              </div>
              <p className="text-[11px] text-[#9ba9b7]">WHAT MATTERS TODAY · VERIFIED MLB SIGNALS</p>
            </div>
            <div className="flex items-center gap-3"><span className="text-[11px] text-[#65f2b5]">● AUTO-UPDATING</span><button onClick={() => setReportOpen(true)} className="px-4 py-2 rounded-lg border border-[#00f0ff]/35 text-[#00f0ff] text-xs font-bold hover:bg-[#00f0ff]/10">VIEW DAILY REPORT</button></div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 mb-5">
            <div><span className="font-label-caps text-[10px] text-[#65f2b5]">TODAY’S SIGNAL BOARD</span><h3 className="text-2xl font-bold mt-1">{displayHeadline}</h3><p className="text-sm text-[#b9cacb] mt-2 max-w-3xl">{displaySummary}</p></div>
            <div className="grid grid-cols-3 gap-2 min-w-0 sm:min-w-[360px]"><BriefStat label="MATCHUP EDGES" value={edgeCount}/><BriefStat label="HOT PLAYERS" value={hotCount}/><BriefStat label="WATCH ALERTS" value={watchCount}/></div>
          </div>

          {displaySignals.length > 0
            ? <div className="sc-dashboard-signals-rail grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{displaySignals.map((signal, index) => <SignalCard key={`${signal.kind}-${signal.player}-${index}`} signal={signal} onOpen={() => openSignal(signal)} />)}</div>
            : <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <ScanningCard icon="query_stats" title="Matchup Edges" text="Waiting for verified hitter-vs-pitcher data to clear the signal threshold." />
                <ScanningCard icon="local_fire_department" title="Hot Players" text="Recent MLB game logs are being checked for meaningful hitter form." />
                <ScanningCard icon="visibility" title="Watch Alerts" text="Pitcher and bullpen trends will appear when verified context is available." />
              </div>}

          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs"><button onClick={() => onSelectTab('matchup-lab')} className="text-[#00f0ff] hover:underline">EXPLORE MATCHUP INTELLIGENCE →</button><span className="text-[#596879]">•</span><a href="/daily-intelligence/" className="font-bold text-[#65f2b5] hover:underline">PUBLIC DAILY INTELLIGENCE →</a><span className="text-[#596879]">•</span><a href="/mlb-team-analysis/" className="font-bold text-[#00f0ff] hover:underline">PUBLIC TEAM ANALYSIS →</a><span className="text-[#596879]">•</span><span className="text-[#8f9dac]">Signals are analytics clues, not guaranteed outcomes.</span></div>
        </div>
      </section>

      <div className="sc-dashboard-games">
        <div className="sc-dashboard-games-header mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h2 className="font-headline-lg text-[22px] font-bold">Today's MLB Games</h2><a href="/mlb-games-today/" className="text-[10px] font-bold uppercase tracking-[.08em] text-[#00f0ff] hover:underline">Public game guide →</a></div><button onClick={() => void loadGames()} className="inline-flex items-center gap-1.5 rounded-lg border border-[#00f0ff]/35 px-3 py-2 text-xs font-bold text-[#00f0ff] hover:bg-[#00f0ff]/10"><span className="material-symbols-outlined text-[17px]">refresh</span>REFRESH</button></div>
        {error && <div className="mb-5 p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}
        {!loading && games.length > 0 && <div className="sc-dashboard-game-filters" role="tablist" aria-label="Filter today's MLB games">
          {([
            { id: 'all', label: 'ALL' },
            { id: 'live', label: 'LIVE' },
            { id: 'upcoming', label: 'UPCOMING' },
            { id: 'final', label: 'FINAL' },
          ] as { id: GameStatusFilter; label: string }[]).map(({ id, label }) => <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeGameFilter === id}
            aria-controls="sc-dashboard-filtered-games"
            onClick={() => selectGameFilter(id)}
            className={`sc-dashboard-game-filter ${activeGameFilter === id ? 'is-active' : ''}`}
          >
            {id === 'live' && <span className="sc-dashboard-live-dot" aria-hidden="true"/>}
            <span>{label}</span>
            <span className="sc-dashboard-game-filter-count">{gameCounts[id]}</span>
          </button>)}
        </div>}
        {loading ? <div className="bg-[#171f33] rounded-xl p-8 text-center text-[#849495]">Loading today's MLB schedule…</div>
          : games.length === 0 ? <div className="bg-[#171f33] rounded-xl p-8 text-center text-[#849495]">No MLB games are scheduled today.</div>
          : filteredGames.length === 0 ? <div className="sc-dashboard-games-empty" role="tabpanel">
              <span className="material-symbols-outlined" aria-hidden="true">{activeGameFilter === 'live' ? 'sensors' : activeGameFilter === 'upcoming' ? 'calendar_month' : 'sports_score'}</span>
              <p>{activeGameFilter === 'live' ? 'No games are live right now.' : activeGameFilter === 'upcoming' ? 'No upcoming games remain today.' : 'No games are final yet.'}</p>
            </div>
          : <div id="sc-dashboard-filtered-games" role="tabpanel" className="sc-dashboard-games-list grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{filteredGames.map(game => <button key={game.gamePk} onClick={() => openGameMatchup(game)} className="sc-dashboard-game-card text-left bg-[#131b2e] rounded-xl overflow-hidden border border-[#3b494b]/20 hover:border-[#00f0ff]/40"><div className="sc-dashboard-game-meta px-4 py-3 bg-[#222a3d]/50 flex justify-between"><span className="text-[10px] text-[#00f0ff]">{formatGameTime(game.gameDate)}</span><span className={`sc-dashboard-game-action text-[10px] ${game.status === 'Live' ? 'sc-dashboard-game-action-live font-bold text-[#ff5f72]' : 'text-[#849495]'}`}>{gameDestinationLabel(game)}</span></div><div className="sc-dashboard-game-body p-5 space-y-4"><TeamRow team={game.awayTeam} score={game.awayScore}/><div className="sc-dashboard-team-divider h-px bg-[#3b494b]/30"/><TeamRow team={game.homeTeam} score={game.homeScore}/><div className="sc-dashboard-pitchers pt-3 border-t border-[#3b494b]/20"><p className="sc-dashboard-pitchers-label text-[9px] text-[#849495] mb-2">PROBABLE PITCHERS</p><p className="sc-dashboard-pitchers-names text-xs text-[#b9cacb] truncate">{game.awayProbablePitcher?.name ?? 'TBD'} <span className="text-[#596879]">vs</span> {game.homeProbablePitcher?.name ?? 'TBD'}</p></div></div></button>)}</div>}
      </div>
    </div>

    {reportOpen && <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={() => setReportOpen(false)}>
      <div className="w-full max-w-5xl max-h-[88vh] overflow-y-auto bg-[#131b2e] border border-[#00f0ff]/30 rounded-2xl shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-[#131b2e] px-5 sm:px-6 py-5 border-b border-[#3b494b]/20 flex justify-between gap-4"><div><span className="font-label-caps text-[10px] text-[#65f2b5]">DAILY IXMETRICS INTELLIGENCE</span><h2 className="text-2xl sm:text-3xl font-bold mt-1">{displayHeadline}</h2><p className="text-sm text-[#9ba9b7] mt-1">Live MLB schedule context plus verified IXMetrics analytics signals.</p></div><button onClick={() => setReportOpen(false)} className="w-9 h-9 rounded-full bg-[#0b1326] text-xl shrink-0">×</button></div>
        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-3 gap-3"><BriefStat label="MATCHUP EDGES" value={edgeCount}/><BriefStat label="HOT PLAYERS" value={hotCount}/><BriefStat label="WATCH ALERTS" value={watchCount}/></div>
          <section><p className="font-label-caps text-xs text-[#9ba9b7] mb-3">TODAY’S INTELLIGENCE</p>{displaySignals.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{displaySignals.map((signal, index) => <SignalCard key={`report-${signal.kind}-${signal.player}-${index}`} signal={signal} onOpen={() => openSignal(signal)} />)}</div> : <div className="rounded-xl bg-[#101a30] p-5 text-sm text-[#9ba9b7]">Today’s MLB schedule is still loading. Close this report and press Refresh to try again.</div>}</section>
          {report?.watchList?.length ? <section className="rounded-xl bg-[#101a30] p-5"><p className="font-label-caps text-xs text-[#65f2b5]">IXMETRICS WATCHLIST</p><div className="mt-3 space-y-2">{report.watchList.map((item, index) => <div key={index} className="flex items-start gap-2 text-sm text-[#c7d0dd]"><span className="text-[#00f0ff]">•</span><span>{item}</span></div>)}</div></section> : null}
          {report?.caveats?.length ? <section className="rounded-xl border border-[#3b494b]/20 bg-[#0d1727] p-5"><p className="font-label-caps text-xs text-[#8f9dac]">DATA NOTES</p><div className="mt-3 space-y-2">{report.caveats.map((item, index) => <p key={index} className="text-xs leading-5 text-[#8f9dac]">• {item}</p>)}</div></section> : null}
        </div>
      </div>
    </div>}

    {selectedSignal && <SignalDetailModal signal={selectedSignal} onClose={() => setSelectedSignal(null)} />}
  </div>;
};

const Metric = ({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) => <div className="bg-[#171f33] p-4 rounded-xl border border-[#3b494b]/20 min-w-[140px] sm:min-w-[180px]"><span className="text-[#849495] block mb-2 text-[10px]">{label}</span><span className={`text-[30px] sm:text-[32px] ${accent ? 'text-[#65f2b5]' : 'text-[#dbfcff]'}`}>{value}</span></div>;

const BriefStat = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="bg-[#101a30] rounded-lg px-3 py-3 border border-[#3b494b]/15"><p className="text-[9px] sm:text-[10px] text-[#8f9dac] leading-tight">{label}</p><p className="font-data-numeric text-xl sm:text-2xl text-[#dbfcff] mt-1">{value}</p></div>;

const SignalHeadshot = ({ playerId, name, large = false }: { playerId?: number; name?: string; large?: boolean }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [playerId]);
  if (!playerId || failed) return <span className={`${large ? 'mb-9 text-2xl' : 'mb-6 text-sm'} font-extrabold text-[#00f0ff]`}>{playerInitials(name)}</span>;
  return <img src={mlbPlayerHeadshotUrl(playerId, large ? 320 : 220)} onError={() => setFailed(true)} alt={`${name ?? 'MLB player'} headshot`} className={`${large ? '' : 'sc-mobile-signal-headshot'} h-full w-full object-cover object-top`} loading={large ? 'eager' : 'lazy'} />;
};

const SignalCard = ({ signal, onOpen }: { signal: DailySignal; onOpen: () => void }) => {
  const kind = normalizedKind(signal);
  const playerId = signalPlayerId(signal);
  return <button onClick={onOpen} className="sc-dashboard-signal-card group flex h-full min-w-0 flex-col rounded-xl border border-[#3b494b]/15 bg-[#171f33] p-4 text-center transition-colors hover:border-[#00f0ff]/45">
    <div className="flex w-full items-start justify-between gap-3">
      <div className={`sc-dashboard-signal-kind inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${signalAccent(kind)}`}><span className="sc-dashboard-signal-kind-icon material-symbols-outlined text-[15px]">{signalIcon(kind)}</span><span>{compactSignalKind(kind)}</span></div>
      <span className="sc-dashboard-signal-value text-xs font-bold text-[#65f2b5]">{signal.value ?? (signal.score != null ? Number(signal.score).toFixed(1) : 'WATCH')}</span>
    </div>
    <div className="sc-dashboard-signal-photo mx-auto mt-3 flex h-20 w-20 shrink-0 items-end justify-center overflow-hidden rounded-full border border-[#2c4a65] bg-[radial-gradient(circle_at_50%_32%,#2b4a63_0%,#0a1728_72%)]">
      <SignalHeadshot playerId={playerId} name={signal.player} />
    </div>
    <h4 className="sc-dashboard-signal-name mt-3 flex min-h-[48px] items-center justify-center font-bold leading-tight text-[#dbfcff] group-hover:text-[#00f0ff]">{signal.player || signal.team || 'IXMetrics signal'}</h4>
    <p className="sc-dashboard-signal-meta mt-1 min-h-[34px] text-[11px] leading-4 text-[#a5b1c1]">{signal.team}{signal.opponentPitcher ? ` · vs ${signal.opponentPitcher}` : ''}</p>
    <p className="sc-dashboard-signal-reason mt-3 text-xs leading-5 text-[#b9cacb]">{signal.reason || 'Verified IXMetrics analytics signal available.'}</p>
    <div className="sc-dashboard-signal-more mt-auto pt-3 text-[10px] font-bold text-[#00f0ff]">VIEW MORE →</div>
  </button>;
};

const SignalDetailModal = ({ signal, onClose }: { signal: DailySignal; onClose: () => void }) => {
  const kind = normalizedKind(signal);
  const playerId = signalPlayerId(signal);
  const recentLabel = kind === 'HOT HITTER' ? 'LAST 10 GAMES' : kind === 'PITCHER WATCH' ? 'RECENT FORM' : 'VERIFIED SIGNAL';
  const matchupText = signal.opponentPitcher
    ? `vs ${signal.opponentPitcher}${signal.gamePk ? ' in today\'s scheduled matchup.' : '.'}`
    : signal.gamePk
      ? 'Opponent, lineup and game context will update here when MLB confirms them.'
      : 'Matchup context updates automatically when verified MLB data is available.';

  return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#020813]/85 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <article role="dialog" aria-modal="true" aria-labelledby="signal-detail-title" className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#00f0ff]/35 bg-[#0b1729] shadow-[0_24px_80px_rgba(0,0,0,.65)]">
      <button type="button" onClick={onClose} aria-label="Close player details" className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#8393a7]/45 bg-[#07111f]/90 text-[#e8f1ff] hover:border-[#00f0ff]"><span className="material-symbols-outlined">close</span></button>
      <div className="p-5 sm:p-7">
        <div className="flex items-start gap-4 pr-10">
          <div className="flex h-28 w-28 shrink-0 items-end justify-center overflow-hidden rounded-full border border-[#2c4a65] bg-[radial-gradient(circle_at_50%_32%,#2b4a63_0%,#0a1728_72%)]">
            <SignalHeadshot playerId={playerId} name={signal.player} large />
          </div>
          <div className="min-w-0 pt-1">
            <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-extrabold ${signalAccent(kind)}`}><span className="material-symbols-outlined text-[14px]">{signalIcon(kind)}</span>{kind}</span><strong className="text-sm text-[#65f2b5]">{signal.value ?? 'WATCH'}</strong></div>
            <h2 id="signal-detail-title" className="mt-2 text-2xl font-extrabold text-white">{signal.player || signal.team || 'IXMetrics signal'}</h2>
            <p className="mt-1 text-sm text-[#c2ccda]">{signal.team}</p>
          </div>
        </div>

        <div className="my-5 h-px bg-[#28405a]" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-0">
          <section className="sm:border-r sm:border-[#28405a] sm:pr-5"><h3 className="text-xs font-extrabold text-[#26e8ef]">{recentLabel}</h3><p className="mt-2 text-sm leading-6 text-[#d3dbe7]">{signal.reason || 'Verified recent MLB data supports this IXMetrics signal.'}</p></section>
          <section className="sm:pl-5"><h3 className="text-xs font-extrabold text-[#26e8ef]">TODAY'S MATCHUP</h3><p className="mt-2 text-sm leading-6 text-[#d3dbe7]">{matchupText}</p></section>
        </div>

        <div className="my-5 h-px bg-[#28405a]" />
        <section><h3 className="text-xs font-extrabold text-[#65f2b5]">IXMETRICS TAKE</h3><p className="mt-2 text-sm leading-6 text-[#d3dbe7]">This signal is based on verified MLB form and matchup data. It identifies a player worth watching, not a guaranteed outcome.</p></section>
        <p className="mt-5 text-center text-xs text-[#8392a6]">Tap outside or press Escape to close</p>
      </div>
    </article>
  </div>;
};

const ScanningCard = ({ icon, title, text }: { icon: string; title: string; text: string }) => <div className="rounded-xl border border-[#3b494b]/15 bg-[#171f33] p-4"><div className="w-9 h-9 rounded-lg bg-[#00f0ff]/8 text-[#00f0ff] flex items-center justify-center"><span className="material-symbols-outlined text-[20px]">{icon}</span></div><h4 className="mt-3 font-bold text-sm">{title}</h4><p className="mt-2 text-xs leading-5 text-[#8f9dac]">{text}</p><div className="mt-3 text-[10px] text-[#65f2b5]">AUTO-SCANNING</div></div>;

const TeamRow = ({ team, score }: { team: MlbScheduleGame['awayTeam']; score?: number }) => <div className="sc-dashboard-team-row flex items-center gap-3"><div className="sc-dashboard-team-logo w-12 h-12 rounded-xl bg-[#e7ebf0] p-1.5"><img src={mlbTeamLogoUrl(team.id)} alt={`${team.name} logo`} className="w-full h-full object-contain"/></div><div className="sc-dashboard-team-copy flex-1"><p className="sc-dashboard-team-abbreviation text-xs font-bold">{team.abbreviation ?? team.name}</p><p className="sc-dashboard-team-name text-[11px] text-[#849495]">{team.name}</p></div><span className="sc-dashboard-team-score text-xl">{score ?? '—'}</span></div>;
