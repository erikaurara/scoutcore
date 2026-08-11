import React, { useEffect, useState } from 'react';
import { buildPitcherVsTeam, fetchPlayerRecentGameLogs, fetchTeams, searchMlbPitchers } from '../services/mlbClient';
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
    setLoading(true); setError(null); setSelectedBatterId(null); setBatterLogs([]); setLogTab('pitcher');
    try {
      const data = await buildPitcherVsTeam(selectedPitcher.id, teamId);
      setMatchup(data);
      setPitcherLogs(await fetchPlayerRecentGameLogs(selectedPitcher.id, 'pitching', 10).catch(() => []));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to build matchup.'); }
    finally { setLoading(false); }
  };

  const selectedBatter = matchup?.batters?.find((b: any) => b.id === selectedBatterId) ?? null;
  useEffect(() => {
    if (!selectedBatterId) { setBatterLogs([]); return; }
    fetchPlayerRecentGameLogs(selectedBatterId, 'hitting', 10).then(setBatterLogs).catch(() => setBatterLogs([]));
  }, [selectedBatterId]);

  const chooseBatter = (id: number) => { setSelectedBatterId(id); setLogTab('batter'); };

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <section className="bg-[#131b2e] border border-[#3b494b]/20 rounded-xl p-5">
      <div className="mb-5"><span className="font-label-caps text-[10px] text-[#65f2b5]">PITCHER VS BATTER WORKSPACE</span><h1 className="font-display-lg text-3xl text-[#dbfcff]">Matchup Intelligence</h1><p className="text-xs text-[#849495] mt-1">Choose a pitcher and team. The full batting roster appears first; choose a batter only when you want the head-to-head view.</p></div>
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
        <ProfileCard side="pitcher" player={matchup.pitcher} />
        {!selectedBatter ? <BatterRoster matchup={matchup} onChoose={chooseBatter} /> : <div className="relative"><button onClick={() => { setSelectedBatterId(null); setLogTab('pitcher'); }} className="absolute z-10 top-4 right-4 px-3 py-2 rounded-lg bg-[#222a3d] text-[10px] text-[#00f0ff] font-label-caps hover:bg-[#2d3449]">← ALL BATTERS</button><ProfileCard side="batter" player={selectedBatter} /></div>}
      </section>

      {selectedBatter && <section className="bg-[#131b2e]/60 border border-[#3b494b]/20 rounded-xl p-4 flex flex-wrap items-center justify-center gap-4"><span className="text-[#00f0ff] font-bold">{matchup.pitcher.name}</span><span className="material-symbols-outlined text-[#00f0ff]">swap_horiz</span><span className="text-[#b9c8de] font-bold">{selectedBatter.name}</span><span className="text-[10px] text-[#849495] font-label-caps">{matchup.pitcher.pitchHand ?? '?'}HP VS {selectedBatter.batSide ?? '?'}HB</span></section>}

      <GameLogs pitcher={matchup.pitcher} batter={selectedBatter} pitcherLogs={pitcherLogs} batterLogs={batterLogs} tab={logTab} setTab={setLogTab} />

      <section className="bg-[#171f33] rounded-xl border border-[#ffb4ab]/20 overflow-hidden"><div className="px-5 py-4 border-b border-[#ffb4ab]/15 bg-[#ffb4ab]/5 flex items-center justify-between"><div><p className="text-[10px] text-[#ffb4ab] font-label-caps">INJURED LIST · LAST</p><h3 className="font-headline-lg text-lg">{matchup.team.name} unavailable players</h3></div><span className="text-[#ffb4ab] font-data-numeric text-xl">{matchup.injuredList?.length ?? 0}</span></div>{matchup.injuredList?.length ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">{matchup.injuredList.map((p: any) => <div key={p.id} className="flex gap-3 items-center p-3 bg-[#131b2e] rounded-lg"><Avatar id={p.id} name={p.name} small /><div><p className="font-bold text-sm">{p.name}</p><p className="text-[10px] text-[#849495]">{p.position || '—'} · {p.status}</p></div></div>)}</div> : <div className="p-5 text-sm text-[#849495]">No injured-list players returned for this team.</div>}</section>
    </>}
  </div>;
};

