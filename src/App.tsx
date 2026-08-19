import React, { useEffect, useRef, useState } from 'react';
import { NavigationTab } from './types';
import type { MlbScheduleGame } from './services/mlbApi';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardWithLiveNow } from './components/DashboardWithLiveNow';
import { ScheduleView } from './components/ScheduleView';
import { PvBWorkspaceView } from './components/PvBWorkspaceView';
import type { MatchupActionContext } from './components/SelectedGameMatchupView';
import { LiveGameFullscreen } from './components/LiveGameFullscreen';
import { TeamComparisonView } from './components/TeamComparisonView';
import { GameLogsView } from './components/GameLogsView';
import { ScoutingFeedView } from './components/ScoutingFeedView';
import { HighlightsView } from './components/HighlightsView';
import { AnalyticsView } from './components/AnalyticsView';
import { PlayerPredictionsViewV3 } from './components/PlayerPredictionsViewV3';
import { CommunityView } from './components/CommunityView';
import { ChallengeFullscreenView } from './components/ChallengeFullscreenView';
import { ChallengeWorkspaceView } from './components/ChallengeWorkspaceView';
import { WeeklyChallengeView } from './components/WeeklyChallengeView';
import { FriendsChallengeLandingView } from './components/FriendsChallengeLandingView';
import { ScoutLevelView } from './components/ScoutLevelView';
import { SettingsView } from './components/SettingsView';
import { QuickSearchModal } from './components/QuickSearchModal';
import { ReportModal } from './components/ReportModal';
import { PlayerProfileView } from './components/PlayerProfileView';
import { TeamProfileView } from './components/TeamProfileView';
import { ProfileHubView } from './components/ProfileHubView';
import { MyPredictionsView } from './components/MyPredictionsView';
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

