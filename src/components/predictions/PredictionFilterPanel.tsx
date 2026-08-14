import React from 'react';
import { PredictionRosterPicker, type PredictionPlayerChoice } from './PredictionRosterPicker';

export function PredictionFilterPanel(props: {
  playerGroup?: 'hitting' | 'pitching'; playerTeamId?: number | null; playerTeamName?: string | null; opponentId: number | null; opponents: any[]; selectedOpponent: any | null;
  pitcher: PredictionPlayerChoice | null; withPlayer: PredictionPlayerChoice | null; withoutPlayer: PredictionPlayerChoice | null;
  pitcherHand: 'ANY'|'R'|'L'; homeAway: 'ANY'|'HOME'|'AWAY';
  setOpponent: (v:number|null)=>void; setPitcher:(v:PredictionPlayerChoice|null)=>void; setWith:(v:PredictionPlayerChoice|null)=>void; setWithout:(v:PredictionPlayerChoice|null)=>void;
  setHand:(v:'ANY'|'R'|'L')=>void; setHomeAway:(v:'ANY'|'HOME'|'AWAY')=>void;
}) {
  const opponentName = props.selectedOpponent?.name ?? null;
  return <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#26364e] pt-3 sm:grid-cols-2 xl:grid-cols-6">
    <label className="text-xs text-[#c2cede]">OPPONENT<select value={props.opponentId ?? ''} onChange={e=>props.setOpponent(e.target.value?Number(e.target.value):null)} className="mt-1.5 h-10 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-sm font-semibold text-white [color-scheme:dark]"><option value="">Any opponent</option>{props.opponents.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    {props.playerGroup==='hitting'?<PredictionRosterPicker label="PITCHER" value={props.pitcher} onPick={props.setPitcher} teamId={props.opponentId} teamName={opponentName} group="pitching"/>:<div/>}
    <label className="text-xs text-[#c2cede]">PITCHER HAND<select value={props.pitcherHand} onChange={e=>props.setHand(e.target.value as 'ANY'|'R'|'L')} className="mt-1.5 h-10 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-sm font-semibold text-white [color-scheme:dark]"><option value="ANY">Any hand</option><option value="R">RHP</option><option value="L">LHP</option></select></label>
    <label className="text-xs text-[#c2cede]">HOME / AWAY<select value={props.homeAway} onChange={e=>props.setHomeAway(e.target.value as 'ANY'|'HOME'|'AWAY')} className="mt-1.5 h-10 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-sm font-semibold text-white [color-scheme:dark]"><option value="ANY">Any</option><option value="HOME">Home</option><option value="AWAY">Away</option></select></label>
    <PredictionRosterPicker label="WITH TEAMMATE" value={props.withPlayer} onPick={props.setWith} teamId={props.playerTeamId ?? null} teamName={props.playerTeamName ?? null}/>
    <PredictionRosterPicker label="WITHOUT TEAMMATE" value={props.withoutPlayer} onPick={props.setWithout} teamId={props.playerTeamId ?? null} teamName={props.playerTeamName ?? null}/>
  </div>;
}
