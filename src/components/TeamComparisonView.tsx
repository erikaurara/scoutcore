import React, { useEffect, useMemo, useState } from 'react';
import { buildPitcherVsTeam, fetchSchedule } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

const avg = (values: any[]) => {
  const nums = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
};

const pct = (value: number | null, scale: number) => value == null ? 0 : Math.max(5, Math.min(100, (value / scale) * 100));

export const TeamComparisonView: React.FC = () => {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null);
  const [awayData, setAwayData] = useState<any>(null);
  const [homeData, setHomeData] = useState<any>(null);
  const [records, setRecords] = useState<Record<number, { wins: number; losses: number; divisionRank?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedule().then((data) => {
      setGames(data);
      setSelectedGamePk(data[0]?.gamePk ?? null);
    }).catch(() => setError('Unable to load today’s MLB games.')).finally(() => setLoading(false));

    fetch('https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const next: Record<number, { wins: number; losses: number; divisionRank?: string }> = {};
        for (const group of data?.records ?? []) {
          for (const row of group.teamRecords ?? []) next[row.team?.id] = { wins: row.wins ?? 0, losses: row.losses ?? 0, divisionRank: row.divisionRank };
        }
        setRecords(next);
      }).catch(() => {});
  }, []);

  const selected = useMemo(() => games.find((g) => g.gamePk === selectedGamePk) ?? null, [games, selectedGamePk]);

  useEffect(() => {
    if (!selected) return;
    const awayPitcherId = selected.awayProbablePitcher?.id;
    const homePitcherId = selected.homeProbablePitcher?.id;
    if (!awayPitcherId || !homePitcherId) {
      setAwayData(null); setHomeData(null); setError('Probable starters are not available yet for this game.');
      return;
    }
    setLoading(true); setError(null);
    Promise.all([
      buildPitcherVsTeam(homePitcherId, selected.awayTeam.id),
      buildPitcherVsTeam(awayPitcherId, selected.homeTeam.id),
    ]).then(([awayHitters, homeHitters]) => {
      setAwayData({ team: selected.awayTeam, pitcher: { ...homeHitters.pitcher, id: awayPitcherId, name: selected.awayProbablePitcher?.name ?? homeHitters.pitcher?.name }, hitters: awayHitters.batters });
      setHomeData({ team: selected.homeTeam, pitcher: { ...awayHitters.pitcher, id: homePitcherId, name: selected.homeProbablePitcher?.name ?? awayHitters.pitcher?.name }, hitters: homeHitters.batters });
    }).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load team comparison.')).finally(() => setLoading(false));
  }, [selected]);

  const metricPack = (data: any) => {
    const hitters = data?.hitters ?? [];
    return {
      ops: avg(hitters.map((h: any) => h.stats?.ops)),
      obp: avg(hitters.map((h: any) => h.stats?.obp)),
      avg: avg(hitters.map((h: any) => h.stats?.avg)),
      hr: hitters.reduce((sum: number, h: any) => sum + (Number(h.stats?.homeRuns) || 0), 0),
      era: Number(data?.pitcher?.stats?.era),
      whip: Number(data?.pitcher?.stats?.whip),
      k9: Number(data?.pitcher?.stats?.strikeoutsPer9Inn),
    };
  };

  const awayMetrics = metricPack(awayData);
  const homeMetrics = metricPack(homeData);
  const edge = (() => {
    const a = (awayMetrics.ops || 0) * 100 + (Number.isFinite(awayMetrics.k9) ? awayMetrics.k9 * 2 : 0) - (Number.isFinite(awayMetrics.era) ? awayMetrics.era * 3 : 0);
    const h = (homeMetrics.ops || 0) * 100 + (Number.isFinite(homeMetrics.k9) ? homeMetrics.k9 * 2 : 0) - (Number.isFinite(homeMetrics.era) ? homeMetrics.era * 3 : 0);
    if (!a && !h) return null;
    return a >= h ? { team: selected?.awayTeam, score: Math.min(99, 50 + Math.abs(a - h) / 4) } : { team: selected?.homeTeam, score: Math.min(99, 50 + Math.abs(a - h) / 4) };
  })();

  if (!selected && loading) return <div className="min-h-screen bg-[#0b1326] text-[#849495] p-8">Loading Team Analysis…</div>;

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-8">
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div><span className="font-label-caps text-[10px] text-[#65f2b5]">LIVE TEAM ANALYSIS</span><h1 className="font-display-lg text-4xl">Team Comparison</h1><p className="text-sm text-[#849495] mt-1">A ScoutCore version of your comparison concept, powered by current MLB data.</p></div>
      <select value={selectedGamePk ?? ''} onChange={(e) => setSelectedGamePk(Number(e.target.value))} className="bg-[#171f33] border border-[#3b494b]/40 rounded-lg px-4 py-3 text-sm text-[#00f0ff]">{games.map((game) => <option key={game.gamePk} value={game.gamePk}>{game.awayTeam.name} vs {game.homeTeam.name}</option>)}</select>
    </div>

    {error && <div className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}

    {selected && <>
      <section className="relative overflow-hidden rounded-2xl border border-[#3b494b]/20 bg-[#131b2e] px-6 py-10 lg:px-12">
        <div className="absolute inset-0 opacity-30 bg-gradient-to-r from-[#00f0ff]/10 via-transparent to-[#65f2b5]/10" />
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_220px_1fr] items-center gap-8">
          <TeamHero team={selected.awayTeam} record={records[selected.awayTeam.id]} side="away" />
          <div className="flex flex-col items-center gap-5"><div className="w-20 h-20 rounded-full border border-[#3b494b]/40 flex items-center justify-center shadow-xl"><span className="font-display-lg text-2xl italic">VS</span></div><div className="text-center"><p className="font-label-caps text-[10px] text-[#849495]">SCOUTCORE EDGE</p><div className="mt-2 px-5 py-3 rounded-full bg-[#2d3449] border border-[#3b494b]/20"><span className="font-headline-lg text-xl text-[#dbfcff]">{edge ? `${edge.team?.abbreviation ?? edge.team?.name} ${edge.score.toFixed(0)}` : '—'}</span><span className="text-xs text-[#849495] ml-2">matchup index</span></div></div></div>
          <TeamHero team={selected.homeTeam} record={records[selected.homeTeam.id]} side="home" />
        </div>
      </section>

      {loading ? <div className="p-8 text-center text-[#849495] bg-[#171f33] rounded-xl">Building live comparison…</div> : awayData && homeData && <>
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="space-y-3"><MetricBar label="Team OPS" value={fmt3(awayMetrics.ops)} width={pct(awayMetrics.ops, 1)} accent="cyan"/><MetricBar label="Team OBP" value={fmt3(awayMetrics.obp)} width={pct(awayMetrics.obp, .45)} accent="cyan"/><MetricBar label="Starter K/9" value={fmt1(awayMetrics.k9)} width={pct(Number.isFinite(awayMetrics.k9) ? awayMetrics.k9 : null, 12)} accent="cyan"/></div>
          <div className="bg-[#131b2e] rounded-xl border border-[#3b494b]/20 p-5"><div className="flex justify-between items-center"><span className="font-label-caps text-[10px] text-[#dae2fd]">COMPARISON PROFILE</span><span className="material-symbols-outlined text-[#849495]">analytics</span></div><div className="h-52 mt-6 flex items-end gap-2">{[awayMetrics.ops, awayMetrics.obp, awayMetrics.avg, homeMetrics.avg, homeMetrics.obp, homeMetrics.ops].map((v, i) => <div key={i} className={`flex-1 rounded-t-md ${i < 3 ? 'bg-[#00f0ff]/50' : 'bg-[#65f2b5]/40'}`} style={{height: `${Math.max(12, pct(v, 1))}%`}} />)}</div><div className="flex justify-between mt-3 text-[10px] text-[#849495]"><span>{selected.awayTeam.abbreviation ?? 'AWAY'}</span><span>LIVE SNAPSHOT</span><span>{selected.homeTeam.abbreviation ?? 'HOME'}</span></div></div>
          <div className="space-y-3"><MetricBar label="Starter ERA" value={fmt2(homeMetrics.era)} width={100 - pct(Number.isFinite(homeMetrics.era) ? homeMetrics.era : null, 7)} accent="green"/><MetricBar label="Starter WHIP" value={fmt2(homeMetrics.whip)} width={100 - pct(Number.isFinite(homeMetrics.whip) ? homeMetrics.whip : null, 2)} accent="green"/><MetricBar label="Team HR" value={String(homeMetrics.hr ?? '—')} width={pct(homeMetrics.hr, 250)} accent="green"/></div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6"><StarterCard data={awayData} accent="cyan" /><StarterCard data={homeData} accent="green" /></section>
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6"><TopHitters title={`${selected.awayTeam.name} top hitters`} hitters={awayData.hitters} /><TopHitters title={`${selected.homeTeam.name} top hitters`} hitters={homeData.hitters} /></section>
      </>}
    </>}
  </div>;
};

