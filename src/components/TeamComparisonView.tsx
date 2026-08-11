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
const teamLogoScale = (teamId: number) => teamId === 146 ? 1.42 : teamId === 133 ? 0.9 : 1;

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
      ops: avg(hitters.map((h: any) => h.stats?.ops)), obp: avg(hitters.map((h: any) => h.stats?.obp)),
      hr: hitters.reduce((sum: number, h: any) => sum + (Number(h.stats?.homeRuns) || 0), 0), era: Number(data?.pitcher?.stats?.era), whip: Number(data?.pitcher?.stats?.whip), k9: Number(data?.pitcher?.stats?.strikeoutsPer9Inn),
    };
  };
  const awayMetrics = metricPack(awayData);
  const homeMetrics = metricPack(homeData);
  const edge = (() => {
    const a = (awayMetrics.ops || 0) * 100 + (Number.isFinite(awayMetrics.k9) ? awayMetrics.k9 * 2 : 0) - (Number.isFinite(awayMetrics.era) ? awayMetrics.era * 3 : 0);
    const h = (homeMetrics.ops || 0) * 100 + (Number.isFinite(homeMetrics.k9) ? homeMetrics.k9 * 2 : 0) - (Number.isFinite(homeMetrics.era) ? homeMetrics.era * 3 : 0);
    if (!a && !h) return null;
    return a >= h ? { team: selected?.awayTeam, side: 'away', score: Math.min(99, 50 + Math.abs(a - h) / 4) } : { team: selected?.homeTeam, side: 'home', score: Math.min(99, 50 + Math.abs(a - h) / 4) };
  })();

  if (!selected && loading) return <div className="min-h-screen bg-[#081225] text-[#aeb8c7] p-8">Loading Team Analysis…</div>;

  return <div className="min-h-screen bg-[#081225] text-[#eef3ff] px-6 py-5 lg:px-9 lg:py-7">
    <div className="mx-auto max-w-[1220px]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-5">
        <div><span className="font-label-caps text-[12px] text-[#43f1dc]">TODAY’S TEAM ANALYSIS</span><h1 className="font-display-lg text-[42px] leading-none mt-1">Team Comparison</h1></div>
        <select value={selectedGamePk ?? ''} onChange={(e) => setSelectedGamePk(Number(e.target.value))} className="w-full lg:w-[310px] bg-[#111a2d] border border-[#59647a] rounded-lg px-4 py-3 text-base text-white outline-none">{games.map((game) => <option key={game.gamePk} value={game.gamePk}>{shortTeamName(game.awayTeam.name)} vs {shortTeamName(game.homeTeam.name)}</option>)}</select>
      </div>
      {error && <div className="mb-5 p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}

      {selected && <>
        <section className="grid grid-cols-[1fr_180px_1fr] items-start gap-8 mb-6">
          <TeamHero team={selected.awayTeam} record={records[selected.awayTeam.id]} accent="cyan" />
          <div className="flex flex-col items-center justify-center pt-16">
            <div className="relative w-[92px] h-[92px] flex items-center justify-center">
              <div className="absolute inset-1 rounded-full border border-[#24324b]" />
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full animate-spin [animation-duration:2.8s]" aria-hidden="true"><circle cx="50" cy="50" r="43" fill="none" stroke="#56f4e2" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="42 24 12 21 27 145" /></svg>
              <span className="relative z-10 font-display-lg italic text-2xl">VS</span>
            </div>
            <p className="font-label-caps text-[11px] text-[#b9c5d7] mt-4">MODEL MATCHUP</p>
            <div className="mt-2 px-5 py-3 rounded-lg bg-[#111a2d] border border-[#2f3c54]"><span className={`font-data-numeric text-lg ${edge?.side === 'home' ? 'text-[#59f0a7]' : 'text-[#46e7f3]'}`}>{edge ? `${edge.team?.abbreviation ?? edge.team?.name} ${edge.score.toFixed(0)}` : '—'}</span><span className="text-sm text-[#b5c0d0] ml-2">edge</span></div>
          </div>
          <TeamHero team={selected.homeTeam} record={records[selected.homeTeam.id]} accent="green" />
        </section>

        {loading ? <div className="p-8 text-center text-[#b8c2d0] bg-[#111a2d] rounded-xl">Building live comparison…</div> : awayData && homeData && <>
          <section className="grid grid-cols-1 lg:grid-cols-[1fr_1.08fr_1fr] gap-4 mb-5">
            <div className="space-y-3"><MetricCard label="TEAM OPS" value={fmt3(awayMetrics.ops)} width={pct(awayMetrics.ops,1)} accent="cyan"/><MetricCard label="TEAM OBP" value={fmt3(awayMetrics.obp)} width={pct(awayMetrics.obp,.45)} accent="cyan"/><MetricCard label="STARTER K/9" value={fmt1(awayMetrics.k9)} width={pct(Number.isFinite(awayMetrics.k9)?awayMetrics.k9:null,12)} accent="cyan"/></div>
            <ProfileCard />
            <div className="space-y-3"><MetricCard label="STARTER ERA" value={fmt2(homeMetrics.era)} width={100-pct(Number.isFinite(homeMetrics.era)?homeMetrics.era:null,7)} accent="green"/><MetricCard label="STARTER WHIP" value={fmt2(homeMetrics.whip)} width={100-pct(Number.isFinite(homeMetrics.whip)?homeMetrics.whip:null,2)} accent="green"/><MetricCard label="TEAM HR" value={String(homeMetrics.hr ?? '—')} width={pct(homeMetrics.hr,250)} accent="green"/></div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6"><StarterCard data={awayData} accent="cyan" record={records[selected.awayTeam.id]} /><StarterCard data={homeData} accent="green" record={records[selected.homeTeam.id]} /></section>
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-5"><TopHitters title={`${selected.awayTeam.name} top hitters`} hitters={awayData.hitters} /><TopHitters title={`${selected.homeTeam.name} top hitters`} hitters={homeData.hitters} /></section>
        </>}
      </>}
    </div>
  </div>;
};

