import React, { useEffect, useMemo, useState } from 'react';
import { buildPitcherVsTeam } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl } from '../services/mlbMedia';

export type SelectedGame = {
  gamePk?: number;
  gameDate?: string;
  status?: string;
  detailedState?: string;
  awayScore?: number;
  homeScore?: number;
  awayTeam?: { id: number; name: string; abbreviation?: string };
  homeTeam?: { id: number; name: string; abbreviation?: string };
  awayProbablePitcher?: { id: number; name: string } | null;
  homeProbablePitcher?: { id: number; name: string } | null;
};

type Props = {
  game: SelectedGame;
  onBack?: () => void;
  onOpenPredictions?: (context: MatchupActionContext) => void;
  onOpenTeamAnalysis?: (context: MatchupActionContext) => void;
  onOpenChallenge?: (context: MatchupActionContext) => void;
};

type MatchupTeam = NonNullable<SelectedGame['awayTeam']>;

export type MatchupActionContext = {
  game: SelectedGame;
  selectedTeam: MatchupTeam;
  opponentTeam: MatchupTeam;
  opposingPitcher?: { id: number; name: string } | null;
  firstBatter?: {
    id: number;
    name: string;
    position?: string;
    group: 'hitting';
    currentTeam: MatchupTeam;
  } | null;
};

type Side = 'away' | 'home';

const MLB_API = 'https://statsapi.mlb.com/api/v1';

const fetchPitcherDetails = async (id: number) => {
  const season = new Date().getFullYear();
  const request = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('MLB player data is unavailable.');
    return response.json();
  };
  const [personData, statsData] = await Promise.all([
    request(`${MLB_API}/people/${id}`),
    request(`${MLB_API}/people/${id}/stats?stats=season&season=${season}&group=pitching`),
  ]);
  return {
    info: personData.people?.[0] ?? {},
    stats: statsData.stats?.[0]?.splits?.[0]?.stat ?? {},
  };
};

const nickname = (name = '', abbreviation = '') => {
  const words = name.trim().split(/\s+/);
  const lastTwo = words.slice(-2).join(' ');
  if (['Red Sox', 'White Sox', 'Blue Jays'].includes(lastTwo)) return lastTwo;
  return words.at(-1) || abbreviation || 'Team';
};

const gameTime = (value?: string) => {
  if (!value) return 'TIME TBD';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
};

