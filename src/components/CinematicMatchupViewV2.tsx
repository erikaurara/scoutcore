import React, { useEffect, useMemo, useState } from 'react';
import {
  buildPitcherVsTeam,
  fetchPlayerCareerStats,
  fetchPlayerHittingHandSplits,
  fetchPlayerRecentGameLogs,
  fetchRecentPitchProfile,
  fetchTeams,
  searchMlbPitchers,
} from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

export const CinematicMatchupViewV2: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [pitcherResults, setPitcherResults] = useState<any[]>([]);
  const [pitcher, setPitcher] = useState<any | null>(null);
  const [matchup, setMatchup] = useState<any | null>(null);
  const [batterId, setBatterId] = useState<number | null>(null);
  const [pitchProfile, setPitchProfile] = useState<any[]>([]);
  const [career, setCareer] = useState<any | null>(null);
  const [splits, setSplits] = useState<any | null>(null);
  const [pitcherLogs, setPitcherLogs] = useState<any[]>([]);
  const [batterLogs, setBatterLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams().then((data) => {
      setTeams(data);
      setTeamId(data[0]?.id ?? null);
    }).catch(() => setError('Unable to load MLB teams.'));
  }, []);

  useEffect(() => {
    if (query.trim().length < 2 || pitcher) {
      setPitcherResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      searchMlbPitchers(query).then(setPitcherResults).catch(() => setPitcherResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, pitcher]);

  const selectedBatter = useMemo(
    () => matchup?.batters?.find((b: any) => b.id === batterId) ?? null,
    [matchup, batterId],
  );

  const build = async () => {
    if (!pitcher || !teamId) return;
    setLoading(true);
    setError(null);
    setBatterId(null);
    try {
      const data = await buildPitcherVsTeam(pitcher.id, teamId);
      setMatchup(data);
      const [profile, logs] = await Promise.all([
        fetchRecentPitchProfile(pitcher.id, 3).catch(() => []),
        fetchPlayerRecentGameLogs(pitcher.id, 'pitching', 10).catch(() => []),
      ]);
      setPitchProfile(profile);
      setPitcherLogs(logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to build matchup.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!batterId) {
      setCareer(null);
      setSplits(null);
      setBatterLogs([]);
      return;
    }
    Promise.all([
      fetchPlayerCareerStats(batterId, 'hitting').catch(() => null),
      fetchPlayerHittingHandSplits(batterId).catch(() => null),
      fetchPlayerRecentGameLogs(batterId, 'hitting', 10).catch(() => []),
    ]).then(([nextCareer, nextSplits, nextLogs]) => {
      setCareer(nextCareer);
      setSplits(nextSplits);
      setBatterLogs(nextLogs);
    });
  }, [batterId]);

  const advantage = selectedBatter ? calcAdvantage(matchup?.pitcher, selectedBatter, splits) : null;

  return <div className="min-h-screen bg-[#08111f] text-[#dae2fd] p-6 lg:p-8 space-y-5">
    <section className="bg-[#10192b] border border-[#26364e] rounded-xl p-5">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div>
          <p className="font-label-caps text-[10px] text-[#54dce9]">PITCHER VS BATTER</p>
          <h1 className="font-display-lg text-3xl mt-1">Matchup Intelligence</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-3 items-end flex-1 max-w-4xl">
          <div className="relative">
            <label className="text-[9px] text-[#849495] font-label-caps">CHOOSE PITCHER</label>
            <input
              className="mt-2 w-full bg-[#151f33] border border-[#30415c] rounded-md px-3 py-2.5 text-sm"
              value={pitcher ? pitcher.name : query}
              onChange={(e) => { setPitcher(null); setQuery(e.target.value); }}
              placeholder="Search pitcher..."
            />
            {pitcherResults.length > 0 && <div className="absolute z-40 w-full mt-1 max-h-72 overflow-auto bg-[#10192b] border border-[#30415c] rounded-lg shadow-2xl">
              {pitcherResults.map((p) => <button
                key={p.id}
                onClick={() => { setPitcher(p); setQuery(p.name); setPitcherResults([]); }}
                className="w-full px-3 py-2.5 text-left hover:bg-[#17243a] flex items-center gap-3 border-b border-[#26364e]/40 last:border-b-0"
              >
                <Headshot id={p.id} name={p.name} small />
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{p.name}</p>
                  <p className="text-[10px] text-[#849495]">{p.pitchHand ? `${p.pitchHand}HP` : 'Hand N/A'}{p.currentTeam?.name ? ` · ${p.currentTeam.name}` : ''}</p>
                </div>
              </button>)}
            </div>}
          </div>
          <span className="pb-2 text-[#54dce9] font-bold">VS</span>
          <div>
            <label className="text-[9px] text-[#849495] font-label-caps">CHOOSE TEAM</label>
            <select className="mt-2 w-full bg-[#151f33] border border-[#30415c] rounded-md px-3 py-2.5 text-sm" value={teamId ?? ''} onChange={(e) => setTeamId(Number(e.target.value))}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
          <button onClick={build} disabled={!pitcher || !teamId || loading} className="px-5 py-2.5 bg-[#56dce9] text-[#07151c] rounded-md text-xs font-bold disabled:opacity-40">{loading ? 'BUILDING…' : 'BUILD'}</button>
        </div>
      </div>
    </section>

    {error && <div className="p-4 rounded-lg border border-[#ff8d8d]/30 bg-[#ff8d8d]/10 text-[#ffb4ab] text-sm">{error}</div>}

    {matchup && !selectedBatter && <BatterPicker matchup={matchup} onChoose={setBatterId} />}

    {matchup && selectedBatter && <>
      <section className="grid grid-cols-1 xl:grid-cols-[1fr_230px_1fr] gap-5 items-stretch">
        <PlayerPanel type="pitcher" player={matchup.pitcher} profile={pitchProfile} />
        <CenterAdvantage pitcher={matchup.pitcher} batter={selectedBatter} value={advantage} />
        <PlayerPanel type="batter" player={selectedBatter} career={career} splits={splits} />
      </section>

      <OtherBatters batters={matchup.batters} selected={batterId} onChoose={setBatterId} />

      <section className="grid grid-cols-1 xl:grid-cols-[1.45fr_.75fr] gap-5 items-start">
        <CombinedGameLog pitcher={matchup.pitcher} batter={selectedBatter} pitcherLogs={pitcherLogs} batterLogs={batterLogs} />
        <InjuredList matchup={matchup} />
      </section>
    </>}
  </div>;
};

const BatterPicker = ({ matchup, onChoose }: any) => <section className="bg-[#10192b] border border-[#26364e] rounded-xl overflow-hidden">
  <div className="p-4 flex items-center gap-3 border-b border-[#26364e]">
    <div className="w-12 h-12 bg-white rounded-md p-1.5"><img src={mlbTeamLogoUrl(matchup.team.id)} alt={matchup.team.name} className="w-full h-full object-contain" /></div>
    <div><p className="text-[9px] text-[#849495] font-label-caps">CHOOSE A BATTER</p><h2 className="font-display-lg text-xl">{matchup.team.name}</h2></div>
  </div>
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3">
    {matchup.batters.map((b: any) => <button key={b.id} onClick={() => onChoose(b.id)} className="flex items-center gap-3 p-3 rounded-lg bg-[#151f33] border border-[#26364e] hover:border-[#54dce9]/50 text-left">
      <Headshot id={b.id} name={b.name} small />
      <div className="min-w-0 flex-1"><p className="font-bold text-sm truncate">{b.name}</p><p className="text-[10px] text-[#849495]">{b.batSide ?? '?'}HB · {b.position || '—'}</p></div>
      <div className="text-right"><p className="font-data-numeric text-sm">{b.stats?.ops ?? '—'}</p><p className="text-[8px] text-[#849495]">OPS</p></div>
    </button>)}
  </div>
</section>;

const PlayerPanel = ({ type, player, profile, career, splits }: any) => {
  const isPitcher = type === 'pitcher';
  const s = player.stats ?? {};
  return <section className={`bg-[#151f33] rounded-lg border border-[#26364e] ${isPitcher ? 'border-l-2 border-l-[#54dce9]' : 'border-r-2 border-r-[#cbd7ef]'} p-5 min-h-[470px]`}>
    <div className="flex items-start gap-4">
      <Headshot id={player.id} name={player.name} />
      <div className="min-w-0 flex-1">
        <p className={`font-label-caps text-[9px] ${isPitcher ? 'text-[#54dce9]' : 'text-[#cbd7ef]'}`}>{isPitcher ? 'STARTING PITCHER' : 'SELECTED BATTER'}</p>
        <h2 className="font-display-lg text-3xl leading-none mt-2">{player.name}</h2>
        <p className="text-[10px] text-[#849495] mt-2">{isPitcher ? `${player.pitchHand ?? '?'}HP` : `${player.batSide ?? '?'}HB · ${player.position ?? ''}`}</p>
      </div>
    </div>

    {isPitcher ? <>
      <div className="grid grid-cols-3 gap-3 mt-7"><Data label="ERA" value={s.era} /><Data label="WHIP" value={s.whip} /><Data label="K/9" value={s.strikeoutsPer9Inn} /></div>
      <div className="mt-6"><p className="font-label-caps text-[9px] text-[#849495]">PITCH ARSENAL</p><div className="mt-3 space-y-2">{profile?.slice(0, 5).map((p: any) => <div key={p.code} className="grid grid-cols-[110px_1fr_58px] gap-2 items-center text-xs"><span className="truncate">{p.name}</span><div className="h-2 bg-[#25344c] rounded-full overflow-hidden"><div className="h-full bg-[#54dce9] rounded-full" style={{ width: `${Math.max(10, Math.min(100, p.usagePct))}%` }} /></div><span className="text-right text-[#b9c8de]">{p.avgVelo?.toFixed?.(1) ?? '—'} mph</span></div>)}</div></div>
      <p className="mt-6 text-xs leading-relaxed text-[#aab8ce]">{pitcherScout(player, profile)}</p>
    </> : <>
      <StatGrid title="2026 REGULAR SEASON" stats={s} />
      <StatGrid title="CAREER REGULAR SEASON" stats={career} />
      <p className="mt-6 text-xs leading-relaxed text-[#aab8ce]">{batterScout(player, splits)}</p>
    </>}
  </section>;
};

const CenterAdvantage = ({ pitcher, batter, value }: any) => <section className="flex flex-col items-center justify-center text-center px-2">
  <p className="font-label-caps text-[9px] text-[#849495]">ADVANTAGE</p>
  <div className="relative w-32 h-32 mt-4 rounded-full flex items-center justify-center">
    <div className="absolute inset-0 rounded-full border-[5px] border-[#26364e]" />
    <div className="absolute inset-0 rounded-full border-[5px] border-transparent border-t-[#54dce9] border-r-[#54dce9] animate-spin [animation-duration:5s]" />
    <div><div className="font-data-numeric text-4xl">{value ?? 50}%</div><div className="text-[8px] text-[#54dce9] font-label-caps">{(value ?? 50) >= 50 ? 'PITCHER' : 'BATTER'}</div></div>
  </div>
  <span className="material-symbols-outlined text-[#54dce9] mt-5">swap_horiz</span>
  <div className="mt-6"><p className="font-label-caps text-[8px] text-[#849495]">KEY FACTOR</p><p className="text-xs text-[#aab8ce] mt-2 leading-relaxed">{pitcher.pitchHand ?? '?'}HP vs {batter.batSide ?? '?'}HB. Handedness splits, current production and the pitcher’s run-prevention profile shape this matchup index.</p></div>
</section>;

const OtherBatters = ({ batters, selected, onChoose }: any) => <section className="bg-[#10192b] border border-[#26364e] rounded-xl overflow-hidden">
  <div className="px-4 py-3 border-b border-[#26364e]"><p className="font-label-caps text-[9px] text-[#849495]">OTHER BATTERS</p><h3 className="font-bold text-sm">Click another hitter to compare instantly</h3></div>
  <div className="flex gap-2 overflow-x-auto p-3">
    {batters.map((b: any) => <button key={b.id} onClick={() => onChoose(b.id)} className={`min-w-[185px] flex items-center gap-3 p-2.5 rounded-lg border text-left ${selected === b.id ? 'border-[#54dce9] bg-[#163348]' : 'border-[#26364e] bg-[#151f33] hover:border-[#54dce9]/50'}`}>
      <Headshot id={b.id} name={b.name} small />
      <div className="min-w-0 flex-1"><p className="font-bold text-xs truncate">{b.name}</p><p className="text-[9px] text-[#849495]">{b.batSide ?? '?'} · {b.position || '—'}</p></div>
      <div className="text-right"><p className="font-data-numeric text-xs">{b.stats?.ops ?? '—'}</p><p className="text-[8px] text-[#849495]">OPS</p></div>
    </button>)}
  </div>
</section>;

const CombinedGameLog = ({ pitcher, batter, pitcherLogs, batterLogs }: any) => {
  const [tab, setTab] = useState<'pitcher' | 'batter'>('batter');
  const logs = tab === 'pitcher' ? pitcherLogs : batterLogs;
  return <section className="bg-[#10192b] border border-[#26364e] rounded-xl overflow-hidden">
    <div className="p-4 border-b border-[#26364e] flex flex-wrap items-center justify-between gap-3">
      <div><p className="font-label-caps text-[9px] text-[#849495]">RECENT GAME LOG</p><h3 className="font-bold text-sm">Last 10 games</h3></div>
      <div className="flex gap-2"><button onClick={() => setTab('pitcher')} className={`px-3 py-1.5 rounded-md text-xs ${tab === 'pitcher' ? 'bg-[#54dce9] text-[#07151c]' : 'bg-[#151f33]'}`}>{pitcher.name}</button><button onClick={() => setTab('batter')} className={`px-3 py-1.5 rounded-md text-xs ${tab === 'batter' ? 'bg-[#54dce9] text-[#07151c]' : 'bg-[#151f33]'}`}>{batter.name}</button></div>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-xs"><thead className="bg-[#08111f] text-[#849495]"><tr><th className="p-3 text-left">DATE</th><th className="text-left">OPP</th>{tab === 'pitcher' ? <><th>IP</th><th>H</th><th>ER</th><th>BB</th><th>K</th></> : <><th>AB</th><th>R</th><th>H</th><th>HR</th><th>RBI</th><th>BB</th><th>SO</th></>}</tr></thead><tbody>{logs.map((x: any, i: number) => <tr key={i} className="border-t border-[#26364e]/50"><td className="p-3">{shortDate(x.date)}</td><td>{x.opponent ?? '—'}</td>{tab === 'pitcher' ? <><td className="text-center">{x.stat?.inningsPitched ?? '—'}</td><td className="text-center">{x.stat?.hits ?? '—'}</td><td className="text-center">{x.stat?.earnedRuns ?? '—'}</td><td className="text-center">{x.stat?.baseOnBalls ?? '—'}</td><td className="text-center">{x.stat?.strikeOuts ?? '—'}</td></> : <><td className="text-center">{x.stat?.atBats ?? '—'}</td><td className="text-center">{x.stat?.runs ?? '—'}</td><td className="text-center">{x.stat?.hits ?? '—'}</td><td className="text-center">{x.stat?.homeRuns ?? '—'}</td><td className="text-center">{x.stat?.rbi ?? '—'}</td><td className="text-center">{x.stat?.baseOnBalls ?? '—'}</td><td className="text-center">{x.stat?.strikeOuts ?? '—'}</td></>}</tr>)}</tbody></table></div>
  </section>;
};

const InjuredList = ({ matchup }: any) => <section className="bg-[#10192b] border border-[#26364e] rounded-xl overflow-hidden">
  <div className="p-4 border-b border-[#26364e]"><p className="font-label-caps text-[9px] text-[#849495]">INJURED LIST</p><h3 className="font-bold text-sm">{matchup.team.name}</h3></div>
  {matchup.injuredList?.length ? <div>{matchup.injuredList.slice(0, 6).map((p: any) => <div key={p.id} className="flex items-center gap-3 p-3 border-t border-[#26364e]/50 first:border-t-0"><Headshot id={p.id} name={p.name} small /><div className="min-w-0"><p className="font-bold text-xs truncate">{p.name}</p><p className="text-[9px] text-[#849495]">{p.position || '—'} · {p.status}</p></div></div>)}</div> : <div className="p-5 text-xs text-[#849495]">No injured-list players returned for this team.</div>}
</section>;

const StatGrid = ({ title, stats }: any) => <div className="mt-7"><p className="font-label-caps text-[9px] text-[#849495]">{title}</p><div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-2">{[['AB', stats?.atBats], ['AVG', stats?.avg], ['HR', stats?.homeRuns], ['RBI', stats?.rbi], ['SB', stats?.stolenBases], ['OPS', stats?.ops]].map(([label, value]) => <Data key={label} label={label} value={value} />)}</div></div>;
const Data = ({ label, value }: any) => <div className="bg-[#111a2c] p-3 rounded-md"><p className="font-label-caps text-[8px] text-[#849495]">{label}</p><p className="font-data-numeric text-lg mt-2">{value ?? '—'}</p><div className="h-0.5 w-8 bg-[#54dce9] mt-2" /></div>;
const Headshot = ({ id, name, small = false }: any) => <div className={`${small ? 'w-11 h-11' : 'w-24 h-24'} rounded-md bg-[#202b3f] overflow-hidden shrink-0 border border-[#30415c]`}><img src={mlbPlayerHeadshotUrl(id, small ? 120 : 260)} alt={name} className="w-full h-full object-contain" /></div>;

const pitcherScout = (player: any, profile: any[]) => {
  const s = player.stats ?? {};
  const top = profile?.[0];
  if (!top) return `${player.name} is a ${player.pitchHand === 'L' ? 'left-handed' : 'right-handed'} starter with a ${s.era ?? '—'} ERA, ${s.whip ?? '—'} WHIP and ${s.strikeoutsPer9Inn ?? '—'} K/9 in 2026.`;
  return `${player.name} works primarily off the ${top.name}, averaging ${top.avgVelo?.toFixed?.(1) ?? '—'} mph in recent tracked outings with ${top.usagePct?.toFixed?.(0) ?? '—'}% usage. His 2026 profile is ${s.era ?? '—'} ERA, ${s.whip ?? '—'} WHIP and ${s.strikeoutsPer9Inn ?? '—'} K/9.`;
};

const batterScout = (player: any, splits: any) => {
  const leftOps = splits?.vsLeft?.ops;
  const rightOps = splits?.vsRight?.ops;
  const side = player.batSide === 'L' ? 'left-handed' : player.batSide === 'R' ? 'right-handed' : player.batSide === 'S' ? 'switch' : '';
  if (leftOps && rightOps) {
    const better = Number(leftOps) > Number(rightOps) ? 'left-handed' : 'right-handed';
    return `${player.name} is a ${side} hitter. His 2026 split profile has been stronger against ${better} pitching (${better === 'left-handed' ? leftOps : rightOps} OPS), giving the matchup context beyond the basic platoon label.`;
  }
  return `${player.name} is a ${side} hitter. ScoutCore will emphasize verified season production and handedness data when enough split plate appearances are available.`;
};

const calcAdvantage = (pitcher: any, batter: any, splits: any) => {
  const pitcherEra = Number(pitcher?.stats?.era || 4.2);
  const pitcherWhip = Number(pitcher?.stats?.whip || 1.3);
  const batterOps = Number(batter?.stats?.ops || .700);
  const split = pitcher?.pitchHand === 'L' ? Number(splits?.vsLeft?.ops || batterOps) : Number(splits?.vsRight?.ops || batterOps);
  const raw = 50 + (4.2 - pitcherEra) * 3 + (1.3 - pitcherWhip) * 8 + (.720 - split) * 25;
  return Math.round(Math.max(28, Math.min(72, raw)));
};

const shortDate = (date?: string) => date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`)) : '—';
