import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

type Level = { name: string; min: number; max: number | null; icon: string; accent: string };

const LEVELS: Level[] = [
  { name: 'Rookie Scout', min: 0, max: 249, icon: 'sports_baseball', accent: '#b8c6d8' },
  { name: 'Advanced Scout', min: 250, max: 749, icon: 'sports_baseball', accent: '#56dbe8' },
  { name: 'Pro Scout', min: 750, max: 1999, icon: 'workspace_premium', accent: '#63e8f2' },
  { name: 'Elite Scout', min: 2000, max: 4999, icon: 'military_tech', accent: '#f0b44d' },
  { name: 'ScoutCore All-Star', min: 5000, max: null, icon: 'stars', accent: '#f2c76e' },
];

const range = (level: Level) => level.max == null ? `${level.min.toLocaleString()}+` : `${level.min.toLocaleString()}–${level.max.toLocaleString()}`;
const currentIndexFor = (points: number) => {
  let index = 0;
  LEVELS.forEach((level, i) => { if (points >= level.min) index = i; });
  return index;
};

const Badge = ({ level, active, complete }: { level: Level; active: boolean; complete: boolean }) => (
  <div className="flex flex-col items-center text-center">
    <div className={`relative flex h-24 w-20 items-center justify-center rounded-[22px_22px_30px_30px] border-2 bg-[#0b1628] ${active ? 'scale-105' : ''}`} style={{ borderColor: active || complete ? level.accent : '#33435a', boxShadow: active ? `0 0 26px ${level.accent}22` : undefined }}>
      <span className="material-symbols-outlined text-[38px]" style={{ color: active || complete ? level.accent : '#66778d' }}>{level.icon}</span>
      <span className="material-symbols-outlined absolute bottom-2 right-2 rounded-full bg-[#07101f] text-[19px] text-white">sports_baseball</span>
    </div>
    <div className="mt-3 text-sm font-extrabold text-white">{level.name}</div>
    <div className="mt-1 text-xs text-[#a4b1c3]">{range(level)}</div>
  </div>
);

export const ScoutLevelView: React.FC = () => {
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!supabase) { setLoading(false); return; }
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;
        const result = await supabase.from('challenge_scores').select('points').eq('user_id', userId).maybeSingle();
        if (!cancelled && !result.error) setPoints(Number(result.data?.points || 0));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const currentIndex = useMemo(() => currentIndexFor(points), [points]);
  const current = LEVELS[currentIndex];
  const next = LEVELS[currentIndex + 1] ?? null;
  const target = next?.min ?? current.min;
  const progress = next ? Math.max(0, Math.min(100, points / target * 100)) : 100;

  return <div className="min-h-screen bg-[#071225] px-4 py-6 text-[#edf4ff] sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1320px]">
      <header className="border-b border-[#23364f] pb-5">
        <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Your Scout Level</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a8b5c7]">ScoutCore Points track your progress through ScoutCore Challenge.</p>
      </header>

      <section className="mt-5 rounded-2xl border border-[#2b405d] bg-[#0d182b] p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-5">
          {LEVELS.map((level, index) => <div key={level.name} className={`relative rounded-2xl px-3 py-4 ${index === currentIndex ? 'border border-[#58e8f2] bg-[#102037]' : 'border border-transparent'}`}>
            {index === currentIndex && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#59e8f3] px-3 py-1 text-[9px] font-extrabold text-[#06383e]">YOU ARE HERE</div>}
            <Badge level={level} active={index === currentIndex} complete={index < currentIndex} />
          </div>)}
        </div>

        <div className="mt-6 flex items-center gap-2 px-2">
          {LEVELS.map((level, index) => <React.Fragment key={level.name}>
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${index < currentIndex ? 'border-[#59e8f3] text-[#59e8f3]' : index === currentIndex ? 'border-white bg-[#59e8f3] text-[#07383d]' : 'border-[#40506a] text-[#607086]'}`}><span className="material-symbols-outlined text-[16px]">{index < currentIndex ? 'check' : index === currentIndex ? 'sports_baseball' : 'circle'}</span></div>
            {index < LEVELS.length - 1 && <div className={`h-1 flex-1 rounded-full ${index < currentIndex ? 'bg-[#59e8f3]' : 'bg-[#34445d]'}`} />}
          </React.Fragment>)}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-[#2b405d] bg-[#0d182b] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="min-w-[230px]"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#8fa1b7]">Current level</div><div className="mt-1 text-2xl font-extrabold text-white">{loading ? 'Loading…' : current.name}</div><div className="mt-2 text-sm text-[#59e8f3]"><b>{points.toLocaleString()}</b> ScoutCore Points</div></div>
          <div className="flex-1"><div className="mb-2 flex items-center justify-between gap-3 text-xs text-[#9cadbf]"><span>{next ? `${points.toLocaleString()} / ${target.toLocaleString()} points to ${next.name}` : 'Highest Scout level reached'}</span>{next && <span>{Math.max(0, target - points).toLocaleString()} to go</span>}</div><div className="h-3 overflow-hidden rounded-full border border-[#455772] bg-[#18243a]"><div className="h-full rounded-full bg-[#59e8f3]" style={{ width: `${progress}%` }} /></div></div>
        </div>
      </section>

      <section className="mt-5 max-w-3xl">
        <h2 className="text-lg font-extrabold text-white">How levels work</h2>
        <div className="mt-3 space-y-3 border-t border-[#263a54] pt-4 text-sm text-[#b7c3d2]">
          <p className="flex gap-3"><span className="material-symbols-outlined text-[19px] text-[#59e8f3]">check_circle</span>Earn ScoutCore Points from correct Challenge picks and bonuses.</p>
          <p className="flex gap-3"><span className="material-symbols-outlined text-[19px] text-[#59e8f3]">check_circle</span>Your Scout level increases automatically when your total reaches the next range.</p>
          <p className="flex gap-3"><span className="material-symbols-outlined text-[19px] text-[#59e8f3]">check_circle</span>Your level is a progress and achievement system inside ScoutCore.</p>
        </div>
      </section>
    </div>
  </div>;
};
