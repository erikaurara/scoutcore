import React, { useEffect, useMemo, useState } from 'react';
import { buildPitcherVsTeam, fetchSchedule } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

const avg = (values: any[]) => {
  const nums = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
};
const pct = (value: number | null, scale: number) => value == null ? 0 : Math.max(5, Math.min(100, (value / scale) * 100));
const shortTeamName = (name = '') => {
  const known: Record<string, string> = {
    'Arizona Diamondbacks':'Diamondbacks','Athletics':'Athletics','Atlanta Braves':'Braves','Baltimore Orioles':'Orioles','Boston Red Sox':'Red Sox','Chicago Cubs':'Cubs','Chicago White Sox':'White Sox','Cincinnati Reds':'Reds','Cleveland Guardians':'Guardians','Colorado Rockies':'Rockies','Detroit Tigers':'Tigers','Houston Astros':'Astros','Kansas City Royals':'Royals','Los Angeles Angels':'Angels','Los Angeles Dodgers':'Dodgers','Miami Marlins':'Marlins','Milwaukee Brewers':'Brewers','Minnesota Twins':'Twins','New York Mets':'Mets','New York Yankees':'Yankees','Philadelphia Phillies':'Phillies','Pittsburgh Pirates':'Pirates','San Diego Padres':'Padres','San Francisco Giants':'Giants','Seattle Mariners':'Mariners','St. Louis Cardinals':'Cardinals','Tampa Bay Rays':'Rays','Texas Rangers':'Rangers','Toronto Blue Jays':'Blue Jays','Washington Nationals':'Nationals'
  };
  return known[name] ?? name;
};

const teamTileStyle = (teamId: number) => {
  const backgrounds: Record<number, string> = {
    108:'#f2f4f8', 109:'#efe7df', 110:'#f2f3f6', 111:'#2f1b18', 112:'#f2f3f6', 113:'#eef1f5', 114:'#f6ecec', 115:'#f5eded', 116:'#f1f3f6', 117:'#f3efe9',
    118:'#f2f4f8', 119:'#edeaf3', 120:'#f1f4f7', 121:'#f2f3f6', 133:'#f3e6b5', 134:'#f2f4f8', 135:'#eaf2f6', 136:'#f2f4f8', 137:'#f2f4f8', 138:'#f0ece6',
    139:'#f2f4f8', 140:'#f1f3f6', 141:'#f2f4f8', 142:'#f2f4f8', 143:'#f2f3f6', 144:'#f2f4f8', 145:'#f2f4f8', 146:'#f2f4f8', 147:'#f2f4f8', 158:'#f2f4f8'
  };
  return { background: backgrounds[teamId] ?? '#f2f4f8' };
};
const teamLogoScale = (teamId: number) => teamId === 146 ? 1.18 : teamId === 133 ? 1.08 : 1;

