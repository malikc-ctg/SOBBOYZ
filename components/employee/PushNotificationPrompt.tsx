'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PushState = 'loading' | 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed';

export default function PushNotificationPrompt() {
  const [pushState, setPushState] = useState<PushState>('loading');
  const [isToggling, setIsToggling] = useState(false);

  const checkSubscription = useCallback(async () => {
    // Check browser support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported');
      return;
    }

    // Check permission
    if (Notification.permission === 'denied') {
      setPushState('denied');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setPushState(subscription ? 'subscribed' : 'unsubscribed');
    } catch {
      setPushState('unsubscribed');
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  async function subscribe() {
    setIsToggling(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState('denied');
        toast.error('Notification permission denied. Enable it in your browser settings.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        toast.error('Push notification configuration error');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
      });

      // Send subscription to our server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (!res.ok) {
        throw new Error('Failed to save subscription on server');
      }

      setPushState('subscribed');
      toast.success('Push notifications enabled! You\'ll be notified when jobs are assigned.');
    } catch (err) {
      console.error('Push subscribe error:', err);
      toast.error('Failed to enable notifications. Please try again.');
    } finally {
      setIsToggling(false);
    }
  }

  async function unsubscribe() {
    setIsToggling(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      await fetch('/api/push/subscribe', { method: 'DELETE' });

      setPushState('unsubscribed');
      toast.success('Push notifications disabled.');
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      toast.error('Failed to disable notifications.');
    } finally {
      setIsToggling(false);
    }
  }

  // Don't render on loading/unsupported
  if (pushState === 'loading') return null;
  if (pushState === 'unsupported') return null;

  // Show the enable banner when not subscribed
  if (pushState === 'unsubscribed') {
    return (
      <button
        onClick={subscribe}
        disabled={isToggling}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 hover:border-blue-400/50 transition-all duration-200 group"
      >
        {isToggling ? (
          <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
        ) : (
          <BellRing className="h-5 w-5 text-blue-400 group-hover:animate-bounce" />
        )}
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-blue-300">
            Enable Push Notifications
          </p>
          <p className="text-[11px] text-muted-foreground">
            Get instant alerts when you&apos;re assigned to jobs
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 font-medium">
          Tap
        </span>
      </button>
    );
  }

  if (pushState === 'denied') {
    return (
      <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-900/20 border border-red-500/30">
        <BellOff className="h-5 w-5 text-red-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-300">
            Notifications Blocked
          </p>
          <p className="text-[11px] text-muted-foreground">
            Open browser settings → allow notifications for this site
          </p>
        </div>
      </div>
    );
  }

  // Subscribed — show a subtle toggle
  return (
    <button
      onClick={unsubscribe}
      disabled={isToggling}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-900/20 border border-emerald-500/30 hover:border-emerald-400/50 transition-all duration-200"
    >
      {isToggling ? (
        <Loader2 className="h-5 w-5 text-emerald-400 animate-spin" />
      ) : (
        <Bell className="h-5 w-5 text-emerald-400" />
      )}
      <div className="flex-1 text-left">
        <p className="text-sm font-semibold text-emerald-300">
          Notifications Enabled ✓
        </p>
        <p className="text-[11px] text-muted-foreground">
          Tap to disable push notifications
        </p>
      </div>
    </button>
  );
}
