import React, { useEffect, useMemo, useState } from 'react';
import { buildPitcherVsTeam, fetchSchedule } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

const avg = (values: any[]) => {
  const nums = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
};
const pct = (value: number | null, scale: number) => value == null ? 0 : Math.max(5, Math.min(100, (value / scale) * 100));
const clamp = (value: number, min = .15, max = .98) => Math.max(min, Math.min(max, value));
const shortTeamName = (name = '') => {
  const known: Record<string, string> = {
    'Arizona Diamondbacks':'Diamondbacks','Athletics':'Athletics','Atlanta Braves':'Braves','Baltimore Orioles':'Orioles','Boston Red Sox':'Red Sox','Chicago Cubs':'Cubs','Chicago White Sox':'White Sox','Cincinnati Reds':'Reds','Cleveland Guardians':'Guardians','Colorado Rockies':'Rockies','Detroit Tigers':'Tigers','Houston Astros':'Astros','Kansas City Royals':'Royals','Los Angeles Angels':'Angels','Los Angeles Dodgers':'Dodgers','Miami Marlins':'Marlins','Milwaukee Brewers':'Brewers','Minnesota Twins':'Twins','New York Mets':'Mets','New York Yankees':'Yankees','Philadelphia Phillies':'Phillies','Pittsburgh Pirates':'Pirates','San Diego Padres':'Padres','San Francisco Giants':'Giants','Seattle Mariners':'Mariners','St. Louis Cardinals':'Cardinals','Tampa Bay Rays':'Rays','Texas Rangers':'Rangers','Toronto Blue Jays':'Blue Jays','Washington Nationals':'Nationals'
  };
  return known[name] ?? name;
};
const teamLogoScale = (teamId: number) => teamId === 146 ? .92 : 1;
const sideColor = (side: 'away' | 'home') => side === 'away' ? '#46e7f3' : '#59f0a7';

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
      ops: avg(hitters.map((h: any) => h.stats?.ops)),
      obp: avg(hitters.map((h: any) => h.stats?.obp)),
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
    return a >= h ? { team: selected?.awayTeam, side: 'away' as const, score: Math.min(99, 50 + Math.abs(a - h) / 4) } : { team: selected?.homeTeam, side: 'home' as const, score: Math.min(99, 50 + Math.abs(a - h) / 4) };
  })();

  if (!selected && loading) return <div className="min-h-screen bg-[#081225] text-[#aeb8c7] p-8">Loading Team Analysis…</div>;

  const awayLabel = selected?.awayTeam?.abbreviation ?? shortTeamName(selected?.awayTeam?.name ?? 'Away');
  const homeLabel = selected?.homeTeam?.abbreviation ?? shortTeamName(selected?.homeTeam?.name ?? 'Home');
  const edgeLabel = edge ? (edge.score < 55 ? 'SLIGHT EDGE' : edge.score < 65 ? 'EDGE' : 'STRONG EDGE') : 'EVEN';
  const edgeText = edge ? `${edge.team?.abbreviation ?? shortTeamName(edge.team?.name)} ${edgeLabel}` : 'EVEN MATCHUP';

  return <div className="min-h-screen bg-[#081225] text-[#eef3ff] px-3 py-4 sm:px-5 lg:px-8 lg:py-6">
    <div className="mx-auto max-w-[1220px]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-4">
        <div><span className="font-label-caps text-[11px] text-[#43f1dc]">TODAY’S TEAM ANALYSIS</span><h1 className="font-display-lg text-[31px] lg:text-[42px] leading-none mt-1">Team Comparison</h1></div>
        <select value={selectedGamePk ?? ''} onChange={(e) => setSelectedGamePk(Number(e.target.value))} className="w-full lg:w-[330px] bg-[#111a2d] border border-[#59647a] rounded-lg px-3 py-2.5 text-sm lg:text-base text-white outline-none">{games.map((game) => <option key={game.gamePk} value={game.gamePk}>{shortTeamName(game.awayTeam.name)} vs {shortTeamName(game.homeTeam.name)}</option>)}</select>
      </div>
      {error && <div className="mb-4 p-3 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}

      {selected && <>
        <section className="relative grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] lg:grid-cols-[1fr_120px_1fr] items-center gap-2 lg:gap-5 rounded-xl border border-[#2b3a52] bg-[#0d1729] p-3 lg:p-5 mb-3 overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-[3px] bg-[#46e7f3]" />
          <div className="absolute inset-y-0 right-0 w-[3px] bg-[#59f0a7]" />
          <TeamHero team={selected.awayTeam} record={records[selected.awayTeam.id]} accent="cyan" />
          <AnimatedVs size="lg" />
          <TeamHero team={selected.homeTeam} record={records[selected.homeTeam.id]} accent="green" />
        </section>

        {loading ? <div className="p-8 text-center text-[#b8c2d0] bg-[#111a2d] rounded-xl">Building live comparison…</div> : awayData && homeData && <>
          <section className="rounded-xl border border-[#2b3a52] bg-[#111a2d] px-4 py-3 lg:px-5 lg:py-4 mb-3 text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <span className="font-label-caps text-[10px] text-[#aeb8c7]">MODEL EDGE</span>
              <span className={`font-bold text-[18px] lg:text-[24px] ${edge?.side === 'home' ? 'text-[#59f0a7]' : 'text-[#46e7f3]'}`}>{edgeText}</span>
              <span className="font-data-numeric text-[17px] lg:text-[22px] text-white">{edge ? `${edge.score.toFixed(0)}/100` : '—'}</span>
            </div>
            <p className="mt-1 text-[11px] lg:text-sm text-[#b9c5d7]">{edge && edge.score < 55 ? 'Very close matchup' : edge ? 'Model sees a measurable advantage' : 'No clear advantage yet'}</p>
            <p className="mt-1 text-[9px] lg:text-[11px] text-[#7f8da1]">Comparison index from hitting and probable-starter performance · not a win probability.</p>
          </section>

          <ProfileCard away={awayMetrics} home={homeMetrics} edge={edge} awayTeam={selected.awayTeam} homeTeam={selected.homeTeam} />

          <section className="grid grid-cols-3 gap-2 lg:gap-3 my-3">
            <MetricCard label="HITTING POWER" value={fmt3(awayMetrics.ops)} league="League Avg .500" note={compareHigh(awayMetrics.ops,.500)} width={pct(awayMetrics.ops,1)} accent="cyan" />
            <MetricCard label="GETTING ON BASE" value={fmt3(awayMetrics.obp)} league="League Avg .320" note={compareHigh(awayMetrics.obp,.320)} width={pct(awayMetrics.obp,.45)} accent="cyan" />
            <MetricCard label="STARTER STRIKEOUTS" value={fmt1(awayMetrics.k9)} league="League Avg 8.6" note={compareHigh(Number.isFinite(awayMetrics.k9)?awayMetrics.k9:null,8.6)} width={pct(Number.isFinite(awayMetrics.k9)?awayMetrics.k9:null,12)} accent="cyan" />
          </section>

          <section className="relative grid grid-cols-2 gap-2 lg:gap-4 mb-3">
            <StarterCard data={awayData} accent="cyan" label={`${awayLabel} STARTER`} />
            <StarterCard data={homeData} accent="green" label={`${homeLabel} STARTER`} />
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"><AnimatedVs size="sm" /></div>
          </section>

          <section className="grid grid-cols-2 gap-2 lg:gap-4 mb-3">
            <TopHitters title={`${shortTeamName(selected.awayTeam.name)} key hitters`} hitters={awayData.hitters} accent="cyan" />
            <TopHitters title={`${shortTeamName(selected.homeTeam.name)} key hitters`} hitters={homeData.hitters} accent="green" />
          </section>

          <section className="grid grid-cols-3 gap-2 lg:gap-3">
            <MetricCard label="RUN PREVENTION" value={fmt2(homeMetrics.era)} league="League Avg 4.20" note={compareLow(Number.isFinite(homeMetrics.era)?homeMetrics.era:null,4.20)} width={100-pct(Number.isFinite(homeMetrics.era)?homeMetrics.era:null,7)} accent="green" />
            <MetricCard label="BASERUNNERS ALLOWED" value={fmt2(homeMetrics.whip)} league="League Avg 1.32" note={compareLow(Number.isFinite(homeMetrics.whip)?homeMetrics.whip:null,1.32)} width={100-pct(Number.isFinite(homeMetrics.whip)?homeMetrics.whip:null,2)} accent="green" />
            <MetricCard label="HOME RUNS" value={String(homeMetrics.hr ?? '—')} league="Team total" note="Power output" width={pct(homeMetrics.hr,250)} accent="green" />
          </section>
        </>}
      </>}
    </div>
  </div>;
};

const AnimatedVs = ({ size }: { size: 'lg' | 'sm' }) => {
  const box = size === 'lg' ? 'w-[58px] h-[58px] lg:w-[78px] lg:h-[78px]' : 'w-[42px] h-[42px] lg:w-[52px] lg:h-[52px]';
  return <div className={`relative ${box} mx-auto flex items-center justify-center shrink-0`}>
    <div className="absolute inset-1 rounded-full border border-[#2b3a52] bg-[#0b1425]" />
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full animate-spin [animation-duration:3.2s]" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="#46e7f3" strokeWidth="3" strokeLinecap="round" strokeDasharray="58 50 18 150" /><circle cx="50" cy="50" r="38" fill="none" stroke="#59f0a7" strokeWidth="2" strokeLinecap="round" strokeDasharray="26 36 20 156" /></svg>
    <span className={`relative z-10 font-display-lg italic ${size === 'lg' ? 'text-lg lg:text-2xl' : 'text-xs lg:text-sm'}`}>VS</span>
  </div>;
};

const TeamHero = ({ team, record, accent }: any) => <div className="min-w-0 flex items-center gap-2 lg:gap-4">
  <div className="w-[64px] h-[64px] lg:w-[105px] lg:h-[105px] rounded-lg flex items-center justify-center p-2 lg:p-3 border border-[#d9dee8] bg-[#f2f4f8] shrink-0"><img src={mlbTeamLogoUrl(team.id)} alt={`${team.name} logo`} className="max-w-full max-h-full object-contain" style={{transform:`scale(${teamLogoScale(team.id)})`}} /></div>
  <div className="min-w-0 text-left"><p className="text-[9px] lg:text-sm font-semibold text-[#c2ccda] truncate">{team.name}</p><h2 className={`font-display-lg text-[21px] lg:text-[34px] leading-none mt-1 ${accent==='cyan'?'text-[#46e7f3]':'text-[#59f0a7]'}`}>{shortTeamName(team.name)}</h2><p className="text-[10px] lg:text-sm mt-2 text-[#b9c3d2]"><span className={accent==='cyan'?'text-[#46e7f3]':'text-[#59f0a7]'}>{record?`${record.wins}-${record.losses}`:'—'}</span>{record?.divisionRank?` · Rank ${record.divisionRank}`:''}</p></div>
</div>;

const MetricCard = ({ label, value, league, note, width, accent }: any) => <div className="min-w-0 bg-[#111a2d] border border-[#27344c] rounded-lg px-2.5 py-2.5 lg:px-4 lg:py-3">
  <div className="flex items-start justify-between gap-1"><span className="font-label-caps text-[8px] sm:text-[9px] lg:text-[12px] leading-tight text-[#e0e6f0]">{label}</span><span className="material-symbols-outlined text-[13px] lg:text-base text-[#7f8da1]">help</span></div>
  <div className={`font-data-numeric text-[20px] lg:text-[29px] leading-none mt-2 ${accent==='cyan'?'text-[#46e7f3]':'text-[#59f0a7]'}`}>{value}</div>
  <p className="text-[8px] lg:text-[11px] text-[#9eabbc] mt-1 truncate">{league}</p>
  <div className="w-full h-[3px] lg:h-[4px] bg-[#344059] rounded-full overflow-hidden mt-2"><div className={`h-full ${accent==='cyan'?'bg-[#43e5f0]':'bg-[#59efaa]'}`} style={{width:`${Math.max(4,Math.min(100,width||0))}%`}} /></div>
  <p className={`text-[8px] lg:text-[10px] mt-1.5 ${String(note).includes('Below') ? 'text-[#ff6b6b]' : accent==='cyan'?'text-[#46e7f3]':'text-[#59f0a7]'}`}>{note}</p>
</div>;

const ProfileCard = ({ away, home, edge, awayTeam, homeTeam }: any) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const offense = (m: any) => clamp((((Number(m?.ops) || .700) / .850) * .58) + (((Number(m?.obp) || .315) / .380) * .42));
  const pitching = (m: any) => {
    const k = clamp((Number.isFinite(m?.k9) ? m.k9 : 8) / 12);
    const era = clamp(1 - ((Number.isFinite(m?.era) ? m.era : 4.25) / 8));
    const whip = clamp(1 - ((Number.isFinite(m?.whip) ? m.whip : 1.35) / 2.2));
    return clamp(k * .42 + era * .35 + whip * .23);
  };
  const awayOff = offense(away), homeOff = offense(home), awayPitch = pitching(away), homePitch = pitching(home);
  const awayOverall = clamp(awayOff * .55 + awayPitch * .45), homeOverall = clamp(homeOff * .55 + homePitch * .45);
  const awayLabel = awayTeam?.abbreviation ?? shortTeamName(awayTeam?.name ?? 'Away');
  const homeLabel = homeTeam?.abbreviation ?? shortTeamName(homeTeam?.name ?? 'Home');
  const rows = [
    { label: 'OFFENSE', detail: 'OPS + OBP', away: Math.round(awayOff * 100), home: Math.round(homeOff * 100) },
    { label: 'STARTING PITCHING', detail: 'K/9 + ERA + WHIP', away: Math.round(awayPitch * 100), home: Math.round(homePitch * 100) },
    { label: 'OVERALL', detail: 'Offense + starter', away: Math.round(awayOverall * 100), home: Math.round(homeOverall * 100) },
  ];
  return <section className="relative bg-[#111a2d] border border-[#27344c] rounded-xl p-3 lg:p-5 mb-3">
    <div className="flex items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-x-4 gap-y-1"><span className="font-label-caps text-[12px] lg:text-[15px] text-white">MATCHUP BREAKDOWN</span><span className="text-[9px] lg:text-[11px] text-[#46e7f3]">● {awayLabel} <span className="text-[#8f9dac]">(Away)</span></span><span className="text-[9px] lg:text-[11px] text-[#59f0a7]">● {homeLabel} <span className="text-[#8f9dac]">(Home)</span></span></div><button type="button" aria-label="Explain matchup breakdown" onClick={() => setInfoOpen(v=>!v)} className="shrink-0"><span className="material-symbols-outlined text-xl text-[#d5dbea]">info</span></button></div>
    {infoOpen && <div className="mt-3 rounded-lg border border-[#3a506e] bg-[#0b1425] p-3 text-[10px] lg:text-xs leading-5 text-[#b9c5d7]">Higher numbers mean a stronger statistical profile in that category. Offense uses OPS + OBP. Starting Pitching uses K/9 + ERA + WHIP. Overall combines offense and the probable starter. These are comparison scores, not win probabilities.</div>}
    <div className="mt-3 divide-y divide-[#27344c]">{rows.map((row) => {
      const diff = row.away-row.home;
      const note = Math.abs(diff) <= 2 ? 'Nearly even' : diff > 0 ? `${awayLabel} edge` : `${homeLabel} edge`;
      const noteColor = Math.abs(diff)<=2 ? 'text-[#aeb8c7]' : diff>0 ? 'text-[#46e7f3]' : 'text-[#59f0a7]';
      return <div key={row.label} className="grid grid-cols-[105px_minmax(0,1fr)_64px] lg:grid-cols-[180px_minmax(0,1fr)_100px] gap-2 lg:gap-4 items-center py-2.5 lg:py-3">
        <div><p className="font-semibold text-[11px] lg:text-sm text-white">{row.label}</p><p className="text-[8px] lg:text-[11px] text-[#7f8da1]">{row.detail}</p></div>
        <div><div className="h-[4px] lg:h-[5px] rounded-full bg-[#26344b] overflow-hidden flex"><div className="h-full bg-[#46e7f3]" style={{width:`${row.away}%`}} /><div className="h-full bg-[#59f0a7]" style={{width:`${row.home}%`}} /></div><span className={`inline-block mt-1 text-[8px] lg:text-[10px] px-1.5 py-.5 rounded border border-[#31415a] ${noteColor}`}>{note}</span></div>
        <div className="text-right font-data-numeric text-[11px] lg:text-base"><span className="text-[#46e7f3]">{row.away}</span><span className="text-[#627086] mx-1">vs</span><span className="text-[#59f0a7]">{row.home}</span></div>
      </div>;
    })}</div>
  </section>;
};

