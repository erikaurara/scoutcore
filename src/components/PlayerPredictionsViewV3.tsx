import React,{useEffect,useMemo,useState} from 'react';
import { PredictionPlayerSearch } from './predictions/PredictionPlayerSearch';
import { PredictionFilterPanel } from './predictions/PredictionFilterPanel';
import { PredictionTrendCard } from './predictions/PredictionTrendCard';
import { PredictionProjectionCard } from './predictions/PredictionProjectionCard';
import { usePredictionWorkspace } from './predictions/usePredictionWorkspace';
import { num,pct,succeeds } from './predictions/predictionModel';
import type { PredictionSeasonMode,PredictionStat,PredictionWindow } from './predictions/predictionModel';

const fmt3=(value:number|null)=>value==null?'—':value.toFixed(3).replace(/^0/,'');

export const PlayerPredictionsViewV3:React.FC=()=>{
 const w=usePredictionWorkspace();
 const [filtersOpen,setFiltersOpen]=useState(true);
 const [pitcherWhip,setPitcherWhip]=useState<number|null>(null);
 const pickPlayer=(row:any)=>{w.setPlayer(row);w.setOpponentId(null);w.setPitcher(null);w.setWithPlayer(null);w.setWithoutPlayer(null);w.setPitcherHand('ANY');w.setHomeAway('ANY')};
 const noMatches=Boolean(w.player&&!w.loading&&!w.error&&w.logs.length>0&&w.rows.length===0);
 const seasonLabel=w.seasonMode==='COMBINED'?`${w.currentSeason} + 2025`:w.seasonMode==='2025'?'2025':String(w.currentSeason);
 const emptyMessage=w.selectedOpponent?`No ${w.player?.name??'player'} games vs ${w.selectedOpponent.name} match these filters in ${seasonLabel}.`:`No games match the selected filters in ${seasonLabel}.`;
 const quickStats=useMemo(()=>w.statDefs.filter((d:PredictionStat)=>d.id!==w.statId).slice(0,5),[w.statDefs,w.statId]);
 const rateFor=(def:PredictionStat,target:any)=>w.rows.length?w.rows.filter((row:any)=>succeeds(def.value(row.stat),target)).length/w.rows.length:0;
 const aggregate=useMemo(()=>{
  const calc=(rows:any[])=>{
   const ab=rows.reduce((s,r)=>s+num(r.stat?.atBats),0),hits=rows.reduce((s,r)=>s+num(r.stat?.hits),0),bb=rows.reduce((s,r)=>s+num(r.stat?.baseOnBalls),0),hbp=rows.reduce((s,r)=>s+num(r.stat?.hitByPitch),0),sf=rows.reduce((s,r)=>s+num(r.stat?.sacFlies),0);
   return {avg:ab?hits/ab:null,obp:(ab+bb+hbp+sf)?(hits+bb+hbp)/(ab+bb+hbp+sf):null};
  };
  const all=calc(w.rows),last10=calc(w.rows.slice(0,10));
  const hand=w.pitcherHand!=='ANY'?w.pitcherHand:(w.rows.find((r:any)=>r.opponentStarterHand)?.opponentStarterHand??null);
  const handRows=hand?w.rows.filter((r:any)=>r.opponentStarterHand===hand):[];
  return {...all,last10Avg:last10.avg,hand,handAvg:handRows.length?calc(handRows).avg:null};
 },[w.rows,w.pitcherHand]);
 useEffect(()=>{
  let active=true;setPitcherWhip(null);
  if(!w.pitcher?.id)return()=>{active=false};
  const season=w.seasonMode==='2025'?2025:w.currentSeason;
  fetch(`https://statsapi.mlb.com/api/v1/people/${w.pitcher.id}/stats?stats=season&group=pitching&season=${season}`).then(r=>r.json()).then(data=>{
   const value=Number(data?.stats?.[0]?.splits?.[0]?.stat?.whip);
   if(active&&Number.isFinite(value))setPitcherWhip(value);
  }).catch(()=>{});
  return()=>{active=false};
 },[w.pitcher?.id,w.seasonMode,w.currentSeason]);

 return <div className="min-h-[calc(100dvh-76px)] bg-[#071225] px-4 py-3 text-[#edf4ff]"><div className="mx-auto flex max-w-[1560px] flex-col gap-3">
  <header className="flex flex-col gap-2 border-b border-[#24344e] pb-3 md:flex-row md:items-center md:justify-between">
   <div><h1 className="text-[32px] font-extrabold tracking-tight">PLAYER PREDICTIONS</h1><p className="mt-1 text-sm text-[#aab7c9]">Historical trends + ScoutCore projections for player props-style baseball outcomes.</p></div>
   <label className="w-full text-xs font-bold text-[#c2cede] sm:w-48">SEASON<select value={w.seasonMode} onChange={e=>w.setSeasonMode(e.target.value as PredictionSeasonMode)} className="mt-1 h-11 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-sm font-bold text-white [color-scheme:dark]"><option value="CURRENT">{w.currentSeason} Season</option><option value="2025">2025 Season</option><option value="COMBINED">{w.currentSeason} + 2025</option></select></label>
  </header>

  <section className="rounded-xl border border-[#2b3f5b] bg-[#0d182b] p-3">
   <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[1.15fr_.72fr_.58fr_2.25fr_auto_auto] md:items-end">
    <PredictionPlayerSearch value={w.player} onPick={pickPlayer}/>
    <label className="text-xs text-[#c2cede]">STAT<select value={w.statId} onChange={e=>w.setStatId(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-sm font-bold text-white [color-scheme:dark]">{w.statDefs.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
    <label className="text-xs text-[#c2cede]">TARGET<select value={w.targetIndex} onChange={e=>w.setTargetIndex(Number(e.target.value))} className="mt-1.5 h-11 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-sm font-bold text-white [color-scheme:dark]">{w.stat?.targets.map((t,i)=><option key={t.label} value={i}>{t.label}</option>)}</select></label>
    <div><span className="mb-1.5 block text-xs text-[#c2cede]">WINDOW</span><div className="grid h-11 grid-cols-6 rounded-lg border border-[#30415c] bg-[#091427] p-1">{(['L5','L10','L20','L30','SEASON','H2H'] as PredictionWindow[]).map(x=><button key={x} type="button" onClick={()=>w.setWindowKey(x)} className={`min-w-0 rounded-md px-1 text-xs font-bold whitespace-nowrap ${w.windowKey===x?'bg-[#59e8f3] text-[#042f36]':'text-white hover:bg-[#14243a]'}`}>{x==='SEASON'?'Season':x}</button>)}</div></div>
    <button type="button" onClick={()=>setFiltersOpen(v=>!v)} className={`h-11 rounded-lg border px-3 text-sm font-bold ${filtersOpen?'border-[#00e6f4] text-[#00e6f4]':'border-[#30415c] text-white'}`}>FILTERS {filtersOpen?'⌃':'⌄'}</button>
    <button type="button" onClick={w.refresh} className="h-11 rounded-lg border border-[#00e6f4] px-3 text-sm font-bold text-[#00e6f4]">REFRESH</button>
   </div>
   {filtersOpen&&<PredictionFilterPanel playerGroup={w.player?.group} playerTeamId={w.player?.currentTeam?.id??null} playerTeamName={w.player?.currentTeam?.name??null} opponentId={w.opponentId} opponents={w.opponents} selectedOpponent={w.selectedOpponent} pitcher={w.pitcher} withPlayer={w.withPlayer} withoutPlayer={w.withoutPlayer} pitcherHand={w.pitcherHand} homeAway={w.homeAway} setOpponent={w.setOpponentId} setPitcher={w.setPitcher} setWith={w.setWithPlayer} setWithout={w.setWithoutPlayer} setHand={w.setPitcherHand} setHomeAway={w.setHomeAway}/>} 
  </section>

  {w.loading&&<div className="rounded-lg border border-[#59e8f3]/25 bg-[#59e8f3]/5 px-3 py-2 text-sm text-[#9deff5]">Loading MLB game logs…</div>}
  {w.error&&!w.loading&&<div className="rounded-lg border border-[#ffcc66]/30 bg-[#ffcc66]/8 px-3 py-2 text-sm text-[#ffe0a3]">{w.error}</div>}

  {noMatches?<section className="rounded-xl border border-[#30415c] bg-[#0d182b] p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold text-[#56e9f4]">HISTORICAL TREND</p><h2 className="mt-1 text-xl font-bold text-white">No matching historical games</h2><p className="mt-1 text-sm text-[#9fb0c5]">{emptyMessage}</p></div><button type="button" onClick={w.clearFilters} className="rounded-lg border border-[#56e9f4]/55 px-4 py-2 text-sm font-black text-[#56e9f4]">CLEAR FILTERS</button></div></section>:<section className="grid min-h-[320px] grid-cols-1 gap-3 md:grid-cols-[1.05fr_.95fr]"><PredictionTrendCard player={w.player} rows={w.rows} stat={w.stat} target={w.target} recentRate={w.recentRate} seasonRate={w.seasonRate} emptyMessage={emptyMessage}/><PredictionProjectionCard player={w.player} projection={w.projection} rows={w.rows.length} opponentName={w.selectedOpponent?.name} pitcherName={w.pitcher?.name}/></section>}

  {!noMatches&&w.player&&w.rows.length>0&&<>
   <section className="grid grid-cols-5 divide-x divide-[#2c3d56] rounded-xl border border-[#30415c] bg-[#0d182b] px-3 py-2.5 text-center">
    <div><p className="text-xs text-[#91a3bb]">AVG</p><b className="text-base text-white">{fmt3(aggregate.avg)}</b></div>
    <div><p className="text-xs text-[#91a3bb]">OBP</p><b className="text-base text-white">{fmt3(aggregate.obp)}</b></div>
    <div><p className="text-xs text-[#91a3bb]">vs {aggregate.hand==='L'?'LHP':'RHP'}</p><b className="text-base text-white">{fmt3(aggregate.handAvg)}</b></div>
    <div><p className="text-xs text-[#91a3bb]">Last 10 AVG</p><b className="text-base text-white">{fmt3(aggregate.last10Avg)}</b></div>
    <div><p className="text-xs text-[#91a3bb]">Opponent WHIP</p><b className="text-base text-white">{pitcherWhip==null?'—':pitcherWhip.toFixed(2)}</b></div>
   </section>

   <section className="grid grid-cols-2 gap-2.5 md:grid-cols-5">{quickStats.map((def:PredictionStat)=><article key={def.id} className="rounded-lg border border-[#30415c] bg-[#0d182b] px-3 py-2.5"><h3 className="text-sm font-bold text-white">{def.label}</h3><div className="mt-2 grid gap-2" style={{gridTemplateColumns:`repeat(${Math.min(4,def.targets.length)},minmax(0,1fr))`}}>{def.targets.slice(0,4).map(target=>{const r=rateFor(def,target);return <div key={target.label} className="min-w-0 text-center"><div className="mx-auto flex h-9 w-full max-w-14 items-end overflow-hidden rounded bg-[#17243a]"><div className={`w-full ${r===0?'bg-[#ff515a]':'bg-[#59e8f3]'}`} style={{height:`${r===0?6:Math.max(6,Math.round(r*100))}%`}}/></div><b className={`mt-0.5 block text-sm ${r===0?'text-[#ff6b73]':'text-white'}`}>{pct(r)}</b><span className="block truncate text-[11px] text-[#93a5bb]">{target.label}</span></div>})}</div></article>)}</section>
  </>}

  <section className="rounded-lg border border-[#2b3f5b] bg-[#0d182b] px-3 py-2.5"><div className="flex items-center gap-2.5"><span className="material-symbols-outlined text-xl text-[#59e8f3]">menu_book</span><div><h3 className="text-sm font-bold text-white">How to read this</h3><p className="text-xs text-[#9fb0c5]">Historical Trend shows past qualifying games. ScoutCore Projection estimates support for the selected outcome; it is not a guarantee.</p></div></div></section>
 </div></div>;
};
