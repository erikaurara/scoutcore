import React, { useEffect, useRef } from 'react';
import { ChallengeView } from './ChallengeView';

type WorkspaceTab = 'build' | 'mine' | 'leaderboard';
type Props = {
  initialTab: WorkspaceTab;
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
};

export const ChallengeWorkspaceView: React.FC<Props> = ({ initialTab, signedIn, userEmail, onOpenAuth }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = initialTab === 'mine' ? 'MY PICKS' : initialTab === 'leaderboard' ? 'LEADERBOARD' : 'BUILD PICKS';
    const timer = window.setTimeout(() => {
      const buttons = Array.from(rootRef.current?.querySelectorAll('button') ?? []) as HTMLButtonElement[];
      buttons.find((button) => button.textContent?.trim() === target)?.click();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialTab]);

  return <div ref={rootRef}>
    <ChallengeView signedIn={signedIn} userEmail={userEmail} onOpenAuth={onOpenAuth} />
  </div>;
};
