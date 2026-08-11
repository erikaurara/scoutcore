import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPitcherVsTeam,
  fetchBatterPitchTypeProfile,
  fetchPlayerHittingHandSplits,
  fetchPlayerRecentGameLogs,
  fetchRecentPitchProfile,
  fetchTeamPitchers,
  fetchTeams,
  searchMlbPitchers,
} from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

type SavedGame = {
  gamePk: number;
  awayTeam: any;
  homeTeam: any;
  awayProbablePitcher?: any;
  homeProbablePitcher?: any;
};

type GameSide = 'away' | 'home';

export const CinematicMatchupViewV2: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [pitcherTeamId, setPitcherTeamId] = useState<number | null>(null);
  const [opponentTeamId, setOpponentTeamId] = useState<number | null>(null);
  const [teamPitchers, setTeamPitchers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [pitcherResults, setPitcherResults] = useState<any[]>([]);
  const [pitcher, setPitcher] = useState<any | null>(null);
  const [matchup, setMatchup] = useState<any | null>(null);
  const [batterId, setBatterId] = useState<number | null>(null);
  const [pitchProfile, setPitchProfile] = useState<any[]>([]);
  const [batterPitchProfile, setBatterPitchProfile] = useState<any[]>([]);
  const [splits, setSplits] = useState<any | null>(null);
  const [pitcherLogs, setPitcherLogs] = useState<any[]>([]);
  const [batterLogs, setBatterLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<SavedGame | null>(null);
  const [gameSide, setGameSide] = useState<GameSide>('away');
  const autoLoadedGame = useRef<number | null>(null);

  useEffect(() => { fetchTeams().then((data) => { setTeams(data); setPitcherTeamId(data[0]?.id ?? null); setOpponentTeamId(data[1]?.id ?? data[0]?.id ?? null); }).catch(() => setError('Unable to load MLB teams.')); }, []);
  useEffect(() => { if (!pitcherTeamId) return; setTeamPitchers([]); fetchTeamPitchers(pitcherTeamId).then(setTeamPitchers).catch(() => setTeamPitchers([])); }, [pitcherTeamId]);
  useEffect(() => { if (query.trim().length < 2 || pitcher) { setPitcherResults([]); return; } const timer = window.setTimeout(() => searchMlbPitchers(query).then(setPitcherResults).catch(() => setPitcherResults([])), 250); return () => window.clearTimeout(timer); }, [query, pitcher]);

  const loadGameSide = async (saved: SavedGame, side: GameSide) => {
    const chosen = side === 'away'
      ? { pitcher: saved.awayProbablePitcher, pitcherTeam: saved.awayTeam, opponent: saved.homeTeam }
      : { pitcher: saved.homeProbablePitcher, pitcherTeam: saved.homeTeam, opponent: saved.awayTeam };
    if (!chosen.pitcher?.id || !chosen.pitcherTeam?.id || !chosen.opponent?.id) {
      setError(`${side === 'away' ? saved.awayTeam?.name : saved.homeTeam?.name} probable starter is not available yet.`);
      return;
    }
    setGameSide(side);
    setPitcherTeamId(chosen.pitcherTeam.id);
    setOpponentTeamId(chosen.opponent.id);
    setPitcher(chosen.pitcher);
    setQuery(chosen.pitcher.name ?? '');
    setBatterId(null);
    setLoading(true);
    setError(null);
    try {
      const [data, profile, logs] = await Promise.all([
        buildPitcherVsTeam(chosen.pitcher.id, chosen.opponent.id),
        fetchRecentPitchProfile(chosen.pitcher.id, 3).catch(() => []),
        fetchPlayerRecentGameLogs(chosen.pitcher.id, 'pitching', 10).catch(() => []),
      ]);
      setMatchup(data);
      setPitchProfile(profile);
      setPitcherLogs(logs);
      if (data?.batters?.[0]?.id) setBatterId(data.batters[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to analyze matchup.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!teams.length || loading) return;
    let saved:SavedGame | null = null;
    try { const raw = window.sessionStorage.getItem('scoutcore:selected-game'); if (raw) saved = JSON.parse(raw); } catch {}
    if (!saved?.gamePk || autoLoadedGame.current === saved.gamePk) return;
    autoLoadedGame.current = saved.gamePk;
    setSelectedGame(saved);
    const initialSide: GameSide = saved.awayProbablePitcher?.id ? 'away' : 'home';
    loadGameSide(saved, initialSide);
  }, [teams]);

  const selectedBatter = useMemo(() => matchup?.batters?.find((b: any) => b.id === batterId) ?? null, [matchup, batterId]);
  const build = async () => { if (!pitcher || !opponentTeamId) return; setSelectedGame(null); setLoading(true); setError(null); setBatterId(null); try { const data = await buildPitcherVsTeam(pitcher.id, opponentTeamId); setMatchup(data); const [profile, logs] = await Promise.all([fetchRecentPitchProfile(pitcher.id, 3).catch(() => []), fetchPlayerRecentGameLogs(pitcher.id, 'pitching', 10).catch(() => [])]); setPitchProfile(profile); setPitcherLogs(logs); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to analyze matchup.'); } finally { setLoading(false); } };
  useEffect(() => { if (!batterId) { setSplits(null); setBatterLogs([]); setBatterPitchProfile([]); return; } Promise.all([fetchPlayerHittingHandSplits(batterId).catch(() => null), fetchPlayerRecentGameLogs(batterId, 'hitting', 10).catch(() => []), fetchBatterPitchTypeProfile(batterId, 8).catch(() => [])]).then(([nextSplits, nextLogs, nextPitchProfile]) => { setSplits(nextSplits); setBatterLogs(nextLogs); setBatterPitchProfile(nextPitchProfile); }); }, [batterId]);
  const advantage = selectedBatter ? calcAdvantage(matchup?.pitcher, selectedBatter, splits) : null;

  return <div className="min-h-screen bg-[#08111f] text-[#dae2fd] p-6 lg:p-8 space-y-5">
    {selectedGame && <section className="bg-[#10192b] border border-[#54dce9]/30 rounded-xl p-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3"><img src={mlbTeamLogoUrl(selectedGame.awayTeam.id)} alt="" className="w-10 h-10 object-contain"/><div><p className="font-label-caps text-[9px] text-[#849495]">GAME MATCHUP</p><p className="font-bold text-sm">{selectedGame.awayTeam.name} vs {selectedGame.homeTeam.name}</p></div><img src={mlbTeamLogoUrl(selectedGame.homeTeam.id)} alt="" className="w-10 h-10 object-contain"/></div>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={!selectedGame.awayProbablePitcher?.id || loading} onClick={() => loadGameSide(selectedGame,'away')} className={`px-4 py-2.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${gameSide==='away'?'bg-[#54dce9] text-[#07151c] border-[#54dce9]':'bg-[#151f33] border-[#30415c] text-[#dae2fd] hover:border-[#54dce9]'} disabled:opacity-40`}><span>{selectedGame.awayProbablePitcher?.name ?? 'Away starter TBD'}</span><span className="opacity-70">vs {selectedGame.homeTeam.abbreviation ?? selectedGame.homeTeam.name}</span></button>
          <button type="button" disabled={loading || !selectedGame.awayProbablePitcher?.id || !selectedGame.homeProbablePitcher?.id} onClick={() => loadGameSide(selectedGame, gameSide==='away'?'home':'away')} className="w-10 h-10 rounded-lg border border-[#54dce9]/40 text-[#54dce9] bg-[#151f33] hover:bg-[#54dce9]/10 disabled:opacity-40" aria-label="Switch starting pitcher">⇄</button>
          <button disabled={!selectedGame.homeProbablePitcher?.id || loading} onClick={() => loadGameSide(selectedGame,'home')} className={`px-4 py-2.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${gameSide==='home'?'bg-[#65f2b5] text-[#07151c] border-[#65f2b5]':'bg-[#151f33] border-[#30415c] text-[#dae2fd] hover:border-[#65f2b5]'} disabled:opacity-40`}><span>{selectedGame.homeProbablePitcher?.name ?? 'Home starter TBD'}</span><span className="opacity-70">vs {selectedGame.awayTeam.abbreviation ?? selectedGame.awayTeam.name}</span></button>
        </div>
      </div>
    </section>}

    <section className="bg-[#10192b] border border-[#26364e] rounded-xl p-5"><div className="flex flex-col 2xl:flex-row 2xl:items-end gap-5"><div className="2xl:min-w-[270px]"><p className="font-label-caps text-[10px] text-[#54dce9]">PITCHER VS BATTER</p><h1 className="font-display-lg text-3xl mt-1">Matchup Intelligence</h1></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.25fr_auto_1fr_auto] gap-3 items-end flex-1">
      <div><label className="text-[9px] text-[#849495] font-label-caps">PITCHER TEAM</label><select className="mt-2 w-full bg-[#151f33] border border-[#30415c] rounded-md px-3 py-2.5 text-sm" value={pitcherTeamId ?? ''} onChange={(e) => { setSelectedGame(null); setPitcherTeamId(Number(e.target.value)); setPitcher(null); setQuery(''); }}><option value="">Choose team</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <div><label className="text-[9px] text-[#849495] font-label-caps">PITCHER</label><select className="mt-2 w-full bg-[#151f33] border border-[#30415c] rounded-md px-3 py-2.5 text-sm" value={pitcher?.id ?? ''} onChange={(e) => { setSelectedGame(null); const p = teamPitchers.find(x => x.id === Number(e.target.value)); setPitcher(p ?? null); setQuery(p?.name ?? ''); }}><option value="">Choose pitcher</option>{teamPitchers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="relative"><label className="text-[9px] text-[#849495] font-label-caps">OR SEARCH ANY PITCHER</label><input className="mt-2 w-full bg-[#151f33] border border-[#30415c] rounded-md px-3 py-2.5 text-sm" value={pitcher ? pitcher.name : query} onChange={(e) => { setSelectedGame(null); setPitcher(null); setQuery(e.target.value); }} placeholder="Search Yamamoto, Sasaki, Cole..." />{pitcherResults.length > 0 && <div className="absolute z-50 w-full mt-1 max-h-72 overflow-auto bg-[#10192b] border border-[#30415c] rounded-lg shadow-2xl">{pitcherResults.map((p) => <button key={p.id} onClick={() => { setSelectedGame(null); setPitcher(p); setQuery(p.name); setPitcherResults([]); }} className="w-full px-3 py-2.5 text-left hover:bg-[#17243a] flex items-center gap-3 border-b border-[#26364e]/40 last:border-b-0"><Headshot id={p.id} name={p.name} small /><div className="min-w-0"><p className="font-bold text-sm truncate">{p.name}</p><p className="text-[10px] text-[#849495]">{p.pitchHand ? `${p.pitchHand}HP` : 'Pitcher'}{p.currentTeam?.name ? ` · ${p.currentTeam.name}` : ''}</p></div></button>)}</div>}</div>
      <span className="pb-3 text-[#54dce9] font-bold hidden xl:block">VS</span><div><label className="text-[9px] text-[#849495] font-label-caps">OPPONENT TEAM</label><select className="mt-2 w-full bg-[#151f33] border border-[#30415c] rounded-md px-3 py-2.5 text-sm" value={opponentTeamId ?? ''} onChange={(e) => { setSelectedGame(null); setOpponentTeamId(Number(e.target.value)); }}>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <button onClick={build} disabled={!pitcher || !opponentTeamId || loading} className="px-5 py-3 bg-[#56dce9] text-[#07151c] rounded-md text-xs font-bold disabled:opacity-40">{loading ? 'ANALYZING…' : 'ANALYZE'}</button>
    </div></div></section>
    {error && <div className="p-4 rounded-lg border border-[#ff8d8d]/30 bg-[#ff8d8d]/10 text-[#ffb4ab] text-sm">{error}</div>}
    {matchup && !selectedBatter && <BatterPicker matchup={matchup} onChoose={setBatterId} />}
    {matchup && selectedBatter && <>
      <section className="grid grid-cols-1 xl:grid-cols-[1fr_230px_1fr] gap-5 items-stretch"><PlayerPanel type="pitcher" player={matchup.pitcher} profile={pitchProfile} /><CenterAdvantage pitcher={matchup.pitcher} batter={selectedBatter} value={advantage} /><PlayerPanel type="batter" player={selectedBatter} profile={batterPitchProfile} splits={splits} /></section>
      <section className="grid grid-cols-1 xl:grid-cols-[1.35fr_.9fr] gap-5 items-start"><VerticalBatters matchup={matchup} selected={batterId} onChoose={setBatterId} /><PitcherContext pitcher={matchup.pitcher} pitcherLogs={pitcherLogs} batters={matchup.batters} onChoose={setBatterId} /></section>
      <CombinedGameLog pitcher={matchup.pitcher} batter={selectedBatter} pitcherLogs={pitcherLogs} batterLogs={batterLogs} />
      <InjuredList matchup={matchup} />
    </>}
  </div>;
};

const BatterPicker = ({ matchup, onChoose }: any) => <section className="bg-[#10192b] border border-[#26364e] rounded-xl overflow-hidden"><div className="p-4 flex items-center gap-3 border-b border-[#26364e]"><div className="w-12 h-12 bg-white rounded-md p-1.5"><img src={mlbTeamLogoUrl(matchup.team.id)} alt={matchup.team.name} className="w-full h-full object-contain" /></div><div><p className="text-[9px] text-[#849495] font-label-caps">CHOOSE A BATTER</p><h2 className="font-display-lg text-xl">{matchup.team.name}</h2></div></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3">{matchup.batters.map((b: any) => <button key={b.id} onClick={() => onChoose(b.id)} className="flex items-center gap-3 p-3 rounded-lg bg-[#151f33] border border-[#26364e] hover:border-[#54dce9]/50 text-left"><Headshot id={b.id} name={b.name} small /><div className="min-w-0 flex-1"><p className="font-bold text-sm truncate">{b.name}</p><p className="text-[10px] text-[#54dce9]">{b.batSide ?? '?'}HB · {b.position || '—'}</p></div><div className="text-right"><p className="font-data-numeric text-sm">{b.stats?.ops ?? '—'}</p><p className="text-[8px] text-[#849495]">OPS</p></div></button>)}</div></section>;
const PlayerPanel = ({ type, player, profile, splits }: any) => { const pitcher = type === 'pitcher'; const s = player.stats ?? {}; return <section className={`bg-[#151f33] rounded-lg border border-[#26364e] ${pitcher ? 'border-l-2 border-l-[#54dce9]' : 'border-r-2 border-r-[#cbd7ef]'} p-5 min-h-[470px]`}><div className="flex items-start gap-4"><Headshot id={player.id} name={player.name} /><div className="min-w-0 flex-1"><p className="font-label-caps text-[9px] text-[#54dce9]">{pitcher ? 'STARTING PITCHER' : 'SELECTED BATTER'}</p><h2 className="font-display-lg text-3xl leading-none mt-2">{player.name}</h2><p className="text-xl font-light tracking-wide text-[#54dce9] mt-2">{pitcher ? `${player.pitchHand ?? '?'}HP` : `${player.batSide ?? '?'}HB`} <span className="text-xs text-[#849495] ml-2">{pitcher ? '' : player.position ?? ''}</span></p></div></div>{pitcher ? <><div className="grid grid-cols-3 gap-3 mt-7"><Data label="ERA" value={s.era} /><Data label="WHIP" value={s.whip} /><Data label="K/9" value={s.strikeoutsPer9Inn} /></div><PitchArsenal profile={profile} /><p className="mt-6 text-xs leading-relaxed text-[#aab8ce]">{pitcherScout(player, profile)}</p></> : <><div className="grid grid-cols-5 gap-2 mt-7"><Data label="AVG" value={s.avg}/><Data label="HR" value={s.homeRuns}/><Data label="RBI" value={s.rbi}/><Data label="SB" value={s.stolenBases}/><Data label="OPS" value={s.ops}/></div><BatterPitchProfile profile={profile}/><p className="mt-6 text-xs leading-relaxed text-[#aab8ce]">{batterScout(player, splits, profile)}</p></>}</section>; };
const PitchArsenal = ({ profile }: any) => <div className="mt-6"><p className="font-label-caps text-[9px] text-[#54dce9]">PITCH ARSENAL</p><div className="mt-3 space-y-2">{profile?.slice(0,5).map((p:any) => <div key={p.code} className="grid grid-cols-[120px_1fr_62px] gap-2 items-center text-xs"><span className="truncate">{p.name}</span><div className="h-2 bg-[#25344c] rounded-full overflow-hidden"><div className="h-full bg-[#54dce9] rounded-full" style={{width:`${Math.max(10,Math.min(100,p.usagePct))}%`}} /></div><span className="text-right text-[#b9c8de]">{p.avgVelo?.toFixed?.(1) ?? '—'} mph</span></div>)}</div></div>;
const BatterPitchProfile = ({ profile }: any) => <div className="mt-6"><div className="flex justify-between"><p className="font-label-caps text-[9px] text-[#54dce9]">PITCH-TYPE HITTING PROFILE</p><p className="text-[8px] text-[#849495]">AVG · SLG</p></div><div className="mt-3 space-y-2">{profile?.length ? profile.slice(0,5).map((p:any) => { const score = p.slg == null ? 15 : Math.max(10,Math.min(100,p.slg*65)); return <div key={p.code} className="grid grid-cols-[120px_1fr_88px] gap-2 items-center text-xs"><span className="truncate">{p.name}</span><div className="h-2 bg-[#25344c] rounded-full overflow-hidden"><div className="h-full bg-[#54dce9] rounded-full" style={{width:`${score}%`}} /></div><span className="text-right text-[#b9c8de]">{fmt3(p.avg)} · {fmt3(p.slg)}</span></div>}) : <p className="text-xs text-[#849495]">Not enough recent pitch-type plate appearances yet.</p>}</div></div>;
const CenterAdvantage = ({ pitcher, batter, value }: any) => <section className="flex flex-col items-center justify-center text-center px-2"><p className="font-label-caps text-[9px] text-[#849495]">ADVANTAGE</p><div className="relative w-32 h-32 mt-4 rounded-full flex items-center justify-center"><div className="absolute inset-0 rounded-full border-[5px] border-[#26364e]"/><div className="absolute inset-0 rounded-full border-[5px] border-transparent border-t-[#54dce9] border-r-[#54dce9] animate-spin [animation-duration:5s]"/><div><div className="font-data-numeric text-4xl">{value ?? 50}%</div><div className="text-[8px] text-[#54dce9] font-label-caps">{(value ?? 50)>=50?'PITCHER':'BATTER'}</div></div></div><span className="material-symbols-outlined text-[#54dce9] mt-5">swap_horiz</span><div className="mt-6"><p className="font-label-caps text-[8px] text-[#849495]">KEY FACTOR</p><p className="text-xs text-[#aab8ce] mt-2 leading-relaxed">{pitcher.pitchHand ?? '?'}HP vs {batter.batSide ?? '?'}HB. Handedness splits, current production and the pitcher’s run-prevention profile shape this matchup index.</p></div></section>;

const VerticalBatters = ({ matchup, selected, onChoose }: any) => {
  const hasLineupOrder = (matchup?.batters ?? []).some((b:any) => Number(b?.battingOrder) > 0);
  const ordered = [...(matchup?.batters ?? [])].sort((a:any,b:any) => {
    if (!hasLineupOrder) return 0;
    const ao = Number(a?.battingOrder) || 9999;
    const bo = Number(b?.battingOrder) || 9999;
    return ao - bo;
  }).slice(0, hasLineupOrder ? 9 : undefined);
  return <section className="bg-[#10192b] border border-[#26364e] rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-[#26364e] flex items-center justify-between"><div><p className="font-label-caps text-[9px] text-[#54dce9]">{hasLineupOrder ? 'CONFIRMED / LISTED LINEUP' : 'MATCHUP BATTERS'}</p><h3 className="font-bold text-sm">{matchup.team.name}</h3></div><span className="text-[10px] text-[#849495]">Click a hitter to compare</span></div>
    <div>{ordered.map((b:any,index:number) => <button key={b.id} onClick={() => onChoose(b.id)} className={`w-full grid grid-cols-[34px_52px_1fr_56px_56px_56px_64px] items-center gap-3 px-4 py-3 text-left border-t border-[#26364e]/50 first:border-t-0 ${selected===b.id?'bg-[#163348] border-l-2 border-l-[#54dce9]':'hover:bg-[#151f33]'}`}><span className="font-data-numeric text-sm text-[#849495]">{hasLineupOrder ? (Number(b.battingOrder) >= 100 ? Math.floor(Number(b.battingOrder)/100) : b.battingOrder) : index+1}</span><Headshot id={b.id} name={b.name} small/><div className="min-w-0"><p className="font-bold text-sm truncate">{b.name}</p><p className="text-[10px] text-[#849495]">{b.position || '—'} · <span className="text-[#54dce9]">{b.batSide ?? '?'}HB</span></p></div><MiniStat label="H" value={b.stats?.hits}/><MiniStat label="HR" value={b.stats?.homeRuns}/><MiniStat label="SO" value={b.stats?.strikeOuts}/><MiniStat label="OPS" value={b.stats?.ops}/></button>)}</div>
  </section>;
};

const PitcherContext = ({ pitcher, pitcherLogs, batters, onChoose }: any) => {
  const s = pitcher?.stats ?? {};
  const rows = (pitcherLogs ?? []).slice(0,3);
  const validBatters = (batters ?? []).filter((b:any) => b?.id);
  const topHitters = [...validBatters].sort((a:any,b:any) => (Number(b.stats?.ops) || 0) - (Number(a.stats?.ops) || 0)).slice(0,3);
  const powerThreats = [...validBatters].sort((a:any,b:any) => (Number(b.stats?.homeRuns) || 0) - (Number(a.stats?.homeRuns) || 0)).slice(0,3);
  const strikeoutProne = [...validBatters].sort((a:any,b:any) => (Number(b.stats?.strikeOuts) || 0) - (Number(a.stats?.strikeOuts) || 0)).slice(0,3);
  const avgOps = avgNumber(validBatters.map((b:any) => Number(b.stats?.ops)));
  const totalHr = validBatters.reduce((sum:number,b:any) => sum + (Number(b.stats?.homeRuns) || 0), 0);
  const totalSo = validBatters.reduce((sum:number,b:any) => sum + (Number(b.stats?.strikeOuts) || 0), 0);
  return <div className="space-y-4">
    <section className="bg-[#10192b] border border-[#26364e] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#26364e]"><p className="font-label-caps text-[9px] text-[#54dce9]">TOP MATCHUP SNAPSHOT</p><p className="text-[10px] text-[#849495] mt-1">Quick hitter threats vs {pitcher?.pitchHand ?? '?'}HP {pitcher?.name ?? ''}</p></div>
      <div className="divide-y divide-[#26364e]/60">
        <SnapshotRow label="TOP HITTERS" players={topHitters} stat={(b:any) => `${b.stats?.ops ?? '—'} OPS`} onChoose={onChoose}/>
        <SnapshotRow label="POWER THREAT" players={powerThreats} stat={(b:any) => `${b.stats?.homeRuns ?? '—'} HR`} onChoose={onChoose}/>
        <SnapshotRow label="STRIKEOUT PRONE" players={strikeoutProne} stat={(b:any) => `${b.stats?.strikeOuts ?? '—'} SO`} onChoose={onChoose}/>
      </div>
    </section>
    <section className="bg-[#10192b] border border-[#26364e] rounded-xl p-4"><p className="font-label-caps text-[9px] text-[#54dce9]">PITCHER VS LINEUP SUMMARY</p><div className="grid grid-cols-3 gap-2 mt-3"><Data label="LINEUP OPS" value={avgOps == null ? '—' : fmt3(avgOps)}/><Data label="LINEUP HR" value={totalHr}/><Data label="LINEUP SO" value={totalSo}/></div></section>
    <section className="bg-[#10192b] border border-[#26364e] rounded-xl p-4"><p className="font-label-caps text-[9px] text-[#54dce9]">{String(pitcher?.name ?? 'Pitcher').toUpperCase()} — SEASON</p><div className="grid grid-cols-4 gap-2 mt-3"><Data label="ERA" value={s.era}/><Data label="WHIP" value={s.whip}/><Data label="K/9" value={s.strikeoutsPer9Inn}/><Data label="IP" value={s.inningsPitched}/></div></section>
    <section className="bg-[#10192b] border border-[#26364e] rounded-xl overflow-hidden"><div className="px-4 py-3 border-b border-[#26364e]"><p className="font-label-caps text-[9px] text-[#54dce9]">{String(pitcher?.name ?? 'Pitcher').toUpperCase()} — LAST 3 STARTS</p></div>{rows.length ? <div>{rows.map((x:any,i:number)=><div key={i} className="grid grid-cols-[74px_1fr_42px_42px_42px_42px] gap-2 items-center px-4 py-3 border-t border-[#26364e]/50 first:border-t-0 text-xs"><span className="text-[#849495]">{shortDate(x.date)}</span><span className="truncate">{x.opponent ?? '—'}</span><span className="text-center">{x.stat?.inningsPitched ?? '—'}<small className="block text-[7px] text-[#849495]">IP</small></span><span className="text-center">{x.stat?.earnedRuns ?? '—'}<small className="block text-[7px] text-[#849495]">ER</small></span><span className="text-center">{x.stat?.baseOnBalls ?? '—'}<small className="block text-[7px] text-[#849495]">BB</small></span><span className="text-center text-[#54dce9]">{x.stat?.strikeOuts ?? '—'}<small className="block text-[7px] text-[#849495]">K</small></span></div>)}</div> : <p className="p-4 text-xs text-[#849495]">Recent starts are not available yet.</p>}</section>
  </div>;
};

const SnapshotRow = ({ label, players, stat, onChoose }: any) => <div className="px-4 py-3 grid grid-cols-[112px_1fr] gap-3 items-start"><p className="text-[10px] font-bold text-[#dae2fd] pt-1">{label}</p><div className="flex flex-wrap gap-2">{players?.length ? players.map((b:any) => <button key={`${label}-${b.id}`} onClick={() => onChoose?.(b.id)} className="flex items-center gap-2 rounded-lg bg-[#151f33] border border-[#26364e] px-2.5 py-2 hover:border-[#54dce9]/60"><Headshot id={b.id} name={b.name} small/><span className="text-left"><span className="block text-xs font-bold max-w-[110px] truncate">{b.name}</span><span className="block text-[9px] text-[#54dce9]">{stat(b)}</span></span></button>) : <span className="text-xs text-[#849495]">No hitter data available.</span>}</div></div>;

const CombinedGameLog = ({ pitcher, batter, pitcherLogs, batterLogs }: any) => { const [tab,setTab]=useState<'pitcher'|'batter'>('batter'); const logs=tab==='pitcher'?pitcherLogs:batterLogs; return <section className="bg-[#10192b] border border-[#26364e] rounded-xl overflow-hidden"><div className="p-4 border-b border-[#26364e] flex flex-wrap items-center justify-between gap-3"><div><p className="font-label-caps text-[9px] text-[#54dce9]">RECENT GAME LOG</p><h3 className="font-bold text-sm">Last 10 games</h3></div><div className="flex gap-2"><button onClick={()=>setTab('pitcher')} className={`px-3 py-1.5 rounded-md text-xs ${tab==='pitcher'?'bg-[#54dce9] text-[#07151c]':'bg-[#151f33]'}`}>{pitcher.name}</button><button onClick={()=>setTab('batter')} className={`px-3 py-1.5 rounded-md text-xs ${tab==='batter'?'bg-[#54dce9] text-[#07151c]':'bg-[#151f33]'}`}>{batter.name}</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-xs"><thead className="bg-[#08111f] text-[#849495]"><tr><th className="p-3 text-left">DATE</th><th className="text-left">OPP</th>{tab==='pitcher'?<><th>IP</th><th>H</th><th>ER</th><th>BB</th><th>K</th></>:<><th>AB</th><th>R</th><th>H</th><th>HR</th><th>RBI</th><th>BB</th><th>SO</th></>}</tr></thead><tbody>{logs.map((x:any,i:number)=><tr key={i} className="border-t border-[#26364e]/50"><td className="p-3">{shortDate(x.date)}</td><td>{x.opponent ?? '—'}</td>{tab==='pitcher'?<><td className="text-center">{x.stat?.inningsPitched ?? '—'}</td><td className="text-center">{x.stat?.hits ?? '—'}</td><td className="text-center">{x.stat?.earnedRuns ?? '—'}</td><td className="text-center">{x.stat?.baseOnBalls ?? '—'}</td><td className="text-center">{x.stat?.strikeOuts ?? '—'}</td></>:<><td className="text-center">{x.stat?.atBats ?? '—'}</td><td className="text-center">{x.stat?.runs ?? '—'}</td><td className="text-center">{x.stat?.hits ?? '—'}</td><td className="text-center">{x.stat?.homeRuns ?? '—'}</td><td className="text-center">{x.stat?.rbi ?? '—'}</td><td className="text-center">{x.stat?.baseOnBalls ?? '—'}</td><td className="text-center">{x.stat?.strikeOuts ?? '—'}</td></>}</tr>)}</tbody></table></div></section>; };
const InjuredList = ({ matchup }: any) => <section className="bg-[#10192b] border border-[#26364e] rounded-xl overflow-hidden"><div className="p-4 border-b border-[#26364e] flex items-center justify-between"><div><p className="font-label-caps text-[9px] text-[#54dce9]">INJURED LIST</p><h3 className="font-bold text-sm">{matchup.team.name}</h3></div><span className="text-[10px] text-[#849495]">Bottom of matchup report</span></div>{matchup.injuredList?.length ? <div className="flex gap-3 overflow-x-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{matchup.injuredList.map((p:any)=><div key={p.id} className="min-w-[190px] flex items-center gap-3 p-3 rounded-lg bg-[#151f33] border border-[#26364e]"><Headshot id={p.id} name={p.name} small/><div className="min-w-0"><p className="font-bold text-xs truncate">{p.name}</p><p className="text-[9px] text-[#849495]">{p.position || '—'}</p><p className="text-[9px] text-[#54dce9] mt-1 truncate">{p.status}</p></div></div>)}</div> : <div className="p-5 text-xs text-[#849495]">No injured-list players returned for this team.</div>}</section>;
const Data = ({label,value}:any) => <div className="bg-[#111a2c] p-3 rounded-md"><p className="font-label-caps text-[8px] text-[#849495]">{label}</p><p className="font-data-numeric text-lg mt-2">{value ?? '—'}</p><div className="h-0.5 w-8 bg-[#54dce9] mt-2"/></div>;
const MiniStat = ({label,value}:any) => <div className="text-center"><p className="font-data-numeric text-sm text-[#eef4ff]">{value ?? '—'}</p><p className="text-[8px] text-[#849495]">{label}</p></div>;
const Headshot = ({id,name,small=false}:any) => <div className={`${small?'w-11 h-11':'w-24 h-24'} rounded-md bg-[#202b3f] overflow-hidden shrink-0 border border-[#30415c]`}><img src={mlbPlayerHeadshotUrl(id,small?120:260)} alt={name} className="w-full h-full object-contain"/></div>;
const pitcherScout = (p:any,profile:any[]) => { const s=p.stats??{}; const top=profile?.[0]; return top ? `${p.name} works primarily off the ${top.name}, averaging ${top.avgVelo?.toFixed?.(1) ?? '—'} mph in recent tracked outings with ${top.usagePct?.toFixed?.(0) ?? '—'}% usage. His 2026 profile is ${s.era ?? '—'} ERA, ${s.whip ?? '—'} WHIP and ${s.strikeoutsPer9Inn ?? '—'} K/9.` : `${p.name}'s recent tracked pitch profile is not available yet.`; };
const batterScout = (p:any,splits:any,profile:any[]) => { const side=p.batSide==='L'?'left-handed':p.batSide==='R'?'right-handed':p.batSide==='S'?'switch':''; const best=[...(profile??[])].filter((x:any)=>x.slg!=null).sort((a:any,b:any)=>b.slg-a.slg)[0]; const split = splits?.vsLeft?.ops && splits?.vsRight?.ops ? ` His OPS is ${splits.vsLeft.ops} vs LHP and ${splits.vsRight.ops} vs RHP.` : ''; const pitch = best ? ` Recent tracked results have been strongest against ${best.name} (${fmt3(best.avg)} AVG / ${fmt3(best.slg)} SLG in this sample).` : ''; return `${p.name} is a ${side} hitter.${split}${pitch}`; };
const calcAdvantage = (pitcher:any,batter:any,splits:any) => { const era=Number(pitcher?.stats?.era||4.2), whip=Number(pitcher?.stats?.whip||1.3), ops=Number(batter?.stats?.ops||.700); const split=pitcher?.pitchHand==='L'?Number(splits?.vsLeft?.ops||ops):Number(splits?.vsRight?.ops||ops); return Math.round(Math.max(28,Math.min(72,50+(4.2-era)*3+(1.3-whip)*8+(.720-split)*25))); };
const avgNumber=(values:number[])=>{const nums=values.filter(v=>Number.isFinite(v));return nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:null;};
const shortDate=(date?:string)=>date?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${date}T12:00:00Z`)):'—';
const fmt3=(v:any)=>Number.isFinite(Number(v))?Number(v).toFixed(3).replace(/^0/,''):'—';
