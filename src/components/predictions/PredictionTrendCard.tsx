import React from 'react';
import type { PredictionPlayer,PredictionRow,PredictionStat,PredictionTarget } from './predictionModel';
import { pct,rate } from './predictionModel';

export function PredictionTrendCard({player,rows,stat,target,recentRate,seasonRate,emptyMessage}:{player:PredictionPlayer|null;rows:PredictionRow[];stat?:PredictionStat;target?:PredictionTarget;recentRate:number;seasonRate:number;emptyMessage?:string}){
 const success=rows.filter(r=>r.success).length;
 const filtered=rate(success,rows.length);
 const ceiling=Math.max(2,Math.ceil(Math.max(target?.value??1,...rows.map(r=>r.value),1)+1));
 const showValue=(value:number)=>stat?.display?stat.display(value):String(value);
 const midpoint=Math.ceil(ceiling/2);
 const values=rows.map(r=>r.value).sort((a,b)=>a-b);
 const average=rows.length?rows.reduce((s,r)=>s+r.value,0)/rows.length:0;
 const median=values.length?(values.length%2?values[(values.length-1)/2]:(values[values.length/2-1]+values[values.length/2])/2):0;
 let streak=0; for(const r of rows){if(!r.success)break;streak++;}
 const scrollable=rows.length>10;
 const chartWidth=scrollable?Math.max(720,rows.length*58):undefined;
 return <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#30415c] bg-[#0d182b] p-3.5">
  <p className="text-[12px] font-bold text-[#56e9f4]">HISTORICAL TREND</p>
  <h2 className="mt-0.5 truncate text-lg font-bold text-white">{player?.name??'Select a player'} — {target?.label} {stat?.label??'Stat'}</h2>
  {player&&rows.length===0?<div className="mt-2 flex flex-1 items-center justify-center rounded-lg border border-dashed border-[#3a4d68] bg-[#091427]/75 px-4 text-center"><div><p className="text-base font-black text-white">No matching historical games</p><p className="mt-1 text-xs text-[#9fb0c5]">{emptyMessage??'Change or clear one of the filters.'}</p></div></div>:<>
   <div className="relative mt-3 h-[190px] pl-8 md:min-h-0 md:flex-1">
    <div className="absolute inset-y-5 left-0 z-10 flex w-6 flex-col justify-between bg-[#0d182b] text-right text-[10px] font-bold text-[#b8c6d8]"><span>{showValue(ceiling)}</span><span>{showValue(midpoint)}</span><span>0</span></div>
    <div className={`h-full ${scrollable?'overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden':''}`} style={{touchAction:scrollable?'pan-x':'auto'}} onTouchStart={e=>{if(scrollable)e.stopPropagation()}} onTouchMove={e=>{if(scrollable)e.stopPropagation()}}>
     <div className="h-full" style={chartWidth?{width:chartWidth,minWidth:chartWidth}:undefined}>
      <div className="relative flex h-[145px] items-end gap-1.5 overflow-hidden border-b border-l border-[#566681] px-2"><i className="pointer-events-none absolute inset-x-0 top-0 border-t border-dotted border-[#70819a]/55"/><i className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dotted border-[#70819a]/55"/>{target&&<div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-white/75" style={{bottom:`${Math.min(100,(target.value/ceiling)*100)}%`}}><span className="sticky left-[calc(100vw-170px)] float-right -mt-4 mr-1 bg-[#0d182b]/95 px-1 text-[8px] font-bold text-white">{target.label} TARGET</span></div>}{rows.map((r,i)=><div key={`${r.gamePk}-${i}`} className="relative flex h-full min-w-0 flex-1 items-end"><div className={`relative w-full rounded-t-sm ${r.success?'bg-[#42e2eb]':'bg-[#ff515a]'}`} style={{height:`${Math.max(5,(r.value/ceiling)*100)}%`}}><b className={`absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] ${r.success?'text-[#59e8f3]':'text-[#ff6b73]'}`}>{showValue(r.value)}</b></div></div>)}</div>
      <div className="mt-1 grid gap-1.5 px-2 text-center text-[7px] leading-tight text-[#9fb0c5]" style={{gridTemplateColumns:`repeat(${Math.max(1,rows.length)},minmax(0,1fr))`}}>{rows.map((r,i)=><span key={`${r.gamePk}-label-${i}`} className="truncate">{(r as any).opponentAbbreviation??(r as any).opponentName??''}<br/>{(r as any).date?String((r as any).date).slice(5).replace('-','/'):''}</span>)}</div>
     </div>
    </div>
   </div>
   {scrollable&&<p className="mt-1 text-center text-[8px] font-semibold tracking-wide text-[#6f8198]">SWIPE CHART TO VIEW ALL {rows.length} GAMES ↔</p>}
   <div className="mt-1.5 grid grid-cols-5 divide-x divide-[#24344b] rounded-md border border-[#263850] bg-[#091427]/80 py-1.5 text-center"><div className="px-0.5"><span className="block text-[7px] leading-tight text-[#8395ad]">Hit Rate</span><b className="mt-0.5 block text-[10px] leading-tight text-[#59e8f3]">{success}/{rows.length} ({pct(filtered)})</b></div><div className="px-0.5"><span className="block text-[7px] leading-tight text-[#8395ad]">Average</span><b className="mt-0.5 block text-[10px] leading-tight text-white">{showValue(average)}</b></div><div className="px-0.5"><span className="block text-[7px] leading-tight text-[#8395ad]">Median</span><b className="mt-0.5 block text-[10px] leading-tight text-white">{showValue(median)}</b></div><div className="px-0.5"><span className="block text-[7px] leading-tight text-[#8395ad]">Streak</span><b className="mt-0.5 block text-[10px] leading-tight text-[#59e8f3]">{streak}</b></div><div className="px-0.5"><span className="block text-[7px] leading-tight text-[#8395ad]">Sample</span><b className="mt-0.5 block text-[10px] leading-tight text-white">{rows.length} games</b></div></div>
   <div className="mt-1 grid grid-cols-2 gap-2 text-center text-[9px]"><span className="text-white">L10 <b>{pct(recentRate)}</b></span><span className="text-white">Season <b>{pct(seasonRate)}</b></span></div>
  </>}
 </div>;
}
