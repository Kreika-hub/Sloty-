import { getParkingState, saveParkingState, logAudit, getCleanPrefix, supabase, logMovement, syncDown, hasFeature, getBuildingPlan, showToast, getExchangeRate } from '../db.js'

const checkExpiringSubscriptions = async (buildingId) => {
  const today   = new Date();
  const in3days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [{ data: expired }, { data: expiring }] = await Promise.all([
    supabase.from('subscriptions')
      .select('id, resident_name, expiry_date, phone')
      .eq('building_id', buildingId)
      .lt('expiry_date', today.toISOString())
      .eq('status', 'ACTIVE'),
    supabase.from('subscriptions')
      .select('id, resident_name, expiry_date, phone')
      .eq('building_id', buildingId)
      .lte('expiry_date', in3days.toISOString())
      .gte('expiry_date', today.toISOString())
  ]);

  const expiredCount  = (expired  || []).length;
  const expiringCount = (expiring || []).length;
  if (expiredCount === 0 && expiringCount === 0) return;

  const existing = document.getElementById('expiry-alert-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'expiry-alert-banner';
  banner.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:9999;
    background:#e63946;color:white;padding:10px 16px;font-size:0.75rem;
    font-weight:900;display:flex;justify-content:space-between;align-items:center;`;
  banner.innerHTML = `
    <span>
      ${expiredCount  > 0 ? `🚨 ${expiredCount} vencida${expiredCount  !== 1 ? 's' : ''}` : ''}
      ${expiringCount > 0 ? `⚠️ ${expiringCount} vence${expiringCount !== 1 ? 'n' : ''} en 3 días` : ''}
    </span>
    <div style="display:flex;gap:8px;align-items:center;">
      <button onclick="handleAction('GO_TO_SUBS')"
        style="background:white;color:#e63946;border:none;border-radius:6px;
               padding:4px 10px;font-size:0.65rem;font-weight:900;cursor:pointer;">
        VER
      </button>
      <button onclick="document.getElementById('expiry-alert-banner').remove()"
        style="background:transparent;color:white;border:none;
               font-size:1.2rem;cursor:pointer;line-height:1;">×</button>
    </div>`;
  document.body.appendChild(banner);
};

export const initAdmin = (container) => {
  console.log('[Sloty] Inicializando Panel Admin...')
  let activeTab = 'HOME'
  let reportFilter = 'HOY'
  let pendingAction = null // { type, name, lName, sLabel, guardId }
  let editingLevel = null // Level name being renamed
  let editingGuard = null // Guard ID being edited
  let editingResident = null // Resident ID being edited
  let openPaletteLevel = null // Level name with open palette
  let activeSettingsMenu = 'MAIN' // MAIN, TARIFFS, VISITORS, AUDIT
  let cachedMetrics = null
  let metricsLoading = false

  window.handleAction = (type, payload) => {
    if (actions[type]) actions[type](payload)
  }

  let cachedSubs = null;
  let cachedSubsAt = 0;
  const SUBS_TTL = 30_000;

  let cachedFinance = null;
  let cachedFinanceAt = 0;
  const FINANCE_TTL = 60_000;

  let financeChannel = null;

  const subscribeFinanceRealtime = (buildingId) => {
    if (financeChannel) return; // ya suscrito
    financeChannel = supabase
      .channel('finance-payments')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `building_id=eq.${buildingId}`
      }, () => {
        cachedFinance = null; // invalida cache
        cachedSubsAt = 0;     // invalida subs también
      })
      .subscribe();
  };

  const unsubscribeFinanceRealtime = () => {
    if (financeChannel) {
      supabase.removeChannel(financeChannel);
      financeChannel = null;
    }
  };

  const getSubsCached = async (buildingId) => {
    if (cachedSubs && Date.now() - cachedSubsAt < SUBS_TTL) return cachedSubs;
    const [subsRes, bldRes] = await Promise.all([
      supabase.from('subscriptions')
        .select('id,resident_name,plate,expiry_date,custom_price,tower,apt,phone,is_coming,slots_count,status')
        .eq('building_id', buildingId)
        .order('created_at', { ascending: false }),
      supabase.from('buildings')
        .select('monthly_rate,monthly_slots_limit')
        .eq('id', buildingId).single()
    ]);
    cachedSubs = { subs: subsRes.data || [], bld: bldRes.data };
    cachedSubsAt = Date.now();
    return cachedSubs;
  };

  const ICONS = {
    HOME: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    HISTORY: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    FINANCE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    STRUCTURE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    PERSONAL: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    LOGOUT: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    TRASH: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6m4-4v6"/></svg>`,
    EDIT: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    PLUS: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    SETTINGS: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    BELL: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    PALETTE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.647-.494 2.091-1.243.221-.374.332-.811.391-1.242.16-.58.148-1.167.373-1.607.453-.88 1.447-1.408 2.51-1.408H20c1.1 0 2-.9 2-2 0-5.5-4.5-10-10-10z"/></svg>`,
    SUBS: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>`,
    CARD: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="12" y2="16"/></svg>`,
    WHATSAPP: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-7.6 8.38 8.38 0 0 1 9 9.1z"/></svg>`
  }

  // --- DOM Elements Cache ---
  let elMain = null
  let elStatus = null

  const getCategoryColor = (cat, categories = []) => {
    const found = categories.find(c => c.id === cat)
    return found ? found.color : '#F5C518'
  }

  const getCategoryLabel = (cat, categories = []) => {
    const found = categories.find(c => c.id === cat)
    return found ? found.tag : 'V'
  }

  // --- ACTIONS ---
  const actions = {
    GO_TO_SUBS: () => {
      activeTab = 'SUBS';
      document.getElementById('expiry-alert-banner')?.remove();
      render();
    },
    ACTIVATE_PUSH: async () => {
      const { subscribeToPushNotifications } = await import('./push.js');
      const s = getParkingState()
      const email = s.adminInfo?.email || 'admin@sloty.com'
      await subscribeToPushNotifications(s.buildingId, 'ADMIN', email)
    },
    TOGGLE_COLLAPSE: (btn) => {
      const name = btn.dataset.name
      const state = getParkingState()
      const level = state.levels.find(l => l.name === name)
      if (level) {
        level.collapsed = !level.collapsed
        saveParkingState(state)
        render()
      }
    },
    START_RENAME: (btn) => {
      editingLevel = btn.dataset.name
      render()
    },
    CONFIRM_RENAME: (btn) => {
      const oldName = btn.dataset.oldname
      const newName = document.getElementById(`rename-input-${oldName}`).value.trim()
      if (!newName || newName === oldName) return editingLevel = null, render()
      
      const state = getParkingState()
      const level = state.levels.find(l => l.name === oldName)
      if (level) {
        level.name = newName
        logAudit(`Renombró planta: ${oldName} a ${newName}`)
        saveParkingState(state)
        editingLevel = null
        render()
      }
    },
    SET_LEVEL_COLOR: (btn) => {
      const name = btn.dataset.name; const color = btn.dataset.color;
      const state = getParkingState(); const level = state.levels.find(l => l.name === name);
      if (level) { level.color = color; saveParkingState(state); openPaletteLevel = null; render(); }
    },
    TOGGLE_PALETTE: (btn) => {
      const name = btn.dataset.name
      openPaletteLevel = (openPaletteLevel === name) ? null : name
      render()
    },
    CANCEL_RENAME: () => {
      editingLevel = null
      render()
    },
    SHOW_PLANS: async () => {
       const state = getParkingState()
       // Redirect to main.js's native plan selection if exposed, 
       // but for now we can trigger it by simulating a register screen
       const mainModal = document.getElementById('login-screen')
       if (mainModal) {
         mainModal.classList.remove('hidden')
         // We need access to renderPlanSelection from main.js
         window.dispatchEvent(new CustomEvent('sloty_show_plans', { 
           detail: { id: state.buildingId, name: state.buildingName } 
         }))
       }
    },
    DELETE_LEVEL: (btn) => {
      const name = btn.dataset.name
      pendingAction = { type: 'LEVEL', name }
      render()
    },
    DELETE_SLOT: (btn) => {
      const lName = btn.dataset.levelname
      const sLabel = btn.dataset.label
      pendingAction = { type: 'SLOT', lName, sLabel }
      render()
    },
    ADD_SLOT: (btn) => {
      const lName = btn.dataset.name
      const state = getParkingState()
      const level = state.levels.find(l => l.name === lName)
      if (level) {
        const prefix = lName.substring(0, 2).toUpperCase()
        const newNum = (level.slots.length + 1).toString().padStart(2, '0')
        const newLbl = `${prefix}-${newNum}`
        level.slots.push({ label: newLbl, status: 'FREE', category: 'VISITANTE' })
        logAudit(`Añadió puesto: ${newLbl} en ${lName}`)
        saveParkingState(state)
        render()
      }
    },
    GENERATE: () => {
      const name = document.getElementById('level-name').value.trim()
      const cap = parseInt(document.getElementById('level-capacity').value)
      if (!name || isNaN(cap) || cap < 1) return alert('Ingresa nombre y capacidad válida')
      const state = getParkingState()
      if (state.levels.find(l => l.name === name)) return alert('Ya existe esa planta')
      const prefix = name.substring(0, 2).toUpperCase()
      state.levels.push({
        name, capacity: cap, collapsed: false,
        slots: Array.from({length: cap}, (_, i) => ({
          label: `${prefix}-${(i+1).toString().padStart(2, '0')}`,
          status: 'FREE',
          category: 'VISITANTE'
        }))
      })
      logAudit(`Generó planta: ${name}`)
      saveParkingState(state)
      render()
    },
    ADD_GUARD: async () => {
      const name = document.getElementById('guard-name').value.trim();
      const phone = document.getElementById('guard-phone').value.trim();
      const shift = document.getElementById('guard-shift').value;
      const photoEl = document.getElementById('guard-photo-preview');
      const photo = (photoEl && photoEl.style.display !== 'none') ? photoEl.src : null;
      
      if (!name || !phone) {
        pendingAction = {
          type: 'CUSTOM_MODAL',
          title: '⚠️ DATOS INCOMPLETOS',
          content: `<p style="color:#666; font-weight:700;">El nombre y el teléfono son obligatorios.</p>`
        };
        render();
        return;
      }
      
      const state = getParkingState();
      state.personnel = state.personnel || [];
      
      if (editingGuard) {
        const idx = state.personnel.findIndex(p => p.id === editingGuard);
        if (idx !== -1) state.personnel[idx] = { ...state.personnel[idx], name, phone, shift, photo };
        editingGuard = null;
      } else {
        // Al crear nuevo, NO le ponemos PIN. Se creará vía Onboarding
        state.personnel.push({ id: crypto.randomUUID(), name, phone, shift, photo });
      }
      
      saveParkingState(state);
      logAudit(`Actualizó/Registró guardia: ${name}`);
      
      // Clear form inputs
      document.getElementById('guard-name').value = '';
      document.getElementById('guard-phone').value = '';
      const previewEl = document.getElementById('guard-photo-preview');
      if (previewEl) {
         previewEl.src = '';
         previewEl.style.display = 'none';
      }
      const placeholderEl = document.getElementById('photo-placeholder');
      if (placeholderEl) {
         placeholderEl.style.display = 'block';
      }
      
      render();
    },
    SEND_WHATSAPP_GUARD: (btn) => {
      const id = btn.dataset.id;
      const state = getParkingState();
      const g = state.personnel.find(p => p.id === id);
      if (!g || !g.phone) {
        pendingAction = {
          type: 'CUSTOM_MODAL',
          title: '⚠️ FALTA TELÉFONO',
          content: `<p style="color:#666; font-weight:700;">Este guardia no tiene un número de WhatsApp registrado.</p>`
        };
        render();
        return;
      }
      
      const url = `${window.location.origin}/?setup_guard=${g.id}&bld=${state.buildingCode}`;
      const msg = `¡Bienvenido a Sloty, ${g.name}! 🛡️\n\nTu acceso para ${state.buildingName} está listo.\n\nPor favor, ingresa al siguiente enlace para activar tu cuenta y crear tu PIN de acceso:\n\n${url}`;
      
      window.open(`https://wa.me/${g.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
    },
    DELETE_GUARD: (btn) => {
      const gId = btn.dataset.id;
      const state = getParkingState();
      state.personnel = state.personnel.filter(p => p.id !== gId);
      saveParkingState(state);
      render();
    },
    CANCEL_EDIT: () => {
      editingGuard = null;
      render();
    },
    CONFIRM_DELETE: () => {
      if (!pendingAction) return
      const state = getParkingState()
      if (pendingAction.type === 'LEVEL') {
        state.levels = state.levels.filter(l => l.name !== pendingAction.name)
      } else if (pendingAction.type === 'SLOT') {
        const level = state.levels.find(l => l.name === pendingAction.lName)
        if (level) level.slots = level.slots.filter(s => s.label !== pendingAction.sLabel)
      }
      saveParkingState(state); pendingAction = null; render()
    },
    SEND_DEBT_WS: (btn) => {
      const { name, debt, phone } = btn.dataset;
      if (!phone) return alert('No hay teléfono registrado');
      const msg = `Hola ${name}, te saludamos de la Administración. Te recordamos que presentas un saldo pendiente de $${debt} en tu mensualidad. Por favor, realiza tu pago para mantener tu acceso activo. ¡Gracias!`;
      window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
    },
    SEND_EXPIRY_ALERT: (btn) => {
      const { name, days, phone, amount } = btn.dataset;
      if (!phone) return alert('No hay teléfono registrado');
      const d = parseInt(days);
      const isExpired = d < 0;
      let msg = '';
      if (isExpired) {
        msg = `Hola ${name}, te saludamos de la Administración de tu edificio.\n\nTe escribimos para notificarte que tu suscripción de estacionamiento presenta un *VENCIMIENTO* de ${Math.abs(d)} días.\n\nPor favor, regulariza tu pago de *$${amount}* lo antes posible para reactivar tu acceso automático.\n\n¡Gracias!`;
      } else if (d === 0) {
        msg = `Hola ${name}, te saludamos de la Administración de tu edificio.\n\nTe recordamos que tu mensualidad de estacionamiento por *$${amount}* *VENCE HOY*.\n\nAgradecemos tu pronto pago para mantener activo tu acceso sin interrupciones.\n\n¡Gracias!`;
      } else {
        msg = `Hola ${name}, te saludamos de la Administración de tu edificio.\n\nTe recordamos amigablemente que tu mensualidad de estacionamiento por *$${amount}* vence en *${d} días*.\n\nAgradecemos tu previsión.\n\n¡Gracias!`;
      }
      window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
    },
    SHOW_RESIDENT_HISTORY: (btn) => {
      const { id, name } = btn.dataset;
      const state = getParkingState();
      // Let's find the subscription instead
      supabase.from('subscriptions').select('plate').eq('id', id).single().then(async ({data}) => {
         const { data: history } = await supabase
           .from('payments')
           .select('amount, method, payment_date, status, reference')
           .eq('subscription_id', id)
           .order('payment_date', { ascending: false })
           .limit(20)
         
         pendingAction = {
           type: 'CUSTOM_MODAL',
           title: `Historial: ${name}`,
           content: `
             <div style="max-height:300px; overflow-y:auto; padding:10px; text-align:left;">
                ${history.map(h => {
                  const bdg = h.status === 'CONFIRMED' ? {c:'#22c55e', bg:'rgba(34,197,94,0.1)', t:'PAGADO'} : h.status === 'PENDING' ? {c:'#f59e0b', bg:'rgba(245,158,11,0.1)', t:'PENDIENTE'} : {c:'#e63946', bg:'rgba(230,57,70,0.1)', t:'RECHAZADO'};
                  return `
                  <div style="padding:15px; border-bottom:1px solid #f8f8f8; display:flex; justify-content:space-between; align-items:center;">
                     <div>
                        <div style="font-size:0.8rem; font-weight:900;">$${h.amount.toFixed(2)}</div>
                        <div style="font-size:0.55rem; color:#bbb;">${new Date(h.payment_date).toLocaleDateString()} · ${h.method}</div>
                     </div>
                     <div style="font-size:0.6rem; color:${bdg.c}; font-weight:900; background:${bdg.bg}; padding:4px 8px; border-radius:6px;">${bdg.t}</div>
                  </div>
                `}).join('') || '<div style="padding:40px; text-align:center; color:#ccc;">No hay historial de pagos</div>'}
             </div>
           `
         };
         render();
      });
    },
    CANCEL_MODAL: () => { pendingAction = null; render() },
    TAB: (btn) => {
      activeTab = btn.dataset.tab
      if (activeTab === 'SETTINGS') activeSettingsMenu = 'MAIN'
      // Colorear inmediatamente sin esperar render
      container.querySelectorAll('.admin-tab-btn').forEach(v => {
        v.style.color = v.dataset.tab === activeTab ? '#F5C518' : 'rgba(255,255,255,0.4)'
      })
      render()
    },
    SUBMENU: (btn) => {
       activeSettingsMenu = btn.dataset.menu;
       render();
    },
    TOGGLE_TARIFF: (btn) => {
       const idx = parseInt(btn.dataset.idx);
       const state = getParkingState();
       if (!state.settings.tariffs) {
           state.settings.tariffs = [ { id: 'T1', name: 'Tarifa Excedente', freeHours: state.settings.freeHours || 8, baseRate: state.settings.baseRate || 1, active: true } ]
       }
       state.settings.tariffs[idx].active = !state.settings.tariffs[idx].active;
       saveParkingState(state);
       render();
    },
    ADD_TARIFF: () => {
       const name = document.getElementById('new-tariff-name')?.value.trim();
       const freeHours = parseFloat(document.getElementById('new-tariff-free')?.value) || 0;
       const baseRate = parseFloat(document.getElementById('new-tariff-rate')?.value) || 0;
       if (!name) return showToast('El nombre de la tarifa es requerido', 'error');

       const state = getParkingState();
       if (!state.settings) state.settings = {};
       if (!state.settings.tariffs) state.settings.tariffs = [];
       
       state.settings.tariffs.push({
           id: 'T' + Date.now(),
           name,
           freeHours,
           baseRate,
           active: true
       });
       saveParkingState(state);
       logAudit(`Añadió nueva tarifa: ${name}`);
       render();
    },
    DELETE_TARIFF: (btn) => {
       const idx = parseInt(btn.dataset.idx);
       const state = getParkingState();
       const deleted = state.settings.tariffs.splice(idx, 1);
       if (deleted.length) logAudit(`Eliminó tarifa: ${deleted[0].name}`);
       saveParkingState(state);
       render();
    },
    SAVE_TARIFFS: () => {
      // Función deprecada intencionalmente
    },

    SYNC: async () => {
      const state = getParkingState();
      if (state.buildingCode) {
        await syncDown(state.buildingCode);
      }
      render();
      const btn = container.querySelector('[data-action="SYNC"]');
      if(btn) {
        btn.style.transform = 'rotate(360deg)';
        btn.style.transition = 'transform 0.5s';
        setTimeout(() => { btn.style.transform = 'rotate(0deg)'; btn.style.transition = 'none' }, 500);
      }
    },
    SAVE_PROFILE: async () => {
      const newName = document.getElementById('edit-building-name').value.trim();
      const email = document.getElementById('edit-admin-email').value.trim();
      const phone = document.getElementById('edit-admin-phone').value.trim();
      const logo = window._tempLogo || getParkingState().logo_url;
      if (!newName) return alert('El nombre del edificio es obligatorio');
      const state = getParkingState();
      
      const oldCode = state.buildingCode
      const newCode = `${getCleanPrefix(newName)}-${Math.floor(1000 + Math.random() * 9000)}`
      state.buildingName = newName
      state.buildingCode = newCode
      state.logo_url = logo

      // Script to load BCV rate in Finance UI
      setTimeout(() => {
        getExchangeRate().then(bcv => {
          const el = document.getElementById('finance-bcv-rate');
          if (el && bcv?.rate) {
            el.innerHTML = `
               <div style="font-size:1rem; font-weight:900; color:#1a1a2e;">Bs. ${bcv.rate.toLocaleString('es-VE', {minimumFractionDigits:2})}</div>
               <div style="font-size:0.55rem; color:${bcv.source==='auto'?'#22c55e':'#D97706'}; font-weight:800;">${bcv.source==='auto'?'OFICIAL BCV':'OVERRIDE MANUAL'}</div>
            `;
          }
        });
      }, 100);

      await supabase
        .from('buildings')
        .update({ name: newName, code: newCode, logo_url: logo })
        .eq('code', oldCode)
      
      state.adminInfo = { ...state.adminInfo, email, phone };
      saveParkingState(state);
      logAudit(`Actualizó perfil del edificio: ${newName}`);
      showToast('Perfil actualizado correctamente', 'success');
      activeTab = 'HOME';
      render();
    },
    LOGOUT: () => {
      localStorage.removeItem('sloty_session')
      localStorage.removeItem('sloty_state')
      localStorage.removeItem('sloty_selected_slot')
      localStorage.removeItem('sloty_building_id')
      localStorage.removeItem('sloty_active_building')
      location.reload()
    },
    FILTER_REPORTS: (btn) => { reportFilter = btn.dataset.filter; render() },
    SAVE_SETTINGS: () => {
      const freeHours = parseFloat(document.getElementById('set-freehours')?.value) || 0
      const baseRate = parseFloat(document.getElementById('set-baserate')?.value) || 0
      const state = getParkingState()
      state.settings = { ...state.settings, freeHours, baseRate }
      saveParkingState(state); logAudit(`Actualizó tarifas: $${baseRate}, ${freeHours}h libres`); render()
    },
    ADD_CUSTOM_FIELD: () => {
      const input = document.getElementById('new-field-label')
      const label = input?.value?.trim()
      if (!label) return
      const id = label.toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_')
      const state = getParkingState()
      if (!state.settings) state.settings = {}
      if (!state.settings.customFields) state.settings.customFields = []
      if (state.settings.customFields.find(f => f.id === id)) return
      state.settings.customFields.push({ id, label, required: true })
      saveParkingState(state)
      render()
    },
    DELETE_CUSTOM_FIELD: (btn) => {
      const id = btn.dataset.id
      const state = getParkingState()
      state.settings.customFields = (state.settings.customFields || []).filter(f => f.id !== id)
      saveParkingState(state); render()
    },
    ADD_CATEGORY: () => {
      const inputLabel = document.getElementById('new-cat-label')
      const inputColor = document.getElementById('new-cat-color')
      const label = inputLabel?.value?.trim()
      const color = inputColor?.value || '#3b82f6'
      if (!label) return
      const id = label.toUpperCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_')
      const state = getParkingState()
      if (!state.settings) state.settings = {}
      if (!state.settings.categories) state.settings.categories = []
      if (state.settings.categories.find(c => c.id === id)) return
      state.settings.categories.push({ 
        id, label, color, 
        tag: label.charAt(0).toUpperCase(), 
        txt: '#ffffff' 
      })
      saveParkingState(state)
      render()
    },
    DELETE_CATEGORY: (btn) => {
      const id = btn.dataset.id
      const state = getParkingState()
      state.settings.categories = (state.settings.categories || []).filter(c => c.id !== id)
      saveParkingState(state); render()
    },
    DOWNLOAD_CSV: () => {
      const state = getParkingState(); const movs = state.movements || []
      if (!movs.length) return alert('No hay movimientos')
      
      const customHeaders = (state.settings?.customFields || []).map(f => f.label.toUpperCase())
      const headers = ['ID','FECHA','TIPO','PLACA','PUESTO', ...customHeaders, 'MÉTODO PAGO', 'COBRO', 'REFERENCIA']
      
      const rows = movs.map(m => {
        const metaValues = (state.settings?.customFields || []).map(f => (m.metadata && m.metadata[f.id]) || '---')
        return [
          m.id, 
          new Date(m.timestamp).toLocaleString(), 
          m.type, 
          m.plate || '---', 
          m.slot || '---', 
          ...metaValues,
          m.payMethod || '---',
          m.amount || 0,
          m.reference || '---'
        ].join(',')
      })
      
      const csvContent = "\ufeff" + [headers.join(','), ...rows].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `reporte-sloty-${new Date().toISOString().split('T')[0]}.csv`)
      link.click()
    },
    SAVE_SUB_SETTINGS: async () => {
      const rate = document.getElementById('sub-rate').value;
      const limit = document.getElementById('sub-limit').value;
      const state = getParkingState();
      const { error } = await supabase.from('buildings').update({ monthly_rate: rate, monthly_slots_limit: limit }).eq('id', state.buildingId);
      if(!error) alert('Ajustes guardados correctamente'); else alert('Error al guardar');
      render();
    },
    ADD_RESIDENT: async (btn) => {
      try {
        const name = document.getElementById('new-sub-name').value.trim();
        const plates = Array.from(document.querySelectorAll('.new-sub-plate-input')).map(i => i.value.trim().toUpperCase()).filter(v => v);
        const price = parseFloat(document.getElementById('new-sub-price').value) || 0;
        const count = parseInt(document.getElementById('new-sub-count').value) || 1;
        const tower = document.getElementById('new-sub-tower').value.trim();
        const floor = document.getElementById('new-sub-floor').value.trim();
        const apt = document.getElementById('new-sub-apt').value.trim();
        const phone = document.getElementById('new-sub-phone').value.trim();
        const brand = document.getElementById('vehicle-brand').value.trim();
        const model = document.getElementById('vehicle-model').value.trim();
        const color = document.getElementById('vehicle-color').value.trim();
        
        if(!name || !plates.length) {
          pendingAction = {
            type: 'CUSTOM_MODAL',
            title: '⚠️ DATOS REQUERIDOS',
            content: `<p style="color:#666; font-weight:700;">Debes ingresar al menos un nombre y una placa.</p>`
          };
          render();
          return;
        }
        
        const originalText = btn.textContent;
        btn.textContent = editingResident ? 'GUARDANDO...' : 'REGISTRANDO...';
        btn.disabled = true;

        const plateString = plates.join(', ');
        const state = getParkingState();
        
        let error;
        if (editingResident) {
          const { error: err } = await supabase.from('subscriptions').update({
            resident_name: name,
            plate: plateString,
            custom_price: price,
            slots_count: count,
            tower: tower,
            floor: floor,
            apt: apt,
            phone: phone,
            vehicle_brand: brand,
            vehicle_model: model,
            vehicle_color: color
          }).eq('id', editingResident);
          error = err;

          // Sincronizar tabla vehicles
          if (plateString) {
            const { data: existing } = await supabase.from('vehicles').select('id').eq('subscription_id', editingResident).limit(1);
            if (existing?.length > 0) {
              await supabase.from('vehicles').update({
                plate: plateString.toUpperCase(),
                brand: brand || null,
                model: model || null,
                color: color || null
              }).eq('subscription_id', editingResident);
            } else {
              await supabase.from('vehicles').insert({
                building_id: state.buildingId,
                subscription_id: editingResident,
                plate: plateString.toUpperCase(),
                brand: brand || null,
                model: model || null,
                color: color || null
              });
            }
          }
        } else {
          const expiry = new Date(); expiry.setDate(expiry.getDate() + 30);
          const { error: err } = await supabase.from('subscriptions').insert({
            building_id: state.buildingId,
            resident_name: name,
            plate: plateString,
            expiry_date: expiry.toISOString(),
            status: 'ACTIVE',
            custom_price: price,
            slots_count: count,
            tower: tower,
            floor: floor,
            apt: apt,
            phone: phone,
            pin: null,
            vehicle_brand: brand,
            vehicle_model: model,
            vehicle_color: color
          }).select('id').single();
          error = err;

          if (!error && data?.id) {
            await supabase.from('vehicles').insert({
              building_id: state.buildingId,
              subscription_id: data.id,
              plate: plateString.toUpperCase(),
              brand: brand || null,
              model: model || null,
              color: color || null
            });
          }
        }
        
        if(!error) {
          if (editingResident) {
            await logAudit('EDIT_RESIDENT', { subscription_id: editingResident });
          } else {
            await logAudit('ADD_RESIDENT', { resident_name: name, plate: plateString });
          }
          pendingAction = {
            type: 'CUSTOM_MODAL',
            title: '✅ ¡RESIDENTE REGISTRADO!',
            content: `
              <div style="text-align:center; padding:20px;">
                <div style="font-size:3rem; margin-bottom:15px;">🚗</div>
                <p style="color:#666; font-size:0.9rem; font-weight:700;">
                  <b>${name}</b> ha sido añadido con éxito.<br>
                  Ya puedes enviar su acceso por WhatsApp.
                </p>
              </div>
            `
          };
          
          editingResident = null;
          // Clear form
          document.getElementById('new-sub-name').value = '';
          const plateContainer = document.getElementById('new-sub-plates-container');
          if(plateContainer) plateContainer.innerHTML = '<div style="display:flex; gap:8px;"><input type="text" class="new-sub-plate-input" placeholder="Placa Vehículo 1" style="flex:1; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700; text-transform:uppercase;"></div>';
          document.getElementById('new-sub-tower').value = '';
          document.getElementById('new-sub-floor').value = '';
          document.getElementById('new-sub-apt').value = '';
          document.getElementById('new-sub-phone').value = '';
          document.getElementById('vehicle-brand').value = '';
          document.getElementById('vehicle-model').value = '';
          document.getElementById('vehicle-color').value = '';
          
          cachedSubs = null;
          await render(); 
        } else {
          console.error('Supabase Error:', error);
          pendingAction = {
            type: 'CUSTOM_MODAL',
            title: '❌ ERROR DE BASE DE DATOS',
            content: `<p style="color:#666; font-weight:700;">${error.message || 'Error al conectar con Supabase.'}</p>`
          };
          btn.textContent = originalText;
          btn.disabled = false;
          render();
        }
      } catch (e) {
        console.error('JS Error:', e);
        pendingAction = {
          type: 'CUSTOM_MODAL',
          title: '⚠️ ERROR DE SISTEMA',
          content: `<p style="color:#666; font-weight:700;">${e.message}</p>`
        };
        render();
      }
    },
    EDIT_RESIDENT: async (btn) => {
      const id = btn.dataset.id;
      const { data: res } = await supabase.from('subscriptions').select('*').eq('id', id).single();
      if (!res) return;

      editingResident = id;
      cachedSubs = null;
      await logAudit('EDIT_RESIDENT', { subscription_id: id });
      await render(); // Re-render to update form button and inputs

      document.getElementById('new-sub-name').value = res.resident_name;
      document.getElementById('new-sub-price').value = res.custom_price;
      document.getElementById('new-sub-count').value = res.slots_count;
      document.getElementById('new-sub-tower').value = res.tower || '';
      document.getElementById('new-sub-floor').value = res.floor || '';
      document.getElementById('new-sub-apt').value = res.apt || '';
      document.getElementById('new-sub-phone').value = res.phone || '';
      document.getElementById('vehicle-brand').value = res.vehicle_brand || '';
      document.getElementById('vehicle-model').value = res.vehicle_model || '';
      document.getElementById('vehicle-color').value = res.vehicle_color || '';

      const container = document.getElementById('new-sub-plates-container');
      container.innerHTML = '';
      const plates = res.plate.split(',').map(p => p.trim());
      plates.forEach((p, idx) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '8px';
        div.innerHTML = `
          <input type="text" class="new-sub-plate-input" value="${p}" placeholder="Placa Vehículo ${idx + 1}" style="flex:1; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700; text-transform:uppercase;">
          ${idx > 0 ? `<button type="button" onclick="this.parentElement.remove()" style="background:rgba(230,57,70,0.2); color:#e63946; border:none; width:45px; border-radius:12px; cursor:pointer; font-weight:900;">✕</button>` : ''}
        `;
        container.appendChild(div);
      });
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    CANCEL_EDIT_RESIDENT: () => {
      editingResident = null;
      render();
    },
    CONFIRM_PAYMENT: async (btn) => {
      const pid = btn.dataset.id
      const sid = btn.dataset.sid
      
      // Fetch payment and subscription details
      const { data: pay } = await supabase.from('payments').select('*').eq('id', pid).single()
      const { data: sub } = await supabase.from('subscriptions').select('*').eq('id', sid).single()
      
      if (!pay || !sub) return alert('Error al recuperar datos del pago')

      const amount = pay.amount
      const price = sub.custom_price || 1
      const currentExp = new Date(sub.expiry_date)
      const startBase = new Date(Math.max(Date.now(), currentExp.getTime()))
      const daysToAdd = Math.round((amount / price) * 30)
      startBase.setDate(startBase.getDate() + daysToAdd)

      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('payments').update({ status: 'CONFIRMED' }).eq('id', pid),
        supabase.from('subscriptions').update({ expiry_date: startBase.toISOString() }).eq('id', sid)
      ]);

      if (e1 || e2) {
        console.error('Error al confirmar pago:', e1 || e2);
        alert('Error al confirmar el pago. Intenta de nuevo.');
        return;
      }

      // Log movement so it reflects in the global cash total
      logMovement({
        type: 'MENSUALIDAD',
        plate: sub.plate.split(',')[0].trim(),
        slot: 'MENSUAL',
        category: 'RESIDENTE',
        guardName: 'Sistema (Appr)',
        payMethod: pay.method,
        amount: amount,
        reference: pay.reference,
        paymentStatus: 'PAGADO'
      })

      await logAudit('CONFIRM_PAYMENT', { payment_id: pid, subscription_id: sid });
      // PASO 5: Notificar al residente que su pago fue aprobado
      supabase.functions.invoke('send-push', {
        body: {
          building_id: s.buildingId,
          role: 'RESIDENT',
          title: '✅ Pago confirmado',
          body: `Tu pago de $${amount} ha sido aprobado.`
        }
      }).catch(e => console.warn('[Sloty] push error:', e))
      cachedMetrics = null
      cachedFinance = null
      render()
    },
    REJECT_PAYMENT: async (btn) => {
      const s = getParkingState()
      await supabase.from('payments').update({ status: 'REJECTED' }).eq('id', btn.dataset.id)
      // PASO 5: Notificar al residente que su pago fue rechazado
      supabase.functions.invoke('send-push', {
        body: {
          building_id: s.buildingId,
          role: 'RESIDENT',
          title: '❌ Pago rechazado',
          body: 'Tu pago fue rechazado. Contacta a tu administrador.'
        }
      }).catch(e => console.warn('[Sloty] push error:', e))
      await logAudit('REJECT_PAYMENT', { payment_id: btn.dataset.id });
      cachedMetrics = null
      render()
    },
    RESIDENT_PAYMENTS: async (btn) => {
      const sid = btn.dataset.id
      const name = btn.dataset.name
      const { data: pays } = await supabase.from('payments').select('*').eq('subscription_id', sid).order('payment_date', { ascending: false })
      
      const paysWithProofs = await Promise.all((pays || []).map(async p => {
        let proofHtml = '';
        const { data: proofs } = await supabase
          .from('payment-proofs')
          .select('file_path, file_name')
          .eq('payment_id', p.id)
          .limit(1);

        if (proofs && proofs.length > 0) {
          const { data: urlData } = await supabase.storage
            .from('payment-proofs')
            .createSignedUrl(proofs[0].file_path, 3600);

          if (urlData?.signedUrl) {
            proofHtml = `
              <a href="${urlData.signedUrl}" target="_blank"
                 style="display:inline-flex; align-items:center; gap:6px;
                        background:#E6F1FB; color:#185FA5; border-radius:50px;
                        padding:5px 12px; font-size:0.65rem; font-weight:900;
                        text-decoration:none; margin-top:8px;">
                📎 Ver comprobante
              </a>`;
          }
        }
        return { ...p, proofHtml };
      }));

      const l = document.getElementById('modal-layer')
      l.style.pointerEvents = 'auto'
      const ML = { EFECTIVO: '💵 Efectivo', PAGO_MOVIL: '📱 Pago Móvil', TRANSFERENCIA: '🏦 Transferencia' }
      l.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);backdrop-filter:blur(12px);display:flex;align-items:flex-end;justify-content:center;z-index:9999;">
          <div style="background:white;border-radius:32px 32px 0 0;width:100%;max-width:480px;padding:30px 25px 40px;max-height:85vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:25px;">
              <div>
                <div style="font-size:0.6rem;font-weight:800;color:#bbb;text-transform:uppercase;">Pagos Reportados</div>
                <div style="font-size:1.1rem;font-weight:900;color:#1a1a2e;">${name}</div>
              </div>
              <button data-action="CANCEL_MODAL" style="background:#f4f4f4;border:none;width:36px;height:36px;border-radius:50%;font-size:1.2rem;cursor:pointer;">×</button>
            </div>
            ${!paysWithProofs.length ? '<div style="text-align:center;padding:40px;color:#bbb;font-size:0.85rem;font-weight:700;">Sin reportes de pago</div>' : paysWithProofs.map(p => `
              <div style="background:${p.status==='CONFIRMED'?'#f0fdf4':p.status==='REJECTED'?'#fff1f2':'#fafafa'};border:1.5px solid ${p.status==='CONFIRMED'?'#86efac':p.status==='REJECTED'?'#fca5a5':'#e5e7eb'};border-radius:20px;padding:18px;margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                  <div>
                    <div style="font-weight:900;color:#1a1a2e;font-size:1rem;">$${p.amount}</div>
                    <div style="font-size:0.65rem;color:#666;font-weight:700;margin-top:3px;">${ML[p.method]||p.method} · ${new Date(p.payment_date).toLocaleDateString()}</div>
                    ${p.reference ? `<div style="font-size:0.6rem;color:#999;font-weight:700;">Ref: ${p.reference}</div>` : ''}
                    ${p.proofHtml}
                  </div>
                  <span style="background:${p.status==='CONFIRMED'?'#22c55e':p.status==='REJECTED'?'#e63946':'#f59e0b'};color:white;padding:4px 10px;border-radius:20px;font-size:0.55rem;font-weight:900;">${p.status==='CONFIRMED'?'CONFIRMADO':p.status==='REJECTED'?'RECHAZADO':'PENDIENTE'}</span>
                </div>
                ${p.status === 'PENDING' ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;"><button data-action="CONFIRM_PAYMENT" data-id="${p.id}" data-sid="${sid}" style="padding:12px;background:#1a1a2e;color:#F5C518;border:none;border-radius:14px;font-weight:900;font-size:0.7rem;cursor:pointer;">✓ CONFIRMAR</button><button data-action="REJECT_PAYMENT" data-id="${p.id}" style="padding:12px;background:#fff0f0;color:#e63946;border:none;border-radius:14px;font-weight:900;font-size:0.7rem;cursor:pointer;">✕ RECHAZAR</button></div>` : ''}
              </div>`).join('')}
          </div>
        </div>`
    },
    SEND_RESIDENT_ACCESS: (btn) => {
      const phone = btn.dataset.phone;
      const plate = btn.dataset.plate;
      const state = getParkingState();
      
      if (!phone) {
        pendingAction = {
          type: 'CUSTOM_MODAL',
          title: '⚠️ SIN TELÉFONO',
          content: `<p style="color:#666; font-weight:700;">Este residente no tiene un número registrado para enviar el acceso.</p>`
        };
        render();
        return;
      }
      
      const firstPlate = plate.split(',')[0].trim();
      const url = `${window.location.origin}/?setup=${firstPlate}&bld=${state.buildingCode}`;
      const msg = `¡Bienvenido a Sloty! 🚗\n\nTu acceso para ${state.buildingName} está listo.\n\nPor favor, ingresa al siguiente enlace para crear tu PIN de acceso personal:\n\n${url}`;
      
      window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
    },
    TOGGLE_COMING: async (btn) => {
      const id = btn.dataset.id;
      const state = getParkingState();
      const { data: sub } = await supabase.from('subscriptions').select('is_coming').eq('id', id).single();
      const newState = !sub?.is_coming;
      
      const { error } = await supabase.from('subscriptions').update({ is_coming: newState }).eq('id', id);
      if(!error) render();
    },
    DELETE_RESIDENT: async (btn) => {
      const id = btn.dataset.id;
      pendingAction = {
        type: 'CONFIRM_MODAL',
        title: '¿ELIMINAR RESIDENTE?',
        content: `<p style="color:#666; font-weight:700;">Esta acción revocará el acceso y eliminará el registro permanentemente.</p>`,
        confirmAction: async () => {
          const { error } = await supabase.from('subscriptions').delete().eq('id', id);
          if(!error) {
             await logAudit('DELETE_RESIDENT', { subscription_id: id });
             pendingAction = null;
             cachedSubs = null;
             render();
          } else {
             pendingAction = {
               type: 'CUSTOM_MODAL',
               title: '❌ ERROR',
               content: `<p style="color:#666; font-weight:700;">No se pudo eliminar el registro.</p>`
             };
             render();
          }
        }
      };
      render();
    },
    GEN_CREDENTIAL: async (btn) => {
      const id = btn.dataset.id;
      const { data: res } = await supabase.from('subscriptions').select('*').eq('id', id).single();
      const state = getParkingState();
      
      pendingAction = {
        type: 'CUSTOM_MODAL',
        title: 'Credencial de Residente',
        content: `
          <div style="padding:20px; display:flex; flex-direction:column; align-items:center; gap:20px;">
             <!-- CARD DESIGN -->
             <div style="width:100%; max-width:320px; background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius:24px; padding:25px; color:white; position:relative; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1);">
                <div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:var(--accent); border-radius:50%; opacity:0.05;"></div>
                
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:30px;">
                   <img src="/sloty-logo-v2.png" style="height:35px; filter:brightness(0) invert(1);">
                   <div style="background:var(--accent); color:var(--primary); font-size:0.5rem; font-weight:900; padding:4px 10px; border-radius:30px; text-transform:uppercase;">RESIDENTE</div>
                </div>

                <div style="margin-bottom:25px;">
                   <div style="font-size:0.55rem; color:rgba(255,255,255,0.4); text-transform:uppercase; font-weight:800; letter-spacing:1px; margin-bottom:5px;">Nombre del Propietario</div>
                   <div style="font-size:1.1rem; font-weight:900; letter-spacing:0.5px;">${res.resident_name}</div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:15px;">
                   <div>
                      <div style="font-size:0.55rem; color:rgba(255,255,255,0.4); text-transform:uppercase; font-weight:800; letter-spacing:1px; margin-bottom:5px;">Vehículo / Placa</div>
                      <div style="font-size:1.2rem; font-weight:900; color:var(--accent);">${res.plate}</div>
                   </div>
                   <div>
                      <div style="font-size:0.55rem; color:rgba(255,255,255,0.4); text-transform:uppercase; font-weight:800; letter-spacing:1px; margin-bottom:5px;">Puesto</div>
                      <div style="font-size:1.2rem; font-weight:900; color:white;">${res.slot_label || '---'}</div>
                   </div>
                </div>

                <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:15px; display:flex; justify-content:space-between; align-items:center;">
                   <div>
                      <div style="font-size:0.45rem; color:rgba(255,255,255,0.3); text-transform:uppercase; font-weight:700;">Vencimiento</div>
                      <div style="font-size:0.7rem; font-weight:800; color:#22c55e;">${new Date(res.expiry_date).toLocaleDateString()}</div>
                   </div>
                   <div style="text-align:right;">
                      <div style="font-size:0.45rem; color:rgba(255,255,255,0.3); text-transform:uppercase; font-weight:700;">Edificio</div>
                      <div style="font-size:0.7rem; font-weight:800; color:white;">${state.buildingName}</div>
                   </div>
                </div>
             </div>

             <div style="text-align:center;">
                <button onclick="window.print()" style="background:#f4f4f4; border:none; padding:12px 25px; border-radius:15px; font-weight:900; font-size:0.75rem; color:var(--primary); cursor:pointer; display:flex; align-items:center; gap:8px;">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                   IMPRIMIR O DESCARGAR
                </button>
             </div>
          </div>
        `
      };
      render();
    },
    VIEW_CLOSURE: (btn) => {
      const id = btn.dataset.id
      const state = getParkingState()
      const c = (state.closures || []).find(x => x.id === id)
      if (!c) return
      
      const methodsHtml = Object.entries(c.methods || {}).map(([m, val]) => `
         <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
           <span style="font-size:0.75rem; color:#666; font-weight:700;">${m.replace('_', ' ')}</span>
           <span style="font-size:0.85rem; color:var(--primary); font-weight:900;">$${val.toFixed(2)}</span>
         </div>
      `).join('')

      const movsHtml = (c.movements || []).map(m => `
         <div style="padding:10px; border-bottom:1px solid #f8f8f8; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.75rem; font-weight:900;">${m.plate} <span style="font-weight:700; color:#bbb; margin-left:5px;">${m.slot}</span></div>
            <div style="text-align:right;">
               <div style="font-size:0.75rem; font-weight:900; color:#22c55e;">$${(m.amount||0).toFixed(2)}</div>
               <div style="font-size:0.5rem; color:#bbb;">Ref: ${m.reference || 'EFEC'}</div>
            </div>
         </div>
      `).join('')

      pendingAction = {
        type: 'CUSTOM_MODAL',
        title: 'Detalle de Cierre',
        content: `
          <div style="padding:15px; text-align:left;">
             <div style="background:#f8f9fa; border-radius:16px; padding:15px; margin-bottom:20px;">
                ${methodsHtml || '<div style="font-size:0.7rem; color:#999; text-align:center;">Sin detalles por método</div>'}
                <div style="border-top:1.5px solid #eee; margin-top:10px; padding-top:10px; display:flex; justify-content:space-between; font-weight:950;">
                   <span>TOTAL CIERRE</span>
                   <span style="color:#22c55e;">$${(c.total || 0).toFixed(2)}</span>
                </div>
             </div>
             <div style="font-size:0.6rem; font-weight:900; color:#999; text-transform:uppercase; margin-bottom:10px;">MOVIMIENTOS DE LA SESIÓN</div>
             <div style="max-height:250px; overflow-y:auto; border:1px solid #f4f4f4; border-radius:12px;">
                ${movsHtml || '<div style="padding:20px; text-align:center; color:#ccc;">No hay movimientos registrados</div>'}
             </div>
          </div>
        `
      }
      render()
    },
    VIEW_GUARD_DETAIL: async (guardName) => {
      const { data: gShifts } = await supabase
        .from('guard_shifts')
        .select('*')
        .eq('building_id', state.buildingId)
        .eq('guard_name', guardName)
        .order('ended_at', { ascending: false });

      const shifts = gShifts || [];
      const totalEarned = shifts.reduce((a, s) => a + (s.total_cash||0) + (s.total_mobile||0) + (s.total_bs||0), 0);
      const totalEntries = shifts.reduce((a, s) => a + (s.entries||0), 0);
      const totalExits = shifts.reduce((a, s) => a + (s.exits||0), 0);
      const totalAbsMin = shifts.reduce((a, s) => a + (s.absences||[]).reduce((b, ab) => b + (ab.duration_min||0), 0), 0);

      const html = `
        <div style="padding:20px; padding-bottom:120px; background:#f8f9fa; min-height:100vh;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
            <button onclick="handleAction('BACK_TO_FINANCE')"
                    style="background:#1a1a2e; color:#F5C518; border:none;
                           border-radius:50px; padding:8px 16px; font-size:0.7rem;
                           font-weight:900; cursor:pointer;">← VOLVER</button>
            <div style="font-size:1.1rem; font-weight:900; color:#1a1a2e; text-transform:uppercase;">
              ${guardName}
            </div>
          </div>

          <!-- RESUMEN GLOBAL DEL GUARDIA -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
            <div style="background:#1a1a2e; color:white; padding:20px; border-radius:20px; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900;">$${totalEarned.toFixed(2)}</div>
              <div style="font-size:0.6rem; color:#F5C518; font-weight:700; margin-top:4px;">TOTAL RECAUDADO</div>
            </div>
            <div style="background:#F5C518; color:#1a1a2e; padding:20px; border-radius:20px; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900;">${shifts.length}</div>
              <div style="font-size:0.6rem; font-weight:700; margin-top:4px;">TURNOS TOTALES</div>
            </div>
            <div style="background:white; padding:16px; border-radius:20px; text-align:center; border:1px solid #eee;">
              <div style="font-size:1.3rem; font-weight:900; color:#22c55e;">${totalEntries}</div>
              <div style="font-size:0.6rem; color:#999; font-weight:700; margin-top:2px;">ENTRADAS</div>
            </div>
            <div style="background:white; padding:16px; border-radius:20px; text-align:center; border:1px solid #eee;">
              <div style="font-size:1.3rem; font-weight:900; color:#e63946;">${totalAbsMin}</div>
              <div style="font-size:0.6rem; color:#999; font-weight:700; margin-top:2px;">MIN AUSENTE</div>
            </div>
          </div>

          <!-- HISTORIAL DE TURNOS -->
          <div style="font-size:0.7rem; font-weight:900; color:#999; letter-spacing:2px; margin-bottom:12px;">HISTORIAL DE TURNOS</div>
          ${shifts.map(s => {
            const earned = (s.total_cash||0) + (s.total_mobile||0) + (s.total_bs||0);
            const absMin = (s.absences||[]).reduce((a, ab) => a + (ab.duration_min||0), 0);
            const start = new Date(s.started_at).toLocaleString('es-VE', { dateStyle:'short', timeStyle:'short' });
            const end = new Date(s.ended_at).toLocaleString('es-VE', { dateStyle:'short', timeStyle:'short' });
            return `
              <div style="background:white; border-radius:16px; padding:16px;
                          margin-bottom:10px; border:1px solid #eee;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                  <div style="font-size:0.7rem; color:#999; font-weight:700;">${start} → ${end}</div>
                  <div style="font-size:0.9rem; font-weight:900; color:#1a1a2e;">$${earned.toFixed(2)}</div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <span style="background:#f0f0f0; border-radius:50px; padding:3px 10px;
                               font-size:0.65rem; font-weight:700; color:#333;">
                    🚗 ${s.entries||0} entradas
                  </span>
                  <span style="background:#f0f0f0; border-radius:50px; padding:3px 10px;
                               font-size:0.65rem; font-weight:700; color:#333;">
                    💵 $${(s.total_cash||0).toFixed(2)} efectivo
                  </span>
                  <span style="background:#f0f0f0; border-radius:50px; padding:3px 10px;
                               font-size:0.65rem; font-weight:700; color:#333;">
                    📱 $${(s.total_mobile||0).toFixed(2)} móvil
                  </span>
                  ${absMin > 0 ? `
                    <span style="background:#FCEBEB; border-radius:50px; padding:3px 10px;
                                 font-size:0.65rem; font-weight:700; color:#e63946;">
                      ⏸ ${absMin} min ausente
                    </span>` : ''}
                </div>
                ${(s.absences||[]).length > 0 ? `
                  <div style="margin-top:10px; padding-top:10px; border-top:1px solid #f0f0f0;">
                    <div style="font-size:0.65rem; font-weight:900; color:#999; margin-bottom:6px;">AUSENCIAS</div>
                    ${s.absences.map(ab => `
                      <div style="font-size:0.65rem; color:#e63946; margin-bottom:3px;">
                        ${new Date(ab.from).toLocaleTimeString('es-VE', {timeStyle:'short'})}
                        → ${new Date(ab.to).toLocaleTimeString('es-VE', {timeStyle:'short'})}
                        (${ab.duration_min} min)
                      </div>`).join('')}
                  </div>` : ''}
              </div>`;
          }).join('')}
        </div>`;

      elMain.innerHTML = html;
    },
    BACK_TO_FINANCE: async () => {
      cachedFinance = null;
      await render();
    },
    RESOLVE_INCIDENT: async (btn) => {
      const id = btn.dataset.id;
      const { error } = await supabase
        .from('incidents')
        .update({ resolved: true })
        .eq('id', id);

      if (error) { showToast('Error al resolver incidente', 'error'); return; }
      await logAudit('RESOLVE_INCIDENT', { incident_id: id });
      showToast('Incidente marcado como resuelto', 'success');
      await render();
    }
  }

  window._admin_tab = (tab) => { activeTab = tab; render() }

  container.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action]')
    if (trigger) {
      const action = trigger.dataset.action
      if (actions[action]) {
        try {
          actions[action](trigger)
        } catch (err) {
          console.error('Error in action:', action, err)
        }
      }
    }
  })

  const renderShell = (state) => {
    container.innerHTML = `
      <div id="admin-shell" style="background:#f8f9fa; min-height:100vh; font-family:var(--font); color:var(--primary);">
        <div id="admin-header"></div>
        <main id="admin-main" style="padding-top:10px;"></main>
        <div id="modal-layer" style="pointer-events:none;"></div>
        
        <nav id="admin-nav" style="position:fixed; bottom:0; left:0; width:100%; background:#1a1a2e; padding:10px 15px calc(env(safe-area-inset-bottom, 8px) + 8px); display:flex; justify-content:space-around; align-items:center; z-index:1000; box-shadow:0 -5px 30px rgba(0,0,0,0.2);">
          <div class="admin-tab-btn" data-action="TAB" data-tab="HOME" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">INICIO</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="STRUCTURE" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">PISOS</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="SUBS" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <div style="width:22px; height:22px;">${ICONS.SUBS}</div>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">MENSUAL</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="FINANCE" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">CAJA</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="PERSONAL" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">PERSONAL</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="SETTINGS" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <div style="width:22px; height:22px;">${ICONS.SETTINGS}</div>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">CONFIG</span>
          </div>
        </nav>
      </div>`
    elMain = container.querySelector('#admin-main')
  }

  const renderHeader = async (state) => {
    const header = container.querySelector('#admin-header')
    if (!header) return
    const unread = (state.notifications || []).filter(n => n.unread).length

    // DYNAMIC METRICS FOR HEADER
    let metricHtml = ''
    if (activeTab === 'STRUCTURE') {
      const total = state.levels.reduce((acc, l) => acc + l.slots.length, 0)
      metricHtml = `<div class="header-status"><span>${total} PUESTOS</span></div>`
    } else if (activeTab === 'FINANCE') {
      const rev = (state.movements || []).filter(m => new Date(m.timestamp) >= new Date().setHours(0,0,0,0)).reduce((acc, m) => acc + (m.amount || 0), 0)
      metricHtml = `<div class="header-status" style="background:rgba(34,197,94,0.15); color:#22c55e;"><span>$${rev.toFixed(2)}</span></div>`
    } else if (activeTab === 'SUBS') {
      // Fetch count in background to not block render
      metricHtml = `<div class="header-status" id="sub-count-badge" style="background:rgba(59,130,246,0.15); color:#3b82f6;"><span>... RESIDENTES</span></div>`
      supabase.from('subscriptions').select('count', { count: 'exact' }).eq('building_id', state.buildingId)
        .then(({count}) => {
          const badge = container.querySelector('#sub-count-badge')
          if(badge) badge.innerHTML = `<span>${count || 0} RESIDENTES</span>`
        })
    } else if (activeTab === 'HOME') {
      metricHtml = `<div class="header-status"><span>ADMIN</span></div>`
    } else {
      metricHtml = `<div class="header-status"><span>ACTIVO</span></div>`
    }

    const titles = { STRUCTURE:'Pisos', SUBS:'Mensuales', FINANCE:'Caja', PERSONAL:'Personal', REPORTES:'Reportes', SETTINGS:'Auditoría', NOTIFICATIONS:'Notificaciones', PROFILE:'Perfil' }
    const isHome = activeTab === 'HOME'

    const sState = getParkingState()
    const trialBanner = (sState.plan === 'TRIAL' && sState.trialDaysLeft !== undefined) ? `
      <div style="background:linear-gradient(90deg, #F5C518, #f39c12); color:#1a1a2e; padding:10px 20px; text-align:center; font-size:0.75rem; font-weight:900; letter-spacing:0.5px; display:flex; align-items:center; justify-content:center; gap:8px; border-bottom:1px solid rgba(0,0,0,0.1);">
        <span>🎁 ESTÁS EN PRUEBA GRATUITA: Quedan ${sState.trialDaysLeft} días</span>
      </div>` : ''

    header.innerHTML = `
      ${trialBanner}
      <div style="background:#1a1a2e; padding:calc(env(safe-area-inset-top, 0px) + 15px) 20px 20px; color:white; position:sticky; top:0; z-index:1100; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
        <!-- HEADER TOP: Logo & Context -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:${isHome ? '15px' : '0'};">
          <div style="display:flex; align-items:center; gap:12px;">
            ${!isHome ? `<div data-action="TAB" data-tab="HOME" style="cursor:pointer; color:white; width:24px; height:24px; display:flex; align-items:center; justify-content:center; margin-right:4px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;"><path d="m15 18-6-6 6-6"/></svg>
            </div>` : ''}
            <div data-action="TAB" data-tab="HOME" style="cursor:pointer; display:flex; flex-direction:column;">
              <div style="display:flex; align-items:center; gap:15px;">
                <img src="/icons/Sloty logo negro.png" style="height:60px; filter:brightness(0) invert(1); margin-bottom:-5px; object-fit:contain; object-position:left;" onerror="this.style.display='none'">
                ${sState.logo_url ? `<img src="${sState.logo_url}" style="height:40px; width:auto; max-width:80px; border-radius:8px; object-fit:contain;" title="Logo del Edificio">` : ''}
              </div>
              <div style="display:flex; align-items:center; gap:8px; margin-left:2px;">
                <div style="font-size:0.5rem; font-weight:800; color:rgba(255,255,255,0.4); letter-spacing:2px; text-transform:uppercase;">${isHome ? 'PANEL PRINCIPAL' : titles[activeTab].toUpperCase()}</div>
                <div style="display:flex; align-items:center; gap:4px; background:rgba(34,197,94,0.1); padding:2px 6px; border-radius:6px; border:1px solid rgba(34,197,94,0.2);">
                   <div style="width:4px; height:4px; background:#22c55e; border-radius:50%; animation: pulse 2s infinite;"></div>
                   <div style="font-size:0.45rem; font-weight:900; color:#22c55e; letter-spacing:0.5px;">LIVE</div>
                </div>
                ${(() => {
                  const plan = getParkingState().plan || 'TRIAL'
                  const planColors = { TRIAL:'#888', BRONCE:'#cd7f32', PLATA:'#aaa', ORO:'#F5C518' }
                  let upgradeBtn = ''
                  if (plan !== 'ORO') {
                    upgradeBtn = `
                      <button data-action="SHOW_PLANS" class="gold-btn" style="margin-left:10px;">
                        <span>🚀 SUBIR A ORO</span>
                      </button>`
                  }
                  return `
                    <div style="font-size:0.45rem; font-weight:900; color:${planColors[plan] || '#888'}; letter-spacing:0.5px; background:rgba(255,255,255,0.07); padding:2px 6px; border-radius:6px; margin-left:4px;">${plan}</div>
                    ${upgradeBtn}
                  `
                })()}
                ${metricHtml}
              </div>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:16px;">
            <button data-action="SYNC" style="background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.4); width:28px; height:28px; display:flex; align-items:center; justify-content:center; padding:0; transition:transform 0.5s;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
            </button>
            <button data-action="TAB" data-tab="NOTIFICATIONS" 
              style="position:relative; cursor:pointer; color:white; 
              width:28px; height:28px; background:none; border:none; 
              padding:0; display:flex; align-items:center; justify-content:center;">
              ${ICONS.BELL}
              ${unread ? `<div style="position:absolute; top:-3px; right:-3px; width:8px; height:8px; background:#e63946; border-radius:50%; border:2px solid #1a1a2e;"></div>` : ''}
            </button>
            <button data-action="LOGOUT" style="background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.4); width:28px; height:28px; display:flex; align-items:center; justify-content:center; padding:0;">
              ${ICONS.LOGOUT}
            </button>
          </div>
        </div>

        ${isHome ? `
          <!-- BUILDING IDENTITY (ONLY HOME) -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:20px; margin-bottom:4px;">
            <div style="font-size:1.8rem; font-weight:900; line-height:1.1;">${state.buildingName}</div>
            <div data-action="TAB" data-tab="PROFILE" style="cursor:pointer; color:var(--accent); width:24px; height:24px;">
               ${ICONS.EDIT}
            </div>
          </div>
          <div style="font-size:0.75rem; font-weight:600; color:rgba(255,255,255,0.4); margin-bottom:20px;">${state.adminInfo?.email || ''}</div>
          
          <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:18px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(255,255,255,0.05);">
            <div>
              <div style="font-size:0.55rem; font-weight:800; color:rgba(255,255,255,0.3); text-transform:uppercase; margin-bottom:4px; letter-spacing:1px;">CÓDIGO DE ACCESO</div>
              <div style="font-size:1.2rem; font-weight:900; color:var(--accent); letter-spacing:1px;">${state.buildingCode}</div>
            </div>
            <button onclick="navigator.clipboard.writeText('${state.buildingCode}'); this.textContent='✓'; setTimeout(()=>this.textContent='COPIAR',1500)" 
              style="background:rgba(255,255,255,0.1); color:white; border:none; padding:10px 18px; border-radius:12px; font-size:0.6rem; font-weight:900; cursor:pointer;">
              COPIAR
            </button>
          </div>
        ` : ''}
      </div>`
  }

  const loadHomeMetrics = async () => {
    if (metricsLoading) return
    metricsLoading = true
    const s = getParkingState()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    
    const [subsRes, paysRes, pendRes] = await Promise.all([
      supabase.from('subscriptions').select('id,custom_price,expiry_date,status').eq('building_id', s.buildingId),
      supabase.from('payments').select('amount').eq('building_id', s.buildingId).eq('status', 'CONFIRMED').gte('payment_date', monthStart),
      supabase.from('payments').select('id').eq('building_id', s.buildingId).eq('status', 'PENDING')
    ])
    
    cachedMetrics = {
      subs: subsRes.data || [],
      pays: paysRes.data || [],
      pends: pendRes.data || [],
      loadedAt: Date.now()
    }
    metricsLoading = false
  }

  const renderHome = async (state, ads = []) => {
    const movements = state.movements || []
    const stats = state.stats || { totalSpots: 0, occupied: 0 }
    const total = stats.totalSpots || 0
    const occ = stats.occupied || 0
    const perc = total > 0 ? Math.round((occ / total) * 100) : 0
    const dash = 251.2
    const offset = dash - (perc / 100) * dash

    const activeAds = (ads || []).filter(a => a.active) || []

    let avgHours = 0;
    const salidas = movements.filter(m => m.type === 'EXIT');
    if (salidas.length > 0) {
      let totalMs = 0; let counted = 0;
      salidas.forEach(sal => {
        const ing = movements.find(m => (m.type === 'ENTRY' || m.type === 'INGRESO') && m.plate === sal.plate && m.timestamp < sal.timestamp);
        if (ing) { totalMs += (new Date(sal.timestamp) - new Date(ing.timestamp)); counted++; }
      });
      if (counted > 0) avgHours = (totalMs / counted) / (1000 * 60 * 60);
    }

    // --- MONTHLY INTELLIGENCE: fetch live data ---
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const in7days = new Date(now.getTime() + 7 * 86400000).toISOString()

    if (!cachedMetrics) {
      await loadHomeMetrics()
    }
    const subs = cachedMetrics?.subs || []
    const pays = cachedMetrics?.pays || []
    const pends = cachedMetrics?.pends || []

    const proyectado = subs.reduce((a, s) => a + (s.custom_price || 0), 0)
    const cobradoMes = pays.reduce((a, p) => a + (p.amount || 0), 0)
    const pendientesCount = pends.length
    const porVencer = subs.filter(s => {
      const exp = new Date(s.expiry_date)
      return exp > now && exp <= new Date(in7days)
    }).length
    const vencidos = subs.filter(s => new Date(s.expiry_date) < now).length
    const activos = subs.filter(s => new Date(s.expiry_date) >= now).length

    // Alertas de suscripción proximas a vencer (Master requirement)
    const alertSus = subs.filter(s => {
      const exp = new Date(s.expiry_date);
      const diff = (exp - now) / 86400000;
      return diff <= 3; // Vencidos o por vencer en 3 días
    }).sort((a,b) => new Date(a.expiry_date) - new Date(b.expiry_date)).slice(0, 3);

    const alertHtml = alertSus.length > 0 ? `
      <div style="margin-bottom:25px;">
        <div style="font-size:0.6rem; font-weight:900; color:#e63946; letter-spacing:1px; margin-bottom:10px;">🔴 ALERTAS DE VENCIMIENTO</div>
        <div style="display:grid; gap:10px;">
          ${alertSus.map(s => {
            const exp = new Date(s.expiry_date);
            const diff = Math.ceil((exp - now) / 86400000);
            return `
              <div data-action="TAB" data-tab="SUBS" style="background:rgba(230,57,70,0.05); border:1.5px solid rgba(230,57,70,0.2); border-radius:18px; padding:15px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                <div style="flex:1;">
                   <div style="font-size:0.8rem; font-weight:900; color:#1a1a2e; text-transform:uppercase;">${s.resident_name || 'Residente'}</div>
                   <div style="font-size:0.6rem; color:#e63946; font-weight:700;">${diff < 0 ? `Vencido hace ${Math.abs(diff)} días` : diff === 0 ? 'Vence hoy' : `Vence en ${diff} días`}</div>
                </div>
                <div style="background:#e63946; color:white; font-size:0.55rem; font-weight:900; padding:4px 10px; border-radius:8px;">COBRAR</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : '';

    const statCard = (label, value, sub, color, tab = 'SUBS') => `
      <div data-action="TAB" data-tab="${tab}" style="background:white;padding:18px;border-radius:22px;border:1px solid #f0f0f0;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.03);">
        <div style="font-size:0.5rem;font-weight:800;color:#bbb;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${label}</div>
        <div style="font-size:1.5rem;font-weight:900;color:${color};">${value}</div>
        <div style="font-size:0.55rem;font-weight:700;color:#bbb;margin-top:4px;">${sub}</div>
      </div>`

    return `
      <div style="padding:20px; padding-bottom:100px; background:#f8f9fa;">
        ${alertHtml}

        <!-- STATS DASHBOARD -->
        <div class="stats-dashboard">
           <div class="usage-circle-container">
              <div style="font-size:0.6rem; font-weight:800; color:#999; margin-bottom:15px; text-transform:uppercase;">DENSIDAD DE USO</div>
              <div style="position:relative; width:100px; height:100px;">
                <svg width="100" height="100" viewBox="0 0 100 100" style="transform:rotate(-90deg);">
                  <circle cx="50" cy="50" r="40" stroke="#eee" stroke-width="10" fill="none" />
                  <circle cx="50" cy="50" r="40" stroke="#22c55e" stroke-width="10" fill="none"
                    stroke-dasharray="${dash}" stroke-dashoffset="${offset}" stroke-linecap="round" style="transition:all 1s;" />
                </svg>
                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.2rem; font-weight:900; color:var(--primary);">${perc}%</div>
              </div>
              <div style="margin-top:15px; text-align:center;">
                <div style="font-size:0.8rem; font-weight:900; color:var(--primary);">${occ} de ${total}</div>
                <div style="font-size:0.55rem; font-weight:700; color:#999;">OCUPADOS</div>
              </div>
           </div>
           <div class="mini-stat-card">
              <div style="font-size:0.55rem; font-weight:800; color:#999; text-transform:uppercase;">FLUJO DEL DÍA</div>
              <div style="font-size:1.4rem; font-weight:900; color:var(--primary);">${(state.movements || []).filter(m => new Date(m.timestamp) >= new Date().setHours(0,0,0,0)).length}</div>
              <div style="font-size:0.5rem; color:#22c55e; font-weight:700;">Hoy</div>
           </div>
           <div class="mini-stat-card">
              <div style="font-size:0.55rem; font-weight:800; color:#999; text-transform:uppercase;">PERMANENCIA</div>
              <div style="font-size:1.4rem; font-weight:900; color:var(--primary);">${avgHours > 0 ? avgHours.toFixed(1) + 'h' : '0.0h'}</div>
              <div style="font-size:0.5rem; color:#bbb; font-weight:700;">Promedio</div>
           </div>
        </div>

        <!-- RESUMEN MENSUAL -->
        <div style="margin-bottom:25px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <div style="font-size:0.7rem; font-weight:900; color:var(--primary); text-transform:uppercase; letter-spacing:1px;">RESUMEN MENSUAL</div>
            <div style="font-size:0.6rem; font-weight:700; color:#bbb;">${now.toLocaleString('es-ES',{month:'long',year:'numeric'}).toUpperCase()}</div>
          </div>

          <!-- PROYECTADO + COBRADO: destacados -->
          <div style="background:#1a1a2e; border-radius:24px; padding:22px; margin-bottom:12px; display:grid; grid-template-columns:1fr 1fr; gap:0;">
            <div style="border-right:1px solid rgba(255,255,255,0.1); padding-right:20px;">
              <div style="font-size:0.5rem;font-weight:800;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">INGRESO PROYECTADO</div>
              <div style="font-size:1.8rem;font-weight:900;color:#F5C518;">$${proyectado}</div>
              <div style="font-size:0.55rem;font-weight:700;color:rgba(255,255,255,0.3);margin-top:4px;">${activos} residentes activos</div>
            </div>
            <div style="padding-left:20px;">
              <div style="font-size:0.5rem;font-weight:800;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">COBRADO ESTE MES</div>
              <div style="font-size:1.8rem;font-weight:900;color:#22c55e;">$${cobradoMes.toFixed(0)}</div>
              <div style="font-size:0.55rem;font-weight:700;color:rgba(255,255,255,0.3);margin-top:4px;">${proyectado > 0 ? Math.round((cobradoMes/proyectado)*100) : 0}% del proyectado</div>
            </div>
          </div>

          <!-- ALERTAS: grid 2x2 -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            ${statCard('PENDIENTES DE CONFIRMAR', pendientesCount, 'Pagos reportados', pendientesCount > 0 ? '#f59e0b' : '#22c55e', 'SUBS')}
            ${statCard('POR VENCER', porVencer, 'Próximos 7 días', porVencer > 0 ? '#f59e0b' : '#22c55e', 'SUBS')}
            ${statCard('MOROSOS', vencidos, 'Suscripción vencida', vencidos > 0 ? '#e63946' : '#22c55e', 'SUBS')}
            ${statCard('AL CORRIENTE', activos, 'Solventes hoy', '#22c55e', 'SUBS')}
          </div>
        </div>

        <!-- GESTIÓN RÁPIDA REMOVED POR SOLICITUD -->

           <!-- ADS CAROUSEL ALIGNED AL FINAL -->
           ${activeAds.length ? `
             <div style="margin-top: 20px;">
               <div style="font-size:0.7rem; font-weight:900; color:var(--primary); margin-bottom:15px; text-transform:uppercase;">NOTICIAS & ANUNCIOS</div>
               <div class="carousel-container glass-card" style="border-radius:24px; padding:0; height:180px;">
                 <div class="carousel-track" id="main-carousel">
                   ${activeAds.map(ad => `<div class="ad-card" style="aspect-ratio:auto; height:180px;"><img src="${ad.image_url}" style="object-fit:cover;"></div>`).join('')}
                 </div>
               </div>
             </div>
           ` : ''}

      </div>`
  }

  const renderLevels = (state) => `
    <div style="padding:20px; padding-bottom:120px;">
      <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">GESTIÓN DE ESTRUCTURA</h2>
      
      <!-- GENERAR PLANTA -->
      <div style="background:white; padding:30px; border-radius:32px; margin-bottom:-5px; box-shadow:0 15px 40px rgba(0,0,0,0.04); border:1.5px solid #f0f0f0;">
        <div style="font-size:0.7rem; font-weight:800; color:#999; text-align:center; margin-bottom:20px; text-transform:uppercase; letter-spacing:1px;">NUEVA PLANTA</div>
        <div class="input-stack" style="margin-bottom:20px;">
          <input type="text" id="level-name" placeholder="Piso / Área" style="padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; font-family:var(--font); font-weight:700; background:#fafafa; outline:none;">
          <input type="number" id="level-capacity" placeholder="Capacidad" style="padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; font-family:var(--font); font-weight:700; background:#fafafa; outline:none;">
        </div>
        <button data-action="GENERATE" style="width:100%; padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.85rem; letter-spacing:1px; text-transform:uppercase;">CREAR PLANTA</button>
      </div>

      <div style="display:grid; gap:15px; margin-top:35px;">
        ${state.levels.map(l => {
          const isEditing = editingLevel === l.name;
          const cardColor = l.color || '#1a1a2e';
          
          return `
          <div style="background:white; border-radius:28px; overflow:hidden; border:1.5px solid #f0f0f0; box-shadow:0 10px 30px rgba(0,0,0,0.02); position:relative;">
            <div style="height:6px; background:${cardColor}; width:100%;"></div>
            
            <!-- HEADER -->
            <div style="padding:20px; display:flex; justify-content:space-between; align-items:center;">
              <div style="flex:1;">
                ${isEditing ? `
                  <div style="display:flex; gap:8px;">
                    <input type="text" id="rename-input-${l.name}" value="${l.name}" style="flex:1; padding:8px 12px; border-radius:10px; border:1.5px solid var(--accent); font-weight:900; outline:none;">
                    <button data-action="CONFIRM_RENAME" data-oldname="${l.name}" style="background:var(--primary); color:white; border:none; border-radius:8px; padding:0 12px;">OK</button>
                  </div>
                ` : `
                  <div style="display:flex; align-items:center; gap:10px;">
                    <div style="font-size:1.1rem; font-weight:900; color:var(--primary);">${l.name}</div>
                    <button data-action="START_RENAME" data-name="${l.name}" style="background:none; border:none; color:#bbb; cursor:pointer; width:16px; height:20px;">${ICONS.EDIT}</button>
                  </div>
                  <div style="font-size:0.6rem; font-weight:700; color:#999; margin-top:2px;">${l.slots.length} Puestos · <span style="color:${cardColor}; text-transform:uppercase;">${l.color ? 'Personalizado' : 'Básico'}</span></div>
                `}
              </div>
              
              <div style="display:flex; align-items:center; gap:8px;">
                 <!-- PALETTE WRAPPER -->
                 <div style="display:flex; align-items:center; position:relative;">
                    <div style="display:${openPaletteLevel === l.name ? 'flex' : 'none'}; gap:4px; padding:6px; background:#f4f4f4; border-radius:12px; margin-right:8px; border:1px solid #eee; position:absolute; right:100%; top:50%; transform:translateY(-50%); z-index:10;">
                       ${['#1a1a2e','#e63946','#22c55e','#3b82f6','#a855f7'].map(c => `
                         <div data-action="SET_LEVEL_COLOR" data-name="${l.name}" data-color="${c}" style="width:16px; height:16px; border-radius:50%; background:${c}; cursor:pointer; border:${l.color===c?'2.5px solid white':'none'}; box-shadow:0 2px 5px rgba(0,0,0,0.1);"></div>
                       `).join('')}
                    </div>
                    <button data-action="TOGGLE_PALETTE" data-name="${l.name}" style="background:none; border:none; color:${openPaletteLevel===l.name?'var(--primary)':'#bbb'}; width:22px; height:22px; cursor:pointer; transition:all 0.2s;">
                       ${ICONS.PALETTE}
                    </button>
                 </div>

                 <button data-action="ADD_SLOT" data-name="${l.name}" style="background:#f4f4f4; border:none; color:var(--primary); width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; margin-left:4px;">${ICONS.PLUS}</button>
                 
                 <button data-action="TOGGLE_COLLAPSE" data-name="${l.name}" style="background:none; border:none; color:#bbb; cursor:pointer; width:24px; transition:transform 0.3s; transform:${l.collapsed?'rotate(0deg)':'rotate(180deg)'};">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
                 </button>
                 
                 <button data-action="DELETE_LEVEL" data-name="${l.name}" style="background:rgba(230,57,70,0.08); border:none; color:#e63946; cursor:pointer; width:36px; height:36px; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-left:4px; transition:all 0.2s;">
                    <span style="width:20px;">${ICONS.TRASH}</span>
                 </button>
              </div>
            </div>

            <!-- SLOTS AREA -->
            <div style="display:${l.collapsed ? 'none' : 'block'}; padding:0 20px 20px 20px;">
              <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${l.slots.map(s => `
                  <div style="padding:10px 14px; background:#f8f9fa; border-radius:12px; font-size:0.7rem; font-weight:900; color:var(--primary); display:flex; align-items:center; gap:8px; border:1px solid #f0f0f0;">
                    ${s.label}
                    <button data-action="DELETE_SLOT" data-levelname="${l.name}" data-label="${s.label}" style="border:none; background:none; color:#ddd; font-size:1.1rem; cursor:pointer; line-height:1; font-weight:400;">×</button>
                  </div>
                `).join('')}
                ${!l.slots.length ? '<div style="font-size:0.7rem; color:#bbb; font-weight:700; width:100%; text-align:center; padding:20px;">No hay puestos asignados</div>' : ''}
              </div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </div>`

  const renderFinanceSummary = async (state) => {
    if (!hasFeature('finance_report')) {
      return `<div style="padding:40px; text-align:center; color:#999;">
        <div style="font-size:2rem; margin-bottom:12px;">🔒</div>
        <div style="font-weight:900; color:#1a1a2e;">Función no disponible</div>
        <div style="font-size:0.75rem; margin-top:8px;">
          Disponible desde plan Plata. Contacta a tu administrador Sloty.
        </div>
      </div>`
    }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const todayStr = new Date().toISOString().split('T')[0]

  let subsPays, todayPays;

  if (cachedFinance && Date.now() - cachedFinanceAt < FINANCE_TTL) {
    subsPays  = cachedFinance.subsPays;
    todayPays = cachedFinance.todayPays;
  } else {
    const [subsPayRes, todayPayRes] = await Promise.all([
      supabase.from('payments')
        .select('amount, method, payment_date, status')
        .eq('building_id', state.buildingId)
        .eq('status', 'CONFIRMED')
        .gte('payment_date', monthStart),
      supabase.from('payments')
        .select('amount, method')
        .eq('building_id', state.buildingId)
        .eq('status', 'CONFIRMED')
        .gte('payment_date', todayStr)
    ]);
    subsPays  = subsPayRes.data || [];
    todayPays = todayPayRes.data || [];
    cachedFinance   = { subsPays, todayPays };
    cachedFinanceAt = Date.now();
  }

  const bcv = await getExchangeRate();
  const bcvRate  = bcv?.rate  || null;
  const bcvFecha = bcv?.fecha || null;

  const { data: shifts } = await supabase
    .from('guard_shifts')
    .select('id, guard_name, started_at, ended_at, total_cash, total_mobile, total_bs, entries, exits, absences')
    .eq('building_id', state.buildingId)
    .order('ended_at', { ascending: false })
    .limit(200);

  const guardShifts = shifts || [];

  // Agrupar por guardia
  const byGuard = {};
  guardShifts.forEach(s => {
    if (!byGuard[s.guard_name]) byGuard[s.guard_name] = [];
    byGuard[s.guard_name].push(s);
  });
  const subsRevMonth = subsPays.reduce((a, p) => a + (p.amount || 0), 0)
  const subsRevToday = todayPays.reduce((a, p) => a + (p.amount || 0), 0)

    const todayStart = new Date().setHours(0,0,0,0)
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

    const movs = state.movements || []
    
    // Revenue calculations
    const revToday = movs.filter(m => new Date(m.timestamp) >= todayStart).reduce((a, m) => a + (m.amount || 0), 0)
    const revWeek = movs.filter(m => new Date(m.timestamp) >= sevenDaysAgo).reduce((a, m) => a + (m.amount || 0), 0)
    const projection = revWeek > 0 ? (revWeek / 7) * 7 : 0 // Simplified projection

    // Inventory
    const successfulCollections = movs.filter(m => (m.amount || 0) > 0).length
    const vehiclesInDebt = state.stats?.debt || 0

    // Methods breakdown
    const methods = movs.reduce((acc, m) => {
      if (m.payMethod && m.amount) {
        const key = m.payMethod.toUpperCase().replace(/\s/g, '_')
        acc[key] = (acc[key] || 0) + (m.amount || 0)
      }
      return acc
    }, { "EFECTIVO_USD": 0, "EFECTIVO_BS": 0, "PAGO_MOVIL": 0 })

    // Recent Excedents (> baseRate)
    const baseRate = state.settings?.baseRate || 1
    const excedents = movs.filter(m => (m.amount || 0) > baseRate).slice(0, 3)

    subscribeFinanceRealtime(state.buildingId);
    return `
      <div style="padding:20px; padding-bottom:120px; background:#f8f9fa;">
        <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">RENDIMIENTO FINANCIERO</h2>
        
        <!-- PANEL DE GUARDIAS -->
        <div style="margin-bottom:20px;">
          <div style="font-size:0.7rem; font-weight:900; color:#999; letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;">GUARDIAS</div>
          <div style="display:flex; gap:12px; overflow-x:auto; padding-bottom:8px;">
            ${Object.keys(byGuard).length === 0 ? `
              <div style="font-size:0.75rem; color:#999; padding:12px;">Sin turnos registrados aún.</div>
            ` : Object.entries(byGuard).map(([name, shiftList]) => {
              const totalEarned = shiftList.reduce((a, s) => a + (s.total_cash||0) + (s.total_mobile||0) + (s.total_bs||0), 0);
              const totalShifts = shiftList.length;
              const totalAbsMin = shiftList.reduce((a, s) => a + (s.absences||[]).reduce((b, ab) => b + (ab.duration_min||0), 0), 0);
              const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
              return `
                <div onclick="handleAction('VIEW_GUARD_DETAIL', '${name}')"
                     style="flex-shrink:0; background:#1a1a2e; border-radius:20px;
                            padding:16px 14px; text-align:center; cursor:pointer;
                            min-width:100px; transition:transform 0.15s;"
                     onmouseover="this.style.transform='scale(1.04)'"
                     onmouseout="this.style.transform='scale(1)'">
                  <div style="width:48px; height:48px; border-radius:50%;
                              background:#F5C518; color:#1a1a2e; font-size:1.1rem;
                              font-weight:900; display:flex; align-items:center;
                              justify-content:center; margin:0 auto 8px;">
                    ${initials}
                  </div>
                  <div style="font-size:0.7rem; font-weight:900; color:white;
                              text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">
                    ${name.split(' ')[0]}
                  </div>
                  <div style="font-size:0.65rem; color:#F5C518; font-weight:700;">
                    $${totalEarned.toFixed(2)}
                  </div>
                  <div style="font-size:0.6rem; color:rgba(255,255,255,0.4); margin-top:2px;">
                    ${totalShifts} turno${totalShifts !== 1 ? 's' : ''}
                  </div>
                  ${totalAbsMin > 0 ? `
                    <div style="font-size:0.6rem; color:#e63946; margin-top:3px; font-weight:700;">
                      ⏸ ${totalAbsMin}min ausente
                    </div>` : ''}
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- REVENUE CARDS -->
        <div style="background:white; padding:15px 20px; border-radius:24px; margin-bottom:20px; border:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
           <div style="font-size:0.65rem; font-weight:900; color:#999; text-transform:uppercase;">Tasa BCV del día</div>
           <div id="finance-bcv-rate" style="text-align:right;">
             <div style="font-size:0.9rem; font-weight:900; color:#1a1a2e;">Cargando...</div>
             <div style="font-size:0.5rem; color:#bbb; font-weight:700;">Fuente: Oficial</div>
           </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:15px;">
           <div style="background:#1a1a2e; color:white; padding:25px 15px; border-radius:28px; text-align:center; box-shadow:0 10px 25px rgba(26,26,46,0.2);">
              <div style="font-size:1.8rem; font-weight:900;">$${(revToday + subsRevToday).toFixed(2)}</div>
              <div style="font-size:0.6rem; font-weight:700; color:var(--accent); text-transform:uppercase; margin-top:5px; opacity:0.8;">INGRESOS DE HOY</div>
           </div>
           <div style="background:#F5C518; color:var(--primary); padding:25px 15px; border-radius:28px; text-align:center; box-shadow:0 10px 25px rgba(245,197,24,0.2);">
              <div style="font-size:1.8rem; font-weight:900;">$${revWeek.toFixed(2)}</div>
              <div style="font-size:0.6rem; font-weight:700; text-transform:uppercase; margin-top:5px; opacity:0.8;">ESTA SEMANA</div>
           </div>
           <div style="background:#22c55e; color:white; padding:20px 15px; 
             border-radius:28px; text-align:center; grid-column:1/-1;
             box-shadow:0 10px 25px rgba(34,197,94,0.2);">
             <div style="font-size:1.8rem; font-weight:900;">
               $${subsRevMonth.toFixed(2)}
             </div>
             <div style="font-size:0.6rem; font-weight:700; text-transform:uppercase; 
               margin-top:5px; opacity:0.9;">MENSUALIDADES DEL MES</div>
             ${bcvRate ? `
               <div style="font-size:0.65rem; color:#999; font-weight:700;
                           margin-top:6px; padding:8px 12px;
                           background:rgba(245,197,24,0.06); border-radius:8px;">
                 Tasa BCV: Bs. ${Number(bcvRate).toLocaleString('es-VE', {minimumFractionDigits:2})}
                 ${bcv.source === 'manual' ? '· ⚠️ Manual' : '· ✓ Oficial'}
                 · ${bcvFecha || ''}
               </div>` : ''}
           </div>
        </div>

        <!-- PROJECTION -->
        <div style="border:2px dashed #ddd; background:rgba(255,255,255,0.5); padding:15px; border-radius:20px; text-align:center; margin-bottom:30px;">
           <div style="font-size:0.6rem; font-weight:800; color:#999; text-transform:uppercase; margin-bottom:4px;">PROYECCIÓN ESTIMADA (7 DÍAS)</div>
           <div style="font-size:1.4rem; font-weight:900; color:#22c55e;">~$${projection.toFixed(2)}</div>
        </div>

        <div style="font-size:0.7rem; font-weight:900; color:var(--primary); margin-bottom:15px; text-transform:uppercase; letter-spacing:1px; display:flex; justify-content:space-between;">
           INVENTARIO GLOBAL
           <button data-action="TAB" data-tab="REPORTES" style="background:#1a1a2e; color:var(--accent); border:none; padding:4px 12px; border-radius:10px; font-size:0.6rem; font-weight:900; cursor:pointer;">VER REPORTES DE GUARDIA</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:30px;">
           <div style="background:white; padding:20px; border-radius:24px; border:1px solid #f0f0f0; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900; color:var(--primary);">${successfulCollections}</div>
              <div style="font-size:0.5rem; font-weight:800; color:#999; text-transform:uppercase; margin-top:5px;">COBROS EXITOSOS</div>
           </div>
           <div style="background:white; padding:20px; border-radius:24px; border:1px solid #ffccd5; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900; color:#e63946;">${vehiclesInDebt}</div>
              <div style="font-size:0.5rem; font-weight:800; color:#e63946; text-transform:uppercase; margin-top:5px;">VEHÍCULOS EN DEUDA</div>
           </div>
        </div>

        <!-- USAGE BY METHODS -->
        <div style="font-size:0.7rem; font-weight:900; color:var(--primary); margin-bottom:15px; text-transform:uppercase; letter-spacing:1px;">USO POR MÉTODOS (GLOBAL)</div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:30px;">
           <div style="background:white; padding:15px 10px; border-radius:20px; border:1px solid #f0f0f0; text-align:center;">
              <div style="font-size:1.1rem; font-weight:900; color:#22c55e;">${movs.filter(m => m.payMethod?.includes('USD')).length}</div>
              <div style="font-size:0.45rem; font-weight:800; color:#999; text-transform:uppercase; margin-top:4px;">EFECTIVO $</div>
           </div>
           <div style="background:white; padding:15px 10px; border-radius:20px; border:1px solid #f0f0f0; text-align:center;">
              <div style="font-size:1.1rem; font-weight:900; color:#3b82f6;">${movs.filter(m => m.payMethod?.includes('BS')).length}</div>
              <div style="font-size:0.45rem; font-weight:800; color:#999; text-transform:uppercase; margin-top:4px;">EFECTIVO BS</div>
           </div>
           <div style="background:white; padding:15px 10px; border-radius:20px; border:1px solid #f0f0f0; text-align:center;">
              <div style="font-size:1.1rem; font-weight:900; color:#a855f7;">${movs.filter(m => m.payMethod?.includes('PAGO')).length}</div>
              <div style="font-size:0.45rem; font-weight:800; color:#999; text-transform:uppercase; margin-top:4px;">PAGO MÓVIL</div>
           </div>
        </div>

        <!-- CLOSURES HISTORY -->
        <div style="font-size:0.7rem; font-weight:900; color:var(--primary); margin-bottom:15px; text-transform:uppercase; letter-spacing:1px; display:flex; justify-content:space-between; align-items:center;">
           CIERRES DE CAJA (CORTES)
           <span style="font-size:0.5rem; color:#bbb;">Últimos ${state.closures?.length || 0}</span>
        </div>
        <div style="display:grid; gap:12px; margin-bottom:40px;">
           ${(state.closures || []).map(c => `
             <div style="background:white; border-radius:18px; padding:18px; border:1px solid #eee; display:flex; justify-content:space-between; align-items:center; box-shadow:0 4px 6px rgba(0,0,0,0.02);">
                <div>
                   <div style="font-size:0.85rem; font-weight:900; color:#1a1a2e;">$${(c.total || 0).toFixed(2)}</div>
                   <div style="font-size:0.55rem; color:#bbb; font-weight:800;">Guardián: ${c.guard}</div>
                </div>
                <div style="text-align:right;">
                   <div style="font-size:0.6rem; font-weight:700; color:#1a1a2e;">${new Date(c.timestamp).toLocaleDateString()}</div>
                   <div style="font-size:0.55rem; color:#bbb; font-weight:700;">${new Date(c.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
                <button data-action="VIEW_CLOSURE" data-id="${c.id}" style="background:var(--primary); color:white; border:none; border-radius:10px; padding:8px 12px; font-size:0.5rem; font-weight:900; cursor:pointer;">DETALLES</button>
             </div>
           `).join('') || '<div style="text-align:center; padding:20px; color:#ccc; font-size:0.75rem; border:2px dashed #eee; border-radius:20px;">No hay cierres registrados</div>'}
        </div>

        <!-- RECENT EXCEDENTS / SUBS -->
        <div style="font-size:0.7rem; font-weight:900; color:var(--primary); margin-bottom:15px; text-transform:uppercase; letter-spacing:1px;">ÚLTIMOS PAGOS EXTRA / MENSUALIDADES</div>
        <div style="background:white; border-radius:24px; padding:10px; border:1px solid #f0f0f0;">
           ${excedents.length ? excedents.map(m => `
             <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f9f9f9;">
                <div>
                  <div style="font-size:0.75rem; font-weight:900; color:var(--primary);">${m.category === 'RESIDENTE' ? '⭐ ' : ''}${m.plate || '---'} <span style="font-size:0.55rem; color:#999; font-weight:800;">${m.type === 'MENSUALIDAD' ? '(Mensualidad)' : '(Excedente)'}</span></div>
                   <div style="font-size:0.55rem; color:#bbb; font-weight:700;">${new Date(m.timestamp).toLocaleTimeString()}</div>
                </div>
                <div style="font-size:0.9rem; font-weight:900; color:#22c55e;">+$${m.amount.toFixed(2)}</div>
             </div>
           `).join('') : '<div style="text-align:center; padding:30px; color:#ccc; font-size:0.7rem; font-weight:700;">No hay pagos registrados aún</div>'}
        </div>
      </div>`
  }

  const renderSettings = (state) => {
    if (activeSettingsMenu === 'MAIN') {
       return `
       <div style="padding:20px; padding-bottom:120px;">
          <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:25px;">CONFIGURACIÓN</h2>
          
          <div style="display:grid; gap:15px;">
             <div data-action="SUBMENU" data-menu="TARIFFS" style="background:white; padding:20px; border-radius:24px; border:1.5px solid #f0f0f0; display:flex; align-items:center; gap:15px; cursor:pointer; box-shadow:0 8px 20px rgba(0,0,0,0.02);">
                <div style="width:50px; height:50px; border-radius:16px; background:rgba(34,197,94,0.1); color:#22c55e; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">💰</div>
                <div style="flex:1;">
                   <div style="font-size:1rem; font-weight:900; color:var(--primary);">Tarifas y Reglas</div>
                   <div style="font-size:0.65rem; color:#999; font-weight:700; margin-top:2px;">Configura el tiempo gratis y los montos a cobrar por horas</div>
                </div>
                <div style="color:#bbb; font-size:1.2rem; font-weight:900;">›</div>
             </div>
             
             <div data-action="SUBMENU" data-menu="VISITORS" style="background:white; padding:20px; border-radius:24px; border:1.5px solid #f0f0f0; display:flex; align-items:center; gap:15px; cursor:pointer; box-shadow:0 8px 20px rgba(0,0,0,0.02);">
                <div style="width:50px; height:50px; border-radius:16px; background:rgba(59,130,246,0.1); color:#3b82f6; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">👥</div>
                <div style="flex:1;">
                   <div style="font-size:1rem; font-weight:900; color:var(--primary);">Visitantes</div>
                   <div style="font-size:0.65rem; color:#999; font-weight:700; margin-top:2px;">Campos del cuestionario de ingreso y categorías</div>
                </div>
                <div style="color:#bbb; font-size:1.2rem; font-weight:900;">›</div>
             </div>
             
             <div data-action="SUBMENU" data-menu="AUDIT" style="background:white; padding:20px; border-radius:24px; border:1.5px solid #f0f0f0; display:flex; align-items:center; gap:15px; cursor:pointer; box-shadow:0 8px 20px rgba(0,0,0,0.02);">
                <div style="width:50px; height:50px; border-radius:16px; background:rgba(230,57,70,0.1); color:#e63946; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">📜</div>
                <div style="flex:1;">
                   <div style="font-size:1rem; font-weight:900; color:var(--primary);">Bitácora de Auditoría</div>
                   <div style="font-size:0.65rem; color:#999; font-weight:700; margin-top:2px;">Revisa las acciones de los administradores y configuraciones</div>
                </div>
                <div style="color:#bbb; font-size:1.2rem; font-weight:900;">›</div>
             </div>
             
             <div data-action="SUBMENU" data-menu="PUSH" style="background:white; padding:20px; border-radius:24px; border:1.5px solid #f0f0f0; display:flex; align-items:center; gap:15px; cursor:pointer; box-shadow:0 8px 20px rgba(0,0,0,0.02);">
                <div style="width:50px; height:50px; border-radius:16px; background:rgba(245,197,24,0.1); color:#F5C518; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">🔔</div>
                <div style="flex:1;">
                   <div style="font-size:1rem; font-weight:900; color:var(--primary);">Notificaciones Push</div>
                   <div style="font-size:0.65rem; color:#999; font-weight:700; margin-top:2px;">Activa las alertas en este dispositivo</div>
                </div>
                <div style="color:#bbb; font-size:1.2rem; font-weight:900;">›</div>
             </div>
          </div>
       </div>`
    }
    
    if (activeSettingsMenu === 'PUSH') {
       import('./push.js').then(m => {
          const banner = document.getElementById('push-banner-container');
          if (banner) banner.innerHTML = m.renderPushBanner();
       });
       return `
       <div style="padding:20px; padding-bottom:120px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
             <button data-action="SUBMENU" data-menu="MAIN" style="background:#f4f4f4; border:none; width:40px; height:40px; border-radius:12px; font-size:1.2rem; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:900;">‹</button>
             <h2 style="font-weight:900; color:var(--primary); font-size:1.2rem; margin:0; text-transform:uppercase;">NOTIFICACIONES PUSH</h2>
          </div>
          
          <div id="push-banner-container"></div>
          
          <div style="background:white; padding:25px; border-radius:32px; box-shadow:0 10px 30px rgba(0,0,0,0.04); border:1.5px solid #f0f0f0; text-align:center;">
             <div style="font-size:3rem; margin-bottom:10px;">🔔</div>
             <h3 style="font-weight:900; color:var(--primary); margin-bottom:10px;">Alertas en Tiempo Real</h3>
             <p style="font-size:0.75rem; color:#666; font-weight:700; margin-bottom:25px; line-height:1.5;">Recibe una notificación nativa cuando un residente reporte un pago o cuando un guardia envíe el cierre de caja, sin importar si la app está cerrada.</p>
             
             <button data-action="ACTIVATE_PUSH" style="width:100%; padding:20px; background:#22c55e; color:white; border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.85rem; text-transform:uppercase; box-shadow:0 10px 25px rgba(34,197,94,0.3);">
                ACTIVAR NOTIFICACIONES
             </button>
          </div>
       </div>`
    }
    
    if (activeSettingsMenu === 'TARIFFS') {
       const tariffs = state.settings?.tariffs || []
       return `
       <div style="padding:20px; padding-bottom:120px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
             <button data-action="SUBMENU" data-menu="MAIN" style="background:#f4f4f4; border:none; width:40px; height:40px; border-radius:12px; font-size:1.2rem; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:900;">‹</button>
             <h2 style="font-weight:900; color:var(--primary); font-size:1.2rem; margin:0; text-transform:uppercase;">TARIFAS</h2>
          </div>
          
          <div style="background:white; padding:25px; border-radius:32px; box-shadow:0 10px 30px rgba(0,0,0,0.04); border:1.5px solid #f0f0f0; margin-bottom:20px;">
             <div style="font-size:0.7rem; font-weight:900; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">NUEVA TARIFA</div>
             <div style="display:grid; grid-template-columns:1fr; gap:10px; margin-bottom:15px;">
                 <input type="text" id="new-tariff-name" placeholder="Nombre (ej. Excedente Nocturno)" style="padding:14px; border:2px solid #eee; border-radius:14px; font-weight:700; outline:none;">
                 <div style="display:flex; gap:10px;">
                     <input type="number" id="new-tariff-free" placeholder="Horas Gratis" style="flex:1; padding:14px; border:2px solid #eee; border-radius:14px; font-weight:700; outline:none;">
                     <input type="number" step="0.5" id="new-tariff-rate" placeholder="Monto $" style="flex:1; padding:14px; border:2px solid #eee; border-radius:14px; font-weight:700; outline:none;">
                     <button data-action="ADD_TARIFF" style="background:#22c55e; color:white; border:none; padding:0 22px; border-radius:14px; font-weight:900; cursor:pointer; font-size:1.3rem;">+</button>
                 </div>
             </div>
             
             <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
             
             <div style="font-size:0.7rem; font-weight:900; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">REGLAS DE COBRO GUARDADAS</div>
             <div style="font-size:0.65rem; color:#bbb; font-weight:700; margin-bottom:20px;">Estas reglas aplican automáticamente. Para modificarlas, elimina la regla usando la ✕ roja y crea una nueva arriba.</div>
             
             <div style="display:grid; gap:12px; margin-bottom:20px;" id="tariffs-container">
                ${tariffs.length === 0 ? '<div style="text-align:center; padding:15px; color:#ccc; font-size:0.75rem; border:2px dashed #eee; border-radius:14px;">No hay tarifas configuradas</div>' : ''}
                ${tariffs.map((t, idx) => `
                  <div style="background:${t.active ? '#f0fdf4' : '#fafafa'}; border:1.5px solid ${t.active ? '#bbf7d0' : '#eee'}; padding:15px; border-radius:16px; position:relative;">
                     <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                          <div style="font-size:0.95rem; font-weight:900; color:${t.active ? '#166534' : '#999'}; margin-bottom:4px; text-transform:uppercase;">${t.name}</div>
                          <div style="font-size:0.75rem; color:${t.active ? '#15803d' : '#bbb'}; font-weight:900; letter-spacing:0.5px;">
                             ${t.freeHours} hrs gratis &nbsp;•&nbsp; Tarifa: $${t.baseRate}
                          </div>
                        </div>
                        <div style="display:flex; gap:12px; align-items:center;">
                           <button data-action="TOGGLE_TARIFF" data-idx="${idx}" style="background:none; border:none; cursor:pointer; padding:0; display:flex; align-items:center;">
                              <svg width="40" height="24" viewBox="0 0 36 20" fill="${t.active ? '#22c55e' : '#e5e7eb'}" rx="10"><rect width="36" height="20" rx="10"/><circle cx="${t.active ? '26' : '10'}" cy="10" r="7" fill="white"/></svg>
                           </button>
                           <button data-action="DELETE_TARIFF" data-idx="${idx}" style="background:rgba(230,57,70,0.1); color:#e63946; border:none; width:34px; height:34px; border-radius:10px; font-weight:900; cursor:pointer;" title="Eliminar tarifa">✕</button>
                        </div>
                     </div>
                  </div>
                `).join('')}
             </div>
          </div>
       </div>`
    }
    
    if (activeSettingsMenu === 'VISITORS') {
       return `
       <div style="padding:20px; padding-bottom:120px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
             <button data-action="SUBMENU" data-menu="MAIN" style="background:#f4f4f4; border:none; width:40px; height:40px; border-radius:12px; font-size:1.2rem; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:900;">‹</button>
             <h2 style="font-weight:900; color:var(--primary); font-size:1.2rem; margin:0; text-transform:uppercase;">VISITANTES</h2>
          </div>
          
          <div style="background:white; padding:25px; border-radius:32px; box-shadow:0 10px 30px rgba(0,0,0,0.04); border:1.5px solid #f0f0f0; margin-bottom:20px;">
             <div style="font-size:0.7rem; font-weight:900; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">📋 CUESTIONARIO DE INGRESO</div>
             <div style="font-size:0.65rem; color:#bbb; font-weight:700; margin-bottom:18px;">Campos solicitados al guardia al registrar un visitante (ej: Torre, Piso).</div>
             <div style="display:grid; gap:10px; margin-bottom:15px;">
               ${(state.settings?.customFields || []).map(f => `
                 <div style="background:#f8f9fa; padding:14px 18px; border-radius:14px; display:flex; justify-content:space-between; align-items:center;">
                   <div style="font-size:0.85rem; font-weight:900; color:#1a1a2e;">${f.label}</div>
                   <button data-action="DELETE_CUSTOM_FIELD" data-id="${f.id}" style="background:rgba(230,57,70,0.1); color:#e63946; border:none; width:32px; height:32px; border-radius:50%; font-weight:900; cursor:pointer;">×</button>
                 </div>
               `).join('') || '<div style="text-align:center; padding:15px; color:#ccc; font-size:0.75rem; border:2px dashed #eee; border-radius:14px;">No hay campos configurados</div>'}
             </div>
             <div style="display:flex; gap:10px;">
               <input type="text" id="new-field-label" placeholder="Ej: Apartamento" style="flex:1; padding:14px; border:1.5px solid #eee; border-radius:14px; font-weight:700; font-family:var(--font); outline:none;">
               <button data-action="ADD_CUSTOM_FIELD" style="background:#22c55e; color:white; border:none; padding:0 22px; border-radius:14px; font-weight:900; cursor:pointer; font-size:1.3rem;">+</button>
             </div>
          </div>
          
          <div style="background:white; padding:25px; border-radius:32px; box-shadow:0 10px 30px rgba(0,0,0,0.04); border:1.5px solid #f0f0f0;">
             <div style="font-size:0.7rem; font-weight:900; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">🏷️ CATEGORÍAS</div>
             <div style="font-size:0.65rem; color:#bbb; font-weight:700; margin-bottom:18px;">Tipos de visitante (Visita, Mudanza) para identificarlos en el mapa.</div>
             <div style="display:grid; gap:10px; margin-bottom:15px;">
               ${(state.settings?.categories || []).map(c => `
                 <div style="background:#f8f9fa; padding:14px 18px; border-radius:14px; display:flex; justify-content:space-between; align-items:center;">
                   <div style="display:flex; align-items:center; gap:12px;">
                     <div style="width:34px; height:34px; background:${c.color}; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:900; color:white;">${c.tag || c.label.charAt(0)}</div>
                     <div style="font-size:0.85rem; font-weight:900; color:#1a1a2e;">${c.label}</div>
                   </div>
                   <button data-action="DELETE_CATEGORY" data-id="${c.id}" style="background:rgba(230,57,70,0.1); color:#e63946; border:none; width:32px; height:32px; border-radius:50%; font-weight:900; cursor:pointer;">×</button>
                 </div>
               `).join('') || '<div style="text-align:center; padding:15px; color:#ccc; font-size:0.75rem; border:2px dashed #eee; border-radius:14px;">No hay categorías configuradas</div>'}
             </div>
             <div style="display:flex; gap:10px; align-items:center;">
               <input type="text" id="new-cat-label" placeholder="Ej: Delivery" style="flex:1; padding:14px; border:1.5px solid #eee; border-radius:14px; font-weight:700; font-family:var(--font); outline:none;">
               <input type="color" id="new-cat-color" value="#3b82f6" style="width:48px; height:48px; border:none; border-radius:12px; cursor:pointer; padding:2px;">
               <button data-action="ADD_CATEGORY" style="background:#3b82f6; color:white; border:none; padding:0 20px; border-radius:14px; font-weight:900; cursor:pointer; height:48px; font-size:1.3rem;">+</button>
             </div>
          </div>
       </div>`
    }
    
    if (activeSettingsMenu === 'AUDIT') {
       if (!hasFeature('audit_log')) {
         return `<div style="padding:40px; text-align:center; color:#999;">
           <div style="font-size:2rem; margin-bottom:12px;">🔒</div>
           <div style="font-weight:900; color:#1a1a2e;">Función no disponible</div>
           <div style="font-size:0.75rem; margin-top:8px;">
             Disponible desde plan Bronce. Contacta a tu administrador Sloty.
           </div>
         </div>`
       }
       return `
       <div style="padding:20px; padding-bottom:120px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
             <button data-action="SUBMENU" data-menu="MAIN" style="background:#f4f4f4; border:none; width:40px; height:40px; border-radius:12px; font-size:1.2rem; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:900;">‹</button>
             <h2 style="font-weight:900; color:var(--primary); font-size:1.2rem; margin:0; text-transform:uppercase;">BITÁCORA DE AUDITORÍA</h2>
          </div>
          
          <div style="background:white; padding:25px; border-radius:32px; box-shadow:0 10px 30px rgba(0,0,0,0.04); border:1.5px solid #f0f0f0;">
             <div style="display:grid; gap:8px;">
               ${(state.auditLog || []).slice(0,50).map(l => `
                 <div style="background:#f8f9fa; padding:12px 16px; border-radius:12px;">
                   <div style="font-size:0.8rem; font-weight:900; color:#1a1a2e;">${l.action}</div>
                   <div style="display:flex; justify-content:space-between; margin-top:4px;">
                     <div style="font-size:0.55rem; color:#bbb; font-weight:700;">${l.user}</div>
                     <div style="font-size:0.55rem; color:#bbb;">${new Date(l.timestamp).toLocaleString()}</div>
                   </div>
                 </div>
               `).join('') || '<div style="text-align:center; padding:20px; color:#bbb; font-size:0.75rem;">Sin registros</div>'}
             </div>
          </div>
       </div>`
    }
  }

  const renderReports = async (state) => {
    const { data: incidents } = await supabase
      .from('incidents')
      .select('*')
      .eq('building_id', state.buildingId)
      .order('created_at', { ascending: false })
      .limit(100);

    const incidentsList = incidents || [];
    const now = new Date()
    const movs = (state.movements || []).filter(m => {
      const d = new Date(m.timestamp)
      if (reportFilter === 'HOY') return d >= new Date().setHours(0,0,0,0)
      if (reportFilter === 'SEMANA') return (now - d) / 86400000 <= 7
      if (reportFilter === 'MES') return (now - d) / 86400000 <= 30
      return true
    })

    const totalRev = movs.reduce((a, m) => a + (m.amount || 0), 0)

    return `
      <div style="padding:20px; padding-bottom:100px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 style="font-weight:900; margin:0;">HISTORIAL</h3>
          <button data-action="DOWNLOAD_CSV" style="background:#1a1a2e; color:#F5C518; border:none; padding:8px 16px; border-radius:10px; font-weight:700; font-size:0.75rem; cursor:pointer;">EXCEL (CSV)</button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px;">
           <div style="background:white; padding:15px; border-radius:20px; border:1.5px solid #f0f0f0;">
              <div style="font-size:0.6rem; font-weight:700; color:#999;">INGRESOS EN FILTRO</div>
              <div style="font-size:1.4rem; font-weight:900;">${movs.length}</div>
           </div>
           <div style="background:white; padding:15px; border-radius:20px; border:1.5px solid #f0f0f0;">
              <div style="font-size:0.6rem; font-weight:700; color:#999;">RECOLECTADO</div>
              <div style="font-size:1.4rem; font-weight:900; color:#22c55e;">$${totalRev.toFixed(0)}</div>
           </div>
        </div>

        <div style="display:flex; gap:8px; margin-bottom:20px; overflow-x:auto; padding-bottom:4px;">
          ${['HOY','SEMANA','MES','TODO'].map(f => `
            <button data-action="FILTER_REPORTS" data-filter="${f}" 
              style="padding:10px 18px; border-radius:12px; border:none; font-weight:700; font-size:0.75rem; 
              background:${reportFilter === f ? '#1a1a2e' : '#f0f0f0'}; 
              color:${reportFilter === f ? '#F5C518' : '#999'}; cursor:pointer; white-space:nowrap;">
              ${f === 'HOY' ? 'Hoy' : f === 'SEMANA' ? '7 días' : f === 'MES' ? '30 días' : 'Todo'}
            </button>
          `).join('')}
        </div>

        <div style="display:grid; gap:12px;">
          ${movs.length ? movs.map(m => `
            <div style="background:white; padding:18px; border-radius:24px; border:1px solid #f0f0f0; box-shadow:0 10px 30px rgba(0,0,0,0.02);">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                  <div style="font-size:1rem; font-weight:900; color:#1a1a2e;">${m.plate || '---'}</div>
                  <div style="font-size:0.7rem; font-weight:700; color:#999; margin-top:2px;">${new Date(m.timestamp).toLocaleString()}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-weight:900; color:${(m.type==='ENTRY'||m.type==='INGRESO')?'#22c55e':'#3b82f6'}; font-size:0.6rem; letter-spacing:1px;">${m.type}</div>
                  <div style="font-size:0.8rem; font-weight:900; color:#1a1a2e; margin-top:2px;">${m.slot || '--'}</div>
                </div>
              </div>
              
              <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                <span style="background:#f4f4f4; padding:4px 10px; border-radius:6px; font-size:0.6rem; font-weight:700; color:#666;">${m.category}</span>
                ${Object.entries(m.metadata || {}).map(([k,v]) => `
                  <span style="background:rgba(245,197,24,0.1); color:#D97706; padding:4px 10px; border-radius:6px; font-size:0.6rem; font-weight:700;">${k.toUpperCase()}: ${v}</span>
                `).join('')}
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px dashed #eee;">
                <div style="font-size:0.65rem; font-weight:700; color:#999;">Guardia: <span style="color:#666;">${m.guardName || 'Admin'}</span></div>
                <div style="font-size:0.65rem; font-weight:900; color:#1a1a2e;">${m.payMethod ? `PAGO: ${m.payMethod.replace('_', ' ')}` : '---'}</div>
              </div>
            </div>
          `).join('') : '<div style="text-align:center; padding:40px; color:#bbb; font-weight:700;">No hay movimientos en este periodo</div>'}
        </div>

        <!-- INCIDENTES -->
        <div style="margin-top:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="font-size:0.7rem; font-weight:900; color:#999;
                        letter-spacing:2px; text-transform:uppercase;">
              Incidentes Reportados
            </div>
            <span style="background:#FCEBEB; color:#A32D2D; font-size:0.65rem;
                         font-weight:900; padding:3px 10px; border-radius:50px;">
              ${incidentsList.filter(i => !i.resolved).length} sin resolver
            </span>
          </div>

          ${incidentsList.length === 0 ? `
            <div style="text-align:center; color:#999; font-size:0.75rem;
                        padding:24px; background:#f8f9fa; border-radius:16px;">
              Sin incidentes registrados
            </div>
          ` : incidentsList.map(inc => `
            <div style="background:white; border-radius:16px; padding:16px;
                        margin-bottom:10px; border:1.5px solid ${inc.resolved ? '#eee' : '#FCEBEB'};">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div style="display:flex; gap:8px; align-items:center;">
                  <span style="background:${inc.resolved ? '#EAF3DE' : '#FCEBEB'};
                               color:${inc.resolved ? '#3B6D11' : '#A32D2D'};
                               font-size:0.65rem; font-weight:900;
                               padding:3px 10px; border-radius:50px;">
                    ${inc.type}
                  </span>
                  ${!inc.resolved ? `
                    <button data-action="RESOLVE_INCIDENT" data-id="${inc.id}"
                      style="background:#EAF3DE; color:#3B6D11; border:none;
                             border-radius:50px; padding:3px 10px; font-size:0.65rem;
                             font-weight:900; cursor:pointer;">
                      ✓ RESOLVER
                    </button>` : `
                    <span style="font-size:0.65rem; color:#999; font-weight:700;">✓ Resuelto</span>`}
                </div>
                <div style="font-size:0.65rem; color:#999; font-weight:700;">
                  ${new Date(inc.created_at).toLocaleString('es-VE', { dateStyle:'short', timeStyle:'short' })}
                </div>
              </div>
              <div style="font-size:0.8rem; font-weight:700; color:#1a1a2e; margin-bottom:4px;">
                ${inc.description}
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                <span style="font-size:0.65rem; color:#999; font-weight:700;">
                  👮 ${inc.guard_name || 'Guardia'}
                </span>
                ${inc.plate ? `<span style="font-size:0.65rem; color:#999; font-weight:700;">🚗 ${inc.plate}</span>` : ''}
                ${inc.slot  ? `<span style="font-size:0.65rem; color:#999; font-weight:700;">📍 ${inc.slot}</span>`  : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>`
  }

  const renderPersonnel = (state) => {
    const editG = editingGuard ? state.personnel.find(p => p.id === editingGuard) : null;
    const now = new Date();
    const todayStart = new Date().setHours(0,0,0,0);

    return `
    <div style="padding:20px;padding-bottom:120px; background:#f8f9fa;">
      <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">GESTIÓN DE PERSONAL</h2>
      
      <div style="background:white; padding:30px; border-radius:32px; margin-bottom:35px; box-shadow:0 15px 40px rgba(0,0,0,0.04); border:1.5px solid #f0f0f0;">
        <div style="font-size:0.7rem; font-weight:800; color:#999; text-align:center; margin-bottom:20px; text-transform:uppercase; letter-spacing:1px;">
           ${editingGuard ? 'EDITAR PERFIL' : 'REGISTRAR NUEVO GUARDIA'}
        </div>
        
        <div style="display:flex; justify-content:center; margin-bottom:30px;">
          <div id="photo-dropzone" style="width:120px; height:120px; border-radius:50%; background:#f9f9f9; border:2.5px dashed #ddd; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden; position:relative; transition:all 0.3s ease;">
            <img id="guard-photo-preview" src="${editG?.photo || ''}" style="width:100%; height:100%; object-fit:cover; display:${editG?.photo ? 'block' : 'none'};">
            <div id="photo-placeholder" style="text-align:center; color:#ccc; display:${editG?.photo ? 'none' : 'block'};">
              <div style="font-size:2rem; line-height:1;">+</div>
            </div>
          </div>
          <input type="file" id="guard-photo-input" accept="image/*" style="display:none;">
        </div>

        <input type="text" id="guard-name" value="${editG?.name || ''}" placeholder="Nombre Completo" style="width:100%; box-sizing:border-box; padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; margin-bottom:12px; font-family:var(--font); font-weight:700; outline:none; background:#fafafa;">
        <input type="tel" id="guard-phone" value="${editG?.phone || ''}" placeholder="Teléfono WhatsApp (Ej: 58412...)" style="width:100%; box-sizing:border-box; padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; margin-bottom:12px; font-family:var(--font); font-weight:700; outline:none; background:#fafafa;">
        
        <div style="margin-bottom:25px;">
          <select id="guard-shift" style="width:100%; box-sizing:border-box; padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; background:#fafafa; font-family:var(--font); font-weight:700; outline:none; appearance:none;">
            <option value="Mañana" ${editG?.shift==='Mañana'?'selected':''}>Mañana</option>
            <option value="Tarde" ${editG?.shift==='Tarde'?'selected':''}>Tarde</option>
            <option value="Noche" ${editG?.shift==='Noche'?'selected':''}>Noche</option>
            <option value="Rotativo" ${editG?.shift==='Rotativo'?'selected':''}>Rotativo</option>
          </select>
        </div>

        <div style="display:flex; gap:10px;">
          <button data-action="ADD_GUARD" style="flex:2; padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.85rem; letter-spacing:1px; text-transform:uppercase; box-shadow:0 10px 20px rgba(26,26,46,0.15);">
            ${editingGuard ? 'GUARDAR CAMBIOS' : 'AÑADIR A LA NOMINA'}
          </button>
          ${editingGuard ? `<button data-action="CANCEL_EDIT" style="flex:1; padding:20px; background:#f4f4f4; color:#666; border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.85rem; text-transform:uppercase;">CANCELAR</button>` : ''}
        </div>
      </div>

      <div style="display:grid; gap:12px; max-width: 480px; margin-left:auto; margin-right:auto;">
        ${(state.personnel || []).map(p => {
          const gMovs = (state.movements || []).filter(m => m.guardName === p.name);
          const todayCount = gMovs.filter(m => new Date(m.timestamp) >= todayStart).length;
          const lastActive = gMovs.length > 0 ? new Date(gMovs[0].timestamp) : null;
          const activeNow = lastActive && (now - lastActive) < 12 * 60 * 60 * 1000;

          return `
            <div style="background:white; padding:15px 20px; border-radius:24px; display:flex; justify-content:space-between; align-items:center; border:1.5px solid #f8f8f8; box-shadow:0 10px 30px rgba(0,0,0,0.02); box-sizing:border-box; width:100%;">
              <div style="display:flex; align-items:center; gap:15px;">
                <div style="width:60px; height:60px; border-radius:50%; background:#f0f0f0; overflow:hidden; border:2px solid #fff; box-shadow:0 5px 15px rgba(0,0,0,0.05); position:relative;">
                  ${p.photo ? `<img src="${p.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#ccc; font-weight:900; background:#eee;">${p.name.charAt(0)}</div>`}
                  ${activeNow ? `<div style="position:absolute; bottom:4px; right:4px; width:12px; height:12px; background:#22c55e; border:2px solid white; border-radius:50%; box-shadow:0 0 10px rgba(34,197,94,0.5);"></div>` : ''}
                </div>
                <div>
                  <div style="display:flex; align-items:center; gap:8px;">
                     <div style="font-weight:900; color:var(--primary); font-size:1rem;">${p.name}</div>
                     <div style="font-size:0.5rem; background:#f0f0f0; padding:2px 8px; border-radius:10px; font-weight:800; color:#999; text-transform:uppercase;">${p.shift}</div>
                  </div>
                  <div style="font-size:0.7rem; color:#bbb; font-weight:700; margin-top:2px;">
                     ${p.pin ? `PIN: <span style="color:var(--primary);">${p.pin}</span>` : '<span style="color:#e63946;">PENDIENTE ACTIVACIÓN</span>'} · 
                     <span style="color:#22c55e; font-weight:800;">${todayCount} movs hoy</span>
                  </div>
                </div>
              </div>
              
              <div style="display:flex; align-items:center; gap:10px;">
                 <button data-action="SEND_WHATSAPP_GUARD" data-id="${p.id}" style="background:#22c55e; color:white; border:none; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:900; font-size:1rem; box-shadow:0 5px 15px rgba(34,197,94,0.2);">W</button>
                 <button data-action="EDIT_GUARD" data-id="${p.id}" style="background:#f4f4f4; color:#999; border:none; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.8rem;">✎</button>
                 <button data-action="DELETE_GUARD" data-id="${p.id}" style="color:#ffccd5; background:none; border:none; font-weight:900; cursor:pointer; font-size:0.65rem; text-transform:uppercase;">×</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>`;
  }

  const renderTabContent = async (state) => {
    if (!elMain) return; let html = ''
    
    // Non-blocking loading indicator if switching tabs
    if (!elMain.innerHTML.includes('Cargando...') && elMain.dataset.lastTab !== activeTab) {
       elMain.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:50vh; color:#999; font-weight:900; font-size:0.8rem; letter-spacing:2px;">CARGANDO...</div>`;
    }
    elMain.dataset.lastTab = activeTab;

    switch(activeTab) {
      case 'HOME': 
        const { data: adsData } = await supabase.from('ads')
          .select('*')
          .or(`building_id.is.null,building_id.eq.${state.buildingId}`)
          .order('timestamp', { ascending: false })
        html = await renderHome(state, adsData || []); 
        break
      case 'SUBS': html = await renderMonthlySystem(state); break
      case 'PERSONAL': html = renderPersonnel(state); break
      case 'STRUCTURE': html = renderLevels(state); break
      case 'REPORTES': html = renderReports(state); break
      case 'FINANCE': html = await renderFinanceSummary(state); break
      case 'SETTINGS': html = renderSettings(state); break
      case 'NOTIFICATIONS': html = renderNotifications(state); break
      case 'PROFILE': html = renderProfile(state); break
      case 'ABONOS': html = await renderAbonos(state); break
    }
    elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${html}</div>`; if(activeTab==='PERSONAL') setupPersonnelHooks()
  }

  const setupPersonnelHooks = () => {
    const dz = elMain?.querySelector('#photo-dropzone'), i = elMain?.querySelector('#guard-photo-input'), p = elMain?.querySelector('#guard-photo-preview'), s = elMain?.querySelector('#photo-placeholder')
    if (dz && i) {
      dz.onclick = () => i.click();
      i.onchange = (e) => {
        const file = e.target.files[0]; if (!file) return; const r = new FileReader()
        r.onload = (re) => { p.src = re.target.result; p.style.display = 'block'; s.style.display = 'none' }
        r.readAsDataURL(file)
      }
    }
  }

  const renderNotifications = (state) => {
    import('../db.js').then(db => db.markNotificationsRead())
    return `
    <div style="padding:20px; padding-bottom:120px; background:#f8f9fa;">
      <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">NOTIFICACIONES</h2>
      
      <div style="display:grid; gap:12px;">
        ${(state.notifications || []).map(n => `
          <div style="background:white; padding:20px; border-radius:24px; border:1.5px solid #f0f0f0; box-shadow:0 8px 25px rgba(0,0,0,0.02); display:flex; gap:15px; align-items:center;">
             <div style="width:45px; height:45px; border-radius:50%; background:${n.type==='CIERRE_CAJA'?'#22c55e':'#3b82f6'}; display:flex; align-items:center; justify-content:center; color:white; font-size:1.2rem;">
               ${n.type==='CIERRE_CAJA' ? '$' : '!'}
             </div>
             <div style="flex:1;">
               <div style="display:flex; justify-content:space-between; align-items:center;">
                 <div style="font-weight:900; color:var(--primary); font-size:0.85rem;">${n.type === 'CIERRE_CAJA' ? 'CIERRE DE CAJA' : 'ALERTA'}</div>
                 <div style="font-size:0.6rem; color:#bbb; font-weight:700;">${new Date(n.timestamp).toLocaleTimeString()}</div>
               </div>
               <div style="font-size:0.75rem; color:#666; margin-top:4px; font-weight:700;">${n.msg}</div>
               <div style="font-size:0.6rem; color:#999; font-weight:800; margin-top:6px; text-transform:uppercase;">GUARDIA: ${n.guard}</div>
             </div>
          </div>
        `).join('')}
        ${!state.notifications?.length ? '<div style="text-align:center; padding:100px 20px; color:#ccc; font-weight:900;">NO HAY NOTIFICACIONES</div>' : ''}
      </div>
    </div>`
  }

  const renderProfile = (state) => `
    <div style="padding:20px; padding-bottom:120px; background:#f8f9fa;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin:0;">PERFIL DEL EDIFICIO</h2>
        <button data-action="SHOW_PLANS" style="background:#e63946; color:white; border:none; padding:8px 16px; border-radius:12px; font-weight:900; font-size:0.75rem; cursor:pointer; text-transform:uppercase; box-shadow:0 10px 20px rgba(230,57,70,0.2);">
          RENOVAR SUSCRIPCIÓN
        </button>
      </div>
      
      <div style="background:white; padding:30px; border-radius:32px; box-shadow:0 15px 40px rgba(0,0,0,0.04); border:1.5px solid #f0f0f0;">
        <div style="text-align:center; margin-bottom:20px;">
           <img id="profile-logo-preview" src="${state.logo_url || '/icons/Sloty logo negro.png'}" style="height:80px; object-fit:contain; padding:10px; border-radius:16px; margin-bottom:10px; background:${state.logo_url ? 'transparent' : 'var(--primary)'};">
           <div style="font-size:0.7rem; font-weight:700; color:#666; margin-bottom:10px;">Logo de tu Edificio</div>
           <input type="file" id="edit-building-logo" accept="image/*" style="display:none;" onchange="
             const f=this.files[0];
             if(f){
               const r=new FileReader();
               r.onload=(e)=>{ document.getElementById('profile-logo-preview').src=e.target.result; document.getElementById('profile-logo-preview').style.background='transparent'; window._tempLogo=e.target.result; };
               r.readAsDataURL(f);
             }
           ">
           <button onclick="document.getElementById('edit-building-logo').click()" style="padding:10px 18px; border-radius:12px; border:1px dashed #ccc; background:transparent; font-weight:900; font-size:0.7rem; cursor:pointer;">CAMBIAR LOGO</button>
        </div>
        <div style="display:grid; gap:20px; margin-bottom:30px;">
          <div>
            <label style="font-size:0.65rem; font-weight:800; color:#999; text-transform:uppercase; display:block; margin-bottom:8px;">Nombre del Edificio</label>
            <input type="text" id="edit-building-name" value="${state.buildingName}" style="width:100%; padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; font-family:var(--font); font-weight:700; background:#fafafa; outline:none;">
          </div>
          <div>
            <label style="font-size:0.65rem; font-weight:800; color:#999; text-transform:uppercase; display:block; margin-bottom:8px;">Correo Electrónico</label>
            <input type="email" id="edit-admin-email" value="${state.adminInfo?.email || ''}" style="width:100%; padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; font-family:var(--font); font-weight:700; background:#fafafa; outline:none;">
          </div>
          <div>
            <label style="font-size:0.65rem; font-weight:800; color:#999; text-transform:uppercase; display:block; margin-bottom:8px;">Teléfono de Contacto</label>
            <input type="tel" id="edit-admin-phone" value="${state.adminInfo?.phone || ''}" placeholder="+58..." style="width:100%; padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; font-family:var(--font); font-weight:700; background:#fafafa; outline:none;">
          </div>
        </div>
        
        <button data-action="SAVE_PROFILE" style="width:100%; padding:20px; background:var(--primary); color:var(--accent); border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.85rem; letter-spacing:1px; text-transform:uppercase; box-shadow:0 10px 25px rgba(26,26,46,0.2);">GUARDAR CAMBIOS</button>
        <button data-action="TAB" data-tab="HOME" style="width:100%; padding:18px; background:none; color:#666; border:none; margin-top:10px; font-weight:700; cursor:pointer; font-size:0.75rem;">CANCELAR</button>
      </div>
    </div>`

  const renderModal = () => {
    const l = container.querySelector('#modal-layer'); if(!l) return; 
    if(!pendingAction){ 
      l.innerHTML=''; 
      l.style.pointerEvents = 'none';
      return 
    }
    l.style.pointerEvents = 'auto';

    if (pendingAction.type === 'CUSTOM_MODAL') {
      l.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px; backdrop-filter:blur(15px); animation: fadeIn 0.3s ease;">
          <div style="background:white; padding:35px 25px; border-radius:35px; width:100%; max-width:380px; text-align:center; box-shadow:0 25px 50px rgba(0,0,0,0.3); animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <div style="font-size:1.4rem; font-weight:900; color:var(--primary); margin-bottom:15px; text-transform:uppercase; letter-spacing:1px;">${pendingAction.title}</div>
            <div style="margin-bottom:30px;">${pendingAction.content}</div>
            <button data-action="CANCEL_MODAL" style="width:100%; background:var(--primary); color:var(--accent); border:none; padding:20px; border-radius:20px; font-weight:900; font-size:0.9rem; cursor:pointer; letter-spacing:1px;">ENTENDIDO</button>
          </div>
        </div>
      `;
      return;
    }

    if (pendingAction.type === 'CONFIRM_MODAL') {
      l.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px; backdrop-filter:blur(15px);">
          <div style="background:white; padding:35px 25px; border-radius:35px; width:100%; max-width:380px; text-align:center;">
            <div style="font-size:1.4rem; font-weight:900; color:#e63946; margin-bottom:15px; text-transform:uppercase;">${pendingAction.title}</div>
            <div style="margin-bottom:30px;">${pendingAction.content}</div>
            <div style="display:flex; flex-direction:column; gap:10px;">
              <button id="modal-confirm-btn" style="width:100%; background:#e63946; color:white; border:none; padding:18px; border-radius:18px; font-weight:900; font-size:0.9rem; cursor:pointer;">ELIMINAR AHORA</button>
              <button data-action="CANCEL_MODAL" style="width:100%; background:#f4f4f4; color:#333; border:none; padding:18px; border-radius:18px; font-weight:900; font-size:0.9rem; cursor:pointer;">CANCELAR</button>
            </div>
          </div>
        </div>
      `;
      const cBtn = l.querySelector('#modal-confirm-btn');
      if(cBtn) cBtn.onclick = pendingAction.confirmAction;
      return;
    }

      l.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;backdrop-filter:blur(10px);">
          <div style="background:white;padding:30px;border-radius:32px;width:100%;max-width:380px;text-align:center;">
            <h3 style="font-weight:900;margin-bottom:10px;">Confirmar acción</h3>
            <p style="color:#666;font-size:0.85rem;margin-bottom:30px;">¿Estás seguro de continuar con esta operación?</p>
            <div style="display:flex;flex-direction:column;gap:10px;">
              <button data-action="CONFIRM_DELETE" style="background:#e63946;color:white;border:none;padding:18px;border-radius:18px;font-weight:900;">CONFIRMAR</button>
              <button data-action="CANCEL_MODAL" style="background:#f4f4f4;color:#333;border:none;padding:18px;border-radius:18px;font-weight:900;">VOLVER</button>
            </div>
          </div>
        </div>
      `;
  }

  const renderMonthlySystem = async (state) => {
    // Force a fresh fetch from Supabase
    const { subs, bld } = await getSubsCached(state.buildingId);
    const fetchErr = null;
    
    if (fetchErr) console.error("Error fetching residents:", fetchErr);
    
    // Check if we need to show abono form for someone
    const abonoTarget = container.querySelector('#abono-form-container');

    return `
    <div style="padding:20px; padding-bottom:120px; background:#f8f9fa;">
      <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">SISTEMA DE RESIDENTES</h2>
      
      <!-- NUEVO RESIDENTE -->
      <div style="background:#1a1a2e; padding:25px; border-radius:28px; color:white; margin-bottom:25px; box-shadow:0 15px 35px rgba(26,26,46,0.3);">
         <div style="font-size:0.7rem; font-weight:800; color:var(--accent); text-transform:uppercase; margin-bottom:15px;">NUEVO RESIDENTE (CONTRATO)</div>
         <div style="display:grid; gap:12px;">
            <input type="text" id="new-sub-name" placeholder="Nombre Completo" style="padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
            <div id="new-sub-plates-container" style="display:grid; gap:8px;">
               <div style="display:flex; gap:8px;">
                  <input type="text" class="new-sub-plate-input" placeholder="Placa Vehículo 1" style="flex:1; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700; text-transform:uppercase;">
               </div>
            </div>
            <button id="add-plate-field" type="button" style="background:none; border:1px dashed rgba(255,255,255,0.3); color:rgba(255,255,255,0.6); padding:10px; border-radius:12px; font-size:0.7rem; font-weight:700; cursor:pointer; margin-top:5px;">+ AÑADIR OTRO VEHÍCULO</button>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">MARCA</label>
                  <input type="text" id="vehicle-brand" placeholder="Toyota..." style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">MODELO</label>
                  <input type="text" id="vehicle-model" placeholder="Corolla..." style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">COLOR</label>
                  <input type="text" id="vehicle-color" placeholder="Rojo..." style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">PRECIO ACORDADO ($)</label>
                  <input type="number" id="new-sub-price" value="${bld?.monthly_rate || 0}" style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:900;">
               </div>
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">CANT. PUESTOS</label>
                  <input type="number" id="new-sub-count" value="1" style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:900;">
               </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">TORRE</label>
                  <input type="text" id="new-sub-tower" placeholder="Ej: A" style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">PISO</label>
                  <input type="text" id="new-sub-floor" placeholder="Ej: 4" style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">APARTAMENTO</label>
                  <input type="text" id="new-sub-apt" placeholder="Ej: 402" style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">TELÉFONO</label>
                  <input type="tel" id="new-sub-phone" placeholder="+58..." style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
            </div>
            <div style="display:flex; gap:10px;">
               <button data-action="ADD_RESIDENT" style="flex:2; padding:18px; background:var(--accent); color:var(--primary); border:none; border-radius:14px; font-weight:900; font-size:0.8rem; cursor:pointer; margin-top:5px; text-transform:uppercase;">${editingResident ? 'GUARDAR CAMBIOS' : 'REGISTRAR Y ACTIVAR'}</button>
               ${editingResident ? `<button data-action="CANCEL_EDIT_RESIDENT" style="flex:1; padding:18px; background:rgba(255,255,255,0.1); color:white; border:none; border-radius:14px; font-weight:700; font-size:0.8rem; cursor:pointer; margin-top:5px;">CANCELAR</button>` : ''}
            </div>
         </div>
      </div>

      <!-- LISTA DE RESIDENTES -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <div style="font-size:0.7rem; font-weight:900; color:var(--primary); text-transform:uppercase; letter-spacing:1px;">RESIDENTES ACTIVOS (${subs?.length || 0})</div>
        <div style="font-size:0.6rem; color:#999; font-weight:800;">TOTAL: $${(subs || []).reduce((a,b)=>a+(b.custom_price||0),0)}/mes</div>
      </div>

      <div style="display:grid; gap:12px;">
        ${(subs || []).map(r => {
          const daysLeft = Math.ceil((new Date(r.expiry_date) - new Date()) / 86400000)
          const expiryBadge = daysLeft <= 5 && daysLeft >= 0
            ? '<span style="background:#fff3cd; color:#856404; font-size:0.5rem; font-weight:900; padding:2px 6px; border-radius:6px; margin-left:6px;">⚠️ ' + daysLeft + 'd</span>'
            : daysLeft < 0
            ? '<span style="background:#ffd6d6; color:#e63946; font-size:0.5rem; font-weight:900; padding:2px 6px; border-radius:6px; margin-left:6px;">VENCIDO</span>'
            : ''
          return `
          <div style="background:white; padding:20px; border-radius:28px; border:1.5px solid ${r.is_coming ? '#F5C518' : '#f0f0f0'}; box-shadow:0 10px 30px rgba(0,0,0,0.03); position:relative; overflow:hidden;">
             ${r.is_coming ? `<div style="position:absolute; top:0; left:0; background:#F5C518; color:#1a1a2e; padding:4px 12px; font-size:0.55rem; font-weight:900; border-bottom-right-radius:12px; animation: pulse 2s infinite;">EN CAMINO 🚗</div>` : ''}
             
             <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                <div style="flex:1;">
                   <div style="font-weight:900; color:var(--primary); font-size:1.1rem; line-height:1.2;">${r.resident_name}${expiryBadge}</div>
                   <div style="display:flex; gap:8px; margin-top:5px;">
                      <span style="font-size:0.6rem; background:#f0f2f5; padding:3px 8px; border-radius:8px; font-weight:800; color:#666;">TORRE ${r.tower || '-'}</span>
                      <span style="font-size:0.6rem; background:#f0f2f5; padding:3px 8px; border-radius:8px; font-weight:800; color:#666;">APTO ${r.apt || '-'}</span>
                   </div>
                </div>
                <div style="text-align:right;">
                   <div style="font-size:0.9rem; font-weight:900; color:#22c55e;">$${r.custom_price || 0}</div>
                   <div style="font-size:0.5rem; color:#bbb; font-weight:800; text-transform:uppercase;">MENSUAL</div>
                </div>
             </div>

             <div style="background:#fafafa; border-radius:16px; padding:12px; margin-bottom:15px; border:1px solid #f0f0f0;">
                <div style="font-size:0.5rem; color:#999; font-weight:800; text-transform:uppercase; margin-bottom:4px;">Vehículos Registrados</div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                   ${r.plate.split(',').map(p => `<span style="background:#1a1a2e; color:var(--accent); font-size:0.7rem; font-weight:900; padding:4px 10px; border-radius:8px;">${p.trim()}</span>`).join('')}
                </div>
             </div>

             <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f0f0f0; pt:15px; margin-top:5px; padding-top:15px;">
                <div style="font-size:0.65rem; color:#999; font-weight:700;">
                   Vence: <span style="color:${new Date(r.expiry_date) > new Date() ? '#22c55e' : '#e63946'}; font-weight:900;">${new Date(r.expiry_date).toLocaleDateString()}</span>
                </div>
                <div style="display:flex; gap:10px;">
                   ${daysLeft <= 7 || daysLeft < 0 ? `
                   <button data-action="SEND_EXPIRY_ALERT" data-id="${r.id}" data-name="${r.resident_name}" data-phone="${r.phone}" data-days="${daysLeft}" data-amount="${r.custom_price || 0}" style="background:#f59e0b; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:white; font-size:1.1rem;" title="Enviar Alerta de Vencimiento">
                      🔔
                   </button>
                   ` : ''}
                   <button data-action="RESIDENT_PAYMENTS" data-id="${r.id}" data-name="${r.resident_name}" style="background:#f4f4f4; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#3b82f6;">
                      <div style="width:18px; height:18px;">${ICONS.FINANCE}</div>
                   </button>
                   <button data-action="EDIT_RESIDENT" data-id="${r.id}" style="background:#f4f4f4; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#666;">
                      <div style="width:18px; height:18px;">${ICONS.EDIT}</div>
                   </button>
                   <button data-action="GEN_CREDENTIAL" data-id="${r.id}" style="background:#f4f4f4; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#666;">
                      <div style="width:18px; height:18px;">${ICONS.CARD}</div>
                   </button>
                   <button data-action="SEND_RESIDENT_ACCESS" data-id="${r.id}" data-phone="${r.phone}" data-plate="${r.plate}" style="background:#22c55e; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:white; font-weight:900; font-size:1.1rem;">
                      W
                   </button>
                   <button data-action="DELETE_RESIDENT" data-id="${r.id}" style="background:#fff0f0; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#e63946;">
                      <div style="width:18px; height:18px;">${ICONS.TRASH}</div>
                   </button>
                </div>
             </div>
          </div>
        `}).join('')}
        ${!subs?.length ? '<div style="text-align:center; padding:100px 20px; color:#ccc; font-weight:900; font-size:0.8rem;">NO HAY RESIDENTES REGISTRADOS</div>' : ''}
      </div>
    </div>`
  }

  const renderAbonos = async (state) => {
    const { data: subs } = await supabase.from('subscriptions').select('*').eq('building_id', state.buildingId).order('resident_name');
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Calculate total abonos today from movements
    const abonosToday = (state.movements || []).filter(m => m.type === 'MENSUALIDAD' && m.timestamp.startsWith(today)).reduce((a,b)=>a+(b.amount||0), 0);
    
    return `
    <div style="padding:20px; padding-bottom:120px; background:#f8f9fa;">
      <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">REGISTRO DE ABONOS</h2>
      
      <!-- ABONO STATS -->
      <div style="background:#1a1a2e; padding:25px; border-radius:28px; color:white; margin-bottom:25px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 15px 35px rgba(26,26,46,0.2);">
         <div>
            <div style="font-size:0.6rem; font-weight:800; color:var(--accent); text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">COBRADO HOY (ABONOS)</div>
            <div style="font-size:1.8rem; font-weight:900;">$${abonosToday.toFixed(2)}</div>
         </div>
         <div style="background:rgba(255,255,255,0.1); width:50px; height:50px; border-radius:15px; display:flex; align-items:center; justify-content:center;">
            <div style="width:24px; height:24px; color:var(--accent);">${ICONS.FINANCE}</div>
         </div>
      </div>

      <div style="background:white; padding:20px; border-radius:24px; margin-bottom:25px; border:1px solid #eee;">
         <div style="font-size:0.7rem; font-weight:800; color:#999; margin-bottom:15px; text-transform:uppercase;">BUSCAR RESIDENTE</div>
         <input type="text" id="abono-search" placeholder="Nombre o Placa..." onkeyup="filterAbonos(this.value)" style="width:100%; padding:15px; border-radius:15px; border:1.5px solid #f0f0f0; font-family:var(--font); font-weight:700; outline:none; background:#fafafa;">
      </div>

      <div id="abonos-list" style="display:grid; gap:15px;">
        ${(subs || []).map(r => {
          const exp = new Date(r.expiry_date);
          const isExpired = exp < now;
          const monthlyPrice = r.custom_price || 0;
          
          // Calculate amount paid for the "current period" 
          // We consider payments since the last month from now
          const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const paidThisMonth = (state.movements || []).filter(m => m.type === 'MENSUALIDAD' && m.plate.includes(r.plate.split(',')[0]) && m.timestamp >= periodStart).reduce((a,b)=>a+(b.amount||0), 0);
          
          const pending = Math.max(0, monthlyPrice - paidThisMonth);
          const hasDebt = isExpired || pending > 0;

          return `
          <div class="abono-card" data-search="${r.resident_name.toLowerCase()} ${r.plate.toLowerCase()}" style="background:white; padding:22px; border-radius:30px; border:1.5px solid ${hasDebt ? '#ffccd5' : '#f0f0f0'}; display:flex; flex-direction:column; gap:15px; box-shadow:0 12px 35px rgba(0,0,0,0.03); transition:transform 0.2s;">
             <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                   <div style="font-weight:900; color:var(--primary); font-size:1.1rem;">${r.resident_name}</div>
                   <div style="font-size:0.7rem; font-weight:700; color:#999; margin-top:2px;">🚗 ${r.plate}</div>
                </div>
                <div style="text-align:right;">
                   <div style="font-size:1rem; font-weight:950; color:var(--primary);">$${monthlyPrice}</div>
                   <div style="font-size:0.5rem; font-weight:800; color:#bbb; text-transform:uppercase;">MENSUALIDAD</div>
                </div>
             </div>

             <div style="background:#f8f9fa; border-radius:20px; padding:15px; display:grid; grid-template-columns:1fr 1fr; gap:10px; border:1px solid #f0f0f0;">
                <div>
                   <div style="font-size:0.55rem; font-weight:800; color:#999; text-transform:uppercase; margin-bottom:4px;">PAGADO MES</div>
                   <div style="font-size:0.9rem; font-weight:900; color:#22c55e;">$${paidThisMonth.toFixed(2)}</div>
                </div>
                <div style="text-align:right;">
                   <div style="font-size:0.55rem; font-weight:800; color:#999; text-transform:uppercase; margin-bottom:4px;">PENDIENTE</div>
                   <div style="font-size:0.9rem; font-weight:900; color:${pending > 0 ? '#e63946' : '#22c55e'};">${pending > 0 ? `-$${pending.toFixed(2)}` : 'SOLVENTE'}</div>
                </div>
             </div>

             <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.7rem; font-weight:800; color:${isExpired ? '#e63946' : '#666'};">
                   Vence: ${exp.toLocaleDateString()} ${isExpired ? '<span style="background:#fee2e2; color:#ef4444; padding:2px 6px; border-radius:6px; margin-left:5px;">VENCIDO</span>' : ''}
                </div>
                <div style="display:flex; gap:8px;">
                   <button data-action="SEND_DEBT_WS" data-id="${r.id}" data-name="${r.resident_name}" data-debt="${pending}" data-phone="${r.phone}" style="background:#22c55e; color:white; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer;">W</button>
                   <button data-action="SHOW_RESIDENT_HISTORY" data-id="${r.id}" data-name="${r.resident_name}" style="background:#f4f4f4; color:#666; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer;">H</button>
                   <button data-action="SHOW_ABONO_FORM" data-id="${r.id}" data-name="${r.resident_name}" data-price="${r.custom_price}" style="background:#1a1a2e; color:var(--accent); border:none; padding:0 15px; border-radius:12px; font-weight:900; font-size:0.65rem; cursor:pointer;">REGISTRAR</button>
                </div>
             </div>
          </div>
          `
        }).join('')}
      </div>

      <!-- RECENT ABONOS -->
      <div style="margin-top:40px;">
        <div style="font-size:0.7rem; font-weight:900; color:var(--primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">ÚLTIMOS ABONOS REGISTRADOS</div>
        <div style="background:white; border-radius:24px; border:1px solid #eee; overflow:hidden;">
          ${(state.movements || []).filter(m => m.type === 'MENSUALIDAD').slice(0, 5).map(m => `
            <div style="padding:15px 20px; border-bottom:1px solid #f9f9f9; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:0.85rem; font-weight:900; color:var(--primary);">${m.plate}</div>
                <div style="font-size:0.55rem; color:#bbb; font-weight:700;">${new Date(m.timestamp).toLocaleString()} · ${m.payMethod}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:0.9rem; font-weight:900; color:#22c55e;">+$${m.amount.toFixed(2)}</div>
                <div style="font-size:0.45rem; color:#999; font-weight:800; text-transform:uppercase;">Ref: ${m.reference || 'EFEC'}</div>
              </div>
            </div>
          `).join('') || '<div style="padding:40px; text-align:center; color:#ccc; font-weight:700; font-size:0.7rem;">No hay abonos recientes</div>'}
        </div>
      </div>

    </div>
    <script>
      window.filterAbonos = (val) => {
        const term = val.toLowerCase();
        document.querySelectorAll('.abono-card').forEach(c => {
          c.style.display = c.dataset.search.includes(term) ? 'flex' : 'none';
        });
      }
    </script>`
  }

  // Add new actions for abonos
  Object.assign(actions, {
    SHOW_ABONO_FORM: (btn) => {
      const { id, name, price } = btn.dataset;
      const l = document.getElementById('modal-layer');
      l.style.pointerEvents = 'auto';
      l.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(15px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;">
          <div style="background:white; border-radius:35px; width:100%; max-width:400px; padding:35px 25px; box-shadow:0 25px 50px rgba(0,0,0,0.3); animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <h2 style="font-weight:900; color:var(--primary); margin-bottom:5px; text-align:center;">REGISTRAR ABONO</h2>
            <div style="font-size:0.8rem; font-weight:700; color:#666; text-align:center; margin-bottom:25px;">${name}</div>
            
            <div style="margin-bottom:20px;">
              <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block; text-transform:uppercase;">Monto del Abono ($)</label>
              <input id="abono-amount" type="number" step="0.01" value="${price}" style="width:100%; box-sizing:border-box; border:2.5px solid #f0f0f0; border-radius:18px; padding:20px; font-size:1.5rem; font-weight:900; outline:none; font-family:var(--font); text-align:center;">
              <div id="abono-preview" style="font-size:0.6rem; font-weight:800; color:#22c55e; margin-top:8px; text-align:center;">Extenderá: 30 días aprox.</div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
              <div>
                <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block; text-transform:uppercase;">Fecha de Pago</label>
                <input id="abono-date" type="date" value="${new Date().toISOString().split('T')[0]}" style="width:100%; box-sizing:border-box; border:2.5px solid #f0f0f0; border-radius:15px; padding:12px; font-family:var(--font); font-weight:700; outline:none; background:#fafafa;">
              </div>
              <div>
                <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block; text-transform:uppercase;">Método</label>
                <select id="abono-method" style="width:100%; padding:12px; border-radius:15px; border:2.5px solid #f0f0f0; font-family:var(--font); font-weight:800; outline:none; appearance:none; background:#fafafa;">
                  <option value="EFECTIVO">💵 EFECTIVO</option>
                  <option value="PAGO_MOVIL">📱 PAGO MÓVIL</option>
                  <option value="TRANSFERENCIA">🏦 TRANSFERENCIA</option>
                </select>
              </div>
            </div>

            <div id="abono-bank-container" style="margin-bottom:20px; display:none;">
              <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block; text-transform:uppercase;">Banco Emisor</label>
              <select id="abono-bank" style="width:100%; padding:15px; border-radius:15px; border:2.5px solid #f0f0f0; font-family:var(--font); font-weight:800; outline:none; appearance:none; background:#fafafa;">
                <option value="">Seleccionar Banco...</option>
                <option value="BANESCO">Banesco</option>
                <option value="BDV">Banco de Venezuela</option>
                <option value="MERCANTIL">Mercantil</option>
                <option value="PROVINCIAL">Provincial</option>
                <option value="BNC">BNC</option>
                <option value="BANCAMIGA">Bancamiga</option>
                <option value="BANPLUS">Banplus</option>
                <option value="OTRO">Otro / Internacional</option>
              </select>
            </div>

            <div id="abono-ref-container" style="margin-bottom:25px; display:none;">
              <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block; text-transform:uppercase;">Referencia</label>
              <input id="abono-ref" type="text" placeholder="Ej: 4522" style="width:100%; box-sizing:border-box; border:2.5px solid #f0f0f0; border-radius:18px; padding:18px; font-size:1.1rem; font-weight:900; outline:none; font-family:var(--font);">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
               <button data-action="SUBMIT_ABONO" data-id="${id}" data-price="${price}" style="padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.8rem; text-transform:uppercase;">PROCESAR</button>
               <button data-action="CANCEL_MODAL" style="padding:20px; background:#f4f4f4; color:#666; border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.8rem; text-transform:uppercase;">CANCELAR</button>
            </div>
          </div>
        </div>
      `;
      
      const amountInput = l.querySelector('#abono-amount');
      const preview = l.querySelector('#abono-preview');
      const methodSelect = l.querySelector('#abono-method');
      const refContainer = l.querySelector('#abono-ref-container');

      const bankContainer = l.querySelector('#abono-bank-container');
      const bankSelect = l.querySelector('#abono-bank');

      amountInput.oninput = () => {
        const val = parseFloat(amountInput.value) || 0;
        const days = Math.round((val / price) * 30);
        preview.textContent = `Extenderá: ${days} días aprox.`;
      };

      methodSelect.onchange = () => {
        const isDigital = ['PAGO_MOVIL', 'TRANSFERENCIA'].includes(methodSelect.value);
        refContainer.style.display = isDigital ? 'block' : 'none';
        bankContainer.style.display = isDigital ? 'block' : 'none';
      };
    },
    SUBMIT_ABONO: async (btn) => {
      const id = btn.dataset.id;
      const price = parseFloat(btn.dataset.price) || 1;
      const amount = parseFloat(document.getElementById('abono-amount').value) || 0;
      const method = document.getElementById('abono-method').value;
      const ref = document.getElementById('abono-ref')?.value || '';
      const bank = document.getElementById('abono-bank')?.value || '';
      const date = document.getElementById('abono-date')?.value || new Date().toISOString().split('T')[0];
      
      if (amount <= 0) return alert('Monto inválido');
      
      btn.textContent = 'PROCESANDO...';
      btn.disabled = true;

      const { data: res } = await supabase.from('subscriptions').select('expiry_date, plate').eq('id', id).single();
      const currentExp = new Date(res.expiry_date);
      const startBase = new Date(Math.max(Date.now(), currentExp.getTime()));
      const daysToAdd = Math.round((amount / price) * 30);
      startBase.setDate(startBase.getDate() + daysToAdd);

      const state = getParkingState();
      
      await supabase.from('payments').insert({
        building_id: state.buildingId,
        subscription_id: id,
        amount: amount,
        method: method,
        reference: ref,
        status: 'CONFIRMED',
        payment_date: date,
        bank: bank
      });

      await supabase.from('subscriptions').update({
        expiry_date: startBase.toISOString()
      }).eq('id', id);

      // Log movement for financial tracking
      logMovement({
        type: 'MENSUALIDAD',
        plate: res.plate.split(',')[0].trim(),
        slot: 'ABONO',
        category: 'RESIDENTE',
        guardName: 'Administrador',
        payMethod: method,
        amount: amount,
        reference: ref,
        paymentStatus: 'PAGADO',
        metadata: { bank: bank, date: date }
      });

      logAudit(`Registró abono de $${amount} para residente ID ${id}`);
      pendingAction = null;
      cachedMetrics = null;
      render();
    }
  });

  const initPlateAdder = () => {
    const btn = document.getElementById('add-plate-field');
    const container = document.getElementById('new-sub-plates-container');
    if (btn && container) {
      btn.onclick = () => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '8px';
        div.innerHTML = `
          <input type="text" class="new-sub-plate-input" placeholder="Placa Vehículo ${container.children.length + 1}" style="flex:1; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700; text-transform:uppercase;">
          <button type="button" onclick="this.parentElement.remove()" style="background:rgba(230,57,70,0.2); color:#e63946; border:none; width:45px; border-radius:12px; cursor:pointer; font-weight:900;">✕</button>
        `;
        container.appendChild(div);
      };
    }
  }

  const render = async () => {
    const s = getParkingState()
    if (!elMain) renderShell(s)
    renderHeader(s)
    renderModal() // Update modal immediately so it closes without waiting
    await renderTabContent(s); 
    initPlateAdder()
    container.querySelectorAll('.admin-tab-btn').forEach(v => {
      const active = v.dataset.tab === activeTab
      v.style.color = active ? '#F5C518' : 'rgba(255,255,255,0.4)'
    })
  }

  setInterval(async () => {
    // Rendimiento: Eliminado renderTabContent() cada 4s que bloqueaba el main thread y hacía múltiples requests a DB.
    // Solo actualizamos el carrusel y otras utilidades que no pesen.
    const t = container.querySelector('#main-carousel'); let carouselIndex = 0
    if (t && t.children.length > 1) { carouselIndex = (window._cIdx || 0) + 1; window._cIdx = carouselIndex % t.children.length; t.style.transform = `translateX(-${window._cIdx * 100}%)` }
  }, 4000)

  // Realtime: escuchar nuevos pagos PENDING del guardia
  const realtimeChannel = supabase
    .channel('admin-payments-live')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'payments',
      filter: `status=eq.PENDING`
    }, (payload) => {
      const currentState = getParkingState()
      if (payload.new.building_id !== currentState.buildingId) return
      showToast('💰 Nuevo pago pendiente de aprobación', 'info')
      if (activeTab === 'HOME') render()
    })
    .subscribe()

  container._cleanup = () => {
    realtimeChannel.unsubscribe();
    unsubscribeFinanceRealtime();
  }

  loadHomeMetrics().then(async () => {
    await render()
    const state = getParkingState()
    setTimeout(() => checkExpiringSubscriptions(state.buildingId), 2000);
    if (state.plan === 'TRIAL' && state.trialDaysLeft !== undefined && state.trialDaysLeft <= 1) {
      setTimeout(() => showToast('⚠️ Tu prueba gratuita está por vencer. Evita la suspensión activando un plan hoy.', 'error'), 1500)
    }
  })
}
