import React,{useMemo,useState} from 'react';
import { PredictionPlayerSearch } from './predictions/PredictionPlayerSearch';
import { PredictionFilterPanel } from './predictions/PredictionFilterPanel';
import { PredictionTrendCard } from './predictions/PredictionTrendCard';
import { PredictionProjectionCard } from './predictions/PredictionProjectionCard';
import { PredictionLogTable } from './predictions/PredictionLogTable';
import { usePredictionWorkspace } from './predictions/usePredictionWorkspace';
import { pct,succeeds } from './predictions/predictionModel';
import type { PredictionSeasonMode,PredictionStat,PredictionWindow } from './predictions/predictionModel';

export const PlayerPredictionsViewV3:React.FC=()=>{
 const w=usePredictionWorkspace();
 const [filtersOpen,setFiltersOpen]=useState(true);
 const pickPlayer=(row:any)=>{w.setPlayer(row);w.setOpponentId(null);w.setPitcher(null);w.setWithPlayer(null);w.setWithoutPlayer(null);w.setPitcherHand('ANY');w.setHomeAway('ANY')};
 const noMatches=Boolean(w.player&&!w.loading&&!w.error&&w.logs.length>0&&w.rows.length===0);
 const seasonLabel=w.seasonMode==='COMBINED'?`${w.currentSeason} + 2025`:w.seasonMode==='2025'?'2025':String(w.currentSeason);
 const emptyMessage=w.selectedOpponent?`No ${w.player?.name??'player'} games vs ${w.selectedOpponent.name} match these filters in ${seasonLabel}.`:`No games match the selected filters in ${seasonLabel}.`;
 const quickStats=useMemo(()=>w.statDefs.filter((d:PredictionStat)=>d.id!==w.statId).slice(0,5),[w.statDefs,w.statId]);
 const rateFor=(def:PredictionStat,target:any)=>w.rows.length?w.rows.filter((row:any)=>succeeds(def.value(row.stat),target)).length/w.rows.length:0;
 return <div className="min-h-screen bg-[#071225] px-4 py-5 text-[#edf4ff] sm:px-6 lg:px-8"><div className="mx-auto max-w-[1420px] space-y-4">
  <header className="flex flex-col gap-4 border-b border-[#24344e] pb-4 lg:flex-row lg:items-center lg:justify-between">
   <div><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">PLAYER PREDICTIONS</h1><p className="mt-1 text-sm text-[#aab7c9]">Historical trends + ScoutCore projections for player performance.</p></div>
   <label className="w-full text-[10px] font-bold text-[#c2cede] sm:w-48">SEASON<select value={w.seasonMode} onChange={e=>w.setSeasonMode(e.target.value as PredictionSeasonMode)} className="mt-1.5 h-11 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-xs font-bold text-white [color-scheme:dark]"><option value="CURRENT">{w.currentSeason} Season</option><option value="2025">2025 Season</option><option value="COMBINED">{w.currentSeason} + 2025</option></select></label>
  </header>

  <section className="rounded-xl border border-[#2b3f5b] bg-[#0d182b] p-3 sm:p-4">
   <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr_.72fr_.58fr_2.25fr_auto_auto] xl:items-end">
    <PredictionPlayerSearch value={w.player} onPick={pickPlayer}/>
    <label className="text-[10px] text-[#c2cede]">STAT<select value={w.statId} onChange={e=>w.setStatId(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-sm font-bold text-white [color-scheme:dark]">{w.statDefs.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
    <label className="text-[10px] text-[#c2cede]">TARGET<select value={w.targetIndex} onChange={e=>w.setTargetIndex(Number(e.target.value))} className="mt-1.5 h-11 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-sm font-bold text-white [color-scheme:dark]">{w.stat?.targets.map((t,i)=><option key={t.label} value={i}>{t.label}</option>)}</select></label>
    <div><span className="mb-1.5 block text-[10px] text-[#c2cede]">WINDOW</span><div className="grid h-11 grid-cols-6 rounded-lg border border-[#30415c] bg-[#091427] p-1">{(['L5','L10','L20','L30','SEASON','H2H'] as PredictionWindow[]).map(x=><button key={x} type="button" onClick={()=>w.setWindowKey(x)} className={`min-w-0 rounded-md px-1 text-[10px] font-bold whitespace-nowrap sm:text-xs ${w.windowKey===x?'bg-[#59e8f3] text-[#042f36]':'text-white hover:bg-[#14243a]'}`}>{x==='SEASON'?'Season':x}</button>)}</div></div>
    <button type="button" onClick={()=>setFiltersOpen(v=>!v)} className={`h-11 rounded-lg border px-4 text-xs font-bold ${filtersOpen?'border-[#00e6f4] text-[#00e6f4]':'border-[#30415c] text-white'}`}>FILTERS {filtersOpen?'⌃':'⌄'}</button>
    <button type="button" onClick={w.refresh} className="h-11 rounded-lg border border-[#00e6f4] px-4 text-xs font-bold text-[#00e6f4]">REFRESH</button>
   </div>
   {filtersOpen&&<PredictionFilterPanel playerGroup={w.player?.group} playerTeamId={w.player?.currentTeam?.id??null} playerTeamName={w.player?.currentTeam?.name??null} opponentId={w.opponentId} opponents={w.opponents} selectedOpponent={w.selectedOpponent} pitcher={w.pitcher} withPlayer={w.withPlayer} withoutPlayer={w.withoutPlayer} pitcherHand={w.pitcherHand} homeAway={w.homeAway} setOpponent={w.setOpponentId} setPitcher={w.setPitcher} setWith={w.setWithPlayer} setWithout={w.setWithoutPlayer} setHand={w.setPitcherHand} setHomeAway={w.setHomeAway}/>} 
   {w.selectedOpponent&&<p className="mt-2 text-[11px] text-[#59e8f3]">Opponent and pitcher filters use {w.selectedOpponent.name}. Teammate filters use {w.player?.currentTeam?.name??'the selected player’s team'}.</p>}
   {w.seasonMode==='COMBINED'&&<p className="mt-2 text-[11px] text-[#9fb0c5]">Combined projections weight {w.currentSeason} more heavily than 2025 while using 2025 to fill matchup-history gaps.</p>}
  </section>

  {w.loading&&<div className="rounded-lg border border-[#59e8f3]/25 bg-[#59e8f3]/5 px-4 py-3 text-sm text-[#9deff5]">Loading MLB game logs…</div>}
  {w.error&&!w.loading&&<div className="rounded-lg border border-[#ffcc66]/30 bg-[#ffcc66]/8 px-4 py-3 text-sm text-[#ffe0a3]">{w.error}</div>}

  {noMatches?<section className="rounded-xl border border-[#30415c] bg-[#0d182b] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-[#56e9f4]">HISTORICAL TREND</p><h2 className="mt-1 text-xl font-bold text-white">No matching historical games</h2><p className="mt-2 text-sm text-[#9fb0c5]">{emptyMessage}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={w.clearFilters} className="rounded-lg border border-[#56e9f4]/55 px-4 py-2.5 text-xs font-black text-[#56e9f4]">CLEAR FILTERS</button>{w.seasonMode!=='COMBINED'&&<button type="button" onClick={()=>w.setSeasonMode('COMBINED')} className="rounded-lg bg-[#56e9f4] px-4 py-2.5 text-xs font-black text-[#052d34]">TRY {w.currentSeason} + 2025</button>}</div></div></section>:<section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_.95fr]"><PredictionTrendCard player={w.player} rows={w.rows} stat={w.stat} target={w.target} recentRate={w.recentRate} seasonRate={w.seasonRate} emptyMessage={emptyMessage}/><PredictionProjectionCard player={w.player} projection={w.projection} rows={w.rows.length} opponentName={w.selectedOpponent?.name} pitcherName={w.pitcher?.name}/></section>}

  {!noMatches&&w.player&&w.rows.length>0&&<section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">{quickStats.map((def:PredictionStat)=><article key={def.id} className="rounded-xl border border-[#30415c] bg-[#0d182b] p-4"><h3 className="text-sm font-bold text-white">{def.label}</h3><div className="mt-3 grid gap-2" style={{gridTemplateColumns:`repeat(${Math.min(4,def.targets.length)},minmax(0,1fr))`}}>{def.targets.slice(0,4).map(target=><div key={target.label} className="min-w-0 text-center"><div className="mx-auto h-10 w-full max-w-14 overflow-hidden rounded-md bg-[#17243a]"><div className="h-full bg-[#59e8f3]" style={{height:`${Math.max(4,Math.round(rateFor(def,target)*100))}%`,marginTop:`${100-Math.max(4,Math.round(rateFor(def,target)*100))}%`}}/></div><b className="mt-1 block text-[11px] text-white">{pct(rateFor(def,target))}</b><span className="block truncate text-[9px] text-[#93a5bb]">{target.label}</span></div>)}</div><p className="mt-2 text-center text-[9px] text-[#7f91aa]">Hit rate ({w.windowKey})</p></article>)}</section>}

  <section className="rounded-xl border border-[#2b3f5b] bg-[#0d182b] px-4 py-3"><div className="flex items-start gap-3"><span className="material-symbols-outlined text-[#59e8f3]">menu_book</span><div><h3 className="text-sm font-bold text-white">How to read this</h3><p className="mt-1 text-xs text-[#9fb0c5]">Historical Trend shows what happened in past qualifying games. ScoutCore Projection estimates how strongly the selected outcome is supported for the next game; it is not a guarantee.</p></div></div></section>

  {!noMatches&&<PredictionLogTable rows={w.rows} stat={w.stat}/>} 
 </div></div>;
};
