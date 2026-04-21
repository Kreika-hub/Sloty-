import { getParkingState, updateParkingState, logMovement } from '../db.js'

export const initGuard = (container, guardName = 'Guardia') => {
  let state = getParkingState()
  let selectedSlot = null
  let currentView = 'MAP'
  let activeLevel = null
  let clockInterval = null
  let qrScanner = null
  let lastTicketData = null

  const CAT = [
    { cat:'VISITANTE',    color:'#1a1a2e', label:'Visitante'  },
    { cat:'RESIDENTE',    color:'#F5C518', label:'Residente'  },
    { cat:'DISCAPACITADO',color:'#3b82f6', label:'Discap.'    },
    { cat:'ELECTRICO',    color:'#22c55e', label:'Eléctrico'  },
    { cat:'MUDANZA',      color:'#a855f7', label:'Mudanza'    },
    { cat:'MERCADO',      color:'#f97316', label:'Mercado'    },
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

  // ── SCANNER LOGIC ──────────────────────────────────────────
  const stopScanner = async () => {
    if (qrScanner) {
      try {
        await qrScanner.clear()
        qrScanner = null
      } catch (e) {}
    }
  }

  const initQRScanner = () => {
    setTimeout(() => {
      const el = document.getElementById('qr-reader')
      if (!el) return
      qrScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 })
      qrScanner.render((text) => {
        try {
          const data = JSON.parse(text)
          if (data.plate && data.slot) handleQRResult(data)
        } catch (e) {
          console.warn("QR no válido", text)
        }
      })
    }, 100)
  }

  const handleQRResult = (data) => {
    stopScanner()
    state.levels.forEach(lvl => {
      const sIdx = lvl.slots.findIndex(s => s.label === data.slot)
      if (sIdx !== -1) {
        selectedSlot = { ...lvl.slots[sIdx], levelName: lvl.name, sIdx }
        currentView = selectedSlot.status === 'FREE' ? 'ENTRY' : 'EXIT'
        render()
      }
    })
  }

  // ── PRINT LOGIC ─────────────────────────────────────────────
  const printTicket = (type = 'INGRESO') => {
    const slot = selectedSlot
    const building = state.buildingName
    const logoBase64 = "" // Podríamos inyectar el logo aquí si fuera necesario
    
    const win = window.open('', '_blank', 'width=400,height=600')
    win.document.write('<html><head><title>Ticket Sloty</title>')
    win.document.write('<style>body{font-family:sans-serif;text-align:center;padding:10px;} .qr{margin:20px 0;} .label{font-size:32px;font-weight:bold;}</style>')
    win.document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></scr' + 'ipt>')
    win.document.write('</head><body>')
    win.document.write('<h2>' + building + '</h2>')
    win.document.write('<p>TICKET DE ' + type + '</p>')
    win.document.write('<div class="label">' + slot.label + '</div>')
    win.document.write('<p>PLACA: ' + (slot.plate || '---') + '</p>')
    win.document.write('<div id="qrcode" class="qr"></div>')
    win.document.write('<p>' + new Date().toLocaleString() + '</p>')
    win.document.write('<p>¡Gracias por usar Sloty!</p>')
    win.document.write('<script>')
    win.document.write('  setTimeout(function(){')
    win.document.write('    new QRCode(document.getElementById("qrcode"), { text: JSON.stringify({plate:"'+slot.plate+'",slot:"'+slot.label+'"}), width: 180, height: 180 });')
    win.document.write('    setTimeout(function(){ window.print(); window.close(); }, 500);')
    win.document.write('  }, 500);')
    win.document.write('</script></body></html>')
    win.document.close()
  }

  // ── HEADER ───────────────────────────────────────────────────
  const renderHeader = () => {
    const occ = state.levels.reduce((a,l)=>a+l.slots.filter(s=>s.status==='OCCUPIED'||s.status==='DEBT').length,0)
    const total = state.levels.reduce((a,l)=>a+l.slots.length,0)
    const debts = state.levels.reduce((a,l)=>a+l.slots.filter(s=>s.status==='DEBT').length,0)
    return `
    <div style="background:#1a1a2e;padding:24px 24px 16px;color:white;position:sticky;top:0;z-index:100;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <div style="font-size:0.6rem;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:2px;">GARITA ACTIVA</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:4px;">
            <div style="font-size:1.2rem;font-weight:900;">${guardName}</div>
            <button id="btn-guard-logout" style="background:#F5C518;color:#1a1a2e;border:none;padding:5px 12px;border-radius:8px;font-size:0.65rem;font-weight:900;cursor:pointer;font-family:'Montserrat',sans-serif;">CERRAR TURNO</button>
          </div>
          <div id="guard-clock" style="font-size:0.85rem;color:#F5C518;font-weight:700;margin-top:4px;">${new Date().toLocaleTimeString().toLowerCase()}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;">DISPONIBLES</div>
          <div style="font-size:2.8rem;font-weight:900;color:#F5C518;line-height:0.9;">${total-occ}</div>
          <div style="font-size:0.65rem;color:rgba(255,255,255,0.35);">de ${total} puestos</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:900;color:white;">${total-occ}</div>
          <div style="font-size:0.55rem;color:rgba(255,255,255,0.5);font-weight:700;letter-spacing:1px;">LIBRES</div>
        </div>
        <div style="background:rgba(245,197,24,0.1);border:1px solid rgba(245,197,24,0.2);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:900;color:#F5C518;">${occ}</div>
          <div style="font-size:0.55rem;color:rgba(245,197,24,0.8);font-weight:700;letter-spacing:1px;">OCUPADOS</div>
        </div>
        <div style="background:rgba(230,57,70,0.1);border:1px solid rgba(230,57,70,0.2);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:900;color:#e63946;">${debts}</div>
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
    <div style="background:#1a1a2e;padding:0 16px 20px;display:flex;gap:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;">
      ${state.levels.map(l=>`
        <button class="level-tab" data-level="${l.name}"
          style="padding:10px 20px;border-radius:24px;border:none;white-space:nowrap;font-family:'Montserrat',sans-serif;font-weight:700;font-size:0.8rem;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color: transparent;
            background:${activeLevel===l.name?'#F5C518':'rgba(255,255,255,0.08)'};
            color:${activeLevel===l.name?'#1a1a2e':'rgba(255,255,255,0.6)'};">
          ${l.name.toLowerCase()}
        </button>`).join('')}
    </div>`
  }

  // ── MAP ──────────────────────────────────────────────────────
  const renderMap = () => {
    if (!state.levels.length) return `<div style="padding:100px 24px;text-align:center;"><p>Cargando mapa...</p></div>`
    const level = state.levels.find(l=>l.name===activeLevel)||state.levels[0]
    const half = Math.ceil(level.slots.length/2)
    return `
    <div style="padding:16px 20px 100px;">
      <div style="display:flex;gap:15px;padding-bottom:12px;justify-content:center;">
        ${[['#fff','#ccc','LIBRE'],['#1a1a2e','#1a1a2e','OCUPADO'],['#e63946','#e63946','DEUDA']].map(([bg,bc,lbl])=>`
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:12px;height:12px;border-radius:3px;background:${bg};border:1.5px solid ${bc};"></div>
            <span style="font-size:0.65rem;font-weight:900;color:#282828;">${lbl}</span>
          </div>`).join('')}
      </div>
      
      <div class="parking-canvas">
        <div class="parking-column">${level.slots.slice(0,half).map((s,i)=>renderSpot(s,level.name,i)).join('')}</div>
        <div class="parking-lane">
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(0deg); opacity:0.1; font-size:3rem; font-weight:900;">↑</div>
        </div>
        <div class="parking-column">${level.slots.slice(half).map((s,i)=>renderSpot(s,level.name,i+half)).join('')}</div>
      </div>
      
      <div class="bottom-bar">
        <button id="btn-show-scanner" class="btn-new-entry">+ NUEVO INGRESO</button>
      </div>
    </div>`
  }

  const renderSpot = (slot, levelName, sIdx) => {
    const occ = slot.status==='OCCUPIED'
    const debt = slot.status==='DEBT'
    const color = getCatColor(slot.category)
    return `
    <div class="spot-2d guard-action ${occ?'occupied':''} ${debt?'debt':''}"
      data-level="${levelName}" data-sidx="${sIdx}"
      style="${occ?`background:${color};border-color:${color};`:''}">
      ${occ?`<div style="font-size:1.1rem;">🚗</div>`:''}
      <span class="spot-label">${slot.label}</span>
    </div>`
  }

  // ── FORMS ────────────────────────────────────────────────────
  const renderEntryForm = () => {
    const slot = selectedSlot
    const frequent = getFrequentVisitors()
    const entryTime = new Date()
    const limitTime = new Date(entryTime.getTime() + 8 * 60 * 60 * 1000)

    const formatFormTime = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()

    return `
    <div style="padding:20px;max-width:420px;margin:0 auto;padding-bottom:100px;">
      <div id="qr-reader" style="margin-bottom:20px;"></div>

      <div style="border-radius:32px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.1);background:white;">
        <div style="background:#1a1a2e;padding:28px 24px 0;position:relative;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
            <div>
              <div style="font-size:0.6rem;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:1px;margin-bottom:4px;">TICKET DE INGRESO</div>
              <div style="font-size:2.2rem;font-weight:900;color:#F5C518;">SLOTY</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;">ASIGNADO A</div>
              <div style="font-size:2.2rem;font-weight:900;color:#22c55e;">${slot.label}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;border-top:1px dashed rgba(255,255,255,0.2);padding:16px 0 0;">
            <div><div style="font-size:0.55rem;color:rgba(255,255,255,0.4);font-weight:800;">INGRESO</div><div style="font-size:0.95rem;font-weight:900;color:white;">${formatFormTime(entryTime)}</div></div>
            <div style="text-align:right;"><div style="font-size:0.55rem;color:rgba(255,255,255,0.4);font-weight:800;">VENCE LÍMITE (8H)</div><div style="font-size:0.95rem;font-weight:900;color:#F97316;">${formatFormTime(limitTime)}</div></div>
          </div>
          <div style="height:20px;margin:12px -24px 0;background:white;border-radius:24px 24px 0 0;"></div>
        </div>

        <div style="background:white;padding:10px 24px 28px;">
          <div style="margin-bottom:20px;">
            <label style="display:block;font-size:0.7rem;font-weight:900;color:#bbb;margin-bottom:8px;">PLACA *</label>
            <input type="text" id="entry-plate" placeholder="ABC-123" maxlength="10"
              style="width:100%;padding:16px;border:2px solid #eee;border-radius:16px;font-family:'Montserrat',sans-serif;font-size:1.6rem;font-weight:900;text-transform:uppercase;text-align:center;outline:none;">
          </div>

          <div style="margin-bottom:20px;">
            <label style="display:block;font-size:0.7rem;font-weight:900;color:#bbb;margin-bottom:8px;">WHATSAPP (Opcional)</label>
            <input type="tel" id="entry-phone" placeholder="04XX..."
              style="width:100%;padding:14px;border:2px solid #eee;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:1.1rem;font-weight:700;outline:none;">
          </div>

          <div style="margin-bottom:24px;">
            <label style="display:block;font-size:0.7rem;font-weight:900;color:#bbb;margin-bottom:10px;">CATEGORÍA</label>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
              ${CAT.map((c,i)=>`
                <button class="cat-chip ${i===0?'cat-active':''}" data-cat="${c.cat}" data-color="${c.color}"
                  style="padding:12px 6px;border-radius:12px;border:2px solid #eee;background:white;color:#bbb;font-family:'Montserrat',sans-serif;font-size:0.7rem;font-weight:900;cursor:pointer;">
                  ${c.label}
                </button>`).join('')}
            </div>
          </div>

          <div style="background:#f8f9fa;border-radius:20px;padding:16px;margin-bottom:24px;border:1px solid #eee;">
            <label style="display:block;font-size:0.7rem;font-weight:900;color:#bbb;margin-bottom:12px;text-align:center;">¿CUÁNDO PAGARÁ?</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <button class="timing-chip timing-active" data-timing="EXIT">AL SALIR</button>
              <button class="timing-chip" data-timing="PRE">PRE-PAGO AHORA ($1)</button>
            </div>
          </div>

          <button id="btn-confirm-entry" class="btn-new-entry" style="background:#1a1a2e; color:#F5C518;">
            ↓ CONFIRMAR INGRESO
          </button>
        </div>
      </div>
    </div>`
  }

  const renderExitForm = () => {
    const slot = selectedSlot
    const timeStr = formatTime(slot.entryTime)
    const warn = getWarning(slot.entryTime)
    return `
    <div style="padding:20px;max-width:420px;margin:0 auto;padding-bottom:100px;">
      <div style="border-radius:32px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.1);background:white;">
        <div style="background:#1a1a2e;padding:28px 24px 0;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
            <div>
              <div style="font-size:0.6rem;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:1px;margin-bottom:4px;">TICKET DE SALIDA</div>
              <div style="font-size:2.2rem;font-weight:900;color:#F5C518;">SLOTY</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;">PUESTO</div>
              <div style="font-size:2.2rem;font-weight:900;color:white;">${slot.label}</div>
            </div>
          </div>
          <div style="height:20px;margin:12px -24px 0;background:white;border-radius:24px 24px 0 0;"></div>
        </div>

        <div style="background:white;padding:10px 24px 28px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:24px;">
            <div><label style="display:block;font-size:0.6rem;font-weight:900;color:#bbb;">PLACA</label><div style="font-size:1.4rem;font-weight:900;color:#1a1a2e;">${slot.plate||'---'}</div></div>
            <div style="text-align:right;"><label style="display:block;font-size:0.6rem;font-weight:900;color:#bbb;">TIEMPO</label><div id="exit-timer" style="font-size:1.4rem;font-weight:900;color:${warn?'#e63946':'#22c55e'};">${timeStr}</div></div>
          </div>

          <div style="margin-bottom:24px;">
            <label style="display:block;font-size:0.7rem;font-weight:900;color:#bbb;margin-bottom:8px;">MÉTODO DE PAGO</label>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
              ${PAY.map((p,i)=>`
                <button class="pay-chip ${i===0?'pay-active':''}" data-method="${p.m}"
                  style="padding:12px 6px;border-radius:12px;border:2px solid #eee;background:white;color:#bbb;font-family:'Montserrat',sans-serif;font-size:0.65rem;font-weight:900;cursor:pointer;">
                  ${p.label}
                </button>`).join('')}
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <button id="btn-exit-paid" style="padding:18px;background:#22c55e;color:white;border:none;border-radius:16px;font-weight:900;cursor:pointer;font-size:0.95rem;">✓ PAGADO</button>
            <button id="btn-exit-debt" style="padding:18px;background:#e63946;color:white;border:none;border-radius:16px;font-weight:900;cursor:pointer;font-size:0.95rem;">✗ DEUDA</button>
          </div>
          
          <button id="btn-print-exit" style="width:100%;margin-top:12px;padding:14px;background:#f0f0f0;color:#666;border:none;border-radius:12px;font-weight:900;cursor:pointer;font-size:0.8rem;">⎘ IMPRIMIR TICKET</button>
        </div>
      </div>
    </div>`
  }

  // ── CORE ─────────────────────────────────────────────────────
  const render = (skipScanner = false) => {
    if (clockInterval) clearInterval(clockInterval)
    state = getParkingState()
    if (!activeLevel && state.levels.length) activeLevel = state.levels[0].name
    
    container.innerHTML = `
    <div style="background:#f0f2f5;min-height:100vh;font-family:'Montserrat',sans-serif;color:#1a1a2e;padding-bottom:20px;">
      ${renderHeader()}
      ${currentView==='MAP' ? renderLevelTabs() : ''}
      <div id="guard-content">
        ${currentView==='MAP'   ? renderMap()       : ''}
        ${currentView==='ENTRY' ? renderEntryForm() : ''}
        ${currentView==='EXIT'  ? renderExitForm()  : ''}
      </div>
      ${currentView!=='MAP' ? `
        <div style="position:fixed;bottom:0;left:0;width:100%;padding:16px;background:white;border-top:1px solid #eee;z-index:200;">
          <button id="btn-back-map" style="width:100%;padding:16px;background:#f8f9fa;border:1px solid #eee;border-radius:16px;font-family:'Montserrat',sans-serif;font-weight:700;color:#999;font-size:0.9rem;cursor:pointer;">
            ← CANCELAR / VOLVER
          </button>
        </div>` : ''}
    </div>`
    
    if (currentView === 'ENTRY' && !skipScanner) initQRScanner()
    setupListeners()
  }

  const setupListeners = () => {
    clockInterval = setInterval(() => {
      const el = document.getElementById('guard-clock')
      if (el) el.textContent = new Date().toLocaleTimeString().toLowerCase()
      const et = document.getElementById('exit-timer')
      if (et && selectedSlot) et.textContent = formatTime(selectedSlot.entryTime)
    }, 1000)

    document.getElementById('btn-guard-logout')?.addEventListener('click', () => { if(confirm('¿Cerrar sesión?')) location.reload() })
    document.querySelectorAll('.level-tab').forEach(b => b.onclick = () => { activeLevel = b.dataset.level; render() })
    
    document.querySelectorAll('.guard-action').forEach(b => {
      b.onclick = () => {
        const level = state.levels.find(l=>l.name===b.dataset.level)
        const sIdx = parseInt(b.dataset.sidx)
        selectedSlot = { ...level.slots[sIdx], levelName: b.dataset.level, sIdx }
        currentView = selectedSlot.status==='FREE' ? 'ENTRY' : 'EXIT'
        render()
      }
    })

    document.getElementById('btn-show-scanner')?.addEventListener('click', () => {
      stopScanner()
      currentView = 'ENTRY'
      // Seleccionar el primer puesto libre si no hay uno seleccionado
      if (!selectedSlot || selectedSlot.status !== 'FREE') {
        const level = state.levels.find(l => l.name === (activeLevel || state.levels[0].name))
        const freeIdx = level.slots.findIndex(s => s.status === 'FREE')
        if (freeIdx !== -1) selectedSlot = { ...level.slots[freeIdx], levelName: level.name, sIdx: freeIdx }
        else { alert("No hay puestos libres en este nivel"); return }
      }
      render()
    })

    const plateEl = document.getElementById('entry-plate')
    if (plateEl) {
      plateEl.addEventListener('input', () => {
        plateEl.value = plateEl.value.toUpperCase()
        const found = findVisitorByPlate(plateEl.value)
        if (found) document.getElementById('entry-phone').value = found.phone||''
      })
    }

    document.querySelectorAll('.cat-chip').forEach(c => {
      const color = c.dataset.color
      if (c.classList.contains('cat-active')) { c.style.background = color; c.style.borderColor = color; c.style.color = 'white' }
      c.onclick = () => {
        document.querySelectorAll('.cat-chip').forEach(x => { x.style.background='white'; x.style.borderColor='#eee'; x.style.color='#bbb'; x.classList.remove('cat-active') })
        c.style.background=color; c.style.borderColor=color; c.style.color='white'; c.classList.add('cat-active')
      }
    })

    document.querySelectorAll('.timing-chip').forEach(c => {
      c.onclick = () => {
        document.querySelectorAll('.timing-chip').forEach(x => x.classList.remove('timing-active'))
        c.classList.add('timing-active')
      }
    })

    document.querySelectorAll('.pay-chip').forEach(c => {
      if (c.classList.contains('pay-active')) { c.style.background = '#1a1a2e'; c.style.borderColor = '#1a1a2e'; c.style.color = '#F5C518' }
      c.onclick = () => {
        document.querySelectorAll('.pay-chip').forEach(x => { x.style.background='white'; x.style.borderColor='#eee'; x.style.color='#bbb'; x.classList.remove('pay-active') })
        c.style.background='#1a1a2e'; c.style.borderColor='#1a1a2e'; c.style.color='#F5C518'; c.classList.add('pay-active')
      }
    })

    document.getElementById('btn-confirm-entry')?.addEventListener('click', () => {
      const plate = document.getElementById('entry-plate')?.value.trim().toUpperCase()
      const phone = document.getElementById('entry-phone')?.value.trim()
      if (!plate) { alert('Ingresa la placa'); return }
      
      const category = document.querySelector('.cat-chip.cat-active')?.dataset.cat || 'VISITANTE'
      const timing = document.querySelector('.timing-chip.timing-active')?.dataset.timing || 'EXIT'
      
      const lvl = state.levels.find(l=>l.name===selectedSlot.levelName)
      lvl.slots[selectedSlot.sIdx] = {
        ...lvl.slots[selectedSlot.sIdx],
        status:'OCCUPIED', category, plate, phone,
        entryTime: new Date().toISOString(), guardName,
        paymentStatus: timing === 'PRE' ? 'PAGADO' : 'PENDIENTE'
      }
      
      updateParkingState(state) // GUARDAR ESTADO PRIMERO
      logMovement({ 
        type:'INGRESO', plate, slot:selectedSlot.label, category, guardName, phone,
        paymentStatus: timing === 'PRE' ? 'PAGADO' : 'PENDIENTE',
        amount: timing === 'PRE' ? 1 : 0
      })
      
      if (confirm('¿Deseas imprimir el ticket de entrada?')) printTicket('INGRESO')
      
      currentView='MAP'; render()
    })

    const processExit = (newStatus) => {
      const payMethod = document.querySelector('.pay-active')?.dataset.method || 'EFECTIVO_USD'
      const lvl = state.levels.find(l=>l.name===selectedSlot.levelName)
      const slotData = lvl.slots[selectedSlot.sIdx]
      
      lvl.slots[selectedSlot.sIdx] = {
        ...slotData, status:newStatus,
        plate: newStatus==='FREE'?null:slotData.plate,
        phone: newStatus==='FREE'?null:slotData.phone,
        entryTime: newStatus==='FREE'?null:slotData.entryTime
      }
      
      updateParkingState(state) // GUARDAR ESTADO PRIMERO
      logMovement({
        type:'SALIDA', plate:slotData.plate, slot:slotData.label,
        category:slotData.category, guardName,
        paymentStatus: newStatus==='FREE'?'PAGADO':'DEUDA',
        payMethod, amount:1
      })
      
      currentView='MAP'; render()
    }

    document.getElementById('btn-exit-paid')?.addEventListener('click', () => processExit('FREE'))
    document.getElementById('btn-exit-debt')?.addEventListener('click', () => processExit('DEBT'))
    document.getElementById('btn-print-exit')?.addEventListener('click', () => printTicket('SALIDA'))
    document.getElementById('btn-back-map')?.addEventListener('click', () => { stopScanner(); currentView='MAP'; render() })
  }

  render()
}