const TeamHero = ({ team, record, accent }: any) => <div className="flex flex-col items-center text-center"><p className="font-label-caps text-[12px] tracking-[.12em] text-[#c2ccda]">{team.name}</p><h2 className="font-display-lg text-[42px] leading-none mt-2">{team.abbreviation ?? team.name}</h2><div className="w-[154px] h-[154px] mt-4 rounded-lg flex items-center justify-center p-5 shadow-[0_10px_25px_rgba(0,0,0,.18)] border border-[#d9dee8] bg-[#f2f4f8]"><img src={mlbTeamLogoUrl(team.id)} alt={`${team.name} logo`} className="max-w-full max-h-full object-contain" style={{transform:`scale(${teamLogoScale(team.id)})`}} /></div><div className={`mt-4 font-data-numeric text-[40px] leading-none ${accent==='cyan'?'text-[#46e7f3]':'text-[#59f0a7]'}`}>{record?`${record.wins}-${record.losses}`:'—'}</div><p className="text-[14px] text-[#b9c3d2] mt-2">{record?.divisionRank?`Division rank ${record.divisionRank}`:'2026 regular season'}</p></div>;

const MetricCard = ({ label, value, width, accent }: any) => <div className="bg-[#111a2d] border border-[#27344c] rounded-lg px-4 py-3"><div className="flex justify-between items-center"><span className="font-label-caps text-[12px] text-[#e0e6f0]">{label}</span><span className="font-data-numeric text-[22px] text-white">{value}</span></div><div className="w-full h-[4px] bg-[#344059] rounded-full overflow-hidden mt-3"><div className={`h-full ${accent==='cyan'?'bg-[#43e5f0]':'bg-[#59efaa]'}`} style={{width:`${Math.max(4,Math.min(100,width||0))}%`}} /></div></div>;

