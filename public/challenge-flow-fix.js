(() => {
  let upcoming = new Set();
  let allowInternalClick = false;
  let selectedGameNeedsPitcherFirst = false;

  const normalize = value => String(value || '').trim().toLowerCase();
  const easternDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  const MLB_TEAMS = {
    'Arizona Diamondbacks': [109, 'Diamondbacks'], 'Atlanta Braves': [144, 'Braves'], 'Baltimore Orioles': [110, 'Orioles'], 'Boston Red Sox': [111, 'Red Sox'], 'Chicago Cubs': [112, 'Cubs'], 'Chicago White Sox': [145, 'White Sox'], 'Cincinnati Reds': [113, 'Reds'], 'Cleveland Guardians': [114, 'Guardians'], 'Colorado Rockies': [115, 'Rockies'], 'Detroit Tigers': [116, 'Tigers'], 'Houston Astros': [117, 'Astros'], 'Kansas City Royals': [118, 'Royals'], 'Los Angeles Angels': [108, 'Angels'], 'Los Angeles Dodgers': [119, 'Dodgers'], 'Miami Marlins': [146, 'Marlins'], 'Milwaukee Brewers': [158, 'Brewers'], 'Minnesota Twins': [142, 'Twins'], 'New York Mets': [121, 'Mets'], 'New York Yankees': [147, 'Yankees'], 'Athletics': [133, 'Athletics'], 'Oakland Athletics': [133, 'Athletics'], 'Philadelphia Phillies': [143, 'Phillies'], 'Pittsburgh Pirates': [134, 'Pirates'], 'San Diego Padres': [135, 'Padres'], 'San Francisco Giants': [137, 'Giants'], 'Seattle Mariners': [136, 'Mariners'], 'St. Louis Cardinals': [138, 'Cardinals'], 'Tampa Bay Rays': [139, 'Rays'], 'Texas Rangers': [140, 'Rangers'], 'Toronto Blue Jays': [141, 'Blue Jays'], 'Washington Nationals': [120, 'Nationals']
  };

  async function refreshUpcomingGames() {
    try {
      const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${easternDate()}&hydrate=team,probablePitcher`);
      const data = await response.json();
      upcoming = new Set((data?.dates || []).flatMap(day => day?.games || []).filter(game => game?.status?.abstractGameState === 'Preview').map(game => `${normalize(game?.teams?.away?.team?.name)}@${normalize(game?.teams?.home?.team?.name)}`));
    } catch {}
  }

  const stepTitle = root => root?.querySelector('.sc-challenge-kicker')?.textContent?.trim() || '';
  function buttonByText(root, text) { return [...root.querySelectorAll('button')].find(button => button.textContent?.includes(text)); }
  function internalClick(button) { if (!button) return; allowInternalClick = true; button.click(); setTimeout(() => { allowInternalClick = false; }, 0); }

  function filterToday(root) {
    const todayPanel = [...root.querySelectorAll('.sc-panel')].find(panel => panel.textContent?.includes('TODAY’S GAMES'));
    if (!todayPanel || !upcoming.size) return;
    todayPanel.querySelectorAll('.sc-game-card').forEach(card => {
      const teams = [...card.querySelectorAll('.sc-team-side strong')].map(node => normalize(node.textContent));
      if (teams.length === 2) card.hidden = !upcoming.has(`${teams[0]}@${teams[1]}`);
    });
  }

  function polishMyPredictions() {
    const title = [...document.querySelectorAll('h1')].find(node => node.textContent?.trim() === 'My Predictions');
    if (!title) return;
    document.querySelectorAll('div').forEach(node => {
      if (node.dataset.teamPolished === 'true') return;
      const raw = node.textContent?.trim(); const team = raw && MLB_TEAMS[raw];
      if (!team || node.children.length) return;
      const [id, nickname] = team; node.dataset.teamPolished = 'true'; node.textContent = '';
      const wrap = document.createElement('span'); wrap.style.display='inline-flex'; wrap.style.alignItems='center'; wrap.style.gap='8px'; wrap.style.maxWidth='100%';
      if (node.parentElement?.classList.contains('text-right')) wrap.style.justifyContent='flex-end';
      const img=document.createElement('img'); img.src=`https://www.mlbstatic.com/team-logos/${id}.svg`; img.alt=''; img.style.width='26px'; img.style.height='26px'; img.style.objectFit='contain'; img.style.flex='0 0 auto';
      const label=document.createElement('span'); label.textContent=nickname; label.style.overflow='hidden'; label.style.textOverflow='ellipsis'; label.style.whiteSpace='nowrap'; wrap.append(img,label); node.appendChild(wrap);
    });
  }

  function injectFriendsChallengeActivity() {
    const root=document.querySelector('.sc-profile-routing'); if(!root) return;
    if([...root.querySelectorAll('button')].some(b=>b.textContent?.includes('Friends Challenge'))) return;
    const weekly=[...root.querySelectorAll('button')].find(b=>b.textContent?.includes('Weekly Challenge'));
    if(!weekly?.parentElement) return;
    const clone=weekly.cloneNode(true);
    const button=clone;
    button.querySelectorAll('*').forEach(node=>{
      if(node.textContent?.trim()==='Weekly Challenge') node.textContent='Friends Challenge';
      if(node.textContent?.includes('ranked cards remaining')) node.textContent='3 free friend game modes · 0 tickets';
      if(node.classList?.contains('material-symbols-outlined')) node.textContent='group';
    });
    button.setAttribute('aria-label','Friends Challenge');
    weekly.parentElement.insertBefore(button, weekly.nextSibling);
  }

  function polishLeaderboard() {
    const heading=[...document.querySelectorAll('h2')].find(node=>node.textContent?.trim()==='Challenge Leaderboards'); if(heading) heading.textContent='Leaderboard';
    const rankHeader=[...document.querySelectorAll('span')].find(node=>node.textContent?.trim()==='Rank'); const headerGrid=rankHeader?.parentElement;
    if(headerGrid){headerGrid.style.gridTemplateColumns='minmax(42px,.45fr) minmax(118px,2fr) repeat(4,minmax(54px,.8fr))';headerGrid.style.columnGap='8px';headerGrid.style.width='100%';headerGrid.style.minWidth='0';headerGrid.style.boxSizing='border-box';headerGrid.style.paddingLeft='14px';headerGrid.style.paddingRight='14px';[...headerGrid.children].forEach((child,index)=>{child.style.minWidth='0';if(index>=2)child.style.textAlign='center'});const wrapper=headerGrid.parentElement;if(wrapper)wrapper.style.overflowX='hidden'}
    const emptyTitle=[...document.querySelectorAll('h3')].find(node=>node.textContent?.trim()==='No eligible predictors in this view yet');
    if(!emptyTitle||emptyTitle.dataset.leaderboardPolished==='true')return; const empty=emptyTitle.parentElement;if(!empty)return;emptyTitle.dataset.leaderboardPolished='true';
    empty.innerHTML=`<div style="display:grid;grid-template-columns:minmax(42px,.45fr) minmax(118px,2fr) repeat(4,minmax(54px,.8fr));column-gap:8px;width:100%;box-sizing:border-box;text-align:left;align-items:center;padding:0 14px;font-size:clamp(11px,1.15vw,15px)">${[['#1','Top predictor','#20e7f2'],['#2','Waiting for results','#70a8ba'],['#3','Waiting for results','#70a8ba']].map(([rank,user,color])=>`<span style="font-weight:800;color:${color};padding:13px 0">${rank}</span><span style="font-weight:700;color:#8fa0b7;padding:13px 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${user}</span><span style="color:#718090;text-align:center">—</span><span style="color:#718090;text-align:center">—</span><span style="color:#718090;text-align:center">—</span><span style="color:#718090;text-align:center">—</span>`).join('')}</div><div style="border-top:1px solid #26364d;margin-top:2px;padding:10px 12px;color:#718090;font-size:clamp(9px,1vw,11px);text-align:center">Leaderboard positions fill automatically when users reach 20 completed ranked picks.</div>`;
    empty.style.padding='0';empty.style.width='100%';empty.style.maxWidth='100%';empty.style.overflowX='hidden';
  }

  function sync(root){filterToday(root);if(selectedGameNeedsPitcherFirst&&stepTitle(root).includes('BATTERS')){selectedGameNeedsPitcherFirst=false;setTimeout(()=>internalClick(buttonByText(root,'NEXT: PITCHERS')),0)}}

  document.addEventListener('click',event=>{
    const root=event.target?.closest?.('.sc-challenge-fullscreen'); if(!root||allowInternalClick)return; const button=event.target?.closest?.('button'); if(!button)return; const label=button.textContent||''; const step=stepTitle(root);
    if(button.classList.contains('sc-game-card')){selectedGameNeedsPitcherFirst=true;return}
    if(step.includes('PITCHERS')&&label.includes('NEXT: GAME PICKS')){event.preventDefault();event.stopPropagation();internalClick(buttonByText(root,'BACK'));return}
    if(step.includes('BATTERS')&&label.includes('NEXT: PITCHERS')){event.preventDefault();event.stopPropagation();internalClick(buttonByText(root,'NEXT: PITCHERS'));setTimeout(()=>internalClick(buttonByText(root,'NEXT: GAME PICKS')),50);return}
    if(step.includes('BATTERS')&&label.trim().startsWith('BACK')){event.preventDefault();event.stopPropagation();internalClick(buttonByText(root,'NEXT: PITCHERS'));return}
    if(step.includes('PITCHERS')&&label.trim().startsWith('BACK')){event.preventDefault();event.stopPropagation();internalClick(buttonByText(root,'BACK'));setTimeout(()=>internalClick(buttonByText(root,'BACK')),50)}
  },true);

  refreshUpcomingGames().then(()=>document.querySelectorAll('.sc-challenge-fullscreen').forEach(sync));
  polishLeaderboard(); polishMyPredictions(); injectFriendsChallengeActivity();
  new MutationObserver(()=>{document.querySelectorAll('.sc-challenge-fullscreen').forEach(sync);polishLeaderboard();polishMyPredictions();injectFriendsChallengeActivity()}).observe(document.documentElement,{childList:true,subtree:true});
})();