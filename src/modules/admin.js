import { getParkingState, saveParkingState, logAudit } from '../db.js'

export const initAdmin = (container) => {
  let activeTab = 'HOME'
  let reportFilter = 'HOY'
  let pendingAction = null // { type, name, lName, sLabel, guardId }
  let editingLevel = null // Level name being renamed

  const ICONS = {
    HOME: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    HISTORY: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    FINANCE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    STRUCTURE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    PERSONAL: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    LOGOUT: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`
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
      state.personnel.push({ id: Date.now().toString(), name, pin, phone, shift, photo });
      logAudit(`Registró guardia: ${name}`);
      saveParkingState(state);
      render();
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
    LOGOUT: () => { if (confirm('¿Cerrar sesión?')) { localStorage.removeItem('sloty_session'); location.reload() } },
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
      const headers = ['ID','FECHA','TIPO','PLACA','PUESTO', ...customHeaders, 'MÉTODO PAGO', 'COBRO']
      
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
          m.amount || 0
        ].join(',')
      })
      
      const csvContent = "\ufeff" + [headers.join(','), ...rows].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `reporte-sloty-${new Date().toISOString().split('T')[0]}.csv`)
      link.click()
    }
  }

  window._admin_tab = (tab) => { activeTab = tab; render() }

  container.onclick = (e) => {
    const trigger = e.target.closest('[data-action]')
    if (trigger && actions[trigger.dataset.action]) actions[trigger.dataset.action](trigger)
  }

  const renderShell = (state) => {
    container.innerHTML = `
      <div id="admin-shell" style="background:#f8f9fa; min-height:100vh;">
        <div id="admin-content-area"></div>
        
        <!-- FLOATING PILL NAVIGATION -->
        <div class="floating-nav-container">
           <div class="floating-nav-item ${activeTab==='HOME'?'active':''}" onclick="window._admin_tab('HOME')">
             ${ICONS.HOME}
           </div>
           <div class="floating-nav-item ${activeTab==='REPORTES'?'active':''}" onclick="window._admin_tab('REPORTES')">
             ${ICONS.HISTORY}
           </div>
           <div class="floating-nav-item ${activeTab==='FINANCE'?'active':''}" onclick="window._admin_tab('FINANCE')">
             ${ICONS.FINANCE}
           </div>
           <div class="floating-nav-item" onclick="localStorage.removeItem('sloty_session'); location.reload()">
             ${ICONS.LOGOUT}
           </div>
        </div>
      </div>`
    elMain = container.querySelector('#admin-content-area')
  }

  const renderHome = (state) => {
    const total = state.stats?.totalSpots || 0
    const occ = state.stats?.occupied || 0
    const perc = total > 0 ? Math.round((occ / total) * 100) : 0
    const dash = 251.2 // 2 * PI * 40
    const offset = dash - (perc / 100) * dash
    
    const ads = state.ads?.filter(a => a.active) || []

    return `
      <div style="padding:20px; padding-bottom:120px; background:#f8f9fa;">
        
        <!-- LOGO (RESTORED) -->
        <div style="text-align:center; margin-bottom:20px;">
           <img src="/icons/pwa sloty.png" style="max-width:140px; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.1));">
        </div>

        <!-- BUILDING IDENTITY CARD -->
        <div class="building-card-dark">
          <div style="font-size:0.6rem; font-weight:700; color:var(--accent); letter-spacing:2px; text-transform:uppercase; margin-bottom:4px;">EDIFICIO</div>
          <div style="font-size:1.6rem; font-weight:900; color:white; margin-bottom:16px;">${state.buildingName}</div>
          
          <div style="background:rgba(255,255,255,0.05); padding:16px; border-radius:16px; display:flex; justify-content:space-between; align-items:center;">
             <div>
                <div style="font-size:0.5rem; font-weight:800; color:rgba(255,255,255,0.4); text-transform:uppercase; margin-bottom:4px;">CÓDIGO DE ACCESO</div>
                <div style="font-size:1.2rem; font-weight:900; color:var(--accent);">${state.buildingCode}</div>
             </div>
             <button onclick="navigator.clipboard.writeText('${state.buildingCode}'); alert('Copiado!')" 
               style="background:white; color:var(--primary); border:none; padding:8px 16px; border-radius:10px; font-size:0.6rem; font-weight:900; cursor:pointer;">
               COPIAR
             </button>
          </div>
        </div>

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
        <div style="font-size:0.7rem; font-weight:900; color:var(--primary); margin-bottom:15px; text-transform:uppercase; letter-spacing:1s;">GESTIÓN RÁPIDA</div>
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
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="m12 14 4-4"/><path d="m12 14-4-4"/><path d="m12 14 0-6"/></svg>
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
      <h3 style="font-weight:900; margin-bottom:20px;">GESTIÓN DE ESTRUCTURA</h3>
      
      <!-- GENERAR PLANTA -->
      <div style="background:white; padding:20px; border-radius:24px; margin-bottom:30px; box-shadow:var(--shadow-sm);">
        <div style="font-size:0.7rem; font-weight:800; color:#999; margin-bottom:15px; text-transform:uppercase;">NUEVA PLANTA</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
          <input type="text" id="level-name" placeholder="Piso / Área" style="padding:14px; border:1.5px solid #eee; border-radius:14px; font-family:var(--font); font-weight:700;">
          <input type="number" id="level-capacity" placeholder="Capacidad" style="padding:14px; border:1.5px solid #eee; border-radius:14px; font-family:var(--font); font-weight:700;">
        </div>
        <button data-action="GENERATE" style="width:100%; padding:14px; background:var(--primary); color:var(--accent); border:none; border-radius:14px; font-weight:900; cursor:pointer;">CREAR PLANTA</button>
      </div>

      <div style="display:grid; gap:15px;">
        ${state.levels.map(l => `
          <div style="background:white; border-radius:24px; overflow:hidden; border:1px solid #f0f0f0;">
            <div style="padding:16px 20px; background:#fcfcfc; border-bottom:1px solid #f0f0f0; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:1rem; font-weight:900; color:var(--primary);">${l.name}</div>
                <div style="font-size:0.6rem; font-weight:700; color:#999;">${l.slots.length} Puestos</div>
              </div>
              <div style="display:flex; gap:10px;">
                <button data-action="ADD_SLOT" data-name="${l.name}" style="background:none; border:none; color:var(--primary); font-size:1.1rem; cursor:pointer;">+</button>
                <button data-action="DELETE_LEVEL" data-name="${l.name}" style="background:none; border:none; color:#e63946; font-size:1rem; cursor:pointer;">🗑️</button>
              </div>
            </div>
            <div style="padding:15px; display:flex; flex-wrap:wrap; gap:6px;">
              ${l.slots.map(s => `
                <div style="padding:8px 12px; background:#f4f4f4; border-radius:8px; font-size:0.6rem; font-weight:800; display:flex; align-items:center; gap:6px;">
                  ${s.label}
                  <button data-action="DELETE_SLOT" data-levelname="${l.name}" data-label="${s.label}" style="border:none; background:none; color:#ddd; font-size:0.7rem; cursor:pointer;">×</button>
                </div>
              `).join('')}
              ${!l.slots.length ? '<div style="font-size:0.6rem; color:#bbb; padding:10px;">No hay puestos en esta planta</div>' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`

  const renderFinanceSummary = (state) => {
    const totalUSD = state.movements.reduce((a, m) => a + (m.amount || 0), 0)
    const methods = state.movements.reduce((acc, m) => {
      if (m.payMethod) acc[m.payMethod] = (acc[m.payMethod] || 0) + (m.amount || 0)
      return acc
    }, {})

    return `
      <div style="padding:20px; padding-bottom:120px;">
        <h3 style="font-weight:900; margin-bottom:20px;">RESUMEN DE CAJA</h3>
        
        <div style="background:var(--primary); color:white; padding:30px; border-radius:32px; margin-bottom:25px; text-align:center;">
           <div style="font-size:0.7rem; font-weight:700; color:var(--accent); letter-spacing:2px; text-transform:uppercase; margin-bottom:8px;">TOTAL RECOLECTADO</div>
           <div style="font-size:3rem; font-weight:900;">$${totalUSD}</div>
        </div>

        <div style="display:grid; gap:12px;">
          ${Object.entries(methods).map(([m, val]) => `
            <div style="background:white; padding:18px; border-radius:20px; display:flex; justify-content:space-between; align-items:center; border:1px solid #f0f0f0;">
              <div style="font-weight:900; color:var(--primary); text-transform:uppercase; font-size:0.75rem;">${m.replace('_', ' ')}</div>
              <div style="font-size:1.1rem; font-weight:900; color:#22c55e;">$${val}</div>
            </div>
          `).join('')}
          ${!Object.keys(methods).length ? '<div style="text-align:center; padding:40px; color:#bbb;">No hay registros de pago</div>' : ''}
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

  const renderPersonnel = (state) => `
    <div style="padding:20px;padding-bottom:100px;">
      <h3 style="font-weight:900;margin-bottom:20px;">NOMINA DE PERSONAL</h3>
      <div style="background:white;padding:25px;border-radius:28px;margin-bottom:30px;box-shadow:0 10px 30px rgba(0,0,0,0.03);border:1.5px solid #f8f8f8;">
        <div style="display:flex; justify-content:center; margin-bottom:20px;">
          <div id="photo-dropzone" style="width:110px;height:110px;border-radius:50%;background:#f9f9f9;border:2.5px dashed #eee;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;"><img id="guard-photo-preview" style="width:100%;height:100%;object-fit:cover;display:none;"><span id="photo-plus" style="font-size:2rem;color:#ddd;">👤</span></div>
          <input type="file" id="guard-photo-input" accept="image/*" style="display:none;">
        </div>
        <input type="text" id="guard-name" placeholder="Nombre completo" style="width:100%;padding:16px;border:1.5px solid #eee;border-radius:16px;margin-bottom:12px;font-family:'Montserrat',sans-serif;font-weight:700;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
          <input type="text" id="guard-pin" placeholder="PIN (4 cifras)" maxlength="4" style="padding:16px;border:1.5px solid #eee;border-radius:16px;font-family:'Montserrat',sans-serif;font-weight:900;text-align:center;">
          <select id="guard-shift" style="padding:16px;border:1.5px solid #eee;border-radius:16px;background:white;font-family:'Montserrat',sans-serif;font-weight:700;"><option value="Diurno">Diurno</option><option value="Nocturno">Nocturno</option><option value="24h">Rotativo</option></select>
        </div>
        <button data-action="ADD_GUARD" style="width:100%;padding:18px;background:var(--primary);color:#F5C518;border:none;border-radius:18px;font-weight:900;cursor:pointer;box-shadow:0 10px 25px rgba(0,0,0,0.1);">REGISTRAR GUARDIA</button>
      </div>
      <div style="display:grid;gap:12px;">
        ${(state.personnel || []).map(p => `<div style="background:white;padding:15px;border-radius:20px;display:flex;justify-content:space-between;align-items:center;border:1px solid #f0f0f0;"><div style="display:flex;align-items:center;gap:15px;"><div style="width:55px;height:55px;border-radius:50%;background:#f0f0f0;overflow:hidden;">${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#ccc;font-weight:900;">${p.name.charAt(0)}</div>`}</div><div><div style="font-weight:900;color:var(--primary);">${p.name}</div><div style="font-size:0.7rem;color:#999;font-weight:700;">PIN: <span style="color:var(--primary);">${p.pin}</span> · ${p.shift}</div></div></div><button data-action="DELETE_GUARD" data-id="${p.id}" style="color:#e63946;background:none;border:none;font-weight:900;cursor:pointer;font-size:0.75rem;">ELIMINAR</button></div>`).join('')}
      </div>
    </div>`

  const renderTabContent = (state) => {
    if (!elMain) return; const cur = elMain.innerHTML; let html = ''
    switch(activeTab) {
      case 'HOME': html = renderHome(state); break
      case 'PERSONAL': html = renderPersonnel(state); break
      case 'STRUCTURE': html = renderLevels(state); break
      case 'REPORTES': html = renderReports(state); break
      case 'FINANCE': html = renderFinanceSummary(state); break
      case 'SETTINGS': html = renderAuditLog(state); break
    }
    if (cur !== html) { elMain.innerHTML = html; if(activeTab==='PERSONAL') setupPersonnelHooks() }
  }

  const setupPersonnelHooks = () => {
    const dz = elMain?.querySelector('#photo-dropzone'), i = elMain?.querySelector('#guard-photo-input'), p = elMain?.querySelector('#guard-photo-preview'), s = elMain?.querySelector('#photo-plus')
    if (dz && i) {
      dz.onclick = () => i.click();
      i.onchange = (e) => {
        const file = e.target.files[0]; if (!file) return; const r = new FileReader()
        r.onload = (re) => { p.src = re.target.result; p.style.display = 'block'; s.style.display = 'none' }
        r.readAsDataURL(file)
      }
    }
  }

  const renderModal = () => {
    const l = container.querySelector('#modal-layer'); if(!l) return; if(!pendingAction){ l.innerHTML=''; return }
    l.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;backdrop-filter:blur(10px);"><div style="background:white;padding:30px;border-radius:32px;width:100%;max-width:380px;text-align:center;"><h3 style="font-weight:900;margin-bottom:10px;">Confirmar eliminación</h3><p style="color:#666;font-size:0.85rem;margin-bottom:30px;">Esta acción es permanente y afectará la base de datos.</p><div style="display:flex;flex-direction:column;gap:10px;"><button data-action="CONFIRM_DELETE" style="background:#e63946;color:white;border:none;padding:18px;border-radius:18px;font-weight:900;">ELIMINAR AHORA</button><button data-action="CANCEL_MODAL" style="background:#f4f4f4;color:#333;border:none;padding:18px;border-radius:18px;font-weight:900;">VOLVER</button></div></div></div>`
  }

  const render = () => {
    const s = getParkingState()
    if (!elMain) renderShell(s)
    else updateStats(s)
    renderTabContent(s); renderModal()
    container.querySelectorAll('.nav-item').forEach(v => {
      const active = v.dataset.tab === activeTab
      v.classList.toggle('active', active); const span = v.querySelector('span'); if(span && v.dataset.tab) span.style.opacity = active ? 0 : 1
    })
  }

  setInterval(() => {
    const s = getParkingState(); updateStats(s)
    if (['HOME','FINANCE','REPORTES'].includes(activeTab)) renderTabContent(s)
    const t = container.querySelector('#main-carousel'); let carouselIndex = 0
    if (t && t.children.length > 1) { carouselIndex = (window._cIdx || 0) + 1; window._cIdx = carouselIndex % t.children.length; t.style.transform = `translateX(-${window._cIdx * 100}%)` }
  }, 4000)

  render()
}
