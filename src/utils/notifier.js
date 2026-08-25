/**
 * Notifier Utility — Dispatch free alerts to Sloty Master (Telegram Bot API / WhatsApp)
 * Formats clean payment, upgrade, activation, and rejection notifications.
 */

export const sanitizePhoneNumber = (phone, defaultCountryCode = '58') => {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return '';

  // Manejo de prefijos venezolanos comunes (0412..., 0414..., 0424..., 0416..., 0426...)
  if (cleaned.startsWith('04')) {
    cleaned = defaultCountryCode + cleaned.substring(1);
  } else if (cleaned.startsWith('4') && cleaned.length === 10) {
    cleaned = defaultCountryCode + cleaned;
  } else if (cleaned.length <= 10 && !cleaned.startsWith(defaultCountryCode)) {
    cleaned = defaultCountryCode + cleaned;
  }

  return cleaned;
};

export const generateActivationCode = (length = 6) => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const formatProofWhatsAppMessage = ({
  buildingName,
  buildingCode,
  adminName,
  phone,
  email,
  planLabel,
  amountUsd,
  amountBs,
  bcvRate,
  bank,
  reference,
  proofUrl,
  lat,
  lng,
  city,
  address,
  masterPhone = '584120770776'
}) => {
  const usd = Number(amountUsd || 0).toFixed(2);
  const bs = Number(amountBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rate = Number(bcvRate || 40.0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cleanPhone = sanitizePhoneNumber(masterPhone);

  let locationText = '';
  if (lat && lng) {
    locationText = `📍 *Ubicación GPS:* https://maps.google.com/?q=${lat},${lng}\n`;
  } else if (city || address) {
    locationText = `📍 *Ubicación:* ${[city, address].filter(Boolean).join(' - ')}\n`;
  }

  const messageText = `🔔 *NUEVA SOLICITUD DE CONDIMINIO - SLOTY* 🚗\n\n` +
    `🏢 *Edificio:* ${buildingName || 'Edificio'} (${buildingCode || 'N/A'})\n` +
    `👤 *Administrador:* ${adminName || 'Admin'}\n` +
    `📱 *Teléfono:* ${phone || 'N/A'}\n` +
    `✉️ *Correo:* ${email || 'N/A'}\n` +
    locationText +
    `💎 *Plan Solicitado:* Plan ${planLabel || 'BRONCE'}\n\n` +
    `💵 *Monto USD:* $${usd} USD\n` +
    `🇻🇪 *Equivalente Bs:* Bs. ${bs} (Tasa BCV: Bs. ${rate})\n` +
    `🏦 *Banco/Método:* ${bank || 'Transferencia'}\n` +
    `📝 *Referencia:* ${reference || 'N/A'}\n` +
    `📎 *Comprobante:* ${proofUrl || 'Adjunto en sistema'}\n\n` +
    `_Notificación automática enviada desde Sloty Onboarding._`;

  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
  return { success: true, whatsappUrl, messageText, cleanPhone };
};

export const formatActivationWhatsAppMessage = ({
  buildingName,
  buildingCode,
  planLabel,
  expiryDate,
  activationCode,
  adminPhone,
  appUrl
}) => {
  const cleanPhone = sanitizePhoneNumber(adminPhone);
  const url = appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://sloty.app');
  const dateFormatted = expiryDate ? new Date(expiryDate).toLocaleDateString('es-VE') : '30 días';

  const messageText = `¡Hola! 👋 Te confirmamos que el pago para *${buildingName || 'tu edificio'}* (${buildingCode || ''}) ha sido *APROBADO* con éxito ✅.\n\n` +
    `💎 *Plan Activo:* Plan ${planLabel || 'BRONCE'}\n` +
    `📅 *Vigencia hasta:* ${dateFormatted}\n` +
    `🔑 *Código de Activación:* *${activationCode}*\n\n` +
    `🌐 *Acceso a Sloty:* ${url}\n\n` +
    `¡Gracias por confiar en Sloty! 🚗⚡`;

  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}` : '';
  return { success: true, whatsappUrl, messageText, cleanPhone, activationCode };
};

export const formatRejectionWhatsAppMessage = ({
  buildingName,
  adminName,
  adminPhone,
  planLabel,
  reason
}) => {
  const cleanPhone = sanitizePhoneNumber(adminPhone);
  const messageText = `Hola ${adminName || ''} 👋, te contactamos del equipo de verificación de *Sloty*.\n\n` +
    `Revisamos la solicitud de activación para el condominio *${buildingName || 'tu edificio'}* (Plan ${planLabel || 'BRONCE'}).\n\n` +
    `⚠️ *Estado:* Requiere corrección\n` +
    `📝 *Motivo indicado:* ${reason || 'Comprobante no coincide con los registros bancarios o datos incompletos.'}\n\n` +
    `Por favor, responde a este mensaje para coordinar la verificación y activar tu cuenta a la brevedad. ¡Estamos a tu orden! 🚗`;

  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}` : '';
  return { success: true, whatsappUrl, messageText, cleanPhone };
};

export const notifyMasterPayment = async ({
  buildingName,
  adminName,
  phone,
  email,
  plan,
  amountUsd,
  amountBs,
  bcvRate,
  method,
  reference,
  lat,
  lng,
  city,
  address
}) => {
  const dateStr = new Date().toLocaleString('es-VE');
  const usd = Number(amountUsd || 0).toFixed(2);
  const bs = Number(amountBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });
  const rate = Number(bcvRate || 40.0).toFixed(2);

  let locationText = '';
  if (lat && lng) {
    locationText = `📍 *GPS:* https://maps.google.com/?q=${lat},${lng}\n`;
  } else if (city || address) {
    locationText = `📍 *Ubicación:* ${[city, address].filter(Boolean).join(' - ')}\n`;
  }

  const messageText = `🔔 *¡NUEVA SOLICITUD DE REGISTRO!* 🚀\n\n` +
    `🏢 *Condominio:* ${buildingName || 'Sin nombre'}\n` +
    `👤 *Administrador:* ${adminName || 'Admin'}\n` +
    `📱 *Contacto:* ${phone || 'N/A'}\n` +
    `✉️ *Correo:* ${email || 'N/A'}\n` +
    locationText +
    `💎 *Plan:* Plan ${plan || 'TRIAL'}\n\n` +
    `💵 *Monto USD:* $${usd}\n` +
    `🇻🇪 *Monto Bs:* Bs. ${bs}\n` +
    `📊 *Tasa BCV:* Bs. ${rate}\n` +
    `💳 *Método:* ${method || 'EFECTIVO'}\n` +
    `📝 *Referencia:* ${reference || 'N/A'}\n` +
    `🕒 *Fecha:* ${dateStr}\n\n` +
    `_Notificación automática de Sloty Core._`;

  console.log('[Sloty Notifier] Alert payload:\n', messageText);

  // 1. Enviar a Telegram si existe configuración en variables de entorno o localStorage
  try {
    const botToken = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_BOT_TOKEN) || (typeof localStorage !== 'undefined' && localStorage.getItem('sloty_telegram_bot_token'));
    const chatId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_CHAT_ID) || (typeof localStorage !== 'undefined' && localStorage.getItem('sloty_telegram_chat_id'));

    if (botToken && chatId) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'Markdown'
        })
      }).catch(err => console.warn('[Sloty Notifier] Telegram API dispatch notice:', err));
    }
  } catch (e) {
    console.warn('[Sloty Notifier] Error during Telegram dispatch:', e);
  }

  // 2. Fallback / WhatsApp link generator
  const masterPhone = '584120770776';
  const cleanPhone = sanitizePhoneNumber(masterPhone);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
  return { success: true, whatsappUrl, messageText };
};

