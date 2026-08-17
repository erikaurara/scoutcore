import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

type Tab = 'upcoming' | 'finished' | 'statistics';
type StatsRange = '7d' | '30d' | 'season' | 'all';
type StatsGroup = 'all' | 'hitting' | 'pitching' | 'game';
type Selection = Record<string, any> & { result?: 'pending' | 'correct' | 'incorrect' | 'void' | null };
type Card = Record<string, any> & { status?: string | null; selections?: Selection[] | null; created_at?: string | null; settled_at?: string | null };
type Direction = 'gte' | 'lte' | 'eq';
type EditOption = { label: string; threshold: number; direction?: Direction; choice?: string };
type Score = Record<string, any> & {
  user_id?: string | null; points?: number | null; weekly_points?: number | null; monthly_points?: number | null;
  correct_picks?: number | null; total_picks?: number | null; current_streak?: number | null; best_streak?: number | null;
  monthly_correct_picks?: number | null; monthly_total_picks?: number | null;
  hitting_correct_picks?: number | null; hitting_total_picks?: number | null;
  pitching_correct_picks?: number | null; pitching_total_picks?: number | null;
  team_correct_picks?: number | null; team_total_picks?: number | null;
};

const pct=(c:number,t:number)=>t?Math.round(c/t*100):0;
const titleCase=(value:string)=>value.replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
const marketLabel=(s:Selection)=>String(s.label||s.market_label||s.market||s.pick_label||titleCase(String(s.type||'ScoutCore Pick')));
const subjectLabel=(s:Selection)=>String(s.subjectName||s.player_name||s.playerName||s.pitcher_name||s.hitter_name||s.subject_name||s.teamName||s.team_name||'ScoutCore Pick');
const projection=(s:Selection)=>Number(s.score??s.projection??s.probability??s.confidence??s.scoutcore_projection??0);
const selectionKey=(s:Selection)=>`${String(s.type||'')} ${String(s.label||'')} ${String(s.market_label||'')} ${String(s.market||'')}`.toLowerCase();
const predictionTabs:Array<{id:Tab;icon:string;label:string}>=[{id:'upcoming',icon:'event_upcoming',label:'Upcoming'},{id:'finished',icon:'task_alt',label:'Finished'},{id:'statistics',icon:'monitoring',label:'Statistics'}];
const resultLabel=(s:Selection)=>String(s.resultValue??s.result_value??s.actual_result??s.result_detail??'Final result recorded');
const cardDate=(card:Card)=>new Date(card.game_date||card.gameDate||card.created_at||Date.now());
const teamName=(team:any)=>String(team?.name||team?.teamName||team||'').trim();
const matchupTeams=(card:Card)=>{
  let away=teamName(card.away_team||card.awayTeam);
  let home=teamName(card.home_team||card.homeTeam);
  const first=(card.selections||[])[0];
  if((!away||!home)&&first){
    away=away||teamName(first.away_team||first.awayTeam);
    home=home||teamName(first.home_team||first.homeTeam);
  }
  if(!away&&!home&&first?.teamName) away=String(first.teamName);
  return {away:away||'Away Team',home:home||'Home Team'};
};

const atLeast=(values:number[],suffix='')=>values.map(threshold=>({label:`${threshold}+${suffix}`,threshold}));
const atMost=(values:number[],suffix=' or fewer')=>values.map(threshold=>({label:`${threshold}${suffix}`,threshold,direction:'lte' as Direction}));
const editOptions:Record<string,EditOption[]>={
  hitter_hit:atLeast([1,2,3],' hits'),
  hitter_total_base:atLeast([1,2,3,4],' total bases'),
  hitter_reach_base:atLeast([1,2,3],' times'),
  hitter_home_run:[{label:'1+ home run',threshold:1}],
  hitter_runs:atLeast([1,2],' runs'),
  hitter_rbi:atLeast([1,2,3],' RBI'),
  hitter_walks:atLeast([1,2],' walks'),
  hitter_stolen_bases:atLeast([1,2],' stolen bases'),
  hitter_extra_base_hit:[{label:'1+ extra-base hit',threshold:1}],
  hitter_hrr:atLeast([2,3,4],' H + R + RBI'),
  hitter_strikeouts:atLeast([1,2],' strikeouts'),
  pitcher_strikeouts:atLeast([4,5,6,7,8],' strikeouts'),
  pitcher_innings:atLeast([5,6],' innings'),
  pitcher_hits_allowed:atMost([4,5,6],' or fewer hits'),
  pitcher_earned_runs:atMost([1,2,3],' or fewer earned runs'),
  pitcher_walks:atMost([1,2,3],' or fewer walks'),
  pitcher_quality_start:[{label:'Yes',threshold:1,direction:'eq',choice:'yes'},{label:'No',threshold:0,direction:'eq',choice:'no'}],
  game_first_inning:[{label:'Run scored',threshold:1,direction:'eq',choice:'run'},{label:'No run scored',threshold:0,direction:'eq',choice:'no_run'}],
  game_first_team_score:[{label:'Selected team',threshold:1,direction:'eq'}],
  team_runs:atLeast([3,4,5],' runs'),
  team_hits:atLeast([7,9,11],' hits'),
  game_extra_innings:[{label:'Yes',threshold:1,direction:'eq',choice:'yes'},{label:'No',threshold:0,direction:'eq',choice:'no'}],
  team_winner:[{label:'Selected team',threshold:1,direction:'eq'}],
};

const teamEditableTypes=new Set(['game_first_team_score','team_runs','team_hits','team_winner']);
const marketNames:Record<string,string>={
  hitter_hit:'Hits',hitter_total_base:'Total Bases',hitter_reach_base:'Reach Base',hitter_home_run:'Home Run',hitter_runs:'Runs',hitter_rbi:'RBI',hitter_walks:'Walks',hitter_stolen_bases:'Stolen Bases',hitter_extra_base_hit:'Extra-Base Hit',hitter_hrr:'Hits + Runs + RBI',hitter_strikeouts:'Batter Strikeouts',pitcher_strikeouts:'Pitcher Strikeouts',pitcher_innings:'Pitcher Innings',pitcher_hits_allowed:'Hits Allowed',pitcher_earned_runs:'Earned Runs',pitcher_walks:'Pitcher Walks',pitcher_quality_start:'Quality Start',game_first_inning:'First Inning',game_first_team_score:'First Team to Score',team_runs:'Team Runs',team_hits:'Team Hits',game_extra_innings:'Extra Innings',team_winner:'Game Winner',
};

