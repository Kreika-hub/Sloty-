import { getParkingState, saveParkingState, logAudit, getCleanPrefix, supabase, logMovement, syncDown, hasFeature, getBuildingPlan, showToast, getExchangeRate, getSyncQueueCount } from '../db.js'
import { escapeHTML } from '../utils/sanitize.js';
export const initAdmin = (container) => {
  console.log('[Sloty] Inicializando Panel Admin...')
  let activeTab = 'HOME'

  const handleSyncUpdated = (e) => {
    const el = document.getElementById('admin-sync-queue')
    if (el) {
      el.style.display = e.detail.count > 0 ? 'inline-block' : 'none'
      const countEl = document.getElementById('admin-sync-count')
      if (countEl) countEl.textContent = e.detail.count
    }
  }

  const handleConnectionStatus = (e) => {
    const el = document.getElementById('admin-conn-status')
    if (el) {
      el.style.background = e.detail.online ? 'rgba(34,197,94,0.15)' : 'rgba(245,197,24,0.15)'
      el.style.color = e.detail.online ? '#22c55e' : '#ce8a05'
      el.style.borderColor = e.detail.online ? 'rgba(34,197,94,0.3)' : 'rgba(245,197,24,0.3)'
      el.innerHTML = `● ${e.detail.online ? 'En Línea' : 'Offline'}`
    }
  }

  window.addEventListener('sloty-sync-updated', handleSyncUpdated)
  window.addEventListener('sloty-connection-status', handleConnectionStatus)

  const handleSyncDownloaded = () => {
    debouncedRender()
  }
  window.addEventListener('sloty-sync-downloaded', handleSyncDownloaded)
  window.addEventListener('sloty-subscriptions-updated', handleSyncDownloaded)

  let renderTimeout = null
  const debouncedRender = () => {
    if (renderTimeout) clearTimeout(renderTimeout)
    renderTimeout = setTimeout(() => {
      render()
    }, 150)
  }

  let reportFilter = 'HOY'
  let editingLevel = null // Level name being renamed
  let editingGuard = null // Guard ID being edited
  let openPaletteLevel = null // Level name with open palette
  let activeSettingsMenu = 'MAIN' // MAIN, TARIFFS, VISITORS, AUDIT

  initUserActions(actions, container, render);
  initFinanceActions(actions, container, render);
  
  window.handleAction = (type, payload) => {
    if (actions[type]) actions[type](payload)
  }




  const actions = {
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
      store.pendingAction = { type: 'LEVEL', name }
      render()
    },
    DELETE_SLOT: (btn) => {
      const lName = btn.dataset.levelname
      const sLabel = btn.dataset.label
      store.pendingAction = { type: 'SLOT', lName, sLabel }
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
      if (!name || isNaN(cap) || cap < 1) return showToast('Ingresa nombre y capacidad válida', 'error')
      const state = getParkingState()
      if (state.levels.find(l => l.name === name)) return showToast('Ya existe esa planta', 'error')
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
        store.pendingAction = {
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
    SEND_WHATSAPP_GUARD: async (btn) => {
      const id = btn.dataset.id;
      const state = getParkingState();
      const g = state.personnel.find(p => p.id === id);
      if (!g || !g.phone) {
        store.pendingAction = {
          type: 'CUSTOM_MODAL',
          title: '⚠️ FALTA TELÉFONO',
          content: `<p style="color:#666; font-weight:700;">Este guardia no tiene un número de WhatsApp registrado.</p>`
        };
        render();
        return;
      }
      
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span style="font-size:0.6rem;">Preparando...</span>';
      btn.disabled = true;

      try {
        const compressedPhoto = g.photo ? await compressBase64Image(g.photo) : null;
        if (compressedPhoto && compressedPhoto !== g.photo) {
          g.photo = compressedPhoto;
          saveParkingState(state);
        }

        const { error } = await supabase.from('personnel').upsert({
           id: g.id,
           building_id: state.buildingId,
           name: g.name,
           phone: g.phone,
           shift: g.shift,
           photo: compressedPhoto || null,
           pin: g.pin || null
        }, { onConflict: 'id' });

        if (error) throw error;

        const url = `${window.location.origin}/?setup_guard=${g.id}&bld=${state.buildingCode}`;
        const msg = `¡Bienvenido a Sloty, ${escapeHTML(g.name)}! 🛡️\n\nTu acceso para ${state.buildingName} (${state.buildingCode}) está listo.\n\nPor favor, ingresa al siguiente enlace para activar tu cuenta y crear tu PIN de acceso:\n\n${url}`;
        
        window.open(`https://wa.me/${g.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
      } catch (err) {
        console.error('Error sincronizando guardia:', err);
        store.pendingAction = {
          type: 'CUSTOM_MODAL',
          title: '❌ ERROR DE CONEXIÓN',
          content: `<p style="color:#666; font-weight:700;">No pudimos sincronizar el guardia. Verifica tu conexión a internet y vuelve a intentar.</p>`
        };
        render();
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    },
    DELETE_GUARD: (btn) => {
      const gId = btn.dataset.id;
      const state = getParkingState();
      state.personnel = state.personnel.filter(p => p.id !== gId);
      saveParkingState(state);
      render();
    },
    EDIT_GUARD: (btn) => {
      editingGuard = btn.dataset.id;
      activeTab = 'PERSONAL';
      render();
    },
    CANCEL_EDIT: () => {
      editingGuard = null;
      render();
    },
    CONFIRM_DELETE: () => {
      if (!store.pendingAction) return
      const state = getParkingState()
      if (store.pendingAction.type === 'LEVEL') {
        state.levels = state.levels.filter(l => l.name !== store.pendingAction.name)
      } else if (store.pendingAction.type === 'SLOT') {
        const level = state.levels.find(l => l.name === store.pendingAction.lName)
        if (level) level.slots = level.slots.filter(s => s.label !== store.pendingAction.sLabel)
      }
      saveParkingState(state); store.pendingAction = null; render()
    },
    CANCEL_MODAL: () => { store.pendingAction = null; render() },
    TAB: (btn) => {
      activeTab = btn.dataset.tab
      if (activeTab === 'SETTINGS') activeSettingsMenu = 'MAIN'
      // Colorear inmediatamente sin esperar render
      container.querySelectorAll('.admin-tab-btn').forEach(v => {
        const isTabActive = (v.dataset.tab === activeTab) || 
                            (activeTab === 'ABONOS' && v.dataset.tab === 'SUBS') ||
                            (activeTab === 'REPORTES' && v.dataset.tab === 'FINANCE')
        v.style.color = isTabActive ? '#F5C518' : 'rgba(255,255,255,0.4)'
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
    SAVE_RENTAL_CAP: () => {
       const val = document.getElementById('set-rentalslotscap')?.value;
       const v = val === '' || val === undefined ? null : parseFloat(val);
       const state = getParkingState();
       if (!state.settings) state.settings = {};
       state.settings = { ...state.settings, rentalSlotsCap: (v === null || isNaN(v)) ? null : v };
       saveParkingState(state);
       logAudit(`Actualizó cupo máximo de rentas: ${v != null ? v : 'Sin límite'}`);
       showToast('Cupo de puestos de renta actualizado', 'success');
       render();
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
      if (!newName) return showToast('El nombre del edificio es obligatorio', 'error');
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
      if (window.slotyLogout) window.slotyLogout()
      else {
        localStorage.clear()
        location.reload()
      }
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
      const inputMaxHours = document.getElementById('new-cat-maxhours')
      const label = inputLabel?.value?.trim()
      const color = inputColor?.value || '#3b82f6'
      const maxHoursVal = parseFloat(inputMaxHours?.value)
      const maxHours = isNaN(maxHoursVal) || maxHoursVal <= 0 ? null : maxHoursVal
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
        txt: '#ffffff',
        maxHours: maxHours
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
      if (!movs.length) return showToast('No hay movimientos', 'error')
      
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
      if(!error) showToast('Ajustes guardados correctamente', 'success'); else showToast('Error al guardar', 'error');
      render();
    },
    RESOLVE_INCIDENT_FORM: (btn) => {
      const id = btn.dataset.id;
      const guard = btn.dataset.guard;
      const l = document.getElementById('modal-layer');
      l.style.pointerEvents = 'auto';
      l.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(15px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;">
          <div style="background:white; border-radius:35px; width:100%; max-width:400px; padding:35px 25px; box-shadow:0 25px 50px rgba(0,0,0,0.3); animation: slideUp 0.3s ease;">
            <h2 style="font-weight:900; color:var(--primary); margin-bottom:5px; text-align:center; text-transform:uppercase;">RESPONDER INCIDENTE</h2>
            <div style="font-size:0.75rem; color:#999; text-align:center; margin-bottom:20px; font-weight:700;">Será enviado al guardia: ${guard}</div>
            <textarea id="admin-inc-response" rows="4" placeholder="Escribe tu respuesta aquí..." style="width:100%; box-sizing:border-box; border:1.5px solid #f0f0f0; border-radius:18px; padding:15px; font-family:var(--font); font-weight:700; margin-bottom:20px; outline:none; resize:none;"></textarea>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <button data-action="SUBMIT_INCIDENT_RESPONSE" data-id="${id}" data-guard="${guard}" style="padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.8rem; text-transform:uppercase;">ENVIAR</button>
              <button data-action="CANCEL_MODAL" style="padding:20px; background:#f4f4f4; color:#666; border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.8rem; text-transform:uppercase;">CANCELAR</button>
            </div>
          </div>
        </div>
      `;
    },
    SUBMIT_INCIDENT_RESPONSE: async (btn) => {
      const id = btn.dataset.id;
      const guard = btn.dataset.guard;
      const response = document.getElementById('admin-inc-response')?.value?.trim();
      
      if (!response) return showToast('Agrega una respuesta', 'error');

      btn.textContent = 'ENVIANDO...';
      btn.disabled = true;

      const { error } = await supabase
        .from('incidents')
        .update({ 
           resolved: true,
           admin_response: response,
           responded_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) { 
        console.error('Error', error);
        showToast('Error al guardar. Asegúrate de tener admin_response en tu BD.', 'error'); 
        actions.CANCEL_MODAL(); 
        return; 
      }

      await logAudit('RESOLVE_INCIDENT', { incident_id: id });
      showToast('Respuesta enviada al guardia', 'success');

      // Notificar al guardia si es posible  
      const state = getParkingState()
      supabase.functions.invoke('send-push', { 
        body: { 
          building_id: state.buildingId, 
          role: 'GUARD',
          identifier: guard, 
          title: '✅ Incidente Atendido', 
          body: response.slice(0, 60)
        } 
      });

      actions.CANCEL_MODAL();
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
    },
    GO_TO_SUBS: () => {
      activeTab = 'SUBS';
      document.getElementById('expiry-alert-banner')?.remove();
      render();
    },
    SEARCH_PLATE: async (btn) => {
      const plateInput = document.getElementById('trace-plate-input');
      const plate = plateInput?.value?.trim().toUpperCase();
      if (!plate) return;
      
      const container = document.getElementById('trace-results-container');
      if (!container) return;
      
      btn.textContent = '...';
      container.style.display = 'block';
      container.innerHTML = '<div style="color:#666; font-size:0.8rem; font-weight:700; text-align:center; padding:10px;">Buscando...</div>';
      
      const state = getParkingState();
      
      try {
        const { data: logs, error: logErr } = await supabase
          .from('access_logs')
          .select('id, type, created_at, guard_name, plate, is_resident, custom_price, visitors(resident_name, company, destination, tower, apt)')
          .eq('building_id', state.buildingId)
          .ilike('plate', `%${plate}%`)
          .order('created_at', { ascending: false })
          .limit(20);
          
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('building_id', state.buildingId)
          .ilike('plate', `%${plate}%`)
          .limit(1);

        const sub = subs && subs.length > 0 ? subs[0] : null;

        let resHtml = '';
        if (sub) {
          const daysLeft = Math.ceil((new Date(sub.expiry_date) - new Date()) / 86400000);
          resHtml += `
            <div style="background:linear-gradient(135deg, rgba(245,197,24,0.1) 0%, rgba(245,197,24,0.05) 100%); border:1px solid rgba(245,197,24,0.2); border-radius:16px; padding:15px; margin-bottom:15px;">
              <div style="font-size:0.6rem; color:#D97706; font-weight:900; margin-bottom:5px; text-transform:uppercase;">⭐ RESIDENTE ENCONTRADO</div>
              <div style="font-size:1.1rem; color:#1a1a2e; font-weight:900; margin-bottom:6px;">${sub.resident_name}</div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <span style="font-size:0.6rem; background:white; color:#666; padding:3px 8px; border-radius:6px; font-weight:800;">Apto: ${sub.apt||'-'}</span>
                <span style="font-size:0.6rem; background:white; color:#666; padding:3px 8px; border-radius:6px; font-weight:800;">Torre: ${sub.tower||'-'}</span>
                <span style="font-size:0.6rem; background:${daysLeft>=0?'#EAF3DE':'#FCEBEB'}; color:${daysLeft>=0?'#3B6D11':'#A32D2D'}; padding:3px 8px; border-radius:6px; font-weight:900;">${daysLeft>=0?'ACTIVO':'VENCIDO'}</span>
              </div>
            </div>`;
        }

        if (!logs || logs.length === 0) {
          resHtml += '<div style="color:#999; font-size:0.75rem; text-align:center; padding:10px;">No hay registros de acceso en la bitácora.</div>';
        } else {
          resHtml += '<div style="font-size:0.65rem; color:#bbb; font-weight:900; margin-bottom:10px; letter-spacing:1px;">TIMELINE DE ACCESOS</div>';
          resHtml += logs.map(l => {
            const visitorName = l.visitors?.resident_name || l.visitors?.company || 'Visitante';
            const dest = l.visitors ? `${l.visitors.tower||''} ${l.visitors.apt||''} ${l.visitors.destination||''}`.trim() : '';
            return `
              <div style="background:white; border-radius:12px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:flex-start; border:1px solid #f0f0f0;">
                <div>
                  <div style="font-weight:900; color:${l.type==='ENTRY'?'#22c55e':'#e63946'}; font-size:0.75rem;">
                    ${l.type==='ENTRY' ? 'ENTRADA' : 'SALIDA'}
                  </div>
                  <div style="font-size:0.65rem; color:#666; font-weight:700; margin-top:3px;">
                    ${new Date(l.created_at).toLocaleString('es-VE')}
                  </div>
                  <div style="font-size:0.65rem; color:#1a1a2e; font-weight:900; margin-top:4px;">
                    ${l.is_resident ? '⭐ Residente' : `${visitorName}`}
                  </div>
                  ${dest ? `<div style="font-size:0.55rem; color:#999; font-weight:700; margin-top:2px;">Destino: ${dest}</div>` : ''}
                </div>
                <div style="text-align:right;">
                  <div style="font-size:0.6rem; color:#999; font-weight:700; text-transform:uppercase;">Guardia</div>
                  <div style="font-size:0.7rem; font-weight:900; color:#1a1a2e;">${l.guard_name || 'Desconocido'}</div>
                  ${l.custom_price !== undefined && l.custom_price !== null ? `<div style="font-size:0.6rem; color:#22c55e; font-weight:900; margin-top:2px;">Cobro: $${l.custom_price}</div>` : ''}
                </div>
              </div>
            `;
          }).join('');
        }
        container.innerHTML = resHtml;
      } catch (e) {
        console.error(e);
        container.innerHTML = '<div style="color:#e63946; font-size:0.8rem; font-weight:700; text-align:center; padding:10px;">Error al buscar. Verifica la conexión.</div>';
      } finally {
        btn.textContent = 'BUSCAR';
      }
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
    } else if (activeTab === 'SUBS' || activeTab === 'ABONOS') {
      // Fetch count in background to not block render
      metricHtml = `<div class="header-status" id="sub-count-badge" style="background:rgba(59,130,246,0.15); color:#3b82f6;"><span>... RESIDENTES</span></div>`
      supabase.from('subscriptions').select('count', { count: 'exact' }).eq('building_id', state.buildingId)
        .then(({count}) => {
          const badge = container.querySelector('#sub-count-badge')
          if(badge) badge.innerHTML = `<span>${count || 0} RESIDENTES</span>`
        })
    } else if (activeTab === 'HOME') {
      metricHtml = ``
    } else {
      metricHtml = ``
    }

    const titles = { STRUCTURE:'Pisos', SUBS:'Mensuales', FINANCE:'Caja', PERSONAL:'Personal', REPORTES:'Reportes', SETTINGS:'Auditoría', NOTIFICATIONS:'Notificaciones', PROFILE:'Perfil', ABONOS:'Abonos' }
    const isHome = activeTab === 'HOME'

    const sState = getParkingState()
    // BYPASS DESARROLLO: Ocultar banner de prueba gratuita
    const trialBanner = '';

    header.innerHTML = `
      ${trialBanner}
      <div style="background:#1a1a2e; padding:calc(env(safe-area-inset-top, 0px) + 15px) 20px 20px; color:white; position:sticky; top:0; z-index:1100; box-shadow:0 10px 30px rgba(0,0,0,0.2); box-sizing:border-box; width:100%;">
        <!-- HEADER STRUCTURE COMPACT -->
        <div style="display:flex; flex-direction:column; gap:12px;">
          <!-- TOP ROW: LOGO + ACTIONS -->
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <!-- LOGO AREA (LEFT) -->
            <div data-action="TAB" data-tab="HOME" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
              ${!isHome ? `<div style="color:white; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px; transform:translateX(-4px);"><path d="m15 18-6-6 6-6"/></svg>
              </div>` : ''}
              <div style="display:flex; align-items:center; gap:8px;">
                <img src="/icons/Sloty logo negro.png" style="height:53px; filter:brightness(0) invert(1); object-fit:contain;" onerror="this.style.display='none'">
                ${sState.logo_url ? `<img src="${sState.logo_url}" style="height:35px; width:auto; max-width:60px; border-radius:6px; object-fit:contain;">` : ''}
              </div>
            </div>

            <!-- RIGHT ACTIONS -->
            <div style="display:flex; align-items:center; gap:12px;">
              <span id="admin-conn-status" style="font-size:0.65rem; font-weight:900; padding:2px 8px; border-radius:6px; background:${navigator.onLine ? 'rgba(34,197,94,0.15)' : 'rgba(245,197,24,0.15)'}; color:${navigator.onLine ? '#22c55e' : '#ce8a05'}; border:1px solid ${navigator.onLine ? 'rgba(34,197,94,0.3)' : 'rgba(245,197,24,0.3)'};">
                 ● ${navigator.onLine ? 'En Línea' : 'Offline'}
              </span>
              <span id="admin-sync-queue" style="font-size:0.65rem; font-weight:900; padding:2px 8px; border-radius:6px; background:rgba(255,255,255,0.06); color:#ce8a05; border:1px solid rgba(255,255,255,0.15); display:${getSyncQueueCount() > 0 ? 'inline-block' : 'none'};">
                 ⏳ Carga: <b id="admin-sync-count">${getSyncQueueCount()}</b>
              </span>
              <button data-action="SYNC" style="background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.6); padding:0; display:flex; align-items:center; justify-content:center; transition:transform 0.5s;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
              </button>
              <button data-action="TAB" data-tab="NOTIFICATIONS" style="position:relative; cursor:pointer; color:${unread ? '#F5C518' : 'white'}; background:none; border:none; padding:0; display:flex; align-items:center; justify-content:center; width:24px; height:24px;">
                ${ICONS.BELL}
                ${unread ? `<div style="position:absolute; top:-2px; right:-2px; width:8px; height:8px; background:#e63946; border-radius:50%; border:2px solid #1a1a2e;"></div>` : ''}
              </button>
              <button data-action="LOGOUT" style="background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.6); padding:0; display:flex; align-items:center; justify-content:center; width:24px; height:24px;">
                ${ICONS.LOGOUT}
              </button>
            </div>
          </div>

          <!-- BOTTOM ROW: TITLE AND TAGS -->
          <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
              <div style="font-size:0.75rem; font-weight:900; color:var(--accent); letter-spacing:1px; text-transform:uppercase;">
                ${isHome ? 'PANEL PRINCIPAL' : titles[activeTab].toUpperCase()}
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                ${(() => {
                  const plan = getParkingState().plan || 'TRIAL'
                  const planColors = { TRIAL:'#888', BRONCE:'#cd7f32', PLATA:'#aaa', ORO:'#F5C518' }
                  let upgradeBtn = ''
                  if (plan !== 'ORO') {
                    upgradeBtn = `<button data-action="SHOW_PLANS" class="gold-btn" style="padding:4px 10px; flex-shrink:0;"><span>🚀 UPGRADE</span></button>`
                  }
                  return `
                    <div style="font-size:0.55rem; font-weight:900; color:${planColors[plan] || '#888'}; letter-spacing:0.5px; background:rgba(255,255,255,0.1); padding:4px 10px; border-radius:8px; flex-shrink:0;">PLAN ${plan}</div>
                    ${upgradeBtn}
                  `
                })()}
              </div>
            </div>
            ${metricHtml ? `<div style="align-self:flex-end;">${metricHtml}</div>` : ''}
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
             <div style="display:grid; grid-template-columns:1fr; gap:10px; margin-bottom:15px; box-sizing:border-box; width:100%;">
                 <input type="text" id="new-tariff-name" placeholder="Nombre (ej. Excedente Nocturno)" style="box-sizing:border-box; width:100%; padding:14px; border:2px solid #eee; border-radius:14px; font-weight:700; outline:none;">
                 <div style="display:grid; grid-template-columns:1fr 1fr auto; gap:10px; box-sizing:border-box; width:100%;">
                     <input type="number" id="new-tariff-free" placeholder="Horas Gratis" style="box-sizing:border-box; width:100%; min-width:0; padding:14px; border:2px solid #eee; border-radius:14px; font-weight:700; outline:none;">
                     <input type="number" step="0.5" id="new-tariff-rate" placeholder="Monto $" style="box-sizing:border-box; width:100%; min-width:0; padding:14px; border:2px solid #eee; border-radius:14px; font-weight:700; outline:none;">
                     <button data-action="ADD_TARIFF" style="background:#22c55e; color:white; border:none; padding:0 22px; border-radius:14px; font-weight:900; cursor:pointer; font-size:1.3rem; box-sizing:border-box;">+</button>
                 </div>
             </div>
             
             <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
             
             <div style="font-size:0.7rem; font-weight:900; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">CUPO DE PUESTOS DE RENTA (MENSUALIDADES)</div>
             <div style="display:flex; gap:10px; margin-bottom:20px; box-sizing:border-box; width:100%;">
                <input type="number" id="set-rentalslotscap" value="${state.settings?.rentalSlotsCap != null ? state.settings.rentalSlotsCap : ''}" placeholder="Sin límite (ej. 10)" style="flex:1; padding:14px; border:2px solid #eee; border-radius:14px; font-weight:700; outline:none;">
                <button data-action="SAVE_RENTAL_CAP" style="background:#22c55e; color:white; border:none; padding:0 22px; border-radius:14px; font-weight:900; cursor:pointer;">GUARDAR</button>
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
             <div style="display:grid; grid-template-columns:1fr auto; gap:10px; box-sizing:border-box; width:100%;">
               <input type="text" id="new-field-label" placeholder="Ej: Apartamento" style="box-sizing:border-box; width:100%; min-width:0; padding:14px; border:1.5px solid #eee; border-radius:14px; font-weight:700; font-family:var(--font); outline:none;">
               <button data-action="ADD_CUSTOM_FIELD" style="background:#22c55e; color:white; border:none; padding:0 22px; border-radius:14px; font-weight:900; cursor:pointer; font-size:1.3rem; box-sizing:border-box;">+</button>
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
             <div style="display:grid; grid-template-columns:1fr 80px auto auto; gap:10px; align-items:center; box-sizing:border-box; width:100%;">
               <input type="text" id="new-cat-label" placeholder="Ej: Delivery" style="box-sizing:border-box; width:100%; min-width:0; padding:14px; border:1.5px solid #eee; border-radius:14px; font-weight:700; font-family:var(--font); outline:none;">
               <input type="number" step="0.1" min="0" id="new-cat-maxhours" placeholder="Horas" style="box-sizing:border-box; width:100%; min-width:0; padding:14px; border:1.5px solid #eee; border-radius:14px; font-weight:700; font-family:var(--font); outline:none;" title="Horas límite (p. ej. 0.5 para 30min)">
               <input type="color" id="new-cat-color" value="#3b82f6" style="box-sizing:border-box; width:48px; height:48px; border:none; border-radius:12px; cursor:pointer; padding:2px;">
               <button data-action="ADD_CATEGORY" style="background:#3b82f6; color:white; border:none; padding:0 20px; border-radius:14px; font-weight:900; cursor:pointer; height:48px; font-size:1.3rem; box-sizing:border-box;">+</button>
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
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; margin-bottom:20px;">
          <h3 style="font-weight:900; margin:0;">HISTORIAL Y REPORTES</h3>
          <div style="display:flex; gap:8px;">
            <button data-action="DOWNLOAD_REPORT" data-type="CSV" style="background:#f4f4f4; color:#666; border:none; padding:8px 12px; border-radius:10px; font-weight:900; font-size:0.6rem; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.05); flex-shrink:0;">↓ CSV</button>
            <button data-action="DOWNLOAD_REPORT" data-type="PDF" style="background:#1a1a2e; color:#F5C518; border:none; padding:8px 12px; border-radius:10px; font-weight:900; font-size:0.65rem; cursor:pointer; box-shadow:0 4px 10px rgba(26,26,46,0.2); flex-shrink:0; text-align:center;">↓ REPORTE PDF</button>
          </div>
        </div>

        <!-- BUSCADOR TRAZABILIDAD -->
        <div style="background:#fafafa; border:1px solid #eee; padding:20px; border-radius:24px; margin-bottom:20px; box-sizing:border-box; width:100%; overflow:hidden;">
           <div style="color:#1a1a2e; font-weight:900; font-size:0.75rem; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">🔎 TRAZABILIDAD DE VEHÍCULOS</div>
           <div style="display:flex; gap:10px; flex-wrap:wrap;">
               <input type="text" id="trace-plate-input" placeholder="Buscar por placa..." style="flex:1; min-width:140px; box-sizing:border-box; padding:14px; border-radius:14px; border:1.5px solid #eee; font-weight:900; text-transform:uppercase; outline:none; font-family:var(--font); background:white;">
               <button data-action="SEARCH_PLATE" style="background:#22c55e; color:white; border:none; padding:14px 20px; border-radius:14px; font-weight:900; cursor:pointer; flex-shrink:0;">BUSCAR</button>
           </div>
           <div id="trace-results-container" style="margin-top:15px; display:none;"></div>
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
                  <div style="font-size:1rem; font-weight:900; color:#1a1a2e;">${escapeHTML(m.plate) || '---'}</div>
                  <div style="font-size:0.7rem; font-weight:700; color:#999; margin-top:2px;">${new Date(m.timestamp).toLocaleString()}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-weight:900; color:${(m.type==='ENTRY'||m.type==='INGRESO')?'#22c55e':'#3b82f6'}; font-size:0.6rem; letter-spacing:1px;">${m.type}</div>
                  <div style="font-size:0.8rem; font-weight:900; color:#1a1a2e; margin-top:2px;">${escapeHTML(m.slot) || '--'}</div>
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
                    <button data-action="RESOLVE_INCIDENT_FORM" data-id="${inc.id}" data-guard="${inc.guard_name}"
                      style="background:#EAF3DE; color:#3B6D11; border:none;
                             border-radius:50px; padding:3px 10px; font-size:0.65rem;
                             font-weight:900; cursor:pointer;">
                      ✎ RESPONDER
                    </button>` : `
                    <span style="font-size:0.65rem; color:#999; font-weight:700;">✓ Resuelto</span>`}
                </div>
                <div style="font-size:0.65rem; color:#999; font-weight:700;">
                  ${new Date(inc.created_at).toLocaleString('es-VE', { dateStyle:'short', timeStyle:'short' })}
                </div>
              </div>
              <div style="font-size:0.8rem; font-weight:700; color:#1a1a2e; margin-bottom:4px;">
                ${escapeHTML(inc.description)}
              </div>
              ${inc.admin_response ? `
                <div style="background:#f8f9fa; border-left:3px solid #22c55e; padding:10px; margin-top:10px; border-radius:8px;">
                  <div style="font-size:0.6rem; font-weight:900; color:#22c55e; margin-bottom:4px;">TU RESPUESTA</div>
                  <div style="font-size:0.8rem; font-weight:700; color:#666;">${escapeHTML(inc.admin_response)}</div>
                  <div style="font-size:0.5rem; color:#bbb; font-weight:700; margin-top:4px;">Enviado: ${new Date(inc.responded_at || inc.created_at).toLocaleString('es-VE')}</div>
                </div>
              ` : ''}
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
          <div id="photo-dropzone" style="width:120px; height:120px; flex-shrink:0; border-radius:50%; background:#f9f9f9; border:2.5px dashed #ddd; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden; position:relative; transition:all 0.3s ease;">
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
                <div style="width:60px; height:60px; border-radius:50%; background:#f0f0f0; overflow:hidden; border:2px solid #fff; box-shadow:0 5px 15px rgba(0,0,0,0.05); position:relative; flex-shrink:0;">
                  ${p.photo ? `<img src="${p.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#ccc; font-weight:900; background:#eee;">${p.name.charAt(0)}</div>`}
                  ${activeNow ? `<div style="position:absolute; bottom:4px; right:4px; width:12px; height:12px; background:#22c55e; border:2px solid white; border-radius:50%; box-shadow:0 0 10px rgba(34,197,94,0.5);"></div>` : ''}
                </div>
                <div>
                  <div style="display:flex; align-items:center; gap:8px;">
                     <div style="font-weight:900; color:var(--primary); font-size:1rem;">${escapeHTML(p.name)}</div>
                     <div style="font-size:0.5rem; background:#f0f0f0; padding:2px 8px; border-radius:10px; font-weight:800; color:#999; text-transform:uppercase;">${escapeHTML(p.shift)}</div>
                  </div>
                  <div style="font-size:0.7rem; color:#bbb; font-weight:700; margin-top:2px;">
                     ${p.pin ? `PIN: <span style="color:var(--primary); letter-spacing:2px;">●●●●</span>` : '<span style="color:#e63946;">PENDIENTE ACTIVACIÓN</span>'} · 
                     <span style="color:#22c55e; font-weight:800;">${todayCount} movs hoy</span>
                  </div>
                </div>
              </div>
              
              <div style="display:flex; align-items:center; gap:10px;">
                 <button data-action="SEND_WHATSAPP_GUARD" data-id="${p.id}" style="background:none; border:none; padding:0; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer;"><img src="/icons/whatsapp-svgrepo-com.svg" style="width:30px; height:30px; filter:drop-shadow(0 2px 4px rgba(34,197,94,0.3));"/></button>
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
    
    const renderingTab = activeTab; // Snap activeTab locally

    // Non-blocking skeleton loading indicator if switching tabs
    if (elMain.dataset.lastTab !== renderingTab) {
       const skeleton = SKELETONS[renderingTab] || SKELETONS.DEFAULT;
       elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${SKELETONS.pulse}${skeleton}</div>`;
    }
    elMain.dataset.lastTab = renderingTab;

    switch(renderingTab) {
      case 'HOME': {
        if (!store.cachedMetrics || !window._cachedAds) {
          if (!store.metricsLoading) {
            Promise.all([
              loadHomeMetrics(),
              supabase.from('ads').select('*').or(`building_id.is.null,building_id.eq.${state.buildingId}`).order('timestamp', { ascending: false })
            ]).then(([_, adsRes]) => {
              window._cachedAds = adsRes?.data || [];
              if (activeTab === 'HOME') render();
            });
          }
          const skeleton = SKELETONS.HOME;
          elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${SKELETONS.pulse}${skeleton}</div>`;
          return;
        }
        html = await renderHome(state, window._cachedAds); 
        break;
      }
      case 'SUBS': {
        if (!store.cachedSubs) {
          getSubsCached(state.buildingId).then(() => {
            if (activeTab === 'SUBS' || activeTab === 'ABONOS') render();
          });
          const skeleton = SKELETONS.SUBS;
          elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${SKELETONS.pulse}${skeleton}</div>`;
          return;
        }
        html = await renderMonthlySystem(state); 
        break;
      }
      case 'ABONOS': {
        if (!store.cachedSubs) {
          getSubsCached(state.buildingId).then(() => {
            if (activeTab === 'SUBS' || activeTab === 'ABONOS') render();
          });
          const skeleton = SKELETONS.DEFAULT;
          elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${SKELETONS.pulse}${skeleton}</div>`;
          return;
        }
        html = await renderAbonos(state); 
        break;
      }
      case 'FINANCE': {
        if (!store.cachedFinance || (Date.now() - store.cachedFinanceAt >= store.FINANCE_TTL)) {
          const nowObj = new Date();
          const monthStart = new Date(nowObj.getFullYear(), nowObj.getMonth(), 1).toISOString();
          const todayStr = new Date().toISOString().split('T')[0];
          Promise.all([
            supabase.from('payments').select('amount, method, payment_date, status').eq('building_id', state.buildingId).eq('status', 'CONFIRMED').gte('payment_date', monthStart),
            supabase.from('payments').select('amount, method').eq('building_id', state.buildingId).eq('status', 'CONFIRMED').gte('payment_date', todayStr),
            supabase.from('guard_shifts').select('id, guard_name, started_at, ended_at, total_cash, total_mobile, total_bs, entries, exits, absences').eq('building_id', state.buildingId).order('ended_at', { ascending: false }).limit(200)
          ]).then(([subsPayRes, todayPayRes, shiftsRes]) => {
            store.cachedFinance = {
              subsPays: subsPayRes?.data || [],
              todayPays: todayPayRes?.data || [],
              guardShifts: shiftsRes?.data || []
            };
            store.cachedFinanceAt = Date.now();
            if (activeTab === 'FINANCE') render();
          });

          if (!store.cachedFinance) {
            const skeleton = SKELETONS.FINANCE;
            elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${SKELETONS.pulse}${skeleton}</div>`;
            return;
          }
        }
        html = await renderFinanceSummary(state); 
        break;
      }
      case 'PERSONAL': html = renderPersonnel(state); break
      case 'STRUCTURE': html = renderLevels(state); break
      case 'REPORTES': html = await renderReports(state); break
      case 'SETTINGS': html = renderSettings(state); break
      case 'NOTIFICATIONS': html = renderNotifications(state); break
      case 'PROFILE': html = renderProfile(state); break
    }
    
    // Prevent race condition if user changed tab while fetching
    if (activeTab !== renderingTab) return;

    elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${html}</div>`; 
    if(renderingTab==='PERSONAL') setupPersonnelHooks()
    if(renderingTab==='ABONOS') setupAbonosHooks()

  }

  const setupPersonnelHooks = () => {
    const dz = elMain?.querySelector('#photo-dropzone'), i = elMain?.querySelector('#guard-photo-input'), p = elMain?.querySelector('#guard-photo-preview'), s = elMain?.querySelector('#photo-placeholder')
    if (dz && i) {
      dz.onclick = () => i.click();
      i.onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const r = new FileReader()
        r.onload = (re) => {
          const img = new Image()
          img.onload = () => {
             const canvas = document.createElement('canvas');
             const max = 200;
             let w = img.width; let h = img.height;
             if (w > h) { if (w > max) { h *= max / w; w = max; } }
             else { if (h > max) { w *= max / h; h = max; } }
             canvas.width = w; canvas.height = h;
             const ctx = canvas.getContext('2d');
             ctx.drawImage(img, 0, 0, w, h);
             p.src = canvas.toDataURL('image/jpeg', 0.6);
             p.style.display = 'block';
             s.style.display = 'none';
          };
          img.src = re.target.result;
        }
        r.readAsDataURL(file)
      }
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
      const active = (v.dataset.tab === activeTab) || 
                     (activeTab === 'ABONOS' && v.dataset.tab === 'SUBS') ||
                     (activeTab === 'REPORTES' && v.dataset.tab === 'FINANCE')
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
      if (activeTab === 'HOME') debouncedRender()
    })
    .subscribe()

  container._cleanup = () => {
    realtimeChannel.unsubscribe();
    unsubscribeFinanceRealtime();
    window.removeEventListener('sloty-sync-updated', handleSyncUpdated);
    window.removeEventListener('sloty-connection-status', handleConnectionStatus);
  }

  render();

  Promise.all([
    loadHomeMetrics(),
    getExchangeRate().catch(e => console.warn('Failed to load BCV rate on start:', e))
  ]).then(async ([_, bcv]) => {
    store.currentBcv = bcv || store.currentBcv;
    await render();
    const state = getParkingState();
    setTimeout(() => checkExpiringSubscriptions(state.buildingId), 2000);
  });
}
