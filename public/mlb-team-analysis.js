(() => {
  const MLB_API = 'https://statsapi.mlb.com/api/v1';
  const text = (node, value) => { if (node) node.textContent = String(value ?? ''); };
  const make = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = String(value);
    return node;
  };
  const easternDate = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  };
  const localTime = (date) => new Intl.DateTimeFormat(undefined, {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(date));

  const grid = document.querySelector('#comparison-grid');
  const message = document.querySelector('#analysis-message');
  const refresh = document.querySelector('#refresh-analysis');
  const matchupCount = document.querySelector('#matchup-count');
  const starterCount = document.querySelector('#starter-count');
  const liveCount = document.querySelector('#live-count');
  const pageDate = document.querySelector('#page-date');
  const updatedTime = document.querySelector('#updated-time');

  const displayDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date());
  text(pageDate, `${displayDate} · ET schedule date`);

  const teamBlock = (side) => {
    const team = side?.team ?? {};
    const block = make('div', 'comparison-team');
    const image = document.createElement('img');
    image.src = team.id ? `https://www.mlbstatic.com/team-logos/${team.id}.svg` : '/ixmetrics-app-icon-192.png';
    image.alt = team.name ? `${team.name} logo` : 'MLB team logo';
    image.width = 64;
    image.height = 64;
    image.loading = 'lazy';
    const record = side?.leagueRecord;
    block.append(image, make('strong', '', team.name ?? 'MLB team'), make('span', '', record ? `${record.wins}-${record.losses} season record` : 'Season record updating'));
    return block;
  };

  const comparisonCard = (game) => {
    const card = make('article', 'comparison-card');
    const header = make('div', 'comparison-card-header');
    const status = game?.status?.detailedState ?? 'Scheduled';
    const statusClass = game?.status?.abstractGameState === 'Live' ? ' live' : game?.status?.abstractGameState === 'Final' ? ' final' : '';
    header.append(make('span', 'game-time', localTime(game.gameDate)), make('span', `game-status${statusClass}`, status));

    const teams = make('div', 'comparison-teams');
    teams.append(teamBlock(game?.teams?.away), make('span', 'comparison-vs', 'VS'), teamBlock(game?.teams?.home));

    const pitchers = make('div', 'comparison-pitchers');
    pitchers.append(make('span', '', 'Probable starters'));
    const awayPitcher = game?.teams?.away?.probablePitcher?.fullName ?? 'TBD';
    const homePitcher = game?.teams?.home?.probablePitcher?.fullName ?? 'TBD';
    pitchers.append(make('strong', '', `${awayPitcher} vs ${homePitcher}`));

    const link = make('a', 'comparison-link', 'Open full comparison →');
    link.href = '/?view=team-comparison';
    link.setAttribute('aria-label', `Open full team analysis for ${game?.teams?.away?.team?.name ?? 'away team'} versus ${game?.teams?.home?.team?.name ?? 'home team'}`);
    card.append(header, teams, pitchers, link);
    return card;
  };

  const load = async () => {
    if (!grid || !message) return;
    refresh?.setAttribute('disabled', '');
    message.hidden = false;
    text(message, "Loading today's MLB team comparisons…");
    try {
      const response = await fetch(`${MLB_API}/schedule?sportId=1&date=${easternDate()}&hydrate=team,probablePitcher`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Schedule request failed (${response.status})`);
      const payload = await response.json();
      const games = (payload?.dates ?? []).flatMap((day) => day?.games ?? []);
      const confirmed = games.reduce((count, game) => count + Number(Boolean(game?.teams?.away?.probablePitcher)) + Number(Boolean(game?.teams?.home?.probablePitcher)), 0);
      const live = games.filter((game) => game?.status?.abstractGameState === 'Live').length;
      text(matchupCount, games.length);
      text(starterCount, confirmed);
      text(liveCount, live);
      grid.replaceChildren(...games.map(comparisonCard));
      message.hidden = games.length > 0;
      if (!games.length) text(message, 'No MLB games are scheduled today. Check back for the next slate.');
      text(updatedTime, `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date())}`);
    } catch (error) {
      grid.replaceChildren();
      text(matchupCount, '—');
      text(starterCount, '—');
      text(liveCount, '—');
      text(message, 'The live team comparison list is temporarily unavailable. Please refresh in a moment.');
      text(updatedTime, 'Data refresh needed');
      console.warn('IXMetrics public team analysis:', error);
    } finally {
      refresh?.removeAttribute('disabled');
    }
  };

  refresh?.addEventListener('click', () => void load());
  void load();
  window.setInterval(() => void load(), 5 * 60 * 1000);
})();
