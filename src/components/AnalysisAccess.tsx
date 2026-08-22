import React from 'react';
import type { AnalysisAccess, AnalysisFeature } from '../services/accessControl';

const featureNames: Record<AnalysisFeature, string> = {
  matchup_lab: 'Matchup Lab',
  team_analysis: 'Team Analysis',
};

const resetLabel = (resetAt: string | null) => {
  if (!resetAt) return 'midnight ET';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(resetAt));
  } catch {
    return 'midnight ET';
  }
};

type AccessBannerProps = {
  access: AnalysisAccess;
  loading?: boolean;
  feature?: AnalysisFeature;
  freeDescription?: string;
  onSignIn: () => void;
  onUpgrade: () => void;
};

export const AnalysisAccessBanner: React.FC<AccessBannerProps> = ({
  access,
  loading = false,
  feature,
  freeDescription,
  onSignIn,
  onUpgrade,
}) => {
  if (loading) {
    return (
      <div className="mx-auto my-3 flex w-[calc(100%-2rem)] max-w-6xl items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">
        <span className="material-symbols-outlined animate-spin text-base text-cyan-300">progress_activity</span>
        Checking account access…
      </div>
    );
  }

  if (access.tier === 'guest') {
    return (
      <div className="mx-auto my-3 flex w-[calc(100%-2rem)] max-w-6xl flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.07] px-4 py-3 text-sm text-slate-200">
        <span><b className="text-cyan-300">Free preview</b> · Create an account to run daily analysis.</span>
        <button type="button" onClick={onSignIn} className="rounded-lg bg-cyan-400 px-3 py-2 font-bold text-slate-950">SIGN IN OR JOIN</button>
      </div>
    );
  }

  if (access.unlimited) {
    return (
      <div className="mx-auto my-3 flex w-[calc(100%-2rem)] max-w-6xl items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-3 text-sm text-emerald-200">
        <span className="material-symbols-outlined text-base">all_inclusive</span>
        <b>{access.tier === 'admin' ? 'Admin' : 'Premium'}</b> · Unlimited analysis
      </div>
    );
  }

  const remaining = feature ? access.remaining[feature] ?? 0 : null;
  const limit = feature ? access.limits[feature] : null;
  return (
    <div className="mx-auto my-3 flex w-[calc(100%-2rem)] max-w-6xl flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/25 bg-slate-900/85 px-4 py-3 text-sm text-slate-200">
      <span>
        <b className="text-cyan-300">Free account</b>
        {feature && <> · <strong>{remaining}</strong> of {limit} {featureNames[feature]} {limit === 1 ? 'analysis' : 'analyses'} remaining today</>}
        {!feature && freeDescription && <> · {freeDescription}</>}
      </span>
      <button type="button" onClick={onUpgrade} className="rounded-lg border border-cyan-400/50 px-3 py-2 font-bold text-cyan-200">SEE PREMIUM</button>
    </div>
  );
};

type LimitDialogProps = {
  open: boolean;
  access: AnalysisAccess;
  feature: AnalysisFeature;
  message?: string | null;
  onClose: () => void;
  onSignIn: () => void;
  onUpgrade: () => void;
};

export const AnalysisLimitDialog: React.FC<LimitDialogProps> = ({
  open,
  access,
  feature,
  message,
  onClose,
  onSignIn,
  onUpgrade,
}) => {
  if (!open) return null;
  const isGuest = access.tier === 'guest';

  return (
    <div className="fixed inset-0 z-[900] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#0c1729] p-6 text-[#eef3ff] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="analysis-access-title">
        <div className="mb-4 flex items-start justify-between gap-4">
          <span className="grid size-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><span className="material-symbols-outlined">lock_clock</span></span>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-lg border border-slate-700 text-slate-300"><span className="material-symbols-outlined">close</span></button>
        </div>
        <h2 id="analysis-access-title" className="text-xl font-black">{isGuest ? `Sign in to use ${featureNames[feature]}` : `Today’s ${featureNames[feature]} limit reached`}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {message || (isGuest
            ? `A free account includes ${feature === 'matchup_lab' ? '3 Matchup Lab analyses' : '1 Team Analysis'} each day.`
            : `Your free access resets at ${resetLabel(access.resetAt)}. Premium accounts have unlimited analysis.`)}
        </p>
        <button type="button" onClick={isGuest ? onSignIn : onUpgrade} className="mt-5 w-full rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950">
          {isGuest ? 'SIGN IN OR CREATE FREE ACCOUNT' : 'VIEW PREMIUM ACCESS'}
        </button>
        <button type="button" onClick={onClose} className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-bold text-slate-400">NOT NOW</button>
      </section>
    </div>
  );
};
