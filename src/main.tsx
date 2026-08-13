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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
