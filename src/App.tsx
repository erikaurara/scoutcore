import React, { useEffect, useState } from 'react';
import { NavigationTab } from './types';
import type { MlbScheduleGame } from './services/mlbApi';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardWithLiveNow } from './components/DashboardWithLiveNow';
import { ScheduleView } from './components/ScheduleView';
import { PvBWorkspaceView } from './components/PvBWorkspaceView';
import { LiveGameFullscreen } from './components/LiveGameFullscreen';
import { TeamComparisonView } from './components/TeamComparisonView';
import { GameLogsView } from './components/GameLogsView';
import { ScoutingFeedView } from './components/ScoutingFeedView';
import { HighlightsView } from './components/HighlightsView';
import { AnalyticsView } from './components/AnalyticsView';
import { PlayerPredictionsViewV2 } from './components/PlayerPredictionsViewV2';
import { CommunityView } from './components/CommunityView';
import { ChallengeFullscreenView } from './components/ChallengeFullscreenView';
import { ScoutLevelView } from './components/ScoutLevelView';
import { SettingsView } from './components/SettingsView';
import { QuickSearchModal } from './components/QuickSearchModal';
import { ReportModal } from './components/ReportModal';
import { PlayerProfileView } from './components/PlayerProfileView';
import { TeamProfileView } from './components/TeamProfileView';
import { ProfileView } from './components/ProfileView';
import { AuthModal } from './components/AuthModal';
import { MembershipView } from './components/MembershipView';
import { OnboardingFlow } from './components/OnboardingFlow';
import { supabase } from './services/supabaseClient';

