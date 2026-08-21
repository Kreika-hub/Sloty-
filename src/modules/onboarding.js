/**
 * Onboarding Module v3 — Wizard Conversacional con Slot y Cotejo de Pagos Master
 * Planes oficiales Sloty Dossier: Bronce $180/mes | Plata $250/mes | Oro $380/mes
 * Métodos: Pago Móvil, Transferencia, Zelle, Efectivo USD, Binance Pay
 * Envío de Comprobante por WhatsApp a Master y activación mediante validación/cotejo
 */

import { escapeHTML } from '../utils/sanitize.js'
import { supabase, saveParkingState, getExchangeRate } from '../db.js'
import { formatProofWhatsAppMessage } from '../utils/notifier.js'

// ================================================================
// CONFIGURACIÓN DE PLANES (MENSUALES DIRECTOS — SIN IVA)
// ================================================================
export const PLANS = [
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
      'Control de estacionamiento',
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
      'Sin bitácora de auditoría ni cartelera de anuncios'
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
// ESTADO Y UTILIDADES
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

  if (state.buildingId && !state.isBypass) {
    supabase.from('buildings').update({ is_first_login: false }).eq('id', state.buildingId)
      .then(() => console.log('[Sloty Onboarding] Flag is_first_login updated in DB'))
      .catch(err => console.warn('[Sloty Onboarding] Failed to update is_first_login in DB:', err));
  }
};

// ================================================================
// SLOT MASCOTA — SVG Y EXPRESIONES
// ================================================================

const getSlotSVG = (expression = 'normal', message = '') => {
  const expressions = {
    normal: `<circle cx="70" cy="55" r="5.5" fill="#1a1a2e"/><circle cx="72" cy="53" r="2" fill="white"/><circle cx="90" cy="55" r="5.5" fill="#1a1a2e"/><circle cx="92" cy="53" r="2" fill="white"/><path d="M 66 70 Q 80 80 94 70" stroke="#1a1a2e" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    happy: `<path d="M 64 58 Q 70 48 76 58" stroke="#1a1a2e" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M 84 58 Q 90 48 96 58" stroke="#1a1a2e" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M 64 68 Q 80 86 96 68" stroke="#1a1a2e" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    excited: `<path d="M 64 50 L 73 55 L 64 60" stroke="#1a1a2e" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M 96 50 L 87 55 L 96 60" stroke="#1a1a2e" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M 64 68 Q 80 88 96 68" stroke="#1a1a2e" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    talking: `<circle cx="70" cy="55" r="5.5" fill="#1a1a2e"/><circle cx="72" cy="53" r="2" fill="white"/><circle cx="90" cy="55" r="5.5" fill="#1a1a2e"/><circle cx="92" cy="53" r="2" fill="white"/><ellipse cx="80" cy="72" rx="7" ry="9" fill="#1a1a2e"/>`,
    thinking: `<circle cx="70" cy="57" r="5.5" fill="#1a1a2e"/><circle cx="90" cy="57" r="5.5" fill="#1a1a2e"/><path d="M 68 72 Q 80 67 92 72" stroke="#1a1a2e" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="106" cy="42" r="7" fill="none" stroke="#1a1a2e" stroke-width="1.5" opacity="0.5"/><circle cx="116" cy="32" r="4.5" fill="none" stroke="#1a1a2e" stroke-width="1.5" opacity="0.3"/>`,
    monocle: `<circle cx="70" cy="55" r="5.5" fill="#1a1a2e"/><circle cx="90" cy="55" r="9" fill="none" stroke="#1a1a2e" stroke-width="2" fill="rgba(255,255,255,0.15)"/><circle cx="90" cy="55" r="3.5" fill="#1a1a2e"/><path d="M 99 55 L 106 62" stroke="#1a1a2e" stroke-width="1.5"/><path d="M 66 72 Q 80 78 94 72" stroke="#1a1a2e" stroke-width="2.5" fill="none"/>`,
    money: `<circle cx="70" cy="55" r="5.5" fill="#1a1a2e"/><circle cx="90" cy="55" r="5.5" fill="#1a1a2e"/><text x="80" y="77" text-anchor="middle" font-size="16" fill="#1a1a2e" font-weight="900">$</text>`
  };

  return `
    <div style="display:flex; flex-direction:column; align-items:center; gap:10px; margin-bottom:18px;">
      <svg width="120" height="95" viewBox="0 0 160 115" style="animation: slotFloat 3.5s ease-in-out infinite;">
        <defs>
          <linearGradient id="slotGradV3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ffe066"/>
            <stop offset="45%" style="stop-color:#F5C518"/>
            <stop offset="100%" style="stop-color:#d4a017"/>
          </linearGradient>
          <filter id="slotGlowV3" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <circle cx="80" cy="58" r="42" fill="url(#slotGradV3)" stroke="#1a1a2e" stroke-width="3" filter="url(#slotGlowV3)"/>
        ${expressions[expression] || expressions.normal}

        <circle cx="60" cy="62" r="5" fill="#f87171" opacity="0.35"/>
        <circle cx="100" cy="62" r="5" fill="#f87171" opacity="0.35"/>
      </svg>
      
      ${message ? `
        <div style="background:#F5C518; color:#1a1a2e; padding:10px 18px; border-radius:18px; font-size:0.8rem; font-weight:800; max-width:320px; text-align:center; position:relative; box-shadow:0 6px 20px rgba(245,197,24,0.25);">
          ${message}
          <div style="position:absolute; top:-7px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:7px solid transparent; border-right:7px solid transparent; border-bottom:7px solid #F5C518;"></div>
        </div>` : ''}
    </div>
    <style>
      @keyframes slotFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-7px); }
      }
    </style>
  `;
};