const StarterCard = ({ data, accent, label }: any) => <div className="min-w-0 bg-[#111a2d] border border-[#27344c] rounded-xl p-2.5 lg:p-4">
  <p className={`font-label-caps text-[8px] lg:text-[11px] ${accent==='cyan'?'text-[#46e7f3]':'text-[#59f0a7]'}`}>{label}</p>
  <div className="flex items-center gap-2 lg:gap-4 mt-2"><div className="w-[62px] h-[76px] lg:w-[92px] lg:h-[108px] rounded-lg bg-[#f2f4f8] overflow-hidden p-1 shrink-0"><img src={mlbPlayerHeadshotUrl(data.pitcher.id,260)} alt={data.pitcher.name} className="w-full h-full object-contain" /></div><div className="min-w-0"><h3 className="font-bold text-[12px] lg:text-xl leading-tight truncate">{data.pitcher.name}</h3><p className="text-[9px] lg:text-sm text-[#aeb8c7] mt-1">{data.pitcher.pitchHand ?? '?'}HP</p><p className="text-[9px] lg:text-sm text-[#d5dce8] mt-1">{data.pitcher.stats?.era ?? '—'} ERA&nbsp; | &nbsp;{data.pitcher.stats?.strikeOuts ?? '—'} K</p></div></div>
