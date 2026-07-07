import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './NotificationBell.css';

const NotificationBell = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushStatus, setPushStatus] = useState('');

  const publicVapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBtc3sHAEwgwkU8A5I7h9m5o4';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  useEffect(() => {
    if (!profile) return;

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsSubscribed(!!sub);
        });
      });
    }

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        (payload) => {
          const newNotification = payload.new;
          setNotifications(prev => [newNotification, ...prev].slice(0, 20));
          setUnreadCount(prev => prev + 1);

          // Show browser native notification if permitted
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(newNotification.title, {
              body: newNotification.message,
              icon: '/favicon.ico' // optional
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const markAsRead = async (id) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert("Push notifications are not supported in this browser.");
      return;
    }
    setPushStatus('Subscribing...');
    try {
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });
      }
      
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: profile.id,
        subscription: subscription.toJSON()
      }, { onConflict: 'user_id, subscription' });
      
      if (error) throw error;
      
      setIsSubscribed(true);
      setPushStatus('');
    } catch (error) {
      console.error("Push subscribe error:", error);
      alert("Failed to subscribe to push notifications. Ensure you have granted permissions.");
      setPushStatus('');
    }
  };

  return (
    <div className="notification-bell-container">
      <button className="bell-button btn btn-outline" onClick={() => setIsOpen(!isOpen)} title="Notifications">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="badge-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="notification-backdrop" onClick={() => setIsOpen(false)}></div>
          <div className="notification-dropdown card">
            <div className="notification-header">
              <h3>Notifications</h3>
              <div className="flex gap-2 items-center">
                {!isSubscribed && (
                  <button className="btn btn-outline text-xs" style={{ padding: '0.25rem 0.5rem' }} onClick={subscribeToPush} disabled={!!pushStatus}>
                    {pushStatus || 'Enable Push'}
                  </button>
                )}
                {unreadCount > 0 && (
                  <button className="btn-text" onClick={markAllAsRead}>Mark all read</button>
                )}
              </div>
            </div>
            
            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="no-notifications">No recent notifications</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={`notification-item ${!n.is_read ? 'unread' : ''}`}>
                    <div className="notification-content">
                      <div className="notification-title">{n.title}</div>
                      <div className="notification-message">{n.message}</div>
                      <div className="notification-time">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                    {!n.is_read && (
                      <button className="mark-read-btn" onClick={() => markAsRead(n.id)} title="Mark as read">
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
