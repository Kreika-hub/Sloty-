import { getParkingState, updateParkingState, logMovement, logNotification, saveClosure, supabase } from '../db.js'
import { searchVisitorByPlate, saveVisitor, logAccess } from '../visitors.js'
// Html5Qrcode is loaded via CDN in index.html, accessible globally

export const initGuard = (container, guardName = 'Guardia') => {
  let state = getParkingState()
  let selectedSlot = null
  let currentView = 'MAP'
  let activeLevel = null
  let currentTab = 'HOME'
  let qrScanner = null
  let scannerActive = false
  let pendingPayment = null // { amount, method, type, slot, plate, category, metadata, phone, entryData }
  let cachedResidents = []
  let subPaymentAmount = 0
  let subPaymentMethod = 'EFECTIVO_USD'
  let selectedResident = null
  let elModal = null
  let elToast = null
  let elShell = null
  let elContent = null

  const showNativePush = (title, msg, icon = '🛡️') => {
    const push = document.createElement('div')
    push.style = `position:fixed; top:20px; left:20px; right:20px; background:rgba(255,255,255,0.95); backdrop-filter:blur(20px); padding:15px; border-radius:22px; display:flex; gap:12px; align-items:center; z-index:10001; box-shadow:0 15px 40px rgba(0,0,0,0.15); border:1px solid #eee; transform:translateY(-150%); transition:transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);`
    push.innerHTML = `
      <div style="width:45px; height:45px; background:var(--primary); border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">${icon}</div>
      <div style="flex:1;">
        <div style="font-weight:900; color:var(--primary); font-size:0.85rem; letter-spacing:0.3px;">${title}</div>
        <div style="font-size:0.75rem; color:#666; font-weight:700;">${msg}</div>
      </div>
    `
    container.appendChild(push)
    setTimeout(() => { push.style.transform = 'translateY(0)' }, 100)
    setTimeout(() => { push.style.transform = 'translateY(-150%)'; setTimeout(() => push.remove(), 600) }, 5000)
  }

  // Welcome Notification
  setTimeout(() => {
    showNativePush('¡HOLA, ' + guardName.toUpperCase() + '!', 'Tu turno ha iniciado correctamente. Que tengas una excelente guardia.', '👋')
  }, 1000)

  const showToast = (msg, type = 'info') => {
    if (!elToast) {
      elToast = document.createElement('div')
      elToast.style = "position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 24px;border-radius:12px;font-weight:700;font-size:0.8rem;transition:all 0.3s;box-shadow:0 10px 20px rgba(0,0,0,0.1);display:none;"
      container.appendChild(elToast)
    }
    elToast.textContent = msg
    elToast.style.background = type === 'error' ? '#e63946' : (type === 'success' ? '#22c55e' : '#1a1a2e')
    elToast.style.color = 'white'
    elToast.style.display = 'block'
    setTimeout(() => { elToast.style.display = 'none' }, 3000)
  }

  const showModal = (title, msg, onConfirm) => {
    if (!elModal) {
      elModal = document.createElement('div')
      elModal.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(5px);z-index:9998;display:none;align-items:center;justify-content:center;padding:20px;"
      container.appendChild(elModal)
    }
    elModal.innerHTML = `
      <div style="background:white;border-radius:24px;padding:24px;width:100%;max-width:320px;text-align:center;">
        <div style="font-weight:900;font-size:1.2rem;margin-bottom:10px;color:#1a1a2e;">${title}</div>
        <div style="font-size:0.85rem;color:#666;margin-bottom:24px;">${msg}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
           <button id="modal-cancel" style="padding:14px;border:none;border-radius:12px;background:#f0f2f5;font-weight:700;color:#999;">CANCELAR</button>
           <button id="modal-ok" style="padding:14px;border:none;border-radius:12px;background:#1a1a2e;font-weight:700;color:#F5C518;">CONFIRMAR</button>
        </div>
      </div>`
    elModal.style.display = 'flex'
    elModal.querySelector('#modal-cancel').onclick = () => { elModal.style.display = 'none' }
    elModal.querySelector('#modal-ok').onclick = () => { elModal.style.display = 'none'; onConfirm() }
  }

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

  const findVisitorByPlate = async (plate) => {
    if (!plate || plate.length < 2) return null
    const results = await searchVisitorByPlate(plate)
    return results?.[0] || null
  }

  // ── SCANNER LOGIC ──────────────────────────────────────────
  const stopScanner = async () => {
    if (qrScanner) {
      try { 
        await qrScanner.stop(); 
        document.getElementById('qr-reader').innerHTML = '';
        qrScanner = null 
      } catch (e) {}
    }
  }

  const initQRScanner = () => {
    setTimeout(async () => {
      const el = document.getElementById('qr-reader')
      if (!el || qrScanner) return
      
      qrScanner = new window.Html5Qrcode("qr-reader")
      try {
        await qrScanner.start(
          { facingMode: "environment" }, 
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => {
            try {
              const data = JSON.parse(text)
              if (data.plate && data.slot) {
                stopScanner()
                state.levels.forEach(lvl => {
                  const sIdx = lvl.slots.findIndex(s => s.label === data.slot)
                  if (sIdx !== -1) {
                    selectedSlot = { ...lvl.slots[sIdx], levelName: lvl.name, sIdx }
                    if (selectedSlot.status === 'FREE') {
                       showToast("Este puesto está vacío", "error")
                    } else {
                       currentView = 'EXIT'
                       scannerActive = false
                       render()
                    }
                  }
                })
              }
            } catch (e) { showToast("QR no reconocido", "error") }
          }
        )
      } catch (err) {
        showToast("Error al abrir cámara", "error")
        scannerActive = false
        render()
      }
    }, 100)
  }

  // ── PRINT LOGIC ─────────────────────────────────────────────
  const printTicket = (type = 'INGRESO') => {
    const slot = selectedSlot
    const win = window.open('', '_blank', 'width=400,height=600')
    win.document.write('<html><head><title>Ticket Sloty</title><style>body{font-family:sans-serif;text-align:center;padding:10px;} .qr{margin:20px 0;} .label{font-size:32px;font-weight:bold;}</style><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></scr' + 'ipt></head><body>')
    win.document.write('<h2>'+state.buildingName+'</h2><p>TICKET DE '+type+'</p><div class="label">'+slot.label+'</div><p>PLACA: '+(slot.plate||'---')+'</p><div id="qrcode" class="qr"></div><p>'+new Date().toLocaleString()+'</p><p>¡Gracias por usar Sloty!</p>')
    win.document.write('<script>setTimeout(function(){new QRCode(document.getElementById("qrcode"),{text:JSON.stringify({plate:"'+slot.plate+'",slot:"'+slot.label+'"}),width:180,height:180});setTimeout(function(){window.print();window.close();},500);},500);<\/script></body></html>')
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
    BACK_MAP: () => { stopScanner(); currentView = 'MAP'; currentTab = 'HOME'; scannerActive = false; render() },
    SWITCH_TAB: (btn) => { 
       currentTab = btn.dataset.tab; 
       if (currentTab === 'PAY') actions.SHOW_SUB_PAYMENT();
       else if (currentTab === 'STATS') { currentView = 'CLOSURE'; render(); }
       else { currentView = 'MAP'; render(); }
    },
    FAST_EXIT_SEARCH: () => {
       const plate = document.getElementById('fast-exit-plate')?.value.trim().toUpperCase()
       if (!plate) return showToast("Ingresa una placa", "error")
       
       let foundSlot = null
       state.levels.forEach(lvl => {
          const sIdx = lvl.slots.findIndex(s => s.plate && s.plate.toUpperCase().includes(plate))
          if (sIdx !== -1) foundSlot = { ...lvl.slots[sIdx], levelName: lvl.name, sIdx }
       })
       if (!foundSlot) return showToast("Vehículo no encontrado", "error")
       
       if (foundSlot.status === 'FREE') return showToast("Puesto vacío", "error")
       selectedSlot = foundSlot
       currentView = 'EXIT'
       render()
    },
    LOGOUT: () => { showModal('¿Cerrar sesión?', 'Tu progreso se guardará automáticamente.', () => location.reload()) },
    SHOW_SCANNER: () => {
      stopScanner(); scannerActive = true; render()
    },
    SHOW_SUB_PAYMENT: async () => {
      currentView = 'SUB_PAYMENT_LOADING'; render()
      const buildingId = state.buildingId || localStorage.getItem('sloty_building_id')
      if (!buildingId) { showToast('Edificio no identificado', 'error'); return }
      
      const [ { data: subs }, { data: pays } ] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('building_id', buildingId),
        supabase.from('payments').select('*').eq('building_id', buildingId).eq('status', 'PENDING')
      ])
      
      cachedResidents = subs || []
      // We'll store pending payments count or list in a local variable if needed, 
      // or just join them in cachedResidents
      cachedResidents.forEach(r => {
        r.hasPending = (pays || []).some(p => p.subscription_id === r.id)
      })

      currentView = 'SUB_PAYMENT'; render()
    },
    SEARCH_RESIDENT: () => { render() },
    SELECT_RESIDENT_PAY: (btn) => {
      const id = btn.dataset.id
      selectedResident = cachedResidents.find(r => r.id === id)
      subPaymentAmount = selectedResident.custom_price || 0
      subPaymentMethod = 'EFECTIVO'
      currentView = 'SUB_PAYMENT_FORM'; render()
      
      // Setup dynamic form fields
      setTimeout(() => {
        const sel = document.getElementById('sub-pay-method-select')
        const bankC = document.getElementById('sub-pay-bank-container')
        const refC = document.getElementById('sub-pay-ref-container')
        if (sel) {
          sel.onchange = () => {
            const isDig = ['PAGO_MOVIL', 'TRANSFERENCIA'].includes(sel.value)
            bankC.style.display = isDig ? 'block' : 'none'
            refC.style.display = isDig ? 'block' : 'none'
          }
        }
      }, 50)
    },
    SET_SUB_METHOD: (btn) => {
      subPaymentMethod = btn.dataset.method; render()
    },
    SUBMIT_SUB_PAYMENT: async () => {
      const amount = parseFloat(document.getElementById('sub-pay-amount').value) || 0
      const ref = document.getElementById('sub-pay-ref')?.value?.trim() || ''
      const bank = document.getElementById('sub-pay-bank')?.value || ''
      const date = document.getElementById('sub-pay-date')?.value || new Date().toISOString().split('T')[0]
      const method = document.getElementById('sub-pay-method-select').value

      if (['PAGO_MOVIL', 'TRANSFERENCIA'].includes(method) && !ref) return showToast('Introduce la referencia', 'error')

      // Registramos el pago como PENDIENTE para aprobación de admin
      await supabase.from('payments').insert({
         building_id: state.buildingId || localStorage.getItem('sloty_building_id'),
         subscription_id: selectedResident.id,
         amount: amount,
         method: method,
         reference: ref,
         status: 'PENDING',
         payment_date: date,
         bank: bank
      })

      // IMPORTANTE: NO actualizamos expiry_date aquí. Eso lo hace el admin al aprobar.

      logMovement({
         type: 'MENSUALIDAD',
         plate: selectedResident.plate.split(',')[0],
         slot: 'MENSUAL',
         category: 'RESIDENTE',
         guardName,
         amount: amount,
         payMethod: method,
         reference: ref,
         paymentStatus: 'PENDIENTE',
         metadata: { bank, date }
      })

      showToast('Pago registrado. Pendiente de aprobación por administración.', 'success')
      currentView = 'MAP'; render()
    },
    SHOW_MANUAL_ENTRY: () => {
       const level = state.levels.find(l => l.name === (activeLevel || state.levels[0].name))
       const freeIdx = level.slots.findIndex(s => s.status === 'FREE')
       if (freeIdx !== -1) {
          selectedSlot = { ...level.slots[freeIdx], levelName: level.name, sIdx: freeIdx }
          currentView = 'ENTRY'
          render()
       } else showToast("No hay puestos libres", "error")
    },
    CONFIRM_ENTRY: () => {
      const plate = document.getElementById('entry-plate')?.value.trim().toUpperCase()
      const phone = document.getElementById('entry-phone')?.value.trim()
      if (!plate) return showToast('Ingresa la placa', 'error')

      // COLLECT CUSTOM FIELDS
      const metadata = {}
      let missingField = null
      state.settings.customFields.forEach(f => {
        const val = document.getElementById(`custom-${f.id}`)?.value.trim()
        if (!val) missingField = f.label
        metadata[f.id] = val
      })
      if (missingField) return showToast(`Falta el campo ${missingField}`, 'error')

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
      selectedSlot = { ...entryData, levelName: selectedSlot.levelName, sIdx: selectedSlot.sIdx }
      updateParkingState(state)

      // Guardar visitante en Supabase y registrar acceso
      const visitorName = metadata?.nombre || plate
      saveVisitor({
        full_name: visitorName,
        phone: phone || '',
        visits_to: metadata?.apto ? `Apto ${metadata.apto}` : '',
        notes: '',
        plate,
        vehicle_desc: ''
      }).then(visitor_id => {
        logAccess({
          visitor_id,
          guard_name: guardName,
          full_name: visitorName,
          plate,
          visits_to: metadata?.apto ? `Apto ${metadata.apto}` : '',
          type: 'entry'
        })
      })
      
      if (timing === 'PRE') {
         const activeTariffs = state.settings?.tariffs?.filter(t => t.active) || [];
         const amountToCharge = activeTariffs.length > 0 ? activeTariffs[0].baseRate : (state.settings?.baseRate || 1);
         
         pendingPayment = { 
           type:'PREPAGO', 
           plate, 
           slot:selectedSlot.label, 
           category, 
           guardName, 
           phone, 
           metadata,
           amount: amountToCharge,
           method: payMethod,
           entryData: entryData // Save to update slot after payment
         }
         currentView = 'PAYMENT'; render()
      } else {
         currentView='TICKET'; render()
      }
    },
    PRINT_TICKET: () => {
       const area = document.getElementById('ticket-printable')
       if (!area) return
       const win = window.open('', '_blank', 'width=400,height=600')
       win.document.write(`<html><head><title>Ticket Sloty</title><style>body{font-family:sans-serif;margin:0;padding:20px;text-align:center;} .card{border:2px solid #eee;border-radius:20px;padding:20px;}</style></head><body><div class="card">${area.innerHTML}</div><script>setTimeout(()=> {window.print(); window.close();}, 500)<\/script></body></html>`)
       win.document.close()
    },
    EXIT_PAID: () => {
      const entryTime = new Date(selectedSlot.entryTime)
      const hoursStayed = (new Date() - entryTime) / 3600000
      
      let totalOwed = 0;
      const activeTariffs = state.settings?.tariffs?.filter(t => t.active) || [];
      
      if (activeTariffs.length > 0) {
         for (let t of activeTariffs) {
             if (hoursStayed > t.freeHours || selectedSlot.status === 'DEBT') {
                 totalOwed = Math.max(totalOwed, t.baseRate);
             }
         }
      } else {
         const freeHours = state.settings?.freeHours || 8
         totalOwed = (hoursStayed > freeHours || selectedSlot.status === 'DEBT') ? (state.settings?.baseRate || 1) : 0
      }
      
      if (selectedSlot.paymentStatus === 'PAGADO') totalOwed = 0; // Si ya pre-pagó, no debe nada.

      if (totalOwed > 0) {
        pendingPayment = {
          type: 'SALIDA',
          plate: selectedSlot.plate,
          slot: selectedSlot.label,
          category: selectedSlot.category,
          guardName,
          amount: totalOwed,
          method: document.querySelector('.pay-active')?.dataset.method || 'EFECTIVO_USD',
          targetStatus: 'FREE'
        }
        currentView = 'PAYMENT'; render()
      } else {
        processExit('FREE')
      }
    },
    EXIT_DEBT: () => processExit('DEBT'),
    FORMA_PRINT: () => printTicket('SALIDA'),
    CIERRE_CAJA: () => {
      currentView = 'CLOSURE'; render()
    },
    SUBMIT_PAYMENT: () => {
      const amountRec = parseFloat(document.getElementById('pay-amount')?.value) || 0
      const ref = document.getElementById('pay-ref')?.value?.trim() || ''
      const method = pendingPayment.method
      
      if (method === 'PAGO_MOVIL' && !ref) return showToast('Introduce la referencia', 'error')
      if (amountRec < pendingPayment.amount) return showToast('Monto insuficiente', 'error')

      const mov = {
        ...pendingPayment,
        amountRec,
        reference: ref,
        paymentStatus: 'PAGADO',
        payMethod: method
      }
      
      logMovement(mov)
      
      if (pendingPayment.type === 'SALIDA') {
        processExit(pendingPayment.targetStatus)
      } else {
        // PREPAGO case: finalizing the entry
        currentView = 'TICKET'; render()
      }
      pendingPayment = null
      showToast('Pago registrado correctamente', 'success')
    },
    FINALIZE_CLOSURE: () => {
      const openMovs = state.movements.filter(m => !m.closed && m.guardName === guardName)
      const total = openMovs.reduce((a,m) => a + (m.amount || 0), 0)
      const breakdown = openMovs.reduce((acc, m) => {
        acc[m.payMethod] = (acc[m.payMethod] || 0) + (m.amount || 0)
        return acc
      }, {})

      saveClosure({
        guard: guardName,
        total,
        methods: breakdown,
        movements: openMovs
      })

      logNotification('CIERRE_CAJA', guardName, `Cierre completado: $${total.toFixed(2)} acumulados.`)
      showModal('Cierre Exitoso', 'El reporte ha sido enviado a administración. El contador ha vuelto a 0.', () => location.reload())
    },
    ACCEPT_RESERVATION: async (btn) => {
      const subId = btn.dataset.subId;
      const plate = btn.dataset.plate;
      
      // Find a free slot in the active level
      const lvl = state.levels.find(l => l.name === (activeLevel || state.levels[0].name));
      const freeIdx = lvl.slots.findIndex(s => s.status === 'FREE');
      
      if (freeIdx === -1) return showToast("No hay puestos libres para reservar", "error");
      
      lvl.slots[freeIdx] = { 
        ...lvl.slots[freeIdx], 
        status: 'RESERVED', 
        plate: plate,
        entryTime: new Date().toISOString()
      };
      
      // Update Supabase to say the resident is no longer 'coming' (now it's reserved)
      await supabase.from('subscriptions').update({ is_coming: false }).eq('id', subId);
      
      updateParkingState(state);
      render();
      showToast(`Puesto ${lvl.slots[freeIdx].label} reservado para ${plate}`, "success");
    }
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
            <div style="display:flex; gap:8px; align-items:center;">
               <button data-action="LOGOUT" style="background:rgba(255,255,255,0.1);color:white;border:none;padding:5px 12px;border-radius:8px;font-size:0.65rem;font-weight:900;cursor:pointer; display:flex; align-items:center; gap:6px;">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                 CERRAR SESIÓN
               </button>
            </div>
          </div>
          <div id="guard-clock" style="font-size:0.85rem;color:#F5C518;font-weight:700;margin-top:4px;">${new Date().toLocaleTimeString().toLowerCase()}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;">DISPONIBLES</div>
          <div id="header-disp" style="font-size:2.4rem;font-weight:900;color:#F5C518;line-height:0.9;">${total-occ}<span style="font-size:0.6rem; color:rgba(255,255,255,0.3); display:block;">de ${total} puestos</span></div>
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

  const renderSelection = async () => {
    const buildingId = localStorage.getItem('sloty_building_id')

    const { data: personnel } = await supabase
      .from('personnel')
      .select('*')
      .eq('building_id', buildingId)
      .eq('active', true)

    state.personnel = personnel || []

    screens.guardPin.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;padding:40px 24px;">
        <div style="display:flex;width:100%;justify-content:space-between;align-items:center;margin-bottom:30px;">
          <button id="btn-back-guard" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.5rem;cursor:pointer;">←</button>
          <button id="btn-change-build" style="background:rgba(255,255,255,0.1);border:none;color:white;padding:6px 12px;border-radius:8px;font-size:0.6rem;font-weight:900;cursor:pointer;">CAMBIAR EDIFICIO</button>
        </div>
        <img src="/sloty-logo-v2.png.png" alt="Sloty" style="width:120px;height:auto;display:block;margin-bottom:8px;" />
        <p style="color:rgba(255,255,255,0.4);font-size:0.65rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 32px;">SELECCIONA TU PERFIL</p>
        
        <div style="width:100%;max-width:320px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          ${(state.personnel || []).map(p => `
            <div class="guard-card" data-id="${p.id}" style="background:rgba(255,255,255,0.05);padding:20px 10px;border-radius:18px;text-align:center;cursor:pointer;border:2px solid transparent;transition:all 0.2s;">
              <div style="width:60px;height:60px;border-radius:50%;background:#333;margin:0 auto 10px;overflow:hidden;border:2px solid rgba(255,255,255,0.1);">
                ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#666;font-weight:900;">${p.name.charAt(0)}</div>`}
              </div>
              <div style="color:white;font-weight:700;font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>
            </div>
          `).join(state.personnel?.length ? '' : '<p style="color:rgba(255,255,255,0.3);grid-column:span 2;padding:40px 0;">No hay guardias registrados.</p>')}
        </div>
        
        <p style="color:rgba(255,255,255,0.2);font-size:0.75rem;margin-top:auto;padding-top:40px;">${state.buildingName || 'Edificio'}</p>
      </div>
    `
  }

  const renderMap = (state) => {
    const level = state.levels.find(l=>l.name===activeLevel)||state.levels[0]
    if (!level) return ''
    const half = Math.ceil(level.slots.length/2)
    return `
    <div style="background:#1a1a2e;padding:0 16px 20px;display:flex;gap:12px;overflow-x:auto;">
      ${state.levels.map(l=>`<button data-action="TAB_LEVEL" data-level="${l.name}" style="padding:10px 20px;border-radius:24px;border:none;font-weight:700;font-size:0.8rem;background:${activeLevel===l.name?'#F5C518':'rgba(255,255,255,0.08)'};color:${activeLevel===l.name?'#1a1a2e':'white'};">${l.name}</button>`).join('')}
    </div>

    <!-- INCOMING NOTIFICATION BANNER -->
    <div id="incoming-residents-area" style="padding:0 20px;"></div>

    <div style="padding:16px 20px 100px;">
      
      <div style="z-index:100; margin-bottom:20px;">
         <div id="scanner-wrapper" style="margin-bottom:15px; ${scannerActive ? '' : 'display:none;'}">
            <div id="qr-reader" style="border-radius:24px; overflow:hidden; background: #000; aspect-ratio: 1/1; box-shadow:0 10px 30px rgba(0,0,0,0.2);"></div>
            <button data-action="BACK_MAP" style="width:100%; padding:14px; background:white; color:#e63946; border:2px solid #e63946; border-radius:14px; margin-top:15px; font-weight:800; font-size:0.75rem;">CANCELAR ESCANEO</button>
         </div>
         
         ${!scannerActive ? `
           <div style="background:white; padding:15px; border-radius:24px; box-shadow:0 10px 30px rgba(0,0,0,0.05); margin-bottom:15px;">
              <div style="font-size:0.6rem; font-weight:900; color:#999; text-transform:uppercase; margin-bottom:10px;">SALIDA RÁPIDA</div>
              <div style="display:flex; gap:10px;">
                 <input type="text" id="fast-exit-plate" placeholder="Ej. ABC123" style="flex:1; border:2px solid #eee; border-radius:14px; padding:14px; font-weight:900; outline:none; text-transform:uppercase;">
                 <button data-action="FAST_EXIT_SEARCH" style="background:#1a1a2e; color:#F5C518; border:none; padding:0 20px; border-radius:14px; font-weight:900;">BUSCAR</button>
              </div>
           </div>
           
           <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <button data-action="SHOW_SCANNER" style="background:#1a1a2e; color:#F5C518; padding:18px; border:none; border-radius:18px; font-weight:900; font-size:0.8rem; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 10px 20px rgba(26,26,46,0.3);">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                 SALIDA QR
              </button>
              <button data-action="SHOW_MANUAL_ENTRY" style="background:#22c55e; color:white; padding:18px; border:none; border-radius:18px; font-weight:900; font-size:0.8rem; box-shadow:0 10px 20px rgba(34,197,94,0.3);">
                 NUEVO INGRESO
              </button>
           </div>
         ` : ''}
      </div>

      <div class="parking-canvas" style="margin-bottom:80px;">
        <div class="parking-column">${level.slots.slice(0,half).map((s,i)=>renderSpot(s,level.name,i)).join('')}</div>
        <div class="parking-lane"><div style="opacity:0.1; font-size:3rem;">↑</div></div>
        <div class="parking-column">${level.slots.slice(half).map((s,i)=>renderSpot(s,level.name,i+half)).join('')}</div>
      </div>
    </div>`
  }

  const renderSpot = (slot, levelName, sIdx) => {
    const occ = slot.status==='OCCUPIED', debt = slot.status==='DEBT', res = slot.status==='RESERVED', color = getCatColor(slot.category)
    return `<div class="spot-2d ${occ?'occupied':''} ${debt?'debt':''} ${res?'reserved':''}" data-action="OPEN_SLOT" data-level="${levelName}" data-sidx="${sIdx}" style="${occ?`background:${color};border-color:${color};`:''} ${res?`background:#f59e0b; border-color:#d97706;`:''}">
      ${occ?`<div style="font-size:1.1rem;">🚗</div>`:''}
      ${res?`<div style="font-size:0.9rem; color:white;">⏳</div>`:''}
      <span class="spot-label">${slot.label}</span>
      ${res?`<div style="position:absolute; bottom:2px; font-size:0.45rem; color:white; font-weight:900; width:100%; text-align:center;">${slot.plate || 'RES'}</div>`:''}
    </div>`
  }

  const renderEntryForm = () => {
    const now = new Date()
    const limit = new Date(now.getTime() + (state.settings?.freeHours || 8) * 3600000)
    
    return `
    <div style="padding:20px;padding-bottom:100px;">
      
      <!-- PREMIUM TICKET HEADER -->
      <div style="background:#1a1a2e; color:white; border-radius:32px 32px 0 0; padding:30px 24px; position:relative; overflow:hidden;">
        <div style="font-size:0.6rem; font-weight:800; color:var(--accent); letter-spacing:2px; margin-bottom:5px;">TICKET DE INGRESO</div>
        <div style="display:flex; justify-content:space-between; align-items:flex-end;">
          <div>
            <div style="font-size:2rem; font-weight:900; letter-spacing:-1px; color:var(--accent);">${state.buildingName.toUpperCase()}</div>
            <div style="display:flex; gap:15px; margin-top:8px;">
               <div>
                 <div style="font-size:0.55rem; font-weight:800; color:rgba(255,255,255,0.4); text-transform:uppercase;">INGRESO</div>
                 <div style="font-size:0.9rem; font-weight:900;">${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}).toLowerCase()}</div>
               </div>
               <div>
                 <div style="font-size:0.55rem; font-weight:800; color:#F5C518; text-transform:uppercase;">VENCE LÍMITE (8h)</div>
                 <div style="font-size:0.9rem; font-weight:900; color:#F5C518;">${limit.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}).toLowerCase()}</div>
               </div>
            </div>
          </div>
          <div style="text-align:right;">
             <div style="font-size:0.6rem; font-weight:800; color:rgba(255,255,255,0.4); margin-bottom:4px;">ASIGNADO A</div>
             <div style="font-size:2.4rem; font-weight:900; color:#22c55e; line-height:0.8;">${selectedSlot.label}</div>
          </div>
        </div>
        <div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:rgba(34,197,94,0.05); border-radius:50%; pointer-events:none;"></div>
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
  }

  const renderSuccessTicket = () => {
    const slot = selectedSlot
    const qrData = JSON.stringify({ plate: slot.plate, slot: slot.label })
    const now = new Date()
    const limit = new Date(now.getTime() + (state.settings?.freeHours || 8) * 3600000)
    
    return `
    <div style="padding:20px; padding-bottom:120px;">
      <div id="ticket-printable" style="background:white; border-radius:32px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.1); text-align:center;">
        <div style="background:#1a1a2e; padding:40px 20px; color:white;">
           <div style="font-size:0.7rem; font-weight:800; color:var(--accent); letter-spacing:3px; margin-bottom:10px;">${state.buildingName.toUpperCase()}</div>
           <div style="font-size:3.5rem; font-weight:950; letter-spacing:-2px; margin-bottom:15px;">${slot.plate || '---'}</div>
           <div style="display:inline-block; background:var(--accent); color:var(--primary); padding:6px 20px; border-radius:20px; font-weight:900; font-size:0.8rem;">${slot.category}</div>
        </div>
        
        <div style="padding:30px 24px;">
           <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:30px;">
              <div style="text-align:left;">
                 <div style="font-size:0.6rem; font-weight:800; color:#bbb; text-transform:uppercase; margin-bottom:5px;">PUESTO ASIGNADO</div>
                 <div style="font-size:1.6rem; font-weight:900; color:var(--primary);">${slot.label}</div>
                 <div style="font-size:0.65rem; color:#ccc; font-weight:700;">${slot.levelName}</div>
              </div>
              <div style="text-align:right;">
                 <div style="font-size:0.6rem; font-weight:800; color:#bbb; text-transform:uppercase; margin-bottom:5px;">VENCE LÍMITE (8h)</div>
                 <div style="font-size:1.6rem; font-weight:900; color:#e63946;">${limit.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}).toLowerCase()}</div>
                 <div style="font-size:0.65rem; color:#ccc; font-weight:700;">${limit.toLocaleDateString()}</div>
              </div>
           </div>
           
           <div style="border-top:1.5px dashed #eee; margin:0 20px 30px;"></div>
           
           <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
              <div style="text-align:left;">
                 <div style="font-size:0.6rem; font-weight:800; color:#bbb; margin-bottom:2px;">HORA INGRESO</div>
                 <div style="font-size:0.9rem; font-weight:900; color:#1a1a2e;">${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}).toLowerCase()}</div>
              </div>
              <div style="background:#f8f9fa; padding:15px; border-radius:20px;">
                 <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}" style="width:100px; height:100px; display:block;">
              </div>
           </div>
           
           <div style="font-size:0.7rem; color:#999; font-weight:700; padding:0 30px; line-height:1.4;">
              Escanee este código al salir para agilizar su cobro.<br><b>Guarde su ticket.</b>
           </div>
        </div>
      </div>
      
      <div style="margin-top:25px; display:grid; gap:12px;">
         <button data-action="PRINT_TICKET" style="width:100%; padding:20px; background:#1a1a2e; color:white; border:none; border-radius:20px; font-weight:900; display:flex; align-items:center; justify-content:center; gap:10px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            IMPRIMIR TICKET
         </button>
         <button data-action="BACK_MAP" style="width:100%; padding:20px; background:#22c55e; color:white; border:none; border-radius:20px; font-weight:900; display:flex; align-items:center; justify-content:center; gap:10px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><polyline points="20 6 9 17 4 12"/></svg>
            CONTINUAR AL MAPA
         </button>
      </div>
    </div>`
  }

  const renderExitForm = () => {
    const entryTime = new Date(selectedSlot.entryTime)
    const hoursStayed = (new Date() - entryTime) / 3600000
    const freeHours = state.settings?.freeHours || 8
    let totalOwed = 0
    
    if (hoursStayed > freeHours) {
       totalOwed = state.settings?.baseRate || 1
    }
    
    if (selectedSlot.paymentStatus === 'PAGADO') {
       totalOwed = Math.max(0, totalOwed - (state.settings?.baseRate || 1))
    }
    if (selectedSlot.status === 'DEBT') totalOwed = 1 // Already marked as debt
    
    return `
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

        <div style="background:#f8f9fa; border-radius:16px; padding:15px; margin-bottom:24px; text-align:center; border:2px solid ${totalOwed > 0 ? '#e63946' : '#22c55e'};">
           <div style="font-size:0.6rem; font-weight:900; color:#999; text-transform:uppercase;">MONTO A COBRAR</div>
           <div style="font-size:2.2rem; font-weight:950; color:${totalOwed > 0 ? '#e63946' : '#22c55e'};">$${totalOwed.toFixed(2)}</div>
           ${totalOwed > 0 ? `<div style="font-size:0.6rem; font-weight:700; color:#e63946; margin-top:4px;">EXCESO DE TIEMPO (+8H)</div>` : `<div style="font-size:0.6rem; font-weight:700; color:#22c55e; margin-top:4px;">CORTESÍA / PAGADO</div>`}
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:25px; ${totalOwed === 0 ? 'display:none;' : ''}">
          ${PAY.map((p,i)=>`<button class="pay-chip ${i===0?'pay-active':''}" data-method="${p.m}" style="padding:10px;border-radius:10px;border:2px solid #eee;background:white;font-size:0.65rem;font-weight:900;">${p.label}</button>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button data-action="EXIT_PAID" style="padding:18px;background:#22c55e;color:white;border:none;border-radius:16px;font-weight:900;">${totalOwed > 0 ? 'MARCAR PAGADO' : 'LIBERAR PUESTO'}</button>
          <button data-action="EXIT_DEBT" style="padding:18px;background:#e63946;color:white;border:none;border-radius:16px;font-weight:900;">${totalOwed > 0 ? 'SALIDA DEUDA' : 'SOLO SALIDA'}</button>
        </div>
      </div>
    </div>`
  }

  const renderPaymentForm = () => `
    <div style="padding:20px; padding-bottom:120px;">
      <div style="background:white; border-radius:32px; padding:30px; box-shadow:0 15px 45px rgba(0,0,0,0.1);">
         <div style="text-align:center; margin-bottom:25px;">
            <div style="font-size:0.7rem; font-weight:900; color:#999; letter-spacing:1px; text-transform:uppercase;">DETALLE DE PAGO</div>
            <div style="font-size:2.5rem; font-weight:950; color:var(--primary); margin:5px 0;">$${(pendingPayment?.amount || 0).toFixed(2)}</div>
            <div style="display:inline-block; background:#f4f4f4; padding:5px 15px; border-radius:20px; font-weight:900; font-size:0.65rem; color:#666;">
               ${(pendingPayment?.method || '').replace('_', ' ')}
            </div>
         </div>

         <div style="display:grid; gap:20px; margin-bottom:30px;">
            <div style="text-align:left;">
               <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">CANTIDAD RECIBIDA</label>
               <input id="pay-amount" type="number" step="0.01" value="${pendingPayment?.amount || 0}" placeholder="0.00" 
                  style="width:100%; border:2px solid #eee; border-radius:18px; padding:18px; font-size:1.4rem; font-weight:900; outline:none; font-family:'Montserrat';">
            </div>

            ${pendingPayment?.method === 'PAGO_MOVIL' ? `
              <div style="text-align:left;">
                 <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">REFERENCIA (Últimos 4-6)</label>
                 <input id="pay-ref" type="text" placeholder="Ej: 4522" 
                    style="width:100%; border:2px solid #eee; border-radius:18px; padding:18px; font-size:1.4rem; font-weight:900; outline:none; font-family:'Montserrat';">
              </div>
               <div style="background:rgba(245,197,24,0.1); border:1.5px solid #F5C518; border-radius:14px; padding:12px; font-size:0.65rem; color:#D97706; font-weight:700; margin-top:12px; line-height:1.3; text-align:left;">
                  ⚠️ Nota: Recuerda colocar el valor equivalente en Bolívares (Bs.)
               </div>
             ` : ''}
         </div>

         <button data-action="SUBMIT_PAYMENT" style="width:100%; padding:22px; background:#22c55e; color:white; border:none; border-radius:22px; font-weight:900; font-size:1rem; box-shadow:0 10px 25px rgba(34,197,94,0.3);">
            CONFIRMAR Y REGISTRAR
         </button>
      </div>
    </div>
  `

  const renderSubPaymentView = () => {
     const search = document.getElementById('sub-search')?.value.toLowerCase() || ''
     const filtered = cachedResidents.filter(r => r.resident_name.toLowerCase().includes(search) || r.plate.toLowerCase().includes(search))

     return `
     <div style="padding:20px; padding-bottom:120px;">
        <h2 style="font-weight:900; color:var(--primary); margin-bottom:15px;">COBRAR MENSUALIDAD</h2>
        <input type="text" id="sub-search" placeholder="Buscar por placa o nombre..." onkeyup="document.querySelector('[data-action=SEARCH_RESIDENT]').click()" style="width:100%; padding:15px; border-radius:15px; border:2px solid #eee; margin-bottom:20px; font-weight:700; font-family:'Montserrat'; outline:none;">
        <button data-action="SEARCH_RESIDENT" style="display:none;"></button>

        <div style="display:grid; gap:12px;">
           ${filtered.map(r => {
              const exp = new Date(r.expiry_date)
              const isExpired = exp < new Date()
              return `
              <div style="background:white; padding:15px; border-radius:20px; border:1.5px solid ${r.hasPending ? '#f59e0b' : '#f0f0f0'}; display:flex; justify-content:space-between; align-items:center; box-shadow:0 4px 10px rgba(0,0,0,0.02);">
                 <div>
                    <div style="font-weight:900; font-size:1rem; color:var(--primary);">${r.resident_name}</div>
                    <div style="font-size:0.7rem; font-weight:700; color:#666; margin-top:2px;">Placas: ${r.plate}</div>
                    <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                       <div style="font-size:0.65rem; font-weight:800; color:${isExpired ? '#e63946' : '#22c55e'};">
                          Vence: ${exp.toLocaleDateString()} ${isExpired ? '(VENCIDO)' : ''}
                       </div>
                       ${r.hasPending ? `<span style="background:#fef9c3; color:#a16207; font-size:0.5rem; font-weight:900; padding:2px 6px; border-radius:6px; border:1px solid #fef08a;">PENDIENTE APROBACIÓN</span>` : ''}
                    </div>
                 </div>
                 <button data-action="SELECT_RESIDENT_PAY" data-id="${r.id}" style="background:#1a1a2e; color:#F5C518; border:none; padding:10px 15px; border-radius:12px; font-weight:900; font-size:0.7rem; cursor:pointer;">
                    COBRAR $${r.custom_price}
                 </button>
              </div>
              `
           }).join('')}
           ${!filtered.length ? '<div style="text-align:center; padding:20px; color:#ccc; font-weight:700;">No se encontraron residentes</div>' : ''}
        </div>
     </div>`
  }

  const renderSubPaymentForm = () => `
     <div style="padding:20px; padding-bottom:120px;">
        <div style="background:white; border-radius:32px; padding:30px; box-shadow:0 15px 45px rgba(0,0,0,0.1);">
           <h2 style="font-weight:900; color:var(--primary); margin-bottom:5px; text-align:center;">PAGO DE MENSUALIDAD</h2>
           <div style="font-size:0.8rem; font-weight:700; color:#666; text-align:center; margin-bottom:20px;">${selectedResident.resident_name}</div>

           <div style="margin-bottom:20px;">
              <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">MONTO A COBRAR</label>
              <input id="sub-pay-amount" type="number" step="0.01" value="${subPaymentAmount}" style="width:100%; border:2px solid #eee; border-radius:18px; padding:18px; font-size:1.4rem; font-weight:900; outline:none; font-family:'Montserrat';">
           </div>

           <div style="margin-bottom:20px;">
              <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">MÉTODO DE PAGO</label>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                 ${PAY.map(p => `<button data-action="SET_SUB_METHOD" data-method="${p.m}" style="padding:10px; border-radius:10px; border:2px solid ${subPaymentMethod === p.m ? '#1a1a2e' : '#eee'}; background:${subPaymentMethod === p.m ? '#1a1a2e' : 'white'}; color:${subPaymentMethod === p.m ? 'white' : '#1a1a2e'}; font-size:0.65rem; font-weight:900;">${p.label}</button>`).join('')}
              </div>
           </div>

           ${subPaymentMethod === 'PAGO_MOVIL' ? `
              <div style="margin-bottom:20px;">
                 <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">REFERENCIA (Últimos 4-6)</label>
                 <input id="sub-pay-ref" type="text" placeholder="Ej: 4522" style="width:100%; border:2px solid #eee; border-radius:18px; padding:18px; font-size:1.4rem; font-weight:900; outline:none; font-family:'Montserrat';"></div><div style="background:rgba(245,197,24,0.1); border:1.5px solid #F5C518; border-radius:14px; padding:12px; font-size:0.65rem; color:#D97706; font-weight:700; margin-top:12px; line-height:1.3; text-align:left;">⚠️ Nota: Recuerda colocar el valor equivalente en Bolívares (Bs.)</div><div style="display:none;"
              </div>
           ` : ''}

           <button data-action="SUBMIT_SUB_PAYMENT" style="width:100%; padding:20px; background:#22c55e; color:white; border:none; border-radius:20px; font-weight:900; font-size:0.9rem; box-shadow:0 10px 25px rgba(34,197,94,0.3);">
              CONFIRMAR MENSUALIDAD
           </button>
        </div>
     </div>
  `

  const renderClosureSummary = () => {
    const openMovs = state.movements.filter(m => !m.closed && m.guardName === guardName)
    const total = openMovs.reduce((a,m) => a + (m.amount || 0), 0)
    const breakdown = openMovs.reduce((acc, m) => {
      acc[m.payMethod] = (acc[m.payMethod] || 0) + (m.amount || 0)
      return acc
    }, {})
    
    const todayEntries = state.movements.filter(m => m.type === 'entry' && !m.closed && m.guardName === guardName).length;
    const todayExits = state.movements.filter(m => m.type === 'SALIDA' && !m.closed && m.guardName === guardName).length;

    return `
    <div style="padding:20px; padding-bottom:120px;">
       
       <div style="background:white; border-radius:32px; padding:25px; box-shadow:0 10px 30px rgba(0,0,0,0.05); margin-bottom:20px;">
          <h2 style="font-weight:950; color:var(--primary); margin-bottom:15px; text-align:center;">RENDIMIENTO</h2>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
             <div style="background:rgba(34,197,94,0.1); border:1.5px solid rgba(34,197,94,0.3); border-radius:20px; padding:15px; text-align:center;">
                <div style="font-size:1.8rem; font-weight:950; color:#22c55e;">${todayEntries}</div>
                <div style="font-size:0.6rem; font-weight:800; color:#22c55e; text-transform:uppercase;">AUTOS ENTRARON</div>
             </div>
             <div style="background:rgba(230,57,70,0.1); border:1.5px solid rgba(230,57,70,0.3); border-radius:20px; padding:15px; text-align:center;">
                <div style="font-size:1.8rem; font-weight:950; color:#e63946;">${todayExits}</div>
                <div style="font-size:0.6rem; font-weight:800; color:#e63946; text-transform:uppercase;">AUTOS SALIERON</div>
             </div>
          </div>
       </div>

       <div style="background:white; border-radius:32px; padding:25px; box-shadow:0 10px 30px rgba(0,0,0,0.05);">
          <h2 style="font-weight:950; color:var(--primary); margin-bottom:5px; text-align:center;">CORTE DE CAJA</h2>
          <div style="font-size:0.65rem; font-weight:800; color:#bbb; text-align:center; margin-bottom:25px; text-transform:uppercase;">${guardName.toUpperCase()} · ${new Date().toLocaleDateString()}</div>

          <!-- TOTALS -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:25px;">
             <div style="background:#1a1a2e; color:white; padding:20px 10px; border-radius:24px; text-align:center;">
                <div style="font-size:1.6rem; font-weight:950;">$${total.toFixed(2)}</div>
                <div style="font-size:0.5rem; font-weight:800; color:var(--accent); text-transform:uppercase;">RECAUDO TOTAL</div>
             </div>
             <div style="background:#f8f9fa; padding:20px 10px; border-radius:24px; text-align:center;">
                <div style="font-size:1.6rem; font-weight:950;">${openMovs.length}</div>
                <div style="font-size:0.5rem; font-weight:800; color:#999; text-transform:uppercase;">MOVIMIENTOS</div>
             </div>
          </div>

          <!-- METHODS -->
          <div style="background:#fdfdfd; border:1.5px solid #f8f8f8; border-radius:20px; padding:15px; margin-bottom:25px;">
             ${Object.entries(breakdown).map(([m, val]) => `
               <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f4f4f4;">
                  <span style="font-size:0.65rem; font-weight:800; color:#666;">${(m||'OTROS').replace('_', ' ')}</span>
                  <span style="font-size:0.85rem; font-weight:900; color:var(--primary);">$${val.toFixed(2)}</span>
               </div>
             `).join('') || '<div style="text-align:center; padding:10px; color:#ccc; font-size:0.75rem;">Sin recaudos hoy</div>'}
          </div>

          <!-- RECENT LIST -->
          <div style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:10px; text-transform:uppercase;">ÚLTIMOS MOVIMIENTOS</div>
          <div style="display:grid; gap:8px; margin-bottom:30px; max-height:200px; overflow-y:auto;">
             ${openMovs.slice(0, 10).map(m => `
               <div style="background:#fafafa; border-radius:12px; padding:10px 15px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-size:0.8rem; font-weight:900; color:var(--primary);">${m.plate || '---'}</div>
                    <div style="font-size:0.5rem; color:#999; font-weight:700;">${m.type} · ${m.slot}</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:0.8rem; font-weight:900; color:#22c55e;">+$${(m.amount||0).toFixed(2)}</div>
                    <div style="font-size:0.45rem; color:#bbb; font-weight:800;">Ref: ${m.reference || 'EFEC'}</div>
                  </div>
               </div>
             `).join('')}
          </div>

          <button data-action="FINALIZE_CLOSURE" style="width:100%; padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; font-size:0.9rem; box-shadow:0 10px 25px rgba(26,26,46,0.3);">
            CONFIRMAR Y ENVIAR CIERRE
          </button>
       </div>
    </div>
    `
  }

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

  const checkIncomingResidents = async () => {
    if (currentView !== 'MAP') return;
    const buildingId = state.buildingId || localStorage.getItem('sloty_building_id')
    if (!buildingId) return;
    const { data: incoming } = await supabase.from('subscriptions')
      .select('*')
      .eq('building_id', buildingId)
      .eq('is_coming', true);
    
    const bannerArea = document.getElementById('incoming-residents-area');
    if (!bannerArea) return;

    if (incoming?.length) {
      bannerArea.innerHTML = incoming.map(r => `
        <div style="background:#F5C518; color:#1a1a2e; padding:15px; border-radius:18px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; animation: pulse 2s infinite; box-shadow:0 8px 25px rgba(245,197,24,0.3);">
           <div>
              <div style="font-size:0.55rem; font-weight:900; letter-spacing:1px; text-transform:uppercase; opacity:0.7;">RESIDENTE EN CAMINO</div>
              <div style="font-size:1.1rem; font-weight:900;">${r.plate.split(',')[0]}</div>
              <div style="font-size:0.6rem; font-weight:700;">${r.resident_name} · Apto ${r.apt || '-'}</div>
           </div>
           <button data-action="ACCEPT_RESERVATION" data-sub-id="${r.id}" data-plate="${r.plate.split(',')[0]}" style="background:#1a1a2e; color:white; border:none; padding:10px 15px; border-radius:12px; font-size:0.7rem; font-weight:900; cursor:pointer;">ACEPTAR Y RESERVAR</button>
        </div>
      `).join('');
    } else {
      bannerArea.innerHTML = '';
    }
  }

  const renderBottomNav = () => {
    return `
      <div style="position:fixed; bottom:0; left:0; width:100%; height:70px; background:white; border-top:1px solid #eee; z-index:2000; display:flex; justify-content:space-around; align-items:center; padding-bottom:env(safe-area-inset-bottom);">
         <button data-action="SWITCH_TAB" data-tab="HOME" style="background:none; border:none; display:flex; flex-direction:column; align-items:center; gap:4px; color:${currentTab==='HOME' ? '#1a1a2e' : '#bbb'};">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span style="font-size:0.6rem; font-weight:900;">INICIO</span>
         </button>
         <button data-action="SWITCH_TAB" data-tab="PAY" style="background:none; border:none; display:flex; flex-direction:column; align-items:center; gap:4px; color:${currentTab==='PAY' ? '#1a1a2e' : '#bbb'};">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px;"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <span style="font-size:0.6rem; font-weight:900;">PAGOS</span>
         </button>
         <button data-action="SWITCH_TAB" data-tab="STATS" style="background:none; border:none; display:flex; flex-direction:column; align-items:center; gap:4px; color:${currentTab==='STATS' ? '#1a1a2e' : '#bbb'};">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px;"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
            <span style="font-size:0.6rem; font-weight:900;">CIERRE</span>
         </button>
      </div>
    `
  }

  const render = () => {
    const freshState = getParkingState()
    if (!elShell) renderShell(freshState)
    elShell.innerHTML = renderHeader(freshState)
    
    let html = ''
    if (currentView === 'MAP') html = renderMap(freshState)
    else if (currentView === 'ENTRY') html = renderEntryForm()
    else if (currentView === 'EXIT') html = renderExitForm()
    else if (currentView === 'TICKET') html = renderSuccessTicket()
    else if (currentView === 'PAYMENT') html = renderPaymentForm()
    else if (currentView === 'CLOSURE') html = renderClosureSummary()
    else if (currentView === 'SUB_PAYMENT') html = renderSubPaymentView()
    else if (currentView === 'SUB_PAYMENT_FORM') html = renderSubPaymentForm()
    else if (currentView === 'SUB_PAYMENT_LOADING') html = `<div style="text-align:center; padding:100px 20px; font-weight:900; color:#999;">CARGANDO RESIDENTES...</div>`
    
    if (elContent.innerHTML !== html) {
      elContent.innerHTML = html
      if (scannerActive) initQRScanner()
      setupLocalInteractions()
    }

    if (currentView === 'MAP') checkIncomingResidents();
    
    const footer = container.querySelector('#guard-footer-area')
    if (['MAP', 'SUB_PAYMENT', 'CLOSURE', 'SUB_PAYMENT_LOADING'].includes(currentView)) {
       footer.innerHTML = renderBottomNav();
    } else {
       footer.innerHTML = `
         <div style="position:fixed;bottom:0;left:0;width:100%;padding:16px;background:white;border-top:1px solid #eee;z-index:200;">
           <button data-action="BACK_MAP" style="width:100%;padding:16px;background:#f8f9fa;border:none;border-radius:16px;font-weight:700;color:#999;">← VOLVER</button>
         </div>`
    }
  }

  setInterval(checkIncomingResidents, 5000);

  const setupLocalInteractions = () => {
    const plateEl = document.getElementById('entry-plate')
    if (plateEl) {
      plateEl.oninput = async () => {
        plateEl.value = plateEl.value.toUpperCase()
        const plate = plateEl.value

        // Limpiar sugerencia anterior
        const existing = document.getElementById('visitor-suggestion')
        if (existing) existing.remove()

        if (plate.length < 3) return

        const buildingId = localStorage.getItem('sloty_building_id')
        const { data: subs } = await supabase.from('subscriptions').select('resident_name, apt').eq('building_id', buildingId).ilike('plate', `%${plate}%`)
        
        if (subs && subs.length > 0) {
           const infoDiv = document.createElement('div')
           infoDiv.id = 'visitor-suggestion'
           infoDiv.style = "background:#F5C518; color:#1a1a2e; padding:10px; border-radius:10px; margin-bottom:10px; font-weight:900; font-size:0.75rem; text-align:center;"
           infoDiv.innerHTML = `🚗 RESIDENTE: ${subs[0].resident_name} (Apto ${subs[0].apt || '-'})`
           plateEl.parentNode.insertBefore(infoDiv, plateEl.nextSibling)
           
           const catBtn = document.querySelector('[data-cat="RESIDENTE"]')
           if(catBtn) {
              document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('cat-active'))
              catBtn.classList.add('cat-active')
           }
        } else {
           const found = await findVisitorByPlate(plate)
           if (!found) return

           // Autocompletar campos si están vacíos
           const phoneEl = document.getElementById('entry-phone')
        const visitsEl = document.getElementById('entry-visits-to')
        if (phoneEl && !phoneEl.value) phoneEl.value = found.r_phone || ''
        if (visitsEl && !visitsEl.value) visitsEl.value = found.r_visits_to || ''

        // Mostrar banner de visitante reconocido
        const banner = document.createElement('div')
        banner.id = 'visitor-suggestion'
        banner.style.cssText = `
          background:#F5C518;color:#1a1a2e;padding:10px 16px;border-radius:12px;
          margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;
          font-family:'Montserrat',sans-serif;
        `
        banner.innerHTML = `
          <div>
            <div style="font-size:0.6rem;font-weight:900;letter-spacing:1px;">VISITANTE FRECUENTE</div>
            <div style="font-size:0.95rem;font-weight:900;">${found.r_full_name}</div>
            <div style="font-size:0.7rem;opacity:0.7;">${found.visit_count} visitas anteriores · ${found.r_visits_to || ''}</div>
          </div>
          <div style="font-size:1.5rem;">✓</div>
        `
        plateEl.parentNode.insertBefore(banner, plateEl.nextSibling)
        }
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
