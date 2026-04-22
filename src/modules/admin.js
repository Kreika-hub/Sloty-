import { getParkingState, saveParkingState, logAudit } from '../db.js'

export const initAdmin = (container) => {
  let activeTab = 'HOME'
  let reportFilter = 'HOY'
  let pendingAction = null // { type, name, lName, sLabel, guardId }
  let editingLevel = null // Level name being renamed

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

  container.onclick = (e) => {
    const trigger = e.target.closest('[data-action]')
    if (trigger && actions[trigger.dataset.action]) actions[trigger.dataset.action](trigger)
  }

  const renderShell = (state) => {
    container.innerHTML = `
      <div id="admin-shell" style="display:flex; flex-direction:column; min-height:100vh; background:#fcfcfc; overflow:hidden;">
        <div id="modal-layer"></div>
        <header class="smart-header">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="font-size:1.1rem;font-weight:900;letter-spacing:-1px;color:white;">SLOTY</div>
            <div style="height:20px;width:1.5px;background:rgba(255,255,255,0.2);"></div>
            <div style="font-size:0.85rem;font-weight:900;color:white;opacity:0.9;">${state.buildingName.toUpperCase()}</div>
          </div>
          <div class="header-status">
            <span style="color:#22c55e;">●</span> 
            <span id="header-occupancy">${state.stats.occupied} / ${state.stats.totalSpots} OCUP.</span>
          </div>
        </header>
        <main id="admin-content" style="flex:1; overflow-y:auto; padding-bottom:env(safe-area-inset-bottom, 30px);"></main>
        <nav class="bottom-nav">
          ${[{k:'HOME',l:'Inicio',i:'🏠'},{k:'REPORTES',l:'Historial',i:'🕒'},{k:'STRUCTURE',l:'Gestión',i:'🏢'},{k:'FINANCE',l:'Finanzas',i:'💰'}].map(i=>`
            <div class="nav-item ${activeTab===i.k?'active':''}" data-action="TAB" data-tab="${i.k}">
              <div class="nav-bubble">${i.i}</div><div class="nav-icon">${i.i}</div>
              <span style="opacity:${activeTab===i.k?0:1}">${i.l}</span>
            </div>`).join('')}
          <div class="nav-item" data-action="LOGOUT"><div class="nav-icon">🚪</div><span>Salir</span></div>
        </nav>
      </div>`
    elMain = container.querySelector('#admin-content')
    elStatus = container.querySelector('#header-occupancy')
  }

  const updateStats = (state) => { if (elStatus) elStatus.textContent = `${state.stats.occupied} / ${state.stats.totalSpots} OCUP.` }

  const renderHome = (state) => {
    const movsToday = (state.movements || []).filter(m => new Date(m.timestamp) >= new Date().setHours(0,0,0,0))
    const ads = (state.ads || []).filter(a => a.active)
    return `
      <div style="padding-bottom:100px;">
        ${ads.length ? `
          <section class="carousel-container"><div class="carousel-track" id="main-carousel">
            ${ads.map(ad => `<div class="ad-card"><img src="${ad.imageUrl}" onerror="this.src='https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&q=80&w=800'"></div>`).join('')}
          </div></section>` : ''}
        <div style="padding:20px;">
          <div style="background:white; border-radius:32px; padding:25px; box-shadow:0 10px 40px rgba(0,0,0,0.02); margin-bottom:25px; border:1px solid #f8f8f8; display:flex; justify-content:space-between; align-items:center;">
             <div><div style="font-size:0.75rem; color:#999; font-weight:700; margin-bottom:6px;">INGRESOS EN CURSO</div><div style="font-size:2.2rem; font-weight:900; color:var(--primary);">${movsToday.length}</div></div>
             <div style="width:60px; height:60px; background:#f4f4f4; border-radius:20px; display:flex; align-items:center; justify-content:center; font-size:1.8rem;">📦</div>
          </div>
          <div class="dashboard-grid">
            ${[{k:'STRUCTURE',l:'Estructura',s:`${state.levels.length} Niveles`,i:'🏢',bg:'linear-gradient(135deg,#EEF2FF,#E0E7FF)',c:'#4F46E5'},
               {k:'PERSONAL',l:'Personal',s:`${(state.personnel||[]).length} Guardias`,i:'👥',bg:'linear-gradient(135deg,#F0FDF4,#DCFCE7)',c:'#16A34A'},
               {k:'SETTINGS',l:'Tarifas',s:'Ajustes de cobro',i:'⚡',bg:'linear-gradient(135deg,#FFFBEB,#FEF3C7)',c:'#D97706'}].map(f=>`
              <div class="feature-btn" data-action="TAB" data-tab="${f.k}"><div class="f-icon" style="background:${f.bg}; color:${f.c};">${f.i}</div><div><div class="f-label">${f.l}</div><div class="f-stat">${f.s}</div></div></div>`).join('')}
          </div>
        </div>
      </div>`
  }

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
      case 'STRUCTURE': html = `<div style="padding:20px;text-align:center;color:#666;">(Gestión de Niveles)</div>` ; break
      case 'REPORTES': html = renderReports(state); break
      case 'FINANCE': html = `<div style="padding:20px;text-align:center;color:#666;">(Resumen de Caja)</div>` ; break
      case 'SETTINGS': html = `<div style="padding:20px;text-align:center;color:#666;">(Ajustes Globales)</div>` ; break
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
