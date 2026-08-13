import React from 'react';
import type { PredictionPlayer } from './predictionModel';
import { pct } from './predictionModel';
export function PredictionProjectionCard({player,projection,rows,opponentName,pitcherName}:{player:PredictionPlayer|null;projection:number;rows:number;opponentName?:string;pitcherName?:string}){
 const confidence=rows>=12?'HIGH':rows>=6?'MEDIUM':'LOW'; const label=!player?'Select a player':projection>=.67?'Strong Chance':projection>=.45?'Moderate Chance':'Lower Chance';
 return <div className="rounded-xl border border-[#30415c] bg-[#0d182b] p-5"><p className="text-xs font-bold text-[#56e9f4]">SCOUTCORE PROJECTION</p><div className="mt-6 text-center"><div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border-[16px] border-[#24344d]"><strong className="text-5xl text-[#59e8f3]">{pct(projection)}</strong></div><p className="mt-3 text-xl font-bold text-[#5ae9f2]">{label}</p><span className="mt-2 inline-block rounded-full bg-[#101b31] px-3 py-1 text-[10px] font-bold text-white">MODEL CONFIDENCE: {confidence}</span></div><div className="mt-5 space-y-2 text-sm text-[#d3deea]">{opponentName&&<p>• Opponent: {opponentName}</p>}{pitcherName&&<p>• Pitcher: {pitcherName}</p>}<p>• Sample: {rows} qualifying games</p></div></div>;
}
