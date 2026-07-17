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
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (isIos && !isStandalone) {
    return `
      <div style="background:#F5C518; color:#1a1a2e; padding:15px; border-radius:18px; margin-bottom:20px; font-weight:700; font-size:0.75rem; text-align:left; display:flex; align-items:start; gap:12px; box-shadow:0 5px 15px rgba(245,197,24,0.3);">
         <span style="font-size:1.5rem; margin-top:2px;">🍎</span>
         <div>
            <div style="font-weight:900; margin-bottom:4px; font-size:0.8rem;">iOS DETECTADO</div>
            Para recibir notificaciones, toca el botón central de "Compartir" en Safari y luego elige <b>"Agregar a Inicio"</b>. Abre la app desde tu pantalla de inicio para activarlas.
         </div>
      </div>
    `;
  }

  if (window.pushPermissionDenied || (window.Notification && Notification.permission !== 'granted')) {
    return `
      <div style="background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; padding:15px; border-radius:18px; margin-bottom:20px; font-weight:700; font-size:0.7rem; text-align:left; display:flex; align-items:start; gap:12px; box-shadow:0 4px 10px rgba(0,0,0,0.02);">
         <span style="font-size:1.5rem; margin-top:2px;">🔔</span>
         <div>
            <div style="font-weight:900; margin-bottom:4px; font-size:0.8rem;">NOTIFICACIONES CERRADAS</div>
            Para que la app funcione incluso con la pantalla apagada, debes permitir los avisos. Toca el candado en tu navegador (arriba junto a la URL) y dale a <b>Permitir Notificaciones</b>.
            ${!isStandalone && !isIos ? '<br><br><b>Truco Pro:</b> En Chrome pulsa los 3 puntos y dale a "Agregar a Pantalla Principal" para una mejor experiencia.' : ''}
         </div>
      </div>
    `;
  }

  return '';
}