const teamId=(team:any)=>Number(team?.id||team?.teamId||team?.team_id||0);
const teamAbbreviation=(team:any)=>String(team?.abbreviation||team?.abbr||team?.name||team?.teamName||'Team');
const cardTeams=(card:Card)=>[card.away_team||card.awayTeam,card.home_team||card.homeTeam].filter(Boolean).map(team=>({id:teamId(team),name:teamName(team),abbreviation:teamAbbreviation(team)})).filter(team=>team.id>0);
const optionMatches=(selection:Selection,option:EditOption)=>Number(selection.threshold)===option.threshold&&String(selection.choice||'')===String(option.choice||'')&&String(selection.direction||'gte')===String(option.direction||'gte');

const pickLabelFor=(type:string,option:EditOption,subject:string)=>{
  if(type==='hitter_hit')return `${subject} — ${option.threshold}+ Hit${option.threshold===1?'':'s'}`;
  if(type==='hitter_total_base')return `${subject} — ${option.threshold}+ Total Base${option.threshold===1?'':'s'}`;
  if(type==='hitter_reach_base')return `${subject} — Reach Base ${option.threshold}+ Time${option.threshold===1?'':'s'}`;
  if(type==='hitter_home_run')return `${subject} — 1+ Home Run`;
  if(type==='hitter_runs')return `${subject} — ${option.threshold}+ Run${option.threshold===1?'':'s'}`;
  if(type==='hitter_rbi')return `${subject} — ${option.threshold}+ RBI`;
  if(type==='hitter_walks')return `${subject} — ${option.threshold}+ Walk${option.threshold===1?'':'s'}`;
  if(type==='hitter_stolen_bases')return `${subject} — ${option.threshold}+ Stolen Base${option.threshold===1?'':'s'}`;
  if(type==='hitter_extra_base_hit')return `${subject} — 1+ Extra-Base Hit`;
  if(type==='hitter_hrr')return `${subject} — ${option.threshold}+ Hits + Runs + RBI`;
  if(type==='hitter_strikeouts')return `${subject} — ${option.threshold}+ Batter Strikeout${option.threshold===1?'':'s'}`;
  if(type==='pitcher_strikeouts')return `${subject} — ${option.threshold}+ Strikeouts`;
  if(type==='pitcher_innings')return `${subject} — ${option.threshold}+ Innings`;
  if(type==='pitcher_hits_allowed')return `${subject} — ${option.threshold} or Fewer Hits Allowed`;
  if(type==='pitcher_earned_runs')return `${subject} — ${option.threshold} or Fewer Earned Runs`;
  if(type==='pitcher_walks')return `${subject} — ${option.threshold} or Fewer Walks`;
  if(type==='pitcher_quality_start')return `${subject} — Quality Start: ${option.choice==='yes'?'Yes':'No'}`;
  if(type==='game_first_inning')return `First Inning — ${option.choice==='run'?'Run Scored':'No Run Scored'}`;
  if(type==='game_first_team_score')return `${subject} — First Team to Score`;
  if(type==='team_runs')return `${subject} — ${option.threshold}+ Team Runs`;
  if(type==='team_hits')return `${subject} — ${option.threshold}+ Team Hits`;
  if(type==='game_extra_innings')return `Extra Innings — ${option.choice==='yes'?'Yes':'No'}`;
  if(type==='team_winner')return `${subject} — Win`;
  return `${subject} — ${marketNames[type]||titleCase(type)} ${option.label}`;
};

const pickDetailFor=(type:string,option:EditOption)=>{
  if(type==='hitter_extra_base_hit')return 'Records at least one double, triple, or home run.';
  if(type==='pitcher_quality_start')return option.choice==='yes'?'Records at least 6.0 innings with 3 or fewer earned runs.':'Does not record a quality start.';
  if(type==='game_first_inning')return option.choice==='run'?'At least one run is scored in the first inning.':'No run is scored in the first inning.';
  if(type==='game_first_team_score')return 'Selected team scores the first run of the game.';
  if(type==='game_extra_innings')return option.choice==='yes'?'Game reaches the 10th inning or later.':'Game ends in nine innings or fewer.';
  if(type==='team_winner')return 'Selected team wins the game.';
  return `${marketNames[type]||titleCase(type)}: ${option.label}.`;
};

const withoutStaleAnalysis=(selection:Selection)=>{
  const {chance,score,summary,keyFactor,stats,projection:oldProjection,probability,confidence,scoutcore_projection,resultValue,result_value,actual_result,result_detail,...rest}=selection;
  void chance;void score;void summary;void keyFactor;void stats;void oldProjection;void probability;void confidence;void scoutcore_projection;void resultValue;void result_value;void actual_result;void result_detail;
  return rest;
};

const rebuildSelection=(selection:Selection,card:Card,option:EditOption,team?:{id:number;name:string;abbreviation:string}):Selection=>{
  const type=String(selection.type||'');
  const subject=team?.name||subjectLabel(selection);
  const nextSubjectId=team?.id??Number(selection.subjectId||selection.subject_id||0);
  const nextTeamId=team?.id??Number(selection.teamId||selection.team_id||0);
  const gamePk=Number(card.game_pk||card.gamePk||selection.gamePk||0);
  return {...withoutStaleAnalysis(selection),id:`${gamePk}-${type}-${nextSubjectId}-${option.threshold}-${option.choice||''}`,gamePk,type,subjectId:nextSubjectId,subjectName:subject,teamId:nextTeamId,teamName:team?.name||selection.teamName||selection.team_name||'',threshold:option.threshold,direction:option.direction||'gte',choice:option.choice,label:pickLabelFor(type,option,subject),detail:pickDetailFor(type,option),result:'pending' as const};
};

const lockCountdown=(gameDate:Date,now:number)=>{
  const remaining=gameDate.getTime()-now;
  if(!Number.isFinite(gameDate.getTime())||remaining<=0)return 'Picks locked';
  const minutes=Math.max(1,Math.ceil(remaining/60000));
  if(minutes<60)return `Locks in ${minutes}m`;
  const hours=Math.floor(minutes/60);const rest=minutes%60;
  if(hours<24)return `Locks in ${hours}h${rest?` ${rest}m`:''}`;
  const days=Math.floor(hours/24);return `Locks in ${days}d ${hours%24}h`;
};

const lockTimeLabel=(date:Date)=>new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date);

