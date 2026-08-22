(() => {
  const MLB_API = 'https://statsapi.mlb.com/api/v1';
  const easternDate = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  const localGameTime = (date) => new Intl.DateTimeFormat(undefined, {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(date));

  const text = (element, value) => {
    if (element) element.textContent = String(value ?? '');
  };

  const element = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = String(content);
    return node;
  };

  const scheduleMessage = document.querySelector('#schedule-message');
  const gameGrid = document.querySelector('#game-grid');
  const refreshButton = document.querySelector('#refresh-games');
  const totalGames = document.querySelector('#total-games');
  const liveGames = document.querySelector('#live-games');
  const finalGames = document.querySelector('#final-games');
  const pageDate = document.querySelector('#page-date');
  const updatedTime = document.querySelector('#updated-time');
  const intelligenceSummary = document.querySelector('#intelligence-summary');
  const signalGrid = document.querySelector('#signal-grid');

  const displayDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date());
  text(pageDate, `${displayDate} · ET schedule date`);

  const teamRow = (side) => {
    const team = side?.team ?? {};
    const row = element('div', 'team-row');
    const logo = element('div', 'team-logo');
    const image = document.createElement('img');
    image.src = team.id ? `https://www.mlbstatic.com/team-logos/${team.id}.svg` : '/ixmetrics-app-icon-192.png';
    image.alt = team.name ? `${team.name} logo` : 'MLB team logo';
    image.width = 42;
    image.height = 42;
    image.loading = 'lazy';
    logo.append(image);

    const copy = element('div', 'team-copy');
    copy.append(element('strong', '', team.name ?? 'Team'));
    const record = side?.leagueRecord;
    copy.append(element('span', '', record ? `${record.wins}-${record.losses}` : 'Season record'));
    const score = element('span', 'team-score', side?.score ?? '—');
    row.append(logo, copy, score);
    return row;
  };

  const gameCard = (game) => {
    const card = element('article', 'game-card');
    const top = element('div', 'game-card-top');
    const statusValue = game?.status?.abstractGameState ?? 'Scheduled';
    const statusClass = statusValue === 'Live' ? 'live' : statusValue === 'Final' ? 'final' : '';
    top.append(
      element('span', 'game-time', localGameTime(game.gameDate)),
      element('span', `game-status ${statusClass}`.trim(), game?.status?.detailedState ?? statusValue),
    );

    const teams = element('div', 'teams');
    teams.append(teamRow(game?.teams?.away), teamRow(game?.teams?.home));
    const pitchers = element('div', 'pitchers');
    pitchers.append(element('span', '', 'Probable pitchers'));
    const awayPitcher = game?.teams?.away?.probablePitcher?.fullName ?? 'TBD';
    const homePitcher = game?.teams?.home?.probablePitcher?.fullName ?? 'TBD';
    pitchers.append(document.createTextNode(`${awayPitcher} vs ${homePitcher}`));
    teams.append(pitchers);
    card.append(top, teams);
    return card;
  };

  const loadSchedule = async () => {
    if (!gameGrid || !scheduleMessage) return;
    refreshButton?.setAttribute('disabled', '');
    scheduleMessage.hidden = false;
    text(scheduleMessage, "Loading today's verified MLB schedule…");
    try {
      const date = easternDate();
      const response = await fetch(`${MLB_API}/schedule?sportId=1&date=${date}&hydrate=team,linescore,probablePitcher`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Schedule request failed (${response.status})`);
      const payload = await response.json();
      const games = (payload?.dates ?? []).flatMap((day) => day?.games ?? []);
      const live = games.filter((game) => game?.status?.abstractGameState === 'Live').length;
      const final = games.filter((game) => game?.status?.abstractGameState === 'Final').length;
      text(totalGames, games.length);
      text(liveGames, live);
      text(finalGames, final);
      gameGrid.replaceChildren(...games.map(gameCard));
      scheduleMessage.hidden = games.length > 0;
      if (!games.length) text(scheduleMessage, 'No MLB games are scheduled today.');
      text(updatedTime, `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date())}`);
    } catch (error) {
      gameGrid.replaceChildren();
      text(totalGames, '—');
      text(liveGames, '—');
      text(finalGames, '—');
      text(scheduleMessage, 'The live MLB schedule is temporarily unavailable. Please refresh in a moment.');
      text(updatedTime, 'Schedule refresh needed');
      console.warn('IXMetrics public schedule:', error);
    } finally {
      refreshButton?.removeAttribute('disabled');
    }
  };

  const signalCard = (signal) => {
    const card = element('article', 'signal-card');
    card.append(element('span', 'signal-kind', signal?.kind ?? 'WATCH'));
    card.append(element('h3', '', signal?.player ?? signal?.team ?? 'IXMetrics signal'));
    card.append(element('div', 'signal-value', signal?.value ?? 'Watch'));
    const matchup = [signal?.team, signal?.opponentPitcher ? `vs ${signal.opponentPitcher}` : ''].filter(Boolean).join(' · ');
    if (matchup) card.append(element('p', 'signal-meta', matchup));
    if (signal?.reason) card.append(element('p', 'signal-reason', signal.reason));
    return card;
  };

  const loadIntelligence = async () => {
    if (!signalGrid || !intelligenceSummary) return;
    try {
      const response = await fetch(`/data/daily-intelligence.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Intelligence request failed (${response.status})`);
      const payload = await response.json();
      const report = payload?.report ?? {};
      const signals = Array.isArray(report.signals) ? report.signals : [];
      text(intelligenceSummary, report.headline ?? 'IXMetrics is checking today’s verified MLB data.');
      signalGrid.replaceChildren(...signals.slice(0, 8).map(signalCard));
      if (!signals.length) {
        signalGrid.append(element('article', 'status-message', 'No daily signals have cleared the verification rules yet. Check back as game data updates.'));
      }
    } catch (error) {
      text(intelligenceSummary, 'Daily intelligence is updating.');
      signalGrid.replaceChildren(element('article', 'status-message', 'Verified signals will appear here when the latest report is available.'));
      console.warn('IXMetrics public intelligence:', error);
    }
  };

  refreshButton?.addEventListener('click', () => {
    void loadSchedule();
    void loadIntelligence();
  });

  void loadSchedule();
  void loadIntelligence();
  window.setInterval(() => {
    void loadSchedule();
    void loadIntelligence();
  }, 5 * 60 * 1000);
})();
