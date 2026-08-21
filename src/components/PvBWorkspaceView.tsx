import React from 'react';
import { SelectedGameMatchupView, type MatchupActionContext, type SelectedGame } from './SelectedGameMatchupView';

type GameSelection = SelectedGame;

interface PvBWorkspaceViewProps {
  selectedGame?: GameSelection | null;
  onBack?: () => void;
  onOpenMatchupLab?: () => void;
  onOpenPredictions?: (context: MatchupActionContext) => void;
  onOpenTeamAnalysis?: (context: MatchupActionContext) => void;
  onOpenChallenge?: (context: MatchupActionContext) => void;
}

const readStoredGame = (): GameSelection | null => {
  try {
    const raw = window.sessionStorage.getItem('scoutcore:selected-game');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const PvBWorkspaceView: React.FC<PvBWorkspaceViewProps> = ({
  selectedGame = null,
  onBack,
  onOpenMatchupLab,
  onOpenPredictions,
  onOpenTeamAnalysis,
  onOpenChallenge,
}) => {
  const game = selectedGame?.gamePk ? selectedGame : readStoredGame();

  if (game?.gamePk) {
    return (
      <SelectedGameMatchupView
        game={game}
        onBack={onBack}
        onOpenMatchupLab={onOpenMatchupLab}
        onOpenPredictions={onOpenPredictions}
        onOpenTeamAnalysis={onOpenTeamAnalysis}
        onOpenChallenge={onOpenChallenge}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#06111f] px-4 py-8 text-[#dce6fa] sm:px-8">
      <section className="mx-auto max-w-[760px] rounded-2xl border border-[#30445d] bg-[#0d1a2c] p-6 text-center sm:p-10">
        <span className="material-symbols-outlined text-5xl text-[#00e7ef]">sports_baseball</span>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[.18em] text-[#65f2b5]">MATCHUP</p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Choose a game for the quick Matchup view</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#9daabd]">
          Choose a game from Today’s MLB Games to compare its probable pitchers and batter matchups.
        </p>
        <div className="mx-auto mt-6 grid max-w-lg gap-3 sm:grid-cols-2">
          <button type="button" onClick={onBack} className="h-12 rounded-xl border border-[#30445d] px-4 text-xs font-bold text-white">
            BACK TO DASHBOARD
          </button>
          <button type="button" onClick={onOpenMatchupLab} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#bd72ff] px-4 text-xs font-bold text-[#10061b]">
            <span className="material-symbols-outlined text-[18px]">science</span>
            OPEN MATCHUP LAB
          </button>
        </div>
      </section>
    </div>
  );
};