type FriendsChallengeTab = 'play' | 'inbox' | 'active' | 'history';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [previousTab, setPreviousTab] = useState<NavigationTab>('dashboard');
  const [teamProfilePreviousTab, setTeamProfilePreviousTab] = useState<NavigationTab>('dashboard');
  const [selectedMatchup, setSelectedMatchup] = useState<any | null>(null);
  const [matchupActionContext, setMatchupActionContext] = useState<MatchupActionContext | null>(null);
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
  const [challengeWorkspaceTab, setChallengeWorkspaceTab] = useState<'build'|'mine'|'leaderboard'>('build');
  const [friendsChallengeLaunch, setFriendsChallengeLaunch] = useState<{ tab: FriendsChallengeTab; key: number }>({ tab: 'play', key: 0 });
  const [profileSwipeX, setProfileSwipeX] = useState(0);
  const [profileSwipeAnimating, setProfileSwipeAnimating] = useState(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeDistanceRef = useRef(0);

  useEffect(() => {
    if (!supabase) { setAccountSetupChecked(true); return; }
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const openedRecoveryLink = queryParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
    if (openedRecoveryLink) { setIsPasswordRecovery(true); setIsAuthOpen(true); setShowOnboarding(false); }
    const applyInitialSession = (session: any) => {
      setUserEmail(session?.user?.email ?? null);
      if (!session) setShowOnboarding(false);
      else if (!openedRecoveryLink) setShowOnboarding(session.user?.user_metadata?.onboarding_complete !== true);
      setAccountSetupChecked(true);
    };
    supabase.auth.getSession().then(({ data }) => applyInitialSession(data.session)).catch(() => setAccountSetupChecked(true));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (event === 'PASSWORD_RECOVERY') { setIsPasswordRecovery(true); setIsAuthOpen(true); setShowOnboarding(false); setAccountSetupChecked(true); return; }
      if (!session) { setShowOnboarding(false); setAccountSetupChecked(true); return; }
      if (!openedRecoveryLink && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setShowOnboarding(session.user?.user_metadata?.onboarding_complete !== true);
        setAccountSetupChecked(true);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
    setProfileSwipeX(0);
    setProfileSwipeAnimating(false);
    swipeStartRef.current = null;
    swipeDistanceRef.current = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

  const openPlayer = (playerId: number) => {
    setPreviousTab(currentTab);
    setSelectedPlayerId(playerId);
    setCurrentTab('player-profile');
  };
  const openTeam = (teamId: number) => {
    const returnTab = currentTab === 'player-profile' ? teamProfilePreviousTab : currentTab;
    setTeamProfilePreviousTab(returnTab);
    setPreviousTab(currentTab);
    setSelectedTeamId(teamId);
    setCurrentTab('team-profile');
  };
  const openScheduledGame = (game: MlbScheduleGame) => {
    const selection = toGameSelection(game);
    setMatchupActionContext(null);
    setPreviousTab('schedule');
    setSelectedMatchup(selection);
    try { window.sessionStorage.setItem('scoutcore:selected-game', JSON.stringify(selection)); } catch {}
    setCurrentTab('live-game');
  };
  const openTeamUpcomingGame = (game: MlbScheduleGame) => {
    const selection = toGameSelection(game);
    setMatchupActionContext(null);
    setPreviousTab('team-profile');
    setSelectedMatchup(selection);
    try { window.sessionStorage.setItem('scoutcore:selected-game', JSON.stringify(selection)); } catch {}
    setCurrentTab('matchups');
  };
  const selectPrimaryTab = (tab: NavigationTab) => { setMatchupActionContext(null); setCurrentTab(tab); };
  const selectFromDashboard = (tab: NavigationTab) => { setMatchupActionContext(null); if (tab === 'live-game' || tab === 'matchups') setPreviousTab('dashboard'); setCurrentTab(tab); };
  const openPredictionFromMatchup = (context: MatchupActionContext) => {
    setMatchupActionContext(context);
    setPreviousTab('matchups');
    setCurrentTab('player-predictions');
  };
  const openTeamAnalysisFromMatchup = (context: MatchupActionContext) => {
    setMatchupActionContext(context);
    setPreviousTab('matchups');
    setCurrentTab('team-comparison');
  };
  const openChallengeFromMatchup = (context: MatchupActionContext) => {
    setMatchupActionContext(context);
    setChallengeWorkspaceTab('build');
    setPreviousTab('matchups');
    setCurrentTab('challenge-workspace');
  };
  const goBack = () => {
    if (currentTab === 'player-profile' && previousTab === 'team-profile') {
      setCurrentTab('team-profile');
      return;
    }
    if (currentTab === 'team-profile') {
      setCurrentTab(teamProfilePreviousTab === 'player-profile' || teamProfilePreviousTab === 'team-profile' ? 'dashboard' : teamProfilePreviousTab);
      return;
    }
    setCurrentTab(previousTab);
  };
  const isSwipeBackProfile = currentTab === 'player-profile' || currentTab === 'team-profile';
  const handleProfileSwipeStart = (event: React.TouchEvent) => {
    if (!isSwipeBackProfile || window.innerWidth >= 1024) return;
    const touch = event.touches[0];
    if (!touch) return;
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeDistanceRef.current = 0;
    setProfileSwipeAnimating(false);
  };
  const handleProfileSwipeMove = (event: React.TouchEvent) => {
    const start = swipeStartRef.current;
    if (!start) return;
    const touch = event.touches[0];
    if (!touch) return;
    const rawDx = touch.clientX - start.x;
    const dx = Math.max(0, rawDx);
    const dy = Math.abs(touch.clientY - start.y);
    if (rawDx <= 0 || dx < 8 || dx <= dy * 1.25) return;
    swipeDistanceRef.current = dx;
    setProfileSwipeX(Math.min(dx, window.innerWidth));
  };
  const handleProfileSwipeEnd = () => {
    if (!swipeStartRef.current) return;
    swipeStartRef.current = null;
    const distance = swipeDistanceRef.current;
    swipeDistanceRef.current = 0;
    const threshold = Math.min(105, window.innerWidth * 0.24);
    setProfileSwipeAnimating(true);
    if (distance >= threshold) {
      setProfileSwipeX(window.innerWidth);
      window.setTimeout(() => goBack(), 150);
    } else {
      setProfileSwipeX(0);
      window.setTimeout(() => setProfileSwipeAnimating(false), 170);
    }
  };
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setUserEmail(null); setShowOnboarding(false); setCurrentTab('dashboard'); };
  const handleAccountDeleted = () => { setUserEmail(null); setShowOnboarding(false); setCurrentTab('dashboard'); };
  const openScoutReport = () => { if (!userEmail) { setIsPasswordRecovery(false); setIsAuthOpen(true); return; } setIsReportOpen(true); };
  const openAuth = () => { setIsPasswordRecovery(false); setIsAuthOpen(true); };
  const closeAuth = () => { setIsAuthOpen(false); setIsPasswordRecovery(false); };
  const openLeaderboard = () => { setMatchupActionContext(null); setChallengeWorkspaceTab('leaderboard'); setCurrentTab('challenge-workspace'); };
  const openFriendsChallenge = (tab: FriendsChallengeTab = 'play') => {
    setFriendsChallengeLaunch((current) => ({ tab, key: current.key + 1 }));
    setCurrentTab('friends-challenge');
  };
  const openWeeklyFromFriends = () => {
    setFriendsChallengeLaunch((current) => ({ tab: 'active', key: current.key + 1 }));
    setMatchupActionContext(null);
    setChallengeWorkspaceTab('build');
    setPreviousTab('friends-challenge');
    setCurrentTab('challenge-workspace');
  };
  const openNotification = (target: 'friends-challenge:inbox' | 'friends-challenge:active') => {
    openFriendsChallenge(target === 'friends-challenge:active' ? 'active' : 'inbox');
  };

  if (!accountSetupChecked) return <div className="flex min-h-screen items-center justify-center bg-[#07101f] text-[#dae2fd]"><div className="text-center"><img src="/scoutcore-logo-email.png" alt="ScoutCoreMLB" className="mx-auto h-14 w-14 rounded-xl" /><div className="mt-3 text-xs font-bold uppercase tracking-[.2em] text-[#00f0ff]">ScoutCoreMLB</div></div></div>;
  if (showOnboarding && !isPasswordRecovery) return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />;
  if (currentTab === 'live-game') return <><LiveGameFullscreen selectedGame={selectedMatchup} signedIn={Boolean(userEmail)} userEmail={userEmail} onOpenAuth={openAuth} onExit={goBack} /><AuthModal isOpen={isAuthOpen} onClose={closeAuth} recoveryMode={isPasswordRecovery} /></>;
  if (currentTab === 'challenge') return <><button type="button" className="sc-challenge-exit fixed left-5 top-4 z-[500]" onClick={() => setCurrentTab('dashboard')} aria-label="Back to dashboard"><span className="material-symbols-outlined">arrow_back</span>BACK TO DASHBOARD</button><ChallengeFullscreenView signedIn={Boolean(userEmail)} userEmail={userEmail} onOpenAuth={openAuth} onExit={() => setCurrentTab('dashboard')} /><AuthModal isOpen={isAuthOpen} onClose={closeAuth} recoveryMode={isPasswordRecovery} /></>;

  return <div className="min-h-screen w-full bg-[#0b1326] text-[#dae2fd] font-sans antialiased overflow-x-hidden">
    <Sidebar currentTab={currentTab} onSelectTab={selectPrimaryTab} onOpenSearch={() => setIsSearchOpen(true)} signedIn={Boolean(userEmail)} userEmail={userEmail} mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
    <div className="w-full lg:pl-72 min-w-0">
      <Header currentTab={currentTab} onOpenReport={openScoutReport} onBack={goBack} onOpenMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => setIsSearchOpen(true)} signedIn={Boolean(userEmail)} onOpenAuth={openAuth} onLogOut={signOut} onOpenNotification={openNotification} />
      <main
        className="pt-16 min-h-screen w-full min-w-0 overflow-x-hidden"
        onTouchStart={isSwipeBackProfile ? handleProfileSwipeStart : undefined}
        onTouchMove={isSwipeBackProfile ? handleProfileSwipeMove : undefined}
        onTouchEnd={isSwipeBackProfile ? handleProfileSwipeEnd : undefined}
        onTouchCancel={isSwipeBackProfile ? handleProfileSwipeEnd : undefined}
        style={isSwipeBackProfile ? {
          transform: `translate3d(${profileSwipeX}px,0,0)`,
          transition: profileSwipeAnimating ? 'transform 150ms ease-out' : 'none',
          touchAction: 'pan-y',
          userSelect: profileSwipeX > 0 ? 'none' : undefined,
          WebkitUserSelect: profileSwipeX > 0 ? 'none' : undefined,
        } : undefined}
      ><div className="w-full min-w-0 max-w-full [&_img]:max-w-full [&_table]:text-[11px] sm:[&_table]:text-sm [&_.overflow-x-auto]:overscroll-x-contain">
        {currentTab === 'dashboard' && <DashboardWithLiveNow onSelectTab={selectFromDashboard} onSelectMatchup={setSelectedMatchup} />}
        {currentTab === 'schedule' && <ScheduleView onOpenGame={openScheduledGame} onOpenTeam={openTeam} />}
        {currentTab === 'matchups' && <PvBWorkspaceView selectedGame={selectedMatchup} onBack={goBack} onOpenPredictions={openPredictionFromMatchup} onOpenTeamAnalysis={openTeamAnalysisFromMatchup} onOpenChallenge={openChallengeFromMatchup} />}
        {currentTab === 'team-comparison' && <TeamComparisonView selectedGame={matchupActionContext?.game ?? selectedMatchup} />}
        {currentTab === 'game-logs' && <GameLogsView onOpenReport={openScoutReport} />}
        {currentTab === 'scouting-feed' && <ScoutingFeedView />}
        {currentTab === 'highlights' && <HighlightsView />}
        {currentTab === 'analytics' && <AnalyticsView />}
        {currentTab === 'player-predictions' && <PlayerPredictionsViewV3 initialContext={matchupActionContext} />}
        {currentTab === 'community' && <CommunityView signedIn={Boolean(userEmail)} userEmail={userEmail} onOpenAuth={openAuth} />}
        {currentTab === 'challenge-workspace' && <ChallengeWorkspaceView initialTab={challengeWorkspaceTab} initialGame={matchupActionContext?.game ?? null} initialTeamId={matchupActionContext?.selectedTeam.id ?? null} signedIn={Boolean(userEmail)} userEmail={userEmail} onOpenAuth={openAuth} onBack={() => setCurrentTab(previousTab === 'friends-challenge' ? 'friends-challenge' : 'profile')} />}
        {currentTab === 'weekly-challenge' && userEmail && <WeeklyChallengeView onBack={() => setCurrentTab('profile')} />}
        {currentTab === 'weekly-challenge' && !userEmail && <MembershipView onSignIn={openAuth} signedIn={false} />}
        {currentTab === 'friends-challenge' && userEmail && <FriendsChallengeLandingView key={friendsChallengeLaunch.key} initialTab={friendsChallengeLaunch.tab} onOpenWeeklyPicks={openWeeklyFromFriends} onBack={() => setCurrentTab('profile')} />}
        {currentTab === 'friends-challenge' && !userEmail && <MembershipView onSignIn={openAuth} signedIn={false} />}
        {currentTab === 'player-profile' && <PlayerProfileView playerId={selectedPlayerId} onOpenTeam={openTeam} />}
        {currentTab === 'team-profile' && <TeamProfileView teamId={selectedTeamId} onOpenPlayer={openPlayer} onOpenGame={openTeamUpcomingGame} />}
        {currentTab === 'profile' && userEmail && <ProfileHubView userEmail={userEmail} onOpenWeekly={() => setCurrentTab('weekly-challenge')} onOpenPredictions={() => setCurrentTab('my-predictions')} onOpenLeaderboard={openLeaderboard} onOpenFriendsChallenge={() => openFriendsChallenge('play')} onOpenScoutLevel={() => setCurrentTab('scout-level')} onOpenSettings={() => setCurrentTab('settings')} />}
        {currentTab === 'profile' && !userEmail && <MembershipView onSignIn={openAuth} signedIn={false} />}
        {currentTab === 'my-predictions' && userEmail && <MyPredictionsView onBack={() => setCurrentTab('profile')} />}
        {currentTab === 'my-predictions' && !userEmail && <MembershipView onSignIn={openAuth} signedIn={false} />}
        {currentTab === 'scout-level' && userEmail && <ScoutLevelView onBack={() => setCurrentTab('profile')} />}
        {currentTab === 'scout-level' && !userEmail && <MembershipView onSignIn={openAuth} signedIn={false} />}
        {currentTab === 'membership' && <MembershipView onSignIn={openAuth} signedIn={Boolean(userEmail)} />}
        {currentTab === 'settings' && <SettingsView signedIn={Boolean(userEmail)} onDeleted={handleAccountDeleted} />}
      </div></main>
    </div>
    <QuickSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onOpenTeam={openTeam} onOpenPlayer={openPlayer} />
    <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} playerId={currentTab === 'player-profile' ? selectedPlayerId : null} />
    <AuthModal isOpen={isAuthOpen} onClose={closeAuth} recoveryMode={isPasswordRecovery} />
  </div>;
}
