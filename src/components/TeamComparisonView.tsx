import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPitcherVsTeam,
  fetchPlayerRecentGameLogs,
  fetchSchedule,
  fetchTeamSeasonStats,
} from '../services/mlbClient';
import { mlbPlayerCutoutUrl, mlbPlayerHeadshotUrl, mlbTeamLogoUrl, playerInitials } from '../services/mlbMedia';
import {
  applyTeamAnalysisResult,
  freeAnalysisAccess,
  getAnalysisAccess,
  guestAnalysisAccess,
  openTeamAnalysis,
  type AnalysisAccess,
  type SavedTeamAnalysis,
} from '../services/accessControl';
import { AnalysisAccessBanner, AnalysisLimitDialog } from './AnalysisAccess';
import type { SelectedGame } from './SelectedGameMatchupView';

type Side = 'away' | 'home';

type SideData = {
  team: NonNullable<SelectedGame['awayTeam']>;
  record?: { wins: number; losses: number; pct?: string };
  pitcher: any;
  hitters: any[];
  teamStats: { hitting: any; pitching: any };
  recentPitching: any[];
};

type TeamMetrics = {
  slg: number | null;
  obp: number | null;
  ops: number | null;
  starterK9: number | null;
  starterEra: number | null;
  starterWhip: number | null;
  teamEra: number | null;
  teamWhip: number | null;
  homeRuns: number | null;
};

type BreakdownScore = {
  offense: number;
  starter: number;
  overall: number;
};

const average = (values: any[]) => {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
};

const numeric = (value: any) => Number.isFinite(Number(value)) ? Number(value) : null;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const rate = (value: number | null, low: number, high: number) => value == null ? 50 : clamp(((value - low) / (high - low)) * 100, 0, 100);
const inverseRate = (value: number | null, low: number, high: number) => 100 - rate(value, low, high);
const fmt = (value: any, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits).replace(/^0/, '') : '—';
const fmtWhole = (value: any) => Number.isFinite(Number(value)) ? Math.round(Number(value)).toString() : '—';
const currentSeason = new Date().getFullYear();

const teamMetrics = (data: SideData | null): TeamMetrics => {
  const hitting = data?.teamStats?.hitting ?? {};
  const pitching = data?.teamStats?.pitching ?? {};
  const hitters = data?.hitters ?? [];
  const pitcher = data?.pitcher?.stats ?? {};
  const rosterHomeRuns = hitters.reduce((sum: number, player: any) => sum + (Number(player.stats?.homeRuns) || 0), 0);

  return {
    slg: numeric(hitting.slg) ?? average(hitters.map((player: any) => player.stats?.slg)),
    obp: numeric(hitting.obp) ?? average(hitters.map((player: any) => player.stats?.obp)),
    ops: numeric(hitting.ops) ?? average(hitters.map((player: any) => player.stats?.ops)),
    starterK9: numeric(pitcher.strikeoutsPer9Inn),
    starterEra: numeric(pitcher.era),
    starterWhip: numeric(pitcher.whip),
    teamEra: numeric(pitching.era),
    teamWhip: numeric(pitching.whip),
    homeRuns: numeric(hitting.homeRuns) ?? rosterHomeRuns,
  };
};

const breakdownScore = (metrics: TeamMetrics): BreakdownScore => {
  const offense = Math.round(rate(metrics.slg, .330, .510) * .58 + rate(metrics.obp, .275, .385) * .42);
  const starter = Math.round(
    rate(metrics.starterK9, 5.5, 12.5) * .4
    + inverseRate(metrics.starterEra, 2.2, 6.2) * .38
    + inverseRate(metrics.starterWhip, 1.0, 1.65) * .22,
  );
  return { offense, starter, overall: Math.round(offense * .56 + starter * .44) };
};

const modelEdge = (away: BreakdownScore, home: BreakdownScore) => {
  const difference = away.overall - home.overall;
  let awayIndex = clamp(Math.round(50 + difference * .42), 25, 75);
  if (difference !== 0 && awayIndex === 50) awayIndex += difference > 0 ? 1 : -1;
  return { away: awayIndex, home: 100 - awayIndex };
};

const edgeLanguage = (difference: number) => {
  const gap = Math.abs(difference);
  if (gap <= 1) return 'NEARLY EVEN';
  if (gap <= 4) return 'SLIGHT EDGE';
  if (gap <= 8) return 'CLEAR EDGE';
  return 'STRONG EDGE';
};

const recordLabel = (record?: { wins: number; losses: number }) => record ? `${record.wins}-${record.losses}` : 'Record —';

const inningsToOuts = (value: any) => {
  const text = String(value ?? '0');
  const [whole, fraction = '0'] = text.split('.');
  return (Number(whole) || 0) * 3 + clamp(Number(fraction) || 0, 0, 2);
};

const recentPitcherSummary = (logs: any[]) => {
  if (!logs?.length) return 'Recent form unavailable';
  const summary = logs.slice(0, 3).reduce((result, row) => {
    const stat = row.stat ?? {};
    result.outs += inningsToOuts(stat.inningsPitched);
    result.earnedRuns += Number(stat.earnedRuns) || 0;
    result.wins += Number(stat.wins) || 0;
    result.losses += Number(stat.losses) || 0;
    return result;
  }, { outs: 0, earnedRuns: 0, wins: 0, losses: 0 });
  const era = summary.outs ? (summary.earnedRuns * 27) / summary.outs : null;
  const decision = summary.wins || summary.losses ? `${summary.wins}-${summary.losses}, ` : '';
  return `Last ${Math.min(3, logs.length)} G: ${decision}${era == null ? '—' : era.toFixed(2)} ERA`;
};