const slotMessages = {
  1: { expr: 'happy', text: '¡Hola! Soy Slot. Vamos a configurar tu condominio en minutos. Primero, indícame tus datos:' },
  2: { expr: 'excited', text: '¡Excelente! Ahora elige el plan mensual para tu edificio:' },
  3: { expr: 'thinking', text: '¡Gran elección! Configuremos el nombre del edificio, plantas y primer operador de guardia.' },
  4: { expr: 'money', text: 'Listo. Envía tu comprobante de pago móvil, transferencia o Zelle para activar tu edificio.' },
  5: { expr: 'excited', text: '¡Solicitud de activación enviada con éxito! Nuestro equipo Master validará tu pago.' }
};

// ================================================================
// RENDER PRINCIPAL DEL WIZARD
// ================================================================

export const renderOnboardingWizard = (container, state, onComplete) => {
  let currentStep = 1;
  let bcvRate = 40.0;

  getExchangeRate().then(b => {
    if (b?.rate) bcvRate = Number(b.rate);
  }).catch(() => {});

  const wizardData = {
    firstName: state.admin_first_name || (state.admin_name ? state.admin_name.split(' ')[0] : ''),
    lastName: state.admin_last_name || (state.admin_name ? state.admin_name.split(' ').slice(1).join(' ') : ''),
    email: state.admin_email || '',
    phone: state.admin_phone || state.phone || '',
    role: state.admin_role || 'admin',
    selectedPlan: PLANS[1], // Plata default
    buildingName: state.buildingName || state.name || '',
    monthlyRate: state.monthly_rate || 20,
    levelName: 'Nivel 1 / Planta Baja',
    slotsCount: 15,
    guardName: 'Guardia Principal',
    guardPin: '1234',
    paymentMethod: 'PAGO_MOVIL', // 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'ZELLE' | 'EFECTIVO' | 'BINANCE'
    transferBank: 'BANCO_VENEZUELA',
    transferRef: '',
    proofImageFile: null
  };

  const totalSteps = 5;

  const getStepTitle = () => {
    const titles = { 1: 'Tus Datos', 2: 'Elige tu Plan', 3: 'Tu Edificio', 4: 'Reportar Pago', 5: 'Verificación' };
    return titles[currentStep] || '';
  };

  // --- Render del paso de Planes (SOLO MENSUAL) ---
  const renderPlanStep = () => {
    const slotMsg = slotMessages[2];
    let plansHTML = '';

    PLANS.forEach(plan => {
      const isSelected = wizardData.selectedPlan?.id === plan.id;
      const slotsText = typeof plan.maxSlots === 'number' ? `Hasta ${plan.maxSlots} puestos` : `${plan.maxSlots} puestos`;

      plansHTML += `
        <div class="plan-card ${isSelected ? 'plan-selected' : ''}" data-plan="${plan.id}" style="
          background: ${isSelected ? 'rgba(245,197,24,0.12)' : 'rgba(255,255,255,0.03)'};
          border: 2px solid ${isSelected ? plan.color : 'rgba(255,255,255,0.08)'};
          border-radius: 20px;
          padding: 22px 18px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          display: flex;
          flex-direction: column;
          ${plan.recommended ? 'box-shadow: 0 0 25px rgba(245,197,24,0.15);' : ''}
        ">
          ${plan.badge ? `<div style="position:absolute; top:-11px; left:50%; transform:translateX(-50%); background:${plan.color}; color:#1a1a2e; padding:4px 14px; border-radius:20px; font-size:0.65rem; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap;">★ ${plan.badge}</div>` : ''}
          ${isSelected ? `<div style="position:absolute; top:14px; right:14px; width:26px; height:26px; background:${plan.color}; color:#1a1a2e; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:900;">✓</div>` : ''}

          <div style="font-size:2.2rem; margin-bottom:8px;">${plan.icon}</div>
          <div style="font-size:0.75rem; font-weight:800; color:${plan.color}; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:4px;">Plan ${plan.name}</div>
          <div style="font-size:1.1rem; font-weight:900; color:white; margin-bottom:4px;">${slotsText}</div>
          <div style="font-size:0.72rem; color:rgba(255,255,255,0.5); margin-bottom:14px; line-height:1.4;">${plan.description}</div>

          <div style="margin-bottom:16px; padding:10px 0; border-top:1px solid rgba(255,255,255,0.06); border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:1.8rem; font-weight:900; color:${plan.color};">$${plan.price}</span>
            <span style="font-size:0.8rem; color:rgba(255,255,255,0.4);">${plan.period}</span>
          </div>

          <div style="margin-bottom:18px; flex:1;">
            ${plan.features.map(f => `<div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:7px; font-size:0.72rem; color:rgba(255,255,255,0.85); line-height:1.4;"><span style="color:#22c55e; flex-shrink:0; font-weight:900;">✓</span> ${escapeHTML(f)}</div>`).join('')}
            ${plan.limitations.map(l => `<div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:7px; font-size:0.72rem; color:rgba(255,255,255,0.3); line-height:1.4;"><span style="flex-shrink:0;">✕</span> ${escapeHTML(l)}</div>`).join('')}
          </div>

          <button type="button" style="width:100%; padding:12px; border-radius:12px; border:none; background:${isSelected ? plan.color : 'rgba(255,255,255,0.06)'}; color:${isSelected ? '#1a1a2e' : 'rgba(255,255,255,0.7)'}; font-weight:900; font-size:0.8rem; cursor:pointer; transition:all 0.2s;">
            ${isSelected ? '✓ Seleccionado' : plan.cta}
          </button>
        </div>
      `;
    });

    return `
      ${getSlotSVG(slotMsg.expr, slotMsg.text)}

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:14px; margin-bottom:20px;">
        ${plansHTML}
      </div>

      ${wizardData.selectedPlan ? `
        <div style="background:rgba(245,197,24,0.08); border:1px solid rgba(245,197,24,0.2); border-radius:14px; padding:12px; margin-bottom:16px; text-align:center;">
          <div style="font-size:0.8rem; color:rgba(255,255,255,0.85);">Has elegido: <b style="color:${wizardData.selectedPlan.color};">Plan ${wizardData.selectedPlan.name}</b> · $${wizardData.selectedPlan.price} USD / mes</div>
        </div>
      ` : ''}
    `;
  };

  // --- Render del Reporte de Pago (Pago Móvil / Transferencia / Zelle / Efectivo) ---
  const renderCheckoutStep = () => {
    const slotMsg = slotMessages[4];
    const plan = wizardData.selectedPlan || PLANS[0];
    const price = plan.price;
    const amountBs = (price * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return `
      ${getSlotSVG(slotMsg.expr, slotMsg.text)}

      <!-- RESUMEN DE LA MEMBRESÍA -->
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:18px; padding:18px; margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.8rem;">${plan.icon}</span>
            <div>
              <div style="font-weight:900; color:white; font-size:0.95rem;">Sloty ${plan.name}</div>
              <div style="font-size:0.7rem; color:rgba(255,255,255,0.45);">${typeof plan.maxSlots === 'number' ? `Hasta ${plan.maxSlots} puestos` : 'Puestos ilimitados'} · Mensual</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:900; color:#F5C518; font-size:1.25rem;">$${price} USD</div>
            <div style="font-size:0.7rem; color:#999;">≈ Bs. ${amountBs}</div>
          </div>
        </div>
        <div style="font-size:0.7rem; color:rgba(255,255,255,0.6); text-align:center;">
          Tasa Oficial BCV: <b>Bs. ${bcvRate.toFixed(2)}</b> / USD
        </div>
      </div>

      <!-- SELECTOR DE MÉTODO DE PAGO -->
      <div style="margin-bottom:18px;">
        <div style="font-size:0.7rem; font-weight:900; color:#F5C518; text-transform:uppercase; margin-bottom:10px; letter-spacing:1px;">Selecciona el Método Utilizado</div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
          <button type="button" id="pay-pm" style="padding:12px 6px; border-radius:12px; border:2px solid ${wizardData.paymentMethod === 'PAGO_MOVIL' ? '#F5C518' : 'rgba(255,255,255,0.08)'}; background:${wizardData.paymentMethod === 'PAGO_MOVIL' ? 'rgba(245,197,24,0.12)' : 'rgba(255,255,255,0.02)'}; color:white; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:1.3rem;">📲</span>
            <span style="font-size:0.7rem; font-weight:800;">Pago Móvil</span>
          </button>
          
          <button type="button" id="pay-zelle" style="padding:12px 6px; border-radius:12px; border:2px solid ${wizardData.paymentMethod === 'ZELLE' ? '#F5C518' : 'rgba(255,255,255,0.08)'}; background:${wizardData.paymentMethod === 'ZELLE' ? 'rgba(245,197,24,0.12)' : 'rgba(255,255,255,0.02)'}; color:white; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:1.3rem;">⚡</span>
            <span style="font-size:0.7rem; font-weight:800;">Zelle USD</span>
          </button>

          <button type="button" id="pay-cash" style="padding:12px 6px; border-radius:12px; border:2px solid ${wizardData.paymentMethod === 'EFECTIVO' ? '#F5C518' : 'rgba(255,255,255,0.08)'}; background:${wizardData.paymentMethod === 'EFECTIVO' ? 'rgba(245,197,24,0.12)' : 'rgba(255,255,255,0.02)'}; color:white; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:1.3rem;">💵</span>
            <span style="font-size:0.7rem; font-weight:800;">Efectivo USD</span>
          </button>
        </div>

        ${wizardData.paymentMethod === 'PAGO_MOVIL' ? `
          <!-- DATOS PAGO MÓVIL / TRANSFERENCIA -->
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:16px;">
            <div style="background:rgba(0,0,0,0.3); border-radius:12px; padding:12px; font-size:0.72rem; color:rgba(255,255,255,0.85); line-height:1.7; border:1px solid rgba(255,255,255,0.06); margin-bottom:12px;">
              <div style="display:flex; justify-content:space-between;"><span style="color:#999;">Banco:</span> <span style="font-weight:800;">Banco de Venezuela / Banesco</span></div>
              <div style="display:flex; justify-content:space-between;"><span style="color:#999;">Pago Móvil:</span> <span style="font-weight:800; color:#F5C518;">0412-0770776 · V-27890123</span></div>
              <div style="display:flex; justify-content:space-between;"><span style="color:#999;">Monto en Bolívares:</span> <span style="font-weight:800; color:#22c55e;">Bs. ${amountBs}</span></div>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px;">
              <div>
                <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:4px; text-transform:uppercase;">Número de Referencia Bancaria *</label>
                <input id="ob-proof-ref" type="text" value="${escapeHTML(wizardData.transferRef)}" placeholder="Ej: 04928172" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat'; font-size:0.85rem;">
              </div>
              
              <div>
                <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:4px; text-transform:uppercase;">Foto del Comprobante (Opcional)</label>
                <input id="ob-proof-file" type="file" accept="image/*" style="width:100%; box-sizing:border-box; padding:10px; border-radius:12px; border:1px dashed rgba(255,255,255,0.15); background:rgba(0,0,0,0.2); color:white; font-size:0.75rem;">
              </div>
            </div>
          </div>
        ` : wizardData.paymentMethod === 'ZELLE' ? `
          <!-- ZELLE USD -->
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:16px;">
            <div style="background:rgba(0,0,0,0.3); border-radius:12px; padding:12px; font-size:0.72rem; color:rgba(255,255,255,0.85); line-height:1.7; border:1px solid rgba(255,255,255,0.06); margin-bottom:12px;">
              <div style="display:flex; justify-content:space-between;"><span style="color:#999;">Email Zelle:</span> <span style="font-weight:800; color:#3b82f6;">pagos@slotyapp.com</span></div>
              <div style="display:flex; justify-content:space-between;"><span style="color:#999;">Titular:</span> <span style="font-weight:800;">Sloty Group LLC</span></div>
              <div style="display:flex; justify-content:space-between;"><span style="color:#999;">Monto a transferir:</span> <span style="font-weight:800; color:#22c55e;">$${price}.00 USD</span></div>
            </div>

            <div>
              <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:4px; text-transform:uppercase;">Nombre del Titular de la Cuenta Zelle *</label>
              <input id="ob-proof-ref" type="text" value="${escapeHTML(wizardData.transferRef)}" placeholder="Ej: Carlos Pérez" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat'; font-size:0.85rem;">
            </div>
          </div>
        ` : `
          <!-- EFECTIVO USD -->
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:16px;">
            <div style="background:rgba(0,0,0,0.3); border-radius:12px; padding:12px; font-size:0.72rem; color:rgba(255,255,255,0.85); line-height:1.7; border:1px solid rgba(255,255,255,0.06); margin-bottom:12px;">
              <div style="display:flex; justify-content:space-between;"><span style="color:#999;">Monto en Efectivo:</span> <span style="font-weight:800; color:#22c55e;">$${price}.00 USD</span></div>
              <div style="color:rgba(255,255,255,0.7); margin-top:4px;">El equipo Master coordinará la recepción de divisas directamente contigo por WhatsApp.</div>
            </div>

            <div>
              <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:4px; text-transform:uppercase;">Detalles / Persona que entrega</label>
              <input id="ob-proof-ref" type="text" value="${escapeHTML(wizardData.transferRef)}" placeholder="Ej: Pago directo en administración" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat'; font-size:0.85rem;">
            </div>
          </div>
        `}
      </div>
    `;
  };

  // --- Render del paso de Verificación Master (Paso 5) ---
  const renderSuccessStep = () => {
    const slotMsg = slotMessages[5];
    const plan = wizardData.selectedPlan || PLANS[0];

    return `
      ${getSlotSVG(slotMsg.expr, slotMsg.text)}

      <div style="text-align:center; margin-bottom:20px;">
        <div style="font-size:3.2rem; margin-bottom:8px;">⏳</div>
        <h2 style="font-size:1.35rem; font-weight:900; color:white; margin:0 0 8px;">¡Solicitud Enviada a Master!</h2>
        <p style="font-size:0.82rem; color:rgba(255,255,255,0.75); margin:0; line-height:1.6;">
          Hemos recibido los datos de <b style="color:#F5C518;">${escapeHTML(wizardData.buildingName)}</b> para el <b style="color:${plan.color};">Plan ${plan.name} ($${plan.price}/mes)</b>.
        </p>
      </div>

      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:18px; padding:18px; margin-bottom:20px;">
        <div style="font-size:0.7rem; font-weight:900; color:#F5C518; text-transform:uppercase; margin-bottom:12px; letter-spacing:1px;">Flujo de Activación</div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px; font-size:0.78rem; color:rgba(255,255,255,0.9);">
            <div style="width:24px; height:24px; background:#22c55e; color:#1a1a2e; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:0.75rem;">1</div>
            <span>Comprobante recibido y registrado en el cotejo de Master.</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px; font-size:0.78rem; color:rgba(255,255,255,0.9);">
            <div style="width:24px; height:24px; background:#F5C518; color:#1a1a2e; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:0.75rem;">2</div>
            <span>El equipo Master coteja el abono y activa tu edificio.</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px; font-size:0.78rem; color:rgba(255,255,255,0.9);">
            <div style="width:24px; height:24px; background:rgba(255,255,255,0.1); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:0.75rem;">3</div>
            <span>Recibirás un mensaje de WhatsApp con el acceso directo para iniciar.</span>
          </div>
        </div>
      </div>
    `;
  };

  // --- Render Principal ---
  const renderStep = () => {
    const slotMsg = slotMessages[currentStep] || slotMessages[1];

    container.innerHTML = `
      <div id="onboarding-layer" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,10,20,0.96); backdrop-filter:blur(20px); z-index:99999; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:20px; font-family:'Montserrat',sans-serif; color:white; box-sizing:border-box; overflow-y:auto;">

        <div style="width:100%; max-width:520px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:0.7rem; font-weight:900; color:#F5C518; text-transform:uppercase; letter-spacing:1px;">
              ${currentStep < 5 ? `Paso ${currentStep} de ${totalSteps - 1}` : '¡Solicitud Registrada!'} · ${getStepTitle()}
            </span>
            ${currentStep < 5 ? `<button type="button" id="onboarding-skip-btn" style="background:none; border:none; color:rgba(255,255,255,0.4); font-size:0.7rem; font-weight:700; cursor:pointer;">Saltar por ahora</button>` : ''}
          </div>
          <div style="width:100%; height:5px; background:rgba(255,255,255,0.06); border-radius:10px; overflow:hidden;">
            <div style="width:${(currentStep / totalSteps) * 100}%; height:100%; background:#F5C518; transition:width 0.4s cubic-bezier(0.4, 0, 0.2, 1);"></div>
          </div>
        </div>

        <div style="background:#16213e; width:100%; max-width:520px; border-radius:28px; padding:28px 24px; box-shadow:0 30px 80px rgba(0,0,0,0.7); border:1px solid rgba(255,255,255,0.06); box-sizing:border-box;">

          ${currentStep === 1 ? `
            ${getSlotSVG(slotMsg.expr, slotMsg.text)}

            <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:20px;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div>
                  <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:5px; text-transform:uppercase;">Nombre</label>
                  <input id="ob-first-name" type="text" value="${escapeHTML(wizardData.firstName)}" placeholder="Tu nombre" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat'; font-size:0.85rem;">
                </div>
                <div>
                  <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:5px; text-transform:uppercase;">Apellido</label>
                  <input id="ob-last-name" type="text" value="${escapeHTML(wizardData.lastName)}" placeholder="Tu apellido" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat'; font-size:0.85rem;">
                </div>
              </div>

              <div>
                <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:5px; text-transform:uppercase;">Email Administrador</label>
                <input id="ob-email" type="email" value="${escapeHTML(wizardData.email)}" placeholder="admin@edificio.com" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat'; font-size:0.85rem;">
              </div>

              <div>
                <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:5px; text-transform:uppercase;">Teléfono (WhatsApp)</label>
                <input id="ob-phone" type="tel" value="${escapeHTML(wizardData.phone)}" placeholder="+58 412 1234567" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat'; font-size:0.85rem;">
              </div>

              <div>
                <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:5px; text-transform:uppercase;">Tu Rol en el Condominio</label>
                <div style="display:flex; gap:8px;">
                  <button type="button" class="role-btn ${wizardData.role === 'admin' ? 'role-active' : ''}" data-role="admin" style="flex:1; padding:12px; border-radius:12px; border:2px solid ${wizardData.role === 'admin' ? '#F5C518' : 'rgba(255,255,255,0.08)'}; background:${wizardData.role === 'admin' ? 'rgba(245,197,24,0.12)' : 'rgba(0,0,0,0.2)'}; color:white; font-weight:800; font-size:0.78rem; cursor:pointer;">👤 Administrador / Junta</button>
                  <button type="button" class="role-btn ${wizardData.role === 'manager' ? 'role-active' : ''}" data-role="manager" style="flex:1; padding:12px; border-radius:12px; border:2px solid ${wizardData.role === 'manager' ? '#F5C518' : 'rgba(255,255,255,0.08)'}; background:${wizardData.role === 'manager' ? 'rgba(245,197,24,0.12)' : 'rgba(0,0,0,0.2)'}; color:white; font-weight:800; font-size:0.78rem; cursor:pointer;">🔧 Encargado / Técnico</button>
                </div>
              </div>
            </div>
          ` : ''}

          ${currentStep === 2 ? renderPlanStep() : ''}

          ${currentStep === 3 ? `
            ${getSlotSVG(slotMsg.expr, slotMsg.text)}

            <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:20px;">
              <div>
                <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:5px; text-transform:uppercase;">Nombre del Condominio / Edificio *</label>
                <input id="ob-bld-name" type="text" value="${escapeHTML(wizardData.buildingName)}" placeholder="Ej: Residencias Las Danielas" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat'; font-size:0.85rem;">
              </div>

              <div>
                <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:5px; text-transform:uppercase;">Tarifa Mensual Base ($ / mes)</label>
                <input id="ob-monthly-rate" type="number" step="0.01" value="${wizardData.monthlyRate}" placeholder="20.00" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat'; font-size:0.85rem;">
              </div>

              <div style="display:grid; grid-template-columns:1.4fr 1fr; gap:12px;">
                <div>
                  <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:5px; text-transform:uppercase;">Nombre Primera Planta</label>
                  <input id="ob-level-name" type="text" value="${escapeHTML(wizardData.levelName)}" placeholder="Ej: Nivel 1 / PB" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat'; font-size:0.85rem;">
                </div>
                <div>
                  <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:5px; text-transform:uppercase;">Puestos Planta 1</label>
                  <input id="ob-slots-count" type="number" min="1" max="500" value="${wizardData.slotsCount}" placeholder="15" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat'; font-size:0.85rem; text-align:center;">
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1.4fr 1fr; gap:12px;">
                <div>
                  <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:5px; text-transform:uppercase;">Nombre del Guardia</label>
                  <input id="ob-guard-name" type="text" value="${escapeHTML(wizardData.guardName)}" placeholder="Ej: Carlos Mendoza" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat'; font-size:0.85rem;">
                </div>
                <div>
                  <label style="font-size:0.65rem; font-weight:800; color:#F5C518; display:block; margin-bottom:5px; text-transform:uppercase;">PIN Guardia (4 dígitos)</label>
                  <input id="ob-guard-pin" type="password" maxlength="4" inputmode="numeric" value="${escapeHTML(wizardData.guardPin)}" placeholder="••••" style="width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:2px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2); color:white; font-size:1.1rem; font-weight:900; text-align:center; outline:none; font-family:'Montserrat'; letter-spacing:4px;">
                </div>
              </div>
            </div>
          ` : ''}

          ${currentStep === 4 ? renderCheckoutStep() : ''}

          ${currentStep === 5 ? renderSuccessStep() : ''}

          <!-- BOTONES DE ACCIÓN -->
          <div style="display:flex; gap:10px;">
            ${currentStep > 1 && currentStep < 5 ? `
              <button type="button" id="ob-btn-prev" style="flex:1; padding:16px; background:rgba(255,255,255,0.06); color:white; border:none; border-radius:14px; font-weight:800; font-size:0.8rem; cursor:pointer;">
                ← Atrás
              </button>
            ` : ''}
            <button type="button" id="ob-btn-next" style="flex:${currentStep > 1 && currentStep < 5 ? '2' : '1'}; padding:16px; background:#F5C518; color:#1a1a2e; border:none; border-radius:14px; font-weight:900; font-size:0.85rem; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; box-shadow:0 4px 20px rgba(245,197,24,0.25);">
              ${currentStep === 1 ? 'Continuar →' : currentStep === 2 ? 'Elegir este Plan →' : currentStep === 3 ? 'Ir a Pago →' : currentStep === 4 ? '📤 Enviar Comprobante a Master' : '✓ Entendido'}
            </button>
          </div>

        </div>
      </div>
    `;

    hookEvents();
  };

  // --- Controladores de Eventos ---
  const hookEvents = () => {
    const skipBtn = document.getElementById('onboarding-skip-btn');
    if (skipBtn) {
      skipBtn.onclick = () => {
        markOnboardingComplete(state);
        const layer = document.getElementById('onboarding-layer');
        if (layer) layer.remove();
        if (onComplete) onComplete();
      };
    }

    const prevBtn = document.getElementById('ob-btn-prev');
    if (prevBtn) {
      prevBtn.onclick = () => {
        currentStep--;
        renderStep();
      };
    }

    document.querySelectorAll('.role-btn').forEach(btn => {
      btn.onclick = () => {
        wizardData.role = btn.dataset.role;
        renderStep();
      };
    });

    document.querySelectorAll('.plan-card').forEach(card => {
      card.onclick = () => {
        const planId = card.dataset.plan;
        wizardData.selectedPlan = PLANS.find(p => p.id === planId) || PLANS[0];
        renderStep();
      };
    });

    const payPm = document.getElementById('pay-pm');
    const payZelle = document.getElementById('pay-zelle');
    const payCash = document.getElementById('pay-cash');
    if (payPm) {
      payPm.onclick = () => { wizardData.paymentMethod = 'PAGO_MOVIL'; renderStep(); };
    }
    if (payZelle) {
      payZelle.onclick = () => { wizardData.paymentMethod = 'ZELLE'; renderStep(); };
    }
    if (payCash) {
      payCash.onclick = () => { wizardData.paymentMethod = 'EFECTIVO'; renderStep(); };
    }

    const proofFile = document.getElementById('ob-proof-file');
    if (proofFile) {
      proofFile.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          wizardData.proofImageFile = e.target.files[0];
        }
      };
    }

    const nextBtn = document.getElementById('ob-btn-next');
    if (nextBtn) {
      nextBtn.onclick = async () => {
        if (currentStep === 1) {
          const firstName = document.getElementById('ob-first-name').value.trim();
          const lastName = document.getElementById('ob-last-name').value.trim();
          const email = document.getElementById('ob-email').value.trim();
          const phone = document.getElementById('ob-phone').value.trim();

          if (!firstName || !lastName) { alert('Por favor, ingresa tu nombre y apellido'); return; }
          if (!email || !email.includes('@')) { alert('Por favor, ingresa un email válido'); return; }
          if (!phone) { alert('Por favor, ingresa tu teléfono WhatsApp'); return; }

          wizardData.firstName = firstName;
          wizardData.lastName = lastName;
          wizardData.email = email;
          wizardData.phone = phone;

          state.admin_first_name = firstName;
          state.admin_last_name = lastName;
          state.admin_name = `${firstName} ${lastName}`;
          state.admin_email = email;
          state.admin_phone = phone;
          state.phone = phone;
          state.admin_role = wizardData.role;

          currentStep = 2;
          renderStep();
          return;
        }

        if (currentStep === 2) {
          if (!wizardData.selectedPlan) {
            alert('Por favor, selecciona un plan para continuar');
            return;
          }

          state.plan = wizardData.selectedPlan.id;
          state.plan_id = wizardData.selectedPlan.id;
          state.plan_name = wizardData.selectedPlan.name;
          state.plan_price = wizardData.selectedPlan.price;

          currentStep = 3;
          renderStep();
          return;
        }

        if (currentStep === 3) {
          const bName = document.getElementById('ob-bld-name').value.trim();
          const mRate = parseFloat(document.getElementById('ob-monthly-rate').value) || 20;
          const lName = document.getElementById('ob-level-name').value.trim();
          const sCount = parseInt(document.getElementById('ob-slots-count').value) || 15;
          const gName = document.getElementById('ob-guard-name').value.trim();
          const gPin = document.getElementById('ob-guard-pin').value.trim();

          if (!bName) { alert('Por favor, ingresa el nombre del condominio'); return; }
          if (!lName) { alert('Por favor, ingresa el nombre del primer nivel'); return; }
          if (sCount < 1) { alert('Debes tener al menos 1 puesto'); return; }

          if (wizardData.selectedPlan && typeof wizardData.selectedPlan.maxSlots === 'number' && sCount > wizardData.selectedPlan.maxSlots) {
            alert(`El plan ${wizardData.selectedPlan.name} permite un máximo de ${wizardData.selectedPlan.maxSlots} puestos.`);
            return;
          }

          if (!gName) { alert('Por favor, ingresa el nombre del guardia'); return; }
          if (!gPin || gPin.length !== 4) { alert('El PIN de guardia debe tener 4 dígitos'); return; }

          wizardData.buildingName = bName;
          wizardData.monthlyRate = mRate;
          wizardData.levelName = lName;
          wizardData.slotsCount = sCount;
          wizardData.guardName = gName;
          wizardData.guardPin = gPin;

          state.buildingName = bName;
          state.monthly_rate = mRate;

          currentStep = 4;
          renderStep();
          return;
        }

        if (currentStep === 4) {
          const plan = wizardData.selectedPlan || PLANS[0];
          const price = plan.price;
          const refVal = document.getElementById('ob-proof-ref')?.value.trim();

          if (!refVal && wizardData.paymentMethod !== 'EFECTIVO') {
            alert('Por favor, ingresa el número de referencia del pago o titular');
            return;
          }
          wizardData.transferRef = refVal || 'EFECTIVO';

          nextBtn.innerHTML = '⏳ Enviando a Master...';
          nextBtn.disabled = true;

          try {
            // 1. Crear Planta 1 y puestos si no existen
            if (!state.levels || state.levels.length === 0) {
              const slots = [];
              for (let i = 1; i <= wizardData.slotsCount; i++) {
                slots.push({
                  id: `s-${Date.now()}-${i}`,
                  label: `${i}`,
                  status: 'FREE',
                  category: 'VISITANTE',
                  plate: '',
                  entryTime: null,
                  metadata: {}
                });
              }
              state.levels = [{
                id: `lvl-${Date.now()}`,
                name: wizardData.levelName,
                color: '#3a86ff',
                slots: slots
              }];
            }

            // 2. Personal / Guardia inicial
            state.personnel = state.personnel || [];
            const newGuard = {
              id: `g-${Date.now()}`,
              name: wizardData.guardName,
              pin: wizardData.guardPin,
              phone: '',
              role: 'GUARDIA',
              active: true,
              photo_url: ''
            };
            state.personnel.push(newGuard);

            // 3. Subir imagen de comprobante a Supabase Storage si se adjuntó
            let proofUrl = '';
            if (wizardData.proofImageFile && state.buildingId) {
              try {
                const fileExt = wizardData.proofImageFile.name.split('.').pop() || 'jpg';
                const filePath = `${state.buildingId}/onboarding-${Date.now()}.${fileExt}`;
                const { data: uploadData, error: upErr } = await supabase.storage
                  .from('proofs')
                  .upload(filePath, wizardData.proofImageFile, { upsert: true });

                if (!upErr && uploadData?.path) {
                  const { data: pubUrl } = supabase.storage.from('proofs').getPublicUrl(uploadData.path);
                  proofUrl = pubUrl?.publicUrl || '';
                }
              } catch(e) {
                console.warn('[Sloty Onboarding] Storage upload error:', e);
              }
            }

            // 4. Insertar comprobante en building_payment_proofs (STATUS: PENDING)
            const proofPayload = {
              building_id: state.buildingId,
              plan_key: plan.id,
              amount: price,
              reference: `${wizardData.paymentMethod} - Ref: ${wizardData.transferRef}`,
              payment_date: new Date().toISOString().slice(0, 10),
              proof_image: proofUrl || null,
              status: 'PENDING'
            };

            if (state.buildingId) {
              try {
                await supabase.from('building_payment_proofs').insert(proofPayload);
              } catch(e) {
                console.warn('[Sloty Onboarding] Failed to insert proof in Supabase:', e);
              }
            }

            // 5. Respaldo local de comprobante
            try {
              const localProofs = JSON.parse(localStorage.getItem('sloty_pending_proofs') || '[]')
              localProofs.push({ ...proofPayload, savedAt: new Date().toISOString() })
              localStorage.setItem('sloty_pending_proofs', JSON.stringify(localProofs))
            } catch(e) {}

            // 6. Actualizar building en DB con estado PENDING_PROOF
            if (state.buildingId && !state.isBypass) {
              try {
                await supabase.from('buildings').update({
                  name: wizardData.buildingName,
                  admin_name: `${wizardData.firstName} ${wizardData.lastName}`,
                  admin_first_name: wizardData.firstName,
                  admin_last_name: wizardData.lastName,
                  admin_email: wizardData.email,
                  admin_phone: wizardData.phone,
                  phone: wizardData.phone,
                  plan: plan.id,
                  membership_status: 'PENDING_PROOF',
                  monthly_rate: wizardData.monthlyRate,
                  is_first_login: false,
                  onboarding_completed: true
                }).eq('id', state.buildingId);

                // Insertar guardia en DB
                await supabase.from('personnel').insert({
                  building_id: state.buildingId,
                  name: wizardData.guardName,
                  pin: wizardData.guardPin,
                  role: 'GUARDIA'
                }).catch(() => {});
              } catch(e) {
                console.warn('[Sloty Onboarding] Cloud sync failed:', e);
              }
            }

            // 7. Enviar WhatsApp oficial a Master (584120770776)
            try {
              const waData = formatProofWhatsAppMessage({
                buildingName: wizardData.buildingName,
                buildingCode: state.buildingId || 'SLO-NEW',
                adminName: `${wizardData.firstName} ${wizardData.lastName}`,
                planLabel: plan.name,
                amountUsd: price,
                amountBs: price * bcvRate,
                bcvRate: bcvRate,
                bank: wizardData.paymentMethod,
                reference: wizardData.transferRef,
                proofUrl: proofUrl || 'Registrado en sistema'
              });
              if (waData?.whatsappUrl) {
                window.open(waData.whatsappUrl, '_blank');
              }
            } catch(e) {
              console.warn('[Sloty Onboarding] WhatsApp trigger error:', e);
            }

            saveParkingState(state);

            currentStep = 5;
            renderStep();
          } catch(err) {
            console.error('Error durante el envío a Master:', err);
            alert('Hubo un inconveniente al registrar. Por favor, intenta nuevamente.');
            nextBtn.innerHTML = '📤 Enviar Comprobante a Master';
            nextBtn.disabled = false;
          }
          return;
        }

        if (currentStep === 5) {
          markOnboardingComplete(state);
          const layer = document.getElementById('onboarding-layer');
          if (layer) layer.remove();
          if (onComplete) onComplete();
          return;
        }
      };
    }
  };

  renderStep();
};

export default {
  PLANS,
  shouldShowOnboarding,
  markOnboardingComplete,
  renderOnboardingWizard
};
