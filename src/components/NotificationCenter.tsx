import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { supabase } from '../services/supabaseClient';

type NotificationItem = {
  id: string;
  recipient_profile_id: string;
  actor_profile_id?: string | null;
  actor_display_name: string;
  actor_avatar_url?: string | null;
  kind: 'friend_play_request' | 'friend_play_response' | 'friend_challenge_invite' | 'friend_challenge_update';
  title: string;
  body: string;
  action_target: 'friends-challenge:inbox' | 'friends-challenge:active';
  entity_id?: string | null;
  read_at?: string | null;
  created_at: string;
};

type Props = {
  signedIn: boolean;
  onOpenTarget?: (target: NotificationItem['action_target']) => void;
};

const notificationColumns = 'id,recipient_profile_id,actor_profile_id,actor_display_name,actor_avatar_url,kind,title,body,action_target,entity_id,read_at,created_at';

const relativeTime = (value: string) => {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'Now';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export const NotificationCenter: React.FC<Props> = ({ signedIn, onOpenTarget }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toast, setToast] = useState<NotificationItem | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!supabase || !signedIn) return;
    setLoading(true);
    const { data } = await supabase
      .from('scoutcore_notifications')
      .select(notificationColumns)
      .order('created_at', { ascending: false })
      .limit(30);
    setNotifications((data ?? []) as NotificationItem[]);
    setLoading(false);
  }, [signedIn]);

  useEffect(() => {
    if (!supabase || !signedIn) {
      setNotifications([]);
      setToast(null);
      setOpen(false);
      return;
    }

    let disposed = false;
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

    const connect = async () => {
      const { data: profiles } = await supabase.rpc('sync_my_social_profile');
      const profileId = (profiles as Array<{ profile_id?: string }> | null)?.[0]?.profile_id;
      if (!profileId || disposed) return;

      channel = supabase
        .channel(`scoutcore-notifications-${profileId}-${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'scoutcore_notifications',
            filter: `recipient_profile_id=eq.${profileId}`,
          },
          (payload) => {
            const incoming = payload.new as NotificationItem;
            setNotifications((current) => [incoming, ...current.filter((item) => item.id !== incoming.id)].slice(0, 30));
            setToast(incoming);
          },
        )
        .subscribe();

      await loadNotifications();
    };

    void connect();
    return () => {
      disposed = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadNotifications, signedIn]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read_at).length, [notifications]);

  const markRead = async (item: NotificationItem) => {
    if (!supabase || item.read_at) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
    await supabase.from('scoutcore_notifications').update({ read_at: readAt }).eq('id', item.id);
  };

  const markAllRead = async () => {
    if (!supabase || unreadCount === 0) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    await supabase.from('scoutcore_notifications').update({ read_at: readAt }).is('read_at', null);
  };

  const openNotification = (item: NotificationItem) => {
    void markRead(item);
    setToast(null);
    setOpen(false);
    onOpenTarget?.(item.action_target);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void loadNotifications();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#b9cacb] transition-colors hover:bg-[#222a3d] hover:text-[#00f0ff]"
        title={t('notifications')}
        aria-label={`${t('notifications')}${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-[#0b1326] bg-[#00f0ff] px-1 text-[8px] font-black leading-none text-[#05101e]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section className="absolute right-0 z-50 mt-2 w-[calc(100vw-24px)] max-w-[360px] overflow-hidden rounded-2xl border border-[#304963] bg-[#0b172a]/[.98] shadow-2xl backdrop-blur-xl">
          <header className="flex items-center justify-between border-b border-[#293d56] px-4 py-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[.12em] text-[#50eaf4]">Notifications</h2>
              <p className="mt-0.5 text-[10px] text-[#8495a9]">{unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}</p>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="text-[10px] font-bold text-[#65f2b5]">MARK ALL READ</button>
            )}
          </header>

          <div className="max-h-[min(440px,62vh)] overflow-y-auto p-2">
            {!signedIn ? (
              <div className="px-4 py-10 text-center text-xs text-[#8f9eb1]">Log in to see your notifications.</div>
            ) : loading && notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-[#8f9eb1]">Loading notifications…</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="material-symbols-outlined text-[30px] text-[#40536b]">notifications_none</span>
                <p className="mt-2 text-xs text-[#8f9eb1]">No notifications yet.</p>
              </div>
            ) : notifications.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => openNotification(item)}
                className={`flex w-full gap-3 rounded-xl border p-3 text-left transition ${item.read_at ? 'border-transparent bg-transparent' : 'border-[#50eaf4]/20 bg-[#50eaf4]/[.045]'}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#50eaf4]/40 bg-[#50eaf4]/10 text-[#50eaf4]">
                  {item.actor_avatar_url ? <img src={item.actor_avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="material-symbols-outlined text-[21px]">smart_toy</span>}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <strong className="text-xs text-white">{item.title}</strong>
                    <span className="shrink-0 text-[9px] text-[#718198]">{relativeTime(item.created_at)}</span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-[#a5b1c2]">{item.body}</span>
                  <span className="mt-1.5 block text-[9px] font-black uppercase tracking-wide text-[#50eaf4]">VIEW REQUEST →</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {toast && (
        <div key={toast.id} className="sc-notification-toast fixed left-3 right-3 top-[76px] z-[90] sm:left-auto sm:right-5 sm:w-[360px]" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-2xl border border-[#50eaf4]/55 bg-[#0b172a]/[.98] p-3 shadow-[0_18px_55px_rgba(0,0,0,.45)] backdrop-blur-xl">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#50eaf4]/50 bg-[#50eaf4]/10 text-[#50eaf4]">
              <span className="material-symbols-outlined text-[24px]">smart_toy</span>
            </div>
            <button type="button" onClick={() => openNotification(toast)} className="min-w-0 flex-1 text-left">
              <span className="block text-[10px] font-black uppercase tracking-[.12em] text-[#65f2b5]">{toast.title}</span>
              <span className="mt-1 block text-xs leading-4 text-white">{toast.body}</span>
              <span className="mt-1 block text-[9px] font-black text-[#50eaf4]">VIEW →</span>
            </button>
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8495a9] hover:bg-white/5 hover:text-white">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
