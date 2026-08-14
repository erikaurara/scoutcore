import React, { useEffect, useRef } from 'react';
import { ChallengeView } from './ChallengeView';

type Props = {
  initialTab: 'build' | 'mine' | 'leaderboard';
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
};

const TAB_LABEL: Record<Props['initialTab'], string> = {
  build: 'BUILD PICKS',
  mine: 'MY PICKS',
  leaderboard: 'LEADERBOARD',
};

export const ChallengeWorkspaceView: React.FC<Props> = ({ initialTab, signedIn, userEmail, onOpenAuth }) => {
  const rootRef = useRef<HTMLDivElement>(null);

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
    <div ref={rootRef}>
      <ChallengeView signedIn={signedIn} userEmail={userEmail} onOpenAuth={onOpenAuth} />
    </div>
  );
};
