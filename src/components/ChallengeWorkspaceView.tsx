import React from 'react';
import { ChallengeView } from './ChallengeView';

type Props = {
  initialTab: 'build' | 'mine' | 'leaderboard';
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
};

export const ChallengeWorkspaceView: React.FC<Props> = ({ signedIn, userEmail, onOpenAuth }) => (
  <ChallengeView signedIn={signedIn} userEmail={userEmail} onOpenAuth={onOpenAuth} />
);
