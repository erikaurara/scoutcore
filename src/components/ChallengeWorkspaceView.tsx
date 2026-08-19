import React, { useEffect, useRef } from 'react';
import { ChallengeFullscreenView } from './ChallengeFullscreenView';
import { ChallengeView } from './ChallengeView';
import type { SelectedGame } from './SelectedGameMatchupView';

type Props = {
  initialTab: 'build' | 'mine' | 'leaderboard';
  initialGame?: SelectedGame | null;
  initialTeamId?: number | null;
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

export const ChallengeWorkspaceView: React.FC<Props> = ({ initialTab, initialGame = null, initialTeamId = null, signedIn, userEmail, onOpenAuth, onBack }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const leaderboardOnly = initialTab === 'leaderboard';
  const useLaptopChallenge = initialTab === 'build';

  useEffect(() => {
    if (useLaptopChallenge) return;

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
  }, [initialTab, useLaptopChallenge]);

  if (useLaptopChallenge) {
    return (
      <div className="fixed inset-0 z-[450] overflow-y-auto bg-[#040b15]">
        <button
          type="button"
          className="sc-challenge-exit fixed left-3 top-3 z-[500] flex h-10 items-center gap-1 rounded-lg border border-[#29445e] bg-[#06101c]/95 px-3 text-[10px] font-extrabold text-[#afbdd0] shadow-xl backdrop-blur sm:left-5 sm:top-4"
          onClick={onBack}
          aria-label="Back"
        >
          <span className="material-symbols-outlined text-[17px]">arrow_back</span>
          BACK
        </button>
        <ChallengeFullscreenView
          signedIn={signedIn}
          userEmail={userEmail}
          onOpenAuth={onOpenAuth}
          onExit={onBack}
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className={leaderboardOnly ? 'sc-leaderboard-only' : undefined}>
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
      <ChallengeView initialGame={initialGame} initialTeamId={initialTeamId} signedIn={signedIn} userEmail={userEmail} onOpenAuth={onOpenAuth} onLeaderboardBack={leaderboardOnly ? onBack : undefined} />
    </div>
  );
};
