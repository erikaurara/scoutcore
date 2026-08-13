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
  const duration=900;
  let frame=0;
  const tick=(now:number)=>{
   const progress=Math.min(1,(now-started)/duration);
   const eased=1-Math.pow(1-progress,3);
   setDisplay(Math.round(target*eased));
   if(progress<1)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(frame);
 },[player?.id,target]);

 return <div className="rounded-xl border border-[#30415c] bg-[#0d182b] p-5">
  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-[#56e9f4]">target</span><p className="text-sm font-bold text-white">ScoutCore Projection</p></div>
  <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
   <div className="text-center">
    <div className="relative mx-auto h-[138px] w-[220px] overflow-hidden" aria-label={`Projected chance ${display}%`}>
     <svg viewBox="0 0 220 130" className="h-full w-full" role="img" aria-hidden="true">
      <path d="M20 112 A90 90 0 0 1 200 112" pathLength="100" fill="none" stroke="#24344d" strokeWidth="18" strokeLinecap="butt"/>
      <path d="M20 112 A90 90 0 0 1 200 112" pathLength="100" fill="none" stroke="#59e8f3" strokeWidth="18" strokeLinecap="butt" strokeDasharray="100" strokeDashoffset={100-display} style={{transition:'stroke-dashoffset 90ms linear'}}/>
     </svg>
     <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
      <span className="text-[11px] text-[#c7d3e2]">Projected chance:</span>
      <strong className="text-5xl font-black tabular-nums text-[#59e8f3]">{display}%</strong>
     </div>
    </div>
    <p className="mt-1 text-lg font-bold text-[#5ae9f2]">{label}</p>
    <span className="mt-2 inline-block rounded-full bg-[#101b31] px-3 py-1 text-[10px] font-bold text-white">MODEL CONFIDENCE: {confidence}</span>
   </div>
   <div>
    <h3 className="text-base font-bold text-white">Why we think this?</h3>
    <div className="mt-3 space-y-3 text-sm text-[#d3deea]">
     <p className="flex gap-2"><span className="text-[#56e9f4]">✓</span><span>Based on {rows} qualifying historical games in the selected view.</span></p>
     {opponentName&&<p className="flex gap-2"><span className="text-[#56e9f4]">✓</span><span>Opponent filter: {opponentName}.</span></p>}
     {pitcherName&&<p className="flex gap-2"><span className="text-[#56e9f4]">✓</span><span>Pitcher matchup: {pitcherName}.</span></p>}
     <p className="flex gap-2"><span className="text-[#56e9f4]">✓</span><span>Recent form and season context are combined by the ScoutCore model.</span></p>
    </div>
   </div>
  </div>
 </div>;
}
