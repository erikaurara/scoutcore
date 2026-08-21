import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppPageLocalizer } from './AppPageLocalizer';

export type ScoutLocale = 'en' | 'ja' | 'es' | 'ko' | 'zh-TW' | 'pt-BR' | 'de';

export const LANGUAGE_OPTIONS: { code: ScoutLocale; short: string; label: string }[] = [
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'ja', short: '日本語', label: '日本語' },
  { code: 'es', short: 'ES', label: 'Español' },
  { code: 'ko', short: '한국어', label: '한국어' },
  { code: 'zh-TW', short: '繁體中文', label: '繁體中文' },
  { code: 'pt-BR', short: 'PT-BR', label: 'Português (Brasil)' },
  { code: 'de', short: 'DE', label: 'Deutsch' },
];

const STORAGE_KEY = 'scoutcore:language';

const copy = {
  en: {
    language: 'Language', search: 'Search', searchPlayersTeams: 'Search players, teams...', quickSearch: 'Quick Search',
    dashboard: 'Dashboard', schedule: 'Schedule', matchups: 'Matchup', matchupLab: 'Matchup Lab', teamAnalysis: 'Team Analysis', scoutingFeed: 'Scouting Feed', highlights: 'Highlights', analytics: 'Analytics', playerPredictions: 'Player Predictions', community: 'Community', challenge: 'ScoutCore Challenge',
    coreModules: 'Core Modules', account: 'Account', yourScoutLevel: 'Your Scout Level', settings: 'Settings', unlockMore: 'Unlock More',
    login: 'Log In', logout: 'Log Out', notifications: 'Notifications', aiScoutReport: 'AI Scout Report', liveScoutAlerts: 'Live Scout Alerts', newAlerts: '3 New', performanceSpike: 'Performance Spike', recentSignal: 'Recent performance signal detected from verified game data.', liveSystemOptimal: 'Live System: Optimal', backToDashboard: 'Back to Dashboard',
  },
  ja: {
    language: '言語', search: '検索', searchPlayersTeams: '選手・チームを検索...', quickSearch: 'クイック検索',
    dashboard: 'ダッシュボード', schedule: 'スケジュール', matchups: '対戦', matchupLab: '対戦ラボ', teamAnalysis: 'チーム分析', scoutingFeed: 'スカウティングフィード', highlights: 'ハイライト', analytics: '分析', playerPredictions: '選手予測', community: 'コミュニティ', challenge: 'ScoutCore チャレンジ',
    coreModules: 'コア機能', account: 'アカウント', yourScoutLevel: 'あなたのスカウトレベル', settings: '設定', unlockMore: 'さらに利用する',
    login: 'ログイン', logout: 'ログアウト', notifications: '通知', aiScoutReport: 'AI スカウトレポート', liveScoutAlerts: 'ライブスカウト通知', newAlerts: '新着 3件', performanceSpike: 'パフォーマンス上昇', recentSignal: '確認済みの試合データから最近のパフォーマンス変化を検出しました。', liveSystemOptimal: 'ライブシステム: 正常', backToDashboard: 'ダッシュボードへ戻る',
  },
  es: {
    language: 'Idioma', search: 'Buscar', searchPlayersTeams: 'Buscar jugadores, equipos...', quickSearch: 'Búsqueda rápida',
    dashboard: 'Panel', schedule: 'Calendario', matchups: 'Enfrentamiento', matchupLab: 'Laboratorio de enfrentamientos', teamAnalysis: 'Análisis de equipos', scoutingFeed: 'Informe de scouting', highlights: 'Destacados', analytics: 'Análisis', playerPredictions: 'Predicciones de jugadores', community: 'Comunidad', challenge: 'Desafío ScoutCore',
    coreModules: 'Módulos principales', account: 'Cuenta', yourScoutLevel: 'Tu nivel Scout', settings: 'Ajustes', unlockMore: 'Desbloquear más',
    login: 'Iniciar sesión', logout: 'Cerrar sesión', notifications: 'Notificaciones', aiScoutReport: 'Informe Scout IA', liveScoutAlerts: 'Alertas Scout en vivo', newAlerts: '3 nuevas', performanceSpike: 'Pico de rendimiento', recentSignal: 'Se detectó una señal reciente de rendimiento en datos de juego verificados.', liveSystemOptimal: 'Sistema en vivo: óptimo', backToDashboard: 'Volver al panel',
  },
  ko: {
    language: '언어', search: '검색', searchPlayersTeams: '선수, 팀 검색...', quickSearch: '빠른 검색',
    dashboard: '대시보드', schedule: '일정', matchups: '맞대결', matchupLab: '맞대결 연구소', teamAnalysis: '팀 분석', scoutingFeed: '스카우팅 피드', highlights: '하이라이트', analytics: '분석', playerPredictions: '선수 예측', community: '커뮤니티', challenge: 'ScoutCore 챌린지',
    coreModules: '핵심 메뉴', account: '계정', yourScoutLevel: '내 스카우트 레벨', settings: '설정', unlockMore: '더 보기',
    login: '로그인', logout: '로그아웃', notifications: '알림', aiScoutReport: 'AI 스카우트 리포트', liveScoutAlerts: '라이브 스카우트 알림', newAlerts: '새 알림 3개', performanceSpike: '퍼포먼스 상승', recentSignal: '검증된 경기 데이터에서 최근 퍼포먼스 신호가 감지되었습니다.', liveSystemOptimal: '라이브 시스템: 정상', backToDashboard: '대시보드로 돌아가기',
  },
  'zh-TW': {
    language: '語言', search: '搜尋', searchPlayersTeams: '搜尋球員、球隊...', quickSearch: '快速搜尋',
    dashboard: '儀表板', schedule: '賽程', matchups: '對戰', matchupLab: '對戰實驗室', teamAnalysis: '球隊分析', scoutingFeed: '球探動態', highlights: '精彩片段', analytics: '分析', playerPredictions: '球員預測', community: '社群', challenge: 'ScoutCore 挑戰',
    coreModules: '核心功能', account: '帳號', yourScoutLevel: '你的球探等級', settings: '設定', unlockMore: '解鎖更多',
    login: '登入', logout: '登出', notifications: '通知', aiScoutReport: 'AI 球探報告', liveScoutAlerts: '即時球探提醒', newAlerts: '3 則新提醒', performanceSpike: '表現提升', recentSignal: '已從驗證比賽資料中偵測到近期表現訊號。', liveSystemOptimal: '即時系統：正常', backToDashboard: '返回儀表板',
  },
  'pt-BR': {
    language: 'Idioma', search: 'Pesquisar', searchPlayersTeams: 'Pesquisar jogadores, times...', quickSearch: 'Pesquisa rápida',
    dashboard: 'Painel', schedule: 'Agenda', matchups: 'Confronto', matchupLab: 'Laboratório de confrontos', teamAnalysis: 'Análise de times', scoutingFeed: 'Feed de scouting', highlights: 'Destaques', analytics: 'Análises', playerPredictions: 'Previsões de jogadores', community: 'Comunidade', challenge: 'Desafio ScoutCore',
    coreModules: 'Módulos principais', account: 'Conta', yourScoutLevel: 'Seu nível Scout', settings: 'Configurações', unlockMore: 'Desbloquear mais',
    login: 'Entrar', logout: 'Sair', notifications: 'Notificações', aiScoutReport: 'Relatório Scout IA', liveScoutAlerts: 'Alertas Scout ao vivo', newAlerts: '3 novos', performanceSpike: 'Pico de desempenho', recentSignal: 'Um sinal recente de desempenho foi detectado em dados de jogo verificados.', liveSystemOptimal: 'Sistema ao vivo: ideal', backToDashboard: 'Voltar ao painel',
  },
  de: {
    language: 'Sprache', search: 'Suchen', searchPlayersTeams: 'Spieler, Teams suchen...', quickSearch: 'Schnellsuche',
    dashboard: 'Übersicht', schedule: 'Spielplan', matchups: 'Duell', matchupLab: 'Duell-Labor', teamAnalysis: 'Teamanalyse', scoutingFeed: 'Scouting-Feed', highlights: 'Höhepunkte', analytics: 'Analysen', playerPredictions: 'Spielerprognosen', community: 'Gemeinschaft', challenge: 'ScoutCore-Challenge',
    coreModules: 'Hauptmodule', account: 'Konto', yourScoutLevel: 'Dein Scout-Level', settings: 'Einstellungen', unlockMore: 'Mehr freischalten',
    login: 'Anmelden', logout: 'Abmelden', notifications: 'Benachrichtigungen', aiScoutReport: 'KI-Scoutingbericht', liveScoutAlerts: 'Live-Scoutinghinweise', newAlerts: '3 neu', performanceSpike: 'Leistungsanstieg', recentSignal: 'In verifizierten Spieldaten wurde ein aktuelles Leistungssignal erkannt.', liveSystemOptimal: 'Live-System: optimal', backToDashboard: 'Zurück zur Übersicht',
  },
} as const;