export const TeamComparisonView: React.FC = () => {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null);
  const [awayData, setAwayData] = useState<any>(null);
  const [homeData, setHomeData] = useState<any>(null);
  const [records, setRecords] = useState<Record<number, { wins: number; losses: number; divisionRank?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedule().then((data) => { setGames(data); setSelectedGamePk(data[0]?.gamePk ?? null); })
      .catch(() => setError('Unable to load today’s MLB games.')).finally(() => setLoading(false));
    fetch('https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team')
      .then((r) => r.ok ? r.json() : null).then((data) => {
        const next: Record<number, { wins: number; losses: number; divisionRank?: string }> = {};
        for (const group of data?.records ?? []) for (const row of group.teamRecords ?? []) next[row.team?.id] = { wins: row.wins ?? 0, losses: row.losses ?? 0, divisionRank: row.divisionRank };
        setRecords(next);
      }).catch(() => {});
  }, []);

  const selected = useMemo(() => games.find((g) => g.gamePk === selectedGamePk) ?? null, [games, selectedGamePk]);

  useEffect(() => {
    if (!selected) return;
    const awayPitcherId = selected.awayProbablePitcher?.id;
    const homePitcherId = selected.homeProbablePitcher?.id;
    if (!awayPitcherId || !homePitcherId) { setAwayData(null); setHomeData(null); setError('Probable starters are not available yet for this game.'); return; }
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
      ops: avg(hitters.map((h: any) => h.stats?.ops)), obp: avg(hitters.map((h: any) => h.stats?.obp)), avg: avg(hitters.map((h: any) => h.stats?.avg)),
      hr: hitters.reduce((sum: number, h: any) => sum + (Number(h.stats?.homeRuns) || 0), 0), era: Number(data?.pitcher?.stats?.era), whip: Number(data?.pitcher?.stats?.whip), k9: Number(data?.pitcher?.stats?.strikeoutsPer9Inn),
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

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-6 lg:p-8 space-y-7">
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"><div><span className="font-label-caps text-[10px] text-[#65f2b5]">TODAY’S TEAM ANALYSIS</span><h1 className="font-display-lg text-4xl">Team Comparison</h1></div><select value={selectedGamePk ?? ''} onChange={(e) => setSelectedGamePk(Number(e.target.value))} className="bg-[#171f33] border border-[#3b494b]/40 rounded-lg px-4 py-3 text-sm text-[#00f0ff]">{games.map((game) => <option key={game.gamePk} value={game.gamePk}>{shortTeamName(game.awayTeam.name)} vs {shortTeamName(game.homeTeam.name)}</option>)}</select></div>
    {error && <div className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}

    {selected && <>
      <section className="max-w-[980px] mx-auto pt-2">
        <div className="grid grid-cols-[1fr_110px_1fr] items-start gap-4 md:gap-10">
          <CompactTeamHero team={selected.awayTeam} record={records[selected.awayTeam.id]} accent="cyan" />
          <div className="flex flex-col items-center pt-12 md:pt-16">
            <div className="relative w-16 h-16 md:w-20 md:h-20 flex items-center justify-center">
              <div className="absolute inset-[4px] rounded-full border border-[#3b494b]/25" />
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full animate-spin [animation-duration:2.8s]" aria-hidden="true"><defs><linearGradient id="vsRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#00f0ff" /><stop offset="55%" stopColor="#b9c8de" /><stop offset="100%" stopColor="#65f2b5" /></linearGradient></defs><circle cx="50" cy="50" r="43" fill="none" stroke="url(#vsRing)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="46 24 8 16 28 148" /></svg>
              <svg viewBox="0 0 100 100" className="absolute inset-[7px] w-[calc(100%-14px)] h-[calc(100%-14px)] animate-spin [animation-duration:5.4s] [animation-direction:reverse] opacity-50" aria-hidden="true"><circle cx="50" cy="50" r="39" fill="none" stroke="#00f0ff" strokeWidth="1" strokeLinecap="round" strokeDasharray="18 52 5 170" /></svg>
              <span className="relative z-10 font-display-lg italic text-xl text-[#dae2fd] drop-shadow-[0_0_8px_rgba(0,240,255,.25)]">VS</span>
            </div>
            <div className="text-center mt-3"><p className="font-label-caps text-[8px] text-[#849495]">MODEL MATCHUP</p><div className="mt-1 px-3 py-2 rounded-md bg-[#171f33] border border-[#3b494b]/20"><span className="font-data-numeric text-[11px] text-[#dbfcff]">{edge ? `${edge.team?.abbreviation ?? edge.team?.name} ${edge.score.toFixed(0)}` : '—'}</span><span className="text-[8px] text-[#849495] ml-1">edge</span></div></div>
          </div>
          <CompactTeamHero team={selected.homeTeam} record={records[selected.homeTeam.id]} accent="green" />
        </div>
      </section>

      {loading ? <div className="p-8 text-center text-[#849495] bg-[#171f33] rounded-xl">Building live comparison…</div> : awayData && homeData && <>
        <section className="max-w-[1040px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.1fr_1fr] gap-4 items-stretch">
          <div className="space-y-3"><SmallMetric label="Team OPS" value={fmt3(awayMetrics.ops)} width={pct(awayMetrics.ops,1)} accent="cyan"/><SmallMetric label="Team OBP" value={fmt3(awayMetrics.obp)} width={pct(awayMetrics.obp,.45)} accent="cyan"/><SmallMetric label="Starter K/9" value={fmt1(awayMetrics.k9)} width={pct(Number.isFinite(awayMetrics.k9)?awayMetrics.k9:null,12)} accent="cyan"/></div>
          <div className="bg-[#131b2e] rounded-xl border border-[#3b494b]/15 p-4 flex flex-col"><div className="flex items-center justify-between"><span className="font-label-caps text-[9px] text-[#dae2fd]">MATCHUP PROFILE</span><span className="material-symbols-outlined text-[#849495] text-base">trending_up</span></div><div className="flex-1 min-h-[150px] flex items-end justify-between gap-1.5 px-2 pt-6">{[.28,.38,.52,.68,.78,.62,.86,.72,.55,.40,.31].map((h,i)=><div key={i} className={`w-full rounded-t-sm ${i<7?'bg-[#b9c8de]':'bg-[#65f2b5]/55'}`} style={{height:`${h*100}%`,opacity:.35+i*.045}} />)}</div><div className="flex justify-between mt-2 font-label-caps text-[8px] text-[#849495]"><span>START</span><span>CURRENT</span><span>OUTLOOK</span></div></div>
          <div className="space-y-3"><SmallMetric label="Starter ERA" value={fmt2(homeMetrics.era)} width={100-pct(Number.isFinite(homeMetrics.era)?homeMetrics.era:null,7)} accent="green"/><SmallMetric label="Starter WHIP" value={fmt2(homeMetrics.whip)} width={100-pct(Number.isFinite(homeMetrics.whip)?homeMetrics.whip:null,2)} accent="green"/><SmallMetric label="Team HR" value={String(homeMetrics.hr ?? '—')} width={pct(homeMetrics.hr,250)} accent="green"/></div>
        </section>
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6"><StarterCard data={awayData} accent="cyan" /><StarterCard data={homeData} accent="green" /></section>
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6"><TopHitters title={`${selected.awayTeam.name} top hitters`} hitters={awayData.hitters} /><TopHitters title={`${selected.homeTeam.name} top hitters`} hitters={homeData.hitters} /></section>
      </>}
    </>}
  </div>;
};

const CompactTeamHero = ({ team, record, accent }: any) => <div className="flex flex-col items-center text-center"><p className="font-label-caps text-[8px] uppercase tracking-[.22em] text-[#849495]">{team.name}</p><h2 className="font-display-lg text-2xl md:text-3xl mt-1">{team.abbreviation ?? team.name}</h2><div className="w-24 h-24 md:w-32 md:h-32 mt-4 rounded-md flex items-center justify-center p-4 shadow-lg border border-white/10" style={teamTileStyle(team.id)}><img src={mlbTeamLogoUrl(team.id)} alt={`${team.name} logo`} className="max-w-full max-h-full object-contain" style={{transform:`scale(${teamLogoScale(team.id)})`}} /></div><div className={`mt-4 font-data-numeric text-3xl md:text-4xl ${accent==='cyan'?'text-[#00f0ff]':'text-[#65f2b5]'}`}>{record?`${record.wins}-${record.losses}`:'—'}</div><p className="text-[8px] text-[#849495] mt-1">{record?.divisionRank?`Division rank ${record.divisionRank}`:'2026 regular season'}</p></div>;
const SmallMetric = ({ label, value, width, accent }: any) => <div className="bg-[#131b2e] border border-[#3b494b]/15 rounded-md p-3"><div className="flex justify-between items-end"><span className="font-label-caps text-[8px] text-[#849495] uppercase">{label}</span><span className="font-data-numeric text-base text-[#dae2fd]">{value}</span></div><div className="w-full h-1 bg-[#2d3449] rounded-full overflow-hidden mt-3"><div className={`h-full ${accent==='cyan'?'bg-[#00f0ff]':'bg-[#65f2b5]'}`} style={{width:`${Math.max(4,Math.min(100,width||0))}%`}} /></div></div>;
const StarterCard = ({ data, accent }: any) => <div className="bg-[#171f33] border border-[#3b494b]/20 rounded-xl p-5"><p className={`font-label-caps text-[10px] ${accent==='cyan'?'text-[#00f0ff]':'text-[#65f2b5]'}`}>STARTING PITCHER</p><div className="flex items-center gap-4 mt-4"><div className="w-20 h-20 rounded-xl bg-[#222a3d] overflow-hidden p-1"><img src={mlbPlayerHeadshotUrl(data.pitcher.id,220)} alt={data.pitcher.name} className="w-full h-full object-contain" /></div><div><h3 className="font-headline-lg text-xl font-bold">{data.pitcher.name}</h3><p className="text-xs text-[#849495] mt-1">{data.pitcher.pitchHand ?? '?'}HP · ERA {data.pitcher.stats?.era ?? '—'} · WHIP {data.pitcher.stats?.whip ?? '—'} · K/9 {data.pitcher.stats?.strikeoutsPer9Inn ?? '—'}</p></div></div></div>;
const TopHitters = ({ title, hitters }: any) => { const rows=[...(hitters??[])].sort((a,b)=>Number(b.stats?.ops||0)-Number(a.stats?.ops||0)).slice(0,6); return <div className="bg-[#171f33] border border-[#3b494b]/20 rounded-xl overflow-hidden"><div className="p-4 border-b border-[#3b494b]/20"><p className="font-label-caps text-[10px] text-[#849495]">KEY HITTERS</p><h3 className="font-bold mt-1">{title}</h3></div><div>{rows.map((h:any)=><div key={h.id} className="flex items-center justify-between gap-4 p-3 border-t border-[#3b494b]/10 first:border-t-0"><div className="flex items-center gap-3 min-w-0"><div className="w-12 h-12 rounded-lg bg-[#222a3d] overflow-hidden p-1"><img src={mlbPlayerHeadshotUrl(h.id,140)} alt={h.name} className="w-full h-full object-contain" /></div><div className="min-w-0"><p className="font-bold text-sm truncate">{h.name}</p><p className="text-[10px] text-[#849495]">{h.batSide ?? '?'}HB · {h.position || '—'}</p></div></div><div className="text-right"><p className="font-data-numeric text-[#dbfcff]">{h.stats?.ops ?? '—'}</p><p className="text-[9px] text-[#849495]">OPS</p></div></div>)}</div></div>; };
const fmt3=(v:number|null)=>v==null||!Number.isFinite(v)?'—':v.toFixed(3).replace(/^0/,'');
const fmt2=(v:number|null)=>v==null||!Number.isFinite(v)?'—':v.toFixed(2);
const fmt1=(v:number|null)=>v==null||!Number.isFinite(v)?'—':v.toFixed(1);
