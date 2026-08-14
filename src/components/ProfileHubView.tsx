import React from 'react';

interface ProfileHubViewProps {
  userEmail: string;
  onOpenWeekly: () => void;
  onOpenPredictions: () => void;
  onOpenLeaderboard: () => void;
  onOpenFriendsChallenge: () => void;
  onOpenScoutLevel: () => void;
  onOpenSettings: () => void;
}

const HubRow: React.FC<{ icon: string; title: string; detail: string; onClick: () => void }> = ({ icon, title, detail, onClick }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-[#142238] active:bg-[#18283f]">
    <span className="material-symbols-outlined text-[25px] text-[#7df4ff]">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-base font-bold text-white">{title}</span>
      <span className="mt-0.5 block text-xs text-[#849495]">{detail}</span>
    </span>
    <span className="material-symbols-outlined text-[#778aa4]">chevron_right</span>
  </button>
);

export const ProfileHubView: React.FC<ProfileHubViewProps> = ({
  userEmail,
  onOpenWeekly,
  onOpenPredictions,
  onOpenLeaderboard,
  onOpenFriendsChallenge,
  onOpenScoutLevel,
  onOpenSettings,
}) => {
  const initial = (userEmail.trim()[0] || 'U').toUpperCase();
  const name = userEmail.split('@')[0] || 'ScoutCore User';

  return (
    <div className="min-h-screen bg-[#0b1326] px-4 py-6 text-[#dae2fd] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="overflow-hidden rounded-2xl border border-[#2a405b] bg-[#101a2d]">
          <div className="relative h-28 bg-[radial-gradient(circle_at_15%_10%,rgba(0,240,255,.23),transparent_35%),linear-gradient(120deg,#17254a,#0d1426_55%,#101a2d)] sm:h-36">
            <button type="button" onClick={onOpenSettings} aria-label="Open settings" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#07101f]/60 text-white backdrop-blur hover:border-[#00f0ff]/45">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
          <div className="px-5 pb-6 sm:px-7">
            <div className="-mt-11 flex items-end gap-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-[#101a2d] bg-[#00f0ff] text-3xl font-extrabold text-[#00363a] shadow-xl">{initial}</div>
              <div className="pb-2">
                <div className="text-xs font-bold uppercase tracking-[.14em] text-[#65f2b5]">ScoutCore Profile</div>
                <h1 className="mt-1 text-3xl font-extrabold text-white">{name}</h1>
                <div className="mt-1 text-sm text-[#849495]">{userEmail}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-3 sm:p-4">
          <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#65f2b5]">ScoutCore Activity</div>
          <div className="divide-y divide-[#2a405b] overflow-hidden rounded-xl border border-[#263951] bg-[#0c1627]">
            <HubRow icon="emoji_events" title="Weekly Challenge" detail="Your ScoutCore-wide weekly competition" onClick={onOpenWeekly} />
            <HubRow icon="sports_baseball" title="Friends Challenge" detail="Head-to-head, same-game and Team Up challenges · 0 tickets" onClick={onOpenFriendsChallenge} />
            <HubRow icon="track_changes" title="My Predictions" detail="Upcoming, finished and statistics" onClick={onOpenPredictions} />
            <HubRow icon="leaderboard" title="Leaderboard" detail="See ScoutCore rankings" onClick={onOpenLeaderboard} />
            <HubRow icon="explore" title="Your Scout Level" detail="Points, badges and progress" onClick={onOpenScoutLevel} />
          </div>
        </section>

        <section className="rounded-2xl border border-[#2a405b] bg-[#0c1627] p-4 text-xs leading-5 text-[#849495]">
          Profile data is being loaded separately from navigation so opening your account can never block Dashboard, Schedule, or the other ScoutCore pages.
        </section>
      </div>
    </div>
  );
};
