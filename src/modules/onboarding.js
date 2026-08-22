/**
 * Onboarding Module v3 — Conversational Chat Wizard with Slot Mascot
 * Pure interactive chat interface with realistic typing indicators, sequential dialogue bubbles,
 * plan selection cards, Venezuelan payment methods, and automatic Master proof dispatch.
 */

import { escapeHTML } from '../utils/sanitize.js'
import { supabase, saveParkingState, getExchangeRate, isUUID } from '../db.js'
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

  if (state.buildingId && !state.isBypass && isUUID(state.buildingId)) {
    supabase.from('buildings').update({ is_first_login: false }).eq('id', state.buildingId)
      .then(() => console.log('[Sloty Onboarding] Flag is_first_login updated in DB'))
      .catch(err => console.warn('[Sloty Onboarding] Failed to update is_first_login in DB:', err));
  }
};

export const generateBuildingCode = (name) => {
  if (!name || typeof name !== 'string') return 'SLO-' + Math.floor(1000 + Math.random() * 9000);
  
  // Normalizar, remover acentos y caracteres especiales
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
    .sloty-typing-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      background: #F5C518;
      border-radius: 50%;
      margin: 0 2px;
      animation: slotyPulseDot 1.2s infinite ease-in-out both;
    }
    .sloty-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .sloty-typing-dot:nth-child(2) { animation-delay: -0.16s; }
    .sloty-typing-dot:nth-child(3) { animation-delay: 0s; }
    .sloty-chat-scroll::-webkit-scrollbar { width: 5px; }
    .sloty-chat-scroll::-webkit-scrollbar-track { background: transparent; }
    .sloty-chat-scroll::-webkit-scrollbar-thumb { background: rgba(245,197,24,0.2); border-radius: 10px; }
  `;
  document.head.appendChild(style);
};

// ================================================================
// CONVERSATIONAL CHAT WIZARD RENDERER
// ================================================================
export const renderOnboardingWizard = (container, state, onComplete) => {
  injectChatStyles();

  // Wizard conversational data
  const wizard = {
    step: 1,
    name: '',
    email: '',
    phone: '',
    buildingName: '',
    floors: 1,
    slots: 20,
    selectedPlan: null,
    paymentMethod: null,
    bcvRate: 36.50
  };

  // Fetch live exchange rate
  getExchangeRate().then(rate => {
    if (rate && Number(rate) > 0) wizard.bcvRate = Number(rate);
  }).catch(() => {});

  // Mount chat viewport container
  container.innerHTML = `
    <div id="sloty-chat-container" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:#121324; display:flex; flex-direction:column; z-index:99999; font-family:'Montserrat',sans-serif; color:white; box-sizing:border-box;">
      
      <!-- Top Header -->
      <div style="background:#1a1a2e; padding:16px 20px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(245,197,24,0.15); box-shadow:0 4px 20px rgba(0,0,0,0.3); z-index:10;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="position:relative;">
            ${getSlotAvatarSVG('happy')}
            <div style="position:absolute; bottom:2px; right:2px; width:9px; height:9px; background:#22c55e; border-radius:50%; border:2px solid #1a1a2e;"></div>
          </div>
          <div>
            <div style="font-weight:900; font-size:1rem; color:#F5C518; letter-spacing:0.5px; display:flex; align-items:center; gap:6px;">
              Slot <span style="background:rgba(245,197,24,0.15); color:#F5C518; font-size:0.6rem; padding:2px 6px; border-radius:6px; font-weight:800;">ASISTENTE VIRTUAL</span>
            </div>
            <div style="font-size:0.65rem; color:rgba(255,255,255,0.5);">Registro y Activación de Edificios</div>
          </div>
        </div>

        <button id="sloty-chat-exit" style="background:rgba(255,255,255,0.06); border:none; color:rgba(255,255,255,0.7); font-size:0.75rem; font-weight:800; padding:8px 14px; border-radius:12px; cursor:pointer; transition:all 0.2s;">
          ✕ Salir
        </button>
      </div>

      <!-- Messages Stream -->
      <div id="sloty-chat-messages" class="sloty-chat-scroll" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px; max-width:680px; width:100%; margin:0 auto; box-sizing:border-box;">
      </div>

      <!-- Active Input / Action Bar -->
      <div id="sloty-chat-input-bar" style="background:#1a1a2e; padding:16px 20px calc(env(safe-area-inset-bottom, 12px) + 12px); border-top:1px solid rgba(255,255,255,0.08); max-width:680px; width:100%; margin:0 auto; box-sizing:border-box;">
      </div>

    </div>
  `;

  const msgContainer = document.getElementById('sloty-chat-messages');
  const inputBar = document.getElementById('sloty-chat-input-bar');
  const exitBtn = document.getElementById('sloty-chat-exit');

  if (exitBtn) {
    exitBtn.onclick = () => {
      if (confirm('¿Deseas salir del registro de edificio? Podrás volver cuando quieras.')) {
        const root = document.getElementById('sloty-chat-container');
        if (root) root.remove();
        if (onComplete) onComplete();
      }
    };
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      msgContainer.scrollTop = msgContainer.scrollHeight;
    }, 50);
  };

  // Helper: Append User Message Bubble (Right)
  const appendUserBubble = (text) => {
    const bubble = document.createElement('div');
    bubble.className = 'sloty-chat-msg';
    bubble.style.cssText = 'align-self:flex-end; max-width:82%; display:flex; flex-direction:column; align-items:flex-end;';
    bubble.innerHTML = `
      <div style="background:#F5C518; color:#1a1a2e; font-weight:700; font-size:0.85rem; padding:12px 16px; border-radius:18px 18px 4px 18px; line-height:1.4; box-shadow:0 4px 15px rgba(245,197,24,0.2);">
        ${escapeHTML(text)}
      </div>
      <span style="font-size:0.6rem; color:rgba(255,255,255,0.3); margin-top:4px; margin-right:4px;">Tú</span>
    `;
    msgContainer.appendChild(bubble);
    scrollToBottom();
  };

  // Helper: Append Slot Message Bubble with Typing Animation (Left)
  const appendSlotBubble = (contentHTML, expression = 'happy', callback = null) => {
    // 1. Show typing indicator
    const typingId = 'typing-' + Date.now();
    const typingBubble = document.createElement('div');
    typingBubble.id = typingId;
    typingBubble.className = 'sloty-chat-msg';
    typingBubble.style.cssText = 'align-self:flex-start; display:flex; gap:10px; align-items:flex-end; max-width:85%;';
    typingBubble.innerHTML = `
      ${getSlotAvatarSVG('talking')}
      <div style="background:rgba(255,255,255,0.06); padding:12px 18px; border-radius:18px 18px 18px 4px; display:flex; align-items:center; gap:4px;">
        <span class="sloty-typing-dot"></span>
        <span class="sloty-typing-dot"></span>
        <span class="sloty-typing-dot"></span>
      </div>
    `;
    msgContainer.appendChild(typingBubble);
    scrollToBottom();

    // 2. Resolve typing indicator after delay
    setTimeout(() => {
      const elTyping = document.getElementById(typingId);
      if (elTyping) elTyping.remove();

      const bubble = document.createElement('div');
      bubble.className = 'sloty-chat-msg';
      bubble.style.cssText = 'align-self:flex-start; display:flex; gap:10px; align-items:flex-start; max-width:92%; width:100%;';
      bubble.innerHTML = `
        ${getSlotAvatarSVG(expression)}
        <div style="flex:1; background:#1e2038; border:1px solid rgba(245,197,24,0.15); color:white; font-size:0.85rem; padding:14px 18px; border-radius:4px 18px 18px 18px; line-height:1.5; box-shadow:0 6px 25px rgba(0,0,0,0.3);">
          ${contentHTML}
        </div>
      `;
      msgContainer.appendChild(bubble);
      scrollToBottom();
      if (callback) callback(bubble);
    }, 550);
  };

  // ==============================================================
  // FLUJO CONVERSACIONAL PASO A PASO
  // ==============================================================

  // Paso 1: Saludo y Nombre
  const startStep1 = () => {
    appendSlotBubble(`
      ¡Hola! 👋 Soy <b>Slot</b>, tu asistente inteligente para la gestión de estacionamientos.<br><br>
      Te guiaré paso a paso para configurar tu edificio y activar tu cuenta en pocos minutos. 🚀<br><br>
      Para comenzar, <b>¿cuál es tu nombre y apellido?</b>
    `, 'happy');

    inputBar.innerHTML = `
      <form id="sloty-form-step1" style="display:flex; gap:10px;">
        <input id="sloty-input-name" type="text" placeholder="Ej: María González" required autofocus
          style="flex:1; padding:14px 16px; border-radius:14px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.25); color:white; font-family:'Montserrat',sans-serif; font-size:0.9rem; font-weight:700; outline:none;" />
        <button type="submit" style="padding:14px 22px; background:#F5C518; color:#1a1a2e; border:none; border-radius:14px; font-weight:900; font-size:0.9rem; cursor:pointer; flex-shrink:0;">
          Enviar ➔
        </button>
      </form>
    `;

    document.getElementById('sloty-form-step1').onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('sloty-input-name').value.trim();
      if (!name) return;
      wizard.name = name;
      appendUserBubble(name);
      inputBar.innerHTML = '';
      startStep2();
    };
  };

  // Paso 2: Correo y Teléfono WhatsApp
  const startStep2 = () => {
    appendSlotBubble(`
      ¡Mucho gusto, <b>${escapeHTML(wizard.name)}</b>! 🚗✨<br><br>
      Para vincular tu usuario administrador y enviarte las credenciales oficiales de acceso, <b>¿cuál es tu correo y número de WhatsApp?</b>
    `, 'excited');

    inputBar.innerHTML = `
      <form id="sloty-form-step2" style="display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; gap:10px;">
          <input id="sloty-input-email" type="email" placeholder="correo@ejemplo.com" required
            style="flex:1; padding:12px 14px; border-radius:12px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.25); color:white; font-family:'Montserrat',sans-serif; font-size:0.85rem; font-weight:700; outline:none;" />
          <input id="sloty-input-phone" type="tel" placeholder="04121234567" required
            style="flex:1; padding:12px 14px; border-radius:12px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.25); color:white; font-family:'Montserrat',sans-serif; font-size:0.85rem; font-weight:700; outline:none;" />
        </div>
        <button type="submit" style="width:100%; padding:14px; background:#F5C518; color:#1a1a2e; border:none; border-radius:14px; font-weight:900; font-size:0.85rem; cursor:pointer;">
          Continuar ➔
        </button>
      </form>
    `;

    document.getElementById('sloty-form-step2').onsubmit = (e) => {
      e.preventDefault();
      const email = document.getElementById('sloty-input-email').value.trim();
      const phone = document.getElementById('sloty-input-phone').value.trim();
      if (!email || !phone) return;
      wizard.email = email;
      wizard.phone = phone;
      appendUserBubble(`${email} · ${phone}`);
      inputBar.innerHTML = '';
      startStep3();
    };
  };

  // Paso 3: Nombre del Edificio y Estructura
  const startStep3 = () => {
    appendSlotBubble(`
      ¡Excelente! 🏢 Ahora cuéntame sobre el condominio o estacionamiento.<br><br>
      <b>¿Cómo se llama tu edificio y cuántos puestos de estacionamiento tiene?</b>
    `, 'thinking');

    inputBar.innerHTML = `
      <form id="sloty-form-step3" style="display:flex; flex-direction:column; gap:10px;">
        <input id="sloty-input-bld" type="text" placeholder="Ej: Residencias Los Rosales" required
          style="width:100%; box-sizing:border-box; padding:12px 14px; border-radius:12px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.25); color:white; font-family:'Montserrat',sans-serif; font-size:0.85rem; font-weight:700; outline:none;" />
        
        <div style="display:flex; gap:10px;">
          <div style="flex:1;">
            <label style="font-size:0.6rem; color:rgba(255,255,255,0.4); text-transform:uppercase; font-weight:800; display:block; margin-bottom:4px;">Niveles / Pisos</label>
            <input id="sloty-input-floors" type="number" min="1" max="20" value="1" required
              style="width:100%; box-sizing:border-box; padding:12px 14px; border-radius:12px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.25); color:white; font-family:'Montserrat',sans-serif; font-size:0.85rem; font-weight:700; outline:none;" />
          </div>
          <div style="flex:1;">
            <label style="font-size:0.6rem; color:rgba(255,255,255,0.4); text-transform:uppercase; font-weight:800; display:block; margin-bottom:4px;">Total Puestos</label>
            <input id="sloty-input-slots" type="number" min="1" max="500" value="25" required
              style="width:100%; box-sizing:border-box; padding:12px 14px; border-radius:12px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.25); color:white; font-family:'Montserrat',sans-serif; font-size:0.85rem; font-weight:700; outline:none;" />
          </div>
        </div>

        <button type="submit" style="width:100%; padding:14px; background:#F5C518; color:#1a1a2e; border:none; border-radius:14px; font-weight:900; font-size:0.85rem; cursor:pointer;">
          Guardar y Ver Planes ➔
        </button>
      </form>
    `;

    document.getElementById('sloty-form-step3').onsubmit = (e) => {
      e.preventDefault();
      const bldName = document.getElementById('sloty-input-bld').value.trim();
      const floors = parseInt(document.getElementById('sloty-input-floors').value) || 1;
      const slots = parseInt(document.getElementById('sloty-input-slots').value) || 25;
      if (!bldName) return;

      wizard.buildingName = bldName;
      wizard.floors = floors;
      wizard.slots = slots;

      appendUserBubble(`${bldName} (${floors} Piso(s) · ${slots} Puestos)`);
      inputBar.innerHTML = '';
      startStep4();
    };
  };

  // Paso 4: Selección de Planes en el Chat
  const startStep4 = () => {
    let plansHTML = `
      <div style="margin-bottom:12px;">
        ¡Perfecto! 🎉 Según el tamaño de <b>${escapeHTML(wizard.buildingName)}</b>, aquí tienes los planes oficiales de Sloty (mensualidades fijas sin cargos ocultos):
      </div>
      <div style="display:flex; flex-direction:column; gap:12px; margin-top:14px;">
    `;

    PLANS.forEach(p => {
      plansHTML += `
        <div style="background:rgba(255,255,255,0.03); border:2px solid ${p.color}; border-radius:16px; padding:16px; position:relative; box-shadow:0 4px 15px rgba(0,0,0,0.2);">
          ${p.badge ? `<div style="position:absolute; top:-10px; right:16px; background:${p.color}; color:#1a1a2e; padding:3px 10px; border-radius:12px; font-size:0.6rem; font-weight:900; text-transform:uppercase;">${p.badge}</div>` : ''}
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.4rem;">${p.icon}</span>
              <div>
                <div style="font-weight:900; font-size:0.95rem; color:${p.color};">Plan ${p.name}</div>
                <div style="font-size:0.65rem; color:rgba(255,255,255,0.4);">${typeof p.maxSlots === 'number' ? `Hasta ${p.maxSlots} puestos` : p.maxSlots}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <span style="font-size:1.3rem; font-weight:900; color:white;">$${p.price}</span>
              <span style="font-size:0.7rem; color:rgba(255,255,255,0.4);">${p.period}</span>
            </div>
          </div>
          <div style="font-size:0.7rem; color:rgba(255,255,255,0.7); margin-bottom:12px; line-height:1.4;">
            ${p.description}
          </div>
          <button data-plan-id="${p.id}" class="sloty-btn-select-plan" style="width:100%; padding:10px; background:${p.color}; color:#1a1a2e; border:none; border-radius:10px; font-weight:900; font-size:0.75rem; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px;">
            Elegir ${p.name} ($${p.price}/mes)
          </button>
        </div>
      `;
    });

    plansHTML += `</div>`;

    appendSlotBubble(plansHTML, 'excited', (bubble) => {
      bubble.querySelectorAll('.sloty-btn-select-plan').forEach(btn => {
        btn.onclick = () => {
          const planId = btn.dataset.planId;
          const chosenPlan = PLANS.find(p => p.id === planId);
          if (!chosenPlan) return;
          wizard.selectedPlan = chosenPlan;
          appendUserBubble(`He seleccionado el Plan ${chosenPlan.name} ($${chosenPlan.price}/mes)`);
          startStep5();
        };
      });
    });
  };

  // Paso 5: Selección de Método de Pago y Formulario de Comprobante
  const startStep5 = () => {
    const plan = wizard.selectedPlan;

    appendSlotBubble(`
      ¡Excelente elección! 🌟 El <b>Plan ${plan.name} ($${plan.price}/mes)</b> dejará tu condominio completamente operativo.<br><br>
      <b>¿Por cuál método deseas realizar el pago para la activación?</b>
    `, 'happy', (bubble) => {
      inputBar.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
            <button id="sloty-pay-pm" style="padding:12px 8px; border-radius:12px; border:1px solid #F5C518; background:rgba(245,197,24,0.1); color:white; font-weight:800; font-size:0.75rem; cursor:pointer; text-align:center;">
              💳 Pago Móvil
            </button>
            <button id="sloty-pay-zelle" style="padding:12px 8px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:white; font-weight:800; font-size:0.75rem; cursor:pointer; text-align:center;">
              🏦 Zelle USD
            </button>
            <button id="sloty-pay-cash" style="padding:12px 8px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:white; font-weight:800; font-size:0.75rem; cursor:pointer; text-align:center;">
              💵 Efectivo USD
            </button>
          </div>
        </div>
      `;

      document.getElementById('sloty-pay-pm').onclick = () => renderPaymentDetails('PAGO_MOVIL');
      document.getElementById('sloty-pay-zelle').onclick = () => renderPaymentDetails('ZELLE');
      document.getElementById('sloty-pay-cash').onclick = () => renderPaymentDetails('CASH');
    });
  };

  // Render Detalle del Método y Envío de Comprobante
  const renderPaymentDetails = (method) => {
    wizard.paymentMethod = method;
    inputBar.innerHTML = '';

    const plan = wizard.selectedPlan;
    const amountBs = (plan.price * wizard.bcvRate).toFixed(2);

    let paymentDetailsHTML = '';
    if (method === 'PAGO_MOVIL') {
      appendUserBubble('Pago Móvil (Bolívares)');
      paymentDetailsHTML = `
        <div style="font-size:0.8rem; line-height:1.5;">
          Aquí tienes los datos oficiales de <b>Pago Móvil Sloty</b> a tasa BCV (<b>${wizard.bcvRate.toFixed(2)} Bs/$</b>):<br><br>
          <div style="background:#0f1127; border:1px solid rgba(245,197,24,0.3); border-radius:14px; padding:14px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Banco:</span> <b>Banco Exterior (0115)</b></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Cédula:</span> <b>V-27031049</b></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Teléfono:</span> <b>04129135799</b></div>
            <div style="display:flex; justify-content:space-between; color:#F5C518; font-weight:900; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">
              <span>Monto a transferir:</span> <span>Bs. ${amountBs} ($${plan.price} USD)</span>
            </div>
          </div>
          Ingresa los datos de tu transferencia para enviarlos a <b>Master</b>:
        </div>
      `;
    } else if (method === 'ZELLE') {
      appendUserBubble('Zelle USD');
      paymentDetailsHTML = `
        <div style="font-size:0.8rem; line-height:1.5;">
          Datos oficiales para transferencia por <b>Zelle</b>:<br><br>
          <div style="background:#0f1127; border:1px solid rgba(245,197,24,0.3); border-radius:14px; padding:14px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Titular:</span> <b>Sloty Technologies</b></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Correo Zelle:</span> <b>pagos@slotyapp.com</b></div>
            <div style="display:flex; justify-content:space-between; color:#F5C518; font-weight:900; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">
              <span>Monto Total:</span> <span>$${plan.price} USD</span>
            </div>
          </div>
          Ingresa el nombre del titular o correo emisor y la referencia:
        </div>
      `;
    } else {
      appendUserBubble('Efectivo USD');
      paymentDetailsHTML = `
        <div style="font-size:0.8rem; line-height:1.5;">
          Has seleccionado <b>Efectivo USD ($${plan.price})</b>.<br><br>
          Un ejecutivo de Sloty coordinará la entrega y validación de tu recibo para activar tu cuenta de inmediato.
        </div>
      `;
    }

    appendSlotBubble(paymentDetailsHTML, 'talking', (bubble) => {
      inputBar.innerHTML = `
        <form id="sloty-form-proof" style="display:flex; flex-direction:column; gap:10px;">
          ${method !== 'CASH' ? `
            <div style="display:flex; gap:10px;">
              <input id="proof-bank-name" type="text" placeholder="${method === 'ZELLE' ? 'Titular / Correo Zelle' : 'Banco emisor (Ej: Banesco)'}" required
                style="flex:1; padding:12px 14px; border-radius:12px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.25); color:white; font-family:'Montserrat',sans-serif; font-size:0.85rem; font-weight:700; outline:none;" />
              <input id="proof-ref-num" type="text" placeholder="Número de Referencia" required
                style="flex:1; padding:12px 14px; border-radius:12px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.25); color:white; font-family:'Montserrat',sans-serif; font-size:0.85rem; font-weight:700; outline:none;" />
            </div>
            
            <div>
              <input type="file" id="proof-file-input" accept="image/*,.pdf" style="display:none;" />
              <button id="proof-attach-btn" type="button" style="width:100%; padding:10px; border-radius:12px; border:1px dashed rgba(245,197,24,0.4); background:rgba(245,197,24,0.05); color:#F5C518; font-weight:700; font-size:0.75rem; cursor:pointer;">
                📎 Adjuntar Captura / Comprobante (opcional)
              </button>
              <div id="proof-file-label" style="font-size:0.7rem; color:#22c55e; margin-top:4px; text-align:center; display:none;"></div>
            </div>
          ` : ''}

          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="proof-agree-terms" checked required style="accent-color:#F5C518; width:16px; height:16px;" />
            <label for="proof-agree-terms" style="font-size:0.65rem; color:rgba(255,255,255,0.6);">Acepto los términos de activación del servicio Sloty</label>
          </div>

          <button id="proof-submit-btn" type="submit" style="width:100%; padding:14px; background:#F5C518; color:#1a1a2e; border:none; border-radius:14px; font-weight:900; font-size:0.85rem; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px;">
            ${method === 'CASH' ? 'Confirmar Solicitud en Efectivo ➔' : 'Enviar Comprobante a Master ➔'}
          </button>
          <div id="proof-error-msg" style="color:#ef4444; font-size:0.75rem; text-align:center; display:none;"></div>
        </form>
      `;

      let selectedFile = null;
      const fileInput = document.getElementById('proof-file-input');
      const attachBtn = document.getElementById('proof-attach-btn');
      const fileLabel = document.getElementById('proof-file-label');

      if (attachBtn && fileInput) {
        attachBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
          if (e.target.files && e.target.files[0]) {
            selectedFile = e.target.files[0];
            fileLabel.textContent = `✓ Archivo adjunto: ${selectedFile.name}`;
            fileLabel.style.display = 'block';
          }
        };
      }

      document.getElementById('sloty-form-proof').onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('proof-submit-btn');
        const errMsg = document.getElementById('proof-error-msg');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Enviando a Master...';

        const bankName = document.getElementById('proof-bank-name')?.value.trim() || (method === 'CASH' ? 'Efectivo USD' : 'Zelle');
        const refNum = document.getElementById('proof-ref-num')?.value.trim() || 'EFECTIVO-' + Date.now().toString().slice(-6);

        try {
          // 1. Create or resolve building in Supabase with customized code from building name
          const newCode = generateBuildingCode(wizard.buildingName);
          let newBuildingId = null;

          const { data: bldCreated, error: bldErr } = await supabase
            .from('buildings')
            .insert({
              name: wizard.buildingName,
              code: newCode,
              membership_status: 'PENDING_PROOF',
              plan: plan.id,
              monthly_rate: 20,
              is_first_login: false,
              phone: wizard.phone,
              admin_email: wizard.email,
              admin_name: wizard.name
            })
            .select()
            .single();

          if (bldCreated) {
            newBuildingId = bldCreated.id;
          }

          // 2. Upload proof if file provided
          let finalProofUrl = null;
          if (selectedFile && newBuildingId) {
            const fileName = `${newBuildingId}/${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
            try {
              const { data: uploadData } = await supabase.storage
                .from('payment-proofs')
                .upload(fileName, selectedFile, { upsert: true });
              
              if (uploadData) {
                const { data: pubUrl } = supabase.storage.from('payment-proofs').getPublicUrl(fileName);
                finalProofUrl = pubUrl?.publicUrl;
              }
            } catch (storageErr) {
              console.warn('[Sloty Storage] Storage upload warning:', storageErr);
            }
          }

          // 3. Register payment proof in Supabase table
          if (newBuildingId) {
            await supabase.from('building_payment_proofs').insert({
              building_id: newBuildingId,
              plan_key: plan.id,
              amount: plan.price,
              payment_method: method,
              bank: bankName,
              reference: refNum,
              status: 'PENDING',
              proof_url: finalProofUrl,
              proof_image: finalProofUrl
            });
          }

          // 4. Update local storage state
          state.buildingId = newBuildingId || 'test-building-id';
          state.buildingName = wizard.buildingName;
          state.buildingCode = newCode;
          state.plan = plan.id;
          saveParkingState(state);

          // 5. Generate WhatsApp direct message link
          const waData = formatProofWhatsAppMessage({
            buildingName: wizard.buildingName,
            buildingCode: newCode,
            adminName: wizard.name,
            planLabel: plan.name,
            amountUsd: plan.price,
            amountBs: Number(amountBs),
            bcvRate: wizard.bcvRate,
            bank: bankName,
            reference: refNum,
            proofUrl: finalProofUrl || (selectedFile ? `Archivo: ${selectedFile.name}` : 'Enviado por la plataforma'),
            masterPhone: '584120770776'
          });

          inputBar.innerHTML = '';
          appendUserBubble(`Comprobante enviado (Ref: ${refNum})`);

          // Final Success Celebration in Chat
          appendSlotBubble(`
            <div style="text-align:center; padding:10px 0;">
              <div style="font-size:3rem; margin-bottom:8px; animation:slotyPulseDot 1s infinite alternate;">🎉</div>
              <h3 style="color:#F5C518; font-size:1.1rem; font-weight:900; margin-bottom:6px;">¡SOLICITUD RECIBIDA CON ÉXITO!</h3>
              <p style="font-size:0.8rem; color:rgba(255,255,255,0.7); line-height:1.5; margin-bottom:14px;">
                Hemos registrado a <b>${escapeHTML(wizard.buildingName)}</b> (Código: <b style="color:#F5C518;">${newCode}</b>).<br>
                El equipo <b>Master</b> verificará tu pago y activará tu cuenta de inmediato.
              </p>
              
              <a href="${waData.whatsappUrl}" target="_blank" style="display:block; width:100%; box-sizing:border-box; padding:14px; background:#25D366; color:white; border-radius:14px; font-weight:900; font-size:0.85rem; text-decoration:none; margin-bottom:10px; box-shadow:0 4px 15px rgba(37,211,102,0.3);">
                📲 ABRIR WHATSAPP Y NOTIFICAR A MASTER
              </a>

              <button id="sloty-finish-btn" style="width:100%; padding:12px; background:rgba(255,255,255,0.06); color:white; border:none; border-radius:12px; font-weight:700; font-size:0.75rem; cursor:pointer;">
                Ir al Inicio
              </button>
            </div>
          `, 'excited', (bubble) => {
            const finishBtn = bubble.querySelector('#sloty-finish-btn');
            if (finishBtn) {
              finishBtn.onclick = () => {
                const root = document.getElementById('sloty-chat-container');
                if (root) root.remove();
                if (onComplete) onComplete();
              };
            }
          });

        } catch (err) {
          console.error('[Sloty Chat] Error enviando comprobante:', err);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reintentar Envío';
          errMsg.textContent = 'Hubo un inconveniente al guardar. Puedes abrir WhatsApp directamente con el botón.';
          errMsg.style.display = 'block';
        }
      };
    });
  };

  // Launch initial conversational step
  startStep1();
};

export { PLANS as defaultPlans };
