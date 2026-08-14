import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

type Selection = Record<string, any> & { result?: 'pending' | 'correct' | 'incorrect' | 'void' | null };
type Card = Record<string, any> & { week_key?: string | null; ticket_kind?: string | null; points?: number | null; selections?: Selection[] | null };
type Score = Record<string, any> & { user_id?: string | null; display_name?: string | null; points?: number | null; correct_picks?: number | null; total_picks?: number | null; current_streak?: number | null };
type Follow = { display_name?: string | null; avatar_url?: string | null };
type BoardMode = 'overall' | 'friends' | 'top100';

const weekStartUTC = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
};
const weekKeyUTC = () => weekStartUTC().toISOString().slice(0, 10);
const weekEndUTC = () => { const d = weekStartUTC(); d.setUTCDate(d.getUTCDate() + 6); return d; };
const accuracy = (c:number,t:number) => t ? Math.round((c/t)*1000)/10 : 0;
const initials=(name:string)=>name.split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'U';
const normalizeName=(value:any)=>String(value||'').trim().toLowerCase();

export const WeeklyChallengeView:React.FC<{onBack:()=>void}>=({onBack})=>{
  const [cards,setCards]=useState<Card[]>([]);
  const [scores,setScores]=useState<Score[]>([]);
  const [following,setFollowing]=useState<Follow[]>([]);
  const [user,setUser]=useState<any|null>(null);
  const [loading,setLoading]=useState(true);
  const [boardMode,setBoardMode]=useState<BoardMode>('overall');

  useEffect(()=>{(async()=>{
    if(!supabase){setLoading(false);return;}
    const {data:u}=await supabase.auth.getUser();
    const current=u.user??null; setUser(current);
    if(!current){setLoading(false);return;}
    const [c,s,f]=await Promise.all([
      supabase.from('challenge_cards').select('*').eq('user_id',current.id).eq('week_key',weekKeyUTC()).order('created_at',{ascending:false}),
      supabase.from('challenge_scores').select('*').limit(500),
      supabase.rpc('get_my_following')
    ]);
    if(!c.error)setCards((c.data??[]) as Card[]);
    if(!s.error)setScores((s.data??[]) as Score[]);
    if(!f.error)setFollowing((f.data??[]) as Follow[]);
    setLoading(false);
  })()},[]);

  const stats=useMemo(()=>{
    const settled=cards.flatMap(c=>c.selections||[]).filter(s=>s.result==='correct'||s.result==='incorrect');
    const correct=settled.filter(s=>s.result==='correct').length;
    const missed=settled.filter(s=>s.result==='incorrect').length;
    const points=cards.reduce((sum,c)=>sum+Number(c.points||0),0);
    const completed=settled.length;
    const goal=30;
    return {correct,missed,points,completed,goal,progress:Math.min(100,Math.round((completed/goal)*100)),accuracy:accuracy(correct,completed)};
  },[cards]);

  const leaderboard=useMemo(()=>[...scores].filter(r=>Number(r.total_picks||0)>=20).sort((a,b)=>{
    const aa=Number(a.total_picks||0)?Number(a.correct_picks||0)/Number(a.total_picks||0):0;
    const ba=Number(b.total_picks||0)?Number(b.correct_picks||0)/Number(b.total_picks||0):0;
    return ba-aa||Number(b.correct_picks||0)-Number(a.correct_picks||0)||Number(b.current_streak||0)-Number(a.current_streak||0)||Number(b.points||0)-Number(a.points||0);
  }),[scores]);
  const me=scores.find(r=>r.user_id===user?.id);
  const rank=leaderboard.findIndex(r=>r.user_id===user?.id)+1;
  const displayName=String(user?.user_metadata?.display_name||user?.email?.split('@')[0]||'You');
  const start=weekStartUTC(), end=weekEndUTC();
  const daysLeft=Math.max(0,Math.ceil((end.getTime()+86400000-Date.now())/86400000));
  const dateRange=`${start.toLocaleDateString('en',{month:'short',day:'numeric',timeZone:'UTC'})} – ${end.toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}`;

  const boardRows=useMemo(()=>{
    if(boardMode==='top100') return leaderboard.slice(0,100);
    if(boardMode==='friends'){
      const friendNames=new Set(following.map(f=>normalizeName(f.display_name)).filter(Boolean));
      const rows=leaderboard.filter(r=>r.user_id===user?.id||friendNames.has(normalizeName(r.display_name)));
      return rows;
    }
    return leaderboard;
  },[boardMode,leaderboard,following,user?.id]);

  const visibleRows=useMemo(()=>{
    const base=boardRows.slice(0,10);
    if(boardMode==='overall'&&me&&rank>10&&!base.some(r=>r.user_id===me.user_id)) base.push(me);
    return base;
  },[boardRows,boardMode,me,rank]);

  if(loading)return <div className="min-h-screen bg-[#081225] px-6 py-20 text-center text-[#8fa0b5]">Loading Weekly Challenge…</div>;
  return <div className="min-h-screen bg-[#081225] px-4 py-5 text-[#dae2fd] sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl">
    <div className="flex items-center gap-4"><button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#2d4059] bg-[#101a2d] text-white"><span className="material-symbols-outlined">arrow_back</span></button><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00e6f4]/10 text-[#59e8f3]"><span className="material-symbols-outlined text-3xl">emoji_events</span></div><div><h1 className="text-2xl font-black text-white sm:text-3xl">Weekly Challenge</h1><p className="text-sm text-[#8fa0b5]">Compete every week. Make accurate picks, build your streak, and climb the leaderboard.</p></div></div>

    <section className="mt-6 grid gap-4 rounded-2xl border border-[#2a405b] bg-[#0d1728] p-5 md:grid-cols-2"><div><div className="text-sm font-black uppercase tracking-[.14em] text-[#59e8f3]">This Week</div><div className="mt-2 flex flex-wrap items-center gap-3 text-[#9fb0c5]"><span>{dateRange}</span><span className="rounded-full border border-[#00e6f4]/60 px-3 py-1 text-xs font-bold text-[#59e8f3]">{daysLeft} day{daysLeft===1?'':'s'} left</span></div></div><div className="border-[#263951] md:border-l md:pl-6"><div className="text-sm font-extrabold text-[#59e8f3]">How scoring works</div><p className="mt-1 text-sm text-[#9fb0c5]">Accuracy, correct picks and streaks earn ScoutCore Points.</p></div></section>

    <div className="mt-6 text-sm font-black uppercase tracking-[.12em] text-[#59e8f3]">Your Weekly Progress</div>
    <section className="mt-3 rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><div className="grid gap-5 md:grid-cols-[150px_repeat(5,1fr)] md:items-center">
      <div className="flex items-center justify-center"><div className="relative h-28 w-28 rounded-full" style={{background:`conic-gradient(#59e8f3 ${stats.progress}%, #22324b 0)`}}><div className="absolute inset-2 flex items-center justify-center rounded-full bg-[#101a2d] text-3xl font-black text-white">{stats.progress}%</div></div></div>
      <Metric label="Picks Completed" value={`${stats.completed} / ${stats.goal}`} sub={stats.completed>=stats.goal?'Complete':'Keep going!'} />
      <Metric label="Accuracy" value={`${stats.accuracy}%`} sub={`${stats.correct} correct`} />
      <Metric label="Correct / Missed" value={`${stats.correct} / ${stats.missed}`} sub="This week" />
      <Metric label="Current Streak" value={String(Number(me?.current_streak||0))} sub="Keep it going" />
      <Metric label="Weekly Points" value={stats.points.toLocaleString()} sub="ScoutCore Points" />
    </div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#263951] pt-4"><div className="flex items-center gap-3"><span className="material-symbols-outlined text-[#59e8f3]">leaderboard</span><span className="text-xs uppercase tracking-[.12em] text-[#8fa0b5]">Your current rank</span><b className="text-2xl text-[#59e8f3]">{rank?`#${rank}`:'—'}</b></div><div className="text-xs text-[#8fa0b5]">Rank appears after 20 completed ranked picks.</div></div></section>

    <div className="mt-6 flex flex-wrap items-end justify-between gap-3"><div className="text-sm font-black uppercase tracking-[.12em] text-[#59e8f3]">Weekly Leaderboard</div><div className="flex flex-wrap gap-2">
      <BoardButton active={boardMode==='overall'} onClick={()=>setBoardMode('overall')}>OVERALL</BoardButton>
      <BoardButton active={boardMode==='friends'} onClick={()=>setBoardMode('friends')}>FRIENDS</BoardButton>
      <BoardButton active={boardMode==='top100'} onClick={()=>setBoardMode('top100')}>TOP 100</BoardButton>
    </div></div>
    <section className="mt-3 overflow-hidden rounded-2xl border border-[#2a405b] bg-[#101a2d]"><div className="grid grid-cols-[60px_minmax(150px,1.6fr)_repeat(4,minmax(80px,1fr))] gap-2 border-b border-[#263951] px-4 py-3 text-[10px] font-black uppercase tracking-[.1em] text-[#7d90a8]"><span>Rank</span><span>User</span><span className="text-center">Accuracy</span><span className="text-center">Correct Picks</span><span className="text-center">Streak</span><span className="text-center">Points</span></div>
      {visibleRows.length?visibleRows.map((r,i)=>{const actualRank=leaderboard.findIndex(x=>x.user_id===r.user_id)+1; const isMe=r.user_id===user?.id; const name=String(r.display_name|| (isMe?displayName:'ScoutCore User')); return <div key={r.user_id||i} className={`grid grid-cols-[60px_minmax(150px,1.6fr)_repeat(4,minmax(80px,1fr))] items-center gap-2 border-b border-[#1f3047] px-4 py-3 text-sm ${isMe?'bg-[#00e6f4]/5 outline outline-1 outline-inset outline-[#00e6f4]/55':''}`}><b className="text-[#59e8f3]">#{actualRank}</b><div className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#59e8f3] text-xs font-black text-[#07101f]">{initials(name)}</span><b className={`truncate ${isMe?'text-[#59e8f3]':'text-white'}`}>{name}{isMe?' (You)':''}</b></div><span className="text-center font-bold text-white">{accuracy(Number(r.correct_picks||0),Number(r.total_picks||0))}%</span><span className="text-center text-white">{Number(r.correct_picks||0)}</span><span className="text-center text-white">{Number(r.current_streak||0)}</span><span className="text-center font-bold text-white">{Number(r.points||0).toLocaleString()}</span></div>}) : <div className="px-5 py-16 text-center text-sm text-[#8fa0b5]">{boardMode==='friends'?'No followed users are eligible yet. Follow ScoutCore users and they’ll appear here after 20 completed ranked picks.':'No eligible predictors yet. The leaderboard fills automatically after users reach 20 completed ranked picks.'}</div>}
      <div className="px-4 py-3 text-center text-[10px] text-[#718090]">{boardMode==='friends'?'Friends shows people you follow plus you.':'Leaderboard updates from ScoutCore Challenge results.'}</div></section>
  </div></div>;
};

const BoardButton=({active,onClick,children}:{active:boolean;onClick:()=>void;children:React.ReactNode})=><button type="button" onClick={onClick} className={`rounded-full px-4 py-2 text-xs font-black transition ${active?'bg-[#59e8f3] text-[#07101f]':'border border-[#30445f] text-[#9fb0c5] hover:border-[#59e8f3]/70 hover:text-[#59e8f3]'}`}>{children}</button>;
const Metric=({label,value,sub}:{label:string;value:string;sub:string})=><div className="min-w-0 border-[#263951] md:border-l md:pl-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-[#8394aa]">{label}</div><div className="mt-1 text-2xl font-black text-white">{value}</div><div className="mt-1 text-xs text-[#8fa0b5]">{sub}</div></div>;