const ProfileCard = () => <div className="bg-[#111a2d] border border-[#27344c] rounded-lg p-4 flex flex-col min-h-[230px]"><div className="flex items-center justify-between"><span className="font-label-caps text-[13px] text-white">MATCHUP PROFILE</span><span className="material-symbols-outlined text-[#d5dbea] text-xl">trending_up</span></div><div className="flex-1 flex items-end justify-between gap-2 px-3 pt-6">{[.3,.42,.55,.72,.82,.68,.9,.74,.58,.44,.35].map((h,i)=><div key={i} className={`w-full rounded-t-[3px] ${i<7?'bg-[#aeb9cc]':'bg-[#58d6b0]'}`} style={{height:`${h*100}%`,opacity:i<7?.52+i*.055:.5+i*.035}} />)}</div><div className="flex justify-between mt-3 font-label-caps text-[10px] text-[#c4ccda]"><span>START</span><span>CURRENT</span><span>OUTLOOK</span></div></div>;

const StarterCard = ({ data, accent, record }: any) => <div className="bg-[#111a2d] border border-[#27344c] rounded-xl p-5"><p className={`font-label-caps text-[13px] ${accent==='cyan'?'text-[#46e7f3]':'text-[#59f0a7]'}`}>STARTING PITCHER</p><div className="flex items-center gap-5 mt-4"><div className="w-[110px] h-[110px] rounded-lg bg-[#f2f4f8] overflow-hidden p-1 shrink-0"><img src={mlbPlayerHeadshotUrl(data.pitcher.id,260)} alt={data.pitcher.name} className="w-full h-full object-contain" /></div><div><h3 className="font-headline-lg text-[28px] font-bold leading-tight">{data.pitcher.name}</h3><p className="text-[16px] text-[#d5dce8] mt-2">{data.pitcher.pitchHand ?? '?'}HP&nbsp; • &nbsp;ERA {data.pitcher.stats?.era ?? '—'}&nbsp; • &nbsp;WHIP {data.pitcher.stats?.whip ?? '—'}</p><p className="text-[16px] text-[#d5dce8] mt-2">{record ? `${record.wins}-${record.losses}` : '—'}&nbsp; • &nbsp;{data.pitcher.stats?.inningsPitched ?? '—'} IP&nbsp; • &nbsp;{data.pitcher.stats?.strikeOuts ?? '—'} K</p></div></div></div>;

const TopHitters = ({ title, hitters }: any) => { const rows=[...(hitters??[])].sort((a,b)=>Number(b.stats?.ops||0)-Number(a.stats?.ops||0)).slice(0,6); return <div className="bg-[#111a2d] border border-[#27344c] rounded-xl overflow-hidden"><div className="p-4 border-b border-[#27344c]"><p className="font-label-caps text-[12px] text-[#c3ccda]">KEY HITTERS</p><h3 className="font-bold text-lg mt-1">{title}</h3></div><div>{rows.map((h:any)=><div key={h.id} className="flex items-center justify-between gap-4 p-3 border-t border-[#27344c]/70 first:border-t-0"><div className="flex items-center gap-3 min-w-0"><div className="w-12 h-12 rounded-lg bg-[#f2f4f8] overflow-hidden p-1"><img src={mlbPlayerHeadshotUrl(h.id,140)} alt={h.name} className="w-full h-full object-contain" /></div><div className="min-w-0"><p className="font-bold text-sm truncate">{h.name}</p><p className="text-[12px] text-[#bec7d5]">{h.batSide ?? '?'}HB · {h.position || '—'}</p></div></div><div className="text-right"><p className="font-data-numeric text-white">{h.stats?.ops ?? '—'}</p><p className="text-[11px] text-[#bec7d5]">OPS</p></div></div>)}</div></div>; };
const fmt3=(v:number|null)=>v==null||!Number.isFinite(v)?'—':v.toFixed(3).replace(/^0/,'');
const fmt2=(v:number|null)=>v==null||!Number.isFinite(v)?'—':v.toFixed(2);
const fmt1=(v:number|null)=>v==null||!Number.isFinite(v)?'—':v.toFixed(1);
