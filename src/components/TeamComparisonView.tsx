import React, { useEffect, useMemo, useState } from 'react';
import { buildPitcherVsTeam, fetchSchedule } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';
import type { SelectedGame } from './SelectedGameMatchupView';

const avg = (values: any[]) => {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
};

const fmt = (value: any, digits = 3) => Number.isFinite(Number(value))
  ? Number(value).toFixed(digits).replace(/^0/, '')
  : '—';

export const TeamComparisonView: React.FC<{ selectedGame?: SelectedGame | null }> = ({ selectedGame = null }) => {
  const [games, setGames] = useState<any[]>([]);
  const [pk, setPk] = useState<number | null>(null);
  const [away, setAway] = useState<any>(null);
  const [home, setHome] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchSchedule()
      .then((schedule) => {
        const next = selectedGame?.gamePk && !schedule.some(game => game.gamePk === selectedGame.gamePk)
          ? [selectedGame, ...schedule]
          : schedule;
        setGames(next);
        setPk(current => selectedGame?.gamePk ?? (current && next.some(game => game.gamePk === current) ? current : next[0]?.gamePk ?? null));
      })
      .catch(() => setError('Unable to load games.'))
      .finally(() => setLoading(false));
  }, [selectedGame?.gamePk]);

  const game = useMemo(() => games.find(item => item.gamePk === pk), [games, pk]);

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
    setAway(null);
    setHome(null);
    setLoading(true);
    Promise.all([
      buildPitcherVsTeam(homePitcherId, game.awayTeam.id),
      buildPitcherVsTeam(awayPitcherId, game.homeTeam.id),
    ]).then(([awayBatters, homeBatters]) => {
      setAway({ team: game.awayTeam, pitcher: { ...homeBatters.pitcher, id: awayPitcherId, name: game.awayProbablePitcher?.name }, hitters: awayBatters.batters });
      setHome({ team: game.homeTeam, pitcher: { ...awayBatters.pitcher, id: homePitcherId, name: game.homeProbablePitcher?.name }, hitters: homeBatters.batters });
      setError(null);
    }).catch(reason => setError(reason?.message ?? 'Unable to load comparison.'))
      .finally(() => setLoading(false));
  }, [game]);

  const metrics = (data: any) => ({
    ops: avg((data?.hitters ?? []).map((item: any) => item.stats?.ops)),
    obp: avg((data?.hitters ?? []).map((item: any) => item.stats?.obp)),
    era: Number(data?.pitcher?.stats?.era),
    whip: Number(data?.pitcher?.stats?.whip),
    k9: Number(data?.pitcher?.stats?.strikeoutsPer9Inn),
    hr: (data?.hitters ?? []).reduce((sum: number, item: any) => sum + (Number(item.stats?.homeRuns) || 0), 0),
  });
  const awayMetrics = metrics(away);
  const homeMetrics = metrics(home);

  return <div className="sc-team-comparison min-h-screen bg-[#081225] px-2.5 py-3 text-[#eef3ff] lg:px-8">
    <div className="mx-auto max-w-[1220px]">
      <div className="mb-3 flex flex-col justify-between gap-2 lg:flex-row">
        <div><span className="text-[10px] tracking-[.18em] text-[#43f1dc]">TODAY’S TEAM ANALYSIS</span><h1 className="text-[27px] font-bold lg:text-[42px]">Team Comparison</h1></div>
        <select value={pk ?? ''} onChange={event => setPk(Number(event.target.value))} className="rounded-lg border border-[#59647a] bg-[#111a2d] px-3 py-2 text-sm">{games.map(item => <option key={item.gamePk} value={item.gamePk}>{item.awayTeam.name} vs {item.homeTeam.name}</option>)}</select>
      </div>
      {error && <div className="p-2 text-red-200">{error}</div>}
      {game && <>
        <section className="mb-2 grid grid-cols-[1fr_56px_1fr] items-center rounded-xl border border-[#2b3a52] bg-[#0d1729] p-2.5"><Team team={game.awayTeam} cyan/><Vs/><Team team={game.homeTeam}/></section>
        {loading ? <div className="p-8 text-center">Building live comparison…</div> : away && home ? <>
          <section className="mb-2 grid grid-cols-3 gap-1.5"><Metric label="HITTING POWER" av={awayMetrics.ops} hv={homeMetrics.ops}/><Metric label="GETTING ON BASE" av={awayMetrics.obp} hv={homeMetrics.obp}/><Metric label="STARTER STRIKEOUTS" av={awayMetrics.k9} hv={homeMetrics.k9} d={1}/></section>
          <section className="mb-2 grid grid-cols-2 gap-1.5"><Starter data={away} cyan/><Starter data={home}/></section>
          <section className="mb-2 grid grid-cols-2 gap-1.5"><Hitters data={away} cyan/><Hitters data={home}/></section>
          <section className="grid grid-cols-3 gap-1.5"><Metric label="RUN PREVENTION" av={awayMetrics.era} hv={homeMetrics.era} d={2}/><Metric label="BASERUNNERS ALLOWED" av={awayMetrics.whip} hv={homeMetrics.whip} d={2}/><Metric label="HOME RUNS" av={awayMetrics.hr} hv={homeMetrics.hr} d={0}/></section>
        </> : null}
      </>}
    </div>
  </div>;
};

