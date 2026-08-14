(() => {
  let upcoming = new Set();
  let allowInternalClick = false;
  let selectedGameNeedsPitcherFirst = false;

  const normalize = value => String(value || '').trim().toLowerCase();
  const easternDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  async function refreshUpcomingGames() {
    try {
      const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${easternDate()}&hydrate=team,probablePitcher`);
      const data = await response.json();
      upcoming = new Set((data?.dates || []).flatMap(day => day?.games || []).filter(game => game?.status?.abstractGameState === 'Preview').map(game => `${normalize(game?.teams?.away?.team?.name)}@${normalize(game?.teams?.home?.team?.name)}`));
    } catch {}
  }

  const stepTitle = root => root?.querySelector('.sc-challenge-kicker')?.textContent?.trim() || '';

  function buttonByText(root, text) {
    return [...root.querySelectorAll('button')].find(button => button.textContent?.includes(text));
  }

  function internalClick(button) {
    if (!button) return;
    allowInternalClick = true;
    button.click();
    setTimeout(() => { allowInternalClick = false; }, 0);
  }

  function filterToday(root) {
    const todayPanel = [...root.querySelectorAll('.sc-panel')].find(panel => panel.textContent?.includes('TODAY’S GAMES'));
    if (!todayPanel || !upcoming.size) return;
    todayPanel.querySelectorAll('.sc-game-card').forEach(card => {
      const teams = [...card.querySelectorAll('.sc-team-side strong')].map(node => normalize(node.textContent));
      if (teams.length === 2) card.hidden = !upcoming.has(`${teams[0]}@${teams[1]}`);
    });
  }

  function polishLeaderboard() {
    const headings = [...document.querySelectorAll('h2')];
    const heading = headings.find(node => node.textContent?.trim() === 'Challenge Leaderboards');
    if (heading) heading.textContent = 'Leaderboard';

    const rankHeader = [...document.querySelectorAll('span')].find(node => node.textContent?.trim() === 'Rank');
    const headerGrid = rankHeader?.parentElement;
    if (headerGrid) {
      headerGrid.style.gridTemplateColumns = 'minmax(42px,.45fr) minmax(118px,2fr) repeat(4,minmax(54px,.8fr))';
      headerGrid.style.columnGap = '8px';
      headerGrid.style.width = '100%';
      headerGrid.style.minWidth = '0';
      headerGrid.style.boxSizing = 'border-box';
      headerGrid.style.paddingLeft = '14px';
      headerGrid.style.paddingRight = '14px';
      [...headerGrid.children].forEach((child, index) => {
        child.style.minWidth = '0';
        if (index >= 2) child.style.textAlign = 'center';
      });
      const wrapper = headerGrid.parentElement;
      if (wrapper) wrapper.style.overflowX = 'hidden';
    }

    const emptyTitle = [...document.querySelectorAll('h3')].find(node => node.textContent?.trim() === 'No eligible predictors in this view yet');
    if (!emptyTitle || emptyTitle.dataset.leaderboardPolished === 'true') return;
    const empty = emptyTitle.parentElement;
    if (!empty) return;
    emptyTitle.dataset.leaderboardPolished = 'true';
    empty.innerHTML = `
      <div style="display:grid;grid-template-columns:minmax(42px,.45fr) minmax(118px,2fr) repeat(4,minmax(54px,.8fr));column-gap:8px;width:100%;box-sizing:border-box;text-align:left;align-items:center;padding:0 14px;font-size:clamp(11px,1.15vw,15px)">
        ${[
          ['#1','Top predictor','#20e7f2'],
          ['#2','Waiting for results','#70a8ba'],
          ['#3','Waiting for results','#70a8ba']
        ].map(([rank,user,color]) => `
          <span style="font-weight:800;color:${color};padding:13px 0">${rank}</span>
          <span style="font-weight:700;color:#8fa0b7;padding:13px 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${user}</span>
          <span style="color:#718090;text-align:center">—</span><span style="color:#718090;text-align:center">—</span><span style="color:#718090;text-align:center">—</span><span style="color:#718090;text-align:center">—</span>
        `).join('')}
      </div>
      <div style="border-top:1px solid #26364d;margin-top:2px;padding:10px 12px;color:#718090;font-size:clamp(9px,1vw,11px);text-align:center">Leaderboard positions fill automatically when users reach 20 completed ranked picks.</div>`;
    empty.style.padding = '0';
    empty.style.width = '100%';
    empty.style.maxWidth = '100%';
    empty.style.overflowX = 'hidden';
  }

  function sync(root) {
    filterToday(root);
    if (selectedGameNeedsPitcherFirst && stepTitle(root).includes('BATTERS')) {
      selectedGameNeedsPitcherFirst = false;
      setTimeout(() => internalClick(buttonByText(root, 'NEXT: PITCHERS')), 0);
    }
  }

  document.addEventListener('click', event => {
    const root = event.target?.closest?.('.sc-challenge-fullscreen');
    if (!root || allowInternalClick) return;
    const button = event.target?.closest?.('button');
    if (!button) return;
    const label = button.textContent || '';
    const step = stepTitle(root);

    if (button.classList.contains('sc-game-card')) {
      selectedGameNeedsPitcherFirst = true;
      return;
    }

    if (step.includes('PITCHERS') && label.includes('NEXT: GAME PICKS')) {
      event.preventDefault();
      event.stopPropagation();
      internalClick(buttonByText(root, 'BACK'));
      return;
    }

    if (step.includes('BATTERS') && label.includes('NEXT: PITCHERS')) {
      event.preventDefault();
      event.stopPropagation();
      internalClick(buttonByText(root, 'NEXT: PITCHERS'));
      setTimeout(() => internalClick(buttonByText(root, 'NEXT: GAME PICKS')), 50);
      return;
    }

    if (step.includes('BATTERS') && label.trim().startsWith('BACK')) {
      event.preventDefault();
      event.stopPropagation();
      internalClick(buttonByText(root, 'NEXT: PITCHERS'));
      return;
    }

    if (step.includes('PITCHERS') && label.trim().startsWith('BACK')) {
      event.preventDefault();
      event.stopPropagation();
      internalClick(buttonByText(root, 'BACK'));
      setTimeout(() => internalClick(buttonByText(root, 'BACK')), 50);
    }
  }, true);

  refreshUpcomingGames().then(() => document.querySelectorAll('.sc-challenge-fullscreen').forEach(sync));
  polishLeaderboard();
  new MutationObserver(() => {
    document.querySelectorAll('.sc-challenge-fullscreen').forEach(sync);
    polishLeaderboard();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
