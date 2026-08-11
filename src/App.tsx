import React, { useState } from 'react';
import { NavigationTab, MatchupCardData } from './types';
import { sampleMatchups } from './data/mockData';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ScheduleView } from './components/ScheduleView';
import { CinematicMatchupViewV2 } from './components/CinematicMatchupViewV2';
import { TeamComparisonView } from './components/TeamComparisonView';
import { GameLogsView } from './components/GameLogsView';
import { ScoutingFeedView } from './components/ScoutingFeedView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { QuickSearchModal } from './components/QuickSearchModal';
import { ReportModal } from './components/ReportModal';
import { PlayerProfileView } from './components/PlayerProfileView';
import { TeamProfileView } from './components/TeamProfileView';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [previousTab, setPreviousTab] = useState<NavigationTab>('dashboard');
  const [selectedMatchup, setSelectedMatchup] = useState<MatchupCardData>(sampleMatchups[0]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  const openPlayer = (playerId: number) => {
    setPreviousTab(currentTab);
    setSelectedPlayerId(playerId);
    setCurrentTab('player-profile');
  };

  const openTeam = (teamId: number) => {
    setPreviousTab(currentTab);
    setSelectedTeamId(teamId);
    setCurrentTab('team-profile');
  };

  const goBack = () => {
    setCurrentTab(previousTab === 'player-profile' || previousTab === 'team-profile' ? 'dashboard' : previousTab);
  };

  const isProfilePage = currentTab === 'player-profile' || currentTab === 'team-profile';

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-sans antialiased flex">
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} onOpenSearch={() => setIsSearchOpen(true)} />
      <div className="pl-72 flex-1 flex flex-col min-w-0">
        <Header currentTab={currentTab} onSelectTab={setCurrentTab} onOpenSearch={() => setIsSearchOpen(true)} onOpenReport={() => setIsReportOpen(true)} />
        <main className="pt-16 min-h-screen w-full relative">
          {isProfilePage && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              title="Go back"
              className="absolute top-5 left-8 z-30 w-11 h-11 rounded-xl border border-[#3b5870] bg-[#111a2d] text-[#d7e3f4] hover:text-[#62ddeb] hover:border-[#62ddeb] hover:bg-[#17233a] transition-all flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,.3)]"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
          )}
          {currentTab === 'dashboard' && <DashboardView onSelectTab={setCurrentTab} onSelectMatchup={setSelectedMatchup} />}
          {currentTab === 'schedule' && <ScheduleView />}
          {currentTab === 'matchups' && <CinematicMatchupViewV2 />}
          {currentTab === 'team-comparison' && <TeamComparisonView />}
          {currentTab === 'game-logs' && <GameLogsView onOpenReport={() => setIsReportOpen(true)} />}
          {currentTab === 'scouting-feed' && <ScoutingFeedView />}
          {currentTab === 'analytics' && <AnalyticsView />}
          {currentTab === 'player-profile' && <PlayerProfileView playerId={selectedPlayerId} onOpenTeam={openTeam} />}
          {currentTab === 'team-profile' && <TeamProfileView teamId={selectedTeamId} onOpenPlayer={openPlayer} />}
          {currentTab === 'settings' && <SettingsView />}
        </main>
      </div>
      <QuickSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onOpenTeam={openTeam} onOpenPlayer={openPlayer} />
      <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
    </div>
  );
}
