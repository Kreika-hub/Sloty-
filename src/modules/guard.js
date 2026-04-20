import { getParkingState, updateParkingState, logMovement } from '../db.js'

export const initGuard = (container, guardName = 'Guardia') => {
  let state = getParkingState()
  let selectedSlot = null
  let currentView = 'MAP'
  let activeLevel = null
  let clockInterval = null

  // ── HELPERS ──────────────────────────────────────────────────
  const CAT = [
    { cat:'VISITANTE',   color:'#1a1a2e', label:'Visitante'  },
    { cat:'RESIDENTE',   color:'#F5C518', label:'Residente'  },
    { cat:'DISCAPACITADO',color:'#3b82f6',label:'Discap.'    },
    { cat:'ELECTRICO',   color:'#22c55e', label:'Eléctrico'  },
    { cat:'MUDANZA',     color:'#a855f7', label:'Mudanza'    },
    { cat:'MERCADO',     color:'#f97316', label:'Mercado'    },
  ]
  const PAY = [
    { m:'EFECTIVO_USD', label:'Efectivo $'  },
    { m:'EFECTIVO_BS',  label:'Efectivo Bs' },
    { m:'PAGO_MOVIL',   label:'Pago Móvil'  },
  ]
  const getCatColor = cat => CAT.find(c=>c.cat===cat)?.color || '#1a1a2e'
  const getCatLabel = cat => ({ VISITANTE:'V',RESIDENTE:'R',DISCAPACITADO:'D',ELECTRICO:'E',MUDANZA:'M',MERCADO:'MK' }[cat]||'V')

  const formatTime = iso => {
    if (!iso) return '00:00:00'
    const d = Math.floor((Date.now()-new Date(iso))/1000)
    return [Math.floor(d/3600),Math.floor((d%3600)/60),d%60].map(n=>n.toString().padStart(2,'0')).join(':')
  }
  const getWarning = iso => {
    if (!iso) return null
    const h = (Date.now()-new Date(iso))/3600000
    if (h>=8) return 'VENCIDO'
    if (h>=7.5) return 'POR VENCER'
    return null
  }

  // ── VISITOR LOOKUP (visitantes frecuentes) ───────────────────
  const findVisitorByPlate = plate => {
    const all = (state.movements||[]).filter(m => m.plate === plate && m.phone)
    return all.length ? { plate: all[0].plate, phone: all[0].phone, category: all[0].category } : null
  }
  const getFrequentVisitors = () => {
    const map = {}
    ;(state.movements||[]).forEach(m => {
      if (!m.plate) return
      if (!map[m.plate]) map[m.plate] = { plate:m.plate, phone:m.phone||'', category:m.category||'VISITANTE', count:0 }
      map[m.plate].count++
    })
    return Object.values(map).sort((a,b)=>b.count-a.count).slice(0,5)
  }

  // ── HEADER ───────────────────────────────────────────────────
  const renderHeader = () => {
    const occ = state.levels.reduce((a,l)=>a+l.slots.filter(s=>s.status==='OCCUPIED'||s.status==='DEBT').length,0)
    const total = state.levels.reduce((a,l)=>a+l.slots.length,0)
    const debts = state.levels.reduce((a,l)=>a+l.slots.filter(s=>s.status==='DEBT').length,0)
    return `
    <div style="background:#1a1a2e;padding:20px 24px 16px;color:white;position:sticky;top:0;z-index:100;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div>
          <div style="font-size:0.6rem;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:2px;">GARITA ACTIVA</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
            <div style="font-size:1rem;font-weight:900;">${guardName}</div>
            <button id="btn-guard-logout" style="background:rgba(230,57,70,0.2);color:#e63946;border:1px solid rgba(230,57,70,0.3);padding:3px 8px;border-radius:6px;font-size:0.55rem;font-weight:900;cursor:pointer;font-family:'Montserrat',sans-serif;">SALIR</button>
          </div>
          <div id="guard-clock" style="font-size:0.75rem;color:#F5C518;font-weight:700;margin-top:2px;">${new Date().toLocaleTimeString()}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;">DISPONIBLES</div>
          <div style="font-size:2.2rem;font-weight:900;color:#F5C518;line-height:1;">${total-occ}</div>
          <div style="font-size:0.65rem;color:rgba(255,255,255,0.35);">de ${total} puestos</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        <div style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:1.4rem;font-weight:900;color:#22c55e;">${total-occ}</div>
          <div style="font-size:0.55rem;color:rgba(34,197,94,0.8);font-weight:700;letter-spacing:1px;">LIBRES</div>
        </div>
        <div style="background:rgba(245,197,24,0.12);border:1px solid rgba(245,197,24,0.25);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:1.4rem;font-weight:900;color:#F5C518;">${occ}</div>
          <div style="font-size:0.55rem;color:rgba(245,197,24,0.8);font-weight:700;letter-spacing:1px;">OCUPADOS</div>
        </div>
        <div style="background:rgba(230,57,70,0.12);border:1px solid rgba(230,57,70,0.25);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:1.4rem;font-weight:900;color:#e63946;">${debts}</div>
          <div style="font-size:0.55rem;color:rgba(230,57,70,0.8);font-weight:700;letter-spacing:1px;">ALERTAS</div>
        </div>
      </div>
    </div>`
  }

  // ── LEVEL TABS ───────────────────────────────────────────────
  const renderLevelTabs = () => {
    if (!state.levels.length) return ''
    if (!activeLevel) activeLevel = state.levels[0].name
    return `
    <div style="background:#1a1a2e;padding:0 16px 16px;display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;">
      ${state.levels.map(l=>`
        <button class="level-tab" data-level="${l.name}"
          style="padding:7px 16px;border-radius:20px;border:none;white-space:nowrap;font-family:'Montserrat',sans-serif;font-weight:700;font-size:0.75rem;cursor:pointer;flex-shrink:0;
            background:${activeLevel===l.name?'#F5C518':'rgba(255,255,255,0.1)'};
            color:${activeLevel===l.name?'#1a1a2e':'rgba(255,255,255,0.6)'};">
          ${l.name}
        </button>`).join('')}
    </div>`
  }

  // ── MAP ──────────────────────────────────────────────────────
  const renderMap = () => {
    if (!state.levels.length) return `
      <div style="padding:60px 24px;text-align:center;">
        <div style="font-size:3rem;margin-bottom:12px;">🏗️</div>
        <p style="font-weight:700;color:#555;">Sin niveles configurados</p>
        <p style="font-size:0.8rem;color:#999;margin-top:6px;">El administrador debe configurar la estructura primero.</p>
      </div>`
    const level = state.levels.find(l=>l.name===activeLevel)||state.levels[0]
    const half = Math.ceil(level.slots.length/2)
    return `
    <div style="padding:12px 16px 20px;">
      <div style="display:flex;gap:12px;padding:8px 0 12px;flex-wrap:wrap;">
        ${[['#e8f5e9','#22c55e','LIBRE'],['#1a1a2e','#1a1a2e','OCUPADO'],['#e63946','#e63946','DEUDA']].map(([bg,bc,lbl])=>`
          <div style="display:flex;align-items:center;gap:4px;">
            <div style="width:10px;height:10px;border-radius:3px;background:${bg};border:1.5px solid ${bc};"></div>
            <span style="font-size:0.6rem;font-weight:700;color:#666;">${lbl}</span>
          </div>`).join('')}
      </div>
      <div class="parking-canvas">
        <div class="parking-column">${level.slots.slice(0,half).map((s,i)=>renderSpot(s,level.name,i)).join('')}</div>
        <div class="parking-lane"></div>
        <div class="parking-column">${level.slots.slice(half).map((s,i)=>renderSpot(s,level.name,i+half)).join('')}</div>
      </div>
    </div>`
  }

  const renderSpot = (slot, levelName, sIdx) => {
    const occ = slot.status==='OCCUPIED'
    const debt = slot.status==='DEBT'
    const free = !occ&&!debt
    const color = getCatColor(slot.category)
    const warn = occ ? getWarning(slot.entryTime) : null
    return `
    <div class="spot-2d guard-action ${occ?'occupied':''} ${debt?'debt':''}"
      data-level="${levelName}" data-sidx="${sIdx}"
      style="cursor:pointer;position:relative;
        ${occ?`border-color:${color};background:#1a1a2e;`:''}
        ${debt?'border-color:#e63946;background:#e63946;':''}
        ${free?'border-color:#22c55e;background:#f0fdf4;':''}">
      <span class="spot-label" style="color:${occ||debt?'white':'#1a1a2e'};pointer-events:none;">${slot.label}</span>
      ${occ?`<div style="background:${color};border-radius:3px;padding:1px 4px;margin-top:2px;pointer-events:none;"><span style="color:white;font-size:0.45rem;font-weight:900;">${getCatLabel(slot.category)}</span></div>`:''}
      ${warn?`<div style="position:absolute;top:-5px;right:-4px;background:${warn==='VENCIDO'?'#e63946':'#f97316'};color:white;font-size:0.4rem;font-weight:900;padding:2px 4px;border-radius:4px;pointer-events:none;">!</div>`:''}
    </div>`
  }

  // ── ENTRY FORM ───────────────────────────────────────────────
  const renderEntryForm = () => {
    const slot = selectedSlot
    const frequent = getFrequentVisitors()
    const buildingName = getParkingState().buildingName
    return `
    <div style="padding:20px;max-width:420px;margin:0 auto;">

      <!-- TICKET CARD -->
      <div style="border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.15);margin-bottom:20px;">
        <!-- Header negro -->
        <div style="background:#1a1a2e;padding:22px 24px 0;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
            <div>
              <div style="font-size:0.55rem;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:2px;margin-bottom:4px;">TICKET DE INGRESO</div>
              <div style="font-size:2rem;font-weight:900;color:#F5C518;letter-spacing:-1px;">SLOTY</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.55rem;color:rgba(255,255,255,0.4);font-weight:700;">PUESTO</div>
              <div style="font-size:2rem;font-weight:900;color:white;line-height:1;">${slot.label}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;border-top:1px dashed rgba(255,255,255,0.15);padding:14px 0 0;">
            <div><div style="font-size:0.5rem;color:rgba(255,255,255,0.4);font-weight:700;">EDIFICIO</div><div style="font-size:0.75rem;font-weight:800;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${buildingName}</div></div>
            <div><div style="font-size:0.5rem;color:rgba(255,255,255,0.4);font-weight:700;">GUARDIA</div><div style="font-size:0.75rem;font-weight:800;color:white;">${guardName}</div></div>
            <div><div style="font-size:0.5rem;color:rgba(255,255,255,0.4);font-weight:700;">HORA</div><div style="font-size:0.75rem;font-weight:800;color:#F5C518;">${new Date().toLocaleTimeString()}</div></div>
          </div>
          <!-- zigzag -->
          <div style="height:14px;margin:0 -24px;position:relative;overflow:hidden;">
            <div style="position:absolute;bottom:0;left:0;right:0;height:14px;background:white;border-radius:14px 14px 0 0;"></div>
          </div>
        </div>

        <!-- Body blanco -->
        <div style="background:white;padding:20px 24px 24px;">

          <!-- Visitantes frecuentes -->
          ${frequent.length ? `
            <div style="margin-bottom:16px;">
              <div style="font-size:0.6rem;font-weight:900;color:#bbb;letter-spacing:1px;margin-bottom:8px;">VISITAS FRECUENTES</div>
              <div style="display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;">
                ${frequent.map(v=>`
                  <button class="freq-visitor" data-plate="${v.plate}" data-phone="${v.phone||''}" data-cat="${v.category||'VISITANTE'}"
                    style="flex-shrink:0;padding:8px 12px;background:#f8f9fa;border:1.5px solid #eee;border-radius:10px;cursor:pointer;font-family:'Montserrat',sans-serif;text-align:left;">
                    <div style="font-size:0.8rem;font-weight:900;color:#1a1a2e;">${v.plate}</div>
                    <div style="font-size:0.6rem;color:#999;font-weight:600;">${v.count||1}x visitas</div>
                  </button>`).join('')}
              </div>
            </div>` : ''}

          <!-- Placa -->
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:0.65rem;font-weight:900;color:#bbb;letter-spacing:1px;margin-bottom:6px;">PLACA DEL VEHÍCULO *</label>
            <input type="text" id="entry-plate" placeholder="ABC-123" maxlength="10" autocomplete="off"
              style="width:100%;padding:14px;border:2px solid #eee;border-radius:12px;font-family:'Montserrat',sans-serif;font-size:1.3rem;font-weight:900;text-transform:uppercase;text-align:center;outline:none;letter-spacing:3px;transition:border 0.2s;">
          </div>

          <!-- Teléfono -->
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:0.65rem;font-weight:900;color:#bbb;letter-spacing:1px;margin-bottom:6px;">WHATSAPP</label>
            <div style="position:relative;">
              <input type="tel" id="entry-phone" placeholder="04XX-XXXXXXX" autocomplete="off"
                style="width:100%;padding:12px 14px;border:2px solid #eee;border-radius:12px;font-family:'Montserrat',sans-serif;font-size:0.95rem;font-weight:700;outline:none;transition:border 0.2s;">
              <div id="wa-status" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:0.7rem;font-weight:700;"></div>
            </div>
          </div>

          <!-- Categoría -->
          <div style="margin-bottom:20px;">
            <label style="display:block;font-size:0.65rem;font-weight:900;color:#bbb;letter-spacing:1px;margin-bottom:8px;">TIPO DE USUARIO</label>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;">
              ${CAT.map((c,i)=>`
                <button class="cat-chip ${i===0?'cat-active':''}" data-cat="${c.cat}" data-color="${c.color}"
                  style="padding:10px 4px;border-radius:10px;border:2px solid ${i===0?c.color:'#eee'};background:${i===0?c.color:'white'};color:${i===0?'white':'#bbb'};font-family:'Montserrat',sans-serif;font-size:0.62rem;font-weight:900;cursor:pointer;">
                  ${c.label}
                </button>`).join('')}
            </div>
          </div>

          <button id="btn-confirm-entry"
            style="width:100%;padding:16px;background:#1a1a2e;color:#F5C518;border:none;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:0.95rem;font-weight:900;cursor:pointer;letter-spacing:1px;">
            ↓ REGISTRAR INGRESO
          </button>
        </div>
      </div>
    </div>`
  }

  // ── EXIT FORM ────────────────────────────────────────────────
  const renderExitForm = () => {
    const slot = selectedSlot
    const timeStr = formatTime(slot.entryTime)
    const warn = getWarning(slot.entryTime)
    const phone = slot.phone ? slot.phone.replace(/\D/g,'') : null
    const waMsg = encodeURIComponent(`Hola, tu vehículo ${slot.plate||''} en ${getParkingState().buildingName} está${warn==='VENCIDO'?' VENCIDO':' por vencer'}. Por favor dirígete al estacionamiento.`)
    const waLink = phone ? `https://wa.me/${phone}?text=${waMsg}` : null
    return `
    <div style="padding:20px;max-width:420px;margin:0 auto;">
      <div style="border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.15);">
        <!-- Header -->
        <div style="background:#1a1a2e;padding:22px 24px 0;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
            <div>
              <div style="font-size:0.55rem;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:2px;margin-bottom:4px;">TICKET DE SALIDA</div>
              <div style="font-size:2rem;font-weight:900;color:#F5C518;letter-spacing:-1px;">SLOTY</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.55rem;color:rgba(255,255,255,0.4);font-weight:700;">PUESTO</div>
              <div style="font-size:2rem;font-weight:900;color:white;line-height:1;">${slot.label}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;border-top:1px dashed rgba(255,255,255,0.15);padding:14px 0 0;">
            <div><div style="font-size:0.5rem;color:rgba(255,255,255,0.4);font-weight:700;">PLACA</div><div style="font-size:1.2rem;font-weight:900;color:#F5C518;">${slot.plate||'—'}</div></div>
            <div><div style="font-size:0.5rem;color:rgba(255,255,255,0.4);font-weight:700;">CATEGORÍA</div><div style="font-size:0.85rem;font-weight:800;color:white;">${slot.category||'VISITANTE'}</div></div>
            <div><div style="font-size:0.5rem;color:rgba(255,255,255,0.4);font-weight:700;">TIEMPO</div><div id="exit-timer" style="font-size:1.1rem;font-weight:900;color:${warn?'#e63946':'#22c55e'};">${timeStr}</div></div>
            <div><div style="font-size:0.5rem;color:rgba(255,255,255,0.4);font-weight:700;">MONTO</div><div style="font-size:1.2rem;font-weight:900;color:#F5C518;">$1.00</div></div>
          </div>
          ${warn?`<div style="background:${warn==='VENCIDO'?'rgba(230,57,70,0.2)':'rgba(249,115,22,0.2)'};border:1px solid ${warn==='VENCIDO'?'#e63946':'#f97316'};border-radius:8px;padding:8px 12px;margin:12px 0 0;font-size:0.7rem;font-weight:900;color:${warn==='VENCIDO'?'#e63946':'#f97316'};text-align:center;">⚠ ${warn}</div>`:''}
          <div style="height:14px;margin:12px -24px 0;position:relative;overflow:hidden;">
            <div style="position:absolute;bottom:0;left:0;right:0;height:14px;background:white;border-radius:14px 14px 0 0;"></div>
          </div>
        </div>

        <!-- Body -->
        <div style="background:white;padding:20px 24px 24px;">
          ${waLink?`
            <a href="${waLink}" target="_blank"
              style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;background:#25D366;color:white;border-radius:12px;font-family:'Montserrat',sans-serif;font-size:0.8rem;font-weight:900;text-decoration:none;margin-bottom:14px;">
              📱 NOTIFICAR POR WHATSAPP
            </a>`:''}

          <!-- Método de pago -->
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:0.65rem;font-weight:900;color:#bbb;letter-spacing:1px;margin-bottom:8px;">MÉTODO DE PAGO</label>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;">
              ${PAY.map((p,i)=>`
                <button class="pay-chip ${i===0?'pay-active':''}" data-method="${p.m}"
                  style="padding:10px 4px;border-radius:10px;border:2px solid ${i===0?'#1a1a2e':'#eee'};background:${i===0?'#1a1a2e':'white'};color:${i===0?'#F5C518':'#bbb'};font-family:'Montserrat',sans-serif;font-size:0.62rem;font-weight:900;cursor:pointer;">
                  ${p.label}
                </button>`).join('')}
            </div>
          </div>

          <div id="ref-container" style="display:none;margin-bottom:14px;">
            <label style="display:block;font-size:0.65rem;font-weight:900;color:#bbb;letter-spacing:1px;margin-bottom:6px;">REFERENCIA</label>
            <input type="text" id="payment-ref" placeholder="Número de referencia"
              style="width:100%;padding:12px 14px;border:2px solid #eee;border-radius:12px;font-family:'Montserrat',sans-serif;font-size:0.9rem;outline:none;">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;">
            <button id="btn-exit-paid"
              style="padding:16px;background:#22c55e;color:white;border:none;border-radius:12px;font-family:'Montserrat',sans-serif;font-weight:900;cursor:pointer;font-size:0.85rem;">
              ✓ PAGADO
            </button>
            <button id="btn-exit-debt"
              style="padding:16px;background:#e63946;color:white;border:none;border-radius:12px;font-family:'Montserrat',sans-serif;font-weight:900;cursor:pointer;font-size:0.85rem;">
              ✗ DEUDA
            </button>
          </div>
        </div>
      </div>
    </div>`
  }

  // ── RENDER ───────────────────────────────────────────────────
  const render = () => {
    if (clockInterval) clearInterval(clockInterval)
    state = getParkingState()
    if (!activeLevel && state.levels.length) activeLevel = state.levels[0].name
    container.innerHTML = `
    <div style="background:#f0f2f5;min-height:100vh;font-family:'Montserrat',sans-serif;">
      ${renderHeader()}
      ${currentView==='MAP' ? renderLevelTabs() : ''}
      <div id="guard-content" style="overflow-y:auto;padding-bottom:24px;">
        ${currentView==='MAP'   ? renderMap()       : ''}
        ${currentView==='ENTRY' ? renderEntryForm() : ''}
        ${currentView==='EXIT'  ? renderExitForm()  : ''}
      </div>
      ${currentView!=='MAP' ? `
        <div style="padding:12px 16px;background:white;border-top:1px solid #eee;position:sticky;bottom:0;">
          <button id="btn-back-map" style="width:100%;padding:13px;background:#f4f4f4;border:1px solid #ddd;border-radius:12px;font-family:'Montserrat',sans-serif;font-weight:700;cursor:pointer;color:#666;font-size:0.85rem;">
            ← CANCELAR
          </button>
        </div>` : ''}
    </div>`
    setupListeners()
  }

  // ── LISTENERS ────────────────────────────────────────────────
  const setupListeners = () => {
    // Clock
    clockInterval = setInterval(() => {
      const el = document.getElementById('guard-clock')
      if (el) el.textContent = new Date().toLocaleTimeString()
      else { clearInterval(clockInterval); return }
      const et = document.getElementById('exit-timer')
      if (et && selectedSlot) et.textContent = formatTime(selectedSlot.entryTime)
    }, 1000)

    // Logout
    document.getElementById('btn-guard-logout')?.addEventListener('click', () => {
      if (confirm('¿Cerrar sesión?')) location.reload()
    })

    // Level tabs
    document.querySelectorAll('.level-tab').forEach(b => {
      b.onclick = () => { activeLevel = b.dataset.level; render() }
    })

    // Map spots
    document.querySelectorAll('.guard-action').forEach(b => {
      b.onclick = () => {
        const level = state.levels.find(l=>l.name===b.dataset.level)
        if (!level) return
        const sIdx = parseInt(b.dataset.sidx)
        selectedSlot = { ...level.slots[sIdx], levelName: b.dataset.level, sIdx }
        currentView = selectedSlot.status==='FREE' ? 'ENTRY' : 'EXIT'
        render()
      }
    })

    // Frequent visitors autocomplete
    document.querySelectorAll('.freq-visitor').forEach(b => {
      b.onclick = () => {
        const plateEl = document.getElementById('entry-plate')
        const phoneEl = document.getElementById('entry-phone')
        if (plateEl) plateEl.value = b.dataset.plate
        if (phoneEl) phoneEl.value = b.dataset.phone
        // Set category chip
        const cat = b.dataset.cat
        document.querySelectorAll('.cat-chip').forEach(c => {
          const match = c.dataset.cat === cat
          c.style.background = match ? c.dataset.color : 'white'
          c.style.borderColor = match ? c.dataset.color : '#eee'
          c.style.color = match ? 'white' : '#bbb'
          c.classList.toggle('cat-active', match)
        })
        // Highlight selected
        document.querySelectorAll('.freq-visitor').forEach(v => v.style.borderColor='#eee')
        b.style.borderColor = '#F5C518'
        // Show WA status
        const ws = document.getElementById('wa-status')
        if (ws && b.dataset.phone) ws.innerHTML = `<span style="color:#25D366;">📱</span>`
      }
    })

    // Plate input → lookup
    const plateEl = document.getElementById('entry-plate')
    if (plateEl) {
      plateEl.addEventListener('input', () => {
        plateEl.value = plateEl.value.toUpperCase()
        const found = findVisitorByPlate(plateEl.value)
        if (found) {
          const phoneEl = document.getElementById('entry-phone')
          if (phoneEl && !phoneEl.value) phoneEl.value = found.phone||''
          const ws = document.getElementById('wa-status')
          if (ws) ws.innerHTML = `<span style="color:#22c55e;font-size:0.65rem;">✓ conocido</span>`
        }
      })
      plateEl.addEventListener('focus', () => { plateEl.style.borderColor='#F5C518' })
      plateEl.addEventListener('blur', () => { plateEl.style.borderColor='#eee' })
    }

    // Cat chips
    document.querySelectorAll('.cat-chip').forEach(c => {
      c.onclick = () => {
        document.querySelectorAll('.cat-chip').forEach(x => {
          x.style.background='white'; x.style.borderColor='#eee'; x.style.color='#bbb'
          x.classList.remove('cat-active')
        })
        c.style.background=c.dataset.color; c.style.borderColor=c.dataset.color; c.style.color='white'
        c.classList.add('cat-active')
      }
    })

    // Pay chips
    document.querySelectorAll('.pay-chip').forEach(c => {
      c.onclick = () => {
        document.querySelectorAll('.pay-chip').forEach(x => {
          x.style.background='white'; x.style.borderColor='#eee'; x.style.color='#bbb'
          x.classList.remove('pay-active')
        })
        c.style.background='#1a1a2e'; c.style.borderColor='#1a1a2e'; c.style.color='#F5C518'
        c.classList.add('pay-active')
        const ref = document.getElementById('ref-container')
        if (ref) ref.style.display = c.dataset.method==='PAGO_MOVIL' ? 'block' : 'none'
      }
    })

    // Confirm Entry
    document.getElementById('btn-confirm-entry')?.addEventListener('click', () => {
      const plate = document.getElementById('entry-plate')?.value.trim().toUpperCase()
      const phone = document.getElementById('entry-phone')?.value.trim()
      if (!plate) { alert('Ingresa la placa del vehículo'); return }
      const activeCat = document.querySelector('.cat-active')
      const category = activeCat?.dataset.cat || 'VISITANTE'
      const lvl = state.levels.find(l=>l.name===selectedSlot.levelName)
      if (!lvl) return
      lvl.slots[selectedSlot.sIdx] = {
        ...lvl.slots[selectedSlot.sIdx],
        status:'OCCUPIED', category, plate, phone,
        entryTime: new Date().toISOString(), guardName
      }
      logMovement({ type:'INGRESO', plate, slot:selectedSlot.label, category, guardName, phone })
      updateParkingState(state)
      currentView='MAP'; render()
    })

    // Exit
    const processExit = (newStatus) => {
      const payChip = document.querySelector('.pay-active')
      const payMethod = payChip?.dataset.method || 'EFECTIVO_USD'
      const ref = document.getElementById('payment-ref')?.value||''
      const lvl = state.levels.find(l=>l.name===selectedSlot.levelName)
      if (!lvl) return
      const slotData = lvl.slots[selectedSlot.sIdx]
      lvl.slots[selectedSlot.sIdx] = {
        ...slotData, status:newStatus,
        plate: newStatus==='FREE'?null:slotData.plate,
        phone: newStatus==='FREE'?null:slotData.phone,
        entryTime: newStatus==='FREE'?null:slotData.entryTime,
        category:'VISITANTE'
      }
      logMovement({
        type:'SALIDA', plate:slotData.plate, slot:slotData.label,
        category:slotData.category, guardName,
        paymentStatus: newStatus==='FREE'?'PAGADO':'DEUDA',
        payMethod, ref, amount:1
      })
      updateParkingState(state)
      currentView='MAP'; render()
    }
    document.getElementById('btn-exit-paid')?.addEventListener('click', ()=>processExit('FREE'))
    document.getElementById('btn-exit-debt')?.addEventListener('click', ()=>processExit('DEBT'))
    document.getElementById('btn-back-map')?.addEventListener('click', ()=>{ currentView='MAP'; render() })
  }

  render()
}