type TeamComparisonViewProps = {
  selectedGame?: SelectedGame | null;
  signedIn: boolean;
  onSignIn: () => void;
  onUpgrade: () => void;
};

type AnalysisRequest = { gamePk: number; nonce: number };

const toSavedTeamAnalysis = (game: any): SavedTeamAnalysis => ({
  gamePk: Number(game.gamePk),
  ...(typeof game.gameDate === 'string' ? { gameDate: game.gameDate } : {}),
  ...(typeof game.status === 'string' ? { status: game.status } : {}),
  ...(typeof game.detailedState === 'string' ? { detailedState: game.detailedState } : {}),
  awayTeam: {
    id: Number(game.awayTeam.id),
    name: game.awayTeam.name,
    ...(game.awayTeam.abbreviation ? { abbreviation: game.awayTeam.abbreviation } : {}),
  },
  homeTeam: {
    id: Number(game.homeTeam.id),
    name: game.homeTeam.name,
    ...(game.homeTeam.abbreviation ? { abbreviation: game.homeTeam.abbreviation } : {}),
  },
  awayProbablePitcher: game.awayProbablePitcher
    ? { id: Number(game.awayProbablePitcher.id), name: game.awayProbablePitcher.name }
    : null,
  homeProbablePitcher: game.homeProbablePitcher
    ? { id: Number(game.homeProbablePitcher.id), name: game.homeProbablePitcher.name }
    : null,
  ...(game.awayRecord ? { awayRecord: game.awayRecord } : {}),
  ...(game.homeRecord ? { homeRecord: game.homeRecord } : {}),
});

const savedAnalysisGame = (selection: SavedTeamAnalysis) => ({
  ...selection,
  gameDate: selection.gameDate ?? '',
  status: selection.status ?? 'Preview',
  detailedState: selection.detailedState ?? 'Saved analysis',
});

const matchupLabel = (selection: Pick<SavedTeamAnalysis, 'awayTeam' | 'homeTeam'>) =>
  `${selection.awayTeam.abbreviation ?? selection.awayTeam.name} vs ${selection.homeTeam.abbreviation ?? selection.homeTeam.name}`;

