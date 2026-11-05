import api from '../utils/api';

/**
 * Helper to convert a Base64 VAPID public key into a Uint8Array buffer
 * for browser PushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if Web Push is supported in the current environment
 */
export function isPushNotificationSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Request notification permission and subscribe to Web Push using server VAPID key
 */
export async function subscribeUserToPush() {
  if (!isPushNotificationSupported()) {
    console.warn('[Push] Web Push is not supported in this browser.');
    return { success: false, reason: 'unsupported' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Notification permission was denied or dismissed.');
      return { success: false, reason: 'permission_denied' };
    }

    // 1. Fetch the server's public VAPID key
    let vapidPublicKey = null;
    try {
      const res = await api.get('/api/notifications/vapid-public-key');
      vapidPublicKey = res.data?.publicKey;
    } catch {
      // Fallback demo/standalone test key if server endpoint is not configured
      vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    }

    // 2. Wait for Service Worker registration
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // If not subscribed, subscribe now
    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    // 3. Send subscription details to backend
    try {
      await api.post('/api/notifications/subscribe', subscription.toJSON());
    } catch (err) {
      console.warn('[Push] Subscribed locally, server sync error:', err);
    }

    return { success: true, subscription };
  } catch (err) {
    console.error('[Push] Failed to subscribe user to push notifications:', err);
    return { success: false, error: err };
  }
}

/**
 * Display a local notification using the active service worker
 */
export async function triggerLocalNotification(title, options = {}) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      icon: '/pwa-192x192.png',
      badge: '/favicon.svg',
      vibrate: [100, 50, 100],
      ...options
    });
  } catch (err) {
    console.warn('[Push] Could not display notification:', err);
  }
}

