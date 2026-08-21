import React, { useState } from 'react';
import { MEMBERSHIP_PRICING, type PremiumPlanChoice } from '../config/membership';
import { supabase } from '../services/supabaseClient';

interface MembershipViewProps { onSignIn: () => void; signedIn: boolean; }

const freeFeatures = [
  'Dashboard and daily MLB schedule',
  'Player + team search',
  'Player and team profiles',
  'Matchups + game logs',
  'Community posting and comments',
  'Basic analytics and scouting data',
  'Saved preferences and favorite team',
  '5 ranked ScoutCore Challenge Entries each week',
];

const premiumFeatures = [
  'Everything in the free account',
  'Every qualified Daily Intelligence signal',
  'Full evidence behind every Scout Confidence score',
  'Advanced AI Scout Reports and matchup models',
  'Advanced matchup and split filters',
  'Expanded team and player watchlists',
  'Personalized lineup, pitcher and injury alerts',
  'Full-season signal and prediction history',
  'Personalized weekly Scout reports',
  'Priority access to new ScoutCore tools',
  'Premium profile customization',
];

const FeatureList = ({ items, premium = false, compactOnMobile = false }: { items: string[]; premium?: boolean; compactOnMobile?: boolean }) => (
  <div className="mt-6 space-y-3">
    {items.map((item, index) => (
      <div key={item} className={`${compactOnMobile && index >= 4 ? 'hidden sm:flex' : 'flex'} items-start gap-2.5 text-sm text-[#d1d9e7]`}>
        <span className={`material-symbols-outlined mt-0.5 text-[18px] ${premium ? 'text-[#00f0ff]' : 'text-[#65f2b5]'}`}>check</span>
        <span>{item}</span>
      </div>
    ))}
  </div>
);

const money = (amount: number) => `$${amount.toFixed(2)}`;