export const TeamComparisonView: React.FC<TeamComparisonViewProps> = ({ selectedGame = null, signedIn, onSignIn, onUpgrade }) => {
  const [games, setGames] = useState<any[]>([]);
  const [pk, setPk] = useState<number | null>(null);
  const [away, setAway] = useState<SideData | null>(null);
  const [home, setHome] = useState<SideData | null>(null);
  const [activeHitters, setActiveHitters] = useState<Side>('away');
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadedGamePk, setLoadedGamePk] = useState<number | null>(null);
  const [analysisRequest, setAnalysisRequest] = useState<AnalysisRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [access, setAccess] = useState<AnalysisAccess>(() => signedIn ? freeAnalysisAccess : guestAnalysisAccess);
  const [accessLoading, setAccessLoading] = useState(signedIn);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const requestCounterRef = useRef(0);

  useEffect(() => {
    let active = true;
    setAnalysisRequest(null);
    setLoadedGamePk(null);
    setAway(null);
    setHome(null);
    setLoading(false);
    setAccessLoading(signedIn);
    getAnalysisAccess(signedIn)
      .then((nextAccess) => { if (active) setAccess(nextAccess); })
      .catch(() => { if (active) setAccess(signedIn ? freeAnalysisAccess : guestAnalysisAccess); })
      .finally(() => { if (active) setAccessLoading(false); });
    return () => { active = false; };
  }, [signedIn]);

  useEffect(() => {
    setScheduleLoading(true);
    setError(null);
    fetchSchedule()
      .then((schedule) => {
        const next = selectedGame?.gamePk && !schedule.some((game) => game.gamePk === selectedGame.gamePk)
          ? [selectedGame, ...schedule]
          : schedule;
        setGames(next);
        setPk((current) => selectedGame?.gamePk ?? (current && next.some((game) => game.gamePk === current) ? current : next[0]?.gamePk ?? null));
      })
      .catch(() => setError('Unable to load games.'))
      .finally(() => setScheduleLoading(false));
  }, [selectedGame?.gamePk]);

  const savedSelection = access.selections.team_analysis;

  useEffect(() => {
    if (!savedSelection || scheduleLoading) return;
    const savedGame = savedAnalysisGame(savedSelection);
    setGames((current) => current.some((item) => item.gamePk === savedSelection.gamePk)
      ? current
      : [savedGame, ...current]);
    if (!selectedGame?.gamePk) setPk(savedSelection.gamePk);
  }, [savedSelection?.gamePk, scheduleLoading, selectedGame?.gamePk]);

  const game = useMemo(() => games.find((item) => item.gamePk === pk), [games, pk]);

  const clearComparison = useCallback(() => {
    setAnalysisRequest(null);
    setAway(null);
    setHome(null);
    setLoadedGamePk(null);
    setUpdatedAt(null);
    setLoading(false);
    setError(null);
  }, []);

  const selectGamePk = useCallback((nextPk: number) => {
    if (nextPk === pk) return;
    clearComparison();
    setPk(nextPk);
  }, [clearComparison, pk]);

  const beginAnalysis = useCallback((targetGame: any) => {
    if (!targetGame?.gamePk || !targetGame.awayTeam || !targetGame.homeTeam) return;

    if (!signedIn || access.tier === 'guest') {
      setAccessMessage(null);
      setAccessDialogOpen(true);
      return;
    }

    const saved = access.selections.team_analysis;
    if (!access.unlimited && saved && saved.gamePk !== Number(targetGame.gamePk)) {
      setAccessMessage(`Today’s free Team Analysis is saved for ${matchupLabel(saved)}. You can reopen it anytime today.`);
      setAccessDialogOpen(true);
      return;
    }

    if (!targetGame.awayProbablePitcher?.id || !targetGame.homeProbablePitcher?.id) {
      setError('Probable starters are not available yet. Your daily analysis has not been used.');
      return;
    }

    setAway(null);
    setHome(null);
    setLoadedGamePk(null);
    setUpdatedAt(null);
    setActiveHitters('away');
    setError(null);
    setLoading(true);
    requestCounterRef.current += 1;
    setAnalysisRequest({ gamePk: Number(targetGame.gamePk), nonce: requestCounterRef.current });
  }, [access, signedIn]);

  useEffect(() => {
    if (accessLoading || !game || !signedIn || access.tier === 'guest') return;
    const isSavedGame = savedSelection?.gamePk === Number(game.gamePk);
    const shouldOpenAutomatically = access.unlimited || isSavedGame;
    if (!shouldOpenAutomatically || loadedGamePk === Number(game.gamePk) || analysisRequest?.gamePk === Number(game.gamePk)) return;
    beginAnalysis(game);
  }, [access.tier, access.unlimited, accessLoading, analysisRequest?.gamePk, beginAnalysis, game, loadedGamePk, savedSelection?.gamePk, signedIn]);

  useEffect(() => {
    if (!analysisRequest || accessLoading) return;
    const targetGame = games.find((item) => Number(item.gamePk) === analysisRequest.gamePk);
    if (!targetGame) {
      setLoading(false);
      setError('That matchup is no longer available.');
      return;
    }

    const awayPitcherId = targetGame.awayProbablePitcher?.id;
    const homePitcherId = targetGame.homeProbablePitcher?.id;
    if (!awayPitcherId || !homePitcherId) {
      setAway(null);
      setHome(null);
      setLoading(false);
      setError('Probable starters are not available yet. Your daily analysis has not been used.');
      return;
    }

    let cancelled = false;

    const loadComparison = async () => {
      if (!signedIn) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const [awayBatters, homeBatters, awayTeamStats, homeTeamStats, awayPitcherLogs, homePitcherLogs] = await Promise.all([
          buildPitcherVsTeam(homePitcherId, targetGame.awayTeam.id, targetGame.gamePk),
          buildPitcherVsTeam(awayPitcherId, targetGame.homeTeam.id, targetGame.gamePk),
          fetchTeamSeasonStats(targetGame.awayTeam.id),
          fetchTeamSeasonStats(targetGame.homeTeam.id),
          fetchPlayerRecentGameLogs(awayPitcherId, 'pitching', 3).catch(() => []),
          fetchPlayerRecentGameLogs(homePitcherId, 'pitching', 3).catch(() => []),
        ]);
        if (cancelled) return;

        const accessResult = await openTeamAnalysis(toSavedTeamAnalysis(targetGame));
        if (cancelled) return;
        if (!accessResult.error) setAccess((current) => applyTeamAnalysisResult(current, accessResult));
        if (!accessResult.allowed) {
          setAccessMessage(accessResult.error ?? (accessResult.savedSelection
            ? `Today’s free Team Analysis is saved for ${matchupLabel(accessResult.savedSelection)}. You can reopen it anytime today.`
            : null));
          setAccessDialogOpen(true);
          return;
        }

        setAway({
          team: targetGame.awayTeam,
          record: targetGame.awayRecord,
          pitcher: { ...homeBatters.pitcher, id: awayPitcherId, name: targetGame.awayProbablePitcher?.name },
          hitters: awayBatters.batters,
          teamStats: awayTeamStats,
          recentPitching: awayPitcherLogs,
        });
        setHome({
          team: targetGame.homeTeam,
          record: targetGame.homeRecord,
          pitcher: { ...awayBatters.pitcher, id: homePitcherId, name: targetGame.homeProbablePitcher?.name },
          hitters: homeBatters.batters,
          teamStats: homeTeamStats,
          recentPitching: homePitcherLogs,
        });
        setLoadedGamePk(Number(targetGame.gamePk));
        setUpdatedAt(Date.now());
        setError(null);
      } catch (reason: any) {
        if (!cancelled) setError(reason?.message ?? 'Unable to load comparison.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadComparison();

    return () => {
      cancelled = true;
    };
  }, [accessLoading, analysisRequest, games, signedIn]);

  const openSavedAnalysis = useCallback(() => {
    if (!savedSelection) return;
    const savedGame = games.find((item) => Number(item.gamePk) === savedSelection.gamePk)
      ?? savedAnalysisGame(savedSelection);
    setAccessDialogOpen(false);
    setAccessMessage(null);
    setGames((current) => current.some((item) => item.gamePk === savedSelection.gamePk)
      ? current
      : [savedGame, ...current]);
    if (pk !== savedSelection.gamePk) {
      clearComparison();
      setPk(savedSelection.gamePk);
    }
    beginAnalysis(savedGame);
  }, [beginAnalysis, clearComparison, games, pk, savedSelection]);

  const awayMetrics = useMemo(() => teamMetrics(away), [away]);
  const homeMetrics = useMemo(() => teamMetrics(home), [home]);
  const awayBreakdown = useMemo(() => breakdownScore(awayMetrics), [awayMetrics]);
  const homeBreakdown = useMemo(() => breakdownScore(homeMetrics), [homeMetrics]);
  const edge = useMemo(() => modelEdge(awayBreakdown, homeBreakdown), [awayBreakdown, homeBreakdown]);

  const winnerSide: Side | 'even' = edge.away === edge.home ? 'even' : edge.away > edge.home ? 'away' : 'home';
  const winner = winnerSide === 'away' ? away : winnerSide === 'home' ? home : null;
  const winnerIndex = winnerSide === 'away' ? edge.away : winnerSide === 'home' ? edge.home : 50;
  const edgeLabel = edgeLanguage(edge.away - edge.home);
  const gameIsLoaded = Boolean(game && loadedGamePk === Number(game.gamePk) && away && home);
  const showPreview = Boolean(game && !scheduleLoading && !loading && !gameIsLoaded);
  const currentIsSaved = Boolean(game && savedSelection?.gamePk === Number(game.gamePk));
  const currentIsLocked = Boolean(game && !access.unlimited && savedSelection && !currentIsSaved);
  const startersAvailable = Boolean(game?.awayProbablePitcher?.id && game?.homeProbablePitcher?.id);
  const previewButtonLabel = !signedIn || access.tier === 'guest'
    ? 'SIGN IN TO ANALYZE'
    : currentIsSaved
      ? 'OPEN SAVED ANALYSIS'
      : access.unlimited
        ? 'OPEN TEAM ANALYSIS'
        : currentIsLocked
          ? 'SEE TODAY’S AVAILABLE ANALYSIS'
          : 'USE TODAY’S TEAM ANALYSIS';
  const previewNote = currentIsSaved
    ? 'This is your saved analysis. You can reopen it anytime before the daily reset.'
    : currentIsLocked && savedSelection
      ? `Today’s free analysis is saved for ${matchupLabel(savedSelection)}. This selection remains a preview.`
      : access.unlimited
        ? 'Review the matchup, then open the full live comparison.'
        : 'Review this matchup first. Your daily use is saved only after the full data loads.';

  return (
    <div className="sc-team-comparison min-h-screen bg-[#081225] text-[#eef3ff]">
      <AnalysisAccessBanner access={access} loading={accessLoading} feature="team_analysis" onSignIn={onSignIn} onUpgrade={onUpgrade} />
      {!accessLoading && !access.unlimited && savedSelection && (
        <SavedAnalysisCard
          selection={savedSelection}
          active={loadedGamePk === savedSelection.gamePk}
          onOpen={openSavedAnalysis}
        />
      )}
      {!accessLoading && access.tier === 'guest' && (
        <section className="mx-auto my-4 w-[calc(100%-2rem)] max-w-3xl rounded-2xl border border-cyan-500/25 bg-[#0d1729] p-6 text-center">
          <span className="material-symbols-outlined text-4xl text-cyan-300">compare_arrows</span>
          <h2 className="mt-2 text-xl font-black">Team Analysis is included with a free account</h2>
          <p className="mt-2 text-sm text-slate-300">Sign in to run one complete team comparison each day.</p>
          <button type="button" onClick={onSignIn} className="mt-4 rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">SIGN IN OR JOIN</button>
        </section>
      )}
      <div className="sc-ta-mobile lg:hidden">
        <MobileToolbar games={games} pk={pk} setPk={selectGamePk} />
        {game && <MobileMatchup game={game} />}
        {error && <div className="sc-ta-error" role="alert">{error}</div>}
        {(scheduleLoading || loading) && <MobileLoading />}
        {showPreview && game && (
          <TeamAnalysisPreview
            game={game}
            buttonLabel={startersAvailable ? previewButtonLabel : 'STARTERS NOT AVAILABLE YET'}
            note={previewNote}
            disabled={!startersAvailable}
            onOpen={() => beginAnalysis(game)}
          />
        )}
        {!loading && gameIsLoaded && away && home && (
          <>
            <MobileModelEdge winner={winner} winnerSide={winnerSide} index={winnerIndex} edgeLabel={edgeLabel} />
            <MobileBreakdown
              away={away}
              home={home}
              awayScore={awayBreakdown}
              homeScore={homeBreakdown}
            />
            <MobileMetrics away={away} home={home} awayMetrics={awayMetrics} homeMetrics={homeMetrics} />
            <section className="sc-ta-starters">
              <StarterCard data={away} side="away" />
              <StarterCard data={home} side="home" />
            </section>
            <MobileHitters
              away={away}
              home={home}
              active={activeHitters}
              onChange={setActiveHitters}
            />
            <footer className="sc-ta-footer">
              <span>Model updated: {updatedAt ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(updatedAt) : '—'}</span>
              <span>Official MLB data</span>
            </footer>
          </>
        )}
      </div>

      <DesktopComparison
        games={games}
        pk={pk}
        setPk={selectGamePk}
        game={game}
        away={away}
        home={home}
        awayMetrics={awayMetrics}
        homeMetrics={homeMetrics}
        loading={scheduleLoading || loading}
        error={error}
        showPreview={showPreview}
        previewButtonLabel={startersAvailable ? previewButtonLabel : 'STARTERS NOT AVAILABLE YET'}
        previewNote={previewNote}
        previewDisabled={!startersAvailable}
        onOpen={() => game && beginAnalysis(game)}
      />
      <AnalysisLimitDialog
        open={accessDialogOpen}
        access={access}
        feature="team_analysis"
        message={accessMessage}
        savedTeamAnalysis={savedSelection}
        onOpenSavedAnalysis={savedSelection ? openSavedAnalysis : undefined}
        onClose={() => setAccessDialogOpen(false)}
        onSignIn={onSignIn}
        onUpgrade={onUpgrade}
      />
    </div>
  );
};

const SavedAnalysisCard = ({ selection, active, onOpen }: { selection: SavedTeamAnalysis; active: boolean; onOpen: () => void }) => (
  <section className="mx-auto my-3 flex w-[calc(100%-2rem)] max-w-[1220px] flex-col gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-400/[0.07] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300">
        <span className="material-symbols-outlined">bookmark_check</span>
      </span>
      <div className="min-w-0">
        <span className="text-[10px] font-black tracking-[.18em] text-emerald-300">TODAY’S SAVED TEAM ANALYSIS</span>
        <strong className="mt-0.5 block truncate text-base text-white">{matchupLabel(selection)}</strong>
        <small className="block text-slate-300">Reopen this matchup anytime today without using another daily access.</small>
      </div>
    </div>
    <button type="button" onClick={onOpen} disabled={active} className="shrink-0 rounded-xl border border-emerald-300/60 bg-emerald-300/10 px-4 py-2.5 text-xs font-black text-emerald-200 disabled:cursor-default disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-400">
      {active ? 'CURRENTLY VIEWING' : 'OPEN SAVED ANALYSIS'}
    </button>
  </section>
);

const TeamAnalysisPreview = ({ game, buttonLabel, note, disabled, onOpen }: { game: any; buttonLabel: string; note: string; disabled: boolean; onOpen: () => void }) => {
  const gameTime = game.gameDate
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(game.gameDate))
    : 'Time TBD';

  return (
    <section className="mx-3 my-3 overflow-hidden rounded-2xl border border-cyan-400/35 bg-[#0d192b] shadow-[0_14px_35px_rgba(0,0,0,.2)] lg:mx-0">
      <header className="flex items-center gap-3 border-b border-slate-700/70 px-4 py-3">
        <span className="grid size-9 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300"><span className="material-symbols-outlined text-xl">preview</span></span>
        <div>
          <span className="text-[10px] font-black tracking-[.18em] text-cyan-300">PREVIEW YOUR SELECTION</span>
          <h2 className="text-lg font-black text-white">Confirm this matchup</h2>
        </div>
      </header>
      <div className="grid grid-cols-[1fr_42px_1fr] items-start gap-2 px-3 py-5 sm:grid-cols-[1fr_70px_1fr] sm:px-6">
        <PreviewTeam team={game.awayTeam} pitcher={game.awayProbablePitcher} />
        <span className="mt-8 text-center text-xs font-black text-slate-500">VS</span>
        <PreviewTeam team={game.homeTeam} pitcher={game.homeProbablePitcher} />
      </div>
      <div className="border-t border-slate-700/70 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-200">{gameTime}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{note}</p>
        </div>
        <button type="button" onClick={onOpen} disabled={disabled} className="mt-3 w-full shrink-0 rounded-xl bg-cyan-400 px-4 py-3 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:mt-0 sm:w-auto">
          {buttonLabel}
        </button>
      </div>
    </section>
  );
};

