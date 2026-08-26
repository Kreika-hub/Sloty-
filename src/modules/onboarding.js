/**
 * Onboarding Module v4 — Conversational Chat Wizard with Slot Mascot
 * Sloty | Renovación Comercial: Captura de Datos, Geolocalización,
 * Transparencia Cambiaria BCV (TTL 6h), Validación Estricta y Despacho a Bóveda Master.
 */

import { escapeHTML } from '../utils/sanitize.js'
import { supabase, saveParkingState, getExchangeRate, isUUID } from '../db.js'
import { formatProofWhatsAppMessage, notifyMasterPayment, showTermsModal, sanitizePhoneNumber } from '../utils/notifier.js'

// ================================================================
// AUTO-SAVE WIZARD STATE (TTL 24h)
// ================================================================
const WIZARD_SAVE_KEY = 'sloty_wizard_draft';
const WIZARD_SAVE_TTL = 24 * 60 * 60 * 1000; // 24 horas

function saveWizardState(wizard) {
  try {
    const payload = {
      step: wizard.step,
      name: wizard.name,
      email: wizard.email,
      phone: wizard.phone,
      buildingName: wizard.buildingName,
      floors: wizard.floors,
      slots: wizard.slots,
      lat: wizard.lat,
      lng: wizard.lng,
      city: wizard.city,
      address: wizard.address,
      selectedPlanId: wizard.selectedPlan?.id || 'PLATA',
      paymentMethod: wizard.paymentMethod,
      bcvRate: wizard.bcvRate,
      bcvWarning: wizard.bcvWarning,
      timestamp: Date.now()
    };
    localStorage.setItem(WIZARD_SAVE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[Sloty] No se pudo guardar borrador:', e);
  }
}

function loadWizardState() {
  try {
    const raw = localStorage.getItem(WIZARD_SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const age = Date.now() - (data.timestamp || 0);
    if (age > WIZARD_SAVE_TTL) {
      localStorage.removeItem(WIZARD_SAVE_KEY);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

function clearWizardState() {
  localStorage.removeItem(WIZARD_SAVE_KEY);
}

// ================================================================
// CONSTANTES Y CONFIGURACIÓN DE PLANES (SIN IVA)
// ================================================================
export const PLANS = [
  {
    id: 'TRIAL',
    name: 'Prueba Gratuita',
    price: 0,
    period: '/14 días',
    description: 'Prueba las funciones esenciales en tu condominio sin costo',
    icon: '✨',
    color: '#888',
    maxSlots: 15,
    features: [
      'Control básico de estacionamiento',
      'Panel guardia esencial',
      'Hasta 15 puestos registrados',
      'Prueba de 14 días sin compromiso'
    ],
    limitations: [
      'Sin módulos multinivel ni WhatsApp',
      'Sin bitácora de auditoría'
    ],
    recommended: false,
    cta: 'Elegir Prueba Gratis'
  },
  {
    id: 'BRONCE',
    name: 'Bronce',
    price: 180,
    period: '/mes',
    description: 'Ideal para condominios pequeños y primeros pasos operativos',
    icon: '🥉',
    color: '#cd7f32',
    maxSlots: 30,
    features: [
      'Control de estacionamiento completo',
      'Panel guardia offline resiliente',
      'Panel residente y abonos',
      'Reporte financiero y control de deudas'
    ],
    limitations: [
      'Sin multinivel ni alertas WhatsApp',
      'Sin bitácora avanzada de auditoría'
    ],
    recommended: false,
    cta: 'Elegir Bronce'
  },
  {
    id: 'PLATA',
    name: 'Plata',
    price: 250,
    period: '/mes',
    description: 'Perfecto para edificios medianos con múltiples niveles',
    icon: '🥈',
    color: '#F5C518',
    maxSlots: 150,
    features: [
      'Todo lo de Bronce',
      'Módulos Multinivel',
      'Gestión de Visitantes frecuentes',
      'Alertas automatizadas por WhatsApp'
    ],
    limitations: [
      'Sin bitácora de auditoría ni cartelera'
    ],
    recommended: true,
    cta: 'Elegir Plata',
    badge: 'Más elegido'
  },
  {
    id: 'ORO',
    name: 'Oro',
    price: 380,
    period: '/mes',
    description: 'Para grandes operaciones sin límites de crecimiento',
    icon: '🥇',
    color: '#ffd700',
    maxSlots: 'Ilimitados',
    features: [
      'Todo lo de Plata',
      'Bitácora integral de auditoría',
      'Cartelera de Anuncios y Noticias',
      'Soporte prioritario 24/7'
    ],
    limitations: [],
    recommended: false,
    cta: 'Elegir Oro'
  }
];

// ================================================================
// CONFIGURACIÓN DE PAGOS (dinámica desde Supabase)
// ================================================================
let cachedPaymentConfig = null;
let paymentConfigTimestamp = 0;
const PAYMENT_CONFIG_TTL = 5 * 60 * 1000; // 5 minutos de cache

export async function getPaymentConfig(supabaseClient) {
  const now = Date.now();
  if (cachedPaymentConfig && (now - paymentConfigTimestamp) < PAYMENT_CONFIG_TTL) {
    return cachedPaymentConfig;
  }

  try {
    const { data, error } = await supabaseClient
      .from('system_config')
      .select('payment_methods')
      .eq('id', 'global')
      .single();

    if (error || !data?.payment_methods) {
      console.warn('[Sloty] No se pudo cargar config de pagos, usando fallback:', error);
      return {
        PAGO_MOVIL: {
          bank: 'Banco Exterior',
          bank_code: '0115',
          id_card: 'V-27031049',
          phone: '04129135799',
          holder: 'Sloty Technologies'
        },
        ZELLE: {
          holder: 'Sloty Technologies',
          email: 'pagos@slotyapp.com'
        }
      };
    }

    cachedPaymentConfig = data.payment_methods;
    paymentConfigTimestamp = now;
    return cachedPaymentConfig;
  } catch (err) {
    console.warn('[Sloty] Error cargando config de pagos:', err);
    return cachedPaymentConfig || {
      PAGO_MOVIL: {
        bank: 'Banco Exterior',
        bank_code: '0115',
        id_card: 'V-27031049',
        phone: '04129135799',
        holder: 'Sloty Technologies'
      },
      ZELLE: {
        holder: 'Sloty Technologies',
        email: 'pagos@slotyapp.com'
      }
    };
  }
}

// ================================================================
// RESILIENCIA DE TASA BCV (CACHE TTL 6 HORAS)
// ================================================================
const BCV_CACHE_KEY = 'sloty_bcv_rate_cache';
const BCV_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas

export async function getExchangeRateWithFallback() {
  try {
    const rawRate = await getExchangeRate();
    const rate = typeof rawRate === 'object' ? Number(rawRate?.rate || 40.0) : Number(rawRate || 40.0);
    
    if (rate && !isNaN(rate) && rate > 0) {
      localStorage.setItem(BCV_CACHE_KEY, JSON.stringify({
        rate,
        timestamp: Date.now()
      }));
      return { rate, cached: false, warning: false };
    }
  } catch (err) {
    console.warn('[Sloty BCV] Error cargando tasa en vivo, usando cache:', err);
  }

  // Fallback 1: Cache local válido (< 6h)
  try {
    const cached = localStorage.getItem(BCV_CACHE_KEY);
    if (cached) {
      const { rate, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      if (rate && !isNaN(rate) && age < BCV_CACHE_TTL) {
        return { rate, cached: true, warning: false, cacheAgeHours: Math.round(age / 3600000) };
      }
      if (rate && !isNaN(rate)) {
        return { rate, cached: true, warning: true, cacheAgeHours: Math.round(age / 3600000) };
      }
    }
  } catch (e) {
    console.warn('[Sloty BCV] Error leyendo cache:', e);
  }

  // Fallback 2: Tasa fija de contingencia
  return { rate: 40.0, cached: true, warning: true, fallback: true };
}

// ================================================================
// VALIDACIONES DE ENTRADA Y RATE LIMITING
// ================================================================
export function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(String(email || '').trim());
}

export function validateVenezuelanPhone(phone) {
  const clean = String(phone || '').replace(/[\s\-()]/g, '');
  // Formatos válidos: 0412..., +58412..., 58412..., 412...
  const regex = /^(\+?58)?0?4(12|14|16|24|26)[0-9]{7}$/;
  return regex.test(clean);
}

export function validateReceiptFile(file) {
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const MAX_SIZE_MB = 5;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  if (!file) {
    return { valid: false, error: 'El comprobante de pago es obligatorio.' };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Tipo de archivo no permitido. Solo imágenes (JPG, PNG, WebP) o documentos PDF.' };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: `El archivo supera el límite permitido de ${MAX_SIZE_MB}MB.` };
  }
  return { valid: true };
}

/**
 * Rate limiting en cliente (Máximo 3 intentos cada 10 minutos).
 * [DEUDA TÉCNICA DOCUMENTADA]: Este control en cliente es burlable borrando localStorage.
 * Para producción estricta se incorpora el campo `ip_address` en subscription_requests
 * para rate-limiting en Edge Functions de backend.
 */
function checkClientRateLimit() {
  const KEY = 'sloty_submission_attempts';
  const WINDOW_MS = 10 * 60 * 1000;
  const MAX_ATTEMPTS = 3;

  try {
    const raw = localStorage.getItem(KEY);
    const now = Date.now();
    let history = raw ? JSON.parse(raw) : [];
    history = history.filter(ts => now - ts < WINDOW_MS);

    if (history.length >= MAX_ATTEMPTS) {
      return { allowed: false, remainingMins: Math.ceil((WINDOW_MS - (now - history[0])) / 60000) };
    }

    history.push(now);
    localStorage.setItem(KEY, JSON.stringify(history));
    return { allowed: true };
  } catch (e) {
    return { allowed: true };
  }
}

// ================================================================
// ESTADO Y UTILIDADES DEL ONBOARDING
// ================================================================
export const shouldShowOnboarding = (state) => {
  if (!state) return false;
  if (state.onboarding_completed) return false;
  const isFirstLogin = localStorage.getItem(`sloty_first_login_${state.buildingId}`) === 'true' || state.is_first_login === true;
  const hasNoLevels = !state.levels || state.levels.length === 0;
  const hasNoPersonnel = !state.personnel || state.personnel.length === 0;
  return isFirstLogin || (hasNoLevels && hasNoPersonnel);
};

export const markOnboardingComplete = (state) => {
  state.onboarding_completed = true;
  state.is_first_login = false;
  localStorage.setItem(`sloty_first_login_${state.buildingId}`, 'false');
  saveParkingState(state);

  if (state.buildingId && !state.isBypass && isUUID(state.buildingId)) {
    supabase.from('buildings').update({ is_first_login: false }).eq('id', state.buildingId)
      .then(() => console.log('[Sloty Onboarding] Flag is_first_login updated in DB'))
      .catch(err => console.warn('[Sloty Onboarding] Failed to update is_first_login in DB:', err));
  }
};

export const generateBuildingCode = (name) => {
  if (!name || typeof name !== 'string') return 'SLO-' + Math.floor(1000 + Math.random() * 9000);
  
  const clean = name.trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, '');

  const words = clean.split(/\s+/).filter(Boolean);
  const stopWords = ['DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'EN', 'Y', 'EDIFICIO', 'RESIDENCIAS', 'TORRE', 'CONDOMINIO', 'CENTRO', 'CC'];
  const keyWords = words.filter(w => !stopWords.includes(w));

  let prefix = '';
  if (keyWords.length > 0) {
    prefix = keyWords[0].slice(0, 4);
  } else if (words.length > 0) {
    prefix = words[0].slice(0, 4);
  } else {
    prefix = 'EDIF';
  }

  if (prefix.length < 3) {
    prefix = (prefix + 'BLD').slice(0, 3);
  }

  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
};

// [NUEVO] Genera código único verificando contra la base de datos
export async function generateUniqueBuildingCode(name, supabaseClient) {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateBuildingCode(name);

    try {
      const { data } = await supabaseClient
        .from('buildings')
        .select('id')
        .eq('code', code)
        .maybeSingle();

      if (!data) {
        return code; // Código único encontrado
      }
    } catch (err) {
      console.warn('[Sloty] Error verificando unicidad del código:', err);
      // Si falla la query, devolvemos el código con sufijo de timestamp para evitar colisión
      return `${generateBuildingCode(name)}-${Date.now().toString().slice(-4)}`;
    }

    attempts++;
  }

  // Si después de 10 intentos no encontramos uno único, usamos timestamp
  const base = generateBuildingCode(name);
  return `${base}-${Date.now().toString().slice(-4)}`;
}

// ================================================================
// SLOT SVG MASCOTA
// ================================================================
const getSlotAvatarSVG = (expression = 'happy') => {
  const expressions = {
    normal: `<circle cx="28" cy="22" r="2.5" fill="#1a1a2e"/><circle cx="36" cy="22" r="2.5" fill="#1a1a2e"/><path d="M 26 28 Q 32 32 38 28" stroke="#1a1a2e" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    happy: `<circle cx="28" cy="22" r="2.5" fill="#1a1a2e"/><circle cx="36" cy="22" r="2.5" fill="#1a1a2e"/><path d="M 25 27 Q 32 35 39 27" stroke="#1a1a2e" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    excited: `<circle cx="28" cy="22" r="2.5" fill="#1a1a2e"/><circle cx="36" cy="22" r="2.5" fill="#1a1a2e"/><path d="M 25 27 Q 32 35 39 27" stroke="#1a1a2e" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M 22 20 L 24 22 M 42 20 L 40 22" stroke="#1a1a2e" stroke-width="1.5" stroke-linecap="round"/>`,
    talking: `<circle cx="28" cy="22" r="2.5" fill="#1a1a2e"/><circle cx="36" cy="22" r="2.5" fill="#1a1a2e"/><ellipse cx="32" cy="29" rx="3.5" ry="4.5" fill="#1a1a2e"/>`,
    thinking: `<circle cx="28" cy="22" r="2.5" fill="#1a1a2e"/><circle cx="36" cy="22" r="2.5" fill="#1a1a2e"/><path d="M 28 29 Q 32 27 36 29" stroke="#1a1a2e" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
  };

  return `
    <svg width="40" height="40" viewBox="0 0 64 48" style="flex-shrink:0;">
      <defs>
        <linearGradient id="slotAvatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#F5C518"/>
          <stop offset="100%" style="stop-color:#e6a800"/>
        </linearGradient>
      </defs>
      <rect x="14" y="8" width="36" height="30" rx="9" fill="url(#slotAvatarGrad)" stroke="#1a1a2e" stroke-width="1.5"/>
      <line x1="32" y1="8" x2="32" y2="2" stroke="#1a1a2e" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="32" cy="2" r="2" fill="#ff6b6b" stroke="#1a1a2e" stroke-width="1"/>
      ${expressions[expression] || expressions.happy}
    </svg>
  `;
};

// ================================================================
// INYECCIÓN DE ESTILOS CHAT
// ================================================================
const injectChatStyles = () => {
  if (document.getElementById('sloty-chat-onboarding-styles')) return;
  const style = document.createElement('style');
  style.id = 'sloty-chat-onboarding-styles';
  style.textContent = `
    @keyframes slotyFadeSlide {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slotyPulseDot {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1.1); opacity: 1; }
    }
    .sloty-chat-msg {
      animation: slotyFadeSlide 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .sloty-plan-card {
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
    }
    .sloty-plan-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 25px rgba(245,197,24,0.15);
    }
    .sloty-plan-card.selected {
      border: 2px solid #F5C518 !important;
      background: rgba(245,197,24,0.08) !important;
    }
  `;
  document.head.appendChild(style);
};

// ================================================================
// WIZARD CONVERSACIONAL PRINCIPAL
// ================================================================
export const renderOnboardingWizard = async (container, state, onComplete) => {
  injectChatStyles();
  container.innerHTML = '';

  // Estado del Wizard
  const wizard = {
    step: 1,
    name: '',
    email: '',
    phone: '',
    buildingName: '',
    floors: 1,
    slots: 30,
    lat: null,
    lng: null,
    city: '',
    address: '',
    selectedPlan: PLANS[2], // Plata por defecto ($250)
    paymentMethod: 'PAGO_MOVIL',
    bcvRate: 40.0,
    bcvWarning: false,
    proofFile: null,
    proofUrl: null
  };

  // [FIX 1] Cargar borrador si existe
  const draft = loadWizardState();
  if (draft) {
    wizard.step = draft.step || 1;
    wizard.name = draft.name || '';
    wizard.email = draft.email || '';
    wizard.phone = draft.phone || '';
    wizard.buildingName = draft.buildingName || '';
    wizard.floors = draft.floors || 1;
    wizard.slots = draft.slots || 30;
    wizard.lat = draft.lat || null;
    wizard.lng = draft.lng || null;
    wizard.city = draft.city || '';
    wizard.address = draft.address || '';
    wizard.selectedPlan = PLANS.find(p => p.id === draft.selectedPlanId) || PLANS[2];
    wizard.paymentMethod = draft.paymentMethod || 'PAGO_MOVIL';
    wizard.bcvRate = draft.bcvRate || 40.0;
    wizard.bcvWarning = draft.bcvWarning || false;
  }

  // Cargar Tasa BCV con Fallback y Cache TTL de 6h
  const bcvData = await getExchangeRateWithFallback();
  wizard.bcvRate = bcvData.rate;
  wizard.bcvWarning = Boolean(bcvData.warning);

  const wrapper = document.createElement('div');
  wrapper.id = 'sloty-chat-container';
  wrapper.style.cssText = `
    position: fixed; inset: 0; background: #1a1a2e; z-index: 9999;
    display: flex; flex-direction: column; font-family: 'Montserrat', sans-serif;
    color: white; overflow: hidden;
  `;

  wrapper.innerHTML = `
    <!-- HEADER -->
    <div style="padding: 16px 20px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="/sloty-logo-v2.png" alt="Sloty" style="height: 28px; width: auto;" />
        <div>
          <div style="font-size: 0.85rem; font-weight: 900; color: white; display: flex; align-items: center; gap: 6px;">
            <span>Slot Asistente</span>
            <span style="width: 8px; height: 8px; background: #22c55e; border-radius: 50%; display: inline-block;"></span>
          </div>
          <div style="font-size: 0.65rem; color: #F5C518; font-weight: 700;">
            Tasa Oficial BCV: <b>Bs. ${wizard.bcvRate.toFixed(2)}</b> / USD
            ${wizard.bcvWarning ? '<span style="color:#f59e0b; margin-left:4px;">(Referencial)</span>' : ''}
          </div>
        </div>
      </div>
      <button id="btn-close-onboarding" style="background: rgba(255,255,255,0.08); border: none; color: #aaa; width: 32px; height: 32px; border-radius: 50%; font-weight: 900; cursor: pointer;">✕</button>
    </div>

    <!-- [FIX 4] BARRA DE PROGRESO -->
    <div id="wizard-progress-bar" style="background: rgba(0,0,0,0.4); padding: 10px 20px; flex-shrink: 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span id="wizard-progress-text" style="font-size: 0.65rem; color: #F5C518; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
          Paso 1 de 6
        </span>
        <span id="wizard-progress-pct" style="font-size: 0.65rem; color: rgba(255,255,255,0.5); font-weight: 700;">
          16%
        </span>
      </div>
      <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;">
        <div id="wizard-progress-fill" style="width: 16.6%; height: 100%; background: #F5C518; border-radius: 2px; transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);"></div>
      </div>
    </div>

    <!-- AREA DE MENSAJES -->
    <div id="sloty-chat-timeline" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
      <!-- Mensajes dinámicos aquí -->
    </div>

    <!-- AREA DE ENTRADA Y ACCIONES -->
    <div id="sloty-chat-input-bar" style="padding: 16px 20px; background: #0f1127; border-top: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;">
      <!-- Controles dinámicos -->
    </div>
  `;

  container.appendChild(wrapper);

  const timeline = wrapper.querySelector('#sloty-chat-timeline');
  const inputBar = wrapper.querySelector('#sloty-chat-input-bar');

  // [FIX 3] Reemplazar confirm() por showSlotyConfirm al salir
  const showSlotyAlert = ({ title, message, icon = 'ℹ️', buttonText = 'ENTENDIDO', onClose }) => {
    const existing = document.getElementById('sloty-alert-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'sloty-alert-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
      z-index: 100000; display: flex; align-items: center; justify-content: center;
      padding: 20px; font-family: 'Montserrat', sans-serif; animation: slotyFadeSlide 0.2s ease;
    `;
    modal.innerHTML = `
      <div style="background: #1a1a2e; border-radius: 24px; padding: 28px 24px; width: 100%; max-width: 360px;
                  text-align: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 25px 60px rgba(0,0,0,0.6);">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">${icon}</div>
        <div style="font-size: 1.1rem; font-weight: 900; color: white; margin-bottom: 8px;">${escapeHTML(title)}</div>
        <div style="font-size: 0.8rem; color: rgba(255,255,255,0.7); line-height: 1.5; margin-bottom: 24px;">${escapeHTML(message)}</div>
        <button id="sloty-alert-btn" style="width: 100%; padding: 14px; background: #F5C518; color: #1a1a2e;
                    border: none; border-radius: 14px; font-weight: 900; font-size: 0.85rem; cursor: pointer;
                    text-transform: uppercase; letter-spacing: 0.5px;">
          ${escapeHTML(buttonText)}
        </button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#sloty-alert-btn').onclick = () => {
      modal.remove();
      if (onClose) onClose();
    };
  };

  const showSlotyConfirm = ({ title, message, icon = '⚠️', confirmText = 'CONFIRMAR', cancelText = 'CANCELAR', onConfirm, onCancel }) => {
    const existing = document.getElementById('sloty-confirm-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'sloty-confirm-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
      z-index: 100000; display: flex; align-items: center; justify-content: center;
      padding: 20px; font-family: 'Montserrat', sans-serif; animation: slotyFadeSlide 0.2s ease;
    `;
    modal.innerHTML = `
      <div style="background: #1a1a2e; border-radius: 24px; padding: 28px 24px; width: 100%; max-width: 360px;
                  text-align: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 25px 60px rgba(0,0,0,0.6);">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">${icon}</div>
        <div style="font-size: 1.1rem; font-weight: 900; color: white; margin-bottom: 8px;">${escapeHTML(title)}</div>
        <div style="font-size: 0.8rem; color: rgba(255,255,255,0.7); line-height: 1.5; margin-bottom: 24px;">${escapeHTML(message)}</div>
        <div style="display: flex; gap: 10px;">
          <button id="sloty-confirm-cancel" style="flex: 1; padding: 14px; background: rgba(255,255,255,0.08);
                      color: white; border: none; border-radius: 12px; font-weight: 900; font-size: 0.75rem;
                      cursor: pointer; text-transform: uppercase;">
            ${escapeHTML(cancelText)}
          </button>
          <button id="sloty-confirm-ok" style="flex: 1.5; padding: 14px; background: #e63946;
                      color: white; border: none; border-radius: 12px; font-weight: 900; font-size: 0.75rem;
                      cursor: pointer; text-transform: uppercase;">
            ${escapeHTML(confirmText)}
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#sloty-confirm-cancel').onclick = () => {
      modal.remove();
      if (onCancel) onCancel();
    };
    modal.querySelector('#sloty-confirm-ok').onclick = () => {
      modal.remove();
      if (onConfirm) onConfirm();
    };
  };

  wrapper.querySelector('#btn-close-onboarding').onclick = () => {
    showSlotyConfirm({
      title: '¿Salir del registro?',
      message: 'Tu progreso se guardará automáticamente y podrás continuar después.',
      icon: '🚪',
      confirmText: 'SÍ, SALIR',
      cancelText: 'SEGUIR AQUÍ',
      onConfirm: () => {
        saveWizardState(wizard);
        wrapper.remove();
        if (onComplete) onComplete();
      }
    });
  };

  // [FIX 4] Helper para actualizar progreso
  const TOTAL_STEPS = 6;
  const updateProgress = (currentStep) => {
    const progressText = document.getElementById('wizard-progress-text');
    const progressPct = document.getElementById('wizard-progress-pct');
    const progressFill = document.getElementById('wizard-progress-fill');
    if (!progressText || !progressFill) return;

    const pct = Math.round((currentStep / TOTAL_STEPS) * 100);
    progressText.textContent = `Paso ${currentStep} de ${TOTAL_STEPS}`;
    if (progressPct) progressPct.textContent = `${pct}%`;
    progressFill.style.width = `${pct}%`;

    if (pct >= 80) {
      progressFill.style.background = '#22c55e'; // Verde al final
    } else {
      progressFill.style.background = '#F5C518'; // Amarillo en el proceso
    }
  };

  // [FIX 2] Helper de navegación bidireccional
  const goToStep = (targetStep) => {
    wizard.step = targetStep;
    saveWizardState(wizard);
    timeline.innerHTML = ''; // Limpiar chat para reconstruir
    switch (targetStep) {
      case 1: startStep1(); break;
      case 2: startStep2(); break;
      case 3: startStep3(); break;
      case 4: startStep4Location(); break;
      case 5: startStep5PlanSelection(); break;
      case 6: startStep6Payment(); break;
      default: startStep1();
    }
  };

  const renderBackButton = (currentStep) => {
    if (currentStep <= 1) return '';
    return `
      <button id="btn-wizard-back" type="button"
        style="padding: 10px 14px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
               border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; font-weight: 800;
               font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 6px;
               margin-bottom: 8px; width: fit-content;">
        ← Volver al paso anterior
      </button>
    `;
  };

  const attachBackHandler = (currentStep) => {
    const backBtn = document.getElementById('btn-wizard-back');
    if (backBtn) {
      backBtn.onclick = () => {
        appendUserBubble('← Volver');
        goToStep(currentStep - 1);
      };
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      timeline.scrollTop = timeline.scrollHeight;
    }, 50);
  };

  // Helper para burbuja de Slot con indicador de escritura
  const appendSlotBubble = (htmlContent, expression = 'happy', callback = null) => {
    const typingId = 'sloty-typing-' + Date.now();
    const typingEl = document.createElement('div');
    typingEl.id = typingId;
    typingEl.className = 'sloty-chat-msg';
    typingEl.style.cssText = 'display: flex; gap: 12px; align-items: flex-start; max-width: 85%;';
    typingEl.innerHTML = `
      ${getSlotAvatarSVG(expression)}
      <div style="background: rgba(255,255,255,0.08); border-radius: 18px 18px 18px 4px; padding: 14px 18px; border: 1px solid rgba(255,255,255,0.05); display: flex; gap: 4px; align-items: center;">
        <span style="width: 6px; height: 6px; background: #F5C518; border-radius: 50%; animation: slotyPulseDot 1.4s infinite 0.1s;"></span>
        <span style="width: 6px; height: 6px; background: #F5C518; border-radius: 50%; animation: slotyPulseDot 1.4s infinite 0.3s;"></span>
        <span style="width: 6px; height: 6px; background: #F5C518; border-radius: 50%; animation: slotyPulseDot 1.4s infinite 0.5s;"></span>
      </div>
    `;
    timeline.appendChild(typingEl);
    scrollToBottom();

    setTimeout(() => {
      typingEl.remove();
      const msgEl = document.createElement('div');
      msgEl.className = 'sloty-chat-msg';
      msgEl.style.cssText = 'display: flex; gap: 12px; align-items: flex-start; max-width: 88%;';
      msgEl.innerHTML = `
        ${getSlotAvatarSVG(expression)}
        <div style="background: rgba(255,255,255,0.08); border-radius: 18px 18px 18px 4px; padding: 14px 18px; border: 1px solid rgba(255,255,255,0.06); font-size: 0.85rem; line-height: 1.5; color: white;">
          ${htmlContent}
        </div>
      `;
      timeline.appendChild(msgEl);
      scrollToBottom();
      if (callback) callback(msgEl);
    }, 450);
  };

  // Helper para respuesta del usuario
  const appendUserBubble = (text) => {
    const msgEl = document.createElement('div');
    msgEl.className = 'sloty-chat-msg';
    msgEl.style.cssText = 'display: flex; justify-content: flex-end; margin-left: auto; max-width: 80%;';
    msgEl.innerHTML = `
      <div style="background: #F5C518; color: #1a1a2e; border-radius: 18px 18px 4px 18px; padding: 12px 18px; font-weight: 700; font-size: 0.85rem; line-height: 1.4; box-shadow: 0 4px 12px rgba(245,197,24,0.2);">
        ${escapeHTML(text)}
      </div>
    `;
    timeline.appendChild(msgEl);
    scrollToBottom();
  };

  // ================================================================
  // PASOS CONVERSACIONALES
  // ================================================================

  // PASO 1: Bienvenida y Nombre del Administrador
  const startStep1 = () => {
    wizard.step = 1;
    updateProgress(1); // [FIX 4]
    saveWizardState(wizard); // [FIX 1]

    appendSlotBubble(`
      ¡Hola! 👋 Soy <b>Slot</b>, tu asistente de bienvenida en Sloty.<br><br>
      Configuraremos el estacionamiento de tu condominio en unos sencillos pasos.<br>
      <b>¿Cuál es tu nombre y apellido?</b>
    `, 'happy', () => {
      inputBar.innerHTML = `
        <form id="sloty-form-step1" style="display: flex; gap: 8px;">
          <input id="sloty-input-name" type="text" placeholder="Ej: Carlos Mendoza" value="${escapeHTML(wizard.name || '')}" required autocomplete="name"
            style="flex: 1; padding: 14px 16px; border-radius: 14px; border: 2px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.25); color: white; font-family: 'Montserrat', sans-serif; font-size: 0.9rem; font-weight: 700; outline: none;" />
          <button type="submit" style="padding: 14px 20px; background: #F5C518; color: #1a1a2e; border: none; border-radius: 14px; font-weight: 900; font-size: 0.9rem; cursor: pointer;">
            ➔
          </button>
        </form>
      `;
      const input = document.getElementById('sloty-input-name');
      input.focus();
      document.getElementById('sloty-form-step1').onsubmit = (e) => {
        e.preventDefault();
        const val = input.value.trim();
        if (!val || val.length < 3) return;
        wizard.name = val;
        wizard.step = 2;
        saveWizardState(wizard); // [FIX 1] Guardar progreso
        appendUserBubble(val);
        startStep2();
      };
    });
  };

  // PASO 2: Correo Electrónico y Teléfono WhatsApp
  const startStep2 = () => {
    wizard.step = 2;
    updateProgress(2); // [FIX 4]
    saveWizardState(wizard); // [FIX 1]

    appendSlotBubble(`
      ¡Mucho gusto, <b>${escapeHTML(wizard.name)}</b>! 🤝<br><br>
      Necesito tus datos de contacto directo para entregarte el acceso y las alertas del sistema:<br>
      <b>Correo Electrónico y Teléfono WhatsApp</b>
    `, 'talking', () => {
      inputBar.innerHTML = `
        ${renderBackButton(2)}
        <form id="sloty-form-step2" style="display: flex; flex-direction: column; gap: 10px;">
          <input id="sloty-input-email" type="email" placeholder="Correo electrónico (Ej: admin@condominio.com)" value="${escapeHTML(wizard.email || '')}" required autocomplete="email"
            style="padding: 14px 16px; border-radius: 14px; border: 2px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.25); color: white; font-family: 'Montserrat', sans-serif; font-size: 0.85rem; font-weight: 700; outline: none;" />
          <div style="display: flex; gap: 8px;">
            <input id="sloty-input-phone" type="tel" placeholder="WhatsApp (Ej: 04121234567)" value="${escapeHTML(wizard.phone || '')}" required autocomplete="tel"
              style="flex: 1; padding: 14px 16px; border-radius: 14px; border: 2px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.25); color: white; font-family: 'Montserrat', sans-serif; font-size: 0.85rem; font-weight: 700; outline: none;" />
            <button type="submit" style="padding: 14px 20px; background: #F5C518; color: #1a1a2e; border: none; border-radius: 14px; font-weight: 900; font-size: 0.9rem; cursor: pointer;">
              ➔
            </button>
          </div>
          <div id="step2-error" style="color: #ef4444; font-size: 0.75rem; font-weight: 700; display: none;"></div>
        </form>
      `;
      attachBackHandler(2);

      const emailInput = document.getElementById('sloty-input-email');
      const phoneInput = document.getElementById('sloty-input-phone');
      const errEl = document.getElementById('step2-error');
      emailInput.focus();

      document.getElementById('sloty-form-step2').onsubmit = (e) => {
        e.preventDefault();
        const em = emailInput.value.trim();
        const ph = phoneInput.value.trim();

        if (!validateEmail(em)) {
          errEl.textContent = 'Por favor ingresa un correo electrónico válido.';
          errEl.style.display = 'block';
          emailInput.focus();
          return;
        }

        if (!validateVenezuelanPhone(ph)) {
          errEl.textContent = 'Ingresa un número telefónico venezolano válido (Ej: 04121234567).';
          errEl.style.display = 'block';
          phoneInput.focus();
          return;
        }

        errEl.style.display = 'none';
        wizard.email = em;
        wizard.phone = sanitizePhoneNumber(ph);
        wizard.step = 3;
        saveWizardState(wizard); // [FIX 1] Guardar progreso
        appendUserBubble(`${em} · ${ph}`);
        startStep3();
      };
    });
  };

  // PASO 3: Nombre del Edificio y Capacidad
  const startStep3 = () => {
    wizard.step = 3;
    updateProgress(3); // [FIX 4]
    saveWizardState(wizard); // [FIX 1]

    appendSlotBubble(`
      Excelente. Ahora cuéntame los detalles del inmueble 🏢:<br><br>
      <b>¿Cómo se llama el edificio/condominio y cuántos puestos de estacionamiento tiene?</b>
    `, 'thinking', () => {
      inputBar.innerHTML = `
        ${renderBackButton(3)}
        <form id="sloty-form-step3" style="display: flex; flex-direction: column; gap: 10px;">
          <input id="sloty-input-bld-name" type="text" placeholder="Nombre del Edificio (Ej: Residencias Los Rosales)" value="${escapeHTML(wizard.buildingName || '')}" required
            style="padding: 14px 16px; border-radius: 14px; border: 2px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.25); color: white; font-family: 'Montserrat', sans-serif; font-size: 0.85rem; font-weight: 700; outline: none;" />
          <div style="display: flex; gap: 8px;">
            <input id="sloty-input-bld-floors" type="number" min="1" max="10" value="${wizard.floors || 1}" placeholder="Niveles" title="Niveles"
              style="width: 80px; padding: 14px 12px; border-radius: 14px; border: 2px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.25); color: white; font-family: 'Montserrat', sans-serif; font-size: 0.85rem; font-weight: 700; outline: none; text-align: center;" />
            <input id="sloty-input-bld-slots" type="number" min="1" max="2000" value="${wizard.slots || 30}" placeholder="Puestos" title="Puestos"
              style="flex: 1; padding: 14px 16px; border-radius: 14px; border: 2px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.25); color: white; font-family: 'Montserrat', sans-serif; font-size: 0.85rem; font-weight: 700; outline: none;" />
            <button type="submit" style="padding: 14px 20px; background: #F5C518; color: #1a1a2e; border: none; border-radius: 14px; font-weight: 900; font-size: 0.9rem; cursor: pointer;">
              ➔
            </button>
          </div>
        </form>
      `;
      attachBackHandler(3);

      const nameInput = document.getElementById('sloty-input-bld-name');
      const floorsInput = document.getElementById('sloty-input-bld-floors');
      const slotsInput = document.getElementById('sloty-input-bld-slots');
      nameInput.focus();

      document.getElementById('sloty-form-step3').onsubmit = (e) => {
        e.preventDefault();
        const bName = nameInput.value.trim();
        if (!bName || bName.length < 3) return;
        wizard.buildingName = bName;
        wizard.floors = parseInt(floorsInput.value) || 1;
        wizard.slots = parseInt(slotsInput.value) || 30;
        wizard.step = 4;
        saveWizardState(wizard); // [FIX 1] Guardar progreso
        appendUserBubble(`${bName} (${wizard.floors} nivel(es), ~${wizard.slots} puestos)`);
        startStep4Location();
      };
    });
  };

  // PASO 4: Geolocalización GPS con Fallback Suave
  const startStep4Location = () => {
    wizard.step = 4;
    updateProgress(4); // [FIX 4]
    saveWizardState(wizard); // [FIX 1]

    appendSlotBubble(`
      Para brindarte soporte en sitio y georreferenciar tu garita de control 📍:<br><br>
      <b>¿Deseas compartir la ubicación GPS del condominio o ingresarla manualmente?</b>
    `, 'happy', () => {
      inputBar.innerHTML = `
        ${renderBackButton(4)}
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button id="btn-gps-auto" style="padding: 14px 10px; background: #F5C518; color: #1a1a2e; border: none; border-radius: 14px; font-weight: 900; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
              📍 Detectar GPS
            </button>
            <button id="btn-gps-manual" style="padding: 14px 10px; background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.15); border-radius: 14px; font-weight: 800; font-size: 0.8rem; cursor: pointer;">
              ✏️ Ingresar Manual
            </button>
          </div>
          <div id="gps-status" style="font-size: 0.7rem; color: #F5C518; text-align: center; display: none;"></div>
        </div>
      `;
      attachBackHandler(4);

      const gpsStatus = document.getElementById('gps-status');

      document.getElementById('btn-gps-auto').onclick = () => {
        if (!navigator.geolocation) {
          renderManualLocation('Geolocalización no soportada por el navegador.');
          return;
        }

        gpsStatus.textContent = '⏳ Obteniendo coordenadas satelitales...';
        gpsStatus.style.display = 'block';

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            wizard.lat = pos.coords.latitude;
            wizard.lng = pos.coords.longitude;
            wizard.step = 5;
            saveWizardState(wizard); // [FIX 1] Guardar progreso
            appendUserBubble(`📍 GPS Detectado: (${wizard.lat.toFixed(4)}, ${wizard.lng.toFixed(4)})`);
            startStep5PlanSelection();
          },
          (err) => {
            console.warn('[Sloty GPS] Error o permiso denegado:', err);
            renderManualLocation('Permiso GPS no concedido.');
          },
          { timeout: 8000, enableHighAccuracy: true }
        );
      };

      document.getElementById('btn-gps-manual').onclick = () => {
        renderManualLocation();
      };
    });
  };

  const renderManualLocation = (notice = null) => {
    appendSlotBubble(`
      ${notice ? `<span style="color:#F5C518;">${notice}</span><br>` : ''}
      Indica la <b>Ciudad / Municipio</b> y una <b>Dirección de referencia</b>:
    `, 'normal', () => {
      inputBar.innerHTML = `
        ${renderBackButton(4)}
        <form id="sloty-form-manual-loc" style="display: flex; flex-direction: column; gap: 8px;">
          <input id="input-city" type="text" placeholder="Ciudad / Municipio (Ej: Caracas - Chacao)" value="${escapeHTML(wizard.city || '')}" required
            style="padding: 12px 14px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.25); color: white; font-family: 'Montserrat', sans-serif; font-size: 0.85rem; font-weight: 700; outline: none;" />
          <div style="display: flex; gap: 8px;">
            <input id="input-address" type="text" placeholder="Dirección / Calle / Sector" value="${escapeHTML(wizard.address || '')}" required
              style="flex: 1; padding: 12px 14px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.25); color: white; font-family: 'Montserrat', sans-serif; font-size: 0.85rem; font-weight: 700; outline: none;" />
            <button type="submit" style="padding: 12px 18px; background: #F5C518; color: #1a1a2e; border: none; border-radius: 12px; font-weight: 900; cursor: pointer;">
              ➔
            </button>
          </div>
        </form>
      `;
      attachBackHandler(4);

      const cityInp = document.getElementById('input-city');
      const addrInp = document.getElementById('input-address');
      cityInp.focus();

      document.getElementById('sloty-form-manual-loc').onsubmit = (e) => {
        e.preventDefault();
        wizard.city = cityInp.value.trim();
        wizard.address = addrInp.value.trim();
        wizard.step = 5;
        saveWizardState(wizard); // [FIX 1] Guardar progreso
        appendUserBubble(`📍 ${wizard.city} - ${wizard.address}`);
        startStep5PlanSelection();
      };
    });
  };

  // PASO 5: Selector Dinámico de Planes con Conversión BCV en Vivo
  const startStep5PlanSelection = () => {
    wizard.step = 5;
    updateProgress(5); // [FIX 4]
    saveWizardState(wizard); // [FIX 1]

    const plansHTML = PLANS.map(p => {
      const isSelected = p.id === wizard.selectedPlan.id;
      const amountBs = (p.price * wizard.bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `
        <div class="sloty-plan-card ${isSelected ? 'selected' : ''}" data-plan-id="${p.id}"
          style="background: ${isSelected ? 'rgba(245,197,24,0.08)' : 'rgba(255,255,255,0.04)'}; border: 1.5px solid ${isSelected ? '#F5C518' : 'rgba(255,255,255,0.08)'}; border-radius: 16px; padding: 14px; margin-bottom: 10px; position: relative;">
          ${p.badge ? `<span style="position: absolute; top: -8px; right: 14px; background: #F5C518; color: #1a1a2e; font-size: 0.6rem; font-weight: 900; padding: 2px 8px; border-radius: 6px; text-transform: uppercase;">${p.badge}</span>` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div style="font-weight: 900; font-size: 1rem; color: ${p.color};">${p.icon} Plan ${p.name}</div>
            <div style="text-align: right;">
              <span style="font-weight: 900; font-size: 1.1rem; color: white;">$${p.price}</span>
              <span style="font-size: 0.65rem; color: #888;">${p.period}</span>
            </div>
          </div>
          <div style="font-size: 0.7rem; color: #F5C518; font-weight: 700; margin-bottom: 6px;">
            Equivalente: <b>Bs. ${amountBs}</b> (Tasa BCV: ${wizard.bcvRate.toFixed(2)})
          </div>
          <p style="font-size: 0.75rem; color: rgba(255,255,255,0.7); margin: 0 0 8px 0; line-height: 1.3;">${p.description}</p>
          <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.7rem; color: rgba(255,255,255,0.85);">
            ${p.features.slice(0, 3).map(f => `<div>✓ ${f}</div>`).join('')}
          </div>
        </div>
      `;
    }).join('');

    appendSlotBubble(`
      Elige el plan ideal para <b>${escapeHTML(wizard.buildingName)}</b>.<br>
      Puedes cambiar de plan libremente antes de pagar:
      <div id="plans-container" style="margin-top: 12px;">
        ${plansHTML}
      </div>
    `, 'happy', (bubble) => {
      // Eventos de selección de tarjetas
      bubble.querySelectorAll('.sloty-plan-card').forEach(card => {
        card.onclick = () => {
          const planId = card.dataset.planId;
          const found = PLANS.find(p => p.id === planId);
          if (found) {
            wizard.selectedPlan = found;
            saveWizardState(wizard); // [FIX 1] Guardar selección
            bubble.querySelectorAll('.sloty-plan-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            updateInputBarForPlan();
          }
        };
      });

      const updateInputBarForPlan = () => {
        const plan = wizard.selectedPlan;
        const bsFormatted = (plan.price * wizard.bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 });
        inputBar.innerHTML = `
          ${renderBackButton(5)}
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #aaa;">
              <span>Plan seleccionado: <b style="color:white;">Plan ${plan.name}</b></span>
              <span style="color:#F5C518; font-weight:900;">$${plan.price} USD / Bs. ${bsFormatted}</span>
            </div>
            <button id="btn-confirm-plan" style="width: 100%; padding: 14px; background: #F5C518; color: #1a1a2e; border: none; border-radius: 14px; font-weight: 900; font-size: 0.85rem; cursor: pointer; text-transform: uppercase;">
              ${plan.id === 'TRIAL' ? 'Activar Prueba Gratuita ➔' : `Continuar al Pago ($${plan.price} USD) ➔`}
            </button>
          </div>
        `;
        attachBackHandler(5);

        document.getElementById('btn-confirm-plan').onclick = () => {
          appendUserBubble(`Seleccioné el Plan ${plan.name} ($${plan.price})`);
          if (plan.id === 'TRIAL') {
            submitOnboardingRequest('TRIAL', 'N/A', 'N/A', null);
          } else {
            wizard.step = 6;
            saveWizardState(wizard);
            startStep6Payment();
          }
        };
      };

      updateInputBarForPlan();
    });
  };

  // PASO 6: Métodos de Pago y Carga de Comprobante
  const startStep6Payment = () => {
    wizard.step = 6;
    updateProgress(6); // [FIX 4]
    saveWizardState(wizard); // [FIX 1]

    const plan = wizard.selectedPlan;

    appendSlotBubble(`
      <b>¿Por cuál método deseas realizar el pago de $${plan.price} USD?</b>
    `, 'happy', () => {
      inputBar.innerHTML = `
        ${renderBackButton(6)}
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
          <button id="pay-pm" style="padding: 12px 6px; border-radius: 12px; border: 1px solid #F5C518; background: rgba(245,197,24,0.1); color: white; font-weight: 800; font-size: 0.75rem; cursor: pointer; text-align: center;">
            💳 Pago Móvil
          </button>
          <button id="pay-zelle" style="padding: 12px 6px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: white; font-weight: 800; font-size: 0.75rem; cursor: pointer; text-align: center;">
            🏦 Zelle USD
          </button>
          <button id="pay-cash" style="padding: 12px 6px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: white; font-weight: 800; font-size: 0.75rem; cursor: pointer; text-align: center;">
            💵 Efectivo USD
          </button>
        </div>
      `;
      attachBackHandler(6);

      document.getElementById('pay-pm').onclick = () => {
        wizard.paymentMethod = 'PAGO_MOVIL';
        saveWizardState(wizard);
        renderPaymentForm('PAGO_MOVIL');
      };
      document.getElementById('pay-zelle').onclick = () => {
        wizard.paymentMethod = 'ZELLE';
        saveWizardState(wizard);
        renderPaymentForm('ZELLE');
      };
      document.getElementById('pay-cash').onclick = () => {
        wizard.paymentMethod = 'CASH';
        saveWizardState(wizard);
        renderPaymentForm('CASH');
      };
    });
  };

  const renderPaymentForm = async (method) => {
    wizard.paymentMethod = method;
    saveWizardState(wizard); // [FIX 1]

    const plan = wizard.selectedPlan;
    const amountBs = (plan.price * wizard.bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 });

    // Cargar configuración de pagos desde Supabase
    const payConfig = await getPaymentConfig(supabase);
    const pmConfig = payConfig[method] || {};

    let detailsHTML = '';
    if (method === 'PAGO_MOVIL') {
      appendUserBubble('Pago Móvil (Bolívares)');
      detailsHTML = `
        <div style="font-size:0.8rem; line-height:1.5;">
          Datos oficiales de <b>Pago Móvil Sloty</b> a tasa BCV (<b>${wizard.bcvRate.toFixed(2)} Bs/$</b>):<br><br>
          <div style="background:#0f1127; border:1px solid rgba(245,197,24,0.3); border-radius:14px; padding:14px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Banco:</span> <b>${escapeHTML(pmConfig.bank || 'Banco Exterior')} (${escapeHTML(pmConfig.bank_code || '0115')})</b></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Cédula:</span> <b>${escapeHTML(pmConfig.id_card || 'V-27031049')}</b></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Teléfono:</span> <b>${escapeHTML(pmConfig.phone || '04129135799')}</b></div>
            <div style="display:flex; justify-content:space-between; color:#F5C518; font-weight:900; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">
              <span>Monto a transferir:</span> <span>Bs. ${amountBs} ($${plan.price} USD)</span>
            </div>
          </div>
          Adjunta tu comprobante y referencia bancaria:
        </div>
      `;
    } else if (method === 'ZELLE') {
      appendUserBubble('Zelle USD');
      detailsHTML = `
        <div style="font-size:0.8rem; line-height:1.5;">
          Datos oficiales para transferencia por <b>Zelle</b>:<br><br>
          <div style="background:#0f1127; border:1px solid rgba(245,197,24,0.3); border-radius:14px; padding:14px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Titular:</span> <b>${escapeHTML(pmConfig.holder || 'Sloty Technologies')}</b></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Correo Zelle:</span> <b>${escapeHTML(pmConfig.email || 'pagos@slotyapp.com')}</b></div>
            <div style="display:flex; justify-content:space-between; color:#F5C518; font-weight:900; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">
              <span>Monto Total:</span> <span>$${plan.price} USD</span>
            </div>
          </div>
          Adjunta tu captura de pantalla de Zelle y correo/titular emisor:
        </div>
      `;
    } else {
      appendUserBubble('Efectivo USD');
      detailsHTML = `
        <div style="font-size:0.8rem; line-height:1.5;">
          Has seleccionado <b>Efectivo USD ($${plan.price})</b>.<br><br>
          Un ejecutivo de Sloty coordinará la entrega y validación de tu recibo para activar tu cuenta de inmediato.
        </div>
      `;
    }

    appendSlotBubble(detailsHTML, 'talking', () => {
      inputBar.innerHTML = `
        ${renderBackButton(6)}
        <form id="sloty-form-proof" style="display:flex; flex-direction:column; gap:10px;">
          ${method !== 'CASH' ? `
            <div style="display:flex; gap:8px;">
              <input id="proof-bank-name" type="text" placeholder="${method === 'ZELLE' ? 'Titular / Correo Zelle' : 'Banco emisor'}" required
                style="flex:1; padding:12px 14px; border-radius:12px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.25); color:white; font-family:'Montserrat',sans-serif; font-size:0.85rem; font-weight:700; outline:none;" />
              <input id="proof-ref-num" type="text" placeholder="Nº Referencia" required
                style="flex:1; padding:12px 14px; border-radius:12px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.25); color:white; font-family:'Montserrat',sans-serif; font-size:0.85rem; font-weight:700; outline:none;" />
            </div>
            
            <div>
              <input type="file" id="proof-file-input" accept="image/jpeg,image/png,image/webp,application/pdf" style="display:none;" />
              <button id="proof-attach-btn" type="button" style="width:100%; padding:10px; border-radius:12px; border:1px dashed #F5C518; background:rgba(245,197,24,0.06); color:#F5C518; font-weight:800; font-size:0.75rem; cursor:pointer;">
                📎 Adjuntar Comprobante (Obligatorio: JPG, PNG, PDF &lt; 5MB)
              </button>
              <div id="proof-file-label" style="font-size:0.7rem; color:#22c55e; margin-top:4px; text-align:center; display:none;"></div>
            </div>
          ` : ''}

          <div style="display:flex; align-items:center; gap:8px; margin-top:2px;">
            <input type="checkbox" id="proof-agree-terms" required style="accent-color:#F5C518; width:16px; height:16px;" />
            <label for="proof-agree-terms" style="font-size:0.7rem; color:rgba(255,255,255,0.7);">
              Acepto los <a href="#" id="link-terms-modal" style="color:#F5C518; text-decoration:underline;">Términos y Condiciones</a> de Sloty
            </label>
          </div>

          <button id="proof-submit-btn" type="submit" style="width:100%; padding:14px; background:#F5C518; color:#1a1a2e; border:none; border-radius:14px; font-weight:900; font-size:0.85rem; cursor:pointer; text-transform:uppercase;">
            ${method === 'CASH' ? 'Confirmar Solicitud en Efectivo ➔' : 'Enviar Solicitud a Master ➔'}
          </button>
          <div id="proof-error-msg" style="color:#ef4444; font-size:0.75rem; text-align:center; display:none; font-weight:700;"></div>
        </form>
      `;
      attachBackHandler(6);

      let selectedFile = null;
      const fileInput = document.getElementById('proof-file-input');
      const attachBtn = document.getElementById('proof-attach-btn');
      const fileLabel = document.getElementById('proof-file-label');
      const termsLink = document.getElementById('link-terms-modal');

      if (termsLink) {
        termsLink.onclick = (e) => {
          e.preventDefault();
          showTermsModal(() => {
            const cb = document.getElementById('proof-agree-terms');
            if (cb) cb.checked = true;
          });
        };
      }

      if (attachBtn && fileInput) {
        attachBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
          if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            const check = validateReceiptFile(f);
            if (!check.valid) {
              // [FIX 3] Reemplazar alert() nativo con showSlotyAlert
              showSlotyAlert({
                title: 'Archivo no válido',
                message: check.error,
                icon: '📎',
                buttonText: 'ENTENDIDO',
                onClose: () => {
                  fileInput.value = '';
                }
              });
              return;
            }
            selectedFile = f;
            fileLabel.textContent = `✓ Archivo adjunto: ${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`;
            fileLabel.style.display = 'block';
          }
        };
      }

      document.getElementById('sloty-form-proof').onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('proof-submit-btn');
        const errMsg = document.getElementById('proof-error-msg');

        if (method !== 'CASH' && !selectedFile) {
          errMsg.textContent = 'Debes adjuntar la foto o PDF del comprobante de pago.';
          errMsg.style.display = 'block';
          return;
        }

        const bankName = document.getElementById('proof-bank-name')?.value.trim() || (method === 'CASH' ? 'Efectivo USD' : 'Zelle');
        const refNum = document.getElementById('proof-ref-num')?.value.trim() || 'EFECTIVO-' + Date.now().toString().slice(-6);

        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Enviando a Bóveda Master...';

        await submitOnboardingRequest(method, bankName, refNum, selectedFile);
      };
    });
  };

  // ================================================================
  // ENVÍO DE SOLICITUD A BASE DE DATOS Y NOTIFICACIONES
  // ================================================================
  const submitOnboardingRequest = async (method, bankName, refNum, file) => {
    const submitBtn = document.getElementById('proof-submit-btn');
    const errMsg = document.getElementById('proof-error-msg');

    // 1. Validar Rate Limiting
    const rateCheck = checkClientRateLimit();
    if (!rateCheck.allowed) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Reintentar'; }
      if (errMsg) {
        errMsg.textContent = `Límite de solicitudes alcanzado. Por favor espera ${rateCheck.remainingMins} minuto(s) antes de reintentar.`;
        errMsg.style.display = 'block';
      }
      return;
    }

    try {
      const plan = wizard.selectedPlan;
      const amountUsd = plan.price;
      const amountBs = Number((plan.price * wizard.bcvRate).toFixed(2));
      let finalReceiptUrl = null;

      // 2. Subida segura de Comprobante con UUID
      if (file) {
        const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const safeFileName = `${crypto.randomUUID()}.${ext}`;
        const filePath = `receipts/${Date.now()}_${safeFileName}`;

        try {
          // Intentar primero en payment-proofs y fallback a proofs
          let bucketName = 'payment-proofs';
          let { data: uploadData, error: upErr } = await supabase.storage
            .from(bucketName)
            .upload(filePath, file, { contentType: file.type, upsert: false });

          if (upErr || !uploadData) {
            bucketName = 'proofs';
            const retryRes = await supabase.storage
              .from(bucketName)
              .upload(filePath, file, { contentType: file.type, upsert: false });
            uploadData = retryRes.data;
          }

          if (uploadData) {
            const { data: pubUrl } = supabase.storage.from(bucketName).getPublicUrl(filePath);
            finalReceiptUrl = pubUrl?.publicUrl;
          }
        } catch (storageErr) {
          console.warn('[Sloty Storage] Upload notice:', storageErr);
        }
      }

      // 3. Inserción en subscription_requests
      const requestPayload = {
        building_name: wizard.buildingName,
        admin_name: wizard.name,
        phone: wizard.phone,
        email: wizard.email,
        plan_id: plan.id,
        amount_usd: amountUsd,
        amount_bs: amountBs,
        bcv_rate_used: wizard.bcvRate,
        payment_method: method,
        payment_reference: refNum,
        receipt_url: finalReceiptUrl,
        lat: wizard.lat,
        lng: wizard.lng,
        city: wizard.city || null,
        address: wizard.address || null,
        status: 'PENDING_APPROVAL'
      };

      const { data: reqCreated, error: reqErr } = await supabase
        .from('subscription_requests')
        .insert(requestPayload)
        .select()
        .maybeSingle();

      if (reqErr) {
        console.error('[Sloty Onboarding] Error crítico insertando solicitud:', reqErr);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reintentar Envío';
        }
        if (errMsg) {
          errMsg.textContent = 'No pudimos registrar tu solicitud. Verifica tu conexión e intenta de nuevo, o contacta al equipo Master por WhatsApp.';
          errMsg.style.display = 'block';
        }
        return;
      }

      if (!reqCreated) {
        console.error('[Sloty Onboarding] Insert retornó null sin error');
        if (errMsg) {
          errMsg.textContent = 'Error inesperado al guardar. Por favor reintenta.';
          errMsg.style.display = 'block';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reintentar Envío';
        }
        return;
      }

      // 4. Notificar a Master (Telegram / WhatsApp) — fire-and-forget con catch silencioso
      // [FIX] Si el notificador falla, no debe romper la experiencia del usuario
      notifyMasterPayment({
        buildingName: wizard.buildingName,
        adminName: wizard.name,
        phone: wizard.phone,
        email: wizard.email,
        plan: plan.id,
        amountUsd,
        amountBs,
        bcvRate: wizard.bcvRate,
        method,
        reference: refNum,
        lat: wizard.lat,
        lng: wizard.lng,
        city: wizard.city,
        address: wizard.address
      }).catch(err => {
        console.warn('[Sloty Onboarding] Notificación a Master falló (no crítico):', err);
      });

      const waData = formatProofWhatsAppMessage({
        buildingName: wizard.buildingName,
        buildingCode: generateBuildingCode(wizard.buildingName), // código temporal solo para el mensaje
        adminName: wizard.name,
        phone: wizard.phone,
        email: wizard.email,
        planLabel: plan.name,
        amountUsd,
        amountBs,
        bcvRate: wizard.bcvRate,
        bank: bankName,
        reference: refNum,
        proofUrl: finalReceiptUrl || 'Adjunto en sistema',
        lat: wizard.lat,
        lng: wizard.lng,
        city: wizard.city,
        address: wizard.address,
        masterPhone: '584120770776'
      });

      inputBar.innerHTML = '';
      appendUserBubble(`Solicitud enviada exitosamente (Ref: ${refNum})`);

      // 6. Mensaje de Despedida Personalizado
      appendSlotBubble(`
        <div style="text-align:center; padding:10px 0;">
          <div style="font-size:3rem; margin-bottom:8px; animation:slotyPulseDot 1s infinite alternate;">🎉</div>
          <h3 style="color:#F5C518; font-size:1.15rem; font-weight:900; margin-bottom:6px; text-transform:uppercase;">
            ¡Muchas Gracias, ${escapeHTML(wizard.name)}!
          </h3>
          <p style="font-size:0.8rem; color:rgba(255,255,255,0.8); line-height:1.5; margin-bottom:12px;">
            Hemos recibido con éxito la solicitud de registro para <b>${escapeHTML(wizard.buildingName)}</b>.<br>
            Agradecemos tu confianza en <b>Sloty</b> para transformar tu estacionamiento.
          </p>

          <div style="background:#0f1127; border:1px solid rgba(245,197,24,0.3); border-radius:14px; padding:12px; margin-bottom:14px; text-align:left; font-size:0.75rem; line-height:1.4;">
            <div style="color:#F5C518; font-weight:900; margin-bottom:4px;">📋 Resumen de Activación:</div>
            <div>💎 <b>Plan:</b> Plan ${escapeHTML(plan.name)}</div>
            <div>💵 <b>Monto Registrado:</b> $${amountUsd} USD (Bs. ${amountBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })})</div>
            <div>📊 <b>Tasa BCV del día:</b> Bs. ${wizard.bcvRate.toFixed(2)} / USD</div>
            <div>📝 <b>Referencia:</b> ${escapeHTML(refNum)}</div>
          </div>

          <p style="font-size:0.75rem; color:#22c55e; font-weight:700; margin-bottom:14px;">
            El equipo Master verificará los datos y se comunicará a tu teléfono <b>${escapeHTML(wizard.phone)}</b> para entregarte las credenciales de acceso.
          </p>

          <a href="${waData.whatsappUrl}" target="_blank" style="display:block; width:100%; box-sizing:border-box; padding:14px; background:#25D366; color:white; border-radius:14px; font-weight:900; font-size:0.85rem; text-decoration:none; margin-bottom:10px; box-shadow:0 4px 15px rgba(37,211,102,0.3);">
            📲 ABRIR WHATSAPP CON MASTER
          </a>

          <button id="sloty-finish-btn" style="width:100%; padding:12px; background:rgba(255,255,255,0.06); color:white; border:none; border-radius:12px; font-weight:700; font-size:0.75rem; cursor:pointer;">
            Finalizar y Volver al Inicio
          </button>
        </div>
      `, 'excited', (bubble) => {
        // [FIX 1] Limpiar borrador al completar exitosamente
        clearWizardState();

        const finishBtn = bubble.querySelector('#sloty-finish-btn');
        if (finishBtn) {
          finishBtn.onclick = () => {
            wrapper.remove();
            if (onComplete) onComplete();
          };
        }
      });

    } catch (err) {
      console.error('[Sloty Onboarding] Error finalizando solicitud:', err);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Reintentar Envío'; }
      if (errMsg) {
        errMsg.textContent = 'Ocurrió un inconveniente al enviar. Puedes comunicarte directamente por WhatsApp con el equipo Master.';
        errMsg.style.display = 'block';
      }
    }
  };

  // [FIX 1] Si hay borrador previo (> paso 1), ofrecer reanudar
  if (draft && draft.step > 1) {
    const resumeStepNames = {
      1: 'bienvenida',
      2: 'datos de contacto',
      3: 'datos del edificio',
      4: 'ubicación',
      5: 'selección de plan',
      6: 'método de pago'
    };
    const stepName = resumeStepNames[draft.step] || 'donde lo dejaste';
    appendSlotBubble(`
      ¡Hola de nuevo, <b>${escapeHTML(wizard.name || 'Administrador')}</b>! 👋<br><br>
      Detectamos que tenías un registro en progreso (<b>${stepName}</b>).<br>
      ¿Deseas continuar desde donde lo dejaste o empezar de nuevo?
    `, 'happy', () => {
      inputBar.innerHTML = `
        <div style="display:flex; gap:10px;">
          <button id="btn-resume-wizard" style="flex:2; padding:14px; background:#F5C518; color:#1a1a2e; border:none; border-radius:14px; font-weight:900; font-size:0.85rem; cursor:pointer;">
            ▶️ Continuar Registro
          </button>
          <button id="btn-restart-wizard" style="flex:1; padding:14px; background:rgba(255,255,255,0.08); color:white; border:1px solid rgba(255,255,255,0.2); border-radius:14px; font-weight:900; font-size:0.8rem; cursor:pointer;">
            🔄 Empezar de Nuevo
          </button>
        </div>
      `;

      document.getElementById('btn-resume-wizard').onclick = () => {
        appendUserBubble('Continuar donde lo dejé');
        switch (wizard.step) {
          case 2: startStep2(); break;
          case 3: startStep3(); break;
          case 4: startStep4Location(); break;
          case 5: startStep5PlanSelection(); break;
          case 6: startStep6Payment(); break;
          default: startStep1();
        }
      };

      document.getElementById('btn-restart-wizard').onclick = () => {
        clearWizardState();
        Object.assign(wizard, {
          step: 1, name: '', email: '', phone: '', buildingName: '',
          floors: 1, slots: 30, lat: null, lng: null, city: '', address: '',
          selectedPlan: PLANS[2], paymentMethod: 'PAGO_MOVIL'
        });
        appendUserBubble('Empezar de nuevo');
        startStep1();
      };
    });
  } else {
    // Iniciar flujo conversacional normal
    startStep1();
  }
};

export { PLANS as defaultPlans };
