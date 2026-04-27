import { getParkingState, saveParkingState, logAudit } from '../db.js'

export const initAdmin = (container) => {
  let activeTab = 'HOME'
  let reportFilter = 'HOY'
  let pendingAction = null // { type, name, lName, sLabel, guardId }
  let editingLevel = null // Level name being renamed
  let editingGuard = null // Guard ID being edited
  let openPaletteLevel = null // Level name with open palette

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
    PALETTE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.647-.494 2.091-1.243.221-.374.332-.811.391-1.242.16-.58.148-1.167.373-1.607.453-.88 1.447-1.408 2.51-1.408H20c1.1 0 2-.9 2-2 0-5.5-4.5-10-10-10z"/></svg>`
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
    ADD_GUARD: () => {
      const name = document.getElementById('guard-name').value.trim();
      const pin = document.getElementById('guard-pin').value.trim();
      const phone = document.getElementById('guard-phone').value.trim();
      const shift = document.getElementById('guard-shift').value;
      const photoEl = document.getElementById('guard-photo-preview');
      const photo = photoEl ? photoEl.src : null;
      if (!name || !pin) return alert('Nombre y PIN obligatorios');
      const state = getParkingState();
      state.personnel = state.personnel || [];
      
      if (editingGuard) {
        const idx = state.personnel.findIndex(p => p.id === editingGuard);
        if (idx !== -1) state.personnel[idx] = { ...state.personnel[idx], name, pin, phone, shift, photo };
        editingGuard = null;
      } else {
        state.personnel.push({ id: Date.now().toString(), name, pin, phone, shift, photo, status: 'Activo' });
      }
      
      logAudit(`Actualizó/Registró guardia: ${name}`);
      saveParkingState(state);
      render();
    },
    EDIT_GUARD: (btn) => {
      editingGuard = btn.dataset.id;
      render();
    },
    CANCEL_EDIT: () => {
      editingGuard = null;
      render();
    },
    SEND_WHATSAPP: (btn) => {
      const id = btn.dataset.id;
      const state = getParkingState();
      const g = state.personnel.find(p => p.id === id);
      if (!g || !g.phone) return alert('El guardia no tiene teléfono registrado');
      
      const url = window.location.origin;
      const msg = `Bienvenido a Sloty. Tu acceso de guardia para ${state.buildingName} es: ${url}\n\nCódigo Edificio: ${state.buildingCode}\nTu PIN: ${g.pin}`;
      window.open(`https://wa.me/${g.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
    },
    DELETE_GUARD: (btn) => {
      const gId = btn.dataset.id;
      const state = getParkingState();
      state.personnel = state.personnel.filter(p => p.id !== gId);
      saveParkingState(state);
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
    CANCEL_MODAL: () => { pendingAction = null; render() },
    TAB: (btn) => { activeTab = btn.dataset.tab; render() },
    SYNC: () => {
      render();
      const btn = container.querySelector('[data-action="SYNC"]');
      if(btn) {
        btn.style.transform = 'rotate(360deg)';
        btn.style.transition = 'transform 0.5s';
        setTimeout(() => { btn.style.transform = 'rotate(0deg)'; btn.style.transition = 'none' }, 500);
      }
    },
    SAVE_PROFILE: () => {
      const name = document.getElementById('edit-building-name').value.trim();
      const email = document.getElementById('edit-admin-email').value.trim();
      const phone = document.getElementById('edit-admin-phone').value.trim();
      if (!name) return alert('El nombre del edificio es obligatorio');
      const state = getParkingState();
      state.buildingName = name;
      state.adminInfo = { ...state.adminInfo, email, phone };
      saveParkingState(state);
      logAudit(`Actualizó perfil del edificio: ${name}`);
      alert('Perfil actualizado correctamente');
      activeTab = 'HOME';
      render();
    },
    LOGOUT: () => {
      localStorage.removeItem('sloty_session');
      location.reload();
    },
    FILTER_REPORTS: (btn) => { reportFilter = btn.dataset.filter; render() },
    SAVE_SETTINGS: () => {
      const freeHours = parseFloat(document.getElementById('set-freehours').value) || 0
      const baseRate = parseFloat(document.getElementById('set-baserate').value) || 0
      const extraPerHour = parseFloat(document.getElementById('set-extra').value) || 0
      const state = getParkingState()
      state.settings = { ...state.settings, freeHours, baseRate, extraPerHour }
      saveParkingState(state); alert('Tarifas guardadas'); render()
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
    VIEW_CLOSURE: (btn) => {
      const id = btn.dataset.id
      const state = getParkingState()
      const c = state.closures.find(x => x.id === id)
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
    }
  }

  window._admin_tab = (tab) => { activeTab = tab; render() }

  container.onclick = (e) => {
    const trigger = e.target.closest('[data-action]')
    if (trigger && actions[trigger.dataset.action]) actions[trigger.dataset.action](trigger)
  }

  const renderShell = (state) => {
    container.innerHTML = `
      <div id="admin-shell" style="background:#f8f9fa; min-height:100vh; font-family:var(--font); color:var(--primary);">
        <div id="admin-header"></div>
        <main id="admin-main" style="padding-top:10px;"></main>
        <div id="modal-layer"></div>
        
        <nav id="admin-nav" style="position:fixed; bottom:0; left:0; width:100%; background:#1a1a2e; padding:10px 15px calc(env(safe-area-inset-bottom, 8px) + 8px); display:flex; justify-content:space-around; align-items:center; z-index:1000; box-shadow:0 -5px 30px rgba(0,0,0,0.2);">
          <div class="admin-tab-btn" data-action="TAB" data-tab="HOME" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">INICIO</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="STRUCTURE" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">PISOS</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="FINANCE" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">CAJA</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="PERSONAL" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">EQUIPO</span>
          </div>
        </nav>
      </div>`
    elMain = container.querySelector('#admin-main')
  }

  const renderHeader = (state) => {
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
    } else if (activeTab === 'NOTIFICATIONS') {
      metricHtml = `<div class="header-status" style="background:rgba(230,57,70,0.15); color:#e63946;"><span>${unread} ALERTAS</span></div>`
    } else if (activeTab === 'HOME') {
      metricHtml = `<div class="header-status"><span>ADMIN</span></div>`
    } else {
      metricHtml = `<div class="header-status"><span>ACTIVO</span></div>`
    }

    const titles = { STRUCTURE:'Estructura', FINANCE:'Finanzas', PERSONAL:'Personal', REPORTES:'Reportes', SETTINGS:'Auditoría', NOTIFICATIONS:'Notificaciones', PROFILE:'Perfil' }
    const isHome = activeTab === 'HOME'

    header.innerHTML = `
      <div style="background:#1a1a2e; padding:calc(env(safe-area-inset-top, 0px) + 15px) 20px 20px; color:white; position:sticky; top:0; z-index:1100; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
        <!-- HEADER TOP: Logo & Context -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:${isHome ? '15px' : '0'};">
          <div style="display:flex; align-items:center; gap:12px;">
            ${!isHome ? `<div data-action="TAB" data-tab="HOME" style="cursor:pointer; color:rgba(255,255,255,0.4); width:24px; height:24px; display:flex; align-items:center; justify-content:center; margin-right:4px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;"><path d="m15 18-6-6 6-6"/></svg>
            </div>` : ''}
            <div data-action="TAB" data-tab="HOME" style="cursor:pointer; display:flex; flex-direction:column;">
              <img src="/icons/Sloty logo negro.png" style="height:60px; filter:brightness(0) invert(1); margin-bottom:-5px; object-fit:contain; object-position:left;" onerror="this.style.display='none'">
              <div style="display:flex; align-items:center; gap:8px; margin-left:2px;">
                <div style="font-size:0.5rem; font-weight:800; color:rgba(255,255,255,0.4); letter-spacing:2px; text-transform:uppercase;">${isHome ? 'PANEL PRINCIPAL' : titles[activeTab].toUpperCase()}</div>
                <div style="display:flex; align-items:center; gap:4px; background:rgba(34,197,94,0.1); padding:2px 6px; border-radius:6px; border:1px solid rgba(34,197,94,0.2);">
                   <div style="width:4px; height:4px; background:#22c55e; border-radius:50%; animation: pulse 2s infinite;"></div>
                   <div style="font-size:0.45rem; font-weight:900; color:#22c55e; letter-spacing:0.5px;">LIVE</div>
                </div>
                ${metricHtml}
              </div>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:16px;">
            <button data-action="SYNC" style="background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.4); width:28px; height:28px; display:flex; align-items:center; justify-content:center; padding:0; transition:transform 0.5s;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
            </button>
            <div data-action="TAB" data-tab="NOTIFICATIONS" style="position:relative; cursor:pointer; color:white; width:22px; height:22px;">
              ${ICONS.BELL}
              ${unread ? `<div style="position:absolute; top:-3px; right:-3px; width:8px; height:8px; background:#e63946; border-radius:50%; border:2px solid #1a1a2e;"></div>` : ''}
            </div>
            <button data-action="LOGOUT" style="background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.4); width:28px; height:28px; display:flex; align-items:center; justify-content:center; padding:0;">
              ${ICONS.LOGOUT}
            </button>
          </div>
        </div>

        ${isHome ? `
          <!-- BUILDING IDENTITY (ONLY HOME) -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:20px; margin-bottom:4px;">
            <div style="font-size:1.8rem; font-weight:900; line-height:1.1;">${state.buildingName.toLowerCase()}</div>
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

  const renderHome = (state) => {
    const total = state.stats?.totalSpots || 0
    const occ = state.stats?.occupied || 0
    const perc = total > 0 ? Math.round((occ / total) * 100) : 0
    const dash = 251.2 // 2 * PI * 40
    const offset = dash - (perc / 100) * dash
    
    const ads = state.ads?.filter(a => a.active) || []

    return `
      <div style="padding:20px; padding-bottom:100px; background:#f8f9fa;">

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
                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.2rem; font-weight:900; color:var(--primary);">
                  ${perc}%
                </div>
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
              <div style="font-size:1.4rem; font-weight:900; color:var(--primary);">2.4h</div>
              <div style="font-size:0.5rem; color:#bbb; font-weight:700;">Promedio</div>
           </div>
        </div>

        <!-- QUICK FEATURES GRID -->
        <div style="font-size:0.7rem; font-weight:900; color:var(--primary); margin-bottom:15px; text-transform:uppercase; letter-spacing:1px;">GESTIÓN RÁPIDA</div>
        <div class="feature-grid-clean">
           <div class="feature-item-clean" data-action="TAB" data-tab="STRUCTURE">
             ${ICONS.STRUCTURE} <span>Estructura</span>
           </div>
           <div class="feature-item-clean" data-action="TAB" data-tab="PERSONAL">
             ${ICONS.PERSONAL} <span>Personal</span>
           </div>
           <div class="feature-item-clean" data-action="TAB" data-tab="REPORTES">
             ${ICONS.HISTORY} <span>Reportes</span>
           </div>
           <div class="feature-item-clean" data-action="TAB" data-tab="FINANCE">
             ${ICONS.FINANCE} <span>Finanzas</span>
           </div>
           <div class="feature-item-clean" data-action="TAB" data-tab="SETTINGS">
             ${ICONS.SETTINGS}
             <span>Auditoría</span>
           </div>
        </div>

        <!-- ADS CAROUSEL -->
        ${ads.length ? `
          <div style="font-size:0.7rem; font-weight:900; color:var(--primary); margin-bottom:15px; text-transform:uppercase;">NOTICIAS & ANUNCIOS</div>
          <div class="carousel-container glass-card" style="border-radius:24px; padding:0; height:180px;">
            <div class="carousel-track" id="main-carousel">
              ${ads.map(ad => `<div class="ad-card" style="aspect-ratio:auto; height:180px;"><img src="${ad.imageUrl}" style="object-fit:cover;"></div>`).join('')}
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

  const renderFinanceSummary = (state) => {
    const now = new Date()
    const todayStart = new Date().setHours(0,0,0,0)
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

    const movs = state.movements || []
    
    // Revenue calculations
    const revToday = movs.filter(m => new Date(m.timestamp) >= todayStart).reduce((a, m) => a + (m.amount || 0), 0)
    const revWeek = movs.filter(m => new Date(m.timestamp) >= sevenDaysAgo).reduce((a, m) => a + (m.amount || 0), 0)
    const projection = revWeek > 0 ? (revWeek / 7) * 7 : 0 // Simplified projection

    // Inventory
    const successfulCollections = movs.filter(m => (m.amount || 0) > 0).length
    const vehiclesInDebt = state.stats?.dead || 0

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

    return `
      <div style="padding:20px; padding-bottom:120px; background:#f8f9fa;">
        <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">RENDIMIENTO FINANCIERO</h2>
        
        <!-- REVENUE CARDS -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:15px;">
           <div style="background:#1a1a2e; color:white; padding:25px 15px; border-radius:28px; text-align:center; box-shadow:0 10px 25px rgba(26,26,46,0.2);">
              <div style="font-size:1.8rem; font-weight:900;">$${revToday.toFixed(2)}</div>
              <div style="font-size:0.6rem; font-weight:700; color:var(--accent); text-transform:uppercase; margin-top:5px; opacity:0.8;">INGRESOS DE HOY</div>
           </div>
           <div style="background:#F5C518; color:var(--primary); padding:25px 15px; border-radius:28px; text-align:center; box-shadow:0 10px 25px rgba(245,197,24,0.2);">
              <div style="font-size:1.8rem; font-weight:900;">$${revWeek.toFixed(2)}</div>
              <div style="font-size:0.6rem; font-weight:700; text-transform:uppercase; margin-top:5px; opacity:0.8;">ESTA SEMANA</div>
           </div>
        </div>

        <!-- PROJECTION -->
        <div style="border:2px dashed #ddd; background:rgba(255,255,255,0.5); padding:15px; border-radius:20px; text-align:center; margin-bottom:30px;">
           <div style="font-size:0.6rem; font-weight:800; color:#999; text-transform:uppercase; margin-bottom:4px;">PROYECCIÓN ESTIMADA (7 DÍAS)</div>
           <div style="font-size:1.4rem; font-weight:900; color:#22c55e;">~$${projection.toFixed(2)}</div>
        </div>

        <!-- GLOBAL INVENTORY -->
        <div style="font-size:0.7rem; font-weight:900; color:var(--primary); margin-bottom:15px; text-transform:uppercase; letter-spacing:1px;">INVENTARIO GLOBAL</div>
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

        <!-- RECENT EXCEDENTS -->
        <div style="font-size:0.7rem; font-weight:900; color:var(--primary); margin-bottom:15px; text-transform:uppercase; letter-spacing:1px;">ÚLTIMOS EXCEDENTES (+8H) COBRADOS</div>
        <div style="background:white; border-radius:24px; padding:10px; border:1px solid #f0f0f0;">
           ${excedents.length ? excedents.map(m => `
             <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f9f9f9;">
                <div>
                   <div style="font-size:0.75rem; font-weight:900; color:var(--primary);">${m.plate || '---'}</div>
                   <div style="font-size:0.55rem; color:#bbb; font-weight:700;">${new Date(m.timestamp).toLocaleTimeString()}</div>
                </div>
                <div style="font-size:0.9rem; font-weight:900; color:#22c55e;">+$${m.amount.toFixed(2)}</div>
             </div>
           `).join('') : '<div style="text-align:center; padding:30px; color:#ccc; font-size:0.7rem; font-weight:700;">No hay pagos registrados aún</div>'}
        </div>
      </div>`
  }

  const renderAuditLog = (state) => `
    <div style="padding:20px; padding-bottom:120px;">
      <h3 style="font-weight:900; margin-bottom:20px;">BITÁCORA DE AUDITORÍA</h3>
      
      <!-- AJUSTES RÁPIDOS -->
      <div style="background:white; padding:20px; border-radius:32px; margin-bottom:30px; box-shadow:var(--shadow-sm);">
        <div style="font-size:0.65rem; font-weight:800; color:#999; margin-bottom:15px; text-transform:uppercase;">CONFIGURACIÓN TARIFAS</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
           <div><label style="font-size:0.55rem; font-weight:900; color:#999; display:block; margin-bottom:4px;">BASE $</label><input type="number" id="set-baserate" value="${state.settings.baseRate}" style="width:100%; padding:12px; border:1px solid #eee; border-radius:12px; font-weight:900; font-family:var(--font);"></div>
           <div><label style="font-size:0.55rem; font-weight:900; color:#999; display:block; margin-bottom:4px;">LIBRE (Hrs)</label><input type="number" id="set-freehours" value="${state.settings.freeHours}" style="width:100%; padding:12px; border:1px solid #eee; border-radius:12px; font-weight:900; font-family:var(--font);"></div>
        </div>
        <button data-action="SAVE_SETTINGS" style="width:100%; padding:14px; background:var(--accent); color:var(--primary); border:none; border-radius:14px; font-weight:900; cursor:pointer;">ACTUALIZAR</button>
      </div>

      <div style="display:grid; gap:8px;">
        ${(state.auditLog || []).map(l => `
          <div style="background:white; padding:12px 16px; border-radius:16px; border:1px solid #f0f0f0;">
             <div style="font-size:0.8rem; font-weight:900; color:var(--primary);">${l.action}</div>
             <div style="display:flex; justify-content:space-between; margin-top:4px;">
                <div style="font-size:0.6rem; font-weight:700; color:#bbb;">Usu: ${l.user}</div>
                <div style="font-size:0.6rem; color:#bbb;">${new Date(l.timestamp).toLocaleString()}</div>
             </div>
          </div>
        `).join('')}
        ${!(state.auditLog || []).length ? '<div style="text-align:center; padding:40px; color:#bbb;">No hay registros de auditoría</div>' : ''}
      </div>
    </div>`

  const renderReports = (state) => {
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
                  <div style="font-weight:900; color:${m.type==='INGRESO'?'#22c55e':'#3b82f6'}; font-size:0.6rem; letter-spacing:1px;">${m.type}</div>
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
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:25px;">
          <input type="text" id="guard-pin" value="${editG?.pin || ''}" placeholder="PIN (4)" maxlength="4" style="width:100%; box-sizing:border-box; min-width:0; padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; font-family:var(--font); font-weight:900; text-align:center; background:#fafafa; outline:none;">
          <select id="guard-shift" style="width:100%; box-sizing:border-box; min-width:0; padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; background:#fafafa; font-family:var(--font); font-weight:700; outline:none; appearance:none;">
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

      <div style="display:grid; gap:12px;">
        ${(state.personnel || []).map(p => {
          const gMovs = (state.movements || []).filter(m => m.guardName === p.name);
          const todayCount = gMovs.filter(m => new Date(m.timestamp) >= todayStart).length;
          const lastActive = gMovs.length > 0 ? new Date(gMovs[0].timestamp) : null;
          const activeNow = lastActive && (now - lastActive) < 12 * 60 * 60 * 1000;

          return `
            <div style="background:white; padding:15px 20px; border-radius:24px; display:flex; justify-content:space-between; align-items:center; border:1.5px solid #f8f8f8; box-shadow:0 10px 30px rgba(0,0,0,0.02);">
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
                     PIN: <span style="color:var(--primary);">${p.pin}</span> · 
                     <span style="color:#22c55e; font-weight:800;">${todayCount} movs hoy</span>
                  </div>
                </div>
              </div>
              
              <div style="display:flex; align-items:center; gap:10px;">
                 <button data-action="SEND_WHATSAPP" data-id="${p.id}" style="background:#22c55e; color:white; border:none; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:900; font-size:1rem; box-shadow:0 5px 15px rgba(34,197,94,0.2);">W</button>
                 <button data-action="EDIT_GUARD" data-id="${p.id}" style="background:#f4f4f4; color:#999; border:none; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.8rem;">✎</button>
                 <button data-action="DELETE_GUARD" data-id="${p.id}" style="color:#ffccd5; background:none; border:none; font-weight:900; cursor:pointer; font-size:0.65rem; text-transform:uppercase;">×</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>`;
  }

  const renderTabContent = (state) => {
    if (!elMain) return; let html = ''
    switch(activeTab) {
      case 'HOME': html = renderHome(state); break
      case 'PERSONAL': html = renderPersonnel(state); break
      case 'STRUCTURE': html = renderLevels(state); break
      case 'REPORTES': html = renderReports(state); break
      case 'FINANCE': html = renderFinanceSummary(state); break
      case 'SETTINGS': html = renderAuditLog(state); break
      case 'NOTIFICATIONS': html = renderNotifications(state); break
      case 'PROFILE': html = renderProfile(state); break
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
      <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">PERFIL DEL EDIFICIO</h2>
      
      <div style="background:white; padding:30px; border-radius:32px; box-shadow:0 15px 40px rgba(0,0,0,0.04); border:1.5px solid #f0f0f0;">
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
    const l = container.querySelector('#modal-layer'); if(!l) return; if(!pendingAction){ l.innerHTML=''; return }
    l.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;backdrop-filter:blur(10px);"><div style="background:white;padding:30px;border-radius:32px;width:100%;max-width:380px;text-align:center;"><h3 style="font-weight:900;margin-bottom:10px;">Confirmar eliminación</h3><p style="color:#666;font-size:0.85rem;margin-bottom:30px;">Esta acción es permanente y afectará la base de datos.</p><div style="display:flex;flex-direction:column;gap:10px;"><button data-action="CONFIRM_DELETE" style="background:#e63946;color:white;border:none;padding:18px;border-radius:18px;font-weight:900;">ELIMINAR AHORA</button><button data-action="CANCEL_MODAL" style="background:#f4f4f4;color:#333;border:none;padding:18px;border-radius:18px;font-weight:900;">VOLVER</button></div></div></div>`
  }

  const render = () => {
    const s = getParkingState()
    if (!elMain) renderShell(s)
    renderHeader(s)
    renderTabContent(s); renderModal()
    container.querySelectorAll('.admin-tab-btn').forEach(v => {
      const active = v.dataset.tab === activeTab
      v.style.color = active ? '#F5C518' : 'rgba(255,255,255,0.4)'
    })
  }

  setInterval(() => {
    const s = getParkingState()
    if (['HOME','FINANCE','REPORTES'].includes(activeTab)) renderTabContent(s)
    const t = container.querySelector('#main-carousel'); let carouselIndex = 0
    if (t && t.children.length > 1) { carouselIndex = (window._cIdx || 0) + 1; window._cIdx = carouselIndex % t.children.length; t.style.transform = `translateX(-${window._cIdx * 100}%)` }
  }, 4000)

  render()
}