const PreviewTeam = ({ team, pitcher }: { team: any; pitcher?: { id: number; name: string } | null }) => (
  <div className="min-w-0 text-center">
    <img src={mlbTeamLogoUrl(team.id)} alt="" className="mx-auto h-16 w-16 object-contain sm:h-20 sm:w-20" />
    <strong className="mt-2 block truncate text-sm text-white sm:text-base">{team.abbreviation ?? team.name}</strong>
    <span className="mt-1 block text-[10px] leading-4 text-slate-400 sm:text-xs">{pitcher?.name ?? 'Starter TBD'}</span>
  </div>
);

const MobileToolbar = ({ games, pk, setPk }: any) => (
  <header className="sc-ta-toolbar">
    <div>
      <span>LIVE TEAM INTELLIGENCE</span>
      <h1>Team Analysis</h1>
    </div>
    <label>
      <span className="material-symbols-outlined" aria-hidden="true">swap_horiz</span>
      <select aria-label="Select game" value={pk ?? ''} onChange={(event) => setPk(Number(event.target.value))}>
        {games.map((item: any) => <option key={item.gamePk} value={item.gamePk}>{item.awayTeam.abbreviation ?? item.awayTeam.name} vs {item.homeTeam.abbreviation ?? item.homeTeam.name}</option>)}
      </select>
      <span className="material-symbols-outlined" aria-hidden="true">expand_more</span>
    </label>
  </header>
);