const Team = ({ team, cyan }: any) => <div className={`flex min-w-0 items-center gap-2 ${cyan ? '' : 'flex-row-reverse text-right'}`}><img src={mlbTeamLogoUrl(team.id)} alt="" className="h-12 w-12 object-contain lg:h-20 lg:w-20"/><div className="min-w-0"><p className="truncate text-[8px]">{team.name}</p><h2 className={`truncate text-[15px] font-bold lg:text-2xl ${cyan ? 'text-[#46e7f3]' : 'text-[#59f0a7]'}`}>{team.abbreviation}</h2></div></div>;
const Vs = () => <div className="relative mx-auto flex h-12 w-12 items-center justify-center"><svg viewBox="0 0 100 100" className="absolute inset-0 animate-spin [animation-duration:3.2s]"><circle cx="50" cy="50" r="44" fill="none" stroke="#46e7f3" strokeWidth="4" strokeDasharray="80 200"/><circle cx="50" cy="50" r="38" fill="none" stroke="#59f0a7" strokeWidth="3" strokeDasharray="50 200"/></svg><b className="relative text-xs italic">VS</b></div>;
const Metric = ({ label, av, hv, d = 3 }: any) => <article className="min-w-0 rounded-xl border border-[#2b3a52] bg-[#111a2d] p-2"><h3 className="text-[8px] font-bold leading-tight lg:text-sm">{label}</h3><div className="mt-2 grid grid-cols-[1fr_12px_1fr] items-end"><div className="text-[17px] text-[#46e7f3] lg:text-2xl">{fmt(av, d)}</div><span className="text-center text-[7px]">vs</span><div className="text-right text-[17px] text-[#59f0a7] lg:text-2xl">{fmt(hv, d)}</div></div><div className="mt-2 grid grid-cols-2 gap-3"><span className="h-1 rounded bg-[#46e7f3]"/><span className="h-1 rounded bg-[#59f0a7]"/></div></article>;
const Starter = ({ data, cyan }: any) => { const pitcher = data.pitcher; const stats = pitcher?.stats ?? {}; return <article className="min-w-0 rounded-xl border border-[#2b3a52] bg-[#111a2d] p-2"><p className={`text-[8px] ${cyan ? 'text-[#46e7f3]' : 'text-[#59f0a7]'}`}>{data.team.abbreviation} STARTER</p><div className="mt-1 flex items-center gap-2"><img src={mlbPlayerHeadshotUrl(pitcher.id)} alt="" className="h-12 w-11 rounded-lg bg-[#0b1a2c] object-cover lg:h-20 lg:w-20"/><div className="min-w-0"><b className="block truncate text-[10px] lg:text-lg">{pitcher.name}</b><p className="whitespace-nowrap text-[7px] lg:text-xs">{stats.era ?? '—'} ERA | {stats.whip ?? '—'} WHIP</p></div></div></article>; };
const Hitters = ({ data, cyan }: any) => { const top = [...(data.hitters ?? [])].sort((left, right) => (Number(right.stats?.ops) || 0) - (Number(left.stats?.ops) || 0)).slice(0, 3); return <article className="min-w-0 rounded-xl border border-[#2b3a52] bg-[#111a2d] p-2"><h3 className={`text-[8px] lg:text-sm ${cyan ? 'text-[#46e7f3]' : 'text-[#59f0a7]'}`}>{data.team.abbreviation} KEY HITTERS</h3>{top.map((item: any, index: number) => <div key={item.id ?? index} className="grid grid-cols-[20px_1fr_auto] items-center gap-1 border-t border-[#26354a] py-1"><img src={mlbPlayerHeadshotUrl(item.id)} alt="" className="h-5 w-5 rounded-full bg-[#0b1a2c] object-cover"/><span className="truncate text-[7px] lg:text-xs">{item.name}</span><span className="text-[7px] lg:text-xs">{fmt(item.stats?.ops)}</span></div>)}</article>; };
