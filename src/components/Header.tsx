import React from 'react';
import { NavigationTab } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NotificationCenter, type NotificationTarget } from './NotificationCenter';
import { useLanguage } from '../i18n/LanguageContext';

interface HeaderProps {
  currentTab: NavigationTab;
  onOpenReport: () => void;
  onBack?: () => void;
  showBack?: boolean;
  onOpenMobileNav?: () => void;
  onOpenSearch?: () => void;
  signedIn?: boolean;
  onOpenAuth?: () => void;
  onLogOut?: () => void;
  onOpenNotification?: (target: NotificationTarget) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onOpenReport, onBack, showBack = false, onOpenMobileNav, onOpenSearch, signedIn = false, onOpenAuth, onLogOut, onOpenNotification }) => {
  const { t } = useLanguage();
  const isProfilePage = currentTab === 'player-profile' || currentTab === 'team-profile';
  const showBackButton = Boolean(onBack) && (showBack || isProfilePage);
  const showAiScoutReport = currentTab === 'player-profile';

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-72 h-16 bg-[#0b1326]/95 backdrop-blur-xl z-40 border-b border-[#3b494b]/20 flex items-center justify-between px-3 sm:px-4 lg:px-8 select-none">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {showBackButton ? <button onClick={onBack} aria-label={showBack ? 'Back to Matchup' : 'Go back'} title={showBack ? 'Back to Matchup' : 'Go back'} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#31405b] bg-[#111a2d] text-[#b9cacb] hover:border-[#62ddeb]/70 hover:text-[#62ddeb] lg:hidden"><span className="material-symbols-outlined text-[22px]">arrow_back</span></button> : <button onClick={onOpenMobileNav} aria-label="Open menu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#31405b] bg-[#111a2d] text-[#b9cacb] hover:text-[#00f0ff] lg:hidden"><span className="material-symbols-outlined text-[22px]">menu</span></button>}
        <button type="button" aria-label="NineMetrics home" className="lg:hidden flex min-w-0 items-center overflow-hidden">
          <img src="/ninemetrics-wordmark.svg" alt="NineMetrics — AI Gameday Intelligence" className="h-[46px] w-[178px] max-w-[44vw] object-contain object-left shrink-0" />
        </button>
        {showBackButton && onBack && (
          <button onClick={onBack} aria-label={showBack ? 'Back to Matchup' : 'Go back'} title={showBack ? 'Back to Matchup' : 'Go back'} className="w-9 h-9 rounded-lg border border-[#31405b] bg-[#111a2d] text-[#b9cacb] hover:text-[#62ddeb] hover:border-[#62ddeb]/70 hover:bg-[#17233a] transition-all hidden lg:flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
        )}

        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="hidden lg:flex h-10 w-full max-w-[440px] items-center gap-3 rounded-xl border border-[#31405b] bg-[#07101f] px-4 text-left text-[#849495] transition-all hover:border-[#00f0ff]/55 hover:bg-[#0d1729] hover:text-[#dbe7f5] focus:outline-none focus:border-[#00f0ff]"
            title={t('searchPlayersTeams')}
            aria-label={t('searchPlayersTeams')}
          >
            <span className="material-symbols-outlined text-[20px] text-[#00f0ff] shrink-0">search</span>
            <span className="min-w-0 flex-1 truncate text-xs sm:text-sm">{t('searchPlayersTeams')}</span>
            <span className="hidden xl:inline text-[10px] font-label-caps tracking-wide text-[#607086]">{t('quickSearch').toUpperCase()}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 shrink-0 ml-3">
        {showAiScoutReport && (
          <button onClick={onOpenReport} className="h-9 px-2.5 sm:px-3 rounded-lg bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 text-xs font-label-caps flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,240,255,0.1)]">
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
            <span className="hidden sm:inline">{t('aiScoutReport').toUpperCase()}</span>
            <span className="sm:hidden">AI</span>
          </button>
        )}

        <LanguageSwitcher compact />

        {!signedIn && onOpenAuth && (
          <button type="button" onClick={onOpenAuth} className="h-9 rounded-lg border border-[#00f0ff]/35 bg-[#00f0ff]/10 px-2.5 sm:px-3 text-[#00f0ff] hover:bg-[#00f0ff]/18 transition-all flex items-center gap-1.5" title={t('login')} aria-label={t('login')}>
            <span className="material-symbols-outlined text-[18px]">login</span>
            <span className="hidden sm:inline text-[11px] font-label-caps font-bold tracking-wide">{t('login').toUpperCase()}</span>
          </button>
        )}

        {signedIn && (
          <button type="button" onClick={onLogOut} className="h-9 rounded-lg border border-[#31405b] bg-[#111a2d] px-2.5 sm:px-3 text-[#b9cacb] hover:border-[#00f0ff]/45 hover:text-[#00f0ff] transition-all flex items-center gap-1.5" title={t('logout')} aria-label={t('logout')}>
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span className="hidden sm:inline text-[11px] font-label-caps font-bold tracking-wide">{t('logout').toUpperCase()}</span>
          </button>
        )}

        <NotificationCenter signedIn={signedIn} onOpenTarget={onOpenNotification} />
        <div className="hidden md:flex items-center gap-2 pl-2 border-l border-[#3b494b]/30"><span className="text-xs font-label-caps text-[#4edea3] tracking-wide">{t('liveSystemOptimal').toUpperCase()}</span><div className="w-2.5 h-2.5 rounded-full bg-[#65f2b5] shadow-[0_0_8px_rgba(101,242,181,0.8)] animate-pulse" /></div>
      </div>
    </header>
  );
};