const MobileMatchup = ({ game }: any) => (
  <section className="sc-ta-matchup" aria-label={`${game.awayTeam.name} versus ${game.homeTeam.name}`}>
    <MobileTeam team={game.awayTeam} record={game.awayRecord} side="away" />
    <div className="sc-ta-vs"><span>VS</span></div>
    <MobileTeam team={game.homeTeam} record={game.homeRecord} side="home" />
  </section>
);

const MobileTeam = ({ team, record, side }: any) => (
  <div className={`sc-ta-team is-${side}`}>
    <img src={mlbTeamLogoUrl(team.id)} alt="" aria-hidden="true" />
    <div>
      <span>{team.name}</span>
      <strong>{team.abbreviation ?? team.name}</strong>
      <small>{recordLabel(record)}</small>
    </div>
  </div>
);

const MobileModelEdge = ({ winner, winnerSide, index, edgeLabel }: { winner: SideData | null; winnerSide: Side | 'even'; index: number; edgeLabel: string }) => (
  <section className="sc-ta-model-edge">
    <div className="sc-ta-model-icon"><span className="material-symbols-outlined">leaderboard</span><b>MODEL EDGE</b></div>
    <div className="sc-ta-model-copy">
      <div>
        <strong className={`is-${winnerSide}`}>{winner ? `${winner.team.abbreviation ?? winner.team.name} ${edgeLabel}` : edgeLabel}</strong>
        <b>{index}/100</b>
      </div>
      <p>{edgeLabel === 'NEARLY EVEN' ? 'Very close matchup' : 'The current team and starter data create a measurable edge.'}</p>
      <small>Built from team SLG/OBP and probable-starter K/9, ERA, and WHIP. This is a comparison index, not a predicted score or win probability.</small>
    </div>
  </section>
);

