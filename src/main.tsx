import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './i18n/LanguageContext';
import './index.css';
import './onboarding.css';
import './account-polish.css';
import './live-matchup.css';
import './live-simulator.css';
import './live-verified-motion.css';
import './challenge-wizard.css';
import './readability.css';
import './latest-polish.css';
import './leaderboard-mobile-polish.css';
import './friends-challenge-enhancements';
import './mobile-approved-rebuild.css';
import './mobile-final-reference.css';
import './mobile-dashboard-games-reference.css';
import './mobile-player-headshots.css';
import './mobile-hide-live-now.css';
import './mobile-player-headshots';
import './live-lens-mobile.css';
import './mobile-live-stadium-parity.css';
import './dashboard-signal-headshots.css';
import './player-predictions-mobile.css';
import './scouting-feed-mobile.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