const PickDetail=({s,finished}:{s:Selection;finished?:boolean})=>{
  const p=projection(s); const good=s.result==='correct';
  return <div className="border-t border-[#263951] px-4 py-4 sm:px-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-base font-extrabold text-white">{subjectLabel(s)}</div>
        <div className="mt-0.5 text-sm font-bold text-[#d9e5f5]">{marketLabel(s)}</div>
      </div>
      {finished?<span className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-extrabold ${good?'bg-[#16d99a]/12 text-[#55f1bd]':s.result==='void'?'bg-[#526275]/15 text-[#a8b6c8]':'bg-[#ff515a]/12 text-[#ff747c]'}`}>{good?'✓ CORRECT':s.result==='void'?'VOID':'✕ MISSED'}</span>:<span className="shrink-0 rounded-xl border border-[#00e6f4] px-3 py-1.5 text-xs font-black text-[#5cecf4]">YOUR PICK</span>}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9aabc0]">
      <span>{finished?`Result: ${resultLabel(s)}`:'Upcoming'}</span>
      {p>0&&<span>ScoutCore when picked: <b className="text-[#59e8f3]">{Math.round(p<=1?p*100:p)}%</b></span>}
    </div>
    {!finished&&p>0&&<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#22324b]"><div className="h-full rounded-full bg-[#59e8f3]" style={{width:`${Math.min(100,Math.round(p<=1?p*100:p))}%`}}/></div>}
  </div>;
};

const PredictionEditor=({card,draft,onChange,onRemove,onCancel,onSave,saving,error}:{card:Card;draft:Selection[];onChange:(index:number,next:Selection)=>void;onRemove:(index:number)=>void;onCancel:()=>void;onSave:()=>void;saving:boolean;error:string|null})=>{
  const teams=cardTeams(card);
  return <div className="border-t border-[#2a405b] bg-[#091525] px-4 py-5 sm:px-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-base font-black text-white">Edit predictions</p><p className="mt-1 text-xs leading-5 text-[#91a2b8]">Adjust or remove picks before first pitch. Changes stay on this same card, and old analysis is cleared after saving.</p></div>
      <span className="rounded-lg border border-[#55f1bd]/30 bg-[#55f1bd]/8 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#70efc2]">Free play · no money or prizes</span>
    </div>
    <div className="mt-4 space-y-3">{draft.map((selection,index)=>{
      const type=String(selection.type||'');
      const options=editOptions[type]||[];
      const currentOption=options.find(option=>optionMatches(selection,option))||{label:String(selection.label||'Current pick'),threshold:Number(selection.threshold||0),direction:(selection.direction||'gte') as Direction,choice:selection.choice};
      return <article key={`${selection.id||type}-${index}`} className="rounded-xl border border-[#263951] bg-[#0d192b] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#59e8f3]">{marketNames[type]||titleCase(type)}</p><p className="mt-1 truncate text-sm font-extrabold text-white">{subjectLabel(selection)}</p></div>
          <button type="button" onClick={()=>onRemove(index)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#ff747c]/30 text-[#ff8a90]" aria-label={`Remove ${marketNames[type]||'prediction'}`}><span className="material-symbols-outlined text-[19px]">delete</span></button>
        </div>
        {teamEditableTypes.has(type)&&teams.length===2&&<div className="mt-3"><p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7f90a6]">Choose team</p><div className="mt-2 grid grid-cols-2 gap-2">{teams.map(team=><button key={team.id} type="button" onClick={()=>onChange(index,rebuildSelection(selection,card,currentOption,team))} className={`rounded-lg border px-3 py-2 text-xs font-extrabold ${Number(selection.teamId||selection.team_id)===team.id?'border-[#59e8f3] bg-[#59e8f3] text-[#062029]':'border-[#30415c] bg-[#10192b] text-[#d0d9e5]'}`}>{team.abbreviation}</button>)}</div></div>}
        {options.length>1&&<div className="mt-3"><p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7f90a6]">Choose prediction</p><div className="mt-2 flex flex-wrap gap-2">{options.map(option=><button key={`${option.threshold}-${option.choice||''}`} type="button" onClick={()=>onChange(index,rebuildSelection(selection,card,option,teamEditableTypes.has(type)?teams.find(team=>team.id===Number(selection.teamId||selection.team_id)):undefined))} className={`rounded-lg border px-3 py-2 text-[11px] font-extrabold ${optionMatches(selection,option)?'border-[#59e8f3] bg-[#59e8f3] text-[#062029]':'border-[#30415c] bg-[#10192b] text-[#d0d9e5]'}`}>{option.label}</button>)}</div></div>}
        {options.length<=1&&<p className="mt-3 text-[10px] leading-4 text-[#718198]">This category has one prediction option. You can change its team when available, or remove the pick.</p>}
      </article>;
    })}</div>
    {!draft.length&&<div className="mt-4 rounded-xl border border-dashed border-[#ff747c]/40 bg-[#ff747c]/5 px-4 py-8 text-center text-sm text-[#ff9ba0]">Keep at least one prediction on the card.</div>}
    {error&&<div role="alert" className="mt-4 rounded-xl border border-[#ff747c]/35 bg-[#ff747c]/8 px-4 py-3 text-xs font-bold text-[#ff9ba0]">{error}</div>}
    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-[#30415c] px-5 py-3 text-xs font-extrabold text-[#c5d1df] disabled:opacity-40">CANCEL</button><button type="button" onClick={onSave} disabled={saving||draft.length<1||draft.length>8} className="rounded-xl bg-[#59e8f3] px-5 py-3 text-xs font-black text-[#062029] disabled:opacity-35">{saving?'SAVING…':'SAVE CHANGES'}</button></div>
  </div>;
};

const GamePredictionCard=({card,finished,now,onUpdated}:{card:Card;finished?:boolean;now:number;onUpdated?:(card:Card)=>void})=>{
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState<Selection[]>([]);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const selections=(card.selections||[]).filter(s=>finished?(s.result&&s.result!=='pending'):true);
  const correct=selections.filter(s=>s.result==='correct').length;
  const missed=selections.filter(s=>s.result==='incorrect').length;
  const {away,home}=matchupTeams(card);
  const gameDate=cardDate(card);
  const editable=!finished&&card.status==='upcoming'&&Number.isFinite(gameDate.getTime())&&gameDate.getTime()>now;

  const beginEdit=()=>{if(!editable)return;setDraft(selections.map(selection=>({...selection})));setMessage(null);setEditing(true);setOpen(true);};
  const cancelEdit=()=>{if(saving)return;setEditing(false);setDraft([]);setMessage(null);};
  const save=async()=>{
    if(!editable){setMessage('This game has started, so its predictions are locked.');return;}
    if(!draft.length||draft.length>8){setMessage('Keep between 1 and 8 predictions on this card.');return;}
    if(!supabase||!card.id){setMessage('ScoutCore could not save this card. Please refresh and try again.');return;}
    setSaving(true);setMessage(null);
    const{data,error}=await supabase.rpc('update_upcoming_challenge_card',{p_card_id:card.id,p_selections:draft});
    setSaving(false);
    if(error){const locked=/lock|start|finish/i.test(error.message||'');setMessage(locked?'This game has started, so its predictions are locked.':'ScoutCore could not save these changes yet. Please try again.');return;}
    const saved=(data&&typeof data==='object'&&!Array.isArray(data)?data:{}) as Record<string,any>;
    const updated={...card,selections:Array.isArray(saved.selections)?saved.selections:draft,total_count:Number(saved.total_count??draft.length),status:String(saved.status||card.status||'upcoming')};
    onUpdated?.(updated);setEditing(false);setDraft([]);setMessage('✓ Predictions saved.');setOpen(true);
  };

  return <section className="overflow-hidden rounded-2xl border border-[#2a405b] bg-[#101a2d]">
    <div className="flex items-center justify-between bg-[#0d1728] px-4 py-3 text-xs text-[#9fb0c5]"><b className="text-white">{new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(gameDate)}</b><span>{selections.length} pick{selections.length===1?'':'s'}</span></div>
    <button type="button" onClick={()=>setOpen(value=>!value)} className="w-full px-4 py-4 text-left sm:px-5">
      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3">
        <div className="min-w-0"><div className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#7d90a8]">Away</div><div className="mt-1 truncate text-base font-black text-white sm:text-lg">{away}</div></div>
        <div className="text-xs font-black uppercase tracking-[.12em] text-[#72869f]">vs</div>
        <div className="min-w-0 text-right"><div className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#7d90a8]">Home</div><div className="mt-1 truncate text-base font-black text-white sm:text-lg">{home}</div></div>
        <span className={`material-symbols-outlined shrink-0 text-[#59e8f3] transition-transform ${open?'rotate-180':''}`}>expand_more</span>
      </div>
    </button>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#22354d] px-4 py-3 sm:px-5">
      <button type="button" onClick={()=>setOpen(value=>!value)} className="flex items-center gap-1 text-xs font-bold text-[#91a2b8]"><span>{open?'Hide':'View'} picks</span><span className="material-symbols-outlined text-[16px]">{open?'expand_less':'expand_more'}</span></button>
      {finished?<div className="flex items-center gap-2 text-xs font-extrabold"><span className="rounded-lg bg-[#16d99a]/12 px-2.5 py-1 text-[#55f1bd]">✓ {correct} correct</span><span className="rounded-lg bg-[#ff515a]/12 px-2.5 py-1 text-[#ff747c]">✕ {missed} missed</span></div>:<div className="flex flex-wrap items-center justify-end gap-2"><span className={`flex items-center gap-1 text-[10px] font-extrabold ${editable?'text-[#70efc2]':'text-[#9aabc0]'}`}><span className="material-symbols-outlined text-[15px]">{editable?'schedule':'lock'}</span>{lockCountdown(gameDate,now)}</span>{editable&&!editing&&<button type="button" onClick={beginEdit} className="flex items-center gap-1.5 rounded-lg border border-[#59e8f3] px-3 py-2 text-[11px] font-black text-[#59e8f3]"><span className="material-symbols-outlined text-[17px]">edit</span>EDIT PREDICTIONS</button>}</div>}
    </div>
    {message&&!editing&&<div className={`border-t px-4 py-3 text-xs font-bold sm:px-5 ${message.startsWith('✓')?'border-[#55f1bd]/25 bg-[#55f1bd]/6 text-[#70efc2]':'border-[#ff747c]/25 bg-[#ff747c]/6 text-[#ff9ba0]'}`}>{message}</div>}
    {open&&!editing&&<div className="border-t border-[#2a405b] bg-[#0c1729]">{selections.map((selection,index)=><PickDetail key={selection.id||index} s={selection} finished={finished}/>)}</div>}
    {editing&&<PredictionEditor card={card} draft={draft} onChange={(index,next)=>setDraft(current=>current.map((selection,position)=>position===index?next:selection))} onRemove={index=>setDraft(current=>current.filter((_,position)=>position!==index))} onCancel={cancelEdit} onSave={save} saving={saving} error={message}/>}
    {!finished&&<div className="border-t border-[#22354d] bg-[#0b1527] px-4 py-2.5 text-center text-[10px] text-[#718198]">{editable?`Editable until ${lockTimeLabel(gameDate)}.`:'Started games and finished predictions cannot be changed.'}</div>}
  </section>;
};

const OverviewMetric=({icon,label,value,sub,accent}:{icon:string;label:string;value:string;sub:string;accent:string})=><article className="flex min-h-[116px] min-w-0 flex-col items-center justify-center border-b border-r border-[#263951] px-1 py-3 text-center [&:nth-child(4n)]:border-r-0 [&:nth-child(n+5)]:border-b-0 sm:min-h-[132px] sm:px-2"><span className="material-symbols-outlined text-[25px] sm:text-[31px]" style={{color:accent}}>{icon}</span><div className="mt-1.5 min-h-[22px] text-[7px] font-semibold uppercase leading-[11px] tracking-[.04em] text-[#91a1b5] sm:min-h-0 sm:text-[10px] sm:leading-4">{label}</div><div className="mt-1 text-base font-black leading-tight text-white sm:text-xl">{value}</div><div className="mt-1 min-h-[24px] text-[9px] font-extrabold leading-3 sm:min-h-0 sm:text-xs sm:leading-4" style={{color:accent}}>{sub}</div></article>;

const OverviewSection=({correct,total,allTotal,points,weeklyPoints,currentStreak,bestStreak,rankLabel,onViewAll}:{correct:number;total:number;allTotal:number;points:number;weeklyPoints:number;currentStreak:number;bestStreak:number;rankLabel:string;onViewAll:()=>void})=>{
  const accuracy=pct(correct,total);
  const average=total?(total/30).toFixed(1):'0';
  return <section className="overflow-hidden rounded-2xl border border-[#2a405b] bg-[#101a2d]">
    <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5"><h3 className="text-base font-extrabold text-white sm:text-lg">Overview <span className="font-medium text-[#8fa0b5]">(Last 30 days)</span></h3><button type="button" onClick={onViewAll} className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-extrabold text-[#70e5ea] transition-colors hover:bg-[#70e5ea]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#70e5ea] sm:text-sm">View all stats ›</button></div>
    <div className="mx-3 mb-3 grid grid-cols-4 overflow-hidden rounded-xl border border-[#263951] bg-[#0b1527] sm:mx-5 sm:mb-5"><OverviewMetric icon="track_changes" label="Correct Picks" value={`${correct}/${total}`} sub={`${accuracy}%`} accent="#5ee7ef"/><OverviewMetric icon="pie_chart" label="Accuracy" value={`${accuracy}%`} sub={accuracy>=50?'Above average':'Keep going'} accent="#628cff"/><OverviewMetric icon="local_fire_department" label="Current Streak" value={String(currentStreak)} sub="Keep going" accent="#b861e6"/><OverviewMetric icon="star" label="Best Streak" value={String(bestStreak)} sub="Personal best" accent="#f0b14f"/><OverviewMetric icon="assignment_turned_in" label="Total Predictions" value={String(allTotal)} sub="All time" accent="#66d89d"/><OverviewMetric icon="monitoring" label="Avg. Picks / Day" value={average} sub="Last 30 days" accent="#628cff"/><OverviewMetric icon="workspace_premium" label="ScoutCore Points" value={points.toLocaleString()} sub={`+${weeklyPoints.toLocaleString()} this week`} accent="#b861e6"/><OverviewMetric icon="groups" label="Predictor Rank" value={rankLabel} sub="Out of all users" accent="#f0b14f"/></div>
  </section>;
};

const categoryStyles:Record<string,{short:string;color:string}>={
  'Game Winner':{short:'W',color:'#42e5eb'},Hits:{short:'H',color:'#42e5eb'},'Home Run':{short:'HR',color:'#5687ff'},RBI:{short:'RBI',color:'#b55be7'},Runs:{short:'R',color:'#62d2ff'},Walks:{short:'BB',color:'#7bc6ff'},'Stolen Bases':{short:'SB',color:'#eab14d'},Strikeouts:{short:'K',color:'#59d477'},'Pitcher Strikeouts':{short:'K',color:'#59d477'},'Pitcher Innings':{short:'IP',color:'#42e5eb'},'Hits Allowed':{short:'HA',color:'#5687ff'},'Earned Runs':{short:'ER',color:'#ff7c73'},'Pitcher Walks':{short:'BB',color:'#b55be7'},'Quality Start':{short:'QS',color:'#eab14d'},'Total Bases':{short:'TB',color:'#eab14d'},'First Inning':{short:'1',color:'#42e5eb'},'First Team to Score':{short:'1ST',color:'#5687ff'},'Team Runs':{short:'TR',color:'#b55be7'},'Team Hits':{short:'TH',color:'#59d477'},'Extra Innings':{short:'EI',color:'#eab14d'},
};

type StatsCategoryDefinition={name:string;group:Exclude<StatsGroup,'all'>;matches:(selection:Selection)=>boolean};
const statsCategoryDefinitions:StatsCategoryDefinition[]=[
  {name:'Hits',group:'hitting',matches:selection=>selectionKey(selection).includes('hitter_hit')},
  {name:'Home Run',group:'hitting',matches:selection=>selectionKey(selection).includes('hitter_home_run')},
  {name:'RBI',group:'hitting',matches:selection=>selectionKey(selection).includes('hitter_rbi')},
  {name:'Runs',group:'hitting',matches:selection=>selectionKey(selection).includes('hitter_runs')},
  {name:'Walks',group:'hitting',matches:selection=>selectionKey(selection).includes('hitter_walks')},
  {name:'Stolen Bases',group:'hitting',matches:selection=>selectionKey(selection).includes('hitter_stolen_bases')},
  {name:'Total Bases',group:'hitting',matches:selection=>selectionKey(selection).includes('hitter_total_base')},
  {name:'Pitcher Strikeouts',group:'pitching',matches:selection=>selectionKey(selection).includes('pitcher_strikeouts')},
  {name:'Pitcher Innings',group:'pitching',matches:selection=>selectionKey(selection).includes('pitcher_innings')},
  {name:'Hits Allowed',group:'pitching',matches:selection=>selectionKey(selection).includes('pitcher_hits_allowed')},
  {name:'Earned Runs',group:'pitching',matches:selection=>selectionKey(selection).includes('pitcher_earned_runs')},
  {name:'Pitcher Walks',group:'pitching',matches:selection=>selectionKey(selection).includes('pitcher_walks')},
  {name:'Quality Start',group:'pitching',matches:selection=>selectionKey(selection).includes('pitcher_quality_start')},
  {name:'Game Winner',group:'game',matches:selection=>selectionKey(selection).includes('team_winner')},
  {name:'First Inning',group:'game',matches:selection=>selectionKey(selection).includes('game_first_inning')},
  {name:'First Team to Score',group:'game',matches:selection=>selectionKey(selection).includes('game_first_team_score')},
  {name:'Team Runs',group:'game',matches:selection=>selectionKey(selection).includes('team_runs')},
  {name:'Team Hits',group:'game',matches:selection=>selectionKey(selection).includes('team_hits')},
  {name:'Extra Innings',group:'game',matches:selection=>selectionKey(selection).includes('game_extra_innings')},
];

const CategoryAccuracySection=({rows,onViewAll}:{rows:Array<{name:string;correct:number;total:number}>;onViewAll:()=>void})=><section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-base font-extrabold text-white sm:text-lg">Category Accuracy <span className="font-medium text-[#8fa0b5]">(Last 30 days)</span></h3><button type="button" onClick={onViewAll} className="shrink-0 rounded-lg px-2 py-1 text-xs font-extrabold text-[#70e5ea] transition-colors hover:bg-[#70e5ea]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#70e5ea] sm:text-sm">View all</button></div><div className="mt-4 space-y-3.5">{rows.map(({name,correct,total})=>{const accuracy=pct(correct,total);const style=categoryStyles[name]||{short:name.slice(0,2).toUpperCase(),color:'#70e5ea'};return <div key={name} className="grid grid-cols-[26px_78px_minmax(0,1fr)_42px] items-center gap-2 sm:grid-cols-[30px_120px_minmax(0,1fr)_56px] sm:gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full border text-[8px] font-black sm:h-7 sm:w-7 sm:text-[9px]" style={{borderColor:style.color,color:style.color}}>{style.short}</span><span className="text-[11px] font-extrabold leading-4 text-white sm:text-sm">{name}</span><div className="h-1.5 overflow-hidden rounded-full bg-[#22324b]"><div className="h-full rounded-full" style={{width:`${accuracy}%`,backgroundColor:style.color}}/></div><span className="text-right leading-tight"><b className="block text-xs text-white sm:text-sm">{accuracy}%</b><small className="block text-[8px] text-[#8091a7] sm:text-[10px]">{correct} / {total}</small></span></div>})}</div></section>;

type RecentFormDay={key:string;label:string;won:boolean};
const RecentFormSection=({days}:{days:RecentFormDay[]})=>{
  const wins=days.filter(day=>day.won).length;
  return <section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-base font-extrabold text-white sm:text-lg">Recent Form <span className="font-medium text-[#8fa0b5]">(Last 10 days)</span></h3><span className="text-xs font-extrabold text-[#63df88] sm:text-sm">{days.length?`${wins}W – ${days.length-wins}L`:'—'}</span></div>{days.length?<div className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-10">{days.map(day=><div key={day.key} className="flex flex-col items-center"><span className={`flex h-8 w-8 items-center justify-center rounded-full border text-lg font-black ${day.won?'border-[#5bd77c] text-[#5bd77c]':'border-[#ff5d6a] text-[#ff5d6a]'}`}>{day.won?'✓':'×'}</span><span className="mt-1.5 text-[9px] text-[#9aabc0]">{day.label}</span></div>)}</div>:<p className="mt-4 text-center text-xs text-[#8fa0b5]">Your recent form will appear after your first finished prediction.</p>}</section>;
};

const KeepGoingCard=({rankLabel}:{rankLabel:string})=><section className="flex items-center gap-4 rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4 sm:p-5"><span className="material-symbols-outlined text-[38px] text-[#59e8f3]">emoji_events</span><div className="min-w-0 flex-1"><h3 className="font-extrabold text-white">Keep it going!</h3><p className="mt-0.5 text-xs leading-5 text-[#91a2b8]">{rankLabel==='—'?'Complete 20 ranked predictions to join the predictor rankings.':`You’re in the ${rankLabel.toLowerCase()} of predictors. Make smart picks and climb higher!`}</p></div><span className="material-symbols-outlined text-[#8fa0b5]">chevron_right</span></section>;

type DetailCategory={name:string;group:Exclude<StatsGroup,'all'>;correct:number;total:number};
type DetailResult={key:string;date:string;subject:string;market:string;result:'correct'|'incorrect'};
const statsRangeLabels:Record<StatsRange,string>={'7d':'7 days','30d':'30 days',season:'Season',all:'All time'};
const statsGroupLabels:Record<StatsGroup,string>={all:'All',hitting:'Hitting',pitching:'Pitching',game:'Game picks'};

const FullStatisticsView=({onBack,range,onRangeChange,group,onGroupChange,categories,results,correct,total,points,currentStreak,bestStreak,rankLabel}:{onBack:()=>void;range:StatsRange;onRangeChange:(range:StatsRange)=>void;group:StatsGroup;onGroupChange:(group:StatsGroup)=>void;categories:DetailCategory[];results:DetailResult[];correct:number;total:number;points:number;currentStreak:number;bestStreak:number;rankLabel:string})=>{
  const accuracy=pct(correct,total);
  const visibleCategories=categories.filter(category=>group==='all'||category.group===group);
  const rankedCategories=categories.filter(category=>category.total>0).sort((a,b)=>pct(b.correct,b.total)-pct(a.correct,a.total)||b.total-a.total);
  const strongest=rankedCategories[0];
  const focus=rankedCategories.length>1?rankedCategories[rankedCategories.length-1]:null;
  return <div className="min-h-screen bg-[#081225] px-4 py-5 text-[#dae2fd] sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl">
    <header className="flex items-center gap-3"><button type="button" onClick={onBack} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#2d4059] bg-[#101a2d] text-white" aria-label="Back to prediction statistics"><span className="material-symbols-outlined">arrow_back</span></button><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#65f2b5]">My Predictions</p><h1 className="text-2xl font-black text-white sm:text-3xl">All Statistics</h1><p className="mt-0.5 text-xs text-[#8fa0b5]">A detailed view of your prediction performance.</p></div></header>

    <section className="mt-5 rounded-2xl border border-[#2a405b] bg-[#101a2d] p-3 sm:p-4"><p className="px-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#8798ad]">Date range</p><div className="mt-2 grid grid-cols-4 gap-2">{(Object.keys(statsRangeLabels) as StatsRange[]).map(value=><button key={value} type="button" onClick={()=>onRangeChange(value)} className={`min-w-0 rounded-xl border px-1 py-2.5 text-[10px] font-extrabold sm:text-sm ${range===value?'border-[#59e8f3] bg-[#59e8f3] text-[#062029]':'border-[#30415c] bg-[#0b1527] text-[#a7b5c6]'}`}>{statsRangeLabels[value]}</button>)}</div></section>

    <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><article className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4"><span className="material-symbols-outlined text-[#59e8f3]">track_changes</span><p className="mt-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#8798ad]">Correct Picks</p><p className="mt-1 text-2xl font-black text-white">{correct}/{total}</p></article><article className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4"><span className="material-symbols-outlined text-[#628cff]">pie_chart</span><p className="mt-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#8798ad]">Accuracy</p><p className="mt-1 text-2xl font-black text-white">{accuracy}%</p></article><article className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4"><span className="material-symbols-outlined text-[#b861e6]">local_fire_department</span><p className="mt-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#8798ad]">Current Streak</p><p className="mt-1 text-2xl font-black text-white">{currentStreak}</p></article><article className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4"><span className="material-symbols-outlined text-[#f0b14f]">workspace_premium</span><p className="mt-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#8798ad]">ScoutCore Points</p><p className="mt-1 text-2xl font-black text-white">{points.toLocaleString()}</p></article></section>

    <section className="mt-4 rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-extrabold text-white">Full Category Breakdown</h2><p className="mt-0.5 text-xs text-[#8fa0b5]">Accuracy and settled picks for {statsRangeLabels[range].toLowerCase()}.</p></div><span className="rounded-lg border border-[#30415c] px-2.5 py-1 text-[10px] font-bold text-[#a7b5c6]">{total} settled</span></div><div className="mt-4 grid grid-cols-4 gap-2">{(Object.keys(statsGroupLabels) as StatsGroup[]).map(value=><button key={value} type="button" onClick={()=>onGroupChange(value)} className={`min-w-0 rounded-lg border px-1 py-2 text-[9px] font-extrabold sm:text-xs ${group===value?'border-[#59e8f3] bg-[#59e8f3]/10 text-[#59e8f3]':'border-[#30415c] text-[#9aabc0]'}`}>{statsGroupLabels[value]}</button>)}</div><div className="mt-5 space-y-4">{visibleCategories.map(category=>{const style=categoryStyles[category.name]||{short:category.name.slice(0,2).toUpperCase(),color:'#70e5ea'};const value=pct(category.correct,category.total);return <div key={category.name} className="grid grid-cols-[28px_100px_minmax(0,1fr)_48px] items-center gap-2 sm:grid-cols-[30px_150px_minmax(0,1fr)_64px] sm:gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full border text-[8px] font-black" style={{borderColor:style.color,color:style.color}}>{style.short}</span><span className="text-[11px] font-extrabold leading-4 text-white sm:text-sm">{category.name}</span><div className="h-1.5 overflow-hidden rounded-full bg-[#22324b]"><div className="h-full rounded-full" style={{width:`${value}%`,backgroundColor:style.color}}/></div><span className="text-right leading-tight"><b className="block text-xs text-white sm:text-sm">{value}%</b><small className="block text-[8px] text-[#8091a7] sm:text-[10px]">{category.correct}/{category.total}</small></span></div>})}</div></section>

    <section className="mt-4 rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold text-white">Recent Results</h2><p className="mt-0.5 text-xs text-[#8fa0b5]">Your latest settled predictions in this range.</p></div><span className="text-xs font-extrabold text-[#70e5ea]">Last {Math.min(results.length,20)}</span></div>{results.length?<div className="mt-4 overflow-hidden rounded-xl border border-[#263951]">{results.slice(0,20).map(result=><article key={result.key} className="flex items-center gap-3 border-b border-[#263951] bg-[#0b1527] px-3 py-3 last:border-b-0"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-black ${result.result==='correct'?'border-[#55d87a] text-[#55d87a]':'border-[#ff5d6a] text-[#ff5d6a]'}`}>{result.result==='correct'?'✓':'×'}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-white sm:text-sm">{result.subject}</p><p className="mt-0.5 truncate text-[10px] text-[#8fa0b5]">{result.market}</p></div><div className="shrink-0 text-right"><p className={`text-[10px] font-extrabold uppercase ${result.result==='correct'?'text-[#55d87a]':'text-[#ff747c]'}`}>{result.result==='correct'?'Correct':'Missed'}</p><p className="mt-0.5 text-[9px] text-[#718198]">{result.date}</p></div></article>)}</div>:<p className="mt-5 rounded-xl border border-dashed border-[#30415c] px-4 py-8 text-center text-xs text-[#8fa0b5]">No finished predictions in this date range yet.</p>}</section>

    <section className="mt-4 rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4 sm:p-5"><h2 className="text-lg font-extrabold text-white">ScoutCore Insights</h2>{strongest?<div className="mt-4 grid gap-3 sm:grid-cols-2"><article className="rounded-xl border border-[#55d87a]/25 bg-[#55d87a]/5 p-4"><p className="text-[10px] font-black uppercase tracking-[.1em] text-[#55d87a]">Strongest category</p><p className="mt-1 text-base font-extrabold text-white">{strongest.name}</p><p className="mt-1 text-xs text-[#9aabc0]">{pct(strongest.correct,strongest.total)}% accuracy · {strongest.correct}/{strongest.total} correct</p></article><article className="rounded-xl border border-[#f0b14f]/25 bg-[#f0b14f]/5 p-4"><p className="text-[10px] font-black uppercase tracking-[.1em] text-[#f0b14f]">Focus next</p><p className="mt-1 text-base font-extrabold text-white">{focus?.name||'Build your sample'}</p><p className="mt-1 text-xs text-[#9aabc0]">{focus?`${pct(focus.correct,focus.total)}% accuracy · ${focus.correct}/${focus.total} correct`:'Complete more categories for a useful comparison.'}</p></article></div>:<p className="mt-4 text-xs leading-5 text-[#8fa0b5]">Complete your first prediction to unlock personalized category insights.</p>}<div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold text-[#91a2b8]"><span className="rounded-lg border border-[#30415c] px-2.5 py-1.5">Best streak: {bestStreak}</span><span className="rounded-lg border border-[#30415c] px-2.5 py-1.5">Rank: {rankLabel}</span></div></section>

    <p className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#263951] px-4 py-3 text-center text-[10px] text-[#8191a6]"><span className="material-symbols-outlined text-[16px]">shield</span>ScoutCore predictions are free—no money or prizes.</p>
  </div></div>;
};

export const MyPredictionsView:React.FC<{onBack:()=>void}>=({onBack})=>{
  const [tab,setTab]=useState<Tab>('upcoming'); const [cards,setCards]=useState<Card[]>([]); const [score,setScore]=useState<Score|null>(null); const [scoreRows,setScoreRows]=useState<Score[]>([]); const [loading,setLoading]=useState(true); const [now,setNow]=useState(Date.now()); const [showAllStats,setShowAllStats]=useState(false); const [statsRange,setStatsRange]=useState<StatsRange>('30d'); const [statsGroup,setStatsGroup]=useState<StatsGroup>('all');
  useEffect(()=>{(async()=>{if(!supabase){setLoading(false);return;}const{data:u}=await supabase.auth.getUser();const id=u.user?.id;if(!id){setLoading(false);return;}const[c,s]=await Promise.all([supabase.from('challenge_cards').select('*').eq('user_id',id).order('created_at',{ascending:false}).limit(500),supabase.from('challenge_scores').select('*').limit(1000)]);if(!c.error)setCards((c.data??[]) as Card[]);if(!s.error){const rows=(s.data??[]) as Score[];setScoreRows(rows);setScore(rows.find(row=>row.user_id===id)??null);}setLoading(false);})()},[]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30000);return()=>window.clearInterval(timer);},[]);
  const updateCard=(updated:Card)=>setCards(current=>current.map(card=>card.id===updated.id?updated:card));
  const upcoming=useMemo(()=>cards.filter(c=>c.status==='upcoming'||(c.selections||[]).some(s=>!s.result||s.result==='pending')),[cards]);
  const finished=useMemo(()=>cards.filter(c=>c.status==='finished'||(c.selections||[]).some(s=>s.result==='correct'||s.result==='incorrect'||s.result==='void')),[cards]);
  const monthCards=useMemo(()=>finished.filter(c=>(Date.now()-cardDate(c).getTime())<=30*86400000),[finished]);
  const monthSelections=useMemo(()=>monthCards.flatMap(c=>c.selections||[]).filter(s=>s.result==='correct'||s.result==='incorrect'),[monthCards]); const allSelections=useMemo(()=>finished.flatMap(c=>c.selections||[]).filter(s=>s.result==='correct'||s.result==='incorrect'),[finished]);
  const monthCorrect=Number(score?.monthly_correct_picks??monthSelections.filter(s=>s.result==='correct').length),monthTotal=Number(score?.monthly_total_picks??monthSelections.length); const allTotal=Number(score?.total_picks??allSelections.length);
  const predictorStanding=useMemo(()=>{const eligible=[...scoreRows].filter(row=>Number(row.total_picks||0)>=20).sort((a,b)=>pct(Number(b.correct_picks||0),Number(b.total_picks||0))-pct(Number(a.correct_picks||0),Number(a.total_picks||0))||Number(b.correct_picks||0)-Number(a.correct_picks||0)||Number(b.current_streak||0)-Number(a.current_streak||0)||Number(b.points||0)-Number(a.points||0));const index=eligible.findIndex(row=>Boolean(row.user_id)&&row.user_id===score?.user_id);return index>=0?{rank:index+1,percentile:Math.max(1,Math.ceil((index+1)/eligible.length*100))}:null;},[scoreRows,score?.user_id]);
  const categoryAccuracy=useMemo(()=>{
    const definitions:Array<[string,(selection:Selection)=>boolean]>=[
      ['Game Winner',selection=>{const key=selectionKey(selection);return key.includes('team_winner')||key.includes('game winner')||key.includes('who wins');}],
      ['Home Run',selection=>{const key=selectionKey(selection);return key.includes('home_run')||key.includes('home run');}],
      ['RBI',selection=>{const key=selectionKey(selection);return key.includes('hitter_rbi')||/\brbi\b/.test(key);}],
      ['Strikeouts',selection=>selectionKey(selection).includes('strikeout')],
      ['Total Bases',selection=>{const key=selectionKey(selection);return key.includes('total_base')||key.includes('total bases');}],
    ];
    return definitions.map(([name,matches])=>{const selections=monthSelections.filter(matches);return{name,correct:selections.filter(selection=>selection.result==='correct').length,total:selections.length};});
  },[monthSelections]);
  const recentForm=useMemo<RecentFormDay[]>(()=>{
    const byDay=new Map<string,{date:Date;correct:number;incorrect:number}>();
    finished.forEach(card=>{
      const date=cardDate(card);if(!Number.isFinite(date.getTime()))return;
      const key=`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const entry=byDay.get(key)||{date,correct:0,incorrect:0};
      (card.selections||[]).forEach(selection=>{if(selection.result==='correct')entry.correct+=1;if(selection.result==='incorrect')entry.incorrect+=1;});
      if(entry.correct||entry.incorrect)byDay.set(key,entry);
    });
    return [...byDay.entries()].sort((a,b)=>a[1].date.getTime()-b[1].date.getTime()).slice(-10).map(([key,entry])=>({key,label:new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(entry.date),won:entry.correct>entry.incorrect}));
  },[finished]);
  const rankLabel=predictorStanding?`Top ${predictorStanding.percentile}%`:'—';
  const detailCards=useMemo(()=>{
    if(statsRange==='all')return finished;
    const cutoff=statsRange==='7d'?now-7*86400000:statsRange==='30d'?now-30*86400000:new Date(new Date(now).getFullYear(),0,1).getTime();
    return finished.filter(card=>cardDate(card).getTime()>=cutoff);
  },[finished,statsRange,now]);
  const detailSelections=useMemo(()=>detailCards.flatMap(card=>(card.selections||[]).filter(selection=>selection.result==='correct'||selection.result==='incorrect')),[detailCards]);
  const detailCategories=useMemo<DetailCategory[]>(()=>statsCategoryDefinitions.map(definition=>{const selections=detailSelections.filter(definition.matches);return{name:definition.name,group:definition.group,correct:selections.filter(selection=>selection.result==='correct').length,total:selections.length};}),[detailSelections]);
  const detailResults=useMemo<DetailResult[]>(()=>detailCards.flatMap((card,cardIndex)=>{const date=cardDate(card);return(card.selections||[]).map((selection,selectionIndex)=>({selection,selectionIndex})).filter(({selection})=>selection.result==='correct'||selection.result==='incorrect').map(({selection,selectionIndex})=>({key:`${card.id||cardIndex}-${selection.id||selectionIndex}`,date:new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(date),subject:subjectLabel(selection),market:marketLabel(selection),result:selection.result as 'correct'|'incorrect',time:date.getTime()}));}).sort((a,b)=>b.time-a.time).map(({time,...result})=>result),[detailCards]);
  const detailCorrect=detailSelections.filter(selection=>selection.result==='correct').length;

  if(showAllStats)return <FullStatisticsView onBack={()=>setShowAllStats(false)} range={statsRange} onRangeChange={setStatsRange} group={statsGroup} onGroupChange={setStatsGroup} categories={detailCategories} results={detailResults} correct={detailCorrect} total={detailSelections.length} points={Number(score?.points||0)} currentStreak={Number(score?.current_streak||0)} bestStreak={Number(score?.best_streak||0)} rankLabel={rankLabel}/>;

  return <div className="min-h-screen bg-[#081225] px-4 py-5 text-[#dae2fd] sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl"><div className="flex items-center gap-3"><button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2d4059] bg-[#101a2d] text-white"><span className="material-symbols-outlined">arrow_back</span></button><div><h1 className="text-2xl font-black text-white sm:text-3xl">My Predictions</h1><p className="text-xs text-[#8fa0b5]">Track your picks, results and performance.</p></div></div><div className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-[#2a405b] bg-[#0b1527]">{predictionTabs.map(({id,icon,label})=><button key={id} onClick={()=>setTab(id)} className={`flex min-w-0 flex-col items-center justify-center border-b-4 border-r border-r-[#2a405b] px-1 py-3 font-extrabold last:border-r-0 sm:px-2 ${tab===id?'border-b-[#59e8f3] bg-[#0d2030] text-[#59e8f3]':'border-b-transparent text-[#9aabc0]'}`}><span className="material-symbols-outlined text-[28px] leading-none sm:text-[32px]">{icon}</span><span className="mt-1 whitespace-nowrap text-[12px] leading-tight sm:text-sm">{label}{id==='upcoming'&&` (${upcoming.length})`}{id==='finished'&&` (${finished.length})`}</span></button>)}</div>{loading?<div className="py-20 text-center text-sm text-[#8fa0b5]">Loading predictions…</div>:<div className="mt-5">{tab==='upcoming'&&<div className="space-y-4">{upcoming.length?upcoming.map((c,i)=><GamePredictionCard key={c.id||i} card={c} now={now} onUpdated={updateCard}/>):<Empty text="No upcoming predictions yet. Your ScoutCore Challenge picks will appear here."/>}</div>}{tab==='finished'&&<div className="space-y-4">{finished.length?finished.map((c,i)=><GamePredictionCard key={c.id||i} card={c} finished now={now}/>):<Empty text="No finished predictions yet."/>}</div>}{tab==='statistics'&&<div className="space-y-4"><OverviewSection correct={monthCorrect} total={monthTotal} allTotal={allTotal} points={Number(score?.points||0)} weeklyPoints={Number(score?.weekly_points||0)} currentStreak={Number(score?.current_streak||0)} bestStreak={Number(score?.best_streak||0)} rankLabel={rankLabel} onViewAll={()=>setShowAllStats(true)}/><CategoryAccuracySection rows={categoryAccuracy} onViewAll={()=>setShowAllStats(true)}/><RecentFormSection days={recentForm}/><KeepGoingCard rankLabel={rankLabel}/></div>}</div>}</div></div>;
};
const Empty=({text}:{text:string})=><div className="rounded-2xl border border-dashed border-[#31445f] bg-[#0e192b] px-5 py-16 text-center text-sm text-[#8fa0b5]">{text}</div>;