const MobileBreakdown = ({ away, home, awayScore, homeScore }: { away: SideData; home: SideData; awayScore: BreakdownScore; homeScore: BreakdownScore }) => (
  <section className="sc-ta-breakdown">
    <header>
      <h2>MATCHUP BREAKDOWN</h2>
      <div><span className="is-away" />{away.team.abbreviation}<span className="is-home" />{home.team.abbreviation}</div>
    </header>
    <BreakdownRow icon="sports_baseball" label="Offense" detail="Team SLG + OBP" away={away} home={home} awayValue={awayScore.offense} homeValue={homeScore.offense} />
    <BreakdownRow icon="sports" label="Starting Pitching" detail="K/9 + ERA + WHIP" away={away} home={home} awayValue={awayScore.starter} homeValue={homeScore.starter} />
    <BreakdownRow icon="balance" label="Overall" detail="Offense + starter" away={away} home={home} awayValue={awayScore.overall} homeValue={homeScore.overall} />
  </section>
);

const BreakdownRow = ({ icon, label, detail, away, home, awayValue, homeValue }: any) => {
  const difference = awayValue - homeValue;
  const language = edgeLanguage(difference);
  const winner = difference === 0 ? null : difference > 0 ? away : home;
  return (
    <article className="sc-ta-breakdown-row">
      <span className="sc-ta-breakdown-icon material-symbols-outlined">{icon}</span>
      <div className="sc-ta-breakdown-main">
        <div className="sc-ta-breakdown-label"><div><strong>{label}</strong><small>{detail}</small></div><b><span>{awayValue}</span> vs <em>{homeValue}</em></b></div>
        <div className="sc-ta-dual-bar"><span><i style={{ width: `${awayValue}%` }} /></span><span><i style={{ width: `${homeValue}%` }} /></span></div>
        <small className="sc-ta-breakdown-note">{winner ? `${winner.team.abbreviation ?? winner.team.name} ${language.toLowerCase()}` : 'Nearly even'}</small>
      </div>
    </article>
  );
};

const MobileMetrics = ({ away, home, awayMetrics, homeMetrics }: { away: SideData; home: SideData; awayMetrics: TeamMetrics; homeMetrics: TeamMetrics }) => {
  const cards = [
    { label: 'HITTING POWER', stat: 'SLG', away: awayMetrics.slg, home: homeMetrics.slg, digits: 3, higher: true },
    { label: 'GETTING ON BASE', stat: 'OBP', away: awayMetrics.obp, home: homeMetrics.obp, digits: 3, higher: true },
    { label: 'STARTER STRIKEOUTS', stat: 'K/9', away: awayMetrics.starterK9, home: homeMetrics.starterK9, digits: 1, higher: true },
    { label: 'RUN PREVENTION', stat: 'TEAM ERA', away: awayMetrics.teamEra, home: homeMetrics.teamEra, digits: 2, higher: false },
    { label: 'BASERUNNERS ALLOWED', stat: 'TEAM WHIP', away: awayMetrics.teamWhip, home: homeMetrics.teamWhip, digits: 2, higher: false },
    { label: 'HOME RUNS', stat: `${currentSeason} HR`, away: awayMetrics.homeRuns, home: homeMetrics.homeRuns, digits: 0, higher: true },
  ];
  return <section className="sc-ta-metric-grid">{cards.map((card) => <PairedMetric key={card.label} {...card} awayTeam={away.team} homeTeam={home.team} />)}</section>;
};

const PairedMetric = ({ label, stat, away, home, digits, higher, awayTeam, homeTeam }: any) => {
  const awayNumber = numeric(away);
  const homeNumber = numeric(home);
  const awayBetter = awayNumber != null && homeNumber != null && (higher ? awayNumber > homeNumber : awayNumber < homeNumber);
  const homeBetter = awayNumber != null && homeNumber != null && (higher ? homeNumber > awayNumber : homeNumber < awayNumber);
  const total = Math.abs(awayNumber ?? 0) + Math.abs(homeNumber ?? 0) || 1;
  const awayWidth = clamp((Math.abs(awayNumber ?? 0) / total) * 100, 12, 88);
  return (
    <article className="sc-ta-metric">
      <header><strong>{label}</strong><span>{stat}</span></header>
      <div className="sc-ta-metric-values">
        <div className={awayBetter ? 'is-better' : ''}><small>{awayTeam.abbreviation}</small><b>{fmt(away, digits)}</b></div>
        <span>VS</span>
        <div className={homeBetter ? 'is-better' : ''}><small>{homeTeam.abbreviation}</small><b>{fmt(home, digits)}</b></div>
      </div>
      <div className="sc-ta-metric-bar"><i style={{ width: `${awayWidth}%` }} /><em /></div>
    </article>
  );
};

