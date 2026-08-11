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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams().then((data) => { setTeams(data); setTeamId(data[0]?.id ?? null); }).catch(() => setError('Unable to load MLB teams.'));
  }, []);

  useEffect(() => {
    if (pitcherQuery.trim().length < 2 || selectedPitcher) { setPitcherResults([]); return; }
    const timer = window.setTimeout(() => {
      searchMlbPitchers(pitcherQuery).then(setPitcherResults).catch(() => setPitcherResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [pitcherQuery, selectedPitcher]);

  const build = async () => {
    if (!selectedPitcher || !teamId) return;
    setLoading(true); setError(null);
    try {
      const data = await buildPitcherVsTeam(selectedPitcher.id, teamId);
      setMatchup(data);
      setSelectedBatterId(data.batters?.[0]?.id ?? null);
      setPitcherLogs(await fetchPlayerRecentGameLogs(selectedPitcher.id, 'pitching', 8).catch(() => []));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to build matchup.'); }
    finally { setLoading(false); }
  };

  const selectedBatter = matchup?.batters?.find((b: any) => b.id === selectedBatterId) ?? null;

  useEffect(() => {
    if (!selectedBatterId) { setBatterLogs([]); return; }
    fetchPlayerRecentGameLogs(selectedBatterId, 'hitting', 8).then(setBatterLogs).catch(() => setBatterLogs([]));
  }, [selectedBatterId]);

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <section className="bg-[#131b2e] border border-[#3b494b]/20 rounded-xl p-5">
      <div className="flex items-center justify-between gap-4 mb-5"><div><span className="font-label-caps text-[10px] text-[#65f2b5]">PITCHER VS BATTER WORKSPACE</span><h1 className="font-display-lg text-3xl text-[#dbfcff]">Matchup Intelligence</h1><p className="text-xs text-[#849495] mt-1">Pick a pitcher and a team, then move through the opposing batters without leaving the page.</p></div></div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto] gap-4 items-end">
        <div className="relative"><label className="text-[10px] text-[#849495] font-label-caps block mb-2">CHOOSE PITCHER</label><input value={selectedPitcher ? selectedPitcher.name : pitcherQuery} onChange={(e) => { setSelectedPitcher(null); setPitcherQuery(e.target.value); }} placeholder="Search Yamamoto, Cole, Skubal..." className="w-full bg-[#171f33] border border-[#3b494b]/40 rounded-lg px-3 py-3 text-sm" />{pitcherResults.length > 0 && <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-[#171f33] border border-[#3b494b]/40 rounded-lg shadow-xl">{pitcherResults.map((p) => <button key={p.id} onClick={() => { setSelectedPitcher(p); setPitcherQuery(p.name); setPitcherResults([]); }} className="w-full text-left p-3 hover:bg-[#222a3d] flex gap-3 items-center"><Avatar id={p.id} name={p.name} small /><div><p className="font-bold text-sm">{p.name}</p><p className="text-[10px] text-[#849495]">{p.pitchHand ? `${p.pitchHand}HP` : 'Hand N/A'}{p.currentTeam?.name ? ` · ${p.currentTeam.name}` : ''}</p></div></button>)}</div>}</div>
        <div className="pb-3 text-[#00f0ff] font-display-lg text-2xl">VS</div>
        <div><label className="text-[10px] text-[#849495] font-label-caps block mb-2">CHOOSE TEAM</label><select value={teamId ?? ''} onChange={(e) => setTeamId(Number(e.target.value))} className="w-full bg-[#171f33] border border-[#3b494b]/40 rounded-lg px-3 py-3 text-sm">{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <button onClick={build} disabled={!selectedPitcher || !teamId || loading} className="px-5 py-3 rounded-lg bg-[#00f0ff] text-[#002022] font-bold text-xs disabled:opacity-40">{loading ? 'BUILDING…' : 'BUILD MATCHUP'}</button>
      </div>
    </section>

    {error && <div className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}

    {matchup && selectedBatter && <>
      <section className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="space-y-6">
          <div className="grid grid-cols-12 gap-5 items-stretch">
            <ProfileCard side="pitcher" player={matchup.pitcher} />
            <div className="col-span-12 lg:col-span-2 bg-[#131b2e]/60 border border-[#3b494b]/20 rounded-xl flex flex-col items-center justify-center p-5 text-center"><span className="text-[10px] text-[#849495] font-label-caps">MATCHUP</span><span className="material-symbols-outlined text-[#00f0ff] text-4xl my-3">swap_horiz</span><span className="text-xs text-[#b9cacb]">{matchup.pitcher.pitchHand ?? '?'}HP vs {selectedBatter.batSide ?? '?'}HB</span><div className="mt-4 px-3 py-1 rounded-full bg-[#222a3d] text-[10px] font-label-caps">SEASON VIEW</div></div>
            <ProfileCard side="batter" player={selectedBatter} />
          </div>

          <RecentLogs pitcher={matchup.pitcher} batter={selectedBatter} pitcherLogs={pitcherLogs} batterLogs={batterLogs} />

          <div className="bg-[#171f33] rounded-xl border border-[#ffb4ab]/20 overflow-hidden"><div className="px-5 py-4 border-b border-[#ffb4ab]/15 bg-[#ffb4ab]/5"><p className="text-[10px] text-[#ffb4ab] font-label-caps">INJURED LIST</p><h3 className="font-headline-lg text-lg">{matchup.team.name}</h3></div>{matchup.injuredList?.length ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">{matchup.injuredList.map((p: any) => <div key={p.id} className="flex gap-3 items-center p-3 bg-[#131b2e] rounded-lg"><Avatar id={p.id} name={p.name} small /><div><p className="font-bold text-sm">{p.name}</p><p className="text-[10px] text-[#849495]">{p.position} · {p.status}</p></div></div>)}</div> : <div className="p-5 text-sm text-[#849495]">No injured-list players returned for this team.</div>}</div>
        </div>

        <aside className="2xl:sticky 2xl:top-20 bg-[#171f33] rounded-xl border border-[#3b494b]/20 overflow-hidden max-h-[calc(100vh-6rem)] flex flex-col"><div className="p-4 border-b border-[#3b494b]/20 flex items-center gap-3"><div className="w-10 h-10 bg-white/95 rounded-lg p-1"><img src={mlbTeamLogoUrl(matchup.team.id)} alt={matchup.team.name} className="w-full h-full object-contain" /></div><div><p className="text-[10px] text-[#849495] font-label-caps">OTHER BATTERS</p><h3 className="font-bold">{matchup.team.name}</h3></div></div><div className="overflow-y-auto divide-y divide-[#3b494b]/10">{matchup.batters.map((b: any) => <button key={b.id} onClick={() => setSelectedBatterId(b.id)} className={`w-full p-3 text-left flex items-center gap-3 hover:bg-[#222a3d] ${selectedBatterId === b.id ? 'bg-[#00f0ff]/10 border-l-2 border-[#00f0ff]' : ''}`}><Avatar id={b.id} name={b.name} small /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="font-bold text-sm truncate">{b.name}</p><span className="text-[10px] text-[#00f0ff]">{b.batSide ?? '?'}HB</span></div><p className="text-[10px] text-[#849495]">{b.position || '—'} · H {b.stats?.hits ?? '—'} · HR {b.stats?.homeRuns ?? '—'} · OPS {b.stats?.ops ?? '—'}</p></div></button>)}</div></aside>
      </section>
    </>}
  </div>;
};

const ProfileCard = ({ side, player }: { side: 'pitcher' | 'batter'; player: any }) => {
  const isPitcher = side === 'pitcher';
  const stats = player.stats ?? {};
  return <div className={`col-span-12 lg:col-span-5 relative overflow-hidden rounded-xl bg-[#171f33] border border-[#3b494b]/20 p-6 ${isPitcher ? 'border-l-2 border-l-[#00f0ff]' : 'border-r-2 border-r-[#b9c8de]'}`}><div className={`flex items-start justify-between gap-5 ${isPitcher ? '' : 'flex-row-reverse'}`}><Avatar id={player.id} name={player.name} /><div className={isPitcher ? 'text-left flex-1' : 'text-right flex-1'}><p className={`text-[10px] font-label-caps tracking-widest ${isPitcher ? 'text-[#00f0ff]' : 'text-[#b9c8de]'}`}>{isPitcher ? 'STARTING PITCHER' : 'SELECTED BATTER'}</p><h2 className="font-display-lg text-3xl mt-2">{player.name}</h2><p className="text-xs text-[#849495] mt-1">{isPitcher ? `${player.pitchHand ?? '?'}HP` : `${player.batSide ?? '?'}HB · ${player.position ?? ''}`}</p></div></div><div className="grid grid-cols-3 gap-3 mt-6">{isPitcher ? <><Metric label="ERA" value={stats.era} /><Metric label="WHIP" value={stats.whip} /><Metric label="K" value={stats.strikeOuts} /></> : <><Metric label="AVG" value={stats.avg} /><Metric label="OPS" value={stats.ops} /><Metric label="HR" value={stats.homeRuns} /></>}</div><div className="grid grid-cols-3 gap-3 mt-3">{isPitcher ? <><Metric label="IP" value={stats.inningsPitched} /><Metric label="K/9" value={stats.strikeoutsPer9Inn} /><Metric label="GS" value={stats.gamesStarted} /></> : <><Metric label="HITS" value={stats.hits} /><Metric label="SO" value={stats.strikeOuts} /><Metric label="RBI" value={stats.rbi} /></>}</div></div>;
};

const RecentLogs = ({ pitcher, batter, pitcherLogs, batterLogs }: any) => {
  const rows = Array.from({ length: Math.max(pitcherLogs.length, batterLogs.length, 1) }, (_, i) => ({ p: pitcherLogs[i], b: batterLogs[i] }));
  return <div className="bg-[#131b2e] rounded-xl border border-[#3b494b]/20 overflow-hidden"><div className="p-4 border-b border-[#3b494b]/20 bg-[#222a3d]/40 flex items-center justify-between gap-4"><div><p className="text-[10px] text-[#849495] font-label-caps">RECENT GAME LOGS</p><h3 className="font-bold">{pitcher.name} + {batter.name}</h3></div><div className="text-[10px] font-label-caps"><span className="text-[#00f0ff] mr-4">PITCHER</span><span className="text-[#b9c8de]">BATTER</span></div></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#060e20] text-[#849495]"><tr><th className="p-3">P DATE / OPP</th><th className="p-3">IP</th><th className="p-3">K</th><th className="p-3">ER</th><th className="p-3">B DATE / OPP</th><th className="p-3">AB</th><th className="p-3">H</th><th className="p-3">HR</th></tr></thead><tbody>{rows.map((row: any, i) => <tr key={i} className="border-t border-[#3b494b]/10 hover:bg-[#222a3d]/40"><td className="p-3">{shortDate(row.p?.date)} · {row.p?.opponent ?? '—'}</td><td className="p-3">{row.p?.stat?.inningsPitched ?? '—'}</td><td className="p-3">{row.p?.stat?.strikeOuts ?? '—'}</td><td className="p-3">{row.p?.stat?.earnedRuns ?? '—'}</td><td className="p-3">{shortDate(row.b?.date)} · {row.b?.opponent ?? '—'}</td><td className="p-3">{row.b?.stat?.atBats ?? '—'}</td><td className="p-3">{row.b?.stat?.hits ?? '—'}</td><td className="p-3">{row.b?.stat?.homeRuns ?? '—'}</td></tr>)}</tbody></table></div></div>;
};

const Metric = ({ label, value }: { label: string; value: any }) => <div className="p-3 bg-[#131b2e] rounded-lg border border-[#3b494b]/15"><p className="text-[9px] text-[#849495] font-label-caps">{label}</p><p className="font-data-numeric text-lg mt-1">{value ?? '—'}</p></div>;
const Avatar = ({ id, name, small = false }: { id: number; name: string; small?: boolean }) => <div className={`${small ? 'w-10 h-10' : 'w-24 h-24'} rounded-full bg-[#222a3d] overflow-hidden shrink-0 flex items-center justify-center`}><img src={mlbPlayerHeadshotUrl(id, small ? 96 : 180)} alt={name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /><span className="absolute -z-10">{playerInitials(name)}</span></div>;
const shortDate = (date?: string) => date ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : '—';
