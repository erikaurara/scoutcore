import React from 'react';
import { NavigationTab } from '../types';
import { LOGO_URL } from '../data/mockData';
import { useLanguage } from '../i18n/LanguageContext';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenSearch: () => void;
  signedIn: boolean;
  userEmail?: string | null;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  overlayMode?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onOpenSearch, signedIn, userEmail, mobileOpen = false, onCloseMobile, overlayMode = false }) => {
  const { t } = useLanguage();
  const navItems: { id: NavigationTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: t('dashboard'), icon: 'dashboard' },
    { id: 'schedule', label: t('schedule'), icon: 'calendar_month' },
    { id: 'matchup-lab', label: t('matchupLab'), icon: 'science' },
    { id: 'team-comparison', label: t('teamAnalysis'), icon: 'analytics' },
    { id: 'scouting-feed', label: t('scoutingFeed'), icon: 'rss_feed' },
    { id: 'highlights', label: t('highlights'), icon: 'movie' },
    { id: 'analytics', label: t('analytics'), icon: 'query_stats' },
    { id: 'player-predictions', label: t('playerPredictions'), icon: 'monitoring' },
    { id: 'community', label: t('community'), icon: 'forum' },
    { id: 'challenge', label: t('challenge'), icon: 'emoji_events' },
  ];

  const selectTab = (tab: NavigationTab) => {
    onSelectTab(tab);
    onCloseMobile?.();
  };

  const accountItems: { id: NavigationTab; label: string; icon: string }[] = signedIn
    ? [
        { id: 'scout-level', label: t('yourScoutLevel'), icon: 'explore' },
        { id: 'settings', label: t('settings'), icon: 'settings' },
      ]
    : [
        { id: 'membership', label: t('unlockMore'), icon: 'person_add' },
        { id: 'settings', label: t('settings'), icon: 'settings' },
      ];

  const accountInitial = (userEmail?.trim()?.[0] || 'U').toUpperCase();

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" onClick={onCloseMobile} className={`fixed inset-0 z-40 bg-[#030814]/75 backdrop-blur-sm ${overlayMode ? '' : 'lg:hidden'}`} />}
      <aside className={`fixed inset-y-0 left-0 h-auto w-[82vw] max-w-[300px] rounded-none bg-[#131b2e] z-50 flex flex-col border-r border-[#3b494b]/20 shadow-2xl select-none transform transition-transform duration-200 ease-out ${overlayMode ? '' : 'lg:w-72 lg:max-w-none lg:translate-x-0'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center gap-2 px-3 border-b border-[#3b494b]/20 shrink-0">
          <button onClick={() => selectTab('dashboard')} className="flex items-center gap-2 min-w-0 shrink-0 hover:opacity-90 transition-opacity" aria-label="IXMetrics dashboard">
            <img src={LOGO_URL} alt="IXMetrics" className="h-7 w-7 rounded-md object-contain shrink-0" />
            <span className="font-headline-lg font-bold text-[#dbfcff] truncate text-base">IXMetrics</span>
          </button>

          <button onClick={onCloseMobile} aria-label="Close menu" className={`ml-auto w-10 h-10 rounded-xl border border-[#31405b] bg-[#111a2d] text-[#b9cacb] hover:text-[#00f0ff] flex items-center justify-center shrink-0 ${overlayMode ? '' : 'lg:hidden'}`}><span className="material-symbols-outlined text-[22px]">close</span></button>
        </div>

        <div className={`px-3 pt-3 shrink-0 ${overlayMode ? '' : 'lg:hidden'}`}>
          <button onClick={() => { onOpenSearch(); onCloseMobile?.(); }} className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-[#3b494b]/30 bg-[#060e20] px-3.5 text-left text-[#849495] hover:text-[#dae2fd] hover:border-[#00f0ff]/50 transition-all text-xs font-mono" title={t('quickSearch')}>
            <span className="material-symbols-outlined text-[20px] text-[#00f0ff] shrink-0">search</span>
            <span className="truncate">{t('search')}</span>
          </button>
        </div>

        {signedIn && (
          <div className="px-3 pt-3 shrink-0">
            <button type="button" onClick={() => selectTab('profile')} className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${currentTab === 'profile' ? 'border-[#00f0ff]/60 bg-[#00f0ff]/12' : 'border-[#2b3e58] bg-[#0b1425] hover:border-[#00f0ff]/40 hover:bg-[#111d31]'}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00f0ff] text-xs font-extrabold text-[#00363a]">{accountInitial}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-label-caps uppercase tracking-wider text-[#65f2b5]">{t('account')}</span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-[#dbe7f5]">{userEmail || 'IXMetrics User'}</span>
              </span>
              <span className="material-symbols-outlined text-[18px] text-[#849495]">chevron_right</span>
            </button>
          </div>
        )}

        <nav className={`flex-1 py-3 px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-1 overflow-y-auto overscroll-contain ${overlayMode ? '' : 'lg:pb-3'}`}>
          <div className="px-3 pb-2 pt-1"><span className="text-[10px] text-[#849495] font-label-caps uppercase tracking-wider">{t('coreModules')}</span></div>
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return <button key={item.id} onClick={() => selectTab(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group text-left ${isActive ? 'bg-[#00f0ff] text-[#00363a] font-bold shadow-[0_2px_12px_rgba(0,239,255,0.25)]' : 'text-[#b9cacb] hover:bg-[#222a3d] hover:text-[#dae2fd]'}`}><span className={`material-symbols-outlined text-[20px] shrink-0 ${isActive ? 'text-[#00363a]' : 'group-hover:text-[#00f0ff]'}`}>{item.icon}</span><span className="font-label-caps text-[11px] sm:text-[12px] truncate">{item.label}</span></button>;
          })}

          <div className="pt-4 border-t border-[#3b494b]/10 mt-4 mx-2"><span className="text-[10px] text-[#849495] px-2 font-label-caps uppercase tracking-wider">{t('account')}</span></div>
          {accountItems.map((item) => {
            const isActive = currentTab === item.id;
            return <button key={item.id} onClick={() => selectTab(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group text-left mt-1 ${isActive ? 'bg-[#00f0ff] text-[#00363a] font-bold' : 'text-[#b9cacb] hover:bg-[#222a3d] hover:text-[#dae2fd]'}`}><span className="material-symbols-outlined text-[20px]">{item.icon}</span><span className="font-label-caps text-[12px]">{item.label}</span></button>;
          })}
        </nav>
      </aside>
    </>
  );
};
