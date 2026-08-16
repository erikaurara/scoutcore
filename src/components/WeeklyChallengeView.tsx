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
    const current=u.user??null;
    setUser(current);
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
      return leaderboard.filter(r=>r.user_id===user?.id||friendNames.has(normalizeName(r.display_name)));
    }
    return leaderboard;
  },[boardMode,leaderboard,following,user?.id]);

  const visibleRows=useMemo(()=>{
    const base=boardRows.slice(0,10);
    if(boardMode==='overall'&&me&&rank>10&&!base.some(r=>r.user_id===me.user_id)) base.push(me);
    return base;
  },[boardRows,boardMode,me,rank]);

  if(loading)return <div className="min-h-screen bg-[#081225] px-6 py-20 text-center text-[#8fa0b5]">Loading Weekly Challenge…</div>;

  return <div className="sc-weekly-challenge min-h-screen bg-[#081225] px-3 py-4 text-[#dae2fd] sm:px-6 sm:py-5 lg:px-8"><div className="mx-auto max-w-6xl">
    <div className="flex items-start gap-2.5 sm:items-center sm:gap-4">
      <button onClick={onBack} className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#2d4059] bg-[#101a2d] text-white sm:mt-0 sm:h-11 sm:w-11"><span className="material-symbols-outlined">arrow_back</span></button>
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00e6f4]/10 text-[#59e8f3] sm:mt-0 sm:h-12 sm:w-12"><span className="material-symbols-outlined text-2xl sm:text-3xl">emoji_events</span></div>
      <div className="min-w-0"><h1 className="text-[25px] font-black leading-tight text-white sm:text-3xl">Weekly Challenge</h1><p className="mt-1 max-w-[520px] text-[12px] leading-[1.45] text-[#8fa0b5] sm:text-sm">Compete every week. Make accurate picks, build your streak, and climb the leaderboard.</p></div>
    </div>

    <section className="mt-5 rounded-2xl border border-[#2a405b] bg-[#0d1728] px-4 py-4 sm:mt-6 sm:p-5">
      <div className="grid grid-cols-[1.12fr_.88fr] items-stretch gap-0 md:grid-cols-2">
        <div className="min-w-0 pr-4 md:pr-6">
          <div className="text-[12px] font-black uppercase tracking-[.14em] text-[#59e8f3] sm:text-sm">This Week</div>
          <div className="mt-1.5 whitespace-nowrap text-[17px] font-bold leading-tight text-[#d7e2ef] sm:text-base sm:font-semibold">{dateRange}</div>
          <span className="mt-3 inline-flex rounded-full border border-[#00e6f4]/70 px-3 py-1 text-[11px] font-bold text-[#59e8f3] sm:text-xs">{daysLeft} day{daysLeft===1?'':'s'} left</span>
        </div>
        <div className="min-w-0 border-l border-[#2a405b] pl-4 md:pl-6">
          <div className="text-[12px] font-extrabold leading-5 text-[#59e8f3] sm:text-sm">How scoring works</div>
          <p className="mt-1 text-[11px] leading-[1.55] text-[#9fb0c5] sm:text-sm sm:leading-5">Accuracy, correct picks and streaks earn ScoutCore Points.</p>
        </div>
      </div>
    </section>

    <div className="mt-6 text-[13px] font-black uppercase tracking-[.13em] text-[#59e8f3] sm:text-sm">Your Weekly Progress</div>
    <section className="mt-3 rounded-2xl border border-[#2a405b] bg-[#101a2d] px-4 py-4 sm:p-5">
      <div className="flex items-center justify-center pb-5 sm:pb-4 md:hidden">
        <div className="relative h-24 w-24 rounded-full" style={{background:`conic-gradient(#59e8f3 ${stats.progress}%, #22324b 0)`}}><div className="absolute inset-[9px] flex items-center justify-center rounded-full bg-[#101a2d] text-[28px] font-black text-white">{stats.progress}%</div></div>
      </div>

      <div className="hidden md:grid md:grid-cols-[150px_repeat(5,1fr)] md:items-center md:gap-5">
        <div className="flex items-center justify-center"><div className="relative h-28 w-28 rounded-full" style={{background:`conic-gradient(#59e8f3 ${stats.progress}%, #22324b 0)`}}><div className="absolute inset-2 flex items-center justify-center rounded-full bg-[#101a2d] text-3xl font-black text-white">{stats.progress}%</div></div></div>
        <Metric label="Picks Completed" value={`${stats.completed} / ${stats.goal}`} sub={stats.completed>=stats.goal?'Complete':'Keep going!'} />
        <Metric label="Accuracy" value={`${stats.accuracy}%`} sub={`${stats.correct} correct`} />
        <Metric label="Correct / Missed" value={`${stats.correct} / ${stats.missed}`} sub="This week" />
        <Metric label="Current Streak" value={String(Number(me?.current_streak||0))} sub="Keep it going" />
        <Metric label="Weekly Points" value={stats.points.toLocaleString()} sub="ScoutCore Points" />
      </div>

      <div className="md:hidden">
        <div className="grid grid-cols-2 gap-x-8 border-b border-[#263951] pb-4">
          <MetricMobile label="Picks Completed" value={`${stats.completed} / ${stats.goal}`} sub={stats.completed>=stats.goal?'Complete':'Keep going!'} />
          <MetricMobile label="Accuracy" value={`${stats.accuracy}%`} sub={`${stats.correct} correct`} />
        </div>
        <div className="grid grid-cols-2 gap-x-8 border-b border-[#263951] py-4">
          <MetricMobile label="Correct / Missed" value={`${stats.correct} / ${stats.missed}`} sub="This week" />
          <MetricMobile label="Current Streak" value={String(Number(me?.current_streak||0))} sub="Keep it going" />
        </div>
        <div className="pt-4"><MetricMobile label="Weekly Points" value={stats.points.toLocaleString()} sub="ScoutCore Points" /></div>
      </div>

      <div className="mt-5 hidden border-t border-[#263951] pt-4 md:block"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#59e8f3]">leaderboard</span><span className="text-[11px] uppercase tracking-[.12em] text-[#8fa0b5]">Your current rank</span><b className="ml-1 text-2xl text-[#59e8f3]">{rank?`#${rank}`:'—'}</b></div><div className="mt-2 text-xs leading-5 text-[#8fa0b5]">Rank appears after 20 completed ranked picks.</div></div>
    </section>

    <div className="mt-6"><div className="text-[13px] font-black uppercase tracking-[.13em] text-[#59e8f3] sm:text-sm">Weekly Leaderboard</div><div className="mt-3 grid max-w-[455px] grid-cols-3 gap-2 sm:flex sm:flex-wrap">
      <BoardButton active={boardMode==='overall'} onClick={()=>setBoardMode('overall')}>OVERALL</BoardButton>
      <BoardButton active={boardMode==='friends'} onClick={()=>setBoardMode('friends')}>FRIENDS</BoardButton>
      <BoardButton active={boardMode==='top100'} onClick={()=>setBoardMode('top100')}>TOP 100</BoardButton>
    </div></div>

    <section className="mt-3 overflow-hidden rounded-2xl border border-[#2a405b] bg-[#101a2d]">
      <div className="sc-weekly-board-head grid grid-cols-[10%_25%_18%_18%_14%_15%] items-start border-b border-[#263951] px-2 py-3 text-[8px] font-black uppercase tracking-[.04em] text-[#7d90a8] sm:px-4 sm:text-[10px] sm:tracking-[.08em]"><span>Rank</span><span>User</span><span className="text-center">Accuracy</span><span className="text-center leading-3">Correct<br className="sm:hidden"/> Picks</span><span className="text-center">Streak</span><span className="text-center">Points</span></div>
      {visibleRows.length?visibleRows.map((r,i)=>{
        const actualRank=leaderboard.findIndex(x=>x.user_id===r.user_id)+1;
        const isMe=r.user_id===user?.id;
        const name=String(r.display_name|| (isMe?displayName:'ScoutCore User'));
        return <div key={r.user_id||i} className={`sc-weekly-board-row grid grid-cols-[10%_25%_18%_18%_14%_15%] items-center border-b border-[#1f3047] px-2 py-3 text-[10px] sm:px-4 sm:text-sm ${isMe?'bg-[#00e6f4]/5 outline outline-1 outline-inset outline-[#00e6f4]/55':''}`}>
          <b className="text-[#59e8f3]">#{actualRank}</b>
          <div className="flex min-w-0 items-center gap-1.5"><span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#59e8f3] text-[10px] font-black text-[#07101f] min-[470px]:flex">{initials(name)}</span><b className={`truncate ${isMe?'text-[#59e8f3]':'text-white'}`}>{name}{isMe?' (You)':''}</b></div>
          <span className="text-center font-bold text-white">{accuracy(Number(r.correct_picks||0),Number(r.total_picks||0))}%</span>
          <span className="text-center text-white">{Number(r.correct_picks||0)}</span>
          <span className="text-center text-white">{Number(r.current_streak||0)}</span>
          <span className="text-center font-bold text-white">{Number(r.points||0).toLocaleString()}</span>
        </div>
      }) : <div className="px-5 py-10 text-center text-[12px] leading-5 text-[#8fa0b5] sm:py-14 sm:text-sm sm:leading-6">{boardMode==='friends'?'No followed users are eligible yet. Follow ScoutCore users and they’ll appear here after 20 completed ranked picks.':'No eligible predictors yet. The leaderboard fills automatically after users reach 20 completed ranked picks.'}</div>}
      <div className="hidden px-4 py-3 text-center text-[10px] leading-4 text-[#718090] sm:block">{boardMode==='friends'?'Friends shows people you follow plus you.':'Leaderboard updates from ScoutCore Challenge results.'}</div>
    </section>
  </div></div>;
};

const BoardButton=({active,onClick,children}:{active:boolean;onClick:()=>void;children:React.ReactNode})=><button type="button" onClick={onClick} className={`min-w-0 rounded-full px-2 py-2.5 text-[11px] font-black transition sm:px-4 sm:py-2 sm:text-xs ${active?'bg-[#59e8f3] text-[#07101f]':'border border-[#30445f] text-[#9fb0c5] hover:border-[#59e8f3]/70 hover:text-[#59e8f3]'}`}>{children}</button>;

const Metric=({label,value,sub}:{label:string;value:string;sub:string})=><div className="min-w-0 border-[#263951] md:border-l md:pl-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-[#8394aa]">{label}</div><div className="mt-1 text-2xl font-black text-white">{value}</div><div className="mt-1 text-xs text-[#8fa0b5]">{sub}</div></div>;

const MetricMobile=({label,value,sub}:{label:string;value:string;sub:string})=><div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[.08em] text-[#8394aa]">{label}</div><div className="mt-1 text-[20px] font-black leading-tight text-white">{value}</div><div className="mt-1 text-[11px] text-[#8fa0b5]">{sub}</div></div>;
