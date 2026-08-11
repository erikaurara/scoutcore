import React, { useEffect, useMemo, useState } from 'react';
import { buildPitcherVsTeam, fetchSchedule } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

export const TeamComparisonView: React.FC = () => {
  const [games, setGames] = useState<any[]>([]);
  const [selectedPk, setSelectedPk] = useState<number | null>(null);
  const [awayView, setAwayView] = useState<any | null>(null);
  const [homeView, setHomeView] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedule().then((next) => {
      setGames(next);
      setSelectedPk(next[0]?.gamePk ?? null);
    }).catch(() => setError('Unable to load today’s MLB games.')).finally(() => setLoading(false));
  }, []);

  const selected = useMemo(() => games.find((g) => g.gamePk === selectedPk) ?? null, [games, selectedPk]);

  useEffect(() => {
    if (!selected) { setAwayView(null); setHomeView(null); return; }
    const awayOppPitcher = selected.homeProbablePitcher;
    const homeOppPitcher = selected.awayProbablePitcher;
    if (!awayOppPitcher?.id || !homeOppPitcher?.id) {
      setAwayView(null); setHomeView(null);
      setError('Probable starters are not available for both teams yet.');
      return;
    }
    setAnalysisLoading(true); setError(null);
    Promise.all([
      buildPitcherVsTeam(awayOppPitcher.id, selected.awayTeam.id),
      buildPitcherVsTeam(homeOppPitcher.id, selected.homeTeam.id),
    ]).then(([away, home]) => { setAwayView(away); setHomeView(home); })
      .catch(() => setError('Unable to build the live team analysis.'))
      .finally(() => setAnalysisLoading(false));
  }, [selectedPk]);

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#3b494b]/20 pb-6">
      <div><span className="font-label-caps text-xs text-[#65f2b5]">LIVE MLB TEAM VIEW</span><h1 className="font-display-lg text-4xl">Team Analysis</h1><p className="text-sm text-[#849495] mt-1">Compare today’s teams, probable starters and active hitters using browser-safe MLB data.</p></div>
      <select value={selectedPk ?? ''} onChange={(e) => setSelectedPk(Number(e.target.value))} className="bg-[#171f33] border border-[#3b494b]/40 text-sm text-[#00f0ff] rounded-lg px-4 py-3 min-w-[280px]">{games.map((game) => <option key={game.gamePk} value={game.gamePk}>{game.awayTeam.name} vs {game.homeTeam.name}</option>)}</select>
    </div>

    {error && <div className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}
    {loading && <div className="p-8 rounded-xl bg-[#171f33] text-[#849495]">Loading today’s games…</div>}
    {analysisLoading && <div className="p-8 rounded-xl bg-[#171f33] text-[#849495]">Building live team analysis…</div>}

    {selected && awayView && homeView && !analysisLoading && <>
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <TeamCard side="AWAY" team={selected.awayTeam} starter={selected.awayProbablePitcher} opponentStarter={selected.homeProbablePitcher} view={awayView} />
        <TeamCard side="HOME" team={selected.homeTeam} starter={selected.homeProbablePitcher} opponentStarter={selected.awayProbablePitcher} view={homeView} />
      </section>
      <section className="bg-[#131b2e] border border-[#3b494b]/20 rounded-xl p-5">
        <p className="text-[10px] text-[#849495] font-label-caps">SCOUTCORE COMPARISON</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <CompareMetric label="AWAY LINEUP AVG" value={lineupAverage(awayView.batters, 'avg')} />
          <CompareMetric label="HOME LINEUP AVG" value={lineupAverage(homeView.batters, 'avg')} />
          <CompareMetric label="AWAY LINEUP OPS" value={lineupAverage(awayView.batters, 'ops')} />
          <CompareMetric label="HOME LINEUP OPS" value={lineupAverage(homeView.batters, 'ops')} />
        </div>
        <p className="text-xs text-[#849495] mt-4">These are active-roster season snapshots, not guaranteed game outcomes. The hitter lists below are ordered by current OPS.</p>
      </section>
    </>}

    {!loading && !games.length && <div className="p-8 bg-[#171f33] rounded-xl text-center text-[#849495]">No MLB games are scheduled today.</div>}
  </div>;
};

