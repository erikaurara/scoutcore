import React, { useEffect, useState } from 'react';
import { freeAnalysisAccess, getAnalysisAccess, guestAnalysisAccess, type AnalysisAccess } from '../services/accessControl';

interface MembershipViewProps {
  onSignIn: () => void;
  signedIn: boolean;
}

type PremiumPlan = 'monthly' | 'season';

const premiumHighlights = [
  { icon: 'all_inclusive', title: 'Unlimited daily analysis', detail: 'Use Matchup Lab and Team Analysis without daily limits.' },
  { icon: 'query_stats', title: 'Deeper player intelligence', detail: 'Unlock every prediction card, longer trends, advanced splits and matchup filters.' },
  { icon: 'monitoring', title: 'Expanded analytics', detail: 'Explore longer date ranges, team search and combined-season context.' },
  { icon: 'notifications_active', title: 'Smarter alerts', detail: 'Get personalized lineup, pitcher, injury and watchlist updates.' },
  { icon: 'description', title: 'Reports and exports', detail: 'Save expanded scouting reports and download clean summaries.' },
  { icon: 'confirmation_number', title: 'More personal Challenge entries', detail: 'Keep 5 ranked Tickets and receive 10 extra personal Tickets each week.' },
];

const comparisonRows = [
  { feature: 'Matchup Lab', free: '3 per day', premium: 'Unlimited' },
  { feature: 'Team Analysis', free: '1 per day', premium: 'Unlimited' },
  { feature: 'Player Prediction cards', free: 'Top 3', premium: 'All 5' },
  { feature: 'Trend and matchup filters', free: 'L5 and L10', premium: 'L20, L30, season and H2H' },
  { feature: 'Analytics history', free: 'Today and yesterday', premium: 'Extended date ranges' },
  { feature: 'Scout Reports and exports', free: 'Basic', premium: 'Advanced' },
  { feature: 'Weekly Challenge Tickets', free: '5 ranked', premium: '5 ranked + 10 personal' },
];

const PlanButton = ({ children, onClick, disabled = false, secondary = false }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean; secondary?: boolean }>) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`mt-auto w-full rounded-xl px-4 py-3 text-xs font-black tracking-[.05em] transition-all disabled:cursor-default disabled:opacity-70 ${secondary
      ? 'border border-[#3a4d68] bg-[#0b1527] text-[#d6e0ef] hover:border-[#5d718e] hover:bg-[#111d31]'
      : 'bg-[#00e7f2] text-[#00363a] shadow-[0_10px_28px_rgba(0,231,242,.18)] hover:bg-[#73f5ff] hover:shadow-[0_12px_34px_rgba(0,231,242,.24)]'}`}
  >
    {children}
  </button>
);