export type TranslationKey = keyof typeof copy.en;

type LanguageContextValue = {
  locale: ScoutLocale;
  setLocale: (locale: ScoutLocale) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const validLocale = (value: string | null): value is ScoutLocale => LANGUAGE_OPTIONS.some(option => option.code === value);

export const LanguageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [locale, setLocaleState] = useState<ScoutLocale>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (validLocale(saved)) return saved;
    } catch {}
    return 'en';
  });

  const setLocale = (next: ScoutLocale) => {
    setLocaleState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch {}
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.scoutLocale = locale;
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    setLocale,
    t: (key) => copy[locale][key] ?? copy.en[key],
  }), [locale]);

  return <LanguageContext.Provider value={value}>
    {children}
    <AppPageLocalizer locale={locale} />
    <style>{`.sc-provider-language-dock{display:flex}body:has(header) .sc-provider-language-dock{display:none}`}</style>
    <label className="sc-provider-language-dock fixed bottom-5 left-5 z-[550] items-center gap-2 rounded-xl border border-[#31405b] bg-[#0b1425]/95 px-3 py-2 text-[#dbe7f5] shadow-2xl backdrop-blur">
      <span className="material-symbols-outlined text-[18px] text-[#00f0ff]">language</span>
      <select value={locale} onChange={event => setLocale(event.target.value as ScoutLocale)} className="max-w-[150px] bg-transparent text-xs font-bold text-white outline-none" aria-label={copy[locale].language}>
        {LANGUAGE_OPTIONS.map(option => <option key={option.code} value={option.code}>{option.short}</option>)}
      </select>
    </label>
  </LanguageContext.Provider>;
};

export const useLanguage = () => {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
};
