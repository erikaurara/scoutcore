import React, { useEffect, useMemo, useState } from 'react';
import {
  buildPitcherVsTeam,
  fetchPlayerRecentGameLogs,
  fetchSchedule,
  fetchTeamSeasonStats,
} from '../services/mlbClient';
import { mlbPlayerCutoutUrl, mlbPlayerHeadshotUrl, mlbTeamLogoUrl, playerInitials } from '../services/mlbMedia';
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

export const TeamComparisonView: React.FC<{ selectedGame?: SelectedGame | null }> = ({ selectedGame = null }) => {
  const [games, setGames] = useState<any[]>([]);
  const [pk, setPk] = useState<number | null>(null);
  const [away, setAway] = useState<SideData | null>(null);
  const [home, setHome] = useState<SideData | null>(null);
  const [activeHitters, setActiveHitters] = useState<Side>('away');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchSchedule()
      .then((schedule) => {
        const next = selectedGame?.gamePk && !schedule.some((game) => game.gamePk === selectedGame.gamePk)
          ? [selectedGame, ...schedule]
          : schedule;
        setGames(next);
        setPk((current) => selectedGame?.gamePk ?? (current && next.some((game) => game.gamePk === current) ? current : next[0]?.gamePk ?? null));
      })
      .catch(() => setError('Unable to load games.'))
      .finally(() => setLoading(false));
  }, [selectedGame?.gamePk]);

  const game = useMemo(() => games.find((item) => item.gamePk === pk), [games, pk]);

  useEffect(() => {
    if (!game) return;
    const awayPitcherId = game.awayProbablePitcher?.id;
    const homePitcherId = game.homeProbablePitcher?.id;
    if (!awayPitcherId || !homePitcherId) {
      setAway(null);
      setHome(null);
      setLoading(false);
      setError('Probable starters are not available yet.');
      return;
    }

    let cancelled = false;
    setAway(null);
    setHome(null);
    setLoading(true);
    setError(null);
    setUpdatedAt(null);
    setActiveHitters('away');

    Promise.all([
      buildPitcherVsTeam(homePitcherId, game.awayTeam.id, game.gamePk),
      buildPitcherVsTeam(awayPitcherId, game.homeTeam.id, game.gamePk),
      fetchTeamSeasonStats(game.awayTeam.id),
      fetchTeamSeasonStats(game.homeTeam.id),
      fetchPlayerRecentGameLogs(awayPitcherId, 'pitching', 3).catch(() => []),
      fetchPlayerRecentGameLogs(homePitcherId, 'pitching', 3).catch(() => []),
    ]).then(([awayBatters, homeBatters, awayTeamStats, homeTeamStats, awayPitcherLogs, homePitcherLogs]) => {
      if (cancelled) return;
      setAway({
        team: game.awayTeam,
        record: game.awayRecord,
        pitcher: { ...homeBatters.pitcher, id: awayPitcherId, name: game.awayProbablePitcher?.name },
        hitters: awayBatters.batters,
        teamStats: awayTeamStats,
        recentPitching: awayPitcherLogs,
      });
      setHome({
        team: game.homeTeam,
        record: game.homeRecord,
        pitcher: { ...awayBatters.pitcher, id: homePitcherId, name: game.homeProbablePitcher?.name },
        hitters: homeBatters.batters,
        teamStats: homeTeamStats,
        recentPitching: homePitcherLogs,
      });
      setUpdatedAt(Date.now());
      setError(null);
    }).catch((reason) => {
      if (!cancelled) setError(reason?.message ?? 'Unable to load comparison.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [game]);

  const awayMetrics = useMemo(() => teamMetrics(away), [away]);
  const homeMetrics = useMemo(() => teamMetrics(home), [home]);
  const awayBreakdown = useMemo(() => breakdownScore(awayMetrics), [awayMetrics]);
  const homeBreakdown = useMemo(() => breakdownScore(homeMetrics), [homeMetrics]);
  const edge = useMemo(() => modelEdge(awayBreakdown, homeBreakdown), [awayBreakdown, homeBreakdown]);

  const winnerSide: Side | 'even' = edge.away === edge.home ? 'even' : edge.away > edge.home ? 'away' : 'home';
  const winner = winnerSide === 'away' ? away : winnerSide === 'home' ? home : null;
  const winnerIndex = winnerSide === 'away' ? edge.away : winnerSide === 'home' ? edge.home : 50;
  const edgeLabel = edgeLanguage(edge.away - edge.home);

  return (
    <div className="sc-team-comparison min-h-screen bg-[#081225] text-[#eef3ff]">
      <div className="sc-ta-mobile lg:hidden">
        <MobileToolbar games={games} pk={pk} setPk={setPk} />
        {game && <MobileMatchup game={game} />}
        {error && <div className="sc-ta-error" role="alert">{error}</div>}
        {loading && <MobileLoading />}
        {!loading && away && home && (
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
        setPk={setPk}
        game={game}
        away={away}
        home={home}
        awayMetrics={awayMetrics}
        homeMetrics={homeMetrics}
        loading={loading}
        error={error}
      />
    </div>
  );
};

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

const DesktopComparison = ({ games, pk, setPk, game, away, home, awayMetrics, homeMetrics, loading, error }: any) => (
  <div className="mx-auto hidden max-w-[1220px] px-8 py-3 lg:block">
    <div className="mb-3 flex justify-between gap-2">
      <div><span className="text-[10px] tracking-[.18em] text-[#43f1dc]">TODAY’S TEAM ANALYSIS</span><h1 className="text-[42px] font-bold">Team Comparison</h1></div>
      <select value={pk ?? ''} onChange={(event) => setPk(Number(event.target.value))} className="rounded-lg border border-[#59647a] bg-[#111a2d] px-3 py-2 text-sm">{games.map((item: any) => <option key={item.gamePk} value={item.gamePk}>{item.awayTeam.name} vs {item.homeTeam.name}</option>)}</select>
    </div>
    {error && <div className="p-2 text-red-200">{error}</div>}
    {game && <>
      <section className="mb-2 grid grid-cols-[1fr_56px_1fr] items-center rounded-xl border border-[#2b3a52] bg-[#0d1729] p-2.5"><DesktopTeam team={game.awayTeam} cyan /><DesktopVs /><DesktopTeam team={game.homeTeam} /></section>
      {loading ? <div className="p-8 text-center">Building live comparison…</div> : away && home ? <>
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