const Pitcher = ({ pitcher, details, accent }: { pitcher?: { id: number; name: string } | null; details?: any; accent: string }) => {
  const info = details?.info ?? {};
  const stats = details?.stats ?? {};
  const hand = info.pitchHand?.code ? `${info.pitchHand.code}HP` : '—';
  const number = info.primaryNumber ? `#${info.primaryNumber}` : '';
  return <div className="min-w-0 text-center">
    <div className="mx-auto h-[76px] w-[76px] sm:h-[90px] sm:w-[90px] overflow-hidden rounded-full border bg-[radial-gradient(circle_at_50%_32%,#27455f_0%,#0a1728_72%)]" style={{ borderColor: accent }}>
      {pitcher?.id ? <img src={mlbPlayerHeadshotUrl(pitcher.id, 180)} alt={pitcher.name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-[#55647a]">TBD</div>}
    </div>
    <h3 className="mt-2 truncate text-[15px] font-bold text-white sm:text-lg">{pitcher?.name ?? 'Starter TBD'}</h3>
    <p className="text-xs text-[#aeb9cc]">{hand}{number ? `  ·  ${number}` : ''}</p>
    <div className="mx-auto mt-2 grid max-w-[170px] grid-cols-2 divide-x divide-[#30425c] border-t border-[#30425c] pt-2">
      <div><div className="text-[10px] text-[#8f9db2]">ERA</div><div className="font-mono text-base text-white">{stats.era ?? '—'}</div></div>
      <div><div className="text-[10px] text-[#8f9db2]">K</div><div className="font-mono text-base text-white">{stats.strikeOuts ?? '—'}</div></div>
    </div>
  </div>;
};

export const SelectedGameMatchupView: React.FC<Props> = ({ game, onBack, onOpenPredictions, onOpenTeamAnalysis, onOpenChallenge }) => {
  const [side, setSide] = useState<Side>('home');
  const [matchup, setMatchup] = useState<any | null>(null);
  const [pitcherDetails, setPitcherDetails] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const away = game.awayTeam;
  const home = game.homeTeam;
  const awayPitcher = game.awayProbablePitcher;
  const homePitcher = game.homeProbablePitcher;
  const hitterTeam = side === 'away' ? away : home;
  const opponentTeam = side === 'away' ? home : away;
  const opposingPitcher = side === 'away' ? homePitcher : awayPitcher;
  const opposingName = side === 'away' ? homePitcher?.name : awayPitcher?.name;

  useEffect(() => {
    const pitchers = [awayPitcher, homePitcher].filter((item): item is { id: number; name: string } => Boolean(item?.id));
    Promise.all(pitchers.map(async (pitcher) => {
      const details = await fetchPitcherDetails(pitcher.id).catch(() => ({ info: {}, stats: {} }));
      return [String(pitcher.id), details] as const;
    })).then((entries) => setPitcherDetails(Object.fromEntries(entries)));
  }, [awayPitcher?.id, homePitcher?.id]);

  useEffect(() => {
    if (!hitterTeam?.id || !opposingPitcher?.id) {
      setMatchup(null);
      setError('Probable starter information is not available for this side yet.');
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    buildPitcherVsTeam(opposingPitcher.id, hitterTeam.id)
      .then((data) => { if (active) setMatchup(data); })
      .catch(() => { if (active) setError('Unable to load this batter matchup right now.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [hitterTeam?.id, opposingPitcher?.id]);

  const status = useMemo(() => {
    const text = game.detailedState || game.status || 'Upcoming';
    return text.toUpperCase();
  }, [game.detailedState, game.status]);

  const actionContext = useMemo<MatchupActionContext | null>(() => {
    if (!hitterTeam || !opponentTeam) return null;
    const batter = matchup?.batters?.[0];
    return {
      game,
      selectedTeam: hitterTeam,
      opponentTeam,
      opposingPitcher,
      firstBatter: batter?.id ? {
        id: Number(batter.id),
        name: batter.name,
        position: batter.position,
        group: 'hitting',
        currentTeam: hitterTeam,
      } : null,
    };
  }, [game, hitterTeam, matchup?.batters, opponentTeam, opposingPitcher]);

  return <div className="min-h-screen bg-[#06111f] px-3 pb-24 pt-3 text-[#dce6fa] sm:px-5 sm:pt-5">
    <div className="mx-auto w-full max-w-[860px]">
      <header className="flex items-center gap-3 border-b border-[#243850] pb-3">
        {onBack && <button type="button" onClick={onBack} aria-label="Back" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#324760] bg-[#101d30] text-xl hover:border-[#00e7ef]">←</button>}
        <div className="min-w-0"><h1 className="text-xl font-bold text-white sm:text-2xl">Matchup</h1><p className="truncate text-xs text-[#00e7ef]">{status} <span className="text-[#6f8198]">•</span> {away?.abbreviation ?? away?.name} vs {home?.abbreviation ?? home?.name} <span className="text-[#6f8198]">•</span> {gameTime(game.gameDate)}</p></div>
      </header>

      <section className="mt-5">
        <h2 className="mb-3 text-base font-bold text-white sm:text-lg">PROBABLE PITCHERS</h2>
        <div className="grid grid-cols-[1fr_42px_1fr] items-center rounded-2xl border border-[#30445d] bg-[#0d1a2c] px-3 py-4 sm:px-8">
          <Pitcher pitcher={awayPitcher} details={awayPitcher?.id ? pitcherDetails[String(awayPitcher.id)] : null} accent="#f36a32" />
          <div className="text-center text-lg font-bold text-white">VS</div>
          <Pitcher pitcher={homePitcher} details={homePitcher?.id ? pitcherDetails[String(homePitcher.id)] : null} accent="#00e7ef" />
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-base font-bold text-white sm:text-lg">BATTER MATCHUPS</h2>
        <div className="grid h-11 grid-cols-2 overflow-hidden rounded-xl border border-[#00dce7] bg-[#081625]">
          <button type="button" onClick={() => setSide('home')} className={`text-sm font-bold transition-colors ${side === 'home' ? 'bg-[#00dce7] text-[#04131b]' : 'text-[#00dce7]'}`}>{nickname(home?.name, home?.abbreviation)}</button>
          <button type="button" onClick={() => setSide('away')} className={`text-sm font-bold transition-colors ${side === 'away' ? 'bg-[#00dce7] text-[#04131b]' : 'text-[#00dce7]'}`}>{nickname(away?.name, away?.abbreviation)}</button>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-[#30445d] bg-[#0d1a2c]">
          <div className="border-b border-[#30445d] px-4 py-3 text-xs font-bold text-[#00e7ef]">{hitterTeam?.abbreviation ?? hitterTeam?.name} BATTERS <span className="text-[#a9b4c7]">VS {opposingName?.toUpperCase() ?? 'STARTER TBD'}</span></div>
          {loading && <div className="flex h-[360px] items-center justify-center text-sm text-[#a9b4c7]">Loading verified MLB matchup data…</div>}
          {!loading && error && <div className="flex h-[220px] items-center justify-center px-6 text-center text-sm text-[#ffb3b7]">{error}</div>}
          {!loading && !error && <div className="max-h-[400px] overflow-y-auto overscroll-contain">
            <div className="sticky top-0 z-[1] grid grid-cols-[minmax(142px,2.2fr)_repeat(5,minmax(42px,.72fr))] border-b border-[#30445d] bg-[#0a1626] px-3 py-2 text-[10px] text-[#9daabd] sm:grid-cols-[minmax(220px,2.5fr)_repeat(5,1fr)] sm:text-xs">
              <span>PLAYER</span><span className="text-center">HR</span><span className="text-center">RBI</span><span className="text-center">AB</span><span className="text-center">AVG</span><span className="text-center">OPS</span>
            </div>
            {(matchup?.batters ?? []).map((batter: any) => <div key={batter.id} className="grid min-h-12 grid-cols-[minmax(142px,2.2fr)_repeat(5,minmax(42px,.72fr))] items-center border-b border-[#23364e] px-3 py-2 text-xs last:border-b-0 sm:grid-cols-[minmax(220px,2.5fr)_repeat(5,1fr)] sm:text-sm">
              <span className="min-w-0 truncate pr-2 font-semibold text-white">{batter.name} <small className="font-normal text-[#9daabd]">{batter.position}</small></span>
              <span className="text-center">{batter.stats?.homeRuns ?? '—'}</span><span className="text-center">{batter.stats?.rbi ?? '—'}</span><span className="text-center">{batter.stats?.atBats ?? '—'}</span><span className="text-center">{batter.stats?.avg ?? '—'}</span><span className="text-center">{batter.stats?.ops ?? '—'}</span>
            </div>)}
          </div>}
        </div>
      </section>
    </div>

    <nav aria-label="Matchup options" className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#243850] bg-[#06111f]/95 px-3 py-2 backdrop-blur lg:left-72">
      <div className="mx-auto grid max-w-[860px] grid-cols-3 gap-2">
        <button type="button" disabled={!actionContext?.firstBatter} onClick={() => actionContext && onOpenPredictions?.(actionContext)} className="h-11 rounded-xl border border-[#00dce7] bg-[#00dce7] px-1.5 text-[10px] font-bold leading-tight text-[#04131b] disabled:opacity-40 sm:text-sm">PREDICTION</button>
        <button type="button" disabled={!actionContext} onClick={() => actionContext && onOpenTeamAnalysis?.(actionContext)} className="h-11 rounded-xl border border-[#00dce7] px-1.5 text-[10px] font-bold leading-tight text-white disabled:opacity-40 sm:text-sm">TEAM ANALYSIS</button>
        <button type="button" disabled={!actionContext} onClick={() => actionContext && onOpenChallenge?.(actionContext)} className="h-11 rounded-xl border border-[#65f2b5] px-1.5 text-[10px] font-bold leading-tight text-[#65f2b5] disabled:opacity-40 sm:text-sm">CHALLENGE</button>
      </div>
    </nav>
  </div>;
};