export const showTermsModal = (onAccept = null) => {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('terms-modal-overlay');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'terms-modal-overlay';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px); display: flex; align-items: center;
    justify-content: center; z-index: 10002; padding: 20px;
    font-family: 'Montserrat', sans-serif;
  `;

  modal.innerHTML = `
    <div style="background: #1a1a2e; border: 1.5px solid rgba(245, 197, 24, 0.3); border-radius: 28px; width: 100%; max-width: 520px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6); color: white;">
      
      <!-- HEADER -->
      <div style="padding: 24px 24px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.5rem;">📜</span>
          <h2 style="margin: 0; font-size: 1.1rem; font-weight: 900; color: #F5C518; text-transform: uppercase; letter-spacing: 1px;">Términos y Condiciones</h2>
        </div>
        <button id="btn-close-terms-x" style="background: none; border: none; color: #999; font-size: 1.5rem; cursor: pointer; line-height: 1; padding: 0 4px;">&times;</button>
      </div>

      <!-- BODY CON SCROLL -->
      <div style="padding: 24px; overflow-y: auto; flex: 1; font-size: 0.85rem; line-height: 1.6; color: rgba(255, 255, 255, 0.85);">
        
        <div style="background: rgba(245, 197, 24, 0.06); border-left: 3px solid #F5C518; padding: 12px 14px; border-radius: 0 12px 12px 0; margin-bottom: 20px; font-size: 0.75rem; color: #F5C518; font-weight: 700;">
          Por favor, lee detenidamente los términos y condiciones de uso de la plataforma Sloty antes de continuar con la operación de tu condominio o estacionamiento.
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 14px 16px;">
            <div style="font-weight: 900; color: white; margin-bottom: 4px; font-size: 0.9rem;">1. Objeto del Servicio</div>
            <div style="color: rgba(255, 255, 255, 0.75);">
              Sloty es una solución tecnológica diseñada para la gestión inteligente de estacionamientos, control de accesos vehiculares, asignación de puestos, control de solvencias y administración operativa en entornos residenciales y comerciales.
            </div>
          </div>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 14px 16px;">
            <div style="font-weight: 900; color: white; margin-bottom: 4px; font-size: 0.9rem;">2. Responsabilidad de Cuenta y Custodia</div>
            <div style="color: rgba(255, 255, 255, 0.75);">
              El cliente garantiza la veracidad de los datos suministrados durante el registro del inmueble y es el único responsable de la debida custodia de las credenciales, códigos de acceso y PINs de seguridad asignados al personal de guardia y operadores.
            </div>
          </div>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 14px 16px;">
            <div style="font-weight: 900; color: white; margin-bottom: 4px; font-size: 0.9rem;">3. Tarifas, Moneda y Activación</div>
            <div style="color: rgba(255, 255, 255, 0.75);">
              Las tarifas de los planes de membresía están expresadas en USD con opción de pago en Bolívares (Bs.) calculados a la tasa oficial del Banco Central de Venezuela (BCV) correspondiente al día del pago. Todo pago mediante comprobante está sujeto a verificación administrativa previa a su activación.
            </div>
          </div>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 14px 16px;">
            <div style="font-weight: 900; color: white; margin-bottom: 4px; font-size: 0.9rem;">4. Operación Offline y Resiliencia</div>
            <div style="color: rgba(255, 255, 255, 0.75);">
              Sloty cuenta con arquitectura PWA y almacenamiento local seguro para continuar operando en caso de caídas de conexión a Internet. Las operaciones locales se sincronizan automáticamente con la nube una vez restablecido el enlace de red.
            </div>
          </div>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 14px 16px;">
            <div style="font-weight: 900; color: white; margin-bottom: 4px; font-size: 0.9rem;">5. Privacidad y Protección de Datos</div>
            <div style="color: rgba(255, 255, 255, 0.75);">
              La información de vehículos, placas, residentes y movimientos es de carácter confidencial y de uso exclusivo para la gestión del respectivo condominio o empresa operadora, sin cesión ni comercialización a terceros bajo ningún concepto.
            </div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="padding: 16px 24px 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; gap: 10px;">
        <button id="btn-accept-terms" style="flex: 1; padding: 16px; background: #F5C518; color: #1a1a2e; border: none; border-radius: 14px; font-weight: 900; font-size: 0.9rem; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;">
          Entendido y Acepto
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.remove();
  };

  modal.querySelector('#btn-close-terms-x').onclick = closeModal;
  modal.querySelector('#btn-accept-terms').onclick = () => {
    if (typeof onAccept === 'function') onAccept();
    closeModal();
  };
};
