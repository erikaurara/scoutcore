import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

type LevelKind = 'rookie' | 'advanced' | 'pro' | 'elite' | 'allstar';
type Level = {
  name: string;
  min: number;
  max: number | null;
  kind: LevelKind;
  border: string;
  fill: string;
  accent: string;
};

type Score = {
  user_id?: string | null;
  points?: number | null;
  correct_picks?: number | null;
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

type ScoutBadge = {
  name: string;
  icon: string;
  earned: boolean;
  detail: string;
  accent: string;
  soft: string;
};

const LEVELS: Level[] = [
  { name: 'Rookie Scout', min: 0, max: 249, kind: 'rookie', border: '#b9c4cf', fill: '#26313f', accent: '#e2e8ee' },
  { name: 'Advanced Scout', min: 250, max: 749, kind: 'advanced', border: '#3c91a4', fill: '#073044', accent: '#9feaff' },
  { name: 'Pro Scout', min: 750, max: 1999, kind: 'pro', border: '#79b9e8', fill: '#0a2b48', accent: '#d8f4ff' },
  { name: 'Elite Scout', min: 2000, max: 4999, kind: 'elite', border: '#d99a32', fill: '#222021', accent: '#ffc555' },
  { name: 'ScoutCore All-Star', min: 5000, max: null, kind: 'allstar', border: '#efb443', fill: '#322819', accent: '#ffd778' },
];

const currentIndexFor = (points: number) => {
  let current = 0;
  LEVELS.forEach((level, index) => {
    if (points >= level.min) current = index;
  });
  return current;
};

const rangeLabel = (level: Level) =>
  level.max == null ? `${level.min.toLocaleString()}+` : `${level.min.toLocaleString()}–${level.max.toLocaleString()}`;

const monthlyAccuracy = (row: Score) =>
  Number(row.monthly_total_picks || 0)
    ? Number(row.monthly_correct_picks || 0) / Number(row.monthly_total_picks || 0)
    : 0;

const ShieldBadge: React.FC<{ level: Level; active: boolean }> = ({ level, active }) => {
  const baseball = level.kind !== 'advanced';
  const gold = level.kind === 'elite' || level.kind === 'allstar';

  return (
    <svg
      viewBox="0 0 120 132"
      className={`h-[108px] w-[98px] drop-shadow-[0_10px_20px_rgba(0,0,0,.35)] sm:h-[122px] sm:w-[110px] ${active ? 'scale-[1.03]' : ''}`}
      aria-hidden="true"
    >
      <path d="M60 5 108 20v43c0 29-18 50-48 65C30 113 12 92 12 63V20L60 5Z" fill={level.fill} stroke={level.border} strokeWidth="4" />
      <path d="M60 13 99 25v36c0 24-14 42-39 55-25-13-39-31-39-55V25l39-12Z" fill="none" stroke={active ? '#1cecf4' : level.accent} strokeOpacity={active ? 0.55 : 0.25} strokeWidth="2" />

      {level.kind === 'advanced' && (
        <g stroke="#eef8ff" strokeLinecap="round">
          <line x1="40" y1="44" x2="79" y2="83" strokeWidth="10" />
          <line x1="80" y1="43" x2="41" y2="84" strokeWidth="10" />
          <line x1="35" y1="39" x2="43" y2="47" strokeWidth="5" />
          <line x1="85" y1="38" x2="77" y2="46" strokeWidth="5" />
        </g>
      )}

      {level.kind === 'elite' && (
        <g fill="#ffc44d" fontSize="18" textAnchor="middle" fontWeight="900">
          <text x="34" y="42">★</text>
          <text x="60" y="31">★</text>
          <text x="86" y="42">★</text>
        </g>
      )}

      {level.kind === 'allstar' && <path d="M60 22 72 39 60 54 48 39 60 22Z" fill="#f8c95e" stroke="#ffe59a" strokeWidth="1.5" opacity=".9" />}

      {baseball && (
        <g transform={gold ? 'translate(0 8)' : 'translate(0 4)'}>
          <circle cx="60" cy="67" r="24" fill="#f4f6f7" stroke="#cbd3d8" strokeWidth="2" />
          <path d="M45 48c6 9 7 29 0 38" fill="none" stroke="#222a30" strokeWidth="2" />
          <path d="M75 48c-6 9-7 29 0 38" fill="none" stroke="#222a30" strokeWidth="2" />
          <g stroke="#222a30" strokeWidth="1.6" strokeLinecap="round">
            <line x1="42" y1="54" x2="48" y2="57" /><line x1="41" y1="61" x2="48" y2="63" /><line x1="41" y1="69" x2="48" y2="69" /><line x1="42" y1="77" x2="49" y2="75" />
            <line x1="78" y1="54" x2="72" y2="57" /><line x1="79" y1="61" x2="72" y2="63" /><line x1="79" y1="69" x2="72" y2="69" /><line x1="78" y1="77" x2="71" y2="75" />
          </g>
        </g>
      )}
    </svg>
  );
};

export const ScoutLevelView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [score, setScore] = useState<Score | null>(null);
  const [rows, setRows] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadScore = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

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

    void loadScore();
    return () => { cancelled = true; };
  }, []);

  const points = Number(score?.points || 0);
  const currentIndex = currentIndexFor(points);
  const current = LEVELS[currentIndex];
  const next = LEVELS[currentIndex + 1] ?? null;
  const targetPoints = next?.min ?? Math.max(LEVELS[LEVELS.length - 1].min, points);
  const progressPercent = next ? Math.max(0, Math.min(100, (points / next.min) * 100)) : 100;
  const trackPercent = currentIndex === 0 ? 0 : (currentIndex / (LEVELS.length - 1)) * 80;
  const midpoint = Math.round(targetPoints / 2 / 50) * 50;

  const monthlyRank = useMemo(() => {
    const eligible = [...rows]
      .filter((row) => Number(row.monthly_total_picks || 0) >= 20)
      .sort((a, b) => monthlyAccuracy(b) - monthlyAccuracy(a)
        || Number(b.monthly_correct_picks || 0) - Number(a.monthly_correct_picks || 0)
        || Number(b.monthly_points || 0) - Number(a.monthly_points || 0));
    const index = eligible.findIndex((row) => row.user_id === score?.user_id);
    return index >= 0 ? index + 1 : null;
  }, [rows, score?.user_id]);

  const badges = useMemo<ScoutBadge[]>(() => {
    const hitTotal = Number(score?.hitting_total_picks || 0);
    const hitCorrect = Number(score?.hitting_correct_picks || 0);
    const pitchTotal = Number(score?.pitching_total_picks || 0);
    const pitchCorrect = Number(score?.pitching_correct_picks || 0);

    return [
      { name: 'Hot Streak', icon: 'local_fire_department', earned: Number(score?.current_streak || 0) >= 5, detail: 'Reach a 5-pick correct streak.', accent: '#ff693d', soft: 'rgba(255,105,61,.16)' },
      { name: 'Pitching Expert', icon: 'sports_baseball', earned: pitchTotal >= 20 && pitchCorrect / pitchTotal >= .70, detail: '70%+ accuracy across 20 pitcher picks.', accent: '#20e8f1', soft: 'rgba(32,232,241,.14)' },
      { name: 'Hit Predictor', icon: 'track_changes', earned: hitTotal >= 20 && hitCorrect / hitTotal >= .70, detail: '70%+ accuracy across 20 batter picks.', accent: '#a78bfa', soft: 'rgba(167,139,250,.15)' },
      { name: 'Perfect Card', icon: 'verified', earned: Number(score?.perfect_cards || 0) >= 1, detail: 'Finish a Challenge Card with every settled pick correct.', accent: '#65f2b5', soft: 'rgba(101,242,181,.14)' },
      { name: '100 Correct Picks', icon: 'military_tech', earned: Number(score?.correct_picks || 0) >= 100, detail: 'Record 100 correct Challenge predictions.', accent: '#ffc857', soft: 'rgba(255,200,87,.15)' },
      { name: 'Top 10 This Month', icon: 'leaderboard', earned: Boolean(monthlyRank && monthlyRank <= 10), detail: 'Finish in the monthly leaderboard Top 10.', accent: '#d88cff', soft: 'rgba(216,140,255,.15)' },
    ];
  }, [score, monthlyRank]);

  const earnedCount = badges.filter((badge) => badge.earned).length;

  return (
    <div className="sc-scout-level min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_62%_10%,rgba(0,132,190,.10),transparent_32%),linear-gradient(180deg,#061427_0%,#071326_100%)] px-4 py-7 text-[#edf6ff] sm:px-6 lg:px-8 xl:px-12">
      <div className="mx-auto max-w-[1440px]">
        <header className="flex items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Back to profile" className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#2d4059] bg-[#101a2d] text-white sm:h-12 sm:w-12"><span className="material-symbols-outlined">arrow_back</span></button>
          <div>
            <h1 className="text-[34px] font-black tracking-[-.035em] text-white sm:text-[42px] xl:text-[48px]">Your Scout Level</h1>
            <p className="mt-2 max-w-5xl text-sm leading-6 text-[#bac5d4] sm:text-[16px]">ScoutCore Points track your prediction progress. Earn points through correct picks and completed challenges.</p>
          </div>
        </header>

        <section className="mt-7 sm:mt-9">
          <div className="grid grid-cols-5 gap-x-1 sm:gap-x-3 lg:gap-x-4 xl:gap-x-7">
            {LEVELS.map((level, index) => {
              const active = index === currentIndex;
              return (
                <article key={level.name} className={`relative flex min-w-0 flex-col items-center rounded-xl px-0.5 pb-2 pt-4 text-center transition-all sm:rounded-2xl sm:px-3 sm:pb-3 sm:pt-5 ${active ? 'border border-[#1de9f2] bg-[#0a2037]/72 shadow-[0_0_24px_rgba(29,233,242,.12)]' : 'border border-transparent'}`}>
                  {active && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#2cebf1] px-1.5 py-0.5 text-[7px] font-black tracking-[.03em] text-[#04333d] shadow-[0_0_18px_rgba(44,235,241,.35)] sm:-top-3 sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[.06em]">YOU ARE HERE</span>}
                  <ShieldBadge level={level} active={active} />
                  <h2 className="mt-1 flex min-h-[18px] max-w-full items-start justify-center text-[7px] font-extrabold leading-[9px] text-white min-[430px]:text-[8px] min-[430px]:leading-[10px] sm:mt-2 sm:min-h-0 sm:text-[13px] sm:leading-tight lg:text-[17px]">
                    {level.kind === 'allstar' ? <span><span className="block sm:inline">ScoutCore</span><span className="block whitespace-nowrap sm:ml-1 sm:inline">All-Star</span></span> : level.name}
                  </h2>
                  <p className="mt-1 whitespace-nowrap text-[8px] font-medium text-[#c4ccd8] min-[430px]:text-[9px] sm:text-[12px] lg:text-[15px]">{rangeLabel(level)}</p>
                </article>
              );
            })}
          </div>

          <div className="relative mt-2 h-9 sm:mt-4 sm:h-11">
            <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#647086]/70" />
            <div className="absolute left-[10%] top-1/2 h-[3px] -translate-y-1/2 bg-[#27eaf2] shadow-[0_0_10px_rgba(39,234,242,.35)]" style={{ width: `${trackPercent}%` }} />
            <div className="absolute inset-0 grid grid-cols-5 items-center">
              {LEVELS.map((level, index) => {
                const complete = index < currentIndex;
                const active = index === currentIndex;
                return (
                  <div key={level.name} className="flex justify-center">
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border sm:h-8 sm:w-8 sm:border-2 ${complete ? 'border-[#25e8f1] bg-[#0a2438] text-[#25e8f1]' : active ? 'h-5 w-5 border-white bg-[#1596bd] text-white shadow-[0_0_15px_rgba(70,237,255,.8)] sm:h-9 sm:w-9' : 'border-[#455369] bg-[#0d1b30] text-[#556176]'}`}>
                      {complete && <span className="material-symbols-outlined text-[11px] font-bold sm:text-[20px]">check</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-[#263c58] bg-[#09172a]/85 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,.02)] sm:px-7 sm:py-6">
          <div className="grid gap-5 lg:grid-cols-[240px_1fr] lg:items-center xl:grid-cols-[260px_1fr]">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[34px] font-black tracking-[-.03em] text-[#2deaf2] sm:text-[39px]">{loading ? '—' : points.toLocaleString()}</span>
                <span className="text-[28px] font-extrabold text-[#f4f6fb] sm:text-[33px]">/ {targetPoints.toLocaleString()}</span>
              </div>
              <p className="mt-1 text-[15px] text-[#c7cfda] sm:text-[17px]">{next ? `points to ${next.name}` : 'highest Scout level reached'}</p>
            </div>
            <div>
              <div className="h-5 overflow-hidden rounded-full border border-[#5a6677] bg-[linear-gradient(180deg,#263345,#151f2e)] p-[1px]">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#28dce7,#55ecf2)] shadow-[0_0_14px_rgba(47,231,240,.25)] transition-[width] duration-700" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-[12px] font-medium text-[#c1c8d2] sm:text-[14px]"><span>0</span><span>{midpoint.toLocaleString()}</span><span>{targetPoints.toLocaleString()}</span></div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-5 max-w-[690px] rounded-2xl border border-[#263c58] bg-[#09172a]/72 px-3 py-3 sm:px-7 sm:py-4">
          <div className="grid grid-cols-2 gap-0">
            <div className="flex min-w-0 items-center gap-2 border-r border-[#263c58] pr-2 sm:gap-4 sm:pr-7">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#20e8f1] text-[#27eaf2] sm:h-12 sm:w-12"><span className="material-symbols-outlined text-[22px] sm:text-[26px]">shield</span></div>
              <div className="min-w-0"><p className="text-[9px] font-medium text-[#b8c2cf] sm:text-[12px]">Current Level</p><p className="mt-1 truncate text-[13px] font-extrabold text-white sm:text-[19px]">{loading ? 'Loading…' : current.name}</p></div>
            </div>
            <div className="flex min-w-0 items-center gap-2 pl-2 sm:gap-4 sm:pl-7">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#20e8f1] text-[17px] font-bold text-[#27eaf2] sm:h-12 sm:w-12 sm:text-[20px]">S</div>
              <div className="min-w-0"><p className="whitespace-nowrap text-[9px] font-medium text-[#b8c2cf] sm:text-[12px]">ScoutCore Points</p><p className="mt-1 text-[13px] font-extrabold text-white sm:text-[19px]">{loading ? '—' : points.toLocaleString()}</p></div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-[#263c58] bg-[#09172a]/55 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[20px] font-extrabold text-white sm:text-[22px]">Scout Badges</h2>
              <p className="mt-1 text-[12px] text-[#8794a7] sm:text-[13px]">Earn badges by hitting prediction milestones. Earned badges appear automatically on your profile.</p>
            </div>
            <span className="rounded-full border border-[#2d405b] bg-[#0b182a] px-3 py-1 text-[11px] font-bold text-[#aeb9c9]">{earnedCount}/{badges.length} earned</span>
          </div>

          <div className="mt-5 grid grid-cols-6 gap-1 sm:gap-2 lg:gap-4">
            {badges.map((badge) => (
              <article key={badge.name} title={badge.earned ? `Earned: ${badge.name}` : badge.detail} className={`relative flex min-h-[92px] min-w-0 flex-col items-center justify-center rounded-xl border px-0.5 py-2 text-center transition sm:min-h-[118px] sm:rounded-2xl sm:px-2 sm:py-3 lg:min-h-[138px] lg:px-3 lg:py-4 ${badge.earned ? 'border-[#3a506d] bg-[#0b1b31] shadow-[0_8px_26px_rgba(0,0,0,.18)]' : 'border-[#263850] bg-[#091526] opacity-60'}`}>
                {badge.earned && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#65f2b5] text-[#052e27]"><span className="material-symbols-outlined text-[14px] font-black">check</span></span>}
                <div className="flex h-9 w-9 items-center justify-center rounded-full border sm:h-12 sm:w-12 lg:h-16 lg:w-16" style={{ color: badge.accent, background: badge.soft, borderColor: `${badge.accent}66`, boxShadow: badge.earned ? `0 0 22px ${badge.accent}22` : undefined }}>
                  <span className="material-symbols-outlined text-[21px] sm:text-[28px] lg:text-[35px]">{badge.icon}</span>
                </div>
                <h3 className="mt-2 text-[7px] font-extrabold leading-[9px] text-[#eef3fb] min-[430px]:text-[8px] sm:mt-3 sm:text-[10px] sm:leading-3 lg:text-[13px] lg:leading-4">{badge.name}</h3>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-7 pb-4">
          <h2 className="text-[18px] font-extrabold text-white sm:text-[20px]">How levels work</h2>
          <div className="mt-2 h-px bg-[#273a53]" />
          <div className="mt-4 grid gap-3 text-[13px] leading-6 text-[#c0c8d4] sm:text-[14px] lg:max-w-[1020px]">
            <p className="flex items-start gap-3"><span className="material-symbols-outlined mt-[2px] text-[19px] text-[#20e8f1]">check_circle</span><span>Correct picks and challenge bonuses earn ScoutCore Points.</span></p>
            <p className="flex items-start gap-3"><span className="material-symbols-outlined mt-[2px] text-[19px] text-[#20e8f1]">check_circle</span><span>Higher levels unlock as your total points increase.</span></p>
            <p className="flex items-start gap-3"><span className="material-symbols-outlined mt-[2px] text-[19px] text-[#20e8f1]">check_circle</span><span>ScoutCore Points have no cash value.</span></p>
          </div>
        </section>
      </div>
    </div>
  );
};
