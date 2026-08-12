import React from 'react';

interface MembershipViewProps { onSignIn: () => void; signedIn: boolean; }

const freeFeatures = [
  'Dashboard and daily MLB schedule',
  'Player + team search',
  'Player and team profiles',
  'Matchups + game logs',
  'Community posting and comments',
  'Basic analytics and scouting data',
  'Saved preferences and favorite team',
  '5 ranked ScoutCore Challenge Tickets each week',
];

const premiumFeatures = [
  'Everything in the free account',
  '5 ranked Challenge Tickets + 10 extra personal Challenge Tickets each week',
  'Extra Challenge Tickets do not add leaderboard attempts, keeping rankings fair',
  'Advanced AI Scout Reports',
  'Deeper pitcher-vs-batter matchup models',
  'Advanced matchup and split filters',
  'Expanded watchlists and saved scouting reports',
  'Personalized lineup, pitcher and injury alerts',
  'Downloadable scouting summaries and exports',
  'Priority access to new ScoutCore tools',
  'Premium profile customization',
];

const FeatureList = ({ items, premium = false }: { items: string[]; premium?: boolean }) => (
  <div className="mt-6 space-y-3">
    {items.map((item) => (
      <div key={item} className="flex items-start gap-2.5 text-sm text-[#d1d9e7]">
        <span className={`material-symbols-outlined mt-0.5 text-[18px] ${premium ? 'text-[#00f0ff]' : 'text-[#65f2b5]'}`}>check</span>
        <span>{item}</span>
      </div>
    ))}
  </div>
);

export const MembershipView: React.FC<MembershipViewProps> = ({ onSignIn, signedIn }) => (
  <div className="min-h-screen bg-[#0b1326] p-4 sm:p-6 lg:p-8 text-[#dae2fd]">
    <div className="mx-auto max-w-6xl">
      <div className="mb-7">
        <div className="text-[11px] uppercase tracking-[.22em] text-[#65f2b5]">ScoutCoreMLB Plans</div>
        <h1 className="mt-2 text-3xl font-bold text-[#dbfcff]">{signedIn ? 'Want Premium?' : 'Free account vs Premium'}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9aabad]">
          Your ScoutCoreMLB account stays useful for free. Premium is a future upgrade for people who want deeper scouting tools, more saved work, stronger alerts, expanded analysis and additional personal Challenge entries.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="relative rounded-2xl border border-[#34425a] bg-[#151e32] p-6">
          {signedIn && <div className="absolute right-4 top-4 rounded-full border border-[#65f2b5]/30 bg-[#65f2b5]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#65f2b5]">Your plan</div>}
          <div className="flex items-start justify-between gap-4 pr-20">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#9aabad]">ScoutCoreMLB</div>
              <div className="mt-2 text-3xl font-bold">Free Account</div>
              <div className="mt-1 text-xs text-[#849495]">$0 · no credit card required</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-[#65f2b5]">sports_baseball</span>
          </div>
          <FeatureList items={freeFeatures} />
          {signedIn ? (
            <div className="mt-7 w-full rounded-xl border border-[#3b494b]/50 py-3 text-center text-sm font-semibold text-[#9fe8c9]">Free account active</div>
          ) : (
            <button onClick={onSignIn} className="mt-7 w-full rounded-xl border border-[#00f0ff]/45 bg-[#00f0ff]/8 py-3 text-sm font-bold text-[#7df4ff] hover:bg-[#00f0ff]/12">Create free account</button>
          )}
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-[#00f0ff]/50 bg-[linear-gradient(145deg,#122039,#101a2d)] p-6 shadow-[0_0_34px_rgba(0,240,255,.09)]">
          <div className="absolute right-0 top-0 rounded-bl-xl bg-[#00f0ff] px-3 py-1 text-[10px] font-extrabold text-[#00363a]">PREMIUM PREVIEW</div>
          <div className="flex items-start justify-between gap-4 pr-24">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#00f0ff]">For power users</div>
              <div className="mt-2 text-3xl font-bold">Premium</div>
              <div className="mt-1 text-xs text-[#849495]">Pricing will be announced before launch</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-[#00f0ff]">workspace_premium</span>
          </div>
          <FeatureList items={premiumFeatures} premium />
          <div className="mt-7 w-full rounded-xl bg-[#00f0ff] py-3 text-center text-sm font-extrabold text-[#00363a]">Premium coming soon</div>
        </section>
      </div>

      <div className="mt-5 rounded-xl border border-[#3b494b]/30 bg-[#10192b] px-4 py-3 text-xs leading-5 text-[#849495]">
        Challenge Tickets have no cash value and cannot be purchased individually, transferred or redeemed. Nothing on this page starts a paid subscription. ScoutCoreMLB will clearly show pricing and ask for confirmation before any future paid plan is activated.
      </div>
    </div>
  </div>
);