const toGameSelection = (game: MlbScheduleGame) => ({
  gamePk: game.gamePk,
  gameDate: game.gameDate,
  status: game.status,
  detailedState: game.detailedState,
  awayScore: game.awayScore,
  homeScore: game.homeScore,
  awayTeam: game.awayTeam,
  homeTeam: game.homeTeam,
  awayProbablePitcher: game.awayProbablePitcher,
  homeProbablePitcher: game.homeProbablePitcher,
});

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [previousTab, setPreviousTab] = useState<NavigationTab>('dashboard');
  const [selectedMatchup, setSelectedMatchup] = useState<any | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [accountSetupChecked, setAccountSetupChecked] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAccountSetupChecked(true);
      return;
    }
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const openedRecoveryLink = queryParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
    if (openedRecoveryLink) {
      setIsPasswordRecovery(true);
      setIsAuthOpen(true);
      setShowOnboarding(false);
    }
    const applyInitialSession = (session: any) => {
      setUserEmail(session?.user?.email ?? null);
      if (!session) setShowOnboarding(false);
      else if (!openedRecoveryLink) setShowOnboarding(session.user?.user_metadata?.onboarding_complete !== true);
      setAccountSetupChecked(true);
    };
    supabase.auth.getSession().then(({ data }) => applyInitialSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setIsAuthOpen(true);
        setShowOnboarding(false);
        setAccountSetupChecked(true);
        return;
      }
      if (!session) {
        setShowOnboarding(false);
        setAccountSetupChecked(true);
        return;
      }
      if (!openedRecoveryLink && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setShowOnboarding(session.user?.user_metadata?.onboarding_complete !== true);
        setAccountSetupChecked(true);
      }
    });
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
  const openScheduledGame = (game: MlbScheduleGame) => {
    const selection = toGameSelection(game);
    setPreviousTab('schedule');
    setSelectedMatchup(selection);
    try { window.sessionStorage.setItem('scoutcore:selected-game', JSON.stringify(selection)); } catch {}
    setCurrentTab('live-game');
  };
  const selectFromDashboard = (tab: NavigationTab) => {
    if (tab === 'live-game' || tab === 'matchups') setPreviousTab('dashboard');
    setCurrentTab(tab);
  };
  const goBack = () => setCurrentTab(previousTab === 'player-profile' || previousTab === 'team-profile' ? 'dashboard' : previousTab);
  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setUserEmail(null);
    setShowOnboarding(false);
    setCurrentTab('dashboard');
  };
  const handleAccountDeleted = () => {
    setUserEmail(null);
    setShowOnboarding(false);
    setCurrentTab('dashboard');
  };
  const openScoutReport = () => {
    if (!userEmail) {
      setIsPasswordRecovery(false);
      setIsAuthOpen(true);
      return;
    }
    setIsReportOpen(true);
  };
  const openAuth = () => {
    setIsPasswordRecovery(false);
    setIsAuthOpen(true);
  };
  const closeAuth = () => {
    setIsAuthOpen(false);
    setIsPasswordRecovery(false);
  };

  if (!accountSetupChecked) return <div className="flex min-h-screen items-center justify-center bg-[#07101f] text-[#dae2fd]"><div className="text-center"><img src="/scoutcore-logo-email.png" alt="ScoutCoreMLB" className="mx-auto h-14 w-14 rounded-xl" /><div className="mt-3 text-xs font-bold uppercase tracking-[.2em] text-[#00f0ff]">ScoutCoreMLB</div></div></div>;
  if (showOnboarding && !isPasswordRecovery) return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />;
  if (currentTab === 'live-game') return <><LiveGameFullscreen selectedGame={selectedMatchup} signedIn={Boolean(userEmail)} userEmail={userEmail} onOpenAuth={openAuth} onExit={goBack} /><AuthModal isOpen={isAuthOpen} onClose={closeAuth} recoveryMode={isPasswordRecovery} /></>;
  if (currentTab === 'challenge') return <>
    <button type="button" className="sc-challenge-exit fixed left-5 top-4 z-[500]" onClick={() => setCurrentTab('dashboard')} aria-label="Back to dashboard"><span className="material-symbols-outlined">arrow_back</span>BACK TO DASHBOARD</button>
    <ChallengeFullscreenView signedIn={Boolean(userEmail)} userEmail={userEmail} onOpenAuth={openAuth} onExit={() => setCurrentTab('dashboard')} />
    <AuthModal isOpen={isAuthOpen} onClose={closeAuth} recoveryMode={isPasswordRecovery} />
  </>;

  return <div className="min-h-screen w-full bg-[#0b1326] text-[#dae2fd] font-sans antialiased overflow-x-hidden">
    <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} onOpenSearch={() => setIsSearchOpen(true)} signedIn={Boolean(userEmail)} userEmail={userEmail} mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
    <div className="w-full lg:pl-72 min-w-0">
      <Header currentTab={currentTab} onOpenReport={openScoutReport} onBack={goBack} onOpenMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => setIsSearchOpen(true)} signedIn={Boolean(userEmail)} onOpenAuth={openAuth} onLogOut={signOut} />
      <main className="pt-16 min-h-screen w-full min-w-0 overflow-x-hidden">
        <div className="w-full min-w-0 max-w-full [&_img]:max-w-full [&_table]:text-[11px] sm:[&_table]:text-sm [&_.overflow-x-auto]:overscroll-x-contain">
          {currentTab === 'dashboard' && <DashboardWithLiveNow onSelectTab={selectFromDashboard} onSelectMatchup={setSelectedMatchup} />}
          {currentTab === 'schedule' && <ScheduleView onOpenGame={openScheduledGame} onOpenTeam={openTeam} />}
          {currentTab === 'matchups' && <PvBWorkspaceView selectedGame={selectedMatchup} />}
          {currentTab === 'team-comparison' && <TeamComparisonView />}
          {currentTab === 'game-logs' && <GameLogsView onOpenReport={openScoutReport} />}
          {currentTab === 'scouting-feed' && <ScoutingFeedView />}
          {currentTab === 'highlights' && <HighlightsView />}
          {currentTab === 'analytics' && <AnalyticsView />}
          {currentTab === 'player-predictions' && <PlayerPredictionsViewV2 />}
          {currentTab === 'community' && <CommunityView signedIn={Boolean(userEmail)} userEmail={userEmail} onOpenAuth={openAuth} />}
          {currentTab === 'player-profile' && <PlayerProfileView playerId={selectedPlayerId} onOpenTeam={openTeam} />}
          {currentTab === 'team-profile' && <TeamProfileView teamId={selectedTeamId} onOpenPlayer={openPlayer} />}
          {currentTab === 'profile' && userEmail && <ProfileView onOpenPremium={() => setCurrentTab('membership')} onOpenChallenge={() => setCurrentTab('challenge')} onOpenSettings={() => setCurrentTab('settings')} />}
          {currentTab === 'profile' && !userEmail && <MembershipView onSignIn={openAuth} signedIn={false} />}
          {currentTab === 'scout-level' && userEmail && <ScoutLevelView />}
          {currentTab === 'scout-level' && !userEmail && <MembershipView onSignIn={openAuth} signedIn={false} />}
          {currentTab === 'membership' && <MembershipView onSignIn={openAuth} signedIn={Boolean(userEmail)} />}
          {currentTab === 'settings' && <SettingsView signedIn={Boolean(userEmail)} onDeleted={handleAccountDeleted} />}
        </div>
      </main>
    </div>
    <QuickSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onOpenTeam={openTeam} onOpenPlayer={openPlayer} />
    <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} playerId={currentTab === 'player-profile' ? selectedPlayerId : null} />
    <AuthModal isOpen={isAuthOpen} onClose={closeAuth} recoveryMode={isPasswordRecovery} />
  </div>;
}
