import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPitcherVsTeam,
  fetchBatterPitchTypeProfile,
  fetchPlayerHittingHandSplits,
  fetchPlayerRecentGameLogs,
  fetchRecentPitchProfile,
  fetchTeamPitchers,
  fetchTeams,
} from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl, playerInitials } from '../services/mlbMedia';
import type { SelectedGame } from './SelectedGameMatchupView';

type GameSelection = SelectedGame;

interface MatchupLabViewProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  signedIn: boolean;
}

const readStoredGame = (): GameSelection | null => {
  try {
    const raw = window.sessionStorage.getItem('scoutcore:selected-game');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const starterForTeam = (game: GameSelection | null, teamId: number | null) => {
  if (!game || !teamId) return null;
  if (game.awayTeam?.id === teamId) return game.awayProbablePitcher ?? null;
  if (game.homeTeam?.id === teamId) return game.homeProbablePitcher ?? null;
  return null;
};

export const MatchupLabView: React.FC<MatchupLabViewProps> = ({ onOpenMenu, onOpenProfile, signedIn }) => {
  const [teams, setTeams] = useState<any[]>([]);
  const [pitcherTeamId, setPitcherTeamId] = useState<number | null>(null);
  const [opponentTeamId, setOpponentTeamId] = useState<number | null>(null);
  const [teamPitchers, setTeamPitchers] = useState<any[]>([]);
  const [pitcher, setPitcher] = useState<any | null>(null);
  const [matchup, setMatchup] = useState<any | null>(null);
  const [batterId, setBatterId] = useState<number | null>(null);
  const [pitchProfile, setPitchProfile] = useState<any[]>([]);
  const [batterPitchProfile, setBatterPitchProfile] = useState<any[]>([]);
  const [splits, setSplits] = useState<any | null>(null);
  const [pitcherLogs, setPitcherLogs] = useState<any[]>([]);
  const [batterLogs, setBatterLogs] = useState<any[]>([]);
  const [recentHitters, setRecentHitters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysisRevision, setAnalysisRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dashboardGame, setDashboardGame] = useState<GameSelection | null>(null);
  const [preferredPitcherId, setPreferredPitcherId] = useState<number | null>(null);
  const analysisRequestRef = useRef(0);

  const resetAnalysis = () => {
    analysisRequestRef.current += 1;
    setMatchup(null);
    setBatterId(null);
    setPitchProfile([]);
    setBatterPitchProfile([]);
    setSplits(null);
    setPitcherLogs([]);
    setBatterLogs([]);
    setRecentHitters([]);
    setLoading(false);
    setError(null);
  };

  const clearGameContext = () => {
    setDashboardGame(null);
    setPreferredPitcherId(null);
    try {
      window.sessionStorage.removeItem('scoutcore:selected-game');
    } catch {
      // Session storage is optional.
    }
  };

  useEffect(() => {
    const game = readStoredGame();
    setDashboardGame(game);
    fetchTeams()
      .then((data) => {
        setTeams(data);
        if (game?.awayTeam?.id && game?.homeTeam?.id) {
          const useAway = Boolean(game.awayProbablePitcher?.id) || !game.homeProbablePitcher?.id;
          const team = useAway ? game.awayTeam : game.homeTeam;
          const opponent = useAway ? game.homeTeam : game.awayTeam;
          const starter = useAway ? game.awayProbablePitcher : game.homeProbablePitcher;
          setPitcherTeamId(team.id);
          setOpponentTeamId(opponent.id);
          setPreferredPitcherId(starter?.id ?? null);
          return;
        }
        setPitcherTeamId(data[0]?.id ?? null);
        setOpponentTeamId(data[1]?.id ?? data[0]?.id ?? null);
      })
      .catch(() => setError('Unable to load MLB teams.'));
  }, []);

  useEffect(() => {
    if (!pitcherTeamId) {
      setPitcher(null);
      setTeamPitchers([]);
      return;
    }

    let cancelled = false;
    setPitcher(null);
    setTeamPitchers([]);
    fetchTeamPitchers(pitcherTeamId)
      .then((players) => {
        if (cancelled) return;
        const gameStarter = starterForTeam(dashboardGame, pitcherTeamId);
        const list = [...players];
        if (gameStarter?.id && !list.some((item: any) => item.id === gameStarter.id)) list.unshift(gameStarter);
        setTeamPitchers(list);
        const desiredId = preferredPitcherId ?? gameStarter?.id ?? null;
        setPitcher((desiredId ? list.find((item: any) => item.id === desiredId) : null) ?? list[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setTeamPitchers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [pitcherTeamId, dashboardGame?.gamePk, preferredPitcherId]);

  const analyzeWith = async (targetPitcher: any, targetOpponentTeamId: number, preferredBatter: number | null = null) => {
    if (!targetPitcher || !targetOpponentTeamId) return false;
    const requestId = ++analysisRequestRef.current;
    setLoading(true);
    setError(null);
    setRecentHitters([]);

    try {
      const [nextMatchup, nextPitchProfile, nextPitcherLogs] = await Promise.all([
        buildPitcherVsTeam(targetPitcher.id, targetOpponentTeamId, dashboardGame?.gamePk),
        fetchRecentPitchProfile(targetPitcher.id, 3).catch(() => []),
        fetchPlayerRecentGameLogs(targetPitcher.id, 'pitching', 30).catch(() => []),
      ]);
      if (requestId !== analysisRequestRef.current) return false;

      const nextBatter = (nextMatchup?.batters ?? []).some((batter: any) => batter.id === preferredBatter)
        ? preferredBatter
        : nextMatchup?.batters?.[0]?.id ?? null;

      setMatchup(nextMatchup);
      setPitchProfile(nextPitchProfile);
      setPitcherLogs(nextPitcherLogs);
      setBatterId(nextBatter);
      setAnalysisRevision((value) => value + 1);

      const activeBatters = (nextMatchup?.batters ?? []).slice(0, 13);
      const withRecentForm = await Promise.all(
        activeBatters.map(async (batter: any) => {
          const logs = await fetchPlayerRecentGameLogs(batter.id, 'hitting', 12).catch(() => []);
          return { ...batter, weekStats: summarizeWeek(logs) };
        }),
      );
      if (requestId !== analysisRequestRef.current) return false;
      setRecentHitters(
        withRecentForm
          .filter((batter: any) => batter.weekStats?.games > 0)
          .sort((a: any, b: any) => b.weekStats.score - a.weekStats.score)
          .slice(0, 5),
      );
      return true;
    } catch (caught) {
      if (requestId === analysisRequestRef.current) {
        setError(caught instanceof Error ? caught.message : 'Unable to analyze matchup.');
      }
      return false;
    } finally {
      if (requestId === analysisRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!dashboardGame || !pitcher || !opponentTeamId) return;
    const expected = starterForTeam(dashboardGame, pitcherTeamId);
    if (expected?.id && pitcher.id === expected.id) void analyzeWith(pitcher, opponentTeamId);
  }, [dashboardGame?.gamePk, pitcher?.id, pitcherTeamId, opponentTeamId]);

  const selectedBatter = useMemo(
    () => matchup?.batters?.find((batter: any) => batter.id === batterId) ?? null,
    [matchup, batterId],
  );

  useEffect(() => {
    if (!batterId) {
      setSplits(null);
      setBatterPitchProfile([]);
      setBatterLogs([]);
      return;
    }

    let cancelled = false;
    Promise.all([
      fetchPlayerHittingHandSplits(batterId).catch(() => null),
      fetchBatterPitchTypeProfile(batterId, 8).catch(() => []),
      fetchPlayerRecentGameLogs(batterId, 'hitting', 30).catch(() => []),
    ]).then(([nextSplits, nextProfile, nextLogs]) => {
      if (cancelled) return;
      setSplits(nextSplits);
      setBatterPitchProfile(nextProfile);
      setBatterLogs(nextLogs);
    });

    return () => {
      cancelled = true;
    };
  }, [batterId, analysisRevision]);

  const advantage = selectedBatter ? calcAdvantage(matchup?.pitcher, selectedBatter, splits) : 50;
  const pitcherTeam = teams.find((team) => team.id === pitcherTeamId) ?? null;
  const opponentTeam = teams.find((team) => team.id === opponentTeamId) ?? matchup?.team ?? null;

  const topHitters = useMemo(() => {
    const selected = [...recentHitters];
    const used = new Set(selected.map((batter: any) => batter.id));
    const seasonFallback = [...(matchup?.batters ?? [])]
      .filter((batter: any) => !used.has(batter.id))
      .sort((a: any, b: any) => Number(b.stats?.avg ?? 0) - Number(a.stats?.avg ?? 0));
    return [...selected, ...seasonFallback].slice(0, 5);
  }, [recentHitters, matchup]);

  const handleAnalyze = () => {
    if (!pitcher || !opponentTeamId || loading) return;
    void analyzeWith(pitcher, opponentTeamId, batterId);
  };

  return (
    <div className="sc-matchup-lab">
      <header className="sc-ml-header">
        <button type="button" className="sc-ml-menu-button" onClick={onOpenMenu} aria-label="Open navigation">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <button type="button" className="sc-ml-brand" onClick={onOpenMenu} aria-label="Open ScoutCoreMLB navigation">
          <span>ScoutCore</span><strong>MLB</strong>
        </button>
        <button type="button" className="sc-ml-profile-button" onClick={onOpenProfile} aria-label={signedIn ? 'Open account' : 'Log in'}>
          <span className="material-symbols-outlined">person</span>
        </button>
      </header>

      <div className="sc-ml-canvas">
        <section className="sc-ml-controls" aria-label="Matchup controls">
          <SelectField label="PITCHER TEAM" logo={mlbTeamLogoUrl(pitcherTeamId)} mobileLogoOnly>
            <select
              aria-label="Pitcher team"
              value={pitcherTeamId ?? ''}
              onChange={(event) => {
                clearGameContext();
                resetAnalysis();
                const value = event.target.value ? Number(event.target.value) : null;
                setPitcherTeamId(value);
                if (value && opponentTeamId === value) setOpponentTeamId(null);
              }}
            >
              <option value="">Choose team</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </SelectField>

          <SelectField label="PITCHER">
            <select
              aria-label="Pitcher"
              value={pitcher?.id ?? ''}
              onChange={(event) => {
                clearGameContext();
                resetAnalysis();
                setPitcher(teamPitchers.find((item) => item.id === Number(event.target.value)) ?? null);
              }}
            >
              <option value="">Choose pitcher</option>
              {teamPitchers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </SelectField>

          <span className="sc-ml-vs">VS</span>

          <SelectField label="OPPONENT TEAM" logo={mlbTeamLogoUrl(opponentTeamId)} mobileValue={opponentTeam?.abbreviation ?? ''}>
            <select
              aria-label="Opponent team"
              value={opponentTeamId ?? ''}
              onChange={(event) => {
                clearGameContext();
                resetAnalysis();
                setOpponentTeamId(event.target.value ? Number(event.target.value) : null);
              }}
            >
              <option value="">Choose opponent</option>
              {teams.filter((team) => team.id !== pitcherTeamId).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </SelectField>

          <button
            type="button"
            className="sc-ml-analyze"
            onClick={handleAnalyze}
            disabled={!pitcher || !opponentTeamId || loading}
          >
            {loading ? 'ANALYZING…' : 'ANALYZE'}
          </button>
        </section>

        {error && <div className="sc-ml-error" role="alert">{error}</div>}

        {matchup && selectedBatter ? (
          <main className="sc-ml-dashboard">
            <section className="sc-ml-hero-grid">
              <PlayerCard type="pitcher" player={matchup.pitcher} profile={pitchProfile} teamId={pitcherTeam?.id} />
              <Advantage value={advantage} pitcher={matchup.pitcher} batter={selectedBatter} />
              <PlayerCard type="batter" player={selectedBatter} profile={batterPitchProfile} splits={splits} teamId={opponentTeam?.id} />
            </section>

            <section className="sc-ml-middle-grid">
              <BattersTable matchup={matchup} selected={batterId} onChoose={setBatterId} />
              <GameLogs
                pitcher={matchup.pitcher}
                batter={selectedBatter}
                pitcherLogs={pitcherLogs}
                batterLogs={batterLogs}
              />
            </section>

            <section className="sc-ml-bottom-grid">
              <TopMatchupHitters hitters={topHitters} pitcher={matchup.pitcher} onChoose={setBatterId} />
              <InjuredList matchup={matchup} />
            </section>
          </main>
        ) : (
          <section className={`sc-ml-empty ${loading ? 'is-loading' : ''}`} aria-live="polite">
            <span className={`material-symbols-outlined ${loading ? 'sc-ml-loading-ball' : ''}`}>sports_baseball</span>
            <strong>{loading ? 'Building matchup intelligence…' : 'Choose a pitcher and opponent'}</strong>
            <p>{loading ? 'Loading current MLB rosters, player form, and game logs.' : 'Then tap Analyze to open the full Matchup Lab.'}</p>
          </section>
        )}
      </div>
    </div>
  );
};

const SelectField = ({ label, logo, mobileValue, mobileLogoOnly = false, children }: { label: string; logo?: string; mobileValue?: string; mobileLogoOnly?: boolean; children: React.ReactNode }) => (
  <label className={`sc-ml-field ${logo ? 'has-logo' : ''} ${mobileValue ? 'has-mobile-value' : ''} ${mobileLogoOnly ? 'is-mobile-logo-only' : ''}`}>
    <span>{label}</span>
    <span className="sc-ml-select-shell">
      {logo && <img src={logo} alt="" aria-hidden="true" />}
      {children}
      {mobileValue && <b className="sc-ml-mobile-value" aria-hidden="true">{mobileValue}</b>}
      <span className="material-symbols-outlined" aria-hidden="true">expand_more</span>
    </span>
  </label>
);

const PlayerPhoto = ({ id, name }: { id?: number | null; name: string }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);

  return (
    <div className="sc-ml-photo" aria-label={name}>
      {!failed && id ? (
        <img src={mlbPlayerHeadshotUrl(id, 260)} alt={name} onError={() => setFailed(true)} />
      ) : (
        <span>{playerInitials(name)}</span>
      )}
    </div>
  );
};

const PlayerCard = ({ type, player, profile, splits, teamId }: any) => {
  const isPitcher = type === 'pitcher';
  const stats = player?.stats ?? {};
  const seasonYear = new Date().getFullYear();

  return (
    <article className={`sc-ml-player-card ${isPitcher ? 'is-pitcher' : 'is-batter'}`}>
      <div className="sc-ml-player-top">
        <PlayerPhoto id={player.id} name={player.name} />
        <div className="sc-ml-player-copy">
          <span className="sc-ml-player-role">{isPitcher ? 'STARTING PITCHER' : 'SELECTED BATTER'}</span>
          <h1>{player.name}</h1>
          <p>
            <strong>{isPitcher ? `${player.pitchHand ?? '?'}HP` : `${player.batSide ?? '?'}HB`}</strong>
            {!isPitcher && <span>{player.position ?? '—'}</span>}
          </p>
        </div>
        {teamId && <img className="sc-ml-card-team-logo" src={mlbTeamLogoUrl(teamId)} alt="" aria-hidden="true" />}
      </div>

      <p className="sc-ml-season-label">{seasonYear} REGULAR SEASON</p>
      {isPitcher ? (
        <div className="sc-ml-stat-grid is-pitcher-stats">
          <Stat label="G" value={stats.gamesPlayed ?? stats.gamesStarted ?? stats.games} />
          <Stat label="W-L" value={(stats.wins != null || stats.losses != null) ? `${stats.wins ?? 0}-${stats.losses ?? 0}` : '—'} />
          <Stat label="ERA" value={stats.era} />
          <Stat label="IP" value={stats.inningsPitched} />
          <Stat label="SO" value={stats.strikeOuts} />
          <Stat label="WHIP" value={stats.whip} />
        </div>
      ) : (
        <div className="sc-ml-stat-grid is-batter-stats">
          <Stat label="AVG" value={stats.avg} />
          <Stat label="HR" value={stats.homeRuns} />
          <Stat label="RBI" value={stats.rbi} />
          <Stat label="OPS" value={stats.ops} />
        </div>
      )}

      <div className="sc-ml-player-detail">
        {isPitcher ? <PitchArsenal profile={profile} /> : <BatterProfile profile={profile} />}
        <p>{isPitcher ? pitcherDescription(player, profile) : batterDescription(player, splits, profile)}</p>
      </div>
    </article>
  );
};

const Stat = ({ label, value }: any) => (
  <div className="sc-ml-stat">
    <span>{label}</span>
    <strong>{value ?? '—'}</strong>
  </div>
);

const Advantage = ({ value, pitcher, batter }: any) => (
  <article className="sc-ml-advantage">
    <span className="sc-ml-advantage-title">ADVANTAGE</span>
    <div className="sc-ml-ring" style={{ '--sc-ml-advantage': `${value * 3.6}deg` } as React.CSSProperties}>
      <div className="sc-ml-ring-center">
        <strong>{value}%</strong>
        <span>{value >= 50 ? 'PITCHER' : 'BATTER'}</span>
      </div>
    </div>
    <span className="sc-ml-swap" aria-hidden="true">⇄</span>
    <span className="sc-ml-key-title">KEY FACTOR</span>
    <p>{pitcher.pitchHand ?? '?'}HP vs {batter.batSide ?? '?'}HB advantage, pitch mix, and recent form shape the edge.</p>
  </article>
);

const BattersTable = ({ matchup, selected, onChoose }: any) => {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [matchup?.team?.id]);
  const batters = (matchup.batters ?? []).slice(0, expanded ? undefined : 9);
  const seasonYear = new Date().getFullYear();

  return (
    <article className={`sc-ml-panel sc-ml-batters ${expanded ? 'is-expanded' : ''}`}>
      <header className="sc-ml-panel-header">
        <h2>MATCHUP BATTERS — {matchup.team.name.toUpperCase()}</h2>
        <span>{seasonYear} REGULAR SEASON <b>›</b></span>
      </header>
      <div className="sc-ml-table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>PLAYER</th><th>BATS</th><th>POS</th><th>AVG</th><th>HR</th><th>RBI</th><th>SB</th><th>OPS</th></tr>
          </thead>
          <tbody>
            {batters.map((batter: any, index: number) => (
              <tr
                key={batter.id}
                className={selected === batter.id ? 'is-selected' : ''}
                onClick={() => onChoose(batter.id)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onChoose(batter.id);
                }}
              >
                <td>{index + 1}</td>
                <td>{batter.name}</td>
                <td>{batter.batSide ?? '—'}</td>
                <td>{batter.position ?? '—'}</td>
                <td>{batter.stats?.avg ?? '—'}</td>
                <td>{batter.stats?.homeRuns ?? '—'}</td>
                <td>{batter.stats?.rbi ?? '—'}</td>
                <td>{batter.stats?.stolenBases ?? '—'}</td>
                <td>{batter.stats?.ops ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(matchup.batters?.length ?? 0) > 5 && (
        <button type="button" className="sc-ml-table-link" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Show compact table' : 'View full table'}
        </button>
      )}
      <p className="sc-ml-table-legend">H = Hits · HR = Home Runs · RBI = Runs Batted In · SB = Stolen Bases · OPS = On-Base Plus Slugging</p>
    </article>
  );
};

const GameLogs = ({ pitcher, batter, pitcherLogs, batterLogs }: any) => {
  const [tab, setTab] = useState<'pitcher' | 'batter'>('batter');
  const [expanded, setExpanded] = useState(false);
  const logs = tab === 'pitcher' ? pitcherLogs : batterLogs;
  const visibleLogs = expanded ? logs : logs.slice(0, 10);

  useEffect(() => setExpanded(false), [tab, pitcher?.id, batter?.id]);

  return (
    <article className={`sc-ml-panel sc-ml-logs ${expanded ? 'is-expanded' : ''}`}>
      <header className="sc-ml-panel-header">
        <h2>GAME LOGS</h2>
        <div className="sc-ml-log-tabs">
          <button type="button" onClick={() => setTab('pitcher')} className={tab === 'pitcher' ? 'is-active' : ''}>{pitcher.name} (P)</button>
          <button type="button" onClick={() => setTab('batter')} className={tab === 'batter' ? 'is-active' : ''}>{batter.name} (B)</button>
        </div>
      </header>
      <div className="sc-ml-table-wrap">
        <table>
          <thead>
            <tr>
              <th>DATE</th><th>OPP</th>
              {tab === 'pitcher' ? <><th>IP</th><th>H</th><th>ER</th><th>BB</th><th>SO</th></> : <><th>AB</th><th>R</th><th>H</th><th>HR</th><th>RBI</th><th>BB</th><th>SO</th></>}
            </tr>
          </thead>
          <tbody>
            {visibleLogs.map((row: any, index: number) => (
              <tr key={`${row.gamePk ?? row.date}-${index}`}>
                <td>{shortDate(row.date)}</td>
                <td>{shortOpponent(row.opponent)}</td>
                {tab === 'pitcher' ? (
                  <><td>{row.stat?.inningsPitched ?? '—'}</td><td>{row.stat?.hits ?? '—'}</td><td>{row.stat?.earnedRuns ?? '—'}</td><td>{row.stat?.baseOnBalls ?? '—'}</td><td>{row.stat?.strikeOuts ?? '—'}</td></>
                ) : (
                  <><td>{row.stat?.atBats ?? '—'}</td><td>{row.stat?.runs ?? '—'}</td><td>{row.stat?.hits ?? '—'}</td><td>{row.stat?.homeRuns ?? '—'}</td><td>{row.stat?.rbi ?? '—'}</td><td>{row.stat?.baseOnBalls ?? '—'}</td><td>{row.stat?.strikeOuts ?? '—'}</td></>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="sc-ml-table-link" onClick={() => setExpanded((value) => !value)} disabled={logs.length <= 5}>
        {expanded ? 'Show compact logs' : `View full logs (last ${Math.min(30, logs.length || 30)} games)`}
      </button>
    </article>
  );
};

const TopMatchupHitters = ({ hitters, pitcher, onChoose }: any) => (
  <article className="sc-ml-panel sc-ml-top-hitters">
    <header className="sc-ml-panel-header">
      <h2>TOP MATCHUP HITTERS <small>vs {pitcher.name.toUpperCase()} (RECENT FORM)</small></h2>
      <span>View All ›</span>
    </header>
    <div className="sc-ml-hitter-grid">
      {hitters.map((batter: any) => {
        const recent = batter.weekStats;
        const average = recent?.games ? fmt3(recent.avg) : batter.stats?.avg ?? '—';
        const hits = recent?.games ? recent.hits : batter.stats?.hits ?? '—';
        const homeRuns = recent?.games ? recent.hr : batter.stats?.homeRuns ?? '—';
        const rbi = recent?.games ? recent.rbi : batter.stats?.rbi ?? '—';
        return (
          <button type="button" key={batter.id} onClick={() => onChoose(batter.id)}>
            <span className="sc-ml-hitter-name">{compactName(batter.name)}</span>
            <span className="sc-ml-hitter-position">{batter.position ?? '—'}</span>
            <PlayerPhoto id={batter.id} name={batter.name} />
            <strong>{average}</strong>
            <span className="sc-ml-avg-label">AVG</span>
            <span className="sc-ml-hitter-stats"><b>{hits}<small>H</small></b><b>{homeRuns}<small>HR</small></b><b>{rbi}<small>RBI</small></b></span>
          </button>
        );
      })}
    </div>
  </article>
);

const InjuredList = ({ matchup }: any) => {
  const [expanded, setExpanded] = useState(false);
  const players = expanded ? matchup.injuredList ?? [] : (matchup.injuredList ?? []).slice(0, 5);
  useEffect(() => setExpanded(false), [matchup?.team?.id]);

  return (
    <article className="sc-ml-panel sc-ml-injured">
      <header className="sc-ml-panel-header">
        <h2>INJURED LIST — {matchup.team.name.toUpperCase()}</h2>
        <button type="button" onClick={() => setExpanded((value) => !value)} disabled={(matchup.injuredList?.length ?? 0) <= 5}>
          {expanded ? 'Compact' : 'View Full'} ›
        </button>
      </header>
      <div className="sc-ml-table-wrap">
        <table>
          <thead><tr><th>PLAYER</th><th>POS</th><th>INJURY</th><th>IL STATUS</th><th>INJURED ON</th><th>EST. RETURN</th></tr></thead>
          <tbody>
            {players.length ? players.map((player: any) => (
              <tr key={player.id}>
                <td>{player.name}</td><td>{player.position ?? '—'}</td><td>{player.injury ?? player.description ?? '—'}</td><td>{player.status ?? '—'}</td><td>{player.injuredOn ?? '—'}</td><td>{player.estimatedReturn ?? '—'}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="sc-ml-no-data">No injured-list players returned for this team.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
};

const PitchArsenal = ({ profile }: any) => (
  <div className="sc-ml-profile-bars">
    <h3>PITCH ARSENAL</h3>
    {profile?.length ? profile.slice(0, 5).map((pitch: any) => (
      <div className="sc-ml-profile-row" key={pitch.code}>
        <span>{pitch.name}</span>
        <i><b style={{ width: `${Math.max(10, Math.min(100, pitch.usagePct ?? 10))}%` }} /></i>
        <em>{pitch.avgVelo?.toFixed?.(1) ?? '—'} mph</em>
      </div>
    )) : <p className="sc-ml-profile-empty">Recent pitch tracking will appear here.</p>}
  </div>
);

const BatterProfile = ({ profile }: any) => (
  <div className="sc-ml-profile-bars">
    <h3>PITCH-TYPE HITTING PROFILE</h3>
    {profile?.length ? profile.slice(0, 5).map((pitch: any) => (
      <div className="sc-ml-profile-row" key={pitch.code}>
        <span>{pitch.name}</span>
        <i><b style={{ width: `${Math.max(8, Math.min(100, (Number(pitch.avg) || 0.15) * 180))}%` }} /></i>
        <em>{fmt3(pitch.avg)}</em>
      </div>
    )) : <p className="sc-ml-profile-empty">Tracked pitch-type results will appear here.</p>}
  </div>
);

const pitcherDescription = (pitcher: any, profile: any[]) => {
  const top = profile?.[0];
  if (!top) return `${pitcher.name}'s current pitch profile will update as tracked pitches become available.`;
  return `${pitcher.name} attacks hitters with a ${top.name.toLowerCase()}-led mix, averaging ${top.avgVelo?.toFixed?.(1) ?? '—'} mph in recent tracked outings.`;
};

const batterDescription = (batter: any, splits: any, profile: any[]) => {
  const best = [...(profile ?? [])]
    .filter((pitch: any) => pitch.avg != null)
    .sort((a: any, b: any) => Number(b.avg) - Number(a.avg))[0];
  const handednessOps = batter.batSide === 'L' ? splits?.vsRight?.ops : splits?.vsLeft?.ops;
  if (best) return `${batter.name} has handled ${best.name.toLowerCase()} best in recent tracked results (${fmt3(best.avg)} AVG).`;
  if (handednessOps) return `${batter.name}'s current opposite-hand OPS is ${handednessOps}.`;
  return `${batter.name}'s pitch-type profile will update as tracked plate appearances become available.`;
};

const calcAdvantage = (pitcher: any, batter: any, splits: any) => {
  const era = Number(pitcher?.stats?.era || 4.2);
  const whip = Number(pitcher?.stats?.whip || 1.3);
  const ops = Number(batter?.stats?.ops || 0.7);
  const split = pitcher?.pitchHand === 'L' ? Number(splits?.vsLeft?.ops || ops) : Number(splits?.vsRight?.ops || ops);
  return Math.round(Math.max(28, Math.min(72, 50 + (4.2 - era) * 3 + (1.3 - whip) * 8 + (0.72 - split) * 25)));
};

const summarizeWeek = (logs: any[]) => {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 6);
  cutoff.setHours(0, 0, 0, 0);
  const week = (logs ?? []).filter((row: any) => {
    if (!row.date) return false;
    const date = new Date(`${row.date}T12:00:00`);
    return date >= cutoff && date <= now;
  });
  const totals = week.reduce((accumulator: any, row: any) => {
    const stat = row.stat ?? {};
    accumulator.ab += Number(stat.atBats) || 0;
    accumulator.hits += Number(stat.hits) || 0;
    accumulator.hr += Number(stat.homeRuns) || 0;
    accumulator.rbi += Number(stat.rbi) || 0;
    accumulator.bb += Number(stat.baseOnBalls) || 0;
    return accumulator;
  }, { ab: 0, hits: 0, hr: 0, rbi: 0, bb: 0 });
  const avg = totals.ab ? totals.hits / totals.ab : 0;
  const score = totals.hits * 2 + totals.hr * 5 + totals.rbi * 2 + totals.bb + avg * 10;
  return { ...totals, avg, games: week.length, score };
};

const shortDate = (date?: string) => date
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`))
  : '—';

const shortOpponent = (opponent?: string) => String(opponent ?? '—')
  .replace('Los Angeles Dodgers', 'LA Dodgers')
  .replace('Los Angeles Angels', 'LA Angels');

const compactName = (name?: string) => {
  const parts = String(name ?? 'Player').trim().split(/\s+/);
  if (parts.length < 2) return parts[0];
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
};

const fmt3 = (value: any) => Number.isFinite(Number(value)) ? Number(value).toFixed(3).replace(/^0/, '') : '—';
