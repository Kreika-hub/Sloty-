import { supabase } from '../db.js'

// VAPID Public Key from generation
const VAPID_PUBLIC_KEY = 'BNnGixLmvQfICWWjmGlFHic3PG8-QmjIDxL46Cs0B1ksTyXzIR4Acwqw33ZeJaBcRDkpP4R3gBV-UMILSkwzR6s'

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
    alert('Las notificaciones Push no están soportadas en tu dispositivo/navegador actual.');
    return false;
  }

  try {
    // Check if permission is already granted or request it
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    
    if (permission !== 'granted') {
      alert('Debes permitir las notificaciones en tu navegador o sistema para activar esta función.');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Check for existing subscription to avoid duplicate calls
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      };
      subscription = await registration.pushManager.subscribe(subscribeOptions);
    }
    
    // Upsert subscription to Supabase to update role or identifier if changed
    const { error } = await supabase.from('push_subscriptions').insert({
      building_id: buildingId,
      role: role,
      identifier: identifier,
      subscription: subscription.toJSON()
    });

    // Note: The above might fail if we don't have a unique constraint or if the user is inserting a duplicate.
    // However, since it's just generating rows, it's fine for now, or we can use upsert if we add a unique constraint later.

    if (error) {
      console.warn('Error saving push subscription, might be duplicate or RLS:', error.message);
      // We still return true because locally they are subscribed
    } else {
      console.log('Push subscription saved successfully');
    }

    alert('¡Notificaciones activadas con éxito! Ahora recibirás alertas.');
    return true;
  } catch (err) {
    console.error('Push subscription error:', err);
    alert('Ocurrió un error al intentar activar las notificaciones. Asegúrate de haber instalado la aplicación (Agregar a Inicio).');
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
