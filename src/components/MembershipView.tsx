import React from 'react';

interface MembershipViewProps { onSignIn: () => void; signedIn: boolean; }

const freeFeatures = ['Player + team search', 'Schedules and matchup pages', 'Recent game logs', 'Basic player profiles'];
const proFeatures = ['Unlimited AI Scout Reports', 'Saved players, teams and watchlists', 'Advanced matchup filters', 'Lineup + probable pitcher alerts', 'Deeper pitch-mix and trend tools', 'Downloadable scouting reports'];

export const MembershipView: React.FC<MembershipViewProps> = ({ onSignIn, signedIn }) => (
  <div className="p-8 max-w-6xl mx-auto">
    <div className="mb-7"><div className="text-[11px] uppercase tracking-[.22em] text-[#65f2b5]">ScoutCore Membership</div><h1 className="text-3xl font-bold mt-2">Choose how deep you want to scout.</h1><p className="text-sm text-[#9aabad] mt-2 max-w-2xl">Core MLB information stays useful for everyone. Pro is for users who want saved intelligence, deeper analysis and more AI-assisted scouting.</p></div>
    <div className="grid md:grid-cols-2 gap-5">
      <div className="rounded-2xl border border-[#34425a] bg-[#151e32] p-6"><div className="flex justify-between items-start"><div><div className="text-xs uppercase text-[#9aabad]">Free</div><div className="text-3xl font-bold mt-2">$0</div><div className="text-xs text-[#849495] mt-1">No payment required</div></div><span className="material-symbols-outlined text-[#9aabad]">sports_baseball</span></div><div className="mt-6 space-y-3">{freeFeatures.map(x=><div key={x} className="flex gap-2 text-sm"><span className="material-symbols-outlined text-[#65f2b5] text-[17px]">check</span>{x}</div>)}</div><button onClick={onSignIn} className="mt-7 w-full py-3 rounded-xl border border-[#3b494b] hover:border-[#00f0ff]/60 text-sm">{signedIn ? 'Current plan' : 'Create free account'}</button></div>
      <div className="rounded-2xl border border-[#00f0ff]/45 bg-[#121f35] p-6 shadow-[0_0_30px_rgba(0,240,255,.08)] relative overflow-hidden"><div className="absolute top-0 right-0 bg-[#00f0ff] text-[#00363a] text-[10px] font-bold px-3 py-1 rounded-bl-xl">PLANNED</div><div className="flex justify-between items-start"><div><div className="text-xs uppercase text-[#00f0ff]">ScoutCore Pro</div><div className="text-3xl font-bold mt-2">Premium</div><div className="text-xs text-[#849495] mt-1">Price will be set before launch</div></div><span className="material-symbols-outlined text-[#00f0ff]">workspace_premium</span></div><div className="mt-6 space-y-3">{proFeatures.map(x=><div key={x} className="flex gap-2 text-sm"><span className="material-symbols-outlined text-[#00f0ff] text-[17px]">check</span>{x}</div>)}</div><button disabled className="mt-7 w-full py-3 rounded-xl bg-[#00f0ff]/15 border border-[#00f0ff]/30 text-[#65dce8] text-sm cursor-not-allowed">Payments not connected yet</button></div>
    </div>
    <div className="mt-5 rounded-xl border border-[#3b494b]/30 bg-[#10192b] px-4 py-3 text-xs text-[#849495]">We can decide the exact Pro price and which features are paid after testing what users actually use. Payment processing should only be turned on after a proper merchant/payment account is connected.</div>
  </div>
);
