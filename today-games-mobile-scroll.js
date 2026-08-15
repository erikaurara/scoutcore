(() => {
  const MOBILE_MAX = 767;

  const findGamesGrid = () => {
    const headings = Array.from(document.querySelectorAll('h1,h2,h3'));
    const heading = headings.find((el) => (el.textContent || '').trim().toLowerCase() === "today's mlb games");
    if (!heading) return null;

    const section = heading.parentElement?.parentElement;
    if (!section) return null;

    return Array.from(section.children).find((el) => el.classList?.contains('grid')) || null;
  };

  const applyTwoGameViewport = () => {
    const grid = findGamesGrid();
    if (!grid) return;

    if (window.innerWidth > MOBILE_MAX) {
      grid.style.maxHeight = '';
      grid.style.overflowY = '';
      grid.style.paddingRight = '';
      grid.style.webkitOverflowScrolling = '';
      return;
    }

    const cards = Array.from(grid.children);
    if (cards.length < 2) return;

    const styles = window.getComputedStyle(grid);
    const gap = parseFloat(styles.rowGap || styles.gap || '0') || 0;
    const twoCardHeight = cards[0].getBoundingClientRect().height + cards[1].getBoundingClientRect().height + gap;

    grid.style.maxHeight = `${Math.ceil(twoCardHeight)}px`;
    grid.style.overflowY = 'auto';
    grid.style.paddingRight = '2px';
    grid.style.webkitOverflowScrolling = 'touch';
    grid.style.overscrollBehaviorY = 'auto';
  };

  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => requestAnimationFrame(applyTwoGameViewport));
  };

  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('load', schedule, { once: true });

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  schedule();
})();