const BatterRoster = ({ matchup, onChoose }: any) => <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 overflow-hidden flex flex-col min-h-[420px]"><div className="p-5 border-b border-[#3b494b]/20 flex items-center gap-3"><div className="w-12 h-12 bg-white/95 rounded-xl p-1.5"><img src={mlbTeamLogoUrl(matchup.team.id)} alt={matchup.team.name} className="w-full h-full object-contain" /></div><div><p className="text-[10px] text-[#849495] font-label-caps">CHOOSE A BATTER</p><h2 className="font-display-lg text-2xl">{matchup.team.name} Batters</h2></div></div><div className="overflow-y-auto max-h-[520px] divide-y divide-[#3b494b]/10">{matchup.batters.map((b: any) => <button key={b.id} onClick={() => onChoose(b.id)} className="w-full p-3 text-left flex items-center gap-3 hover:bg-[#222a3d] transition-colors"><Avatar id={b.id} name={b.name} small /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="font-bold text-sm truncate">{b.name}</p><span className="text-[10px] text-[#00f0ff]">{b.batSide ?? '?'}HB</span></div><p className="text-[10px] text-[#849495]">{b.position || '—'} · H {b.stats?.hits ?? '—'} · HR {b.stats?.homeRuns ?? '—'} · SO {b.stats?.strikeOuts ?? '—'} · AVG {b.stats?.avg ?? '—'} · OPS {b.stats?.ops ?? '—'}</p></div><span className="material-symbols-outlined text-[#849495]">chevron_right</span></button>)}</div></div>;

const ProfileCard = ({ side, player }: { side: 'pitcher' | 'batter'; player: any }) => { const p = side === 'pitcher'; const s = player.stats ?? {}; return <div className={`relative overflow-hidden rounded-xl bg-[#171f33] border border-[#3b494b]/20 p-6 min-h-[420px] ${p ? 'border-l-2 border-l-[#00f0ff]' : 'border-r-2 border-r-[#b9c8de]'}`}><div className={`flex items-start justify-between gap-5 ${p ? '' : 'flex-row-reverse'}`}><Avatar id={player.id} name={player.name} /><div className={p ? 'text-left flex-1' : 'text-right flex-1'}><p className={`text-[10px] font-label-caps tracking-widest ${p ? 'text-[#00f0ff]' : 'text-[#b9c8de]'}`}>{p ? 'STARTING PITCHER' : 'SELECTED BATTER'}</p><h2 className="font-display-lg text-3xl mt-2">{player.name}</h2><p className="text-xs text-[#849495] mt-1">{p ? `${player.pitchHand ?? '?'}HP` : `${player.batSide ?? '?'}HB · ${player.position ?? ''}`}</p></div></div><div className="grid grid-cols-3 gap-3 mt-8">{p ? <><Metric label="ERA" value={s.era}/><Metric label="WHIP" value={s.whip}/><Metric label="K" value={s.strikeOuts}/><Metric label="IP" value={s.inningsPitched}/><Metric label="K/9" value={s.strikeoutsPer9Inn}/><Metric label="GS" value={s.gamesStarted}/></> : <><Metric label="AVG" value={s.avg}/><Metric label="OPS" value={s.ops}/><Metric label="HR" value={s.homeRuns}/><Metric label="HITS" value={s.hits}/><Metric label="SO" value={s.strikeOuts}/><Metric label="RBI" value={s.rbi}/></>}</div></div> };

const GameLogs = ({ pitcher, batter, pitcherLogs, batterLogs, tab, setTab }: any) => { const logs = tab === 'pitcher' ? pitcherLogs : batterLogs; const canBatter = Boolean(batter); return <section className="bg-[#131b2e] rounded-xl border border-[#3b494b]/20 overflow-hidden"><div className="p-4 border-b border-[#3b494b]/20 bg-[#222a3d]/40 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] text-[#849495] font-label-caps">GAME LOGS</p><h3 className="font-bold">Click a player tab to view recent games</h3></div><div className="flex gap-2"><button onClick={() => setTab('pitcher')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'pitcher' ? 'bg-[#00f0ff] text-[#002022]' : 'bg-[#171f33] text-[#b9cacb]'}`}>{pitcher.name}</button><button disabled={!canBatter} onClick={() => canBatter && setTab('batter')} className={`px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-30 ${tab === 'batter' ? 'bg-[#b9c8de] text-[#0d1c2d]' : 'bg-[#171f33] text-[#b9cacb]'}`}>{batter?.name ?? 'CHOOSE BATTER'}</button></div></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#060e20] text-[#849495]"><tr><th className="p-3">DATE</th><th className="p-3">OPP</th>{tab === 'pitcher' ? <><th className="p-3">IP</th><th className="p-3">K</th><th className="p-3">ER</th><th className="p-3">H</th></> : <><th className="p-3">AB</th><th className="p-3">H</th><th className="p-3">HR</th><th className="p-3">RBI</th></>}</tr></thead><tbody>{logs.length ? logs.map((x: any, i: number) => <tr key={i} className="border-t border-[#3b494b]/10 hover:bg-[#222a3d]/40"><td className="p-3">{shortDate(x.date)}</td><td className="p-3">{x.opponent ?? '—'}</td>{tab === 'pitcher' ? <><td className="p-3">{x.stat?.inningsPitched ?? '—'}</td><td className="p-3">{x.stat?.strikeOuts ?? '—'}</td><td className="p-3">{x.stat?.earnedRuns ?? '—'}</td><td className="p-3">{x.stat?.hits ?? '—'}</td></> : <><td className="p-3">{x.stat?.atBats ?? '—'}</td><td className="p-3">{x.stat?.hits ?? '—'}</td><td className="p-3">{x.stat?.homeRuns ?? '—'}</td><td className="p-3">{x.stat?.rbi ?? '—'}</td></>}</tr>) : <tr><td colSpan={6} className="p-8 text-center text-[#849495]">No recent game logs returned by MLB.</td></tr>}</tbody></table></div></section> };

const Metric = ({ label, value }: { label: string; value: any }) => <div className="p-3 bg-[#131b2e] rounded-lg border border-[#3b494b]/15"><p className="text-[9px] text-[#849495] font-label-caps">{label}</p><p className="font-data-numeric text-lg mt-1">{value ?? '—'}</p></div>;
const Avatar = ({ id, name, small = false }: { id: number; name: string; small?: boolean }) => { const [failed, setFailed] = useState(false); const size = small ? 'w-10 h-10' : 'w-24 h-24'; return <div className={`${size} rounded-full bg-[#222a3d] overflow-hidden shrink-0 flex items-center justify-center relative`}>{!failed ? <img src={mlbPlayerHeadshotUrl(id, small ? 96 : 180)} alt={name} className="absolute inset-0 w-full h-full object-cover" onError={() => setFailed(true)} /> : <span className="text-[#00f0ff] text-xs font-bold">{playerInitials(name)}</span>}</div>; };
const shortDate = (date?: string) => date ? new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit' }).format(new Date(`${date}T12:00:00Z`)) : '—';
