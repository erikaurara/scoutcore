import { supabase } from './services/supabaseClient';

type FriendRow = { profile_id: string; display_name: string };

const EXPLANATION_ID = 'sc-friends-challenge-explanations';
const PRESENCE_CHANNEL = 'scoutcore-friends-presence-v1';
const onlineIds = new Set<string>();
let friendRows: FriendRow[] = [];
let presenceStarted = false;

const modeCards = [
  {
    icon: '⚔️',
    title: 'Weekly Head-to-Head',
    text: 'Compete for the whole week. Your normal IXMetrics predictions are compared automatically, so you do not need to make extra picks.',
    tag: 'WEEKLY RIVALRY · FRIENDS ONLY',
  },
  {
    icon: '⚾',
    title: 'Same Game: You vs Friend',
    text: 'Choose the same MLB game, make your picks privately, then reveal them after both players submit. The better result wins.',
    tag: 'PRIVATE PICKS · FRIENDS ONLY',
  },
  {
    icon: '🤝',
    title: 'Team Up',
    text: 'Build a two-player team, face another duo on one MLB game, and combine every teammate’s correct private pick.',
    tag: 'TWO VS TWO · FRIENDS ONLY',
  },
];

function cardStyle(el: HTMLElement) {
  el.style.border = '1px solid #2a405b';
  el.style.background = '#101a2d';
  el.style.borderRadius = '16px';
  el.style.padding = '16px';
}

function injectExplanations() {
  if (!document.body.textContent?.includes('Friends Challenge')) return;
  if (document.getElementById(EXPLANATION_ID)) return;

  const headings = Array.from(document.querySelectorAll('h2'));
  const chooseFriend = headings.find((el) => el.textContent?.trim() === 'Choose a friend');
  const targetSection = chooseFriend?.closest('section');
  if (!targetSection?.parentElement) return;

  const wrap = document.createElement('section');
  wrap.id = EXPLANATION_ID;
  cardStyle(wrap);
  wrap.style.marginBottom = '16px';

  const top = document.createElement('div');
  top.innerHTML = '<div style="font-size:10px;font-weight:900;letter-spacing:.14em;color:#65f2b5;text-transform:uppercase">How each game works</div><div style="margin-top:4px;font-size:18px;font-weight:900;color:white">Choose how you want to play</div><div style="margin-top:4px;font-size:12px;color:#8fa0b5">All Friends Challenge modes are free and separate from the regular Weekly Challenge.</div>';
  wrap.appendChild(top);

  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fit,minmax(210px,1fr))';
  grid.style.gap = '10px';
  grid.style.marginTop = '14px';

  for (const mode of modeCards) {
    const card = document.createElement('div');
    cardStyle(card);
    card.style.background = '#0c1627';
    card.innerHTML = `<div style="font-size:24px">${mode.icon}</div><div style="margin-top:8px;font-size:14px;font-weight:900;color:white">${mode.title}</div><div style="margin-top:6px;font-size:12px;line-height:1.5;color:#8fa0b5">${mode.text}</div><div style="margin-top:10px;font-size:9px;font-weight:900;letter-spacing:.08em;color:#65f2b5">${mode.tag}</div>`;
    grid.appendChild(card);
  }
  wrap.appendChild(grid);

  const bot = document.createElement('div');
  bot.style.marginTop = '12px';
  bot.style.border = '1px solid rgba(89,232,243,.35)';
  bot.style.background = 'rgba(0,230,244,.05)';
  bot.style.borderRadius = '12px';
  bot.style.padding = '12px 14px';
  bot.style.fontSize = '12px';
  bot.style.color = '#9fb0c5';
  bot.innerHTML = '<b style="color:#59e8f3">🤖 ScoutBot</b> handles private invitations with <b>Accept</b> or <b>Decline</b>. If you send a general Play Together invite, ScoutBot privately asks both friends which mode they prefer.';
  wrap.appendChild(bot);

  targetSection.parentElement.insertBefore(wrap, targetSection);
}

function findFriendButton(name: string) {
  const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find((button) => button.textContent?.includes(name) && button.closest('section')?.textContent?.includes('Choose a friend'));
}

function decorateFriendPresence() {
  if (!friendRows.length) return;
  const online: HTMLButtonElement[] = [];
  const offline: HTMLButtonElement[] = [];

  for (const friend of friendRows) {
    const button = findFriendButton(friend.display_name);
    if (!button) continue;
    const isOnline = onlineIds.has(friend.profile_id);
    button.dataset.presence = isOnline ? 'online' : 'offline';

    let badge = button.querySelector<HTMLElement>('[data-sc-presence-badge]');
    if (!badge) {
      badge = document.createElement('span');
      badge.dataset.scPresenceBadge = '1';
      badge.style.marginLeft = 'auto';
      badge.style.display = 'inline-flex';
      badge.style.alignItems = 'center';
      badge.style.gap = '5px';
      badge.style.fontSize = '10px';
      badge.style.fontWeight = '800';
      badge.style.whiteSpace = 'nowrap';
      button.appendChild(badge);
    }
    badge.style.color = isOnline ? '#65f2b5' : '#718090';
    badge.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${isOnline ? '#65f2b5' : '#657080'};box-shadow:${isOnline ? '0 0 8px rgba(101,242,181,.75)' : 'none'}"></span>${isOnline ? 'Online' : 'Offline'}`;
    (isOnline ? online : offline).push(button);
  }

  const parent = online[0]?.parentElement || offline[0]?.parentElement;
  if (parent) [...online, ...offline].forEach((button) => parent.appendChild(button));
}

async function loadFriends() {
  if (!supabase) return;
  const { data, error } = await supabase.rpc('get_friend_challenge_friends');
  if (!error) friendRows = (data ?? []) as FriendRow[];
  decorateFriendPresence();
}

async function startPresence() {
  if (!supabase || presenceStarted) return;
  presenceStarted = true;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return;

  const channel = supabase.channel(PRESENCE_CHANNEL, { config: { presence: { key: user.id } } });
  channel
    .on('presence', { event: 'sync' }, () => {
      onlineIds.clear();
      const state = channel.presenceState() as Record<string, unknown[]>;
      Object.keys(state).forEach((key) => onlineIds.add(key));
      decorateFriendPresence();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
    });
}

function refreshEnhancements() {
  injectExplanations();
  decorateFriendPresence();
  if (document.body.textContent?.includes('Friends Challenge')) void loadFriends();
}

if (typeof window !== 'undefined') {
  void startPresence();
  const observer = new MutationObserver(() => window.requestAnimationFrame(refreshEnhancements));
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    refreshEnhancements();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
