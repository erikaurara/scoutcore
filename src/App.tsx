import React, { useEffect, useState } from 'react';
import { NavigationTab, MatchupCardData } from './types';
import { sampleMatchups } from './data/mockData';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ScheduleView } from './components/ScheduleView';
import { PvBWorkspaceView } from './components/PvBWorkspaceView';
import { TeamComparisonView } from './components/TeamComparisonView';
import { GameLogsView } from './components/GameLogsView';
import { ScoutingFeedView } from './components/ScoutingFeedView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { QuickSearchModal } from './components/QuickSearchModal';
import { ReportModal } from './components/ReportModal';
import { PlayerProfileView } from './components/PlayerProfileView';
import { TeamProfileView } from './components/TeamProfileView';
import { AuthModal } from './components/AuthModal';
import { MembershipView } from './components/MembershipView';
import { supabase } from './services/supabaseClient';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [previousTab, setPreviousTab] = useState<NavigationTab>('dashboard');
  const [selectedMatchup, setSelectedMatchup] = useState<MatchupCardData>(sampleMatchups[0]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUserEmail(data.session?.user?.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUserEmail(session?.user?.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

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

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setUserEmail(null);
  };

  const openScoutReport = () => {
    if (!userEmail) {
      setIsAuthOpen(true);
      return;
    }
    setIsReportOpen(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#0b1326] text-[#dae2fd] font-sans antialiased overflow-x-hidden">
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} onOpenSearch={() => setIsSearchOpen(true)} signedIn={Boolean(userEmail)} userEmail={userEmail} onOpenAuth={() => setIsAuthOpen(true)} onSignOut={signOut} mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
      <div className="w-full lg:pl-72 min-w-0">
        <Header currentTab={currentTab} onSelectTab={setCurrentTab} onOpenSearch={() => setIsSearchOpen(true)} onOpenReport={openScoutReport} onBack={goBack} onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="pt-16 min-h-screen w-full min-w-0 overflow-x-hidden">
          <div className="w-full min-w-0 max-w-full [&_img]:max-w-full [&_table]:text-[11px] sm:[&_table]:text-sm [&_.overflow-x-auto]:overscroll-x-contain">
            {currentTab === 'dashboard' && <DashboardView onSelectTab={setCurrentTab} onSelectMatchup={setSelectedMatchup} />}
            {currentTab === 'schedule' && <ScheduleView />}
            {currentTab === 'matchups' && <PvBWorkspaceView />}
            {currentTab === 'team-comparison' && <TeamComparisonView />}
            {currentTab === 'game-logs' && <GameLogsView onOpenReport={openScoutReport} />}
            {currentTab === 'scouting-feed' && <ScoutingFeedView />}
            {currentTab === 'analytics' && <AnalyticsView />}
            {currentTab === 'player-profile' && <PlayerProfileView playerId={selectedPlayerId} onOpenTeam={openTeam} />}
            {currentTab === 'team-profile' && <TeamProfileView teamId={selectedTeamId} onOpenPlayer={openPlayer} />}
            {currentTab === 'membership' && <MembershipView onSignIn={() => setIsAuthOpen(true)} signedIn={Boolean(userEmail)} />}
            {currentTab === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>
      <QuickSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onOpenTeam={openTeam} onOpenPlayer={openPlayer} />
      <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} playerId={currentTab === 'player-profile' ? selectedPlayerId : null} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
