import { supabase } from './services/supabaseClient';

type FriendRow = { profile_id: string; display_name: string };
const EXPLANATION_ID = 'sc-friends-challenge-explanations';
const PRESENCE_CHANNEL = 'scoutcore-friends-presence-v1';
const onlineIds = new Set<string>();
let friendRows: FriendRow[] = [];
let presenceStarted = false;

const modeCards = [
  { id:'weekly_h2h', icon:'⚔️', title:'Weekly Head-to-Head', text:'Compete with a friend for the whole week. Your normal ScoutCore predictions are compared automatically. Whoever has the better weekly performance wins.', tag:'NO EXTRA PREDICTIONS · 0 TICKETS' },
  { id:'same_game', icon:'⚾', title:'Same Game: You vs Friend', text:'Same MLB game. Different predictions. You both make private picks and ScoutCore reveals them after both submit. The better result wins.', tag:'PRIVATE PICKS · 0 TICKETS' },
  { id:'team_up', icon:'🤝', title:'Team Up', text:'Predict the same game together. ScoutCore finds the picks you agreed on and measures how accurate you were together.', tag:'CO-OP MODE · 0 TICKETS' },
];

function currentTab() {
  const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
  const tabs = buttons.filter(b => /^(PLAY|INVITES|ACTIVE|HISTORY)/.test((b.textContent || '').trim()));
  const active = tabs.find(b => b.className.includes('text-[#59e8f3]'));
  return (active?.textContent || 'PLAY').trim().split(' ')[0];
}

function injectExplanations() {
  if (!document.body.textContent?.includes('Friends Challenge')) return;
  if (currentTab() !== 'PLAY') {
    document.getElementById(EXPLANATION_ID)?.remove();
    return;
  }
  if (document.getElementById(EXPLANATION_ID)) return;
  const chooseFriend = Array.from(document.querySelectorAll('h2')).find(el => el.textContent?.trim() === 'Choose a friend');
  const target = chooseFriend?.closest('section'); if (!target?.parentElement) return;
  document.querySelectorAll<HTMLElement>('div.min-h-screen').forEach(el => { if (el.textContent?.includes('Friends Challenge')) el.classList.add('friends-challenge-shell'); });
  const wrap=document.createElement('section'); wrap.id=EXPLANATION_ID; wrap.className='fc-hero'; wrap.style.marginBottom='16px';
  wrap.innerHTML='<div style="text-align:center"><div style="font-size:11px;font-weight:900;letter-spacing:.16em;color:#65f2b5;text-transform:uppercase">Friends Challenge</div><div style="margin-top:5px;font-size:26px;font-weight:950;color:white">Choose a game mode</div><div class="fc-muted" style="margin-top:5px">Play with friends. Make predictions. Win together. Every mode is free.</div></div>';
  const grid=document.createElement('div'); grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:20px';
  modeCards.forEach(mode=>{const card=document.createElement('div');card.className='fc-mode-card';card.dataset.mode=mode.id;card.innerHTML=`<div class="fc-mode-icon">${mode.icon}</div><div style="margin-top:12px;font-size:17px;font-weight:950;color:white">${mode.title}</div><div class="fc-muted" style="margin-top:8px">${mode.text}</div><div class="fc-zero">${mode.tag}</div>`;grid.appendChild(card)});wrap.appendChild(grid);
  const bot=document.createElement('div');bot.className='fc-scoutbot';bot.style.cssText='margin-top:14px;border-radius:15px;padding:15px 17px';bot.innerHTML='<div style="font-size:14px;font-weight:950;color:white">🤖 Not sure what to play?</div><div class="fc-muted" style="margin-top:3px"><b style="color:#59e8f3">Let ScoutBot help.</b> ScoutBot also handles private invitations, Accept/Decline, private mode choices and reveals.</div>';wrap.appendChild(bot);
  target.parentElement.insertBefore(wrap,target);
}
function findFriendButton(name:string){return (Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]).find(b=>b.textContent?.includes(name)&&b.closest('section')?.textContent?.includes('Choose a friend'))}
function decorateFriendPresence(){if(!friendRows.length)return;const online:HTMLButtonElement[]=[],offline:HTMLButtonElement[]=[];for(const friend of friendRows){const button=findFriendButton(friend.display_name);if(!button)continue;button.classList.add('fc-friend');const isOnline=onlineIds.has(friend.profile_id);button.dataset.presence=isOnline?'online':'offline';let badge=button.querySelector<HTMLElement>('[data-sc-presence-badge]');if(!badge){badge=document.createElement('span');badge.dataset.scPresenceBadge='1';badge.style.cssText='margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:900;white-space:nowrap';button.appendChild(badge)}badge.style.color=isOnline?'#65f2b5':'#8fa0b5';badge.innerHTML=`<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${isOnline?'#65f2b5':'#657080'};box-shadow:${isOnline?'0 0 9px rgba(101,242,181,.85)':'none'}"></span>${isOnline?'Online':'Offline'}`;(isOnline?online:offline).push(button)}const parent=online[0]?.parentElement||offline[0]?.parentElement;if(parent)[...online,...offline].forEach(b=>parent.appendChild(b))}
async function loadFriends(){if(!supabase)return;const{data,error}=await supabase.rpc('get_friend_challenge_friends');if(!error)friendRows=(data??[]) as FriendRow[];decorateFriendPresence()}
async function startPresence(){if(!supabase||presenceStarted)return;presenceStarted=true;const{data}=await supabase.auth.getSession();const user=data.session?.user;if(!user)return;const channel=supabase.channel(PRESENCE_CHANNEL,{config:{presence:{key:user.id}}});channel.on('presence',{event:'sync'},()=>{onlineIds.clear();const state=channel.presenceState() as Record<string,unknown[]>;Object.keys(state).forEach(k=>onlineIds.add(k));decorateFriendPresence()}).subscribe(async status=>{if(status==='SUBSCRIBED')await channel.track({user_id:user.id,online_at:new Date().toISOString()})})}
function refresh(){injectExplanations();decorateFriendPresence();if(document.body.textContent?.includes('Friends Challenge'))void loadFriends()}
if(typeof window!=='undefined'){void startPresence();const observer=new MutationObserver(()=>window.requestAnimationFrame(refresh));const start=()=>{observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});refresh()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}
