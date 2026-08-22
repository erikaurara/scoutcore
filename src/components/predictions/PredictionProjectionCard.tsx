import React,{useEffect,useState} from 'react';
import type { PredictionPlayer } from './predictionModel';

export function PredictionProjectionCard({player,projection,rows,opponentName,pitcherName}:{player:PredictionPlayer|null;projection:number;rows:number;opponentName?:string;pitcherName?:string}){
 const confidence=rows>=12?'HIGH':rows>=6?'MEDIUM':'LOW';
 const label=!player?'Select a player':projection>=.67?'Strong Chance':projection>=.45?'Moderate Chance':'Lower Chance';
 const target=Math.max(0,Math.min(100,Math.round(projection*100)));
 const [display,setDisplay]=useState(0);
 useEffect(()=>{
  setDisplay(0);
  if(!player)return;
  const started=performance.now();
  let frame=0;
  const tick=(now:number)=>{
   const p=Math.min(1,(now-started)/800);
   setDisplay(Math.round(target*(1-Math.pow(1-p,3))));
   if(p<1)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(frame);
 },[player?.id,target]);

 return <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#30415c] bg-[#0d182b] p-3.5">
  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[20px] text-[#56e9f4]">target</span><p className="text-base font-bold text-white">IXMetrics Projection</p></div>
  <div className="mt-2 grid min-h-0 flex-1 grid-cols-[200px_1fr] items-center gap-4">
   <div className="text-center">
    <div className="relative mx-auto h-[118px] w-[200px] overflow-hidden" aria-label={`Projected chance ${display}%`}>
     <svg viewBox="0 0 220 130" className="h-full w-full" aria-hidden="true"><path d="M20 112 A90 90 0 0 1 200 112" pathLength="100" fill="none" stroke="#24344d" strokeWidth="18"/><path d="M20 112 A90 90 0 0 1 200 112" pathLength="100" fill="none" stroke="#59e8f3" strokeWidth="18" strokeDasharray="100" strokeDashoffset={100-display}/></svg>
     <div className="absolute inset-x-0 bottom-0"><span className="block text-[11px] text-[#c7d3e2]">Projected chance</span><strong className="text-[46px] font-black leading-none tabular-nums text-[#59e8f3]">{display}%</strong></div>
    </div>
    <p className="text-base font-bold text-[#5ae9f2]">{label}</p><span className="mt-1 inline-block rounded-full bg-[#101b31] px-2.5 py-1 text-[10px] font-bold text-white">CONFIDENCE: {confidence}</span>
   </div>
   <div className="min-w-0"><h3 className="text-base font-bold text-white">Why we think this?</h3><div className="mt-2 space-y-1.5 text-xs leading-5 text-[#d3deea]"><p>✓ Based on {rows} qualifying games.</p>{opponentName&&<p>✓ Opponent: {opponentName}.</p>}{pitcherName&&<p>✓ Pitcher: {pitcherName}.</p>}<p>✓ Recent form + season context.</p></div></div>
  </div>
 </div>;
}
