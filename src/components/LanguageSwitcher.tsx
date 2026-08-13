import React, { useEffect, useRef, useState } from 'react';
import { LANGUAGE_OPTIONS, useLanguage } from '../i18n/LanguageContext';

type Props = {
  compact?: boolean;
  className?: string;
};

export const LanguageSwitcher: React.FC<Props> = ({ compact = false, className = '' }) => {
  const { locale, setLocale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = LANGUAGE_OPTIONS.find(option => option.code === locale) ?? LANGUAGE_OPTIONS[0];

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  return <div ref={rootRef} className={`relative ${className}`}>
    <button
      type="button"
      onClick={() => setOpen(current => !current)}
      className={`flex items-center justify-center gap-1.5 rounded-lg border border-[#31405b] bg-[#0b1425]/95 text-[#dbe7f5] shadow-lg backdrop-blur transition hover:border-[#00f0ff]/60 hover:text-white ${compact ? 'h-9 min-w-12 px-2' : 'h-9 min-w-[62px] px-2.5'}`}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={t('language')}
      title={t('language')}
    >
      <span className="material-symbols-outlined text-[17px] text-[#00f0ff]">language</span>
      <span className="max-w-[72px] truncate text-[11px] font-extrabold tracking-wide">{selected.short}</span>
      {!compact && <span className="material-symbols-outlined text-[15px] text-[#7f91a6]">expand_more</span>}
    </button>

    {open && <div role="menu" className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-[#31405b] bg-[#0b1425] p-1.5 shadow-2xl z-[600]">
      {LANGUAGE_OPTIONS.map(option => {
        const active = option.code === locale;
        return <button
          key={option.code}
          type="button"
          role="menuitem"
          onClick={() => { setLocale(option.code); setOpen(false); }}
          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${active ? 'bg-[#00f0ff]/12 text-[#7df4ff]' : 'text-[#d5dfeb] hover:bg-[#18243a] hover:text-white'}`}
        >
          <span className="text-sm font-semibold">{option.label}</span>
          <span className="text-[10px] font-bold text-[#7d8fa5]">{option.short}</span>
        </button>;
      })}
    </div>}
  </div>;
};
