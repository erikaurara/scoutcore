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
import { PlayerPredictionsViewV3 } from './components/PlayerPredictionsViewV3';
import { CommunityView } from './components/CommunityView';
import { ChallengeFullscreenView } from './components/ChallengeFullscreenView';
import { ChallengeWorkspaceView } from './components/ChallengeWorkspaceView';
import { WeeklyChallengeView } from './components/WeeklyChallengeView';
import { FriendsChallengeView } from './components/FriendsChallengeView';
import { ScoutLevelView } from './components/ScoutLevelView';
import { SettingsView } from './components/SettingsView';
import { QuickSearchModal } from './components/QuickSearchModal';
import { ReportModal } from './components/ReportModal';
import { PlayerProfileView } from './components/PlayerProfileView';
import { TeamProfileView } from './components/TeamProfileView';
import { ProfileView } from './components/ProfileView';
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

const navigationTabs: NavigationTab[] = [
  'dashboard','schedule','matchups','live-game','team-comparison','game-logs','scouting-feed','highlights','analytics','player-predictions','community','challenge','challenge-workspace','weekly-challenge','friends-challenge','player-profile','team-profile','profile','my-predictions','scout-level','membership','settings'
];

const tabFromHash = (): NavigationTab | null => {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return navigationTabs.includes(raw as NavigationTab) ? raw as NavigationTab : null;
};

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>(() => tabFromHash() || 'dashboard');
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
  const [challengeWorkspaceTab, setChallengeWorkspaceTab] = useState<'build' | 'mine' | 'leaderboard'>('build');

  const navigate = (tab: NavigationTab) => {
    setCurrentTab(tab);
    if (tab !== 'live-game' && tab !== 'player-profile' && tab !== 'team-profile') {
      const nextHash = `#/${tab}`;
      if (window.location.hash !== nextHash) window.history.replaceState(null, '', nextHash);
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const tab = tabFromHash();
      if (tab) setCurrentTab(tab);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!supabase) { setAccountSetupChecked(true); return; }
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const openedRecoveryLink = queryParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
    if (openedRecoveryLink) { setIsPasswordRecovery(true); setIsAuthOpen(true); setShowOnboarding(false); }
    const applyInitialSession = (session: any) => { setUserEmail(session?.user?.email ?? null); if (!session) setShowOnboarding(false); else if (!openedRecoveryLink) setShowOnboarding(session.user?.user_metadata?.onboarding_complete !== true); setAccountSetupChecked(true); };
    supabase.auth.getSession().then(({ data }) => applyInitialSession(data.session)).catch(() => setAccountSetupChecked(true));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (event === 'PASSWORD_RECOVERY') { setIsPasswordRecovery(true); setIsAuthOpen(true); setShowOnboarding(false); setAccountSetupChecked(true); return; }
      if (!session) { setShowOnboarding(false); setAccountSetupChecked(true); return; }
      if (!openedRecoveryLink && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) { setShowOnboarding(session.user?.user_metadata?.onboarding_complete !== true); setAccountSetupChecked(true); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { setMobileNavOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [currentTab]);

  const openPlayer = (playerId: number) => { setPreviousTab(currentTab); setSelectedPlayerId(playerId); setCurrentTab('player-profile'); };
  const openTeam = (teamId: number) => { setPreviousTab(currentTab); setSelectedTeamId(teamId); setCurrentTab('team-profile'); };
  const openScheduledGame = (game: MlbScheduleGame) => { const selection = toGameSelection(game); setPreviousTab('schedule'); setSelectedMatchup(selection); try { window.sessionStorage.setItem('scoutcore:selected-game', JSON.stringify(selection)); } catch {} setCurrentTab('live-game'); };
  const selectFromDashboard = (tab: NavigationTab) => { if (tab === 'live-game' || tab === 'matchups') setPreviousTab('dashboard'); navigate(tab); };
  const goBack = () => navigate(previousTab === 'player-profile' || previousTab === 'team-profile' ? 'dashboard' : previousTab);
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setUserEmail(null); setShowOnboarding(false); navigate('dashboard'); };
  const handleAccountDeleted = () => { setUserEmail(null); setShowOnboarding(false); navigate('dashboard'); };
  const openScoutReport = () => { if (!userEmail) { setIsPasswordRecovery(false); setIsAuthOpen(true); return; } setIsReportOpen(true); };
  const openAuth = () => { setIsPasswordRecovery(false); setIsAuthOpen(true); };
  const closeAuth = () => { setIsAuthOpen(false); setIsPasswordRecovery(false); };

  const profileActivityCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest('button');
    if (!button) return;
    const label = button.textContent ?? '';
    if (label.includes('Scout Level')) { event.preventDefault(); event.stopPropagation(); return; }
    if (label.includes('Weekly Challenge')) { event.preventDefault(); event.stopPropagation(); setPreviousTab('profile'); navigate('weekly-challenge'); return; }
    if (label.includes('Friends Challenge')) { event.preventDefault(); event.stopPropagation(); setPreviousTab('profile'); navigate('friends-challenge'); return; }
    if (label.includes('My Predictions')) { event.preventDefault(); event.stopPropagation(); setPreviousTab('profile'); navigate('my-predictions'); return; }
    if (label.includes('Leaderboards')) { event.preventDefault(); event.stopPropagation(); setChallengeWorkspaceTab('leaderboard'); navigate('challenge-workspace'); }
  };

  if (!accountSetupChecked) return <div className="flex min-h-screen items-center justify-center bg-[#07101f] text-[#dae2fd]"><div className="text-center"><img src="/scoutcore-logo-email.png" alt="ScoutCoreMLB" className="mx-auto h-14 w-14 rounded-xl" /><div className="mt-3 text-xs font-bold uppercase tracking-[.2em] text-[#00f0ff]">ScoutCoreMLB</div></div></div>;
  if (showOnboarding && !isPasswordRecovery) return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />;
  if (currentTab === 'live-game') return <><LiveGameFullscreen selectedGame={selectedMatchup} signedIn={Boolean(userEmail)} userEmail={userEmail} onOpenAuth={openAuth} onExit={goBack} /><AuthModal isOpen={isAuthOpen} onClose={closeAuth} recoveryMode={isPasswordRecovery} /></>;
  if (currentTab === 'challenge') return <><button type="button" className="sc-challenge-exit fixed left-5 top-4 z-[500]" onClick={() => navigate('dashboard')} aria-label="Back to dashboard"><span className="material-symbols-outlined">arrow_back</span>BACK TO DASHBOARD</button><ChallengeFullscreenView signedIn={Boolean(userEmail)} userEmail={userEmail} onOpenAuth={openAuth} onExit={() => navigate('dashboard')} /><AuthModal isOpen={isAuthOpen} onClose={closeAuth} recoveryMode={isPasswordRecovery} /></>;

  return <div className="min-h-screen w-full bg-[#0b1326] text-[#dae2fd] font-sans antialiased overflow-x-hidden">
    <Sidebar currentTab={currentTab} onSelectTab={navigate} onOpenSearch={() => setIsSearchOpen(true)} signedIn={Boolean(userEmail)} userEmail={userEmail} mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
    <div className="w-full lg:pl-72 min-w-0">
      <Header currentTab={currentTab} onOpenReport={openScoutReport} onBack={goBack} onOpenMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => setIsSearchOpen(true)} signedIn={Boolean(userEmail)} onOpenAuth={openAuth} onLogOut={signOut} />
      <main className="pt-16 min-h-screen w-full min-w-0 overflow-x-hidden"><div className="w-full min-w-0 max-w-full [&_img]:max-w-full [&_table]:text-[11px] sm:[&_table]:text-sm [&_.overflow-x-auto]:overscroll-x-contain">
        {currentTab === 'dashboard' && <DashboardWithLiveNow onSelectTab={selectFromDashboard} onSelectMatchup={setSelectedMatchup} />}
        {currentTab === 'schedule' && <ScheduleView onOpenGame={openScheduledGame} onOpenTeam={openTeam} />}
        {currentTab === 'matchups' && <PvBWorkspaceView selectedGame={selectedMatchup} />}
        {currentTab === 'team-comparison' && <TeamComparisonView />}
        {currentTab === 'game-logs' && <GameLogsView onOpenReport={openScoutReport} />}
        {currentTab === 'scouting-feed' && <ScoutingFeedView />}
        {currentTab === 'highlights' && <HighlightsView />}
        {currentTab === 'analytics' && <AnalyticsView />}
        {currentTab === 'player-predictions' && <PlayerPredictionsViewV3 />}
        {currentTab === 'community' && <CommunityView signedIn={Boolean(userEmail)} userEmail={userEmail} onOpenAuth={openAuth} />}
        {currentTab === 'challenge-workspace' && <ChallengeWorkspaceView initialTab={challengeWorkspaceTab} signedIn={Boolean(userEmail)} userEmail={userEmail} onOpenAuth={openAuth} />}
        {currentTab === 'weekly-challenge' && userEmail && <WeeklyChallengeView onBack={() => navigate('profile')} />}
        {currentTab === 'weekly-challenge' && !userEmail && <MembershipView onSignIn={openAuth} signedIn={false} />}
        {currentTab === 'friends-challenge' && userEmail && <FriendsChallengeView onBack={() => navigate('profile')} />}
        {currentTab === 'friends-challenge' && !userEmail && <MembershipView onSignIn={openAuth} signedIn={false} />}
        {currentTab === 'player-profile' && <PlayerProfileView playerId={selectedPlayerId} onOpenTeam={openTeam} />}
        {currentTab === 'team-profile' && <TeamProfileView teamId={selectedTeamId} onOpenPlayer={openPlayer} />}
        {currentTab === 'profile' && userEmail && <div onClickCapture={profileActivityCapture} className="sc-profile-routing"><style>{`.sc-profile-routing button[class*="min-w-[230px]"]{pointer-events:none!important;cursor:default!important}`}</style><ProfileView onOpenPremium={() => navigate('membership')} onOpenChallenge={() => {}} onOpenSettings={() => navigate('settings')} /></div>}
        {currentTab === 'profile' && !userEmail && <MembershipView onSignIn={openAuth} signedIn={false} />}
        {currentTab === 'my-predictions' && userEmail && <MyPredictionsView onBack={() => navigate('profile')} />}
        {currentTab === 'my-predictions' && !userEmail && <MembershipView onSignIn={openAuth} signedIn={false} />}
        {currentTab === 'scout-level' && userEmail && <ScoutLevelView />}
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
