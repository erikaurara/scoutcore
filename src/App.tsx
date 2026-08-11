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

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-sans antialiased flex">
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} onOpenSearch={() => setIsSearchOpen(true)} />
      <div className="pl-72 flex-1 flex flex-col min-w-0">
        <Header currentTab={currentTab} onSelectTab={setCurrentTab} onOpenSearch={() => setIsSearchOpen(true)} onOpenReport={() => setIsReportOpen(true)} onBack={goBack} />
        <main className="pt-16 min-h-screen w-full relative">
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
