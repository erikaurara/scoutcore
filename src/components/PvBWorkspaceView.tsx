import React, { useEffect, useMemo, useState } from 'react';
import {
  buildPitcherVsTeam,
  fetchBatterPitchTypeProfile,
  fetchPlayerHittingHandSplits,
  fetchPlayerRecentGameLogs,
  fetchRecentPitchProfile,
  fetchTeamPitchers,
  fetchTeams,
} from '../services/mlbClient';
import { mlbPlayerHeadshotUrl } from '../services/mlbMedia';

export const PvBWorkspaceView: React.FC = () => {
  const [teams,setTeams]=useState<any[]>([]);
  const [pitcherTeamId,setPitcherTeamId]=useState<number|null>(null);
  const [opponentTeamId,setOpponentTeamId]=useState<number|null>(null);
  const [teamPitchers,setTeamPitchers]=useState<any[]>([]);
  const [pitcher,setPitcher]=useState<any|null>(null);
  const [matchup,setMatchup]=useState<any|null>(null);
  const [batterId,setBatterId]=useState<number|null>(null);
  const [pitchProfile,setPitchProfile]=useState<any[]>([]);
  const [batterPitchProfile,setBatterPitchProfile]=useState<any[]>([]);
  const [splits,setSplits]=useState<any|null>(null);
  const [pitcherLogs,setPitcherLogs]=useState<any[]>([]);
  const [batterLogs,setBatterLogs]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{fetchTeams().then((d)=>{setTeams(d);setPitcherTeamId(d[0]?.id??null);setOpponentTeamId(d[1]?.id??d[0]?.id??null);}).catch(()=>setError('Unable to load MLB teams.'));},[]);
  useEffect(()=>{if(!pitcherTeamId)return;setPitcher(null);setTeamPitchers([]);fetchTeamPitchers(pitcherTeamId).then((p)=>{setTeamPitchers(p);setPitcher(p[0]??null);}).catch(()=>setTeamPitchers([]));},[pitcherTeamId]);

  const analyze=async()=>{if(!pitcher||!opponentTeamId)return;setLoading(true);setError(null);try{const [m,p,l]=await Promise.all([buildPitcherVsTeam(pitcher.id,opponentTeamId),fetchRecentPitchProfile(pitcher.id,3).catch(()=>[]),fetchPlayerRecentGameLogs(pitcher.id,'pitching',30).catch(()=>[])]);setMatchup(m);setPitchProfile(p);setPitcherLogs(l);setBatterId(m?.batters?.[0]?.id??null);}catch(e){setError(e instanceof Error?e.message:'Unable to analyze matchup.');}finally{setLoading(false);}};

  const selectedBatter=useMemo(()=>matchup?.batters?.find((b:any)=>b.id===batterId)??null,[matchup,batterId]);
  useEffect(()=>{if(!batterId){setSplits(null);setBatterPitchProfile([]);setBatterLogs([]);return;}Promise.all([fetchPlayerHittingHandSplits(batterId).catch(()=>null),fetchBatterPitchTypeProfile(batterId,8).catch(()=>[]),fetchPlayerRecentGameLogs(batterId,'hitting',30).catch(()=>[])]).then(([s,p,l])=>{setSplits(s);setBatterPitchProfile(p);setBatterLogs(l);});},[batterId]);

  const advantage=selectedBatter?calcAdvantage(matchup?.pitcher,selectedBatter,splits):50;
  const topHitters=useMemo(()=>[...(matchup?.batters??[])].sort((a:any,b:any)=>(Number(b.stats?.ops)||0)-(Number(a.stats?.ops)||0)).slice(0,5),[matchup]);

  return <div className="min-h-screen bg-[#08111f] text-[#dae2fd] p-3 sm:p-4 lg:p-5 space-y-3">
    <section className="space-y-2">
      <h1 className="text-xl sm:text-2xl font-bold">Matchup Intelligence</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_.8fr_auto_1fr_auto] gap-3 items-end">
        <Field label="PITCHER TEAM"><select value={pitcherTeamId??''} onChange={e=>setPitcherTeamId(Number(e.target.value))} className="input">{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="PITCHER"><select value={pitcher?.id??''} onChange={e=>setPitcher(teamPitchers.find(p=>p.id===Number(e.target.value))??null)} className="input"><option value="">Choose pitcher</option>{teamPitchers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <div className="hidden xl:flex pb-2 justify-center font-bold">VS</div>
        <Field label="OPPONENT TEAM"><select value={opponentTeamId??''} onChange={e=>setOpponentTeamId(Number(e.target.value))} className="input">{teams.filter(t=>t.id!==pitcherTeamId).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <button onClick={analyze} disabled={!pitcher||!opponentTeamId||loading} className="h-11 px-6 rounded-md bg-[#00dff0] text-[#06131b] font-bold text-sm disabled:opacity-40">{loading?'ANALYZING…':'ANALYZE'}</button>
      </div>
    </section>

    {error&&<div className="rounded-lg border border-[#ff8d8d]/30 bg-[#ff8d8d]/10 text-[#ffb4ab] p-3 text-sm">{error}</div>}

    {matchup&&selectedBatter&&<>
      <section className="grid grid-cols-1 xl:grid-cols-[1fr_180px_1fr] gap-3 items-stretch">
        <PlayerCard type="pitcher" player={matchup.pitcher} profile={pitchProfile}/>
        <Advantage value={advantage} pitcher={matchup.pitcher} batter={selectedBatter}/>
        <PlayerCard type="batter" player={selectedBatter} profile={batterPitchProfile} splits={splits}/>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[.92fr_1.08fr] gap-3 items-stretch">
        <BattersTable matchup={matchup} selected={batterId} onChoose={setBatterId}/>
        <GameLogs pitcher={matchup.pitcher} batter={selectedBatter} pitcherLogs={pitcherLogs} batterLogs={batterLogs}/>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-3">
        <TopHitters hitters={topHitters} pitcher={matchup.pitcher} onChoose={setBatterId}/>
        <InjuredList matchup={matchup}/>
      </section>
    </>}

    {!matchup&&!loading&&<div className="rounded-xl border border-[#26364e] bg-[#10192b] p-8 text-center text-sm text-[#849495]">Choose a pitcher and opponent, then tap Analyze.</div>}
  </div>;
};

const Field=({label,children}:any)=><label className="block"><span className="text-[10px] text-[#a5b1c5]">{label}</span>{children}</label>;

const PlayerCard=({type,player,profile,splits}:any)=>{const isPitcher=type==='pitcher';const s=player?.stats??{};const career=player?.careerStats??player?.career??null;return <section className="rounded-xl border border-[#2b405b] bg-[#0d1727] p-4 sm:p-5 min-w-0">
  <div className="flex items-start gap-4"><img src={mlbPlayerHeadshotUrl(player.id,260)} alt={player.name} className="w-20 h-20 sm:w-24 sm:h-24 rounded-md object-contain bg-[#dfe7f2]"/><div className="min-w-0"><div className="text-[10px] text-[#00e6f4] font-bold uppercase">{isPitcher?'Starting Pitcher':'Selected Batter'}</div><h2 className="text-2xl sm:text-3xl font-bold truncate mt-1">{player.name}</h2><div className="text-xl text-[#00dff0] mt-1">{isPitcher?`${player.pitchHand??'?'}HP`:`${player.batSide??'?'}HB`} {!isPitcher&&<span className="text-sm text-[#849495] ml-2">{player.position??''}</span>}</div></div></div>
  <div className="flex items-center gap-2 mt-3"><span className="text-xs">2026 REGULAR SEASON</span><span title={career?JSON.stringify(career):'Career regular-season data appears here when available.'} className="w-4 h-4 rounded-full border border-[#8190a6] text-[10px] flex items-center justify-center cursor-help">i</span></div>
  {isPitcher?<div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2"><Stat label="G" value={s.gamesPlayed??s.gamesStarted??s.games}/><Stat label="W-L" value={(s.wins!=null||s.losses!=null)?`${s.wins??0}-${s.losses??0}`:'—'}/><Stat label="ERA" value={s.era}/><Stat label="IP" value={s.inningsPitched}/><Stat label="SO" value={s.strikeOuts}/><Stat label="WHIP" value={s.whip}/></div>:<div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2"><Stat label="AVG" value={s.avg}/><Stat label="HR" value={s.homeRuns}/><Stat label="RBI" value={s.rbi}/><Stat label="SB" value={s.stolenBases}/><Stat label="OPS" value={s.ops}/></div>}
  {isPitcher?<PitchArsenal profile={profile}/>:<BatterProfile profile={profile}/>} 
  <p className="mt-4 text-xs leading-5 text-[#b9c5d8]">{isPitcher?pitcherDescription(player,profile):batterDescription(player,splits,profile)}</p>
</section>};

const Advantage=({value,pitcher,batter}:any)=><section className="flex flex-col items-center justify-center text-center py-4 xl:py-0"><div className="text-[10px] text-[#00e6f4] font-bold">ADVANTAGE</div><div className="w-28 h-28 rounded-full border-[5px] border-[#2c405b] border-t-[#00e6f4] border-l-[#00e6f4] mt-3 flex items-center justify-center"><div><div className="text-4xl font-mono">{value}%</div><div className="text-[10px] text-[#00e6f4] font-bold">{value>=50?'PITCHER':'BATTER'}</div></div></div><div className="text-2xl mt-2">⇄</div><div className="text-[10px] text-[#00e6f4] font-bold mt-2">KEY FACTOR</div><p className="text-xs text-[#b8c4d6] leading-5 mt-2 max-w-[180px]">{pitcher.pitchHand??'?'}HP vs {batter.batSide??'?'}HB. Handedness splits and current production shape this matchup index.</p></section>;

const BattersTable=({matchup,selected,onChoose}:any)=><section className="rounded-xl border border-[#2b405b] bg-[#0d1727] overflow-hidden min-w-0"><div className="px-4 py-3 flex items-center justify-between border-b border-[#2b405b]"><h3 className="text-sm font-bold text-[#00e6f4]">MATCHUP BATTERS — {matchup.team.name.toUpperCase()}</h3><span className="text-[10px] text-[#849495]">2026 REGULAR SEASON</span></div><div className="overflow-x-auto"><table className="w-full min-w-[610px] text-xs"><thead className="text-[#9aa8bc]"><tr><th className="p-2 text-left">#</th><th className="text-left">PLAYER</th><th>BATS</th><th>POS</th><th>AVG</th><th>HR</th><th>RBI</th><th>SB</th><th>OPS</th></tr></thead><tbody>{(matchup.batters??[]).slice(0,9).map((b:any,i:number)=><tr key={b.id} onClick={()=>onChoose(b.id)} className={`border-t border-[#23344d] cursor-pointer ${selected===b.id?'bg-[#12374a]':'hover:bg-[#132033]'}`}><td className="p-2">{i+1}</td><td className="font-semibold">{b.name}</td><td className="text-center">{b.batSide??'—'}</td><td className="text-center">{b.position??'—'}</td><td className="text-center">{b.stats?.avg??'—'}</td><td className="text-center">{b.stats?.homeRuns??'—'}</td><td className="text-center">{b.stats?.rbi??'—'}</td><td className="text-center">{b.stats?.stolenBases??'—'}</td><td className="text-center">{b.stats?.ops??'—'}</td></tr>)}</tbody></table></div><div className="px-4 py-2 text-[10px] text-[#849495]">H = Hits · HR = Home Runs · RBI = Runs Batted In · SB = Stolen Bases · OPS = On-Base Plus Slugging</div></section>;

const GameLogs=({pitcher,batter,pitcherLogs,batterLogs}:any)=>{const[tab,setTab]=useState<'pitcher'|'batter'>('batter');const logs=tab==='pitcher'?pitcherLogs:batterLogs;return <section className="rounded-xl border border-[#2b405b] bg-[#0d1727] overflow-hidden min-w-0 h-[300px] flex flex-col"><div className="px-4 py-3 flex items-center justify-between border-b border-[#2b405b]"><h3 className="text-sm font-bold text-[#00e6f4]">GAME LOGS</h3><div className="flex gap-1"><button onClick={()=>setTab('pitcher')} className={`px-3 py-1 rounded text-xs ${tab==='pitcher'?'bg-[#00dff0] text-[#06131b]':'bg-[#142033]'}`}>{pitcher.name}</button><button onClick={()=>setTab('batter')} className={`px-3 py-1 rounded text-xs ${tab==='batter'?'bg-[#00dff0] text-[#06131b]':'bg-[#142033]'}`}>{batter.name}</button></div></div><div className="overflow-auto flex-1"><table className="w-full min-w-[650px] text-xs"><thead className="sticky top-0 bg-[#091321] text-[#9aa8bc]"><tr><th className="p-2 text-left">DATE</th><th className="text-left">OPP</th>{tab==='pitcher'?<><th>IP</th><th>H</th><th>ER</th><th>BB</th><th>SO</th></>:<><th>AB</th><th>R</th><th>H</th><th>HR</th><th>RBI</th><th>BB</th><th>SO</th></>}</tr></thead><tbody>{logs.slice(0,30).map((x:any,i:number)=><tr key={i} className="border-t border-[#23344d]"><td className="p-2">{shortDate(x.date)}</td><td>{x.opponent??'—'}</td>{tab==='pitcher'?<><td className="text-center">{x.stat?.inningsPitched??'—'}</td><td className="text-center">{x.stat?.hits??'—'}</td><td className="text-center">{x.stat?.earnedRuns??'—'}</td><td className="text-center">{x.stat?.baseOnBalls??'—'}</td><td className="text-center">{x.stat?.strikeOuts??'—'}</td></>:<><td className="text-center">{x.stat?.atBats??'—'}</td><td className="text-center">{x.stat?.runs??'—'}</td><td className="text-center">{x.stat?.hits??'—'}</td><td className="text-center">{x.stat?.homeRuns??'—'}</td><td className="text-center">{x.stat?.rbi??'—'}</td><td className="text-center">{x.stat?.baseOnBalls??'—'}</td><td className="text-center">{x.stat?.strikeOuts??'—'}</td></>}</tr>)}</tbody></table></div></section>};

const TopHitters=({hitters,pitcher,onChoose}:any)=><section className="rounded-xl border border-[#2b405b] bg-[#0d1727] overflow-hidden"><div className="px-4 py-3 text-sm font-bold text-[#00e6f4]">TOP MATCHUP HITTERS <span className="text-[10px] text-[#9aa8bc]">vs {pitcher.name.toUpperCase()} (2026 REGULAR SEASON)</span></div><div className="flex gap-2 overflow-x-auto px-3 pb-3">{hitters.map((b:any)=><button key={b.id} onClick={()=>onChoose(b.id)} className="min-w-[150px] rounded-lg border border-[#26364e] bg-[#111b2d] p-3 text-left"><div className="flex gap-2 items-center"><img src={mlbPlayerHeadshotUrl(b.id,120)} alt={b.name} className="w-10 h-10 rounded object-contain bg-[#dfe7f2]"/><div><div className="font-semibold text-xs">{b.name}</div><div className="text-[10px] text-[#9aa8bc]">{b.position??'—'}</div></div></div><div className="mt-2 text-xl font-mono">{b.stats?.ops??'—'}<span className="text-[10px] ml-1">OPS</span></div><div className="text-[10px] text-[#9aa8bc] mt-1">{b.stats?.avg??'—'} AVG · {b.stats?.homeRuns??'—'} HR · {b.stats?.rbi??'—'} RBI</div></button>)}</div></section>;

const InjuredList=({matchup}:any)=><section className="rounded-xl border border-[#2b405b] bg-[#0d1727] overflow-hidden"><div className="px-4 py-3 text-sm font-bold text-[#00e6f4]">INJURED LIST — {matchup.team.name.toUpperCase()}</div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead className="text-[#9aa8bc]"><tr><th className="p-2 text-left">PLAYER</th><th>POS</th><th className="text-left">INJURY</th><th>IL STATUS</th><th>INJURED ON</th><th>EST. RETURN</th></tr></thead><tbody>{matchup.injuredList?.length?(matchup.injuredList.map((p:any)=><tr key={p.id} className="border-t border-[#23344d]"><td className="p-2 font-semibold">{p.name}</td><td className="text-center">{p.position??'—'}</td><td>{p.injury??p.description??'—'}</td><td className="text-center">{p.status??'—'}</td><td className="text-center">{p.injuredOn??'—'}</td><td className="text-center">{p.estimatedReturn??'—'}</td></tr>)):<tr><td colSpan={6} className="p-4 text-[#849495]">No injured-list players returned for this team.</td></tr>}</tbody></table></div></section>;

const PitchArsenal=({profile}:any)=><div className="mt-4"><div className="text-[10px] text-[#00e6f4] font-bold">PITCH ARSENAL</div><div className="mt-2 space-y-2">{profile?.slice(0,5).map((p:any)=><div key={p.code} className="grid grid-cols-[105px_1fr_60px] gap-2 items-center text-xs"><span className="truncate">{p.name}</span><div className="h-2 rounded bg-[#24344c] overflow-hidden"><div className="h-full bg-[#00dff0]" style={{width:`${Math.max(10,Math.min(100,p.usagePct??10))}%`}}/></div><span className="text-right">{p.avgVelo?.toFixed?.(1)??'—'} mph</span></div>)}</div></div>;
const BatterProfile=({profile}:any)=><div className="mt-4"><div className="flex justify-between text-[10px]"><span className="text-[#00e6f4] font-bold">PITCH-TYPE HITTING PROFILE</span><span className="text-[#9aa8bc]">AVG vs PITCH</span></div><div className="mt-2 space-y-2">{profile?.slice(0,5).map((p:any)=><div key={p.code} className="grid grid-cols-[120px_1fr_55px] gap-2 items-center text-xs"><span className="truncate">{p.name}</span><div className="h-2 rounded bg-[#24344c] overflow-hidden"><div className="h-full bg-[#00dff0]" style={{width:`${Math.max(8,Math.min(100,(Number(p.slg)||.15)*65))}%`}}/></div><span className="text-right">{fmt3(p.avg)}</span></div>)}</div></div>;
const Stat=({label,value}:any)=><div className="rounded-md border border-[#2b405b] bg-[#0a1423] p-2 text-center"><div className="text-[10px] text-[#9aa8bc]">{label}</div><div className="mt-1 text-lg font-mono">{value??'—'}</div></div>;
const pitcherDescription=(p:any,profile:any[])=>{const s=p.stats??{};const top=profile?.[0];return top?`${p.name} works primarily off the ${top.name}, averaging ${top.avgVelo?.toFixed?.(1)??'—'} mph in recent tracked outings with ${top.usagePct?.toFixed?.(0)??'—'}% usage. His 2026 regular season: ${s.era??'—'} ERA, ${s.whip??'—'} WHIP, ${s.strikeOuts??'—'} SO in ${s.inningsPitched??'—'} IP.`:`${p.name}'s recent tracked pitch profile is not available yet.`};
const batterDescription=(p:any,splits:any,profile:any[])=>{const side=p.batSide==='L'?'left-handed':p.batSide==='R'?'right-handed':'switch';const best=[...(profile??[])].filter((x:any)=>x.avg!=null).sort((a:any,b:any)=>(Number(b.avg)||0)-(Number(a.avg)||0))[0];const sp=splits?.vsLeft?.ops&&splits?.vsRight?.ops?` His OPS is ${splits.vsLeft.ops} vs LHP and ${splits.vsRight.ops} vs RHP.`:'';return `${p.name} is a ${side} hitter.${sp}${best?` Recent tracked results are strongest against ${best.name} (${fmt3(best.avg)} AVG).`:''}`};
const calcAdvantage=(pitcher:any,batter:any,splits:any)=>{const era=Number(pitcher?.stats?.era||4.2),whip=Number(pitcher?.stats?.whip||1.3),ops=Number(batter?.stats?.ops||.700),split=pitcher?.pitchHand==='L'?Number(splits?.vsLeft?.ops||ops):Number(splits?.vsRight?.ops||ops);return Math.round(Math.max(28,Math.min(72,50+(4.2-era)*3+(1.3-whip)*8+(.720-split)*25)));};
const shortDate=(d?:string)=>d?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${d}T12:00:00Z`)):'—';
const fmt3=(v:any)=>Number.isFinite(Number(v))?Number(v).toFixed(3).replace(/^0/,''):'—';