const StarterCard = ({ data, side }: { data: SideData; side: Side }) => {
  const pitcher = data.pitcher;
  const stats = pitcher?.stats ?? {};
  return (
    <article className={`sc-ta-starter is-${side}`}>
      <header><img src={mlbTeamLogoUrl(data.team.id)} alt="" /><span>STARTING PITCHER ({data.team.abbreviation})</span></header>
      <div className="sc-ta-starter-body">
        <PlayerImage id={pitcher?.id} name={pitcher?.name ?? 'Starter'} />
        <div><strong>{pitcher?.name ?? 'Starter TBD'}</strong><span>{pitcher?.pitchHand ? `${pitcher.pitchHand}HP` : '—'}</span><p>{stats.era ?? '—'} ERA <i /> {stats.strikeOuts ?? '—'} K</p></div>
      </div>
      <small>{recentPitcherSummary(data.recentPitching)}</small>
    </article>
  );
};

const PlayerImage = ({ id, name, compact = false }: { id?: number | null; name: string; compact?: boolean }) => {
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFallback(false); setFailed(false); }, [id]);
  return (
    <div className={compact ? 'sc-ta-player-photo is-compact' : 'sc-ta-player-photo'}>
      {id && !failed ? <img src={fallback ? mlbPlayerHeadshotUrl(id, compact ? 90 : 180) : mlbPlayerCutoutUrl(id, compact ? 90 : 180)} alt={name} onError={() => fallback ? setFailed(true) : setFallback(true)} /> : <span>{playerInitials(name)}</span>}
    </div>
  );
};

const MobileHitters = ({ away, home, active, onChange }: { away: SideData; home: SideData; active: Side; onChange: (side: Side) => void }) => {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [active, away.team.id, home.team.id]);
  const data = active === 'away' ? away : home;
  const hitters = [...(data.hitters ?? [])]
    .sort((left, right) => (Number(right.stats?.ops) || 0) - (Number(left.stats?.ops) || 0));
  const visible = hitters.slice(0, expanded ? hitters.length : 3);
  return (
    <section className={`sc-ta-hitters is-${active}`}>
      <header>
        <button type="button" className={active === 'away' ? 'is-active' : ''} onClick={() => onChange('away')}><img src={mlbTeamLogoUrl(away.team.id)} alt="" />{away.team.abbreviation} KEY HITTERS</button>
        <button type="button" className={active === 'home' ? 'is-active' : ''} onClick={() => onChange('home')}><img src={mlbTeamLogoUrl(home.team.id)} alt="" />{home.team.abbreviation} KEY HITTERS</button>
      </header>
      <div className="sc-ta-hitter-heading"><span>PLAYER</span><span>AVG</span><span>HR</span><span>RBI</span></div>
      <div className="sc-ta-hitter-list">
        {visible.map((player) => <div key={player.id} className="sc-ta-hitter-row"><span><PlayerImage id={player.id} name={player.name} compact /><b>{player.name}</b><small>{player.position ?? '—'}</small></span><strong>{fmt(player.stats?.avg)}</strong><strong>{fmtWhole(player.stats?.homeRuns)}</strong><strong>{fmtWhole(player.stats?.rbi)}</strong></div>)}
      </div>
      {hitters.length > 3 && <button type="button" className="sc-ta-view-hitters" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Show top 3 hitters' : `View all ${data.team.abbreviation} hitters`}</button>}
    </section>
  );
};

const MobileLoading = () => (
  <div className="sc-ta-loading" aria-live="polite"><span className="material-symbols-outlined">analytics</span><strong>Building team intelligence…</strong><small>Loading current MLB team stats, starters, and active hitters.</small></div>
);

