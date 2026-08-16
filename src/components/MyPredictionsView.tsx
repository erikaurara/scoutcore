import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

type Tab = 'upcoming' | 'finished' | 'statistics';
type Selection = Record<string, any> & { result?: 'pending' | 'correct' | 'incorrect' | 'void' | null };
type Card = Record<string, any> & { status?: string | null; selections?: Selection[] | null; created_at?: string | null; settled_at?: string | null };
type Score = Record<string, any> & {
  user_id?: string | null; points?: number | null; monthly_points?: number | null;
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

const GamePredictionCard=({card,finished}:{card:Card;finished?:boolean})=>{
  const [open,setOpen]=useState(false);
  const selections=(card.selections||[]).filter(s=>finished?(s.result&&s.result!=='pending'):true);
  const correct=selections.filter(s=>s.result==='correct').length;
  const missed=selections.filter(s=>s.result==='incorrect').length;
  const {away,home}=matchupTeams(card);
  return <section className="overflow-hidden rounded-2xl border border-[#2a405b] bg-[#101a2d]">
    <button type="button" onClick={()=>setOpen(v=>!v)} className="w-full text-left">
      <div className="flex items-center justify-between bg-[#0d1728] px-4 py-3 text-xs text-[#9fb0c5]">
        <b className="text-white">{new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(cardDate(card))}</b>
        <span>{selections.length} pick{selections.length===1?'':'s'}</span>
      </div>
      <div className="px-4 py-4 sm:px-5">
        <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#7d90a8]">Away</div>
            <div className="mt-1 truncate text-base font-black text-white sm:text-lg">{away}</div>
          </div>
          <div className="text-xs font-black uppercase tracking-[.12em] text-[#72869f]">vs</div>
          <div className="min-w-0 text-right">
            <div className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#7d90a8]">Home</div>
            <div className="mt-1 truncate text-base font-black text-white sm:text-lg">{home}</div>
          </div>
          <span className={`material-symbols-outlined shrink-0 text-[#59e8f3] transition-transform ${open?'rotate-180':''}`}>expand_more</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#22354d] pt-3">
          <span className="text-xs text-[#91a2b8]">Tap to {open?'hide':'see'} your player picks</span>
          {finished?<div className="flex items-center gap-2 text-xs font-extrabold"><span className="rounded-lg bg-[#16d99a]/12 px-2.5 py-1 text-[#55f1bd]">✓ {correct} correct</span><span className="rounded-lg bg-[#ff515a]/12 px-2.5 py-1 text-[#ff747c]">✕ {missed} missed</span></div>:<span className="rounded-lg border border-[#00e6f4]/55 px-2.5 py-1 text-xs font-extrabold text-[#59e8f3]">{selections.length} prediction{selections.length===1?'':'s'}</span>}
        </div>
      </div>
    </button>
    {open&&<div className="border-t border-[#2a405b] bg-[#0c1729]">{selections.map((s,j)=><PickDetail key={s.id||j} s={s} finished={finished}/>)}</div>}
  </section>;
};

const OverviewMetric=({icon,label,value,sub,accent}:{icon:string;label:string;value:string;sub:string;accent:string})=><article className="flex min-h-[122px] min-w-0 flex-col items-center justify-center rounded-xl border border-[#263951] bg-[#0b1527] px-1.5 py-3 text-center sm:min-h-[138px] sm:px-3"><span className="material-symbols-outlined text-[28px] sm:text-[32px]" style={{color:accent}}>{icon}</span><div className="mt-2 text-[8px] font-medium uppercase tracking-[.06em] text-[#8394aa] sm:text-[10px]">{label}</div><div className="mt-1 text-lg font-black text-white sm:text-xl">{value}</div><div className="mt-0.5 text-[11px] font-extrabold sm:text-sm" style={{color:accent}}>{sub}</div></article>;

const OverviewSection=({correct,total,allTotal,points,currentStreak,bestStreak,rank}:{correct:number;total:number;allTotal:number;points:number;currentStreak:number;bestStreak:number;rank:number|null})=><section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-3 sm:p-5"><h3 className="text-base font-extrabold text-white sm:text-lg">Overview <span className="font-medium text-[#8fa0b5]">(Last 30 days)</span></h3><div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3"><OverviewMetric icon="track_changes" label="Correct Picks" value={`${correct}/${total}`} sub={`${pct(correct,total)}%`} accent="#70e5ea"/><OverviewMetric icon="checklist" label="Total Predictions" value={String(allTotal)} sub="All time" accent="#70e5ea"/><OverviewMetric icon="workspace_premium" label="ScoutCore Points" value={points.toLocaleString()} sub="+ this week" accent="#f2b45f"/><OverviewMetric icon="local_fire_department" label="Current Streak" value={String(currentStreak)} sub="Keep going" accent="#c276ed"/><OverviewMetric icon="crown" label="Best Streak" value={String(bestStreak)} sub="Personal best" accent="#f2b45f"/><OverviewMetric icon="groups" label="Predictor Rank" value={rank?`#${rank}`:'—'} sub="Out of all users" accent="#f2b45f"/></div></section>;

const CategoryAccuracySection=({rows}:{rows:Array<{name:string;correct:number;total:number}>})=><section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-base font-extrabold text-white sm:text-lg">Category Accuracy <span className="font-medium text-[#8fa0b5]">(Last 30 days)</span></h3><span className="shrink-0 text-xs font-extrabold text-[#70e5ea] sm:text-sm">View all</span></div><div className="mt-4 space-y-4">{rows.map(({name,correct,total})=>{const accuracy=pct(correct,total);return <div key={name} className="grid grid-cols-[74px_minmax(0,1fr)_38px] items-center gap-3 sm:grid-cols-[120px_minmax(0,1fr)_48px]"><span className="text-[13px] font-extrabold leading-5 text-white sm:text-sm">{name}</span><div className="h-1.5 overflow-hidden rounded-full bg-[#22324b]"><div className="h-full rounded-full bg-[#70e5ea]" style={{width:`${accuracy}%`}}/></div><span className="text-right text-sm text-[#9fb0c5]">{accuracy}%</span></div>})}</div></section>;

export const MyPredictionsView:React.FC<{onBack:()=>void}>=({onBack})=>{
  const [tab,setTab]=useState<Tab>('upcoming'); const [cards,setCards]=useState<Card[]>([]); const [score,setScore]=useState<Score|null>(null); const [scoreRows,setScoreRows]=useState<Score[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{if(!supabase){setLoading(false);return;}const{data:u}=await supabase.auth.getUser();const id=u.user?.id;if(!id){setLoading(false);return;}const[c,s]=await Promise.all([supabase.from('challenge_cards').select('*').eq('user_id',id).order('created_at',{ascending:false}).limit(500),supabase.from('challenge_scores').select('*').limit(1000)]);if(!c.error)setCards((c.data??[]) as Card[]);if(!s.error){const rows=(s.data??[]) as Score[];setScoreRows(rows);setScore(rows.find(row=>row.user_id===id)??null);}setLoading(false);})()},[]);
  const upcoming=useMemo(()=>cards.filter(c=>c.status==='upcoming'||(c.selections||[]).some(s=>!s.result||s.result==='pending')),[cards]);
  const finished=useMemo(()=>cards.filter(c=>c.status==='finished'||(c.selections||[]).some(s=>s.result==='correct'||s.result==='incorrect'||s.result==='void')),[cards]);
  const monthCards=useMemo(()=>finished.filter(c=>(Date.now()-cardDate(c).getTime())<=30*86400000),[finished]);
  const monthSelections=useMemo(()=>monthCards.flatMap(c=>c.selections||[]).filter(s=>s.result==='correct'||s.result==='incorrect'),[monthCards]); const allSelections=useMemo(()=>finished.flatMap(c=>c.selections||[]).filter(s=>s.result==='correct'||s.result==='incorrect'),[finished]);
  const monthCorrect=Number(score?.monthly_correct_picks??monthSelections.filter(s=>s.result==='correct').length),monthTotal=Number(score?.monthly_total_picks??monthSelections.length); const allCorrect=Number(score?.correct_picks??allSelections.filter(s=>s.result==='correct').length),allTotal=Number(score?.total_picks??allSelections.length);
  const categories=[['Hits',Number(score?.hitting_correct_picks||0),Number(score?.hitting_total_picks||0)],['Pitcher Strikeouts',Number(score?.pitching_correct_picks||0),Number(score?.pitching_total_picks||0)],['Game Winner',Number(score?.team_correct_picks||0),Number(score?.team_total_picks||0)]] as const; const best=[...categories].filter(x=>x[2]>0).sort((a,b)=>pct(b[1],b[2])-pct(a[1],a[2]))[0];
  const predictorRank=useMemo(()=>{const eligible=[...scoreRows].filter(row=>Number(row.total_picks||0)>=20).sort((a,b)=>pct(Number(b.correct_picks||0),Number(b.total_picks||0))-pct(Number(a.correct_picks||0),Number(a.total_picks||0))||Number(b.correct_picks||0)-Number(a.correct_picks||0)||Number(b.current_streak||0)-Number(a.current_streak||0)||Number(b.points||0)-Number(a.points||0));const index=eligible.findIndex(row=>Boolean(row.user_id)&&row.user_id===score?.user_id);return index>=0?index+1:null;},[scoreRows,score?.user_id]);
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

  return <div className="min-h-screen bg-[#081225] px-4 py-5 text-[#dae2fd] sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl"><div className="flex items-center gap-3"><button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2d4059] bg-[#101a2d] text-white"><span className="material-symbols-outlined">arrow_back</span></button><div><h1 className="text-2xl font-black text-white sm:text-3xl">My Predictions</h1><p className="text-xs text-[#8fa0b5]">Track your picks, results and performance.</p></div></div><div className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-[#2a405b] bg-[#0b1527]">{predictionTabs.map(({id,icon,label})=><button key={id} onClick={()=>setTab(id)} className={`flex min-w-0 flex-col items-center justify-center border-b-4 border-r border-r-[#2a405b] px-1 py-3 font-extrabold last:border-r-0 sm:px-2 ${tab===id?'border-b-[#59e8f3] bg-[#0d2030] text-[#59e8f3]':'border-b-transparent text-[#9aabc0]'}`}><span className="material-symbols-outlined text-[28px] leading-none sm:text-[32px]">{icon}</span><span className="mt-1 whitespace-nowrap text-[12px] leading-tight sm:text-sm">{label}{id==='upcoming'&&` (${upcoming.length})`}{id==='finished'&&` (${finished.length})`}</span></button>)}</div>{loading?<div className="py-20 text-center text-sm text-[#8fa0b5]">Loading predictions…</div>:<div className="mt-5">{tab==='upcoming'&&<div className="space-y-4">{upcoming.length?upcoming.map((c,i)=><GamePredictionCard key={c.id||i} card={c}/>):<Empty text="No upcoming predictions yet. Your ScoutCore Challenge picks will appear here."/>}</div>}{tab==='finished'&&<div className="space-y-4">{finished.length?finished.map((c,i)=><GamePredictionCard key={c.id||i} card={c} finished/>):<Empty text="No finished predictions yet."/>}</div>}{tab==='statistics'&&<div className="space-y-4"><OverviewSection correct={monthCorrect} total={monthTotal} allTotal={allTotal} points={Number(score?.points||0)} currentStreak={Number(score?.current_streak||0)} bestStreak={Number(score?.best_streak||0)} rank={predictorRank}/><CategoryAccuracySection rows={categoryAccuracy}/><section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><h3 className="text-lg font-extrabold text-white">Performance by Category</h3><div className="mt-4 space-y-4">{categories.map(([name,c,t])=><div key={name}><div className="flex justify-between text-xs"><span className="font-bold text-white">{name}</span><span className="text-[#9fb0c5]">{t?pct(c,t):0}% ({c}/{t})</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#22324b]"><div className="h-full rounded-full bg-[#59e8f3]" style={{width:`${t?pct(c,t):0}%`}}/></div></div>)}</div>{best&&<div className="mt-5 rounded-xl border border-[#00e6f4]/55 bg-[#00e6f4]/5 px-4 py-3 text-sm font-extrabold text-[#59e8f3]">🏆 Best Category: {best[0]} — {pct(best[1],best[2])}% ({best[1]}/{best[2]})</div>}</section></div>}</div>}</div></div>;
};
const Empty=({text}:{text:string})=><div className="rounded-2xl border border-dashed border-[#31445f] bg-[#0e192b] px-5 py-16 text-center text-sm text-[#8fa0b5]">{text}</div>;
