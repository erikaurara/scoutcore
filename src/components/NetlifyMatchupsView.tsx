import React, { useEffect, useMemo, useState } from 'react';
import type { MlbScheduleGame } from '../services/mlbApi';
import { buildPitcherVsTeam, fetchSchedule, fetchTeams, searchMlbPitchers } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl, playerInitials } from '../services/mlbMedia';
import { isFavoritePlayer, isFavoriteTeam, toggleFavoritePlayer, toggleFavoriteTeam } from '../services/favorites';

interface Props { onOpenReport: () => void; }
type Team = { id: number; name: string; abbreviation?: string };
type Pitcher = { id: number; name: string; pitchHand?: string | null; currentTeam?: { id: number; name: string } | null };

export const NetlifyMatchupsView: React.FC<Props> = ({ onOpenReport }) => {
  const [mode, setMode] = useState<'today' | 'custom'>('custom');
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [pitcherQuery, setPitcherQuery] = useState('');
  const [pitcherResults, setPitcherResults] = useState<Pitcher[]>([]);
  const [selectedPitcher, setSelectedPitcher] = useState<Pitcher | null>(null);
  const [custom, setCustom] = useState<any>(null);
  const [selectedBatterId, setSelectedBatterId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, refreshFavorites] = useState(0);

  useEffect(() => {
    Promise.all([fetchSchedule(), fetchTeams()]).then(([g, t]) => {
      setGames(g); setTeams(t); setTeamId(t[0]?.id ?? null);
    }).catch(() => setError('Unable to load MLB data right now.')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (pitcherQuery.trim().length < 2 || selectedPitcher) { setPitcherResults([]); return; }
    const timer = window.setTimeout(() => {
      searchMlbPitchers(pitcherQuery).then(setPitcherResults).catch(() => setPitcherResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [pitcherQuery, selectedPitcher]);

  const selectedBatter = useMemo(() => custom?.batters?.find((b: any) => b.id === selectedBatterId) ?? null, [custom, selectedBatterId]);

  const build = async () => {
    if (!selectedPitcher || !teamId) return;
    setBuilding(true); setError(null); setCustom(null);
    try {
      const data = await buildPitcherVsTeam(selectedPitcher.id, teamId);
      setCustom(data); setSelectedBatterId(data.batters?.[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to build this matchup.');
    } finally { setBuilding(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#0b1326] text-[#849495] p-8">Loading MLB matchups…</div>;

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4 bg-[#131b2e] p-5 rounded-xl border border-[#3b494b]/20">
      <div><span className="text-[10px] text-[#65f2b5] font-label-caps">PITCHER VS BATTER LAB</span><h1 className="font-display-lg text-3xl text-[#dbfcff]">MLB Matchup Intelligence</h1><p className="text-xs text-[#849495] mt-1">Choose any pitcher and any MLB team, then click a batter for the focused PvB view.</p></div>
      <div className="flex gap-2"><button onClick={() => setMode('custom')} className={`px-4 py-2 rounded-lg text-xs font-bold ${mode === 'custom' ? 'bg-[#00f0ff] text-[#002022]' : 'bg-[#222a3d]'}`}>CUSTOM PvB</button><button onClick={() => setMode('today')} className={`px-4 py-2 rounded-lg text-xs font-bold ${mode === 'today' ? 'bg-[#00f0ff] text-[#002022]' : 'bg-[#222a3d]'}`}>TODAY'S GAMES</button></div>
    </div>

    {error && <div className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}

    {mode === 'today' ? <>
      <div className="flex items-center justify-between"><h2 className="font-headline-lg text-2xl font-bold">Today's MLB Games</h2><button onClick={onOpenReport} className="px-4 py-2 rounded-lg bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 text-xs font-bold">SCOUT REPORT</button></div>
      {games.length === 0 ? <div className="p-10 text-center bg-[#171f33] rounded-xl text-[#849495]">No MLB games are scheduled today.</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{games.map(game => <div key={game.gamePk} className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-5"><div className="flex items-center justify-between mb-4"><span className="text-[10px] text-[#00f0ff] font-bold">{game.detailedState}</span><span className="text-[10px] text-[#849495]">GAME {game.gamePk}</span></div><TeamRow team={game.awayTeam} score={game.awayScore} /><div className="my-3 h-px bg-[#3b494b]/20"/><TeamRow team={game.homeTeam} score={game.homeScore} /><div className="mt-4 pt-3 border-t border-[#3b494b]/20 text-[10px] text-[#849495]">{game.awayProbablePitcher?.name ?? 'TBD'} vs {game.homeProbablePitcher?.name ?? 'TBD'}</div></div>)}</div>}
    </> : <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto] gap-4 items-end bg-[#131b2e] rounded-xl border border-[#3b494b]/20 p-5">
        <div className="relative"><label className="text-[10px] text-[#849495] font-label-caps block mb-2">CHOOSE PITCHER</label><input value={selectedPitcher ? selectedPitcher.name : pitcherQuery} onChange={(e) => { setSelectedPitcher(null); setPitcherQuery(e.target.value); }} placeholder="Search Yamamoto, Cole, Skubal..." className="w-full bg-[#171f33] border border-[#3b494b]/40 rounded-lg px-3 py-3 text-sm text-[#dbfcff]" />{pitcherResults.length > 0 && <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg bg-[#171f33] border border-[#3b494b]/40 shadow-xl">{pitcherResults.map(p => <button key={p.id} onClick={() => { setSelectedPitcher(p); setPitcherQuery(p.name); setPitcherResults([]); }} className="w-full px-3 py-3 text-left hover:bg-[#222a3d] flex items-center gap-3"><PlayerPhoto id={p.id} name={p.name}/><div><p className="text-sm font-bold">{p.name}</p><p className="text-[10px] text-[#849495]">{p.pitchHand ? `${p.pitchHand}HP` : 'Pitch hand unavailable'}{p.currentTeam?.name ? ` · ${p.currentTeam.name}` : ''}</p></div></button>)}</div>}</div>
        <div className="pb-3 font-display-lg text-2xl text-[#00f0ff] text-center">VS</div>
        <div><label className="text-[10px] text-[#849495] font-label-caps block mb-2">CHOOSE TEAM</label><select value={teamId ?? ''} onChange={(e) => setTeamId(Number(e.target.value))} className="w-full bg-[#171f33] border border-[#3b494b]/40 rounded-lg px-3 py-3 text-sm text-[#dbfcff]">{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></div>
        <button disabled={!selectedPitcher || !teamId || building} onClick={build} className="px-5 py-3 rounded-lg bg-[#00f0ff] disabled:opacity-40 text-[#002022] font-bold text-xs">{building ? 'BUILDING…' : 'BUILD MATCHUP'}</button>
      </div>

      {custom && <div className="space-y-6"><div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6">
        <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 overflow-hidden"><div className="p-5 border-b border-[#3b494b]/20 flex items-center justify-between"><div className="flex items-center gap-3"><TeamLogo id={custom.team.id} name={custom.team.name}/><div><p className="text-[10px] text-[#849495]">ACTIVE BATTERS</p><h2 className="font-display-lg text-2xl">{custom.team.name}</h2></div></div><button onClick={() => { toggleFavoriteTeam(custom.team); refreshFavorites(v => v + 1); }} className="text-[#ffd166] text-xl">{isFavoriteTeam(custom.team.id) ? '★' : '☆'}</button></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#131b2e] text-[#849495]"><tr><th className="p-3">BATTER</th><th className="p-3">BATS</th><th className="p-3">H</th><th className="p-3">HR</th><th className="p-3">SO</th><th className="p-3">AVG</th><th className="p-3">OPS</th><th className="p-3">★</th></tr></thead><tbody>{custom.batters.map((b: any) => <tr key={b.id} onClick={() => setSelectedBatterId(b.id)} className={`border-t border-[#3b494b]/15 cursor-pointer hover:bg-[#222a3d]/60 ${selectedBatterId === b.id ? 'bg-[#00f0ff]/10' : ''}`}><td className="p-3"><div className="flex items-center gap-2"><PlayerPhoto id={b.id} name={b.name}/><div><p className="font-bold">{b.name}</p><p className="text-[10px] text-[#849495]">{b.position || '—'}</p></div></div></td><td className="p-3">{b.batSide ?? '—'}</td><td className="p-3">{b.stats?.hits ?? '—'}</td><td className="p-3">{b.stats?.homeRuns ?? '—'}</td><td className="p-3">{b.stats?.strikeOuts ?? '—'}</td><td className="p-3">{b.stats?.avg ?? '—'}</td><td className="p-3">{b.stats?.ops ?? '—'}</td><td className="p-3"><button onClick={(e) => { e.stopPropagation(); toggleFavoritePlayer({ id: b.id, name: b.name, teamId: custom.team.id, team: custom.team.name }); refreshFavorites(v => v + 1); }} className="text-[#ffd166] text-lg">{isFavoritePlayer(b.id) ? '★' : '☆'}</button></td></tr>)}</tbody></table></div></div>
        <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-6">{selectedBatter ? <><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4"><PlayerProfile id={custom.pitcher.id} name={custom.pitcher.name} subtitle={`${custom.pitcher.pitchHand ?? '?'}HP · ERA ${custom.pitcher.stats?.era ?? '—'} · WHIP ${custom.pitcher.stats?.whip ?? '—'}`}/><div className="text-center"><p className="font-display-lg text-3xl text-[#00f0ff]">VS</p><p className="text-[9px] text-[#849495]">PITCHER vs BATTER</p></div><PlayerProfile id={selectedBatter.id} name={selectedBatter.name} subtitle={`${selectedBatter.batSide ?? '?'}HB · AVG ${selectedBatter.stats?.avg ?? '—'} · OPS ${selectedBatter.stats?.ops ?? '—'}`}/></div><div className="mt-6 grid grid-cols-2 gap-3"><Metric label="PITCHER HAND" value={`${custom.pitcher.pitchHand ?? '—'}HP`}/><Metric label="BATTER SIDE" value={`${selectedBatter.batSide ?? '—'}HB`}/><Metric label="PITCHER K" value={custom.pitcher.stats?.strikeOuts ?? '—'}/><Metric label="BATTER HITS" value={selectedBatter.stats?.hits ?? '—'}/><Metric label="BATTER HR" value={selectedBatter.stats?.homeRuns ?? '—'}/><Metric label="BATTER SO" value={selectedBatter.stats?.strikeOuts ?? '—'}/></div></> : <div className="py-12 text-center text-[#849495]">Choose a batter from the list.</div>}</div>
      </div>
      <div className="bg-[#171f33] rounded-xl border border-[#ffb4ab]/20 overflow-hidden"><div className="px-5 py-4 bg-[#ffb4ab]/5 border-b border-[#ffb4ab]/15 flex justify-between"><div><p className="text-[10px] text-[#ffb4ab]">INJURED LIST</p><h3 className="font-bold">{custom.team.name} unavailable players</h3></div><span className="text-[#ffb4ab] text-xl">{custom.injuredList?.length ?? 0}</span></div>{custom.injuredList?.length ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">{custom.injuredList.map((p: any) => <div key={p.id} className="flex items-center gap-3 rounded-lg bg-[#131b2e] p-3"><PlayerPhoto id={p.id} name={p.name}/><div><p className="font-bold text-sm">{p.name}</p><p className="text-[10px] text-[#ffb4ab]">{p.position || '—'} · {p.status}</p></div></div>)}</div> : <div className="p-5 text-sm text-[#849495]">No injured-list entries were returned by MLB for this team.</div>}</div></div>}
    </>}
  </div>;
};

const PlayerPhoto = ({ id, name }: { id?: number; name?: string }) => { const [failed, setFailed] = useState(false); return !id || failed ? <div className="w-10 h-10 rounded-full bg-[#222a3d] flex items-center justify-center text-[10px] text-[#00f0ff]">{playerInitials(name)}</div> : <img src={mlbPlayerHeadshotUrl(id, 120)} onError={() => setFailed(true)} alt={name ?? 'MLB player'} className="w-10 h-10 rounded-full object-cover bg-[#222a3d]"/>; };
const TeamLogo = ({ id, name }: { id?: number; name: string }) => <div className="w-12 h-12 rounded-xl bg-white/95 p-2"><img src={mlbTeamLogoUrl(id)} alt={`${name} logo`} className="w-full h-full object-contain"/></div>;
const TeamRow = ({ team, score }: { team: MlbScheduleGame['awayTeam']; score?: number }) => <div className="flex items-center gap-3"><TeamLogo id={team.id} name={team.name}/><div className="flex-1"><p className="font-bold">{team.name}</p><p className="text-[10px] text-[#849495]">{team.abbreviation ?? ''}</p></div><span className="text-2xl font-bold">{score ?? '—'}</span></div>;
const PlayerProfile = ({ id, name, subtitle }: { id?: number; name: string; subtitle: string }) => <div className="text-center flex flex-col items-center"><PlayerPhoto id={id} name={name}/><h3 className="mt-2 font-bold">{name}</h3><p className="text-[10px] text-[#849495] mt-1">{subtitle}</p></div>;
const Metric = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="bg-[#131b2e] rounded-lg p-3"><span className="text-[9px] text-[#849495]">{label}</span><p className="text-xl font-bold mt-1">{value}</p></div>;
