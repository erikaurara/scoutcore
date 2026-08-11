import React, { useState } from 'react';
import { NavigationTab, MatchupCardData } from './types';
import { sampleMatchups } from './data/mockData';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { MatchupsView } from './components/MatchupsView';
import { TeamComparisonView } from './components/TeamComparisonView';
import { GameLogsView } from './components/GameLogsView';
import { ScoutingFeedView } from './components/ScoutingFeedView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { QuickSearchModal } from './components/QuickSearchModal';
import { ReportModal } from './components/ReportModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [selectedMatchup, setSelectedMatchup] = useState<MatchupCardData>(sampleMatchups[0]);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-sans antialiased flex">
      {/* Fixed Sidebar */}
      <Sidebar 
        currentTab={currentTab} 
        onSelectTab={setCurrentTab} 
        onOpenSearch={() => setIsSearchOpen(true)} 
      />

      {/* Main Content Workspace with header margin */}
      <div className="pl-72 flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header 
          currentTab={currentTab} 
          onSelectTab={setCurrentTab} 
          onOpenSearch={() => setIsSearchOpen(true)} 
          onOpenReport={() => setIsReportOpen(true)}
        />

        {/* View Router */}
        <main className="pt-16 min-h-screen w-full">
          {currentTab === 'dashboard' && (
            <DashboardView 
              onSelectTab={setCurrentTab} 
              onSelectMatchup={setSelectedMatchup} 
            />
          )}

          {currentTab === 'matchups' && (
            <MatchupsView 
              onOpenReport={() => setIsReportOpen(true)}
            />
          )}

          {currentTab === 'team-comparison' && (
            <TeamComparisonView />
          )}

          {currentTab === 'game-logs' && (
            <GameLogsView 
              onOpenReport={() => setIsReportOpen(true)}
            />
          )}

          {currentTab === 'scouting-feed' && (
            <ScoutingFeedView />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView />
          )}

          {currentTab === 'settings' && (
            <SettingsView />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectTab={setCurrentTab}
        onSelectMatchup={setSelectedMatchup}
      />

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  );
}
