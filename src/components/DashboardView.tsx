import React, { useEffect, useMemo, useState } from 'react';
import { NavigationTab } from '../types';
import type { MlbScheduleGame } from '../services/mlbApi';
import { fetchSchedule } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl, playerInitials } from '../services/mlbMedia';
import { LOGO_URL } from '../data/mockData';

type SignalKind = 'MATCHUP EDGE' | 'HOT HITTER' | 'PITCHER WATCH' | 'BULLPEN WATCH';

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

const gameLabel = (game: MlbScheduleGame) => game.detailedState === 'Final'
  ? 'FINAL'
  : game.status === 'Live'
    ? 'LIVE'
    : formatGameTime(game.gameDate);

const gameDestinationLabel = (game: MlbScheduleGame) => game.status === 'Live'
  ? '● LIVE   VIEW LIVE →'
  : game.detailedState === 'Final'
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

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectTab, onSelectMatchup }) => {
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [briefInfoOpen, setBriefInfoOpen] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<DailySignal | null>(null);

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
    onSelectTab(game.status === 'Live' || game.detailedState === 'Final' ? 'live-game' : 'matchups');
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

  const autoHeadline = 'ScoutCore is scanning today’s verified matchup data';
  const autoSummary = 'Matchup edges, hot hitters and pitching watch alerts will appear here only when ScoutCore has enough verified MLB data to support them.';
  const displayHeadline = signals.length ? report?.headline : games.length ? `ScoutCore is watching ${games.length} MLB games today` : autoHeadline;
  const displaySummary = signals.length ? report?.summary : games.length ? 'Today’s confirmed games and probable-pitcher matchups are ready. Stronger analytics signals will appear as verified lineup and game-log data clears ScoutCore’s thresholds.' : autoSummary;

  const openSignal = (signal: DailySignal) => {
    setSelectedSignal(signal);
  };

  const openSelectedSignalMatchup = () => {
    if (!selectedSignal) return;
    const game = games.find(item => item.gamePk === selectedSignal.gamePk);
    setSelectedSignal(null);
    if (game) {
      openGameMatchup(game);
      return;
    }
    setReportOpen(false);
    onSelectTab('matchups');
  };

  return <div className="flex flex-col w-full min-h-screen bg-[#0b1326] text-[#dae2fd]">
    <section className="relative px-4 sm:px-6 lg:px-8 py-8 overflow-hidden border-b border-[#3b494b]/10">
      <div className="absolute inset-0 bg-gradient-to-r from-[#060e20] via-[#0b1326] to-transparent" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl flex gap-5 items-start">
          <div className="hidden sm:flex w-20 h-20 rounded-2xl bg-[#131b2e] border border-[#00f0ff]/25 items-center justify-center p-3"><img src={LOGO_URL} alt="ScoutCore logo" className="max-w-full max-h-full object-contain" /></div>
          <div>
            <div className="flex items-center gap-3 mb-3"><span className="px-2.5 py-1 bg-[#d8ffe7]/10 border border-[#d8ffe7]/20 text-[#65f2b5] rounded-full text-[10px]">LIVE GAME ENGINE</span><span className="text-[#849495] text-[10px]">{lastUpdated ? `UPDATED ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'UPDATING'}</span></div>
            <h1 className="font-display-lg text-[38px] sm:text-[44px] text-[#dbfcff] mb-2 leading-none">Gameday <span className="text-[#b9cacb] font-light italic">Intelligence</span></h1>
            <p className="text-sm text-[#b9cacb]">ScoutCore is connected directly to MLB data. {games.length} games are scheduled today{liveCount ? `, with ${liveCount} live` : ''}.</p>
          </div>
        </div>
        <div className="flex gap-3 sm:gap-4"><Metric label="TODAY'S GAMES" value={loading ? '—' : games.length}/><Metric label="LIVE NOW" value={loading ? '—' : liveCount} accent/></div>
      </div>
    </section>

    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <section className="bg-[#131b2e] rounded-2xl border border-[#00f0ff]/20 overflow-visible shadow-[0_0_30px_rgba(0,240,255,.04)]">
        <div className="px-4 sm:px-6 py-4 border-b border-[#3b494b]/20 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="ScoutCore" className="w-10 h-10 object-contain"/>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg">Daily ScoutCore Intelligence</h2>
                <div className="relative">
                  <button type="button" aria-label="What is Daily ScoutCore Intelligence?" aria-expanded={briefInfoOpen} onClick={() => setBriefInfoOpen(value => !value)} className="w-5 h-5 rounded-full border border-[#00f0ff]/45 text-[#00f0ff] text-[12px] font-bold leading-none flex items-center justify-center hover:bg-[#00f0ff]/10">i</button>
                  {briefInfoOpen && <div className="absolute left-0 top-7 z-30 w-[310px] max-w-[80vw] rounded-xl border border-[#00f0ff]/25 bg-[#0d172b] p-4 shadow-2xl"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-[#dbfcff]">What is this?</p><button onClick={() => setBriefInfoOpen(false)} className="text-[#8f9dac] hover:text-white text-base leading-none">×</button></div><p className="mt-2 text-xs leading-5 text-[#b9cacb]">This is ScoutCore’s signal board — not another schedule. It highlights verified matchup edges, recent hitter form, pitcher trends and bullpen watch items that may deserve a deeper look.</p><p className="mt-2 text-[11px] leading-4 text-[#65f2b5]">Signals appear only when the data pipeline has enough verified information.</p></div>}
                </div>
              </div>
              <p className="text-[11px] text-[#9ba9b7]">WHAT MATTERS TODAY · VERIFIED MLB SIGNALS</p>
            </div>
          </div>
          <div className="flex items-center gap-3"><span className="text-[11px] text-[#65f2b5]">● AUTO-UPDATING</span><button onClick={() => setReportOpen(true)} className="px-4 py-2 rounded-lg border border-[#00f0ff]/35 text-[#00f0ff] text-xs font-bold hover:bg-[#00f0ff]/10">VIEW DAILY REPORT</button></div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 mb-5">
            <div><span className="font-label-caps text-[10px] text-[#65f2b5]">TODAY’S SIGNAL BOARD</span><h3 className="text-2xl font-bold mt-1">{displayHeadline}</h3><p className="text-sm text-[#b9cacb] mt-2 max-w-3xl">{displaySummary}</p></div>
            <div className="grid grid-cols-3 gap-2 min-w-0 sm:min-w-[360px]"><BriefStat label="MATCHUP EDGES" value={edgeCount}/><BriefStat label="HOT PLAYERS" value={hotCount}/><BriefStat label="WATCH ALERTS" value={watchCount}/></div>
          </div>

          {displaySignals.length > 0
            ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">{displaySignals.slice(0, 4).map((signal, index) => <SignalCard key={`${signal.kind}-${signal.player}-${index}`} signal={signal} onOpen={() => openSignal(signal)} />)}</div>
            : <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <ScanningCard icon="query_stats" title="Matchup Edges" text="Waiting for verified hitter-vs-pitcher data to clear the signal threshold." />
                <ScanningCard icon="local_fire_department" title="Hot Players" text="Recent MLB game logs are being checked for meaningful hitter form." />
                <ScanningCard icon="visibility" title="Watch Alerts" text="Pitcher and bullpen trends will appear when verified context is available." />
              </div>}

          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs"><button onClick={() => onSelectTab('matchups')} className="text-[#00f0ff] hover:underline">EXPLORE MATCHUP INTELLIGENCE →</button><span className="text-[#596879]">•</span><span className="text-[#8f9dac]">Signals are analytics clues, not guaranteed outcomes.</span></div>
        </div>
      </section>

      <div className="sc-dashboard-games">
        <div className="sc-dashboard-games-header flex items-center justify-between mb-5"><h2 className="font-headline-lg text-[22px] font-bold">Today's MLB Games</h2><button onClick={() => void loadGames()} className="inline-flex items-center gap-1.5 rounded-lg border border-[#00f0ff]/35 px-3 py-2 text-xs font-bold text-[#00f0ff] hover:bg-[#00f0ff]/10"><span className="material-symbols-outlined text-[17px]">refresh</span>REFRESH</button></div>
        {error && <div className="mb-5 p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}
        {loading ? <div className="bg-[#171f33] rounded-xl p-8 text-center text-[#849495]">Loading today's MLB schedule…</div>
          : games.length === 0 ? <div className="bg-[#171f33] rounded-xl p-8 text-center text-[#849495]">No MLB games are scheduled today.</div>
          : <div className="sc-dashboard-games-list grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{games.map(game => <button key={game.gamePk} onClick={() => openGameMatchup(game)} className="sc-dashboard-game-card text-left bg-[#131b2e] rounded-xl overflow-hidden border border-[#3b494b]/20 hover:border-[#00f0ff]/40"><div className="sc-dashboard-game-meta px-4 py-3 bg-[#222a3d]/50 flex justify-between"><span className="text-[10px] text-[#00f0ff]">{formatGameTime(game.gameDate)}</span><span className={`text-[10px] ${game.status === 'Live' ? 'font-bold text-[#ff7582]' : 'text-[#849495]'}`}>{gameDestinationLabel(game)}</span></div><div className="sc-dashboard-game-body p-5 space-y-4"><TeamRow team={game.awayTeam} score={game.awayScore}/><div className="sc-dashboard-team-divider h-px bg-[#3b494b]/30"/><TeamRow team={game.homeTeam} score={game.homeScore}/><div className="sc-dashboard-pitchers pt-3 border-t border-[#3b494b]/20"><p className="sc-dashboard-pitchers-label text-[9px] text-[#849495] mb-2">PROBABLE PITCHERS</p><p className="sc-dashboard-pitchers-names text-xs text-[#b9cacb] truncate">{game.awayProbablePitcher?.name ?? 'TBD'} <span className="text-[#596879]">vs</span> {game.homeProbablePitcher?.name ?? 'TBD'}</p></div></div></button>)}</div>}
      </div>
    </div>

    {reportOpen && <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={() => setReportOpen(false)}>
      <div className="w-full max-w-5xl max-h-[88vh] overflow-y-auto bg-[#131b2e] border border-[#00f0ff]/30 rounded-2xl shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-[#131b2e] px-5 sm:px-6 py-5 border-b border-[#3b494b]/20 flex justify-between gap-4"><div><span className="font-label-caps text-[10px] text-[#65f2b5]">DAILY SCOUTCORE INTELLIGENCE</span><h2 className="text-2xl sm:text-3xl font-bold mt-1">{displayHeadline}</h2><p className="text-sm text-[#9ba9b7] mt-1">Live MLB schedule context plus verified ScoutCore analytics signals.</p></div><button onClick={() => setReportOpen(false)} className="w-9 h-9 rounded-full bg-[#0b1326] text-xl shrink-0">×</button></div>
        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-3 gap-3"><BriefStat label="MATCHUP EDGES" value={edgeCount}/><BriefStat label="HOT PLAYERS" value={hotCount}/><BriefStat label="WATCH ALERTS" value={watchCount}/></div>
          <section><p className="font-label-caps text-xs text-[#9ba9b7] mb-3">TODAY’S INTELLIGENCE</p>{displaySignals.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{displaySignals.map((signal, index) => <SignalCard key={`report-${signal.kind}-${signal.player}-${index}`} signal={signal} onOpen={() => openSignal(signal)} />)}</div> : <div className="rounded-xl bg-[#101a30] p-5 text-sm text-[#9ba9b7]">Today’s MLB schedule is still loading. Close this report and press Refresh to try again.</div>}</section>
          {report?.watchList?.length ? <section className="rounded-xl bg-[#101a30] p-5"><p className="font-label-caps text-xs text-[#65f2b5]">SCOUTCORE WATCHLIST</p><div className="mt-3 space-y-2">{report.watchList.map((item, index) => <div key={index} className="flex items-start gap-2 text-sm text-[#c7d0dd]"><span className="text-[#00f0ff]">•</span><span>{item}</span></div>)}</div></section> : null}
          {report?.caveats?.length ? <section className="rounded-xl border border-[#3b494b]/20 bg-[#0d1727] p-5"><p className="font-label-caps text-xs text-[#8f9dac]">DATA NOTES</p><div className="mt-3 space-y-2">{report.caveats.map((item, index) => <p key={index} className="text-xs leading-5 text-[#8f9dac]">• {item}</p>)}</div></section> : null}
        </div>
      </div>
    </div>}

    {selectedSignal && <SignalDetailModal signal={selectedSignal} onClose={() => setSelectedSignal(null)} onOpenMatchup={openSelectedSignalMatchup} />}
  </div>;
};

const Metric = ({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) => <div className="bg-[#171f33] p-4 rounded-xl border border-[#3b494b]/20 min-w-[140px] sm:min-w-[180px]"><span className="text-[#849495] block mb-2 text-[10px]">{label}</span><span className={`text-[30px] sm:text-[32px] ${accent ? 'text-[#65f2b5]' : 'text-[#dbfcff]'}`}>{value}</span></div>;

const BriefStat = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="bg-[#101a30] rounded-lg px-3 py-3 border border-[#3b494b]/15"><p className="text-[9px] sm:text-[10px] text-[#8f9dac] leading-tight">{label}</p><p className="font-data-numeric text-xl sm:text-2xl text-[#dbfcff] mt-1">{value}</p></div>;

const SignalCard = ({ signal, onOpen }: { signal: DailySignal; onOpen: () => void }) => {
  const kind = normalizedKind(signal);
  const playerId = signalPlayerId(signal);
  return <button onClick={onOpen} className="text-left rounded-xl bg-[#171f33] border border-[#3b494b]/15 p-4 hover:border-[#00f0ff]/45 transition-colors group">
    <div className="flex items-start justify-between gap-3">
      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${signalAccent(kind)}`}><span className="material-symbols-outlined text-[15px]">{signalIcon(kind)}</span>{kind}</div>
      <span className="text-xs font-bold text-[#65f2b5]">{signal.value ?? (signal.score != null ? Number(signal.score).toFixed(1) : 'WATCH')}</span>
    </div>
    {playerId
      ? <img src={mlbPlayerHeadshotUrl(playerId, 220)} alt={`${signal.player} headshot`} className="sc-mobile-signal-headshot mx-auto mt-2 h-20 w-20 object-contain object-bottom" loading="lazy" />
      : <div className="mx-auto mt-3 flex h-14 w-14 items-center justify-center rounded-full border border-[#00f0ff]/25 bg-[#0c1728] text-sm font-extrabold text-[#00f0ff]">{playerInitials(signal.player)}</div>}
    <h4 className="mt-3 font-bold text-[#dbfcff] group-hover:text-[#00f0ff]">{signal.player || signal.team || 'ScoutCore signal'}</h4>
    <p className="mt-1 text-[11px] text-[#849495]">{signal.team}{signal.opponentPitcher ? ` · vs ${signal.opponentPitcher}` : ''}{signal.confidence != null ? ` · ${signal.confidence}% data confidence` : ''}</p>
    <p className="mt-3 text-xs leading-5 text-[#b9cacb]">{signal.reason || 'Verified ScoutCore analytics signal available.'}</p>
    <div className="mt-3 text-[10px] font-bold text-[#00f0ff]">VIEW MORE →</div>
  </button>;
};