const TeamHero = ({ team, record, side }: any) => <div className={`flex flex-col ${side === 'away' ? 'lg:items-end lg:text-right' : 'lg:items-start lg:text-left'} items-center text-center`}><p className="font-label-caps text-[10px] uppercase tracking-[0.2em] text-[#849495]">{team.name}</p><h2 className="font-display-lg text-4xl lg:text-5xl mt-1">{team.abbreviation ?? team.name}</h2><div className="w-40 h-40 lg:w-48 lg:h-48 mt-5 rounded-full bg-[#222a3d] p-7 flex items-center justify-center shadow-xl"><img src={mlbTeamLogoUrl(team.id)} alt={`${team.name} logo`} className="max-w-full max-h-full object-contain" /></div><div className={`mt-5 font-data-numeric text-4xl ${side === 'away' ? 'text-[#00f0ff]' : 'text-[#65f2b5]'}`}>{record ? `${record.wins}-${record.losses}` : '—'}</div><p className="text-[10px] text-[#849495] mt-1">{record?.divisionRank ? `Division rank ${record.divisionRank}` : '2026 regular season'}</p></div>;

const MetricBar = ({ label, value, width, accent }: any) => <div className="bg-[#131b2e] border border-[#3b494b]/15 rounded-xl p-5"><div className="flex justify-between items-end"><span className="font-label-caps text-[10px] text-[#849495] uppercase">{label}</span><span className={`font-data-numeric text-2xl ${accent === 'cyan' ? 'text-[#00f0ff]' : 'text-[#65f2b5]'}`}>{value}</span></div><div className="w-full h-1.5 bg-[#2d3449] rounded-full overflow-hidden mt-4"><div className={`h-full ${accent === 'cyan' ? 'bg-[#00f0ff]' : 'bg-[#65f2b5]'}`} style={{width: `${Math.max(4, Math.min(100, width || 0))}%`}} /></div></div>;