const TeamCard = ({ side, team, starter, opponentStarter, view }: any) => {
  const hitters = [...(view?.batters ?? [])].sort((a, b) => Number(b.stats?.ops ?? 0) - Number(a.stats?.ops ?? 0));
  return <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 overflow-hidden">
    <div className="p-5 border-b border-[#3b494b]/20 flex items-center gap-4"><div className="w-16 h-16 rounded-xl bg-white/95 p-2"><img src={mlbTeamLogoUrl(team.id)} alt={`${team.name} logo`} className="w-full h-full object-contain" /></div><div><p className="text-[10px] text-[#849495] font-label-caps">{side}</p><h2 className="font-display-lg text-2xl">{team.name}</h2></div></div>
    <div className="p-5">
      <p className="text-[10px] text-[#849495] font-label-caps mb-2">PROBABLE STARTER</p>
      <div className="flex items-center gap-4 bg-[#131b2e] rounded-lg p-3"><PlayerSquare id={starter?.id} name={starter?.name ?? 'TBD'} size="lg"/><div><p className="font-bold">{starter?.name ?? 'TBD'}</p><p className="text-xs text-[#849495]">Opponent lineup faces {opponentStarter?.name ?? 'TBD'}.</p></div></div>
      <div className="grid grid-cols-3 gap-2 mt-4"><MiniMetric label="AVG" value={lineupAverage(hitters, 'avg')}/><MiniMetric label="OBP" value={lineupAverage(hitters, 'obp')}/><MiniMetric label="OPS" value={lineupAverage(hitters, 'ops')}/></div>
      <div className="mt-5"><p className="text-[10px] text-[#849495] font-label-caps mb-2">TOP ACTIVE HITTERS BY OPS</p><div className="space-y-2">{hitters.slice(0, 6).map((b: any) => <div key={b.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#131b2e]"><PlayerSquare id={b.id} name={b.name}/><div className="min-w-0 flex-1"><p className="font-bold text-xs truncate">{b.name}</p><p className="text-[10px] text-[#849495]">{b.batSide ?? '?'}HB · {b.position || '—'}</p></div><div className="text-right"><p className="font-data-numeric text-sm text-[#00f0ff]">{b.stats?.ops ?? '—'}</p><p className="text-[9px] text-[#849495]">OPS</p></div></div>)}</div></div>
    </div>
  </div>;
};

const PlayerSquare = ({ id, name, size = 'sm' }: { id?: number; name: string; size?: 'sm' | 'lg' }) => <div className={`${size === 'lg' ? 'w-16 h-16' : 'w-10 h-10'} rounded-lg overflow-hidden bg-[#222a3d] border border-[#3b494b]/25 shrink-0`}>{id ? <img src={mlbPlayerHeadshotUrl(id, size === 'lg' ? 160 : 96)} alt={name} className="w-full h-full object-cover" /> : null}</div>;
const MiniMetric = ({ label, value }: any) => <div className="bg-[#131b2e] rounded-lg p-3"><p className="text-[9px] text-[#849495]">{label}</p><p className="font-data-numeric text-lg mt-1">{value}</p></div>;
const CompareMetric = ({ label, value }: any) => <div className="bg-[#171f33] rounded-lg p-4"><p className="text-[9px] text-[#849495]">{label}</p><p className="font-data-numeric text-xl mt-1 text-[#dbfcff]">{value}</p></div>;
const lineupAverage = (batters: any[] = [], key: string) => {
  const values = batters.map((b) => Number(b.stats?.[key])).filter((v) => Number.isFinite(v) && v > 0);
  return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(3).replace(/^0/, '') : '—';
};
