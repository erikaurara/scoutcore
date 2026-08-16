const PLAYER_IDS: Record<string, number> = {
  'Jahmai Jones': 663330,
  'Eduardo Valencia': 680664,
  'Sean Burke': 680732,
  'Dylan Cease': 656302,
};

const headshotUrl = (playerId: number) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best,f_auto/v1/people/${playerId}/headshot/67/current`;

const enhanceSignalCards = () => {
  if (!window.matchMedia('(max-width: 640px)').matches) return;

  document.querySelectorAll<HTMLButtonElement>('main button.bg-\\[\\#171f33\\].text-left').forEach((card) => {
    if (card.querySelector('.sc-mobile-signal-headshot')) return;

    const nameEl = card.querySelector('h4');
    const playerName = nameEl?.textContent?.trim();
    if (!nameEl || !playerName) return;

    const playerId = PLAYER_IDS[playerName];
    if (!playerId) return;

    const img = document.createElement('img');
    img.className = 'sc-mobile-signal-headshot';
    img.src = headshotUrl(playerId);
    img.alt = `${playerName} headshot`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => img.remove();

    nameEl.parentElement?.insertBefore(img, nameEl);
  });
};

let frame = 0;
const scheduleEnhance = () => {
  window.cancelAnimationFrame(frame);
  frame = window.requestAnimationFrame(enhanceSignalCards);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleEnhance, { once: true });
} else {
  scheduleEnhance();
}

new MutationObserver(scheduleEnhance).observe(document.documentElement, {
  childList: true,
  subtree: true,
});

window.addEventListener('resize', scheduleEnhance);