export const MembershipView: React.FC<MembershipViewProps> = ({ onSignIn, signedIn }) => {
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlanChoice>('monthly');
  const [savingInterest, setSavingInterest] = useState(false);
  const [interestMessage, setInterestMessage] = useState<string | null>(null);

  const choosePremium = async (choice: PremiumPlanChoice) => {
    setSelectedPlan(choice);
    setInterestMessage(null);

    if (!signedIn || !supabase) {
      onSignIn();
      return;
    }

    setSavingInterest(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          premium_interest: choice,
          premium_interest_recorded_at: new Date().toISOString(),
        },
      });
      if (error) throw error;
      setInterestMessage(choice === 'monthly'
        ? 'Monthly launch interest saved. No payment has started.'
        : 'Season Pass launch interest saved. No payment has started.');
    } catch {
      setInterestMessage('We could not save your choice yet. Please try again.');
    } finally {
      setSavingInterest(false);
    }
  };

  return (
  <div className="min-h-screen bg-[#0b1326] p-4 text-[#dae2fd] sm:p-6 lg:p-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-7">
        <div className="text-[11px] uppercase tracking-[.22em] text-[#65f2b5]">ScoutCore Plans</div>
        <h1 className="mt-2 text-3xl font-bold text-[#dbfcff]">{signedIn ? 'Upgrade your scouting' : 'Free Scout vs ScoutCore Pro'}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9aabad]">
          Keep the complete community experience free. Upgrade when you want every qualified signal, deeper matchup evidence, custom alerts and full-season history.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <section className="relative order-2 rounded-2xl border border-[#34425a] bg-[#151e32] p-6 xl:order-1">
          {signedIn && <div className="absolute right-4 top-4 rounded-full border border-[#65f2b5]/30 bg-[#65f2b5]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#65f2b5]">Your plan</div>}
          <div className="flex items-start justify-between gap-4 pr-20">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#9aabad]">ScoutCore</div>
              <div className="mt-2 text-3xl font-bold">Free Scout</div>
              <div className="mt-1 text-xs text-[#849495]">$0 · no credit card required</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-[#65f2b5]">sports_baseball</span>
          </div>
          <FeatureList items={freeFeatures} compactOnMobile />
          <p className="mt-4 text-xs text-[#849495] sm:hidden">Plus community, saved preferences, scouting data and weekly Challenge Entries.</p>
          {signedIn ? (
            <div className="mt-7 w-full rounded-xl border border-[#3b494b]/50 py-3 text-center text-sm font-semibold text-[#9fe8c9]">Free account active</div>
          ) : (
            <button onClick={onSignIn} className="mt-7 w-full rounded-xl border border-[#00f0ff]/45 bg-[#00f0ff]/8 py-3 text-sm font-bold text-[#7df4ff] hover:bg-[#00f0ff]/12">Create free account</button>
          )}
        </section>

        <section className="relative order-1 overflow-hidden rounded-2xl border border-[#00f0ff]/50 bg-[linear-gradient(145deg,#122039,#101a2d)] p-5 shadow-[0_0_34px_rgba(0,240,255,.09)] sm:p-6 xl:order-2">
          <div className="absolute right-0 top-0 rounded-bl-xl bg-[#00f0ff] px-3 py-1 text-[10px] font-extrabold text-[#00363a]">7 DAYS FREE</div>
          <div className="flex items-start justify-between gap-4 pr-20 sm:pr-24">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#00f0ff]">For deeper gameday intelligence</div>
              <div className="mt-2 text-3xl font-bold">ScoutCore Pro</div>
              <div className="mt-1 text-xs text-[#849495]">Choose monthly flexibility or one season payment</div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedPlan('monthly')}
              aria-pressed={selectedPlan === 'monthly'}
              className={`rounded-2xl border p-4 text-left transition ${selectedPlan === 'monthly' ? 'border-[#00f0ff] bg-[#00f0ff]/10 shadow-[0_0_18px_rgba(0,240,255,.08)]' : 'border-[#33445e] bg-[#0b1527]/70 hover:border-[#00f0ff]/50'}`}
            >
              <span className="block text-[10px] font-extrabold uppercase tracking-[.18em] text-[#65f2b5]">Monthly</span>
              <span className="mt-2 block text-3xl font-black text-white">{money(MEMBERSHIP_PRICING.monthly.introductoryPrice)}</span>
              <span className="mt-1 block text-xs leading-5 text-[#a8b6ca]">First month after the free trial</span>
              <span className="mt-2 block text-[11px] font-semibold text-[#79eaf2]">Then {money(MEMBERSHIP_PRICING.monthly.recurringPrice)}/month</span>
              <span className="mt-1 block text-[10px] text-[#a8b6ca]">Cancel anytime · no cancellation fee</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPlan('season')}
              aria-pressed={selectedPlan === 'season'}
              className={`relative rounded-2xl border p-4 text-left transition ${selectedPlan === 'season' ? 'border-[#00f0ff] bg-[#00f0ff]/10 shadow-[0_0_18px_rgba(0,240,255,.08)]' : 'border-[#33445e] bg-[#0b1527]/70 hover:border-[#00f0ff]/50'}`}
            >
              <span className="absolute right-3 top-3 rounded-full bg-[#65f2b5]/15 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#65f2b5]">Best value</span>
              <span className="block text-[10px] font-extrabold uppercase tracking-[.18em] text-[#65f2b5]">Season Pass</span>
              <span className="mt-2 block text-3xl font-black text-white">{money(MEMBERSHIP_PRICING.season.price)}</span>
              <span className="mt-1 block text-xs leading-5 text-[#a8b6ca]">One payment for the full season + postseason</span>
              <span className="mt-2 block text-[11px] font-semibold text-[#79eaf2]">Does not auto-renew</span>
              <span className="mt-1 block text-[10px] text-[#a8b6ca]">Save $12.94 vs seven monthly payments</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => choosePremium(selectedPlan)}
            disabled={savingInterest}
            className="mt-7 w-full rounded-xl bg-[#00f0ff] py-3 text-center text-sm font-extrabold text-[#00363a] transition hover:bg-[#71f7ff] disabled:cursor-wait disabled:opacity-70"
          >
            {savingInterest ? 'Saving…' : signedIn ? `Choose ${selectedPlan === 'monthly' ? 'Monthly' : 'Season Pass'}` : 'Create free account to continue'}
          </button>
          <p className="mt-2 text-center text-[10px] leading-4 text-[#849495]">No charge today. Secure checkout will show the complete terms and ask for confirmation before the trial begins.</p>
          {interestMessage && <div role="status" className="mt-3 rounded-xl border border-[#65f2b5]/25 bg-[#65f2b5]/8 px-3 py-2 text-center text-xs text-[#a9f2d2]">{interestMessage}</div>}
          <FeatureList items={premiumFeatures} premium />
        </section>
      </div>

      <div className="mt-5 rounded-xl border border-[#3b494b]/30 bg-[#10192b] px-4 py-3 text-xs leading-5 text-[#849495]">
        Monthly plan: 7-day free trial, then {money(MEMBERSHIP_PRICING.monthly.introductoryPrice)} for the first paid month, then {money(MEMBERSHIP_PRICING.monthly.recurringPrice)}/month until cancelled. Season Pass: {money(MEMBERSHIP_PRICING.season.price)} as one non-renewing payment for the full MLB season and postseason. Nothing on this preview page starts a paid subscription.
      </div>
    </div>
  </div>
  );
};
