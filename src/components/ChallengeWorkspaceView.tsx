import React, { useEffect, useRef } from 'react';
import { ChallengeView } from './ChallengeView';

type Props = {
  initialTab: 'build' | 'mine' | 'leaderboard';
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
  onBack: () => void;
};

const TAB_LABEL: Record<Props['initialTab'], string> = {
  build: 'BUILD PICKS',
  mine: 'MY PICKS',
  leaderboard: 'LEADERBOARD',
};

export const ChallengeWorkspaceView: React.FC<Props> = ({ initialTab, signedIn, userEmail, onOpenAuth, onBack }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const leaderboardOnly = initialTab === 'leaderboard';

  useEffect(() => {
    const label = TAB_LABEL[initialTab];
    let attempts = 0;

    const openRequestedTab = () => {
      attempts += 1;
      const buttons = Array.from(rootRef.current?.querySelectorAll('button') ?? []);
      const target = buttons.find(button => button.textContent?.trim() === label) as HTMLButtonElement | undefined;
      if (target) {
        target.click();
        return;
      }
      if (attempts < 8) window.setTimeout(openRequestedTab, 30);
    };

    openRequestedTab();
  }, [initialTab]);

  return (
    <div ref={rootRef} className={leaderboardOnly ? 'sc-leaderboard-only' : undefined}>
      {leaderboardOnly && <button type="button" onClick={onBack} aria-label="Back to profile" className="ml-4 mt-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[#2d4059] bg-[#101a2d] text-white sm:ml-6 lg:ml-8"><span className="material-symbols-outlined">arrow_back</span></button>}
      {leaderboardOnly && <style>{`
        .sc-leaderboard-only > div > div > section:first-child,
        .sc-leaderboard-only > div > div > div:nth-child(2) {
          display: none !important;
        }
        .sc-leaderboard-only > div {
          padding-bottom: 1.25rem !important;
        }
        .sc-leaderboard-only > div > div {
          padding-top: .75rem !important;
        }
        .sc-leaderboard-only > div > div > section:last-of-type > div:first-child > div:last-child,
        .sc-leaderboard-only > div > div > section:last-of-type > div:nth-child(3),
        .sc-leaderboard-only > div > div > section:last-of-type > p:nth-child(4) {
          display: none !important;
        }
      `}</style>}
      <ChallengeView signedIn={signedIn} userEmail={userEmail} onOpenAuth={onOpenAuth} />
    </div>
  );
};
