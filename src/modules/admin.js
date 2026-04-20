import { getParkingState, saveParkingState, logAudit } from '../db.js'

export const initAdmin = (container) => {
  let activeTab = 'HOME'
  let reportFilter = 'HOY'
  let pendingAction = null // { type, name, lName, sLabel, guardId }
  let editingLevel = null // Level name being renamed

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
    // INFRASTRUCTURE
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
    // PERSONNEL
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
      logAudit(`Registró guardia: ${name} (Turno: ${shift})`);
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
    // GLOBAL
    CONFIRM_DELETE: () => {
      if (!pendingAction) return
      const state = getParkingState()
      if (pendingAction.type === 'LEVEL') {
        state.levels = state.levels.filter(l => l.name !== pendingAction.name)
        logAudit(`Eliminó planta: ${pendingAction.name}`)
      } else if (pendingAction.type === 'SLOT') {
        const level = state.levels.find(l => l.name === pendingAction.lName)
        if (level) {
          level.slots = level.slots.filter(s => s.label !== pendingAction.sLabel)
          logAudit(`Eliminó puesto: ${pendingAction.sLabel} en ${pendingAction.lName}`)
        }
      }
      saveParkingState(state); pendingAction = null; render()
    },
    CANCEL_MODAL: () => { pendingAction = null; render() },
    TAB: (btn) => { activeTab = btn.dataset.tab; render() },
    FILTER_REPORTS: (btn) => { reportFilter = btn.dataset.filter; render() },
    LOGOUT: () => { location.reload() },
    SAVE_SETTINGS: () => {
      const freeHours = parseFloat(document.getElementById('set-freehours').value) || 0
      const baseRate = parseFloat(document.getElementById('set-baserate').value) || 0
      const extraPerHour = parseFloat(document.getElementById('set-extra').value) || 0
      
      const state = getParkingState()
      state.settings = { freeHours, baseRate, extraPerHour }
      logAudit(`Actualizó Tarifas: ${freeHours}h libres / $${baseRate} base / $${extraPerHour} extra/h`)
      saveParkingState(state)
      alert('Tarifas guardadas correctamente')
      render()
    },
    ADD_FIELD: () => {
      const label = document.getElementById('new-field-label').value.trim()
      if (!label) return
      const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-true]/g, '')
      const state = getParkingState()
      state.settings.customFields = state.settings.customFields || []
      if (state.settings.customFields.find(f => f.id === id)) return alert('Ya existe un campo similar')
      state.settings.customFields.push({ id, label, required: true })
      saveParkingState(state)
      render()
    },
    DELETE_FIELD: (btn) => {
      const id = btn.dataset.id
      const state = getParkingState()
      state.settings.customFields = state.settings.customFields.filter(f => f.id !== id)
      saveParkingState(state)
      render()
    },
    ADD_CAT: () => {
      const label = document.getElementById('new-cat-label').value.trim()
      const tag = document.getElementById('new-cat-tag').value.trim().toUpperCase()
      const color = document.getElementById('new-cat-color').value
      if (!label || !tag) return alert('Nombre y Etiqueta son obligatorios')
      
      const state = getParkingState()
      state.settings.categories = state.settings.categories || []
      const id = label.toUpperCase().replace(/\s+/g, '_')
      if (state.settings.categories.find(c => c.id === id)) return alert('Ya existe esta categoría')
      
      state.settings.categories.push({ id, label, tag, color, txt: 'white' }) // Simplificamos txt a white o calculamos contraste
      saveParkingState(state)
      render()
    },
    DELETE_CAT: (btn) => {
      const id = btn.dataset.id
      const state = getParkingState()
      state.settings.categories = state.settings.categories.filter(c => c.id !== id)
      saveParkingState(state)
      render()
    },
    DOWNLOAD_CSV: () => {
      const state = getParkingState()
      const movs = state.movements || []
      if (!movs.length) return alert('No hay movimientos para exportar')
      
      const customFields = state.settings?.customFields || []
      const headers = ['ID','FECHA','TIPO','PLACA','PUESTO','CATEGORIA','COBRO_USD','COBRO_BS','REF','GUARDIA', ...customFields.map(f=>f.label.toUpperCase())]
      
      const rows = movs.map(m => {
        const baseRow = [
          m.id,
          new Date(m.timestamp).toLocaleString(),
          m.type,
          m.plate || '---',
          m.slot || '---',
          m.category || '---',
          m.amount || 0,
          m.rawAmount || 0,
          m.ref || '---',
          m.guardName || '---'
        ]
        const customRows = customFields.map(f => m[f.id] || '---')
        return [...baseRow, ...customRows].join(',')
      })
      
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `sloty-report-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  container.onclick = (e) => {
    const trigger = e.target.closest('[data-action]')
    if (!trigger) return
    const action = trigger.dataset.action
    if (actions[action]) actions[action](trigger)
  }

  const renderModal = () => {
    if (!pendingAction) return ''
    const title = pendingAction.type === 'LEVEL' ? 'Eliminar Planta' : 'Eliminar Puesto'
    return `
      <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;backdrop-filter:blur(4px);">
        <div style="background:white;padding:30px;border-radius:24px;width:100%;max-width:400px;text-align:center;">
          <h3 style="font-weight:900;margin-bottom:10px;">${title}</h3>
          <p style="color:#666;margin-bottom:30px;">Esta acción no se puede deshacer.</p>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button data-action="CONFIRM_DELETE" class="btn-primary" style="background:#e63946;margin:0;">SÍ, ELIMINAR</button>
            <button data-action="CANCEL_MODAL" style="background:#f4f4f4;border:none;height:50px;border-radius:12px;font-weight:900;cursor:pointer;">CANCELAR</button>
          </div>
        </div>
      </div>`
  }

  const renderHome = (state) => {
    const slug = state.buildingName.toLowerCase().replace(/\s+/g, '-');
    
    const movs = state.movements || []
    const startOfToday = new Date()
    startOfToday.setHours(0,0,0,0)
    const movsToday = movs.filter(m => new Date(m.timestamp) >= startOfToday)
    
    let sumHrs = 0; let countExits = 0
    movsToday.forEach(m => {
      if (m.type === 'SALIDA') {
        const entry = movs.find(e => e.type === 'INGRESO' && e.plate === m.plate && e.timestamp < m.timestamp)
        if (entry) {
          sumHrs += (new Date(m.timestamp) - new Date(entry.timestamp)) / 3600000
          countExits++
        }
      }
    })
    const avgStay = countExits > 0 ? (sumHrs / countExits).toFixed(1) : 0
    
    // Calculate active vehicles and categories
    const activeVehicles = []
    const catCounts = {}
    state.levels.forEach(l => {
      l.slots.forEach(s => {
        if (s.status === 'OCCUPIED' || s.status === 'DEBT') {
          activeVehicles.push({ ...s, levelName: l.name })
          catCounts[s.category] = (catCounts[s.category] || 0) + 1
        }
      })
    })

    // Sort active vehicles by most recent entry
    activeVehicles.sort((a,b) => new Date(b.entryTime) - new Date(a.entryTime))

    // Calculate Donut Chart Config for Free vs Occupied
    const totalSpots = state.stats.totalSpots || 1
    const occupiedSpots = state.stats.occupied
    const freeSpots = totalSpots - occupiedSpots
    const occPercent = (occupiedSpots / totalSpots) * 360
    const donutStops = `#1a1a2e 0deg ${occPercent}deg, #22c55e ${occPercent}deg 360deg`

    return `
    <div style="padding:20px;">
      <div style="background:var(--primary);border-radius:18px;padding:25px;margin-bottom:20px;color:white;box-shadow:0 10px 20px rgba(26,26,46,0.1);">
        <div style="font-size:0.7rem;opacity:0.6;font-weight:900;letter-spacing:1px;">EDIFICIO</div>
        <div style="font-size:1.4rem;font-weight:900;">${state.buildingName}</div>
        <div style="font-size:0.8rem;opacity:0.8;margin-top:4px;">Resp: ${state.adminInfo?.name || 'Admin'}</div>
      </div>
      
      <!-- CÓDIGO DE EDIFICIO -->
      <div style="background:white;padding:20px;border-radius:18px;margin-bottom:20px;border:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h4 style="font-size:0.7rem;font-weight:900;color:#999;letter-spacing:1px;text-transform:uppercase;">Código de Edificio</h4>
          <div style="font-size:1.5rem;font-weight:900;color:var(--primary);">${state.buildingCode}</div>
        </div>
        <button onclick="navigator.clipboard.writeText('${state.buildingCode}'); alert('Código copiado!')"
          style="background:#f4f4f4;border:none;padding:12px 20px;border-radius:12px;font-weight:900;cursor:pointer;color:var(--primary);font-size:0.8rem;">
          COPIAR
        </button>
      </div>

      <!-- MÉTRICAS PREMIUM (ESTILO CLARO) -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        <!-- DONUT CHART CARD -->
        <div style="background:white;border:1px solid #eee;border-radius:24px;padding:25px 20px;box-shadow:0 10px 30px rgba(0,0,0,0.03);display:flex;flex-direction:column;align-items:center;justify-content:center;">
           <div style="font-size:0.7rem;font-weight:900;color:#999;letter-spacing:1px;margin-bottom:15px;text-align:center;">DENSIDAD</div>
           
           <div style="position:relative;width:110px;height:110px;border-radius:50%;background:conic-gradient(${donutStops});display:flex;align-items:center;justify-content:center;margin-bottom:18px;">
             <div style="width:85px;height:85px;background:white;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:inset 0 4px 10px rgba(0,0,0,0.05);">
               <div style="font-size:1.8rem;font-weight:900;color:#1a1a2e;line-height:1;">${Math.round((occupiedSpots/totalSpots)*100)}%</div>
               <div style="font-size:0.5rem;font-weight:900;color:#999;letter-spacing:1px;margin-top:2px;">USO</div>
             </div>
           </div>

           <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;width:100%;">
              <div style="display:flex;align-items:center;gap:4px;">
                 <div style="width:10px;height:10px;border-radius:50%;background:#1a1a2e;"></div>
                 <span style="font-size:0.6rem;font-weight:900;color:#666;">${occupiedSpots} Ocupados</span>
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                 <div style="width:10px;height:10px;border-radius:50%;background:#22c55e;"></div>
                 <span style="font-size:0.6rem;font-weight:900;color:#666;">${freeSpots} Libres</span>
              </div>
           </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
           <div style="background:white;border:1px solid #1a1a2e;border-radius:20px;padding:20px;color:#1a1a2e;flex:1;display:flex;flex-direction:column;justify-content:center;box-shadow:0 6px 20px rgba(26,26,46,0.08);">
              <div style="font-size:2.4rem;font-weight:900;line-height:1;margin-bottom:4px;color:#1a1a2e;">${movsToday.length}</div>
              <div style="font-size:0.65rem;font-weight:900;color:#999;text-transform:uppercase;">Flujo del Día (Movs)</div>
           </div>
           <div style="background:white;border:1px solid #eee;border-radius:20px;padding:20px;color:#1a1a2e;flex:1;display:flex;flex-direction:column;justify-content:center;box-shadow:0 4px 15px rgba(0,0,0,0.03);">
              <div style="font-size:2.4rem;font-weight:900;line-height:1;margin-bottom:4px;color:var(--primary);">${avgStay}h</div>
              <div style="font-size:0.65rem;font-weight:900;color:#999;text-transform:uppercase;">T. Promedio Permanencia</div>
           </div>
        </div>
      </div>
      
      <!-- DESGLOSE DE OCUPACIÓN -->
      ${Object.keys(catCounts).length > 0 ? `
      <h4 style="font-size:0.75rem;font-weight:900;color:var(--primary);margin-bottom:12px;letter-spacing:1px;text-transform:uppercase;">Clasificación Actual</h4>
      <div style="display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:10px;margin-bottom:20px;">
        ${Object.entries(catCounts).map(([cat, count]) => `
          <div style="background:white;border:1px solid #eee;border-radius:12px;padding:12px 16px;min-width:100px;text-align:center;box-shadow:0 2px 5px rgba(0,0,0,0.02);flex-shrink:0;">
            <div style="width:12px;height:12px;border-radius:3px;background:${getCategoryColor(cat, state.settings?.categories)};margin:0 auto 8px;"></div>
            <div style="font-size:1.2rem;font-weight:900;color:var(--primary);line-height:1;">${count}</div>
            <div style="font-size:0.6rem;font-weight:900;color:#999;letter-spacing:0.5px;margin-top:4px;">${cat}</div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- LISTA DE VEHÍCULOS -->
      <h4 style="font-size:0.75rem;font-weight:900;color:var(--primary);margin-bottom:12px;letter-spacing:1px;text-transform:uppercase;">Vehículos en Estructura</h4>
      ${activeVehicles.length > 0 ? `
      <div style="background:white;border-radius:18px;border:1px solid #eee;overflow:hidden;">
        ${activeVehicles.map((v, i) => `
          <div style="padding:15px;display:flex;justify-content:space-between;align-items:center;border-bottom:${i === activeVehicles.length - 1 ? 'none' : '1px solid #f4f4f4'};">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="background:${getCategoryColor(v.category, state.settings?.categories)};color:white;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.2rem;box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                ${getCategoryLabel(v.category, state.settings?.categories)}
              </div>
              <div>
                <div style="font-size:1rem;font-weight:900;color:var(--primary);">${v.plate || 'Sin Placa'}</div>
                <div style="font-size:0.65rem;font-weight:700;color:#999;">${v.label} • Llegada: ${v.entryTime ? new Date(v.entryTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</div>
              </div>
            </div>
            <div style="text-align:right;">
              ${v.prePaid ? `<span style="background:rgba(34,197,94,0.1);color:#22c55e;padding:4px 8px;border-radius:6px;font-size:0.6rem;font-weight:900;">PREPAGO</span>` : ''}
              <div style="font-size:0.65rem;color:#ccc;margin-top:4px;">G: ${v.guardName || 'Desconocido'}</div>
            </div>
          </div>
        `).join('')}
      </div>
      ` : `
      <div style="text-align:center;padding:30px;background:white;border-radius:18px;border:1px dashed #ddd;color:#bbb;">
        <div style="font-size:2rem;margin-bottom:10px;">🍃</div>
        <div style="font-size:0.8rem;font-weight:700;">Estacionamiento completamente libre</div>
      </div>
      `}
    </div>`
  }

  const renderLayout = (state) => `
    <div style="padding:20px;">
      <h3 style="font-weight:900;margin-bottom:20px;">CONFIGURACIÓN DE ESTRUCTURA</h3>
      <div style="background:#f8f9fa;padding:20px;border-radius:16px;margin-bottom:30px;border:1px dashed #ddd;">
        <input type="text" id="level-name" placeholder="Ej. Sótano 1" style="width:100%;padding:14px;border:1px solid #ddd;border-radius:12px;margin-bottom:12px;">
        <input type="number" id="level-capacity" placeholder="Capacidad" style="width:100%;padding:14px;border:1px solid #ddd;border-radius:12px;margin-bottom:20px;">
        <button data-action="GENERATE" class="btn-primary" style="margin:0;">CREAR PLANTA</button>
      </div>
      ${state.levels.map(lvl => `
        <div style="background:white;border:1px solid #eee;border-radius:16px;margin-bottom:15px;overflow:hidden;">
          <div style="padding:15px 20px;background:#fcfcfc;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;">
            <div style="display:flex;align-items:center;gap:12px;">
              <button data-action="TOGGLE_COLLAPSE" data-name="${lvl.name}" style="background:none;border:none;font-size:1rem;cursor:pointer;">${lvl.collapsed ? '▶' : '▼'}</button>
              ${editingLevel === lvl.name ? `
                <input type="text" id="rename-input-${lvl.name}" value="${lvl.name}" style="padding:4px 8px;border:1px solid var(--primary);border-radius:6px;width:120px;">
                <button data-action="CONFIRM_RENAME" data-oldname="${lvl.name}" style="background:#22c55e;color:white;border:none;padding:4px 10px;border-radius:6px;font-size:0.7rem;">OK</button>
              ` : `
                <strong style="color:var(--primary);cursor:pointer;" data-action="START_RENAME" data-name="${lvl.name}">${lvl.name}</strong>
              `}
            </div>
            <button data-action="DELETE_LEVEL" data-name="${lvl.name}" style="color:#e63946;background:none;border:none;font-weight:900;font-size:0.7rem;cursor:pointer;">ELIMINAR</button>
          </div>
          ${!lvl.collapsed ? `
            <div style="padding:15px;display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;">
              ${lvl.slots.map(s => `
                <div style="background:#f9f9f9;padding:8px;border-radius:8px;text-align:center;position:relative;">
                  <div style="font-weight:900;font-size:0.75rem;">${s.label}</div>
                  <button data-action="DELETE_SLOT" data-levelname="${lvl.name}" data-label="${s.label}" style="position:absolute;top:-5px;right:-5px;background:#e63946;color:white;border:none;width:16px;height:16px;border-radius:50%;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;">×</button>
                </div>
              `).join('')}
              <button data-action="ADD_SLOT" data-name="${lvl.name}" style="background:var(--accent);color:white;border:none;border-radius:8px;font-weight:900;cursor:pointer;height:40px;">+</button>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>`

  const renderPersonnel = (state) => `
    <div style="padding:20px;">
      <h3 style="font-weight:900;margin-bottom:20px;">GESTIÓN DE PERSONAL</h3>
      <div style="background:white;padding:25px;border-radius:20px;margin-bottom:30px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <h4 style="font-size:0.8rem;color:#999;margin-bottom:15px;font-weight:900;letter-spacing:1px;">REGISTRAR NUEVO GUARDIA</h4>
        <div style="margin-bottom:20px;">
          <div style="display:flex; justify-content:center; margin-bottom:20px;">
            <div id="photo-dropzone" style="width:100px;height:100px;border-radius:50%;background:#f4f4f4;border:2px dashed #ddd;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;flex-shrink:0;">
              <img id="guard-photo-preview" style="width:100%;height:100%;object-fit:cover;display:none;">
              <span id="photo-plus" style="font-size:2rem;color:#ccc;">+</span>
            </div>
            <input type="file" id="guard-photo-input" accept="image/*" style="display:none;">
          </div>
          <div style="width:100%;">
            <input type="text" id="guard-name" placeholder="Nombre Completo" style="width:100%;padding:14px;border:1px solid #ddd;border-radius:12px;margin-bottom:12px;font-size:0.95rem;">
            <input type="text" id="guard-phone" placeholder="Teléfono WhatsApp (Ej: 58412...)" style="width:100%;padding:14px;border:1px solid #ddd;border-radius:12px;margin-bottom:12px;font-size:0.95rem;">
            <div style="display:flex;gap:12px;">
              <input type="text" id="guard-pin" placeholder="PIN (4)" maxlength="4" style="flex:1;padding:14px;border:1px solid #ddd;border-radius:12px;font-size:0.95rem;">
              <select id="guard-shift" style="flex:1.5;padding:14px;border:1px solid #ddd;border-radius:12px;background:white;font-size:0.95rem;">
                <option value="Mañana">Mañana</option>
                <option value="Tarde">Tarde</option>
                <option value="Noche">Noche</option>
                <option value="24h">24h</option>
              </select>
            </div>
          </div>
        </div>
        <button id="btn-add-guard-trig" style="width:100%;padding:18px;background:var(--primary);color:white;border:none;border-radius:14px;font-weight:900;cursor:pointer;font-family:var(--font);">
          AÑADIR A LA NOMINA
        </button>
      </div>

      <div style="display:grid;gap:12px;">
        ${(state.personnel || []).map(p => {
          const isWorking = (state.movements || []).some(m => m.guardName === p.name && (Date.now() - new Date(m.timestamp)) < 8 * 3600 * 1000);
          return `
          <div style="background:white;padding:15px 20px;border-radius:16px;display:flex;justify-content:space-between;align-items:center;border:1px solid #eee;">
            <div style="display:flex;align-items:center;gap:15px;">
              <div style="width:50px;height:50px;border-radius:50%;background:#f0f0f0;overflow:hidden;flex-shrink:0;border:2px solid ${isWorking?'#22c55e':'#eee'};">
                ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:1.2rem;font-weight:900;">${p.name.charAt(0)}</div>`}
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="font-weight:900;color:var(--primary);">${p.name}</div>
                  <span style="font-size:0.6rem;padding:2px 6px;border-radius:4px;background:#f4f4f4;color:#666;font-weight:900;">${p.shift || 'Mañana'}</span>
                </div>
                <div style="font-size:0.75rem;color:#999;margin-top:2px;">
                  PIN: <strong style="color:var(--primary);">${p.pin}</strong> · 
                  <span style="color:${isWorking?'#22c55e':'#999'};font-weight:700;">${isWorking?'● Trabajando':'○ Inactivo'}</span>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:10px;align-items:center;">
              ${p.phone ? `
                <a href="https://wa.me/${p.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${p.name}, bienvenido a Sloty. Tu acceso para ${state.buildingName} es:\n\nCódigo Edificio: ${state.buildingCode}\nTu PIN: ${p.pin}\n\nIngresa aquí: ${window.location.origin}/?building=${state.buildingCode}`)}" 
                   target="_blank" style="text-decoration:none;background:#25D366;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:900;">
                   W
                </a>
              ` : ''}
              <button data-action="DELETE_GUARD" data-id="${p.id}" style="color:#e63946;background:none;border:none;font-weight:900;cursor:pointer;font-size:0.75rem;">Eliminar</button>
            </div>
          </div>`
        }).join('<p style="text-align:center;color:#bbb;padding:20px;">No hay guardias registrados.</p>')}
      </div>
    </div>`


  const renderAudit = (state) => `
    <div style="padding:20px;">
      <h3 style="font-weight:900;margin-bottom:20px;">BITÁCORA DE AUDITORÍA</h3>
      <div style="background:white;border-radius:20px;overflow:hidden;border:1px solid #eee;">
        <div style="padding:15px;background:#fcfcfc;font-size:0.75rem;font-weight:900;color:#999;border-bottom:1px solid #eee;">ACTIVIDADES RECIENTES</div>
        <div style="max-height:500px;overflow-y:auto;">
          ${(state.auditLog || []).map(a => `
            <div style="padding:15px;border-bottom:1px solid #f9f9f9;">
              <div style="font-size:0.85rem;font-weight:700;color:var(--primary);">${a.action}</div>
              <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:0.7rem;color:#999;">
                <span>👤 ${a.user}</span>
                <span>📅 ${new Date(a.timestamp).toLocaleString()}</span>
              </div>
            </div>
          `).join(state.auditLog?.length ? '' : '<p style="padding:20px;text-align:center;color:#bbb;">No hay registros de auditoría.</p>')}
        </div>
      </div>
    </div>`

  const renderFinance = (state) => {
    const movs = state.movements || []
    const paid = movs.filter(m => m.paymentStatus === 'PAGADO')
    const debts = movs.filter(m => m.type === 'SALIDA' && m.paymentStatus === 'DEUDA')
    
    const usd = paid.filter(m => m.payMethod === 'EFECTIVO_USD').length
    const bs = paid.filter(m => m.payMethod === 'EFECTIVO_BS').length
    const pm = paid.filter(m => m.payMethod === 'PAGO_MOVIL').length

    // Today metrics
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfWeek = new Date(startOfToday - now.getDay() * 86400000).getTime()

    const dailyIncome = paid.filter(m => new Date(m.timestamp).getTime() >= startOfToday).reduce((a, b) => a + (b.amount || 0), 0)
    const weeklyIncome = paid.filter(m => new Date(m.timestamp).getTime() >= startOfWeek).reduce((a, b) => a + (b.amount || 0), 0)

    // Projected income (extrapolation)
    const rawDaysElapsed = now.getDay() + (now.getHours() / 24)
    const daysElapsed = rawDaysElapsed === 0 ? 0.1 : rawDaysElapsed
    const projectedWeekly = Math.round((weeklyIncome / daysElapsed) * 7)

    return `
      <div style="padding:20px;">
        <h3 style="font-weight:900;margin-bottom:20px;">RENDIMIENTO FINANCIERO</h3>
        
        <!-- MÉTRICAS EN TIEMPO REAL -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div style="background:var(--primary);color:white;padding:15px;border-radius:15px;text-align:center;box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <div style="font-size:1.6rem;font-weight:900;">$${dailyIncome}.00</div>
            <div style="font-size:0.6rem;font-weight:900;letter-spacing:1px;opacity:0.8;margin-top:2px;">INGRESOS DE HOY</div>
          </div>
          <div style="background:#F5C518;color:var(--primary);padding:15px;border-radius:15px;text-align:center;box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <div style="font-size:1.6rem;font-weight:900;">$${weeklyIncome}.00</div>
            <div style="font-size:0.6rem;font-weight:900;letter-spacing:1px;opacity:0.8;margin-top:2px;">ESTA SEMANA</div>
          </div>
        </div>

        <div style="background:#f4f4f4;border:1px dashed #ccc;padding:12px;border-radius:12px;text-align:center;margin-bottom:25px;">
          <div style="font-size:0.65rem;font-weight:900;color:#999;letter-spacing:1px;margin-bottom:4px;">PROYECCIÓN ESTIMADA (7 DÍAS)</div>
          <div style="font-size:1.4rem;font-weight:900;color:#22c55e;">~$${projectedWeekly}.00</div>
        </div>

        <!-- HISTÓRICO GLOBAL -->
        <h4 style="font-size:0.75rem;font-weight:900;color:#999;letter-spacing:1px;margin-bottom:12px;">INVENTARIO GLOBAL</h4>
        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px;">
          <div style="flex:1 1 45%; background:white;border:1px solid #eee;color:var(--primary);padding:15px;border-radius:15px;text-align:center;">
            <div style="font-size:1.6rem;font-weight:900;">${paid.length}</div>
            <div style="font-size:0.6rem;font-weight:900;letter-spacing:1px;color:#999;">COBROS EXITOSOS</div>
          </div>
          <div style="flex:1 1 45%; background:white;border:1px solid #f9c2c5;color:#e63946;padding:15px;border-radius:15px;text-align:center;">
            <div style="font-size:1.6rem;font-weight:900;">${debts.length}</div>
            <div style="font-size:0.6rem;font-weight:900;letter-spacing:1px;opacity:0.8;">VEHÍCULOS EN DEUDA</div>
          </div>
        </div>

        <h4 style="font-size:0.75rem;font-weight:900;color:#999;letter-spacing:1px;margin-bottom:12px;">USO POR MÉTODOS (GLOBAL)</h4>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap:10px; margin-bottom:25px;">
          <div style="background:white;border:1px solid #eee;padding:15px 10px;border-radius:12px;text-align:center;">
            <div style="font-size:1.4rem;font-weight:900;color:#22c55e;margin-bottom:4px;">${usd}</div>
            <div style="font-size:0.55rem;color:#999;font-weight:900;letter-spacing:0.5px;">EFECTIVO $</div>
          </div>
          <div style="background:white;border:1px solid #eee;padding:15px 10px;border-radius:12px;text-align:center;">
            <div style="font-size:1.4rem;font-weight:900;color:#3b82f6;margin-bottom:4px;">${bs}</div>
            <div style="font-size:0.55rem;color:#999;font-weight:900;letter-spacing:0.5px;">EFECTIVO Bs</div>
          </div>
          <div style="background:white;border:1px solid #eee;padding:15px 10px;border-radius:12px;text-align:center;">
            <div style="font-size:1.4rem;font-weight:900;color:#a855f7;margin-bottom:4px;">${pm}</div>
            <div style="font-size:0.55rem;color:#999;font-weight:900;letter-spacing:0.5px;">PAGO MÓVIL</div>
          </div>
        </div>

        <h4 style="font-size:0.75rem;font-weight:900;color:#999;letter-spacing:1px;margin-bottom:12px;">ÚLTIMOS EXCEDENTES (+8H) COBRADOS</h4>
        <div style="display:grid;gap:10px;">
          ${paid.filter(p=>p.amount > 0).slice(0, 15).map(p => `
            <div style="background:white;padding:15px;border-radius:12px;border:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-weight:900;color:var(--primary);font-size:0.95rem;">${p.plate || 'Anónimo'}</div>
                <div style="font-size:0.65rem;color:#999;font-weight:700;margin-top:4px;">
                  MÉTODO: <span style="color:#22c55e;">${({EFECTIVO_USD:'Efectivo $',EFECTIVO_BS:'Efectivo Bs',PAGO_MOVIL:'Pago Móvil'}[p.payMethod]||p.payMethod)}</span> ${p.ref ? ` | REF: <strong style="color:#1a1a2e;">${p.ref}</strong>` : ''}
                </div>
                <div style="font-size:0.6rem;color:#ccc;margin-top:2px;">Guardia: ${p.guardName||'—'}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:900;color:#F5C518;font-size:1.2rem;">$${p.amount || 1}.00</div>
                <div style="font-size:0.6rem;color:#ccc;margin-top:4px;">${new Date(p.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              </div>
            </div>
          `).join('') || '<div style="text-align:center;padding:25px;background:white;border-radius:12px;border:1px dashed #ddd;color:#bbb;font-size:0.8rem;font-weight:700;">No hay pagos registrados aún</div>'}
        </div>
        </div>
      </div>
    `
  }

  const renderReportes = (state) => {
    let movs = [...(state.movements || [])]
    const customFields = state.settings?.customFields || []
    
    // Filtering Logic
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfWeek = new Date(startOfToday - now.getDay() * 86400000).getTime()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    
    if (reportFilter === 'HOY') {
      movs = movs.filter(m => new Date(m.timestamp).getTime() >= startOfToday)
    } else if (reportFilter === 'SEMANA') {
      movs = movs.filter(m => new Date(m.timestamp).getTime() >= startOfWeek)
    } else if (reportFilter === 'MES') {
      movs = movs.filter(m => new Date(m.timestamp).getTime() >= startOfMonth)
    }
    
    movs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
    
    return `
      <div style="padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="font-weight:900;">HISTORIAL DE TICKETS</h3>
          <button data-action="DOWNLOAD_CSV" style="background:#22c55e;color:white;border:none;padding:10px 18px;border-radius:10px;font-weight:900;font-size:0.75rem;cursor:pointer;box-shadow:0 4px 10px rgba(34,197,94,0.2);">
            📥 DESCARGAR CSV
          </button>
        </div>

        <!-- FILTROS -->
        <div style="display:flex;gap:10px;margin-bottom:20px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:5px;">
          ${['HOY','SEMANA','MES','TODO'].map(f => `
            <button data-action="FILTER_REPORTS" data-filter="${f}" 
              style="padding:8px 16px;border-radius:20px;border:none;font-weight:900;font-size:0.7rem;cursor:pointer;
                background:${reportFilter === f ? 'var(--primary)' : 'white'};
                color:${reportFilter === f ? 'white' : '#999'};
                box-shadow:0 2px 5px rgba(0,0,0,0.05);">
              ${f}
            </button>
          `).join('')}
        </div>

        <div style="background:white;border-radius:20px;border:1px solid #eee;overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
            <thead>
              <tr style="background:#fcfcfc;border-bottom:1px solid #eee;color:#999;">
                <th style="padding:15px;text-align:left;">FECHA</th>
                <th style="padding:15px;text-align:left;">TIPO</th>
                <th style="padding:15px;text-align:left;">PLACA</th>
                <th style="padding:15px;text-align:left;">PUESTO</th>
                ${customFields.map(f => `<th style="padding:15px;text-align:left;">${f.label.toUpperCase()}</th>`).join('')}
                <th style="padding:15px;text-align:right;">COBRO</th>
              </tr>
            </thead>
            <tbody>
              ${movs.map(m => `
                <tr style="border-bottom:1px solid #f9f9f9;">
                  <td style="padding:15px;white-space:nowrap;">
                    <div style="font-weight:700;color:var(--primary);">${new Date(m.timestamp).toLocaleDateString()}</div>
                    <div style="font-size:0.6rem;color:#ccc;">${new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
                  </td>
                  <td style="padding:15px;">
                    <span style="background:${m.type==='INGRESO'?'rgba(34,197,94,0.1)':'rgba(59,130,246,0.1)'};color:${m.type==='INGRESO'?'#22c55e':'#3b82f6'};padding:3px 8px;border-radius:6px;font-weight:900;font-size:0.55rem;">
                      ${m.type}
                    </span>
                  </td>
                  <td style="padding:15px;font-weight:900;color:var(--primary);">${m.plate || '---'}</td>
                  <td style="padding:15px;font-weight:700;color:#666;">${m.slot || '---'}</td>
                  ${customFields.map(f => `<td style="padding:15px;color:#888;">${m[f.id] || '---'}</td>`).join('')}
                  <td style="padding:15px;text-align:right;font-weight:900;color:${m.amount>0?'#22c55e':'#ccc'};">
                    ${m.amount > 0 ? `$${m.amount}.00` : (m.paymentStatus === 'PAGADO' ? 'PREPAGO' : '---')}
                  </td>
                </tr>
              `).join('')}
              ${movs.length === 0 ? `<tr><td colspan="${5 + customFields.length}" style="padding:40px;text-align:center;color:#bbb;">No hay movimientos registrados para este periodo.</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `
  }

  const renderSettings = (state) => {
    const s = state.settings || { freeHours: 8, baseRate: 1, extraPerHour: 0 }
    return `
    <div style="padding:20px;max-width:600px;margin:0 auto;">
      <h3 style="font-weight:900;margin-bottom:20px;">CONFIGURACIÓN DE TARIFAS</h3>
      <div style="background:white;padding:25px;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,0.05);border:1px solid #eee;">
        <p style="font-size:0.8rem;color:#666;line-height:1.5;margin-bottom:20px;font-weight:700;">
          Define las reglas de facturación de visitantes. Si la permanencia supera tus <strong>Horas Libres</strong>, el sistema aplicará automáticamente la <strong>Tarifa Base</strong> fijada más la tarifa extra por el acumulado de horas excedidas (redondeo horario hacia arriba).
        </p>

        <div style="margin-bottom:15px;">
          <label style="display:block;font-size:0.75rem;font-weight:900;color:var(--primary);margin-bottom:8px;letter-spacing:1px;">HORAS LIBRES (EXONERADAS)</label>
          <div style="display:flex;align-items:center;background:#f9f9f9;border:2px solid #eee;border-radius:12px;padding:5px 15px;">
            <span style="font-weight:900;color:#999;font-size:1.2rem;margin-right:10px;">⏱️</span>
            <input type="number" id="set-freehours" value="${s.freeHours}" step="0.5" min="0" style="width:100%;padding:12px 0;background:transparent;border:none;font-weight:900;font-size:1.1rem;color:#1a1a2e;outline:none;" />
            <span style="font-weight:900;color:#999;">hrs</span>
          </div>
        </div>

        <div style="margin-bottom:15px;">
          <label style="display:block;font-size:0.75rem;font-weight:900;color:var(--primary);margin-bottom:8px;letter-spacing:1px;">TARIFA BASE POR EXCEDENTE</label>
          <div style="display:flex;align-items:center;background:#f9f9f9;border:2px solid #eee;border-radius:12px;padding:5px 15px;">
            <span style="font-weight:900;color:#22c55e;font-size:1.2rem;margin-right:10px;">$</span>
            <input type="number" id="set-baserate" value="${s.baseRate}" step="0.1" min="0" style="width:100%;padding:12px 0;background:transparent;border:none;font-weight:900;font-size:1.1rem;color:#1a1a2e;outline:none;" />
            <span style="font-weight:900;color:#999;">USD</span>
          </div>
        </div>

        <div style="margin-bottom:25px;">
          <label style="display:block;font-size:0.75rem;font-weight:900;color:var(--primary);margin-bottom:8px;letter-spacing:1px;">RECARGO POR HORA EXTRA</label>
          <div style="display:flex;align-items:center;background:#f9f9f9;border:2px solid #eee;border-radius:12px;padding:5px 15px;">
            <span style="font-weight:900;color:#F5C518;font-size:1.2rem;margin-right:10px;">+$</span>
            <input type="number" id="set-extra" value="${s.extraPerHour}" step="0.1" min="0" style="width:100%;padding:12px 0;background:transparent;border:none;font-weight:900;font-size:1.1rem;color:#1a1a2e;outline:none;" />
            <span style="font-weight:900;color:#999;">/hr</span>
          </div>
        </div>

        <button data-action="SAVE_SETTINGS" style="width:100%;padding:18px;background:var(--primary);color:#F5C518;border:none;border-radius:14px;font-weight:900;font-size:1rem;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.15);">
          💾 GUARDAR AJUSTES
        </button>
      </div>

      <h3 style="font-weight:900;margin:30px 0 20px;">CAMPOS DE REGISTRO (VISITANTES)</h3>
      <div style="background:white;padding:25px;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,0.05);border:1px solid #eee;">
        <p style="font-size:0.8rem;color:#666;line-height:1.5;margin-bottom:20px;font-weight:700;">
          Define qué información extra debe pedir el guardia al registrar un visitante (ej. Torre, Piso, Nro de Apto).
        </p>

        <div style="display:grid;gap:12px;margin-bottom:25px;">
          ${(s.customFields || []).map(f => `
            <div style="background:#f9f9f9;padding:12px 15px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;border:1px solid #eee;">
              <div style="font-weight:900;color:var(--primary);">${f.label}</div>
              <button data-action="DELETE_FIELD" data-id="${f.id}" style="color:#e63946;background:none;border:none;font-weight:900;cursor:pointer;font-size:0.75rem;">Eliminar</button>
            </div>
          `).join('')}
        </div>

        <div style="display:flex;gap:10px;">
          <input type="text" id="new-field-label" placeholder="Nombre del campo (ej. Torre)" style="flex:1;padding:14px;border:1px solid #ddd;border-radius:12px;font-family:var(--font);font-size:0.9rem;">
          <button data-action="ADD_FIELD" style="background:var(--primary);color:white;border:none;padding:0 20px;border-radius:12px;font-weight:900;cursor:pointer;">AÑADIR</button>
        </div>
      </div>

      <h3 style="font-weight:900;margin:30px 0 20px;">CATEGORÍAS DE VEHÍCULOS</h3>
      <div style="background:white;padding:25px;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,0.05);border:1px solid #eee;">
        <p style="font-size:0.8rem;color:#666;line-height:1.5;margin-bottom:20px;font-weight:700;">
          Configura los tipos de vehículos permitidos (ej: Visitante, Residente, Delivery).
        </p>

        <div style="display:grid;gap:12px;margin-bottom:25px;">
          ${(s.categories || []).map(cat => `
            <div style="background:#f9f9f9;padding:12px 15px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;border:1px solid #eee;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:24px;height:24px;border-radius:6px;background:${cat.color};display:flex;align-items:center;justify-content:center;color:white;font-size:0.6rem;font-weight:900;">${cat.tag}</div>
                <div style="font-weight:900;color:var(--primary);">${cat.label}</div>
              </div>
              <button data-action="DELETE_CAT" data-id="${cat.id}" style="color:#e63946;background:none;border:none;font-weight:900;cursor:pointer;font-size:0.75rem;">Eliminar</button>
            </div>
          `).join('')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 80px 50px auto;gap:10px;">
          <input type="text" id="new-cat-label" placeholder="Nombre (ej. Delivery)" style="padding:14px;border:1px solid #ddd;border-radius:12px;font-size:0.8rem;">
          <input type="text" id="new-cat-tag" placeholder="Tag" maxlength="2" style="padding:14px;border:1px solid #ddd;border-radius:12px;font-size:0.8rem;text-align:center;">
          <input type="color" id="new-cat-color" value="#3b82f6" style="width:100%;height:100%;border:none;padding:0;background:none;cursor:pointer;">
          <button data-action="ADD_CAT" style="background:var(--primary);color:white;border:none;padding:0 20px;border-radius:12px;font-weight:900;cursor:pointer;">AÑADIR</button>
        </div>
      </div>
    </div>
    `
  }

  // -- LIVE SYNC LOGIC --
  let lastSyncStr = localStorage.getItem('sloty_state')
  setInterval(() => {
    const freshSyncStr = localStorage.getItem('sloty_state')
    if (freshSyncStr !== lastSyncStr) {
      lastSyncStr = freshSyncStr
      if (activeTab === 'HOME' || activeTab === 'FINANCE') {
        render()
      }
    }
  }, 1000)

  const render = () => {
    const state = getParkingState()
    lastSyncStr = JSON.stringify(state)
    container.innerHTML = `
      <div style="background:#f4f4f4;min-height:100vh;display:flex;flex-direction:column;font-family:var(--font);">
        <div style="background:var(--primary);padding:20px;color:white;display:flex;justify-content:space-between;align-items:center;">
          <img src="/sloty-logo-v2.png.png" alt="Sloty" style="width:100px;height:auto;display:block;" />
          <button data-action="LOGOUT" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:8px 15px;border-radius:20px;font-weight:700;cursor:pointer;font-size:0.8rem;">Salir</button>
        </div>
        <nav style="display:flex;flex-wrap:wrap;justify-content:center;background:white;border-bottom:1px solid #eee;gap:0;">
          ${['HOME','REPORTES','LAYOUT','PERSONAL','AUDIT','FINANCE','SETTINGS'].map(tab => `
            <div data-action="TAB" data-tab="${tab}" 
              style="flex:1 1 auto;padding:12px 6px;text-align:center;font-weight:800;font-size:0.7rem;cursor:pointer;
                border-bottom:3px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'};
                color:${activeTab === tab ? 'var(--primary)' : '#999'};">
              ${{HOME:'Inicio',REPORTES:'Reportes',LAYOUT:'Estructura',PERSONAL:'Personal',AUDIT:'Auditoría',FINANCE:'Finanzas',SETTINGS:'Tarifas'}[tab]}
            </div>`).join('')}
        </nav>
        <div style="flex:1;overflow-y:auto;padding-bottom:100px;">
          ${activeTab === 'HOME' ? renderHome(state) : ''}
          ${activeTab === 'REPORTES' ? renderReportes(state) : ''}
          ${activeTab === 'LAYOUT' ? renderLayout(state) : ''}
          ${activeTab === 'PERSONAL' ? renderPersonnel(state) : ''}
          ${activeTab === 'AUDIT' ? renderAudit(state) : ''}
          ${activeTab === 'FINANCE' ? renderFinance(state) : ''}
          ${activeTab === 'SETTINGS' ? renderSettings(state) : ''}
        </div>
        ${renderModal()}
      </div>`
    
    // Setup listeners for file upload in Personnel tab
    if (activeTab === 'PERSONAL') {
      const dropzone = container.querySelector('#photo-dropzone');
      const input = container.querySelector('#guard-photo-input');
      const preview = container.querySelector('#guard-photo-preview');
      const plus = container.querySelector('#photo-plus');
      const btnAdd = container.querySelector('#btn-add-guard-trig');

      if (dropzone && input) {
        dropzone.onclick = () => input.click();
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
              preview.src = re.target.result;
              preview.style.display = 'block';
              plus.style.display = 'none';
            };
            reader.readAsDataURL(file);
          }
        };
      }
      if (btnAdd) btnAdd.onclick = () => actions.ADD_GUARD();
    }
  }
  render()
}