</div>;

const TopHitters = ({ title, hitters, accent }: any) => {
  const rows=[...(hitters??[])].sort((a,b)=>Number(b.stats?.ops||0)-Number(a.stats?.ops||0)).slice(0,3);
  return <div className="min-w-0 bg-[#111a2d] border border-[#27344c] rounded-xl overflow-hidden"><div className="px-2.5 py-2 lg:px-4 lg:py-3 border-b border-[#27344c]"><h3 className={`font-label-caps text-[8px] lg:text-[12px] truncate ${accent==='cyan'?'text-[#46e7f3]':'text-[#59f0a7]'}`}>{title}</h3></div><div className="divide-y divide-[#27344c]/70">{rows.map((h:any)=><div key={h.id} className="grid grid-cols-[28px_minmax(0,1fr)_38px] lg:grid-cols-[38px_minmax(0,1fr)_50px] items-center gap-1.5 lg:gap-2 px-2 py-1.5 lg:px-3 lg:py-2"><div className="w-7 h-7 lg:w-9 lg:h-9 rounded-full bg-[#f2f4f8] overflow-hidden"><img src={mlbPlayerHeadshotUrl(h.id,140)} alt={h.name} className="w-full h-full object-contain" /></div><div className="min-w-0"><p className="font-semibold text-[8px] lg:text-xs truncate">{h.name}</p><p className="text-[7px] lg:text-[10px] text-[#8f9dac] truncate">{h.position || '—'} · {h.batSide ?? '?'}HB</p></div><div className="text-right"><p className="font-data-numeric text-[8px] lg:text-xs text-white">{h.stats?.ops ?? '—'}</p><p className="text-[7px] lg:text-[9px] text-[#8f9dac]">OPS</p></div></div>)}</div></div>;
};

const compareHigh=(v:number|null,avgValue:number)=>v==null||!Number.isFinite(v)?'No data':v>=avgValue?'Above Average':'Below Average';
const compareLow=(v:number|null,avgValue:number)=>v==null||!Number.isFinite(v)?'No data':v<=avgValue?'Above Average':'Below Average';
const fmt3=(v:number|null)=>v==null||!Number.isFinite(v)?'—':v.toFixed(3).replace(/^0/,'');
const fmt2=(v:number|null)=>v==null||!Number.isFinite(v)?'—':v.toFixed(2);
const fmt1=(v:number|null)=>v==null||!Number.isFinite(v)?'—':v.toFixed(1);