const DesktopComparison = ({ games, pk, setPk, game, away, home, awayMetrics, homeMetrics, loading, error, showPreview, previewButtonLabel, previewNote, previewDisabled, onOpen }: any) => (
  <div className="mx-auto hidden max-w-[1220px] px-8 py-3 lg:block">
    <div className="mb-3 flex justify-between gap-2">
      <div><span className="text-[10px] tracking-[.18em] text-[#43f1dc]">TODAY’S TEAM ANALYSIS</span><h1 className="text-[42px] font-bold">Team Comparison</h1></div>
      <select value={pk ?? ''} onChange={(event) => setPk(Number(event.target.value))} className="rounded-lg border border-[#59647a] bg-[#111a2d] px-3 py-2 text-sm">{games.map((item: any) => <option key={item.gamePk} value={item.gamePk}>{item.awayTeam.name} vs {item.homeTeam.name}</option>)}</select>
    </div>
    {error && <div className="p-2 text-red-200">{error}</div>}
    {game && <>
      {(!showPreview || loading) && <section className="mb-2 grid grid-cols-[1fr_56px_1fr] items-center rounded-xl border border-[#2b3a52] bg-[#0d1729] p-2.5"><DesktopTeam team={game.awayTeam} cyan /><DesktopVs /><DesktopTeam team={game.homeTeam} /></section>}
      {loading ? <div className="p-8 text-center">Building live comparison…</div> : showPreview ? (
        <TeamAnalysisPreview game={game} buttonLabel={previewButtonLabel} note={previewNote} disabled={previewDisabled} onOpen={onOpen} />
      ) : away && home ? <>
        <section className="mb-2 grid grid-cols-3 gap-1.5"><DesktopMetric label="HITTING POWER" av={awayMetrics.slg} hv={homeMetrics.slg} /><DesktopMetric label="GETTING ON BASE" av={awayMetrics.obp} hv={homeMetrics.obp} /><DesktopMetric label="STARTER STRIKEOUTS" av={awayMetrics.starterK9} hv={homeMetrics.starterK9} d={1} /></section>
        <section className="mb-2 grid grid-cols-2 gap-1.5"><DesktopStarter data={away} cyan /><DesktopStarter data={home} /></section>
        <section className="mb-2 grid grid-cols-2 gap-1.5"><DesktopHitters data={away} cyan /><DesktopHitters data={home} /></section>
        <section className="grid grid-cols-3 gap-1.5"><DesktopMetric label="RUN PREVENTION" av={awayMetrics.teamEra} hv={homeMetrics.teamEra} d={2} /><DesktopMetric label="BASERUNNERS ALLOWED" av={awayMetrics.teamWhip} hv={homeMetrics.teamWhip} d={2} /><DesktopMetric label="HOME RUNS" av={awayMetrics.homeRuns} hv={homeMetrics.homeRuns} d={0} /></section>
      </> : null}
    </>}
  </div>
);

const DesktopTeam = ({ team, cyan }: any) => <div className={`flex min-w-0 items-center gap-2 ${cyan ? '' : 'flex-row-reverse text-right'}`}><img src={mlbTeamLogoUrl(team.id)} alt="" className="h-20 w-20 object-contain" /><div className="min-w-0"><p className="truncate text-[8px]">{team.name}</p><h2 className={`truncate text-2xl font-bold ${cyan ? 'text-[#46e7f3]' : 'text-[#59f0a7]'}`}>{team.abbreviation}</h2></div></div>;
const DesktopVs = () => <div className="relative mx-auto flex h-12 w-12 items-center justify-center"><svg viewBox="0 0 100 100" className="absolute inset-0 animate-spin [animation-duration:3.2s]"><circle cx="50" cy="50" r="44" fill="none" stroke="#46e7f3" strokeWidth="4" strokeDasharray="80 200" /><circle cx="50" cy="50" r="38" fill="none" stroke="#59f0a7" strokeWidth="3" strokeDasharray="50 200" /></svg><b className="relative text-xs italic">VS</b></div>;
const DesktopMetric = ({ label, av, hv, d = 3 }: any) => <article className="min-w-0 rounded-xl border border-[#2b3a52] bg-[#111a2d] p-2"><h3 className="text-sm font-bold leading-tight">{label}</h3><div className="mt-2 grid grid-cols-[1fr_12px_1fr] items-end"><div className="text-2xl text-[#46e7f3]">{fmt(av, d)}</div><span className="text-center text-[7px]">vs</span><div className="text-right text-2xl text-[#59f0a7]">{fmt(hv, d)}</div></div><div className="mt-2 grid grid-cols-2 gap-3"><span className="h-1 rounded bg-[#46e7f3]" /><span className="h-1 rounded bg-[#59f0a7]" /></div></article>;
const DesktopStarter = ({ data, cyan }: any) => { const pitcher = data.pitcher; const stats = pitcher?.stats ?? {}; return <article className="min-w-0 rounded-xl border border-[#2b3a52] bg-[#111a2d] p-2"><p className={`text-[8px] ${cyan ? 'text-[#46e7f3]' : 'text-[#59f0a7]'}`}>{data.team.abbreviation} STARTER</p><div className="mt-1 flex items-center gap-2"><img src={mlbPlayerHeadshotUrl(pitcher.id)} alt="" className="h-20 w-20 rounded-lg bg-[#0b1a2c] object-cover" /><div className="min-w-0"><b className="block truncate text-lg">{pitcher.name}</b><p className="whitespace-nowrap text-xs">{stats.era ?? '—'} ERA | {stats.whip ?? '—'} WHIP</p></div></div></article>; };
const DesktopHitters = ({ data, cyan }: any) => { const top = [...(data.hitters ?? [])].sort((left, right) => (Number(right.stats?.ops) || 0) - (Number(left.stats?.ops) || 0)).slice(0, 3); return <article className="min-w-0 rounded-xl border border-[#2b3a52] bg-[#111a2d] p-2"><h3 className={`text-sm ${cyan ? 'text-[#46e7f3]' : 'text-[#59f0a7]'}`}>{data.team.abbreviation} KEY HITTERS</h3>{top.map((item: any, index: number) => <div key={item.id ?? index} className="grid grid-cols-[20px_1fr_auto] items-center gap-1 border-t border-[#26354a] py-1"><img src={mlbPlayerHeadshotUrl(item.id)} alt="" className="h-5 w-5 rounded-full bg-[#0b1a2c] object-cover" /><span className="truncate text-xs">{item.name}</span><span className="text-xs">{fmt(item.stats?.ops)}</span></div>)}</article>; };