const SignalDetailModal = ({ signal, onClose, onOpenMatchup }: { signal: DailySignal; onClose: () => void; onOpenMatchup: () => void }) => {
  const kind = normalizedKind(signal);
  const playerId = signalPlayerId(signal);
  const recentLabel = kind === 'HOT HITTER' ? 'LAST 10 GAMES' : kind === 'PITCHER WATCH' ? 'RECENT FORM' : 'VERIFIED SIGNAL';
  const matchupText = signal.opponentPitcher
    ? `vs ${signal.opponentPitcher}${signal.gamePk ? ' in today\'s scheduled matchup.' : '.'}`
    : signal.gamePk
      ? 'Open the matchup for the latest opponent, lineup and game context.'
      : 'Matchup context updates automatically when verified MLB data is available.';

  return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#020813]/85 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <article role="dialog" aria-modal="true" aria-labelledby="signal-detail-title" className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#00f0ff]/35 bg-[#0b1729] shadow-[0_24px_80px_rgba(0,0,0,.65)]">
      <button type="button" onClick={onClose} aria-label="Close player details" className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#8393a7]/45 bg-[#07111f]/90 text-[#e8f1ff] hover:border-[#00f0ff]"><span className="material-symbols-outlined">close</span></button>
      <div className="p-5 sm:p-7">
        <div className="flex items-start gap-4 pr-10">
          <div className="flex h-28 w-28 shrink-0 items-end justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#17314a] to-[#091322]">
            {playerId ? <img src={mlbPlayerHeadshotUrl(playerId, 320)} alt={`${signal.player} headshot`} className="h-full w-full object-contain object-bottom" /> : <span className="mb-7 text-2xl font-extrabold text-[#00f0ff]">{playerInitials(signal.player)}</span>}
          </div>
          <div className="min-w-0 pt-1">
            <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-extrabold ${signalAccent(kind)}`}><span className="material-symbols-outlined text-[14px]">{signalIcon(kind)}</span>{kind}</span><strong className="text-sm text-[#65f2b5]">{signal.value ?? 'WATCH'}</strong></div>
            <h2 id="signal-detail-title" className="mt-2 text-2xl font-extrabold text-white">{signal.player || signal.team || 'ScoutCore signal'}</h2>
            <p className="mt-1 text-sm text-[#c2ccda]">{signal.team}</p>
            {signal.confidence != null && <p className="mt-1 text-xs text-[#9caabc]">{signal.confidence}% data confidence</p>}
          </div>
        </div>

        <div className="my-5 h-px bg-[#28405a]" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-0">
          <section className="sm:border-r sm:border-[#28405a] sm:pr-5"><h3 className="text-xs font-extrabold text-[#26e8ef]">{recentLabel}</h3><p className="mt-2 text-sm leading-6 text-[#d3dbe7]">{signal.reason || 'Verified recent MLB data supports this ScoutCore signal.'}</p></section>
          <section className="sm:pl-5"><h3 className="text-xs font-extrabold text-[#26e8ef]">TODAY'S MATCHUP</h3><p className="mt-2 text-sm leading-6 text-[#d3dbe7]">{matchupText}</p></section>
        </div>

        <div className="my-5 h-px bg-[#28405a]" />
        <section><h3 className="text-xs font-extrabold text-[#65f2b5]">SCOUTCORE TAKE</h3><p className="mt-2 text-sm leading-6 text-[#d3dbe7]">This signal is based on verified MLB form and matchup data. It identifies a player worth watching, not a guaranteed outcome.</p></section>
        <button type="button" onClick={onOpenMatchup} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#00f0ff]/45 bg-[#00f0ff]/10 px-4 py-3 text-sm font-extrabold text-[#29eaf2] hover:bg-[#00f0ff]/20">VIEW MATCHUP <span className="material-symbols-outlined text-[18px]">arrow_forward</span></button>
        <p className="mt-3 text-center text-xs text-[#8392a6]">Tap outside or press Escape to close</p>
      </div>
    </article>
  </div>;
};

const ScanningCard = ({ icon, title, text }: { icon: string; title: string; text: string }) => <div className="rounded-xl border border-[#3b494b]/15 bg-[#171f33] p-4"><div className="w-9 h-9 rounded-lg bg-[#00f0ff]/8 text-[#00f0ff] flex items-center justify-center"><span className="material-symbols-outlined text-[20px]">{icon}</span></div><h4 className="mt-3 font-bold text-sm">{title}</h4><p className="mt-2 text-xs leading-5 text-[#8f9dac]">{text}</p><div className="mt-3 text-[10px] text-[#65f2b5]">AUTO-SCANNING</div></div>;

const TeamRow = ({ team, score }: { team: MlbScheduleGame['awayTeam']; score?: number }) => <div className="sc-dashboard-team-row flex items-center gap-3"><div className="sc-dashboard-team-logo w-12 h-12 rounded-xl bg-[#e7ebf0] p-1.5"><img src={mlbTeamLogoUrl(team.id)} alt={`${team.name} logo`} className="w-full h-full object-contain"/></div><div className="sc-dashboard-team-copy flex-1"><p className="sc-dashboard-team-abbreviation text-xs font-bold">{team.abbreviation ?? team.name}</p><p className="sc-dashboard-team-name text-[11px] text-[#849495]">{team.name}</p></div><span className="sc-dashboard-team-score text-xl">{score ?? '—'}</span></div>;
