import React, { useEffect, useMemo, useState } from 'react';
import { buildPitcherVsTeam, fetchPlayerCareerStats, fetchPlayerHittingHandSplits, fetchPlayerRecentGameLogs, fetchRecentPitchProfile, fetchTeams, searchMlbPitchers } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl, playerInitials } from '../services/mlbMedia';

export const MatchupWorkspaceView: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [pitcherQuery, setPitcherQuery] = useState('');
  const [pitcherResults, setPitcherResults] = useState<any[]>([]);
  const [selectedPitcher, setSelectedPitcher] = useState<any | null>(null);
  const [matchup, setMatchup] = useState<any | null>(null);
  const [selectedBatterId, setSelectedBatterId] = useState<number | null>(null);
  const [pitcherLogs, setPitcherLogs] = useState<any[]>([]);
  const [batterLogs, setBatterLogs] = useState<any[]>([]);
  const [batterCareer, setBatterCareer] = useState<any | null>(null);
  const [batterSplits, setBatterSplits] = useState<any | null>(null);
  const [pitchProfile, setPitchProfile] = useState<any[]>([]);
  const [logTab, setLogTab] = useState<'pitcher' | 'batter'>('pitcher');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchTeams().then((data) => { setTeams(data); setTeamId(data[0]?.id ?? null); }).catch(() => setError('Unable to load MLB teams.')); }, []);
  useEffect(() => {
    if (pitcherQuery.trim().length < 2 || selectedPitcher) { setPitcherResults([]); return; }
    const timer = window.setTimeout(() => searchMlbPitchers(pitcherQuery).then(setPitcherResults).catch(() => setPitcherResults([])), 250);
    return () => window.clearTimeout(timer);
  }, [pitcherQuery, selectedPitcher]);

  const build = async () => {
    if (!selectedPitcher || !teamId) return;
    setLoading(true); setError(null); setSelectedBatterId(null); setBatterLogs([]); setBatterCareer(null); setBatterSplits(null); setLogTab('pitcher');
    try {
      const data = await buildPitcherVsTeam(selectedPitcher.id, teamId);
      setMatchup(data);
      const [logs, profile] = await Promise.all([
        fetchPlayerRecentGameLogs(selectedPitcher.id, 'pitching', 10).catch(() => []),
        fetchRecentPitchProfile(selectedPitcher.id, 3).catch(() => []),
      ]);
      setPitcherLogs(logs); setPitchProfile(profile);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to build matchup.'); }
    finally { setLoading(false); }
  };

  const selectedBatter = useMemo(() => matchup?.batters?.find((b: any) => b.id === selectedBatterId) ?? null, [matchup, selectedBatterId]);

  useEffect(() => {
    if (!selectedBatterId) { setBatterLogs([]); setBatterCareer(null); setBatterSplits(null); return; }
    Promise.all([
      fetchPlayerRecentGameLogs(selectedBatterId, 'hitting', 10).catch(() => []),
      fetchPlayerCareerStats(selectedBatterId, 'hitting').catch(() => null),
      fetchPlayerHittingHandSplits(selectedBatterId).catch(() => null),
    ]).then(([logs, career, splits]) => { setBatterLogs(logs); setBatterCareer(career); setBatterSplits(splits); });
  }, [selectedBatterId]);

  const chooseBatter = (id: number) => { setSelectedBatterId(id); setLogTab('batter'); };

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <section className="bg-[#131b2e] border border-[#3b494b]/20 rounded-xl p-5">
      <div className="mb-5"><span className="font-label-caps text-[10px] text-[#65f2b5]">PITCHER VS BATTER WORKSPACE</span><h1 className="font-display-lg text-3xl text-[#dbfcff]">Matchup Intelligence</h1><p className="text-xs text-[#849495] mt-1">Choose a pitcher and team, then click any batter to open a full season, career, split, scouting and game-log comparison.</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto] gap-4 items-end">
        <div className="relative"><label className="text-[10px] text-[#849495] font-label-caps block mb-2">CHOOSE PITCHER</label><input value={selectedPitcher ? selectedPitcher.name : pitcherQuery} onChange={(e) => { setSelectedPitcher(null); setPitcherQuery(e.target.value); }} placeholder="Search Yamamoto, Cole, Skubal..." className="w-full bg-[#171f33] border border-[#3b494b]/40 rounded-lg px-3 py-3 text-sm" />{pitcherResults.length > 0 && <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-[#171f33] border border-[#3b494b]/40 rounded-lg shadow-xl">{pitcherResults.map((p) => <button key={p.id} onClick={() => { setSelectedPitcher(p); setPitcherQuery(p.name); setPitcherResults([]); }} className="w-full text-left p-3 hover:bg-[#222a3d] flex gap-3 items-center"><Avatar id={p.id} name={p.name} small /><div><p className="font-bold text-sm">{p.name}</p><p className="text-[10px] text-[#849495]">{p.pitchHand ? `${p.pitchHand}HP` : 'Hand N/A'}{p.currentTeam?.name ? ` · ${p.currentTeam.name}` : ''}</p></div></button>)}</div>}</div>
        <div className="pb-3 text-[#00f0ff] font-display-lg text-2xl">VS</div>
        <div><label className="text-[10px] text-[#849495] font-label-caps block mb-2">CHOOSE TEAM</label><select value={teamId ?? ''} onChange={(e) => setTeamId(Number(e.target.value))} className="w-full bg-[#171f33] border border-[#3b494b]/40 rounded-lg px-3 py-3 text-sm">{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <button onClick={build} disabled={!selectedPitcher || !teamId || loading} className="px-5 py-3 rounded-lg bg-[#00f0ff] text-[#002022] font-bold text-xs disabled:opacity-40">{loading ? 'BUILDING…' : 'BUILD MATCHUP'}</button>
      </div>
    </section>

    {error && <div className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}

    {matchup && <>
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        <PitcherCard pitcher={matchup.pitcher} pitchProfile={pitchProfile} />
        {!selectedBatter ? <BatterRoster matchup={matchup} onChoose={chooseBatter} /> : <BatterCard batter={selectedBatter} career={batterCareer} splits={batterSplits} onBack={() => { setSelectedBatterId(null); setLogTab('pitcher'); }} />}
      </section>

      {selectedBatter && <section className="bg-[#131b2e]/60 border border-[#3b494b]/20 rounded-xl p-4 flex flex-wrap items-center justify-center gap-4"><span className="text-[#00f0ff] font-bold">{matchup.pitcher.name}</span><span className="material-symbols-outlined text-[#00f0ff]">swap_horiz</span><span className="text-[#b9c8de] font-bold">{selectedBatter.name}</span><span className="text-[10px] text-[#849495] font-label-caps">{matchup.pitcher.pitchHand ?? '?'}HP VS {selectedBatter.batSide ?? '?'}HB</span></section>}

      {selectedBatter && <OtherBatters matchup={matchup} selectedBatterId={selectedBatterId} onChoose={chooseBatter} />}
      <GameLogs pitcher={matchup.pitcher} batter={selectedBatter} pitcherLogs={pitcherLogs} batterLogs={batterLogs} tab={logTab} setTab={setLogTab} />
      <InjuredList matchup={matchup} />
    </>}
  </div>;
};

const PitcherCard = ({ pitcher, pitchProfile }: any) => {
  const s = pitcher.stats ?? {};
  return <div className="rounded-xl bg-[#171f33] border border-[#3b494b]/20 border-l-2 border-l-[#00f0ff] p-6 min-h-[520px]">
    <div className="flex items-start gap-5"><Avatar id={pitcher.id} name={pitcher.name} /><div><p className="text-[10px] font-label-caps text-[#00f0ff]">STARTING PITCHER</p><h2 className="font-display-lg text-3xl mt-2">{pitcher.name}</h2><p className="text-xs text-[#849495] mt-1">{pitcher.pitchHand ?? '?'}HP</p></div></div>
    <div className="grid grid-cols-3 gap-3 mt-6"><Metric label="ERA" value={s.era}/><Metric label="WHIP" value={s.whip}/><Metric label="K" value={s.strikeOuts}/><Metric label="IP" value={s.inningsPitched}/><Metric label="K/9" value={s.strikeoutsPer9Inn}/><Metric label="GS" value={s.gamesStarted}/></div>
    <div className="mt-5 p-4 rounded-lg bg-[#131b2e]"><p className="text-[10px] text-[#849495] font-label-caps mb-2">SCOUTING REPORT</p><p className="text-xs leading-relaxed text-[#b9cacb]">{pitcherDescription(pitcher, pitchProfile)}</p></div>
    <div className="mt-4"><p className="text-[10px] text-[#849495] font-label-caps mb-2">RECENT TRACKED PITCH PROFILE</p>{pitchProfile.length ? <div className="space-y-2">{pitchProfile.slice(0, 5).map((p: any) => <div key={p.code} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center bg-[#131b2e] rounded-lg px-3 py-2"><span className="text-xs font-bold">{p.name}</span><span className="text-[10px] text-[#849495]">{p.usagePct.toFixed(0)}%</span><span className="font-data-numeric text-sm text-[#00f0ff]">{p.avgVelo.toFixed(1)} mph</span></div>)}</div> : <p className="text-xs text-[#849495]">Recent pitch velocity data was not available from MLB for this pitcher.</p>}</div>
  </div>;
};

const BatterCard = ({ batter, career, splits, onBack }: any) => <div className="rounded-xl bg-[#171f33] border border-[#3b494b]/20 border-r-2 border-r-[#b9c8de] p-6 min-h-[520px]">
  <div className="flex justify-end mb-3"><button onClick={onBack} className="px-3 py-2 rounded-lg bg-[#222a3d] text-[10px] text-[#00f0ff] font-label-caps hover:bg-[#2d3449]">← ALL BATTERS</button></div>
  <div className="flex items-start gap-5"><Avatar id={batter.id} name={batter.name} /><div className="min-w-0 flex-1"><p className="text-[10px] font-label-caps text-[#b9c8de]">SELECTED BATTER</p><h2 className="font-display-lg text-3xl mt-2 break-words">{batter.name}</h2><p className="text-xs text-[#849495] mt-1">{batter.batSide ?? '?'}HB · {batter.position ?? ''}</p></div></div>
  <StatStrip title="2026 REGULAR SEASON" stats={batter.stats} />
  <StatStrip title="CAREER REGULAR SEASON" stats={career} />
  <HandSplitStrip splits={splits} />
  <div className="mt-5 p-4 rounded-lg bg-[#131b2e]"><p className="text-[10px] text-[#849495] font-label-caps mb-2">SCOUTING REPORT</p><p className="text-xs leading-relaxed text-[#b9cacb]">{batterDescription(batter, splits)}</p></div>
</div>;

const StatStrip = ({ title, stats }: any) => <div className="mt-6"><p className="text-[10px] text-[#849495] font-label-caps mb-2">{title}</p><div className="grid grid-cols-3 md:grid-cols-6 gap-2"><Metric label="AB" value={stats?.atBats}/><Metric label="AVG" value={stats?.avg}/><Metric label="HR" value={stats?.homeRuns}/><Metric label="RBI" value={stats?.rbi}/><Metric label="SB" value={stats?.stolenBases}/><Metric label="OPS" value={stats?.ops}/></div></div>;
const HandSplitStrip = ({ splits }: any) => <div className="mt-6"><p className="text-[10px] text-[#849495] font-label-caps mb-2">2026 HANDEDNESS SPLITS</p><div className="grid grid-cols-2 gap-3"><SplitCard label="VS LHP" stats={splits?.vsLeft}/><SplitCard label="VS RHP" stats={splits?.vsRight}/></div></div>;
const SplitCard = ({ label, stats }: any) => <div className="bg-[#131b2e] rounded-lg border border-[#3b494b]/15 p-3"><p className="text-[9px] text-[#00f0ff] font-label-caps mb-2">{label}</p><div className="grid grid-cols-3 gap-2 text-xs"><span>AB <b>{stats?.atBats ?? '—'}</b></span><span>AVG <b>{stats?.avg ?? '—'}</b></span><span>OPS <b>{stats?.ops ?? '—'}</b></span></div></div>;

const BatterRoster = ({ matchup, onChoose }: any) => <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 overflow-hidden flex flex-col min-h-[520px]"><div className="p-5 border-b border-[#3b494b]/20 flex items-center gap-3"><div className="w-12 h-12 bg-white/95 rounded-xl p-1.5"><img src={mlbTeamLogoUrl(matchup.team.id)} alt={matchup.team.name} className="w-full h-full object-contain" /></div><div><p className="text-[10px] text-[#849495] font-label-caps">CHOOSE A BATTER</p><h2 className="font-display-lg text-2xl">{matchup.team.name} Batters</h2></div></div><BatterStatsTable batters={matchup.batters} onChoose={onChoose} /></div>;
const OtherBatters = ({ matchup, selectedBatterId, onChoose }: any) => <section className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 overflow-hidden"><div className="p-4 border-b border-[#3b494b]/20"><p className="text-[10px] text-[#849495] font-label-caps">OTHER BATTERS</p><h3 className="font-bold">Click another hitter to compare instantly</h3></div><BatterStatsTable batters={matchup.batters} onChoose={onChoose} selectedBatterId={selectedBatterId} /></section>;
const BatterStatsTable = ({ batters, onChoose, selectedBatterId }: any) => <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="bg-[#060e20] text-[#849495]"><tr><th className="p-3 sticky left-0 bg-[#060e20]">BATTER</th><th className="p-3">BATS</th><th className="p-3">AB</th><th className="p-3">R</th><th className="p-3">H</th><th className="p-3">HR</th><th className="p-3">RBI</th><th className="p-3">BB</th><th className="p-3">SO</th><th className="p-3">AVG</th><th className="p-3">OBP</th><th className="p-3">SLG</th></tr></thead><tbody>{batters.map((b: any) => <tr key={b.id} onClick={() => onChoose(b.id)} className={`border-t border-[#3b494b]/10 cursor-pointer ${selectedBatterId === b.id ? 'bg-[#00f0ff]/10' : 'hover:bg-[#222a3d]/60'}`}><td className="p-3 sticky left-0 bg-[#171f33]"><div className="flex items-center gap-3"><Avatar id={b.id} name={b.name} small /><div><p className="font-bold whitespace-nowrap">{b.name}</p><p className="text-[10px] text-[#849495]">{b.position || '—'}</p></div></div></td><td className="p-3 text-[#00f0ff]">{b.batSide ?? '—'}</td><td className="p-3">{b.stats?.atBats ?? '—'}</td><td className="p-3">{b.stats?.runs ?? '—'}</td><td className="p-3">{b.stats?.hits ?? '—'}</td><td className="p-3">{b.stats?.homeRuns ?? '—'}</td><td className="p-3">{b.stats?.rbi ?? '—'}</td><td className="p-3">{b.stats?.baseOnBalls ?? '—'}</td><td className="p-3">{b.stats?.strikeOuts ?? '—'}</td><td className="p-3">{b.stats?.avg ?? '—'}</td><td className="p-3">{b.stats?.obp ?? '—'}</td><td className="p-3">{b.stats?.slg ?? '—'}</td></tr>)}</tbody></table></div>;

const GameLogs = ({ pitcher, batter, pitcherLogs, batterLogs, tab, setTab }: any) => { const logs = tab === 'pitcher' ? pitcherLogs : batterLogs; return <section className="bg-[#131b2e] rounded-xl border border-[#3b494b]/20 overflow-hidden"><div className="p-4 border-b border-[#3b494b]/20 flex flex-wrap justify-between gap-3"><div><p className="text-[10px] text-[#849495] font-label-caps">GAME LOGS</p><h3 className="font-bold">Recent MLB games</h3></div><div className="flex gap-2"><button onClick={() => setTab('pitcher')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'pitcher' ? 'bg-[#00f0ff] text-[#002022]' : 'bg-[#171f33]'}`}>{pitcher.name}</button><button disabled={!batter} onClick={() => batter && setTab('batter')} className={`px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-30 ${tab === 'batter' ? 'bg-[#b9c8de] text-[#0d1c2d]' : 'bg-[#171f33]'}`}>{batter?.name ?? 'CHOOSE BATTER'}</button></div></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#060e20] text-[#849495]"><tr><th className="p-3">DATE</th><th className="p-3">OPP</th>{tab === 'pitcher' ? <><th className="p-3">IP</th><th className="p-3">K</th><th className="p-3">ER</th><th className="p-3">H</th></> : <><th className="p-3">AB</th><th className="p-3">R</th><th className="p-3">H</th><th className="p-3">HR</th><th className="p-3">RBI</th><th className="p-3">BB</th><th className="p-3">SO</th></>}</tr></thead><tbody>{logs.length ? logs.map((x: any, i: number) => <tr key={i} className="border-t border-[#3b494b]/10"><td className="p-3">{shortDate(x.date)}</td><td className="p-3">{x.opponent ?? '—'}</td>{tab === 'pitcher' ? <><td className="p-3">{x.stat?.inningsPitched ?? '—'}</td><td className="p-3">{x.stat?.strikeOuts ?? '—'}</td><td className="p-3">{x.stat?.earnedRuns ?? '—'}</td><td className="p-3">{x.stat?.hits ?? '—'}</td></> : <><td className="p-3">{x.stat?.atBats ?? '—'}</td><td className="p-3">{x.stat?.runs ?? '—'}</td><td className="p-3">{x.stat?.hits ?? '—'}</td><td className="p-3">{x.stat?.homeRuns ?? '—'}</td><td className="p-3">{x.stat?.rbi ?? '—'}</td><td className="p-3">{x.stat?.baseOnBalls ?? '—'}</td><td className="p-3">{x.stat?.strikeOuts ?? '—'}</td></>}</tr>) : <tr><td colSpan={9} className="p-8 text-center text-[#849495]">No recent game logs returned by MLB.</td></tr>}</tbody></table></div></section>; };

const InjuredList = ({ matchup }: any) => <section className="bg-[#171f33] rounded-xl border border-[#ffb4ab]/20 overflow-hidden"><div className="px-5 py-4 border-b border-[#ffb4ab]/15 bg-[#ffb4ab]/5 flex justify-between"><div><p className="text-[10px] text-[#ffb4ab] font-label-caps">INJURED LIST</p><h3 className="font-headline-lg text-lg">{matchup.team.name} unavailable players</h3></div><span className="text-[#ffb4ab] text-xl">{matchup.injuredList?.length ?? 0}</span></div>{matchup.injuredList?.length ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">{matchup.injuredList.map((p: any) => <div key={p.id} className="flex gap-3 items-center p-3 bg-[#131b2e] rounded-lg"><Avatar id={p.id} name={p.name} small /><div><p className="font-bold text-sm">{p.name}</p><p className="text-[10px] text-[#849495]">{p.position || '—'} · {p.status}</p></div></div>)}</div> : <div className="p-5 text-sm text-[#849495]">No injured-list players returned for this team.</div>}</section>;

const pitcherDescription = (pitcher: any, profile: any[]) => {
  const s = pitcher.stats ?? {};
  const hand = pitcher.pitchHand === 'L' ? 'left-handed' : pitcher.pitchHand === 'R' ? 'right-handed' : '';
  if (!profile.length) return `${pitcher.name} is a ${hand || 'starting'} pitcher with a ${s.era ?? '—'} ERA and ${s.whip ?? '—'} WHIP in 2026. His strikeout rate sits at ${s.strikeoutsPer9Inn ?? '—'} K/9. Recent MLB pitch-tracking data was unavailable, so ScoutCore is not estimating velocity or pitch usage.`;
  const top = profile[0];
  const second = profile[1];
  const max = Math.max(...profile.map((p: any) => Number(p.maxVelo) || 0));
  const secondary = second ? ` His primary secondary is the ${second.name} (${second.usagePct.toFixed(0)}% usage, ${second.avgVelo.toFixed(1)} mph).` : '';
  return `${pitcher.name} is a ${hand} starter whose current attack is built around the ${top.name}. Across his recent tracked outings, that pitch accounts for ${top.usagePct.toFixed(0)}% of his pitches at ${top.avgVelo.toFixed(1)} mph on average, with a recent tracked peak of ${max.toFixed(1)} mph.${secondary} His 2026 run prevention profile is ${s.era ?? '—'} ERA / ${s.whip ?? '—'} WHIP with ${s.strikeoutsPer9Inn ?? '—'} K/9.`;
};

const batterDescription = (batter: any, splits: any) => {
  const s = batter.stats ?? {};
  const side = batter.batSide === 'S' ? 'switch-hitter' : batter.batSide === 'L' ? 'left-handed hitter' : batter.batSide === 'R' ? 'right-handed hitter' : 'hitter';
  const left = splits?.vsLeft;
  const right = splits?.vsRight;
  const leftAb = Number(left?.atBats ?? 0);
  const rightAb = Number(right?.atBats ?? 0);
  const leftOps = Number(left?.ops);
  const rightOps = Number(right?.ops);
  let splitRead = '';
  if (leftAb >= 15 && rightAb >= 15 && Number.isFinite(leftOps) && Number.isFinite(rightOps)) {
    const diff = leftOps - rightOps;
    if (Math.abs(diff) < 0.060) splitRead = ` His 2026 production has been relatively balanced by pitcher handedness (${left?.ops} OPS vs LHP, ${right?.ops} vs RHP), so the platoon matchup has not created a large performance gap.`;
    else if (diff > 0) splitRead = ` He has handled left-handed pitching especially well in 2026, posting a ${left?.ops} OPS against LHP compared with ${right?.ops} against RHP. That makes him less vulnerable than a typical same-side matchup might suggest.`;
    else splitRead = ` His stronger 2026 results have come against right-handed pitching, with a ${right?.ops} OPS versus RHP compared with ${left?.ops} against LHP. The handedness matchup is therefore a meaningful part of the scouting look.`;
  } else if (leftAb > 0 || rightAb > 0) {
    splitRead = ` His handedness splits are shown above, but the available sample is still limited, so ScoutCore avoids treating them as a firm platoon tendency.`;
  }
  const discipline = Number(s.baseOnBalls ?? 0) > 0 && Number(s.strikeOuts ?? 0) > 0 ? ` He has ${s.baseOnBalls} walks against ${s.strikeOuts} strikeouts, which adds context to how often he controls or loses plate appearances.` : '';
  return `${batter.name} is a ${side} carrying a ${s.avg ?? '—'} AVG / ${s.obp ?? '—'} OBP / ${s.slg ?? '—'} SLG line in 2026, with ${s.homeRuns ?? '—'} home runs and ${s.rbi ?? '—'} RBI.${splitRead}${discipline}`;
};

const Metric = ({ label, value }: { label: string; value: any }) => <div className="p-3 bg-[#131b2e] rounded-lg border border-[#3b494b]/15"><p className="text-[9px] text-[#849495] font-label-caps">{label}</p><p className="font-data-numeric text-lg mt-1">{value ?? '—'}</p></div>;
const Avatar = ({ id, name, small = false }: { id: number; name: string; small?: boolean }) => { const [failed, setFailed] = useState(false); const size = small ? 'w-10 h-10 rounded-full' : 'w-28 h-36 rounded-xl'; return <div className={`${size} bg-[#222a3d] overflow-hidden shrink-0 flex items-center justify-center relative border border-[#3b494b]/25`}>{!failed ? <img src={mlbPlayerHeadshotUrl(id, small ? 96 : 240)} alt={name} className="absolute inset-0 w-full h-full object-cover object-top" onError={() => setFailed(true)} /> : <span className="text-[#00f0ff] text-xs font-bold">{playerInitials(name)}</span>}</div>; };
const shortDate = (date?: string) => date ? new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit' }).format(new Date(`${date}T12:00:00Z`)) : '—';
