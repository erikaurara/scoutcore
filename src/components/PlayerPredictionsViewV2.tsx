import React,{useState} from 'react';
import { PredictionPlayerSearch } from './predictions/PredictionPlayerSearch';
import { PredictionFilterPanel } from './predictions/PredictionFilterPanel';
import { PredictionTrendCard } from './predictions/PredictionTrendCard';
import { PredictionProjectionCard } from './predictions/PredictionProjectionCard';
import { PredictionLogTable } from './predictions/PredictionLogTable';
import { usePredictionWorkspace } from './predictions/usePredictionWorkspace';
import type { PredictionWindow } from './predictions/predictionModel';

export const PlayerPredictionsViewV2:React.FC=()=>{
 const w=usePredictionWorkspace();const [filtersOpen,setFiltersOpen]=useState(true);
 const pickPlayer=(row:any)=>{w.setPlayer(row);w.setOpponentId(null);w.setPitcher(null);w.setWithPlayer(null);w.setWithoutPlayer(null);w.setPitcherHand('ANY')};
 return <div className="min-h-screen bg-[#071225] px-4 py-5 text-[#edf4ff] sm:px-6 lg:px-8"><div className="mx-auto max-w-[1380px] space-y-4">
  <header className="flex flex-col justify-between gap-4 border-b border-[#24344e] pb-5 xl:flex-row xl:items-end"><div><p className="text-[11px] font-bold tracking-[.14em] text-[#4fe9f4]">SCOUTCORE PERFORMANCE MODEL</p><h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">Player Predictions</h1><p className="mt-2 text-sm text-[#aab7c9]">Historical trends + ScoutCore projections for player performance.</p></div><div className="flex gap-2 text-[11px] text-white"><span className="rounded-full border border-[#2d415e] bg-[#0e192c] px-3 py-1.5">Historical rate ≠ future certainty</span><span className="rounded-full border border-[#2d415e] bg-[#0e192c] px-3 py-1.5">{new Date().getFullYear()} Season</span></div></header>
  <section className="rounded-xl border border-[#2b3f5b] bg-[#0d182b] p-4"><div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_.8fr_.6fr_2.4fr_auto_auto] lg:items-end">
   <PredictionPlayerSearch value={w.player} onPick={pickPlayer}/>
   <label className="text-[10px] text-[#c2cede]">STAT<select value={w.statId} onChange={e=>w.setStatId(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-sm font-bold text-white [color-scheme:dark]">{w.statDefs.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
   <label className="text-[10px] text-[#c2cede]">TARGET<select value={w.targetIndex} onChange={e=>w.setTargetIndex(Number(e.target.value))} className="mt-1.5 h-11 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-sm font-bold text-white [color-scheme:dark]">{w.stat?.targets.map((t,i)=><option key={t.label} value={i}>{t.label}</option>)}</select></label>
   <div><span className="mb-1.5 block text-[10px] text-[#c2cede]">WINDOW</span><div className="grid h-11 grid-cols-6 rounded-lg border border-[#30415c] bg-[#091427] p-1">{(['L5','L10','L20','L30','SEASON','H2H'] as PredictionWindow[]).map(x=><button key={x} type="button" onClick={()=>w.setWindowKey(x)} className={`rounded-md text-[10px] font-bold sm:text-xs ${w.windowKey===x?'bg-[#59e8f3] text-[#042f36]':'text-white hover:bg-[#14243a]'}`}>{x==='SEASON'?'Season':x}</button>)}</div></div>
   <button type="button" onClick={()=>setFiltersOpen(v=>!v)} className={`h-11 rounded-lg border px-4 text-xs font-bold ${filtersOpen?'border-[#00e6f4] text-[#00e6f4]':'border-[#30415c] text-white'}`}>FILTERS</button>
   <button type="button" onClick={w.refresh} className="h-11 rounded-lg border border-[#00e6f4] px-4 text-xs font-bold text-[#00e6f4]">REFRESH</button>
  </div>{filtersOpen&&<PredictionFilterPanel playerGroup={w.player?.group} opponentId={w.opponentId} opponents={w.opponents} selectedOpponent={w.selectedOpponent} pitcher={w.pitcher} withPlayer={w.withPlayer} withoutPlayer={w.withoutPlayer} pitcherHand={w.pitcherHand} homeAway={w.homeAway} setOpponent={w.setOpponentId} setPitcher={w.setPitcher} setWith={w.setWithPlayer} setWithout={w.setWithoutPlayer} setHand={w.setPitcherHand} setHomeAway={w.setHomeAway}/>} {w.selectedOpponent&&<p className="mt-2 text-[11px] text-[#59e8f3]">Player filters are limited to {w.selectedOpponent.name}. Type a name or use the arrow to browse the roster.</p>}</section>
  {w.error&&<div className="rounded-lg border border-[#ff7d85]/30 bg-[#ff7d85]/10 px-4 py-3 text-sm text-[#ff9aa0]">{w.error}</div>}
  <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_.85fr]"><PredictionTrendCard player={w.player} rows={w.rows} stat={w.stat} target={w.target} recentRate={w.recentRate} seasonRate={w.seasonRate}/><PredictionProjectionCard player={w.player} projection={w.projection} rows={w.rows.length} opponentName={w.selectedOpponent?.name} pitcherName={w.pitcher?.name}/></section>
  <PredictionLogTable rows={w.rows} stat={w.stat}/>
 </div></div>;
};
