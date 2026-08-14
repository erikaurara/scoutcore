import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

type Tab = 'upcoming' | 'finished' | 'statistics';
type Selection = Record<string, any> & { result?: 'pending' | 'correct' | 'incorrect' | 'void' | null };
type Card = Record<string, any> & { status?: string | null; selections?: Selection[] | null; created_at?: string | null; settled_at?: string | null };
type Score = Record<string, any> & {
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
const resultLabel=(s:Selection)=>String(s.resultValue??s.result_value??s.actual_result??s.result_detail??'Final result recorded');
const cardDate=(card:Card)=>new Date(card.game_date||card.gameDate||card.created_at||Date.now());
const teamName=(team:any)=>String(team?.name||team?.teamName||team||'').trim();
const matchupLabel=(card:Card)=>{
  const away=teamName(card.away_team||card.awayTeam);
  const home=teamName(card.home_team||card.homeTeam);
  if(away&&home)return `${away} vs ${home}`;
  const first=(card.selections||[])[0];
  if(first){
    const a=teamName(first.away_team||first.awayTeam);
    const h=teamName(first.home_team||first.homeTeam);
    if(a&&h)return `${a} vs ${h}`;
    if(first.teamName||first.team_name)return String(first.teamName||first.team_name);
  }
  return 'MLB Game';
};

const PickDetail=({s,finished}:{s:Selection;finished?:boolean})=>{
  const p=projection(s); const good=s.result==='correct';
  return <div className="border-t border-[#263951] px-4 py-4 sm:px-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-base font-extrabold text-white">{subjectLabel(s)}</div>
        <div className="mt-0.5 text-sm font-bold text-[#d9e5f5]">{marketLabel(s)}</div>
      </div>
      {finished?<span className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-extrabold ${good?'bg-[#16d99a]/12 text-[#55f1bd]':'bg-[#ff515a]/12 text-[#ff747c]'}`}>{good?'✓ CORRECT':s.result==='void'?'VOID':'✕ MISSED'}</span>:<span className="shrink-0 rounded-xl border border-[#00e6f4] px-3 py-1.5 text-xs font-black text-[#5cecf4]">YOUR PICK</span>}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9aabc0]">
      <span>{finished?`Result: ${resultLabel(s)}`:'Upcoming'}</span>
      {p>0&&<span>ScoutCore when picked: <b className="text-[#59e8f3]">{Math.round(p<=1?p*100:p)}%</b></span>}
    </div>
    {!finished&&p>0&&<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#22324b]"><div className="h-full rounded-full bg-[#59e8f3]" style={{width:`${Math.min(100,Math.round(p<=1?p*100:p))}%`}}/></div>}
  </div>;
};

const GamePredictionCard=({card,finished}:{card:Card;finished?:boolean})=>{
  const [open,setOpen]=useState(false);
  const selections=(card.selections||[]).filter(s=>finished?(s.result&&s.result!=='pending'):true);
  const correct=selections.filter(s=>s.result==='correct').length;
  return <section className="overflow-hidden rounded-2xl border border-[#2a405b] bg-[#101a2d]">
    <button type="button" onClick={()=>setOpen(v=>!v)} className="w-full text-left">
      <div className="flex items-center justify-between bg-[#0d1728] px-4 py-3 text-xs text-[#9fb0c5]">
        <b className="text-white">{new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(cardDate(card))}</b>
        <span>{selections.length} pick{selections.length===1?'':'s'}</span>
      </div>
      <div className="flex items-center gap-4 px-4 py-5 sm:px-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2f4968] bg-[#0a1629] text-[#59e8f3]"><span className="material-symbols-outlined">sports_baseball</span></div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#7d90a8]">Team Prediction</div>
          <div className="mt-1 truncate text-lg font-black text-white">{matchupLabel(card)}</div>
          <div className="mt-1 text-xs text-[#91a2b8]">Tap to {open?'hide':'see'} who you picked</div>
        </div>
        {finished&&<div className="hidden text-right sm:block"><div className="text-xs text-[#91a2b8]">Correct</div><div className="text-base font-black text-[#59e8f3]">{correct}/{selections.length}</div></div>}
        <span className={`material-symbols-outlined shrink-0 text-[#59e8f3] transition-transform ${open?'rotate-180':''}`}>expand_more</span>
      </div>
    </button>
    {open&&<div className="border-t border-[#2a405b] bg-[#0c1729]">{selections.map((s,j)=><PickDetail key={s.id||j} s={s} finished={finished}/>)}</div>}
  </section>;
};

const StatCard=({title,correct,total,streak,best}:{title:string;correct:number;total:number;streak:number;best:number})=><section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><h3 className="text-lg font-extrabold text-white">{title}</h3><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5"><Metric label="Correct predictions" value={`${correct}/${total}`} sub={`${pct(correct,total)}%`}/><Metric label="Accuracy" value={`${pct(correct,total)}%`}/><Metric label="Current streak" value={String(streak)}/><Metric label="Best streak" value={String(best)}/><Metric label="Total predictions" value={String(total)}/></div></section>;
const Metric=({label,value,sub}:{label:string;value:string;sub?:string})=><div className="rounded-xl border border-[#263951] bg-[#0b1527] p-3 text-center"><div className="text-[10px] uppercase tracking-wide text-[#8394aa]">{label}</div><div className="mt-1 text-xl font-black text-[#59e8f3]">{value}</div>{sub&&<div className="text-xs text-[#a8b6c8]">{sub}</div>}</div>;

export const MyPredictionsView:React.FC<{onBack:()=>void}>=({onBack})=>{
  const [tab,setTab]=useState<Tab>('upcoming'); const [cards,setCards]=useState<Card[]>([]); const [score,setScore]=useState<Score|null>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{if(!supabase){setLoading(false);return;}const{data:u}=await supabase.auth.getUser();const id=u.user?.id;if(!id){setLoading(false);return;}const[c,s]=await Promise.all([supabase.from('challenge_cards').select('*').eq('user_id',id).order('created_at',{ascending:false}).limit(500),supabase.from('challenge_scores').select('*').eq('user_id',id).maybeSingle()]);if(!c.error)setCards((c.data??[]) as Card[]);if(!s.error)setScore((s.data??null) as Score|null);setLoading(false);})()},[]);
  const upcoming=useMemo(()=>cards.filter(c=>c.status==='upcoming'||(c.selections||[]).some(s=>!s.result||s.result==='pending')),[cards]);
  const finished=useMemo(()=>cards.filter(c=>c.status==='finished'||(c.selections||[]).some(s=>s.result==='correct'||s.result==='incorrect'||s.result==='void')),[cards]);
  const monthCards=useMemo(()=>finished.filter(c=>(Date.now()-cardDate(c).getTime())<=30*86400000),[finished]);
  const monthSelections=monthCards.flatMap(c=>c.selections||[]).filter(s=>s.result==='correct'||s.result==='incorrect'); const allSelections=finished.flatMap(c=>c.selections||[]).filter(s=>s.result==='correct'||s.result==='incorrect');
  const monthCorrect=Number(score?.monthly_correct_picks??monthSelections.filter(s=>s.result==='correct').length),monthTotal=Number(score?.monthly_total_picks??monthSelections.length); const allCorrect=Number(score?.correct_picks??allSelections.filter(s=>s.result==='correct').length),allTotal=Number(score?.total_picks??allSelections.length);
  const categories=[['Hits',Number(score?.hitting_correct_picks||0),Number(score?.hitting_total_picks||0)],['Pitcher Strikeouts',Number(score?.pitching_correct_picks||0),Number(score?.pitching_total_picks||0)],['Game Winner',Number(score?.team_correct_picks||0),Number(score?.team_total_picks||0)]] as const; const best=[...categories].filter(x=>x[2]>0).sort((a,b)=>pct(b[1],b[2])-pct(a[1],a[2]))[0];
  return <div className="min-h-screen bg-[#081225] px-4 py-5 text-[#dae2fd] sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl"><div className="flex items-center gap-3"><button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2d4059] bg-[#101a2d] text-white"><span className="material-symbols-outlined">arrow_back</span></button><div><h1 className="text-2xl font-black text-white sm:text-3xl">My Predictions</h1><p className="text-xs text-[#8fa0b5]">Track your picks, results and performance.</p></div></div><div className="mt-5 grid grid-cols-3 border-b border-[#263951]">{(['upcoming','finished','statistics'] as Tab[]).map(x=><button key={x} onClick={()=>setTab(x)} className={`border-b-2 px-2 py-3 text-sm font-extrabold capitalize ${tab===x?'border-[#59e8f3] text-[#59e8f3]':'border-transparent text-[#9aabc0]'}`}>{x}{x==='upcoming'&&` (${upcoming.length})`}{x==='finished'&&` (${finished.length})`}</button>)}</div>{loading?<div className="py-20 text-center text-sm text-[#8fa0b5]">Loading predictions…</div>:<div className="mt-5">{tab==='upcoming'&&<div className="space-y-4">{upcoming.length?upcoming.map((c,i)=><GamePredictionCard key={c.id||i} card={c}/>):<Empty text="No upcoming predictions yet. Your ScoutCore Challenge picks will appear here."/>}</div>}{tab==='finished'&&<div className="space-y-4">{finished.length?finished.map((c,i)=><GamePredictionCard key={c.id||i} card={c} finished/>):<Empty text="No finished predictions yet."/>}</div>}{tab==='statistics'&&<div className="space-y-4"><StatCard title="Last 30 Days" correct={monthCorrect} total={monthTotal} streak={Number(score?.current_streak||0)} best={Number(score?.best_streak||0)}/><StatCard title="All Time" correct={allCorrect} total={allTotal} streak={Number(score?.current_streak||0)} best={Number(score?.best_streak||0)}/><section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><h3 className="text-lg font-extrabold text-white">Performance by Category</h3><div className="mt-4 space-y-4">{categories.map(([name,c,t])=><div key={name}><div className="flex justify-between text-xs"><span className="font-bold text-white">{name}</span><span className="text-[#9fb0c5]">{t?pct(c,t):0}% ({c}/{t})</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#22324b]"><div className="h-full rounded-full bg-[#59e8f3]" style={{width:`${t?pct(c,t):0}%`}}/></div></div>)}</div>{best&&<div className="mt-5 rounded-xl border border-[#00e6f4]/55 bg-[#00e6f4]/5 px-4 py-3 text-sm font-extrabold text-[#59e8f3]">🏆 Best Category: {best[0]} — {pct(best[1],best[2])}% ({best[1]}/{best[2]})</div>}</section></div>}</div>}</div></div>;
};
const Empty=({text}:{text:string})=><div className="rounded-2xl border border-dashed border-[#31445f] bg-[#0e192b] px-5 py-16 text-center text-sm text-[#8fa0b5]">{text}</div>;