export const MembershipView: React.FC<MembershipViewProps> = ({ onSignIn, signedIn }) => {
  const [access, setAccess] = useState<AnalysisAccess>(() => signedIn ? freeAnalysisAccess : guestAnalysisAccess);
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlan | null>(null);

  useEffect(() => {
    let active = true;
    getAnalysisAccess(signedIn).then((next) => { if (active) setAccess(next); }).catch(() => {});
    return () => { active = false; };
  }, [signedIn]);

  const premiumActive = access.tier === 'premium' || access.tier === 'admin';
  const premiumStatus = access.tier === 'admin' ? 'ADMIN ACCESS ACTIVE' : 'PREMIUM ACTIVE';
  const choosePlan = (plan: PremiumPlan) => {
    if (!signedIn) {
      onSignIn();
      return;
    }
    if (!premiumActive) setSelectedPlan(plan);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_70%_0%,rgba(0,231,242,.09),transparent_34%),#07101f] px-3 py-5 text-[#dae2fd] sm:px-6 sm:py-7 lg:px-8 lg:py-9">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-3xl border border-[#26435a] bg-[linear-gradient(135deg,rgba(18,34,58,.98),rgba(7,17,32,.98))] px-5 py-6 shadow-[0_22px_60px_rgba(0,0,0,.2)] sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-[#00e7f2]/20 bg-[#00e7f2]/5 blur-sm" />
          <div className="relative max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#00e7f2]/35 bg-[#00e7f2]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-[#6ef5ff]">Premium Access</span>
              {premiumActive && <span className="rounded-full border border-[#65f2b5]/35 bg-[#65f2b5]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-[#8ff7c7]">{premiumStatus}</span>}
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">Unlimited analysis. Deeper data. Your full season.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#b8c6d8] sm:text-base sm:leading-7">Explore every matchup without daily limits, unlock the complete prediction toolkit and keep more of your scouting work in one place.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold text-[#d7e5f2]">
              <span className="flex items-center gap-1.5 rounded-lg border border-[#314860] bg-[#0a1628]/80 px-3 py-2"><span className="material-symbols-outlined text-[16px] text-[#65f2b5]">check_circle</span>7-day free trial</span>
              <span className="flex items-center gap-1.5 rounded-lg border border-[#314860] bg-[#0a1628]/80 px-3 py-2"><span className="material-symbols-outlined text-[16px] text-[#65f2b5]">event_available</span>Cancel anytime</span>
              <span className="flex items-center gap-1.5 rounded-lg border border-[#314860] bg-[#0a1628]/80 px-3 py-2"><span className="material-symbols-outlined text-[16px] text-[#65f2b5]">credit_card_off</span>No charge today</span>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          <article className="flex min-h-[330px] flex-col rounded-2xl border border-[#293d57] bg-[#101a2d] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#95a7bc]">Free Account</p>
                <h2 className="mt-2 text-2xl font-black text-white">$0</h2>
                <p className="mt-1 text-xs text-[#95a7bc]">No cost · no credit card</p>
              </div>
              <span className="material-symbols-outlined rounded-xl bg-[#65f2b5]/10 p-2.5 text-[#65f2b5]">sports_baseball</span>
            </div>
            <ul className="my-6 space-y-3 text-sm text-[#c6d2e0]">
              <li className="flex gap-2"><span className="material-symbols-outlined text-[17px] text-[#65f2b5]">check</span>Core dashboard and schedule</li>
              <li className="flex gap-2"><span className="material-symbols-outlined text-[17px] text-[#65f2b5]">check</span>Daily limited analysis</li>
              <li className="flex gap-2"><span className="material-symbols-outlined text-[17px] text-[#65f2b5]">check</span>Community and 5 ranked Tickets</li>
            </ul>
            <PlanButton disabled secondary>
              {signedIn && !premiumActive ? 'CURRENT FREE PLAN' : premiumActive ? 'INCLUDED WITH PREMIUM' : 'FREE TO EXPLORE'}
            </PlanButton>
          </article>

          <article className="relative flex min-h-[330px] flex-col overflow-hidden rounded-2xl border border-[#00e7f2]/60 bg-[linear-gradient(155deg,#132b43,#0b1729)] p-5 pt-10 shadow-[0_18px_46px_rgba(0,231,242,.1)] sm:p-6 sm:pt-10">
            <div className="absolute right-0 top-0 rounded-bl-xl bg-[#00e7f2] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.12em] text-[#00363a]">Most flexible</div>
            <div className="flex items-start justify-between gap-4 pr-20">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#65f4ff]">Monthly Premium</p>
                <div className="mt-2 flex items-end gap-2">
                  <h2 className="text-3xl font-black text-white">$7.99</h2>
                  <span className="pb-1 text-xs text-[#a9bbcf]">first month</span>
                </div>
                <p className="mt-1 text-xs text-[#a9bbcf]">Then $9.99 per month</p>
              </div>
              <span className="material-symbols-outlined rounded-xl bg-[#00e7f2]/12 p-2.5 text-[#5cf4ff]">autorenew</span>
            </div>
            <ul className="my-6 space-y-3 text-sm text-[#d2deea]">
              <li className="flex gap-2"><span className="material-symbols-outlined text-[17px] text-[#65f2b5]">check</span>7 days free before billing</li>
              <li className="flex gap-2"><span className="material-symbols-outlined text-[17px] text-[#65f2b5]">check</span>All Premium features</li>
              <li className="flex gap-2"><span className="material-symbols-outlined text-[17px] text-[#65f2b5]">check</span>Cancel before renewal</li>
            </ul>
            <PlanButton onClick={() => choosePlan('monthly')} disabled={premiumActive}>
              {premiumActive ? premiumStatus : signedIn ? 'START 7-DAY FREE TRIAL' : 'CREATE ACCOUNT TO CONTINUE'}
            </PlanButton>
          </article>

          <article className="relative flex min-h-[330px] flex-col rounded-2xl border border-[#806cd9]/50 bg-[linear-gradient(155deg,#211e42,#10172c)] p-5 pt-10 sm:p-6 sm:pt-10">
            <div className="absolute right-4 top-4 rounded-full border border-[#a896ff]/35 bg-[#9c86ff]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-[#c4b9ff]">One payment</div>
            <div className="flex items-start justify-between gap-4 pr-24">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b6a8ff]">Season Pass</p>
                <div className="mt-2 flex items-end gap-2">
                  <h2 className="text-3xl font-black text-white">$54.99</h2>
                  <span className="pb-1 text-xs text-[#a9bbcf]">per season</span>
                </div>
                <p className="mt-1 text-xs text-[#a9bbcf]">No monthly renewal</p>
              </div>
              <span className="material-symbols-outlined rounded-xl bg-[#9c86ff]/12 p-2.5 text-[#b6a8ff]">calendar_month</span>
            </div>
            <ul className="my-6 space-y-3 text-sm text-[#d2deea]">
              <li className="flex gap-2"><span className="material-symbols-outlined text-[17px] text-[#65f2b5]">check</span>Season-long Premium access</li>
              <li className="flex gap-2"><span className="material-symbols-outlined text-[17px] text-[#65f2b5]">check</span>All Premium features</li>
              <li className="flex gap-2"><span className="material-symbols-outlined text-[17px] text-[#65f2b5]">check</span>One clear payment</li>
            </ul>
            <PlanButton onClick={() => choosePlan('season')} disabled={premiumActive} secondary>
              {premiumActive ? premiumStatus : signedIn ? 'CHOOSE SEASON PASS' : 'CREATE ACCOUNT TO CONTINUE'}
            </PlanButton>
          </article>
        </section>

        <section className="mt-5 rounded-2xl border border-[#293e57] bg-[#0d182a] p-5 sm:p-7">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#65f2b5]">Premium toolkit</p>
            <h2 className="mt-2 text-2xl font-black text-white">What Premium unlocks</h2>
            <p className="mt-2 text-sm leading-6 text-[#aab9ca]">More room to explore the data—not guaranteed outcomes. IXMetrics remains an analytics and fan research tool.</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {premiumHighlights.map((item) => (
              <article key={item.title} className="rounded-xl border border-[#263a52] bg-[#111d31] p-4">
                <span className="material-symbols-outlined text-[22px] text-[#52edf7]">{item.icon}</span>
                <h3 className="mt-3 text-sm font-black text-white">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-[#aab9ca]">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-[#293e57] bg-[#0d182a]">
          <div className="border-b border-[#293e57] px-5 py-5 sm:px-7">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#65f2b5]">Plan comparison</p>
            <h2 className="mt-2 text-2xl font-black text-white">Free stays useful. Premium removes the limits.</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs sm:text-sm">
              <thead className="bg-[#111d31] text-[10px] uppercase tracking-[.12em] text-[#96a8bc]">
                <tr><th className="px-5 py-3 sm:px-7">Feature</th><th className="px-4 py-3">Free</th><th className="px-4 py-3 text-[#62f3fd]">Premium</th></tr>
              </thead>
              <tbody className="divide-y divide-[#24374e]">
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="text-[#c8d4e1]">
                    <th className="px-5 py-3.5 font-semibold text-white sm:px-7">{row.feature}</th>
                    <td className="px-4 py-3.5 text-[#a9b8c9]">{row.free}</td>
                    <td className="px-4 py-3.5 font-bold text-[#70f5ff]">{row.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-[#293e57] bg-[#0d182a] p-4"><h3 className="text-sm font-black text-white">Can I keep using IXMetrics for free?</h3><p className="mt-2 text-xs leading-5 text-[#aab9ca]">Yes. The free account and its daily baseball tools will remain available.</p></article>
          <article className="rounded-xl border border-[#293e57] bg-[#0d182a] p-4"><h3 className="text-sm font-black text-white">Can I cancel the monthly plan?</h3><p className="mt-2 text-xs leading-5 text-[#aab9ca]">Yes. Monthly Premium can be cancelled before the next renewal.</p></article>
          <article className="rounded-xl border border-[#293e57] bg-[#0d182a] p-4"><h3 className="text-sm font-black text-white">Will clicking a plan charge me now?</h3><p className="mt-2 text-xs leading-5 text-[#aab9ca]">No. Checkout is not connected yet, and every future purchase will require clear confirmation.</p></article>
        </section>

        <p className="mx-auto mt-5 max-w-4xl text-center text-[10px] leading-5 text-[#7f91a7]">Challenge Tickets have no cash value and cannot be purchased individually, transferred or redeemed. Premium analytics describe data signals and never guarantee an outcome.</p>
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-[#020714]/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPlan(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="premium-launch-title" className="w-full max-w-md rounded-2xl border border-[#00e7f2]/45 bg-[#101c30] p-5 shadow-[0_26px_80px_rgba(0,0,0,.45)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="material-symbols-outlined rounded-xl bg-[#00e7f2]/12 p-3 text-[#5cf4ff]">verified</span>
              <button type="button" onClick={() => setSelectedPlan(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#344a65] text-[#b9c8d9] hover:border-[#63eff8] hover:text-white" aria-label="Close"><span className="material-symbols-outlined text-[20px]">close</span></button>
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[.15em] text-[#65f2b5]">{selectedPlan === 'monthly' ? 'Monthly Premium selected' : 'Season Pass selected'}</p>
            <h2 id="premium-launch-title" className="mt-2 text-2xl font-black text-white">Premium checkout is coming next</h2>
            <p className="mt-3 text-sm leading-6 text-[#b8c6d8]">The plan page is ready, but checkout is not connected yet. No payment was made and no trial has started.</p>
            <button type="button" onClick={() => setSelectedPlan(null)} className="mt-5 w-full rounded-xl bg-[#00e7f2] px-4 py-3 text-xs font-black text-[#00363a] hover:bg-[#73f5ff]">GOT IT</button>
          </section>
        </div>
      )}
    </div>
  );
};
