import React from 'react';

interface MembershipViewProps { onSignIn: () => void; signedIn: boolean; }

const browseFeatures = [
  'Dashboard and daily MLB schedule',
  'Player + team search',
  'Player and team profiles',
  'Matchups + game logs',
  'Basic analytics and scouting data',
];

const accountFeatures = [
  'AI Scout Reports',
  'Save favorite players and teams',
  'Build personal watchlists',
  'Save scouting reports',
  'Personalized lineup + pitcher alerts',
  'Advanced matchup filters',
];

export const MembershipView: React.FC<MembershipViewProps> = ({ onSignIn, signedIn }) => (
  <div className="p-8 max-w-6xl mx-auto">
    <div className="mb-7">
      <div className="text-[11px] uppercase tracking-[.22em] text-[#65f2b5]">ScoutCoreMLB Access</div>
      <h1 className="text-3xl font-bold mt-2">Scout for free. Sign up when you want more.</h1>
      <p className="text-sm text-[#9aabad] mt-2 max-w-2xl">No account is required to explore ScoutCoreMLB. Search players, check games and use the core baseball tools immediately. A free account unlocks personalized scouting features.</p>
    </div>

    <div className="grid md:grid-cols-2 gap-5">
      <div className="rounded-2xl border border-[#34425a] bg-[#151e32] p-6">
        <div className="flex justify-between items-start">
          <div><div className="text-xs uppercase text-[#9aabad]">Browse ScoutCoreMLB</div><div className="text-3xl font-bold mt-2">Free</div><div className="text-xs text-[#849495] mt-1">No account required</div></div>
          <span className="material-symbols-outlined text-[#9aabad]">sports_baseball</span>
        </div>
        <div className="mt-6 space-y-3">{browseFeatures.map(x => <div key={x} className="flex gap-2 text-sm"><span className="material-symbols-outlined text-[#65f2b5] text-[17px]">check</span>{x}</div>)}</div>
        <div className="mt-7 w-full py-3 rounded-xl border border-[#3b494b]/50 text-center text-sm text-[#9aabad]">Available to everyone</div>
      </div>

      <div className="rounded-2xl border border-[#00f0ff]/45 bg-[#121f35] p-6 shadow-[0_0_30px_rgba(0,240,255,.08)] relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-[#00f0ff] text-[#00363a] text-[10px] font-bold px-3 py-1 rounded-bl-xl">FREE ACCOUNT</div>
        <div className="flex justify-between items-start">
          <div><div className="text-xs uppercase text-[#00f0ff]">ScoutCoreMLB Account</div><div className="text-3xl font-bold mt-2">Unlock More</div><div className="text-xs text-[#849495] mt-1">Still $0 · just create an account</div></div>
          <span className="material-symbols-outlined text-[#00f0ff]">person_add</span>
        </div>
        <div className="mt-6 space-y-3">{accountFeatures.map(x => <div key={x} className="flex gap-2 text-sm"><span className="material-symbols-outlined text-[#00f0ff] text-[17px]">check</span>{x}</div>)}</div>
        <button onClick={onSignIn} className="mt-7 w-full py-3 rounded-xl bg-[#00f0ff] hover:opacity-90 text-[#00363a] font-bold text-sm transition-opacity">{signedIn ? 'Account features unlocked' : 'Create free account'}</button>
      </div>
    </div>

    <div className="mt-5 rounded-xl border border-[#3b494b]/30 bg-[#10192b] px-4 py-3 text-xs text-[#849495]">No premium subscription or payment is required. We can consider paid features later only if ScoutCoreMLB eventually has additional tools worth charging for.</div>
  </div>
);
