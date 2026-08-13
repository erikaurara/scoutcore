import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

type Level = { name: string; min: number; max: number | null; icon: string; accent: string };
type Score = {
  user_id?: string | null;
  points?: number | null;
  correct_picks?: number | null;
  total_picks?: number | null;
  current_streak?: number | null;
  perfect_cards?: number | null;
  monthly_points?: number | null;
  monthly_correct_picks?: number | null;
  monthly_total_picks?: number | null;
  hitting_correct_picks?: number | null;
  hitting_total_picks?: number | null;
  pitching_correct_picks?: number | null;
  pitching_total_picks?: number | null;
};

const LEVELS: Level[] = [
  { name: 'Rookie Scout', min: 0, max: 249, icon: 'explore', accent: '#66eaf1' },
  { name: 'Advanced Scout', min: 250, max: 749, icon: 'travel_explore', accent: '#59dbe9' },
  { name: 'Pro Scout', min: 750, max: 1999, icon: 'workspace_premium', accent: '#9e8cff' },
  { name: 'Elite Scout', min: 2000, max: 4999, icon: 'military_tech', accent: '#f1bd5d' },
  { name: 'ScoutCore All-Star', min: 5000, max: null, icon: 'stars', accent: '#ff9d69' },
];

const range = (level: Level) => level.max == null ? `${level.min.toLocaleString()}+` : `${level.min.toLocaleString()}–${level.max.toLocaleString()}`;
const currentIndexFor = (points: number) => {
  let index = 0;
  LEVELS.forEach((level, i) => { if (points >= level.min) index = i; });
  return index;
};
const monthlyAccuracy = (row: Score) => Number(row.monthly_total_picks || 0) ? Number(row.monthly_correct_picks || 0) / Number(row.monthly_total_picks || 0) : 0;

