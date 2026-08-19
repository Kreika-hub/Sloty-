/**
 * Notifier Utility — Dispatch free alerts to Sloty Master (Telegram Bot API / WhatsApp)
 * Formats clean payment and upgrade notifications.
 */

export const notifyMasterPayment = async ({
  buildingName,
  adminName,
  phone,
  plan,
  amountUsd,
  amountBs,
  bcvRate,
  method,
  reference
}) => {
  const dateStr = new Date().toLocaleString('es-VE');
  const usd = Number(amountUsd || 0).toFixed(2);
  const bs = Number(amountBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });
  const rate = Number(bcvRate || 40.0).toFixed(2);

  const messageText = `🔔 *¡PAGO DE PLAN REGISTRADO!* 🚀\n\n` +
    `🏢 *Condominio:* ${buildingName || 'Sin nombre'}\n` +
    `👤 *Administrador:* ${adminName || 'Admin'}\n` +
    `📱 *Contacto:* ${phone || 'N/A'}\n` +
    `💎 *Plan:* Plan ${plan || 'TRIAL'}\n\n` +
    `💵 *Monto USD:* $${usd}\n` +
    `🇻🇪 *Monto Bs:* Bs. ${bs}\n` +
    `📊 *Tasa BCV:* Bs. ${rate}\n` +
    `💳 *Método:* ${method || 'EFECTIVO'}\n` +
    `📝 *Referencia:* ${reference || 'N/A'}\n` +
    `🕒 *Fecha:* ${dateStr}\n\n` +
    `_Notificación automática de Sloty Core._`;

  console.log('[Sloty Notifier] Alert payload:\n', messageText);

  // 1. Enviar a Telegram si existe configuración en localStorage o variables de sistema
  try {
    const botToken = localStorage.getItem('sloty_telegram_bot_token') || '8143219419:AAH7aJk6Xz714h820gq7Y5y2c3K1w8';
    const chatId = localStorage.getItem('sloty_telegram_chat_id') || '-1002345678901';

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
  const whatsappUrl = `https://wa.me/${masterPhone}?text=${encodeURIComponent(messageText)}`;
  return { success: true, whatsappUrl, messageText };
};
