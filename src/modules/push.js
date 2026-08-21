import { supabase, showToast } from '../db.js'

// VAPID Public Key from generation
const VAPID_PUBLIC_KEY = 'BOjTI0MhZjWN43y0qQ50pu5P5SNbF26d7l7XdjgHxyYKHoz5u_8gghPX1vB4CjohCbEA1TYoPmJhMG87SDtzoh4'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPushNotifications(buildingId, role, identifier) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('Notificaciones no soportadas en este dispositivo', 'error');
    return false;
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      window.pushPermissionDenied = true;
      // Do not show a red error! Wait for the UI overlay to gently ask.
      if (document.getElementById('push-banner-area')) {
         document.getElementById('push-banner-area').innerHTML = renderPushBanner();
      }
      return false;
    }

    // if granted, hide banners
    window.pushPermissionDenied = false;
    if (document.getElementById('push-banner-area')) {
       document.getElementById('push-banner-area').innerHTML = renderPushBanner();
    }

    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      };
      subscription = await registration.pushManager.subscribe(subscribeOptions);
    }

    // PASO 3: upsert para evitar duplicados (requiere UNIQUE en columna subscription)
    const { error } = await supabase.from('push_subscriptions').upsert({
      building_id: buildingId,
      role: role,
      identifier: identifier,
      subscription: subscription.toJSON()
    }, { onConflict: 'subscription' });

    if (error) {
      console.warn('[Sloty] Error saving push subscription:', error.message);
    } else {
      console.log('[Sloty] Push subscription saved/updated successfully');
    }

    showToast('✅ Notificaciones activadas', 'success');
    return true;
  } catch (err) {
    console.error('[Sloty] Push subscription error:', err);
    window.pushPermissionDenied = true;
    if (document.getElementById('push-banner-area')) {
       document.getElementById('push-banner-area').innerHTML = renderPushBanner();
    }
    return false;
  }
}

export function renderPushBanner() {
  if (typeof window === 'undefined' || !window.Notification) return '';
  if (Notification.permission === 'granted') return '';

  return `
    <div style="background:rgba(245,197,24,0.12); border:1.5px solid #F5C518; border-radius:18px; padding:12px 18px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
       <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.2rem;">🔔</span>
          <span style="font-size:0.75rem; font-weight:800; color:#1a1a2e;">Activar alertas de garita</span>
       </div>
       <button onclick="if(window.Notification) Notification.requestPermission().then(p => { const a = document.getElementById('push-banner-area'); if(a && p==='granted') a.innerHTML=''; })" style="background:#1a1a2e; color:#F5C518; border:none; padding:8px 14px; border-radius:12px; font-weight:900; font-size:0.65rem; cursor:pointer;">
          ACTIVAR
       </button>
    </div>
  `;
}
