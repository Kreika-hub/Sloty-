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
      showToast('Permiso de notificaciones denegado', 'error');
      return false;
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
    showToast('Error al activar notificaciones. Instala la app primero.', 'error');
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
            Para recibir notificaciones, toca el botón de "Compartir" en Safari y luego elige <b>"Agregar a Inicio"</b>. Abre la app desde tu pantalla de inicio para activarlas.
         </div>
      </div>
    `;
  }
  return '';
}
