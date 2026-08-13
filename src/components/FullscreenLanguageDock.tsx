import React from 'react';
import { LanguageSwitcher } from './LanguageSwitcher';

export const FullscreenLanguageDock: React.FC = () => <>
  <style>{`.sc-fullscreen-language-dock{display:flex}body:has(header) .sc-fullscreen-language-dock{display:none}`}</style>
  <div className="sc-fullscreen-language-dock fixed bottom-5 left-5 z-[550]">
    <LanguageSwitcher />
  </div>
</>;
