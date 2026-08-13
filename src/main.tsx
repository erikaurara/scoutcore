import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './onboarding.css';
import './account-polish.css';
import './live-matchup.css';
import './live-simulator.css';
import './live-verified-motion.css';
import './challenge-wizard.css';
import './readability.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