const StarterCard = ({ data, accent }: any) => <div className="bg-[#171f33] border border-[#3b494b]/20 rounded-xl p-5"><p className={`font-label-caps text-[10px] ${accent === 'cyan' ? 'text-[#00f0ff]' : 'text-[#65f2b5]'}`}>STARTING PITCHER</p><div className="flex items-center gap-4 mt-4"><div className="w-20 h-20 rounded-xl bg-[#222a3d] overflow-hidden p-1"><img src={mlbPlayerHeadshotUrl(data.pitcher.id, 220)} alt={data.pitcher.name} className="w-full h-full object-contain" /></div><div><h3 className="font-headline-lg text-xl font-bold">{data.pitcher.name}</h3><p className="text-xs text-[#849495] mt-1">{data.pitcher.pitchHand ?? '?'}HP · ERA {data.pitcher.stats?.era ?? '—'} · WHIP {data.pitcher.stats?.whip ?? '—'} · K/9 {data.pitcher.stats?.strikeoutsPer9Inn ?? '—'}</p></div></div></div>;

const TopHitters = ({ title, hitters }: any) => { const rows = [...(hitters ?? [])].sort((a, b) => Number(b.stats?.ops || 0) - Number(a.stats?.ops || 0)).slice(0, 6); return <div className="bg-[#171f33] border border-[#3b494b]/20 rounded-xl overflow-hidden"><div className="p-4 border-b border-[#3b494b]/20"><p className="font-label-caps text-[10px] text-[#849495]">KEY HITTERS</p><h3 className="font-bold mt-1">{title}</h3></div><div>{rows.map((h: any) => <div key={h.id} className="flex items-center justify-between gap-4 p-3 border-t border-[#3b494b]/10 first:border-t-0"><div className="flex items-center gap-3 min-w-0"><div className="w-12 h-12 rounded-lg bg-[#222a3d] overflow-hidden p-1"><img src={mlbPlayerHeadshotUrl(h.id, 140)} alt={h.name} className="w-full h-full object-contain" /></div><div className="min-w-0"><p className="font-bold text-sm truncate">{h.name}</p><p className="text-[10px] text-[#849495]">{h.batSide ?? '?'}HB · {h.position || '—'}</p></div></div><div className="text-right"><p className="font-data-numeric text-[#dbfcff]">{h.stats?.ops ?? '—'}</p><p className="text-[9px] text-[#849495]">OPS</p></div></div>)}</div></div>; };

const fmt3 = (v: number | null) => v == null || !Number.isFinite(v) ? '—' : v.toFixed(3).replace(/^0/, '');
const fmt2 = (v: number | null) => v == null || !Number.isFinite(v) ? '—' : v.toFixed(2);
const fmt1 = (v: number | null) => v == null || !Number.isFinite(v) ? '—' : v.toFixed(1);
