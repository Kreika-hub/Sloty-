import { getParkingState, updateParkingState, logMovement } from '../db.js'

export const initGuard = (container, guardName = 'Guardia') => {
  let state = getParkingState()
  let selectedSlot = null
  let currentView = 'MAP'
  let activeLevel = null
  let qrScanner = null
  
  // --- DOM Elements Cache ---
  let elContent = null
  let elShell = null

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

  // ── SCANNER LOGIC ──────────────────────────────────────────
  const stopScanner = async () => {
    if (qrScanner) {
      try { await qrScanner.clear(); qrScanner = null } catch (e) {}
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
          if (data.plate && data.slot) {
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
        } catch (e) {}
      })
    }, 100)
  }

  // ── PRINT LOGIC ─────────────────────────────────────────────
  const printTicket = (type = 'INGRESO') => {
    const slot = selectedSlot
    const win = window.open('', '_blank', 'width=400,height=600')
    win.document.write('<html><head><title>Ticket Sloty</title><style>body{font-family:sans-serif;text-align:center;padding:10px;} .qr{margin:20px 0;} .label{font-size:32px;font-weight:bold;}</style><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></scr' + 'ipt></head><body>')
    win.document.write('<h2>'+state.buildingName+'</h2><p>TICKET DE '+type+'</p><div class="label">'+slot.label+'</div><p>PLACA: '+(slot.plate||'---')+'</p><div id="qrcode" class="qr"></div><p>'+new Date().toLocaleString()+'</p><p>¡Gracias por usar Sloty!</p>')
    win.document.write('<script>setTimeout(function(){new QRCode(document.getElementById("qrcode"),{text:JSON.stringify({plate:"'+slot.plate+'",slot:"'+slot.label+'"}),width:180,height:180});setTimeout(function(){window.print();window.close();},500);},500);</script></body></html>')
    win.document.close()
  }

  // ── ACTIONS ──────────────────────────────────────────────────
  const actions = {
    TAB_LEVEL: (btn) => { activeLevel = btn.dataset.level; render() },
    OPEN_SLOT: (btn) => {
      const level = state.levels.find(l=>l.name===btn.dataset.level)
      const sIdx = parseInt(btn.dataset.sidx)
      selectedSlot = { ...level.slots[sIdx], levelName: btn.dataset.level, sIdx }
      currentView = selectedSlot.status==='FREE' ? 'ENTRY' : 'EXIT'
      render()
    },
    BACK_MAP: () => { stopScanner(); currentView = 'MAP'; render() },
    LOGOUT: () => { if(confirm('¿Cerrar sesión?')) location.reload() },
    SHOW_SCANNER: () => {
      stopScanner(); currentView = 'ENTRY'
      if (!selectedSlot || selectedSlot.status !== 'FREE') {
        const level = state.levels.find(l => l.name === (activeLevel || state.levels[0].name))
        const freeIdx = level.slots.findIndex(s => s.status === 'FREE')
        if (freeIdx !== -1) selectedSlot = { ...level.slots[freeIdx], levelName: level.name, sIdx: freeIdx }
        else return alert("No hay puestos libres")
      }
      render()
    },
    CONFIRM_ENTRY: () => {
      const plate = document.getElementById('entry-plate')?.value.trim().toUpperCase()
      const phone = document.getElementById('entry-phone')?.value.trim()
      if (!plate) return alert('Ingresa la placa')

      // COLLECT CUSTOM FIELDS
      const metadata = {}
      let missingField = null
      state.settings.customFields.forEach(f => {
        const val = document.getElementById(`custom-${f.id}`)?.value.trim()
        if (!val) missingField = f.label
        metadata[f.id] = val
      })
      if (missingField) return alert(`El campo ${missingField} es obligatorio`)

      const category = document.querySelector('.cat-active')?.dataset.cat || 'VISITANTE'
      const timing = document.querySelector('.timing-active')?.dataset.timing || 'EXIT'
      const payMethod = timing === 'PRE' ? (document.querySelector('#prepay-selector .pay-active')?.dataset.method || 'EFECTIVO_USD') : null
      
      const lvl = state.levels.find(l=>l.name===selectedSlot.levelName)
      const entryData = { 
        ...lvl.slots[selectedSlot.sIdx], 
        status:'OCCUPIED', 
        category, 
        plate, 
        phone, 
        metadata,
        entryTime: new Date().toISOString(), 
        guardName, 
        paymentStatus: timing === 'PRE' ? 'PAGADO' : 'PENDIENTE',
        payMethod
      }
      
      lvl.slots[selectedSlot.sIdx] = entryData
      updateParkingState(state)
      
      logMovement({ 
        type:'INGRESO', 
        plate, 
        slot:selectedSlot.label, 
        category, 
        guardName, 
        phone, 
        metadata,
        paymentStatus: timing === 'PRE' ? 'PAGADO' : 'PENDIENTE', 
        payMethod,
        amount: timing === 'PRE' ? (state.settings?.baseRate || 1) : 0 
      })
      
      if (confirm('¿Deseas imprimir ticket?')) printTicket('INGRESO')
      currentView='MAP'; render()
    },
    EXIT_PAID: () => processExit('FREE'),
    EXIT_DEBT: () => processExit('DEBT'),
    PRINT_TICKET: () => printTicket('SALIDA')
  }

  const processExit = (newStatus) => {
    const payMethod = document.querySelector('.pay-active')?.dataset.method || 'EFECTIVO_USD'
    const lvl = state.levels.find(l=>l.name===selectedSlot.levelName)
    const slotData = lvl.slots[selectedSlot.sIdx]
    lvl.slots[selectedSlot.sIdx] = { ...slotData, status:newStatus, plate: newStatus==='FREE'?null:slotData.plate, phone: newStatus==='FREE'?null:slotData.phone, entryTime: newStatus==='FREE'?null:slotData.entryTime }
    updateParkingState(state); logMovement({ type:'SALIDA', plate:slotData.plate, slot:slotData.label, category:slotData.category, guardName, paymentStatus: newStatus==='FREE'?'PAGADO':'DEUDA', payMethod, amount:1 })
    currentView='MAP'; render()
  }

  // ── RENDER COMPONENTS ────────────────────────────────────────
  const renderHeader = (state) => {
    const occ = state.levels.reduce((a,l)=>a+l.slots.filter(s=>s.status==='OCCUPIED'||s.status==='DEBT').length,0)
    const total = state.levels.reduce((a,l)=>a+l.slots.length,0)
    const debts = state.levels.reduce((a,l)=>a+l.slots.filter(s=>s.status==='DEBT').length,0)
    return `
    <div style="background:#1a1a2e;padding:24px 24px 16px;color:white;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <div style="font-size:0.6rem;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:2px;">GARITA ACTIVA</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:4px;">
            <div style="font-size:1.2rem;font-weight:900;">${guardName}</div>
            <button data-action="LOGOUT" style="background:#F5C518;color:#1a1a2e;border:none;padding:5px 12px;border-radius:8px;font-size:0.65rem;font-weight:900;cursor:pointer;">SALIR</button>
          </div>
          <div id="guard-clock" style="font-size:0.85rem;color:#F5C518;font-weight:700;margin-top:4px;">${new Date().toLocaleTimeString().toLowerCase()}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;">DISPONIBLES</div>
          <div id="header-disp" style="font-size:2.8rem;font-weight:900;color:#F5C518;line-height:0.9;">${total-occ}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:12px;text-align:center;">
          <div id="stat-free" style="font-size:1.6rem;font-weight:900;">${total-occ}</div><div style="font-size:0.55rem;color:rgba(255,255,255,0.5);font-weight:700;">LIBRES</div>
        </div>
        <div style="background:rgba(245,197,24,0.1);border:1.5px solid rgba(245,197,24,0.3);border-radius:12px;padding:12px;text-align:center;">
          <div id="stat-occ" style="font-size:1.6rem;font-weight:900;color:#F5C518;">${occ}</div><div style="font-size:0.55rem;color:rgba(245,197,24,0.8);font-weight:700;">OCUPADOS</div>
        </div>
        <div style="background:rgba(230,57,70,0.1);border:1px solid rgba(230,57,70,0.2);border-radius:12px;padding:12px;text-align:center;">
          <div id="stat-debt" style="font-size:1.6rem;font-weight:900;color:#e63946;">${debts}</div><div style="font-size:0.55rem;color:rgba(230,57,70,0.8);font-weight:700;">DEUDAS</div>
        </div>
      </div>
    </div>`
  }

  const renderMap = (state) => {
    const level = state.levels.find(l=>l.name===activeLevel)||state.levels[0]
    if (!level) return ''
    const half = Math.ceil(level.slots.length/2)
    return `
    <div style="background:#1a1a2e;padding:0 16px 20px;display:flex;gap:12px;overflow-x:auto;">
      ${state.levels.map(l=>`<button data-action="TAB_LEVEL" data-level="${l.name}" style="padding:10px 20px;border-radius:24px;border:none;font-weight:700;font-size:0.8rem;background:${activeLevel===l.name?'#F5C518':'rgba(255,255,255,0.08)'};color:${activeLevel===l.name?'#1a1a2e':'white'};">${l.name}</button>`).join('')}
    </div>
    <div style="padding:16px 20px 100px;">
      <div class="parking-canvas">
        <div class="parking-column">${level.slots.slice(0,half).map((s,i)=>renderSpot(s,level.name,i)).join('')}</div>
        <div class="parking-lane"><div style="opacity:0.1; font-size:3rem;">↑</div></div>
        <div class="parking-column">${level.slots.slice(half).map((s,i)=>renderSpot(s,level.name,i+half)).join('')}</div>
      </div>
      <div class="bottom-bar"><button data-action="SHOW_SCANNER" class="btn-new-entry">+ NUEVO INGRESO</button></div>
    </div>`
  }

  const renderSpot = (slot, levelName, sIdx) => {
    const occ = slot.status==='OCCUPIED', debt = slot.status==='DEBT', color = getCatColor(slot.category)
    return `<div class="spot-2d ${occ?'occupied':''} ${debt?'debt':''}" data-action="OPEN_SLOT" data-level="${levelName}" data-sidx="${sIdx}" style="${occ?`background:${color};border-color:${color};`:''}">
      ${occ?`<div style="font-size:1.1rem;">🚗</div>`:''}<span class="spot-label">${slot.label}</span></div>`
  }

  const renderEntryForm = () => `
    <div style="padding:20px;padding-bottom:100px;">
      <div id="qr-reader" style="margin-bottom:20px;border-radius:20px;overflow:hidden;"></div>
      <div style="background:white;border-radius:32px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,0.05);">
        <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
          <h2 style="font-weight:900;color:var(--primary);">INGRESO</h2>
          <div style="font-size:1.8rem;font-weight:900;color:#22c55e;">${selectedSlot.label}</div>
        </div>
        <input type="text" id="entry-plate" placeholder="PLACA" style="width:100%;padding:18px;border:2px solid #eee;border-radius:16px;font-size:1.8rem;font-weight:900;text-align:center;margin-bottom:15px;">
        <input type="tel" id="entry-phone" placeholder="WHATSAPP (Opcional)" style="width:100%;padding:14px;border:2px solid #eee;border-radius:14px;margin-bottom:15px;">
        
        <!-- DYNAMIC CUSTOM FIELDS -->
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
          ${(state.settings?.customFields || []).map(f => `
            <div>
              <label style="font-size:0.6rem; font-weight:900; color:#999; margin-left:12px; text-transform:uppercase;">${f.label} *</label>
              <input type="text" id="custom-${f.id}" placeholder="Ingresar ${f.label.toLowerCase()}" required
                style="width:100%; padding:14px; border:2px solid #eee; border-radius:14px; font-weight:700;">
            </div>
          `).join('')}
        </div>

        <div style="grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px; display: ${state.settings?.categories?.length ? 'grid' : 'none'};">
          ${(state.settings?.categories || CAT).map((c,i)=>`<button class="cat-chip ${i===0?'cat-active':''}" data-cat="${c.id || c.cat}" data-color="${c.color}" style="padding:10px;border-radius:10px;border:2px solid #eee;background:white;font-size:0.7rem;font-weight:900;">${c.label}</button>`).join('')}
        </div>
        
        <div style="background:#f8f9fa;padding:15px;border-radius:16px;margin-bottom:20px;text-align:center;">
          <div style="font-size:0.6rem;font-weight:900;color:#999;margin-bottom:10px;">¿CUÁNDO PAGARÁ?</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px; margin-bottom:12px;">
            <button class="timing-chip timing-active" data-timing="EXIT" style="padding:12px;border-radius:10px;border:none;font-weight:900;">AL SALIR</button>
            <button class="timing-chip" data-timing="PRE" style="padding:12px;border-radius:10px;border:none;font-weight:900;">PRE-PAGO ($${state.settings?.baseRate || 1})</button>
          </div>
          
          <div id="prepay-selector" style="display:none; transition: all 0.3s;">
             <div style="font-size:0.55rem; font-weight:900; color:#bbb; margin:10px 0 8px;">MÉTODO DE PAGO</div>
             <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                ${PAY.map((p,i) => `<button class="pay-chip ${i===0?'pay-active':''}" data-method="${p.m}" style="padding:8px; border-radius:8px; border:1px solid #eee; background:white; font-size:0.55rem; font-weight:900;">${p.label}</button>`).join('')}
             </div>
          </div>
        </div>
        <button data-action="CONFIRM_ENTRY" class="btn-new-entry" style="background:#1a1a2e;color:#F5C518;box-shadow: 0 10px 20px rgba(26,26,46,0.2);">↓ CONFIRMAR INGRESO</button>
      </div>
    </div>`

  const renderExitForm = () => `
    <div style="padding:20px;padding-bottom:100px;">
      <div style="background:white;border-radius:32px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,0.05);">
        <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
          <h2 style="font-weight:900;color:var(--primary);">SALIDA</h2>
          <div style="font-size:1.8rem;font-weight:900;color:#1a1a2e;">${selectedSlot.label}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;">
          <div><label style="font-size:0.6rem;font-weight:900;color:#999;">PLACA</label><div style="font-size:1.4rem;font-weight:900;">${selectedSlot.plate||'---'}</div></div>
          <div style="text-align:right;"><label style="font-size:0.6rem;font-weight:900;color:#999;">TIEMPO</label><div id="exit-timer" style="font-size:1.4rem;font-weight:900;color:#22c55e;">${formatTime(selectedSlot.entryTime)}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:25px;">
          ${PAY.map((p,i)=>`<button class="pay-chip ${i===0?'pay-active':''}" data-method="${p.m}" style="padding:10px;border-radius:10px;border:2px solid #eee;background:white;font-size:0.65rem;font-weight:900;">${p.label}</button>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button data-action="EXIT_PAID" style="padding:18px;background:#22c55e;color:white;border:none;border-radius:16px;font-weight:900;">PAGADO</button>
          <button data-action="EXIT_DEBT" style="padding:18px;background:#e63946;color:white;border:none;border-radius:16px;font-weight:900;">DEUDA</button>
        </div>
      </div>
    </div>`

  // ── CORE LOGIC ───────────────────────────────────────────────
  const renderShell = (state) => {
    container.innerHTML = `
      <div id="guard-shell" style="background:#f0f2f5;min-height:100vh;font-family:'Montserrat',sans-serif;color:#1a1a2e;">
        <div id="guard-header-area"></div>
        <div id="guard-content-area"></div>
        <div id="guard-footer-area"></div>
      </div>`
    elShell = container.querySelector('#guard-header-area')
    elContent = container.querySelector('#guard-content-area')
  }

  const render = () => {
    const freshState = getParkingState()
    if (!elShell) renderShell(freshState)
    elShell.innerHTML = renderHeader(freshState)
    
    let html = ''
    if (currentView === 'MAP') html = renderMap(freshState)
    else if (currentView === 'ENTRY') html = renderEntryForm()
    else if (currentView === 'EXIT') html = renderExitForm()
    
    if (elContent.innerHTML !== html) {
      elContent.innerHTML = html
      if (currentView === 'ENTRY') initQRScanner()
      setupLocalInteractions()
    }
    
    const footer = container.querySelector('#guard-footer-area')
    footer.innerHTML = currentView !== 'MAP' ? `
      <div style="position:fixed;bottom:0;left:0;width:100%;padding:16px;background:white;border-top:1px solid #eee;z-index:200;">
        <button data-action="BACK_MAP" style="width:100%;padding:16px;background:#f8f9fa;border:none;border-radius:16px;font-weight:700;color:#999;">← VOLVER AL MAPA</button>
      </div>` : ''
  }

  const setupLocalInteractions = () => {
    const plateEl = document.getElementById('entry-plate')
    if (plateEl) {
      plateEl.oninput = () => {
        plateEl.value = plateEl.value.toUpperCase()
        const found = findVisitorByPlate(plateEl.value)
        if (found && !document.getElementById('entry-phone').value) document.getElementById('entry-phone').value = found.phone||''
      }
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
        document.querySelectorAll('.timing-chip').forEach(x => { x.style.background='#f0f0f0'; x.style.color='#999'; x.classList.remove('timing-active') })
        c.style.background='#1a1a2e'; c.style.color='#F5C518'; c.classList.add('timing-active')
        
        const prepayEl = document.getElementById('prepay-selector')
        if (prepayEl) prepayEl.style.display = c.dataset.timing === 'PRE' ? 'block' : 'none'
      }
    })
    document.querySelectorAll('.pay-chip').forEach(c => {
      if (c.classList.contains('pay-active')) { c.style.background = '#1a1a2e'; c.style.borderColor = '#1a1a2e'; c.style.color = '#F5C518' }
      c.onclick = () => {
        document.querySelectorAll('.pay-chip').forEach(x => { x.style.background='white'; x.style.borderColor='#eee'; x.style.color='#bbb'; x.classList.remove('pay-active') })
        c.style.background='#1a1a2e'; c.style.borderColor='#1a1a2e'; c.style.color='#F5C518'; c.classList.add('pay-active')
      }
    })
  }

  container.onclick = (e) => {
    const btn = e.target.closest('[data-action]')
    if (btn && actions[btn.dataset.action]) actions[btn.dataset.action](btn)
  }

  let syncInt = setInterval(() => {
    state = getParkingState()
    const clock = document.getElementById('guard-clock')
    if (clock) clock.textContent = new Date().toLocaleTimeString().toLowerCase()
    const et = document.getElementById('exit-timer')
    if (et && selectedSlot) et.textContent = formatTime(selectedSlot.entryTime)
    // Update Disp/Stats in header without wiping everything
    const occ = state.levels.reduce((a,l)=>a+l.slots.filter(s=>s.status==='OCCUPIED'||s.status==='DEBT').length,0)
    const total = state.levels.reduce((a,l)=>a+l.slots.length,0)
    const debts = state.levels.reduce((a,l)=>a+l.slots.filter(s=>s.status==='DEBT').length,0)
    if (document.getElementById('header-disp')) document.getElementById('header-disp').textContent = total-occ
    if (document.getElementById('stat-free')) document.getElementById('stat-free').textContent = total-occ
    if (document.getElementById('stat-occ')) document.getElementById('stat-occ').textContent = occ
    if (document.getElementById('stat-debt')) document.getElementById('stat-debt').textContent = debts
  }, 1000)

  if (state.levels.length) activeLevel = state.levels[0].name
  render()
}