export const ScoutLevelView: React.FC = () => {
  const [score, setScore] = useState<Score | null>(null);
  const [rows, setRows] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!supabase) { setLoading(false); return; }
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId) return;
        const [mine, all] = await Promise.all([
          supabase.from('challenge_scores').select('*').eq('user_id', userId).maybeSingle(),
          supabase.from('challenge_scores').select('*').limit(1000),
        ]);
        if (cancelled) return;
        if (!mine.error) setScore((mine.data ?? null) as Score | null);
        if (!all.error) setRows((all.data ?? []) as Score[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const points = Number(score?.points || 0);
  const currentIndex = currentIndexFor(points);
  const current = LEVELS[currentIndex];
  const next = LEVELS[currentIndex + 1] ?? null;
  const progress = next ? Math.max(0, Math.min(100, ((points - current.min) / (next.min - current.min)) * 100)) : 100;
  const remaining = next ? Math.max(0, next.min - points) : 0;

  const monthlyRank = useMemo(() => {
    const eligible = [...rows]
      .filter((row) => Number(row.monthly_total_picks || 0) >= 20)
      .sort((a, b) => monthlyAccuracy(b) - monthlyAccuracy(a)
        || Number(b.monthly_correct_picks || 0) - Number(a.monthly_correct_picks || 0)
        || Number(b.monthly_points || 0) - Number(a.monthly_points || 0));
    const index = eligible.findIndex((row) => row.user_id === score?.user_id);
    return index >= 0 ? index + 1 : null;
  }, [rows, score?.user_id]);

  const badges = useMemo(() => {
    const hitTotal = Number(score?.hitting_total_picks || 0);
    const hitCorrect = Number(score?.hitting_correct_picks || 0);
    const pitchTotal = Number(score?.pitching_total_picks || 0);
    const pitchCorrect = Number(score?.pitching_correct_picks || 0);
    return [
      { name: 'Hot Streak', icon: 'local_fire_department', earned: Number(score?.current_streak || 0) >= 5, detail: 'Reach a 5-pick correct streak.' },
      { name: 'Pitching Expert', icon: 'sports_baseball', earned: pitchTotal >= 20 && pitchCorrect / pitchTotal >= .70, detail: '70%+ accuracy across 20 pitcher picks.' },
      { name: 'Hit Predictor', icon: 'track_changes', earned: hitTotal >= 20 && hitCorrect / hitTotal >= .70, detail: '70%+ accuracy across 20 batter picks.' },
      { name: 'Perfect Card', icon: 'verified', earned: Number(score?.perfect_cards || 0) >= 1, detail: 'Finish a Challenge Card with every settled pick correct.' },
      { name: '100 Correct Picks', icon: 'military_tech', earned: Number(score?.correct_picks || 0) >= 100, detail: 'Record 100 correct Challenge predictions.' },
      { name: 'Top 10 This Month', icon: 'leaderboard', earned: Boolean(monthlyRank && monthlyRank <= 10), detail: 'Finish in the monthly leaderboard Top 10.' },
    ];
  }, [score, monthlyRank]);

  return <div className="min-h-screen bg-[#071225] px-4 py-7 text-[#edf4ff] sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1320px]">
      <header className="border-b border-[#23364f] pb-6">
        <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Your Scout Level</h1>
        <p className="mt-2 max-w-4xl text-base leading-7 text-[#aebcd0]">ScoutCore Points track your prediction progress. Earn points through correct picks and completed challenges.</p>
      </header>

      <section className="mt-6 rounded-2xl border border-[#2b405d] bg-[#0d182b] px-4 py-6 sm:px-6 lg:px-7">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-5 xl:gap-7">
          {LEVELS.map((level, index) => {
            const active = index === currentIndex;
            const complete = index < currentIndex;
            return <div key={level.name} className="flex min-w-0 flex-col items-center text-center">
              <div className="mb-3 flex h-7 items-center justify-center">
                {active && <span className="rounded-full bg-[#66eaf1] px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#07363c]">YOU ARE HERE</span>}
                {complete && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#66eaf1]"><span className="material-symbols-outlined text-[16px]">check_circle</span>COMPLETED</span>}
              </div>
              <div className={`flex h-24 w-24 items-center justify-center rounded-[26px] border-2 ${active ? 'scale-105 bg-[#10243a]' : 'bg-[#0a1526]'}`} style={{ borderColor: active || complete ? level.accent : '#38506d', boxShadow: active ? `0 0 28px ${level.accent}22` : undefined }}>
                <span className="material-symbols-outlined text-[38px]" style={{ color: active || complete ? level.accent : '#64758d' }}>{level.icon}</span>
              </div>
              <h3 className="mt-4 text-base font-extrabold text-white">{level.name}</h3>
              <p className="mt-1 text-sm text-[#9eacc0]">{range(level)} points</p>
            </div>;
          })}
        </div>

        <div className="mt-8 hidden items-center px-8 sm:flex">
          {LEVELS.map((level, index) => <React.Fragment key={level.name}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${index < currentIndex ? 'border-[#66eaf1] bg-[#66eaf1] text-[#07363c]' : index === currentIndex ? 'border-[#66eaf1] bg-[#10283a] text-[#66eaf1]' : 'border-[#465a75] bg-[#101b2f] text-[#65768d]'}`}>
              <span className="material-symbols-outlined text-[17px]">{index < currentIndex ? 'check' : index === currentIndex ? 'radio_button_checked' : 'circle'}</span>
            </div>
            {index < LEVELS.length - 1 && <div className={`h-[3px] flex-1 ${index < currentIndex ? 'bg-[#66eaf1]' : 'bg-[#354862]'}`} />}
          </React.Fragment>)}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-[#2b405d] bg-[#0d182b] p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-center">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#95a5bb]">Current level</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{loading ? 'Loading…' : current.name}</h2>
            <p className="mt-2 text-base font-bold text-[#66eaf1]">{points.toLocaleString()} ScoutCore Points</p>
          </div>
          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div><p className="text-base font-bold text-white">{next ? `${points.toLocaleString()} / ${next.min.toLocaleString()} total points` : 'Highest Scout level reached'}</p>{next && <p className="mt-1 text-sm text-[#a9b7ca]">Progress to {next.name}</p>}</div>
              {next && <p className="text-sm font-bold text-[#a9b7ca]">{remaining.toLocaleString()} to go</p>}
            </div>
            <div className="h-4 overflow-hidden rounded-full border border-[#465b78] bg-[#17243a]"><div className="h-full rounded-full bg-gradient-to-r from-[#4adbe8] to-[#70f0d3]" style={{ width: `${progress}%` }} /></div>
          </div>
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#66eaf1]">Achievements</p><h2 className="mt-1 text-2xl font-extrabold text-white">Scout Badges</h2></div>
          <p className="text-sm text-[#9fadc1]">Earned badges light up automatically from your Challenge results.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge) => <article key={badge.name} className={`rounded-2xl border p-5 ${badge.earned ? 'border-[#66eaf1]/55 bg-[#10233a]' : 'border-[#2d405a] bg-[#0c1729]'}`}>
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${badge.earned ? 'border-[#66eaf1]/60 bg-[#66eaf1]/10 text-[#66eaf1]' : 'border-[#384a62] bg-[#111c2f] text-[#62738b]'}`}><span className="material-symbols-outlined text-[27px]">{badge.icon}</span></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><h3 className={`text-base font-extrabold ${badge.earned ? 'text-white' : 'text-[#c3ccda]'}`}>{badge.name}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${badge.earned ? 'bg-[#66eaf1] text-[#06383e]' : 'bg-[#1b293d] text-[#7f8ea2]'}`}>{badge.earned ? 'EARNED' : 'LOCKED'}</span></div>
                <p className="mt-2 text-sm leading-6 text-[#a8b5c8]">{badge.detail}</p>
              </div>
            </div>
          </article>)}
        </div>
      </section>

      <section className="mt-7 rounded-2xl border border-[#263b56] bg-[#0b1628] p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-white">How levels work</h2>
        <div className="mt-4 grid gap-3 text-sm leading-6 text-[#b7c3d2] lg:grid-cols-3">
          <p className="flex gap-3"><span className="material-symbols-outlined text-[20px] text-[#66eaf1]">check_circle</span><span>Correct picks and Challenge bonuses earn ScoutCore Points.</span></p>
          <p className="flex gap-3"><span className="material-symbols-outlined text-[20px] text-[#66eaf1]">check_circle</span><span>Higher Scout levels unlock automatically as your total points increase.</span></p>
          <p className="flex gap-3"><span className="material-symbols-outlined text-[20px] text-[#66eaf1]">info</span><span>ScoutCore Points have no cash value and cannot be bought, exchanged, or withdrawn.</span></p>
        </div>
      </section>
    </div>
  </div>;
};
