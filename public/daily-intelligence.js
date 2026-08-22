(() => {
  const text = (element, value) => {
    if (element) element.textContent = String(value ?? '');
  };

  const element = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = String(content);
    return node;
  };

  const reportDate = document.querySelector('#report-date');
  const reportUpdated = document.querySelector('#report-updated');
  const reportSummary = document.querySelector('#report-summary');
  const refreshButton = document.querySelector('#refresh-intelligence');
  const dailyStatus = document.querySelector('#daily-status');
  const signalGrid = document.querySelector('#daily-signal-grid');
  const caveatList = document.querySelector('#caveat-list');
  const matchupEdges = document.querySelector('#matchup-edges');
  const hotPlayers = document.querySelector('#hot-players');
  const watchAlerts = document.querySelector('#watch-alerts');
  const totalSignals = document.querySelector('#total-signals');

  text(reportDate, new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date()));

  const normalizedKind = (signal) => String(signal?.kind ?? 'Verified signal').toUpperCase();
  const kindLabel = (signal) => {
    const kind = normalizedKind(signal);
    if (kind === 'HOT HITTER') return 'Recent hitter form';
    if (kind === 'PITCHER WATCH') return 'Pitcher trend';
    if (kind === 'BULLPEN WATCH') return 'Bullpen trend';
    if (kind === 'MATCHUP EDGE') return 'Matchup context';
    return 'Verified signal';
  };

  const signalImage = (signal) => {
    const frame = element('div', 'daily-signal-image');
    const image = document.createElement('img');
    if (signal?.playerId) {
      image.src = `https://img.mlbstatic.com/mlb-photos/image/upload/e_background_removal,f_png,w_260,q_auto:best/v1/people/${signal.playerId}/headshot/67/current`;
      image.alt = signal?.player ? `${signal.player} headshot` : 'MLB player headshot';
    } else if (signal?.teamId) {
      image.src = `https://www.mlbstatic.com/team-logos/${signal.teamId}.svg`;
      image.alt = signal?.team ? `${signal.team} logo` : 'MLB team logo';
      frame.classList.add('team-image');
    } else {
      image.src = '/ixmetrics-app-icon-192.png';
      image.alt = 'IXMetrics';
      frame.classList.add('team-image');
    }
    image.width = 140;
    image.height = 140;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      image.src = '/ixmetrics-app-icon-192.png';
      image.alt = 'IXMetrics';
      frame.classList.add('team-image');
    }, { once: true });
    frame.append(image);
    return frame;
  };

  const signalCard = (signal) => {
    const card = element('article', 'daily-signal-card');
    const top = element('div', 'daily-signal-top');
    top.append(
      element('span', 'signal-kind', normalizedKind(signal)),
      element('strong', 'daily-signal-value', signal?.value ?? 'Watch'),
    );
    card.append(top, signalImage(signal));
    card.append(element('p', 'daily-signal-label', kindLabel(signal)));
    card.append(element('h3', '', signal?.player ?? signal?.team ?? 'IXMetrics signal'));

    const context = [signal?.team, signal?.opponentPitcher ? `vs ${signal.opponentPitcher}` : '']
      .filter(Boolean)
      .join(' · ');
    if (context) card.append(element('p', 'daily-signal-context', context));

    const evidence = element('div', 'daily-signal-evidence');
    evidence.append(element('span', '', 'Why it appears'));
    evidence.append(element('p', '', signal?.reason ?? 'Verified recent MLB data supports this research signal.'));
    card.append(evidence);
    return card;
  };

  const renderNotes = (notes) => {
    if (!caveatList) return;
    const values = Array.isArray(notes) && notes.length
      ? notes
      : [
          'Generated automatically from verified MLB data and IXMetrics analytics rules.',
          'Lineups, probable pitchers, injuries, and game information can change during the day.',
          'Signals are research clues and never guarantee an outcome.',
        ];
    caveatList.replaceChildren(...values.map((note) => {
      const row = element('p', 'caveat-item');
      row.append(element('span', '', 'i'), document.createTextNode(note));
      return row;
    }));
  };

  const countKinds = (signals) => ({
    edges: signals.filter((signal) => normalizedKind(signal) === 'MATCHUP EDGE').length,
    hot: signals.filter((signal) => normalizedKind(signal) === 'HOT HITTER').length,
    watch: signals.filter((signal) => ['PITCHER WATCH', 'BULLPEN WATCH'].includes(normalizedKind(signal))).length,
  });

  const loadReport = async () => {
    if (!signalGrid || !dailyStatus) return;
    refreshButton?.setAttribute('disabled', '');
    dailyStatus.hidden = false;
    text(dailyStatus, "Loading today's intelligence report…");
    try {
      const response = await fetch(`/data/daily-intelligence.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Daily report request failed (${response.status})`);
      const payload = await response.json();
      const report = payload?.report ?? {};
      const signals = Array.isArray(report.signals) ? report.signals : [];
      const calculated = countKinds(signals);
      const breakdown = report.breakdown ?? {};

      text(reportSummary, report.summary ?? report.headline ?? 'IXMetrics is checking today’s verified MLB data.');
      text(matchupEdges, breakdown.matchupEdges ?? calculated.edges);
      text(hotPlayers, breakdown.hotHitters ?? calculated.hot);
      text(watchAlerts, (breakdown.pitcherWatch ?? 0) + (breakdown.bullpenWatch ?? 0) || calculated.watch);
      text(totalSignals, signals.length);

      if (payload?.generatedAt) {
        const generated = new Date(payload.generatedAt);
        text(reportUpdated, `Updated ${new Intl.DateTimeFormat(undefined, {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        }).format(generated)}`);
      } else {
        text(reportUpdated, 'Latest report loaded');
      }

      signalGrid.replaceChildren(...signals.map(signalCard));
      dailyStatus.hidden = signals.length > 0;
      if (!signals.length) {
        text(dailyStatus, 'No signals have cleared the verification rules yet. Check back as today’s MLB data updates.');
      }
      renderNotes(report.caveats);
    } catch (error) {
      signalGrid.replaceChildren();
      text(reportSummary, 'Daily Intelligence is temporarily updating.');
      text(matchupEdges, '—');
      text(hotPlayers, '—');
      text(watchAlerts, '—');
      text(totalSignals, '—');
      text(reportUpdated, 'Refresh needed');
      text(dailyStatus, 'The latest report is temporarily unavailable. Please refresh in a moment.');
      renderNotes();
      console.warn('IXMetrics Daily Intelligence:', error);
    } finally {
      refreshButton?.removeAttribute('disabled');
    }
  };

  refreshButton?.addEventListener('click', () => void loadReport());
  void loadReport();
  window.setInterval(() => void loadReport(), 5 * 60 * 1000);
})();
