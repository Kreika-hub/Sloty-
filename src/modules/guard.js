import { getParkingState, updateParkingState, logMovement, logNotification, saveClosure, supabase, hasFeature, showToast, logAudit, getExchangeRate, getSyncQueueCount, isTaskPending } from '../db.js'
import { html } from '../utils/sanitize.js';

import { searchVisitorByPlate, saveVisitor, logAccess } from '../visitors.js'
import { subscribeToPushNotifications, renderPushBanner } from './push.js'

window.renderPushBanner = renderPushBanner;
// Html5Qrcode is loaded via CDN in index.html, accessible globally

export const initGuard = (container, guardName = 'Guardia') => {
  let state = getParkingState()
  if (state && !state.buildingId) {
    state.buildingId = localStorage.getItem('sloty_building_id') || null;
    state.buildingName = localStorage.getItem('sloty_building_name') || '';
    state.buildingCode = localStorage.getItem('sloty_active_building') || '';
    updateParkingState(state);
  }
  let selectedSlot = (() => {
    try {
      return JSON.parse(localStorage.getItem('sloty_selected_slot')) || null
    } catch(e) { return null }
  })()
  let currentView = 'MAP'
  let activeLevel = null
  let previousView = 'MAP'
  let currentTab = 'HOME'
  let qrScanner = null
  let scannerActive = false
  let pendingPayment = null // { amount, method, type, slot, plate, category, metadata, phone, entryData }
  let cachedResidents = []
  let subPaymentAmount = 0
  let subPaymentMethod = 'EFECTIVO_USD'
  let selectedResident = null
  let elModal = document.createElement('div')
  elModal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(5px);z-index:9998;display:none;align-items:center;justify-content:center;padding:20px;"
  container.appendChild(elModal)
  let elToast = null
  let elShell = null
  let elContent = null
  let subSearchText = ''


  let shiftData = {
    startedAt: new Date().toISOString(),
    absences: [],
    pausedAt: null
  }

  const handleSyncUpdated = (e) => {
    const el = document.getElementById('header-sync-queue')
    if (el) {
      el.style.display = e.detail.count > 0 ? 'inline-block' : 'none'
      const countEl = document.getElementById('header-sync-count')
      if (countEl) countEl.textContent = e.detail.count
    }
  }

  const handleConnectionStatus = (e) => {
    const el = document.getElementById('header-conn-status')
    if (el) {
      el.style.background = e.detail.online ? 'rgba(34,197,94,0.15)' : 'rgba(245,197,24,0.15)'
      el.style.color = e.detail.online ? '#22c55e' : '#ce8a05'
      el.style.borderColor = e.detail.online ? 'rgba(34,197,94,0.3)' : 'rgba(245,197,24,0.3)'
      el.innerHTML = html`● ${e.detail.online ? 'En Línea' : 'Offline'}`
    }
  }

  window.addEventListener('sloty-sync-updated', handleSyncUpdated)
  window.addEventListener('sloty-connection-status', handleConnectionStatus)

  const handleSyncDownloaded = () => {
    state = getParkingState()
    render()
  }

  const handleResidentComing = (e) => {
    if (e.detail && e.detail.resident_name) {
      showToast(`🚗 ${e.detail.resident_name} viene en camino`, 'info')
    }
    state = getParkingState()
    render()
  }

  window.addEventListener('sloty-sync-downloaded', handleSyncDownloaded)
  window.addEventListener('sloty-resident-coming', handleResidentComing)

  window.handleAction = (type, payload) => {
    if (actions[type]) actions[type](payload)
  }

  const showNativePush = (title, msg, icon = '🛡️') => {
    push.innerHTML = html`
      <div style="flex:1; display:flex; gap:12px; align-items:center;" onclick="this.parentElement.remove()">
        <div style="width:45px; height:45px; background:var(--primary); border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">${icon}</div>
        <div>
          <div style="font-weight:900; color:var(--primary); font-size:0.85rem; letter-spacing:0.3px;">${title}</div>
          <div style="font-size:0.75rem; color:#666; font-weight:700;">${msg}</div>
        </div>
      </div>
      <button onclick="this.parentElement.remove()" style="background:none; border:none; padding:10px; font-size:1.2rem; display:flex; align-items:center; justify-content:center; color:#999; cursor:pointer;">×</button>
    `
    container.appendChild(push)
    setTimeout(() => { push.style.transform = 'translateY(0)' }, 100)
    setTimeout(() => { push.style.transform = 'translateY(-150%)'; setTimeout(() => { push.remove() }, 600) }, 3500)
  }

  // Welcome Notification
  setTimeout(() => {
    showNativePush('¡HOLA, ' + guardName.toUpperCase() + '!', 'Tu turno ha iniciado correctamente. Que tengas una excelente guardia.', '👋')
    import('./push.js').then(m => m.subscribeToPushNotifications(state.buildingId, 'GUARD', guardName));
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
    if (!container.contains(elModal)) {
      container.appendChild(elModal)
    }
    elModal.innerHTML = html`
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

  const showPinModal = (title, msg, onConfirm) => {
    if (!container.contains(elModal)) {
      container.appendChild(elModal)
    }
    elModal.innerHTML = html`
      <div style="background:white;border-radius:24px;padding:24px;width:100%;max-width:320px;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.2);">
        <div style="font-size:2.5rem;margin-bottom:10px;">🔒</div>
        <div style="font-weight:900;font-size:1.1rem;margin-bottom:8px;color:#1a1a2e;">${title}</div>
        <div style="font-size:0.8rem;color:#666;margin-bottom:16px;">${msg}</div>
        <input id="modal-pin-input" type="password" inputmode="numeric" maxlength="6" placeholder="••••" style="width:100%;box-sizing:border-box;padding:14px;border:2px solid #eee;border-radius:14px;font-size:1.4rem;text-align:center;letter-spacing:4px;font-weight:900;margin-bottom:20px;outline:none;" />
        <div id="modal-pin-error" style="color:#e63946;font-size:0.75rem;font-weight:700;margin-bottom:12px;display:none;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
           <button id="modal-pin-cancel" style="padding:14px;border:none;border-radius:12px;background:#f0f2f5;font-weight:800;color:#999;cursor:pointer;">CANCELAR</button>
           <button id="modal-pin-ok" style="padding:14px;border:none;border-radius:12px;background:#1a1a2e;font-weight:900;color:#F5C518;cursor:pointer;">ACEPTAR</button>
        </div>
      </div>`
    elModal.style.display = 'flex'
    const input = elModal.querySelector('#modal-pin-input')
    const errDiv = elModal.querySelector('#modal-pin-error')
    setTimeout(() => input.focus(), 100)
    elModal.querySelector('#modal-pin-cancel').onclick = () => { elModal.style.display = 'none' }
    const submitPin = () => {
      const val = input.value.trim()
      if (!val) {
        errDiv.textContent = 'Ingresa tu PIN'
        errDiv.style.display = 'block'
        return
      }
      const success = onConfirm(val)
      if (success !== false) {
        elModal.style.display = 'none'
      } else {
        errDiv.textContent = 'PIN incorrecto'
        errDiv.style.display = 'block'
        input.value = ''
        input.focus()
      }
    }
    elModal.querySelector('#modal-pin-ok').onclick = submitPin
    input.onkeyup = (e) => { if (e.key === 'Enter') submitPin() }
  }

  const CAT = [
    { cat:'VISITANTE',    color:'#F5C518', label:'Visitante', maxHours: 8 },
    { cat:'RESIDENTE',    color:'#38bdf8', label:'Residente', maxHours: null },
    { cat:'DISCAPACITADO',color:'#3b82f6', label:'Discap.', maxHours: null },
    { cat:'ELECTRICO',    color:'#8b5cf6', label:'Eléctrico', maxHours: null },
    { cat:'MUDANZA',      color:'#a855f7', label:'Mudanza', maxHours: null },
    { cat:'MERCADO',      color:'#22c55e', label:'Mercado', maxHours: 0.5 },
  ]
  const PAY = [
    { m:'EFECTIVO_USD', label:'Efectivo $'  },
    { m:'EFECTIVO_BS',  label:'Efectivo Bs' },
    { m:'PAGO_MOVIL',   label:'Pago Móvil'  },
    { m:'ZELLE',        label:'Zelle'       },
    { m:'OTRO',         label:'Otro'        }
  ]
  
  const getCatColor = cat => (state.settings?.categories || CAT).find(c => c.id === cat || c.cat === cat)?.color || '#1a1a2e'
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
              if (data.pass_id) {
                stopScanner()
                supabase.from('visitor_passes')
                  .select('*, subscriptions(tower, apt, resident_name)')
                  .eq('id', data.pass_id)
                  .eq('is_used', false)
                  .single().then(({ data: pass }) => {
                    if (!pass) {
                      return showToast("Pase inválido o ya utilizado", "error");
                    }
                    window.scannedPassData = pass;
                    showToast("Pase Válido. Selecciona un puesto libre.", "success");
                    scannerActive = false;
                    currentView = 'MAP';
                    render();
                    
                    // Notificar al residente que su invitado llegó
                    supabase.functions.invoke('send-push', { 
                      body: { 
                        building_id: state.buildingId, 
                        role: 'RESIDENT',
                        identifier: pass.resident_id,
                        title: '👋 Tu invitado ha llegado', 
                        body: `El pase de ${pass.visitor_name} fue verificado en la garita.` 
                      } 
                    });
                  });
              } else if (data.plate && data.slot) {
                stopScanner()
                state.levels.forEach(lvl => {
                  const sIdx = lvl.slots.findIndex(s => s.label === data.slot)
                  if (sIdx !== -1) {
                    selectedSlot = { ...lvl.slots[sIdx], levelName: lvl.name, sIdx }
                    if (selectedSlot) { localStorage.setItem('sloty_selected_slot', JSON.stringify(selectedSlot)) } else { localStorage.removeItem('sloty_selected_slot') }
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
      if (selectedSlot) { localStorage.setItem('sloty_selected_slot', JSON.stringify(selectedSlot)) } else { localStorage.removeItem('sloty_selected_slot') }
      currentView = selectedSlot.status==='FREE' ? 'ENTRY' : 'EXIT'
      render()
    },
    BACK_MAP: () => { stopScanner(); currentView = 'MAP'; currentTab = 'HOME'; scannerActive = false; render() },
    UPDATE_SUB_SEARCH: (val) => { subSearchText = val || ''; render() },
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
       if (selectedSlot) { localStorage.setItem('sloty_selected_slot', JSON.stringify(selectedSlot)) } else { localStorage.removeItem('sloty_selected_slot') }
       currentView = 'EXIT'
       render()
    },
    LOGOUT: () => { showModal('¿Cerrar sesión?', 'Tu progreso se guardará automáticamente.', () => {
      if (window.slotyLogout) window.slotyLogout()
      else {
        localStorage.clear()
        location.reload()
      }
    }) },
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
    },
    SET_SUB_METHOD: (btn) => {
      subPaymentMethod = btn.dataset.method; render()
    },
    SUBMIT_SUB_PAYMENT: async () => {
      const amount = parseFloat(document.getElementById('sub-pay-amount').value) || 0
      const ref = document.getElementById('sub-pay-ref')?.value?.trim() || ''
      const bank = document.getElementById('sub-pay-bank')?.value || ''
      const date = document.getElementById('sub-pay-date')?.value || new Date().toISOString().split('T')[0]
      const method = subPaymentMethod

      if (['PAGO_MOVIL', 'TRANSFERENCIA', 'ZELLE', 'OTRO'].includes(method) && !ref) return showToast('Introduce la referencia o detalles del pago', 'error')

      const evidence_b64 = window.subPaymentPhotoBase64 || null;

      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('subscription_id', selectedResident.id)
        .eq('status', 'PENDING')
        .limit(1)
      if (existing && existing.length > 0) {
        showToast('Este residente ya tiene un pago pendiente de aprobación', 'error')
        return
      }

      // Registramos el pago como PENDIENTE para aprobación de admin
      await supabase.from('payments').insert({
         building_id: state.buildingId || localStorage.getItem('sloty_building_id'),
         subscription_id: selectedResident.id,
         amount: amount,
         method: method,
         reference: ref,
         status: 'PENDING',
         payment_date: date,
         bank: bank,
         evidence_b64: evidence_b64
      })

      // IMPORTANTE: NO actualizamos expiry_date aquí.
      window.subPaymentPhotoBase64 = null;


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
       state = getParkingState()
       if (!state.levels || state.levels.length === 0) return showToast("No hay puestos configurados", "error")
       const level = state.levels.find(l => l.name === (activeLevel || state.levels[0].name))
       if (!level) return showToast("No hay puestos configurados", "error")
       const freeIdx = level.slots.findIndex(s => s.status === 'FREE')
       if (freeIdx !== -1) {
          selectedSlot = { ...level.slots[freeIdx], levelName: level.name, sIdx: freeIdx }
          if (selectedSlot) { localStorage.setItem('sloty_selected_slot', JSON.stringify(selectedSlot)) } else { localStorage.removeItem('sloty_selected_slot') }
          currentView = 'ENTRY'
          render()
       } else showToast("No hay puestos libres", "error")
    },
    CONFIRM_ENTRY: () => {
       state = getParkingState()
       const plate = document.getElementById('entry-plate')?.value.trim().toUpperCase()
       const phone = document.getElementById('entry-phone')?.value.trim()
       if (!plate) return showToast('Ingresa la placa', 'error')

       // COLLECT CUSTOM FIELDS
       const metadata = {}
       let missingField = null
       (state.settings?.customFields || []).forEach(f => {
         const val = document.getElementById(`custom-${f.id}`)?.value.trim()
         if (!val) missingField = f.label
         metadata[f.id] = val
       })
       if (missingField) return showToast(`Falta el campo ${missingField}`, 'error')

       const category = document.querySelector('.cat-active')?.dataset.cat || 'VISITANTE'
       if (!selectedSlot) {
         showToast('Error: No se seleccionó puesto', 'error')
         currentView = 'MAP'; render()
         return
       }
       if (category === 'RESIDENTE') {
          const rentalCap = state.settings?.rentalSlotsCap;
          if (rentalCap != null && rentalCap >= 0) {
             let occupiedResCount = 0;
             state.levels.forEach(l => {
                if (l.slots) {
                   l.slots.forEach(s => {
                      const isEditingSameSlot = (l.name === selectedSlot.levelName && s.label === selectedSlot.label);
                      if (!isEditingSameSlot && s.status === 'OCCUPIED' && s.category === 'RESIDENTE') {
                         occupiedResCount++;
                      }
                   });
                }
             });
             if (occupiedResCount >= rentalCap) {
                return showToast('Cupo de puestos de mensualidad alcanzado', 'error');
             }
          }
       }
       const timing = document.querySelector('.timing-active')?.dataset.timing || 'EXIT'
       const payMethod = timing === 'PRE' ? (document.querySelector('#prepay-selector .pay-active')?.dataset.method || 'EFECTIVO_USD') : null
       
       const lvl = state.levels.find(l=>l.name===selectedSlot.levelName)
       if (!lvl) {
         showToast('Error: Nivel no encontrado', 'error')
         currentView = 'MAP'; render()
         return
       }
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
      if (selectedSlot) { localStorage.setItem('sloty_selected_slot', JSON.stringify(selectedSlot)) } else { localStorage.removeItem('sloty_selected_slot') }
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
          type: 'ENTRY'
        })
      })
      
      if (window.scannedPassData) {
        supabase.from('visitor_passes').update({ is_used: true }).eq('id', window.scannedPassData.id).then(()=>{});
        window.scannedPassData = null;
      }
      
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
         getExchangeRate().then(bcv => {
           if (!bcv?.rate) return;
           const amount = pendingPayment?.amount || 0;
           const bs = Math.round(amount * bcv.rate);
           const elBs  = document.getElementById('bs-equivalent');
           const elRate = document.getElementById('bcv-rate-guard');
           if (elBs)  elBs.textContent  = `Bs. ${bs.toLocaleString('es-VE')}`;
           if (elRate) elRate.textContent = `Tasa BCV: ${Number(bcv.rate).toLocaleString('es-VE', {minimumFractionDigits:2})} · ${bcv.source === 'auto' ? '✓ Oficial' : '⚠️ Manual'}`;
         });
      } else {
         logMovement({
            type: 'ENTRY',
            plate,
            slot: selectedSlot.label,
            category,
            guardName,
            paymentStatus: 'PENDIENTE',
            payMethod: null,
            amount: 0,
            metadata
         });
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
          type: 'EXIT',
          plate: selectedSlot.plate,
          slot: selectedSlot.label,
          category: selectedSlot.category,
          guardName,
          amount: totalOwed,
          method: document.querySelector('.pay-active')?.dataset.method || 'EFECTIVO_USD',
          targetStatus: 'FREE'
        }
        currentView = 'PAYMENT'; render()
getExchangeRate().then(bcv => {
  if (!bcv?.rate) return;
  const amount = pendingPayment?.amount || 0;
  const bs = Math.round(amount * bcv.rate);
  const elBs  = document.getElementById('bs-equivalent');
  const elRate = document.getElementById('bcv-rate-guard');
  if (elBs)  elBs.textContent  = `Bs. ${bs.toLocaleString('es-VE')}`;
  if (elRate) elRate.textContent = `Tasa BCV: ${Number(bcv.rate).toLocaleString('es-VE', {minimumFractionDigits:2})} · ${bcv.source === 'auto' ? '✓ Oficial' : '⚠️ Manual'}`;
});
      } else {
        processExit('FREE')
      }
    },
    EXIT_DEBT: () => processExit('DEBT'),
    FORMA_PRINT: () => printTicket('EXIT'),
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
        payMethod: method,
        entryTime: selectedSlot?.entryTime || null,
        exitTime: new Date().toISOString()
      }
      
      logMovement(mov)
      
      if (pendingPayment.type === 'EXIT') {
        processExit(pendingPayment.targetStatus)
      } else {
        // PREPAGO case: finalizing the entry
        currentView = 'TICKET'; render()
      }
      pendingPayment = null
      showToast('Pago registrado correctamente', 'success')
    },
    FINALIZE_CLOSURE: async () => {
      const openMovs = state.movements.filter(m => !m.closed && m.guardName === guardName)
      const total = openMovs.reduce((a,m) => a + (m.amount || 0), 0)
      const breakdown = openMovs.reduce((acc, m) => {
        acc[m.payMethod] = (acc[m.payMethod] || 0) + (m.amount || 0)
        return acc
      }, {})

      const notes = document.getElementById('closure-notes')?.value?.trim() || ''

      await saveClosure({
        guard: guardName,
        total,
        methods: breakdown,
        movements: openMovs,
        absences: shiftData.absences,
        startedAt: shiftData.startedAt,
        notes: notes
      })

      logNotification('CIERRE_CAJA', guardName, `Cierre completado: $${total.toFixed(2)} acumulados.`)
      await logAudit('FINALIZE_CLOSURE', {
        guard_name: guardName,
        total: total,
        entries: openMovs.filter(m => m.type === 'ENTRY').length,
        exits: openMovs.filter(m => m.type === 'EXIT').length
      });
      showModal('Cierre Exitoso', 'El reporte ha sido enviado a administración. El contador ha vuelto a 0.', () => location.reload())
    },
    ACCEPT_RESERVATION: async (btn) => {
      const subId = btn.dataset.subId;
      const plate = btn.dataset.plate;
      
      // Find a free slot in the active level
      const lvl = state.levels.find(l => l.name === (activeLevel || state.levels[0].name));
      const freeIdx = lvl.slots.findIndex(s => s.status === 'FREE');
      
      if (freeIdx === -1) return showToast("No hay puestos libres para reservar", "error");

      const rentalCap = state.settings?.rentalSlotsCap;
      if (rentalCap != null && rentalCap >= 0) {
         let occupiedResCount = 0;
         state.levels.forEach(l => {
            if (l.slots) {
               l.slots.forEach(s => {
                  if (s.category === 'RESIDENTE') {
                     occupiedResCount++;
                  }
               });
            }
         });
         if (occupiedResCount >= rentalCap) {
            return showToast('Cupo de puestos de mensualidad alcanzado (mensualidades llenas)', 'error');
         }
      }
      
      lvl.slots[freeIdx] = { 
        ...lvl.slots[freeIdx], 
        status: 'RESERVED', 
        plate: plate,
        category: 'RESIDENTE',
        entryTime: new Date().toISOString()
      };
      
      // Update Supabase to say the resident is no longer 'coming' (now it's reserved)
      await supabase.from('subscriptions').update({ is_coming: false }).eq('id', subId);
      
      updateParkingState(state);
      render();
      showToast(`Puesto ${lvl.slots[freeIdx].label} reservado para ${plate}`, "success");
    },
    PAUSE_SHIFT: () => {
      showPinModal('Pausar Turno', 'Ingresa tu PIN de guardia para pausar el turno:', (pin) => {
        const guard = state.personnel?.find(p => p.pin === pin);
        if (!guard) return false;

        if (shiftData) shiftData.pausedAt = new Date().toISOString();
        previousView = currentView;
        currentView = 'PAUSED';
        render();
        return true;
      });
    },
    RESUME_SHIFT: async (pin) => {
      const guard = state.personnel?.find(p => p.pin === pin);
      if (!guard) {
        const errDiv = document.getElementById('resume-pin-error');
        if (errDiv) errDiv.style.display = 'block';
        const input = document.getElementById('resume-pin-paused');
        if (input) {
          input.value = '';
          input.focus();
        }
        return false;
      }

      // Registrar fin de ausencia
      if (shiftData?.pausedAt) {
        const from = shiftData.pausedAt;
        const to = new Date().toISOString();
        const duration_min = Math.round((new Date(to) - new Date(from)) / 60000);
        shiftData.absences = shiftData.absences || [];
        shiftData.absences.push({ from, to, duration_min });
        shiftData.pausedAt = null;
      }

      currentView = previousView || 'MAP';
      render();
      return true;
    },
    CONFIRM_HANDOVER: async () => {
      await render();
    },
    REPORT_INCIDENT: (prefilled) => {
      if (!container.contains(elModal)) {
        container.appendChild(elModal);
      }
      const types = ['RAYÓN', 'ACCIDENTE', 'SOSPECHOSO', 'OBJETO PERDIDO', 'TIEMPO EXCEDIDO', 'OTRO'];
      const pPlate = prefilled?.plate || '';
      const pSlot = prefilled?.slot || '';
      const pType = prefilled?.type || null;
      window.selectedIncidentType = pType;

      const typeButtons = types.map((t) => `
        <button class="incident-type-btn" onclick="handleAction('SELECT_INCIDENT_TYPE','${t}')"
          style="background:${pType === t ? '#e63946' : '#f8f9fa'}; border:1.5px solid ${pType === t ? '#e63946' : '#eee'}; border-radius:12px;
                 padding:10px 14px; font-size:0.75rem; font-weight:900;
                 cursor:pointer; text-align:left; color:${pType === t ? 'white' : '#1a1a2e'};">
          ${t}
        </button>`).join('');

      elModal.innerHTML = html`
        <div style="position:fixed; inset:0; background:rgba(0,0,0,0.6);
                    z-index:9999; display:flex; align-items:flex-end;">
          <div style="background:white; border-radius:24px 24px 0 0;
                      padding:24px; width:100%; max-height:90vh; overflow-y:auto;">
            <div style="font-size:0.7rem; font-weight:900; color:#999;
                        letter-spacing:2px; text-transform:uppercase; margin-bottom:16px;">
              Reportar Incidente
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;">
              ${typeButtons}
            </div>
            <div style="font-size:0.7rem; font-weight:900; color:#999;
                        text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
              Placa involucrada (opcional)
            </div>
            <input id="incident-plate" type="text" inputmode="text" autocapitalize="characters" placeholder="ABC-123" value="${pPlate}"
                   style="width:100%; padding:12px 16px; border:1.5px solid #eee;
                          border-radius:12px; font-size:0.85rem; font-weight:700;
                          margin-bottom:12px; box-sizing:border-box;" />
            <div style="font-size:0.7rem; font-weight:900; color:#999;
                        text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
              Puesto involucrado (opcional)
            </div>
            <input id="incident-slot" placeholder="A-01" value="${pSlot}"
                   style="width:100%; padding:12px 16px; border:1.5px solid #eee;
                          border-radius:12px; font-size:0.85rem; font-weight:700;
                          margin-bottom:12px; box-sizing:border-box;" />
            <div style="font-size:0.7rem; font-weight:900; color:#999;
                        text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
              Descripción
            </div>
            <textarea id="incident-desc" rows="3" placeholder="Describe lo que ocurrió..."
                   style="width:100%; padding:12px 16px; border:1.5px solid #eee;
                          border-radius:12px; font-size:0.85rem; font-weight:700;
                          margin-bottom:16px; box-sizing:border-box; resize:none;"></textarea>
            <div style="display:flex; gap:8px;">
              <button onclick="handleAction('SUBMIT_INCIDENT')"
                style="flex:1; background:#e63946; color:white; border:none;
                       border-radius:50px; padding:14px; font-size:0.8rem;
                       font-weight:900; cursor:pointer;">
                REPORTAR
              </button>
              <button onclick="handleAction('CLOSE_MODAL')"
                style="flex:1; background:#f8f9fa; color:#1a1a2e; border:none;
                       border-radius:50px; padding:14px; font-size:0.8rem;
                       font-weight:900; cursor:pointer;">
                CANCELAR
              </button>
            </div>
            <button onclick="handleAction('VIEW_INCIDENTS')" style="width:100%; background:none; color:#1a1a2e; border:1.5px solid #1a1a2e; border-radius:50px; padding:12px; font-size:0.8rem; font-weight:900; cursor:pointer; margin-top:10px;">VER MIS REPORTES</button>
          </div>
        </div>`;
      elModal.style.display = 'flex';
    },
    SELECT_INCIDENT_TYPE: (payload) => {
      window.selectedIncidentType = payload;
      document.querySelectorAll('.incident-type-btn').forEach(b => {
        const isMatch = b.textContent.trim() === payload;
        b.style.background = isMatch ? '#e63946' : '#f8f9fa';
        b.style.borderColor = isMatch ? '#e63946' : '#eee';
        b.style.color = isMatch ? 'white' : '#1a1a2e';
      });
    },
    SUBMIT_INCIDENT: async () => {
      state = getParkingState()
      const buildingId = getBuildingId() || state.buildingId
      const selectedType = window.selectedIncidentType;

      if (!selectedType) {
        showToast('Selecciona el tipo de incidente', 'error');
        return;
      }

      const desc = document.querySelector('#incident-desc')?.value?.trim();
      if (!desc) {
        showToast('Agrega una descripción del incidente', 'error');
        return;
      }

      const plate = document.querySelector('#incident-plate')?.value?.trim() || null;
      const slot  = document.querySelector('#incident-slot')?.value?.trim() || null;

      const { error } = await supabase.from('incidents').insert({
        building_id: buildingId,
        guard_name:  shiftData.guardName || guardName,
        type:        selectedType,
        description: desc,
        plate,
        slot,
        resolved:    false
      });

      if (error) {
        showToast('Error al reportar el incidente. Intenta de nuevo.', 'error');
        console.error(error);
        return;
      }

      await logAudit('REPORT_INCIDENT', { type: selectedType, plate, slot });

      supabase.functions.invoke('send-push', { 
        body: { 
          building_id: buildingId, 
          role: 'ADMIN', 
          title: '⚠️ Nuevo incidente reportado', 
          body: `${selectedType} — ${desc.slice(0,60)}` 
        } 
      });

      elModal.style.display = 'none';
      elModal.innerHTML = '';
      showToast('Incidente reportado exitosamente', 'success');
    },
    CLOSE_MODAL: () => {
      elModal.style.display = 'none';
      elModal.innerHTML = '';
    },
    VIEW_INCIDENTS: async () => {
      state = getParkingState()
      const buildingId = getBuildingId() || state.buildingId
      if (!container.contains(elModal)) {
        container.appendChild(elModal);
      }
      elModal.innerHTML = html`<div style="padding:40px;text-align:center;color:white;font-weight:900;">Cargando tus reportes...</div>`;
      elModal.style.display = 'block';

      const { data, error } = await supabase.from('incidents')
        .select('*')
        .eq('building_id', buildingId)
        .eq('guard_name', guardName)
        .order('created_at', { ascending: false })
        .limit(10);
        
      let listHtml = '';
      if (error || !data || data.length === 0) {
         listHtml = '<div style="color:#999;font-weight:700;text-align:center;margin:20px 0;">No hay incidentes previos reportados por ti.</div>';
      } else {
         listHtml = data.map(inc => `
           <div style="background:#f8f9fa; border-radius:12px; padding:15px; margin-bottom:10px; text-align:left; border-left:4px ${inc.resolved ? 'solid #22c55e' : 'solid #e63946'};">
             <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <span style="font-size:0.75rem; font-weight:900; color:var(--primary);">${inc.type}</span>
                <span style="font-size:0.6rem; color:#bbb; font-weight:800;">${new Date(inc.created_at).toLocaleDateString()}</span>
             </div>
             <div style="font-size:0.7rem; color:#666; font-weight:700; margin-bottom:8px;">${inc.description}</div>
             ${inc.admin_response ? `
               <div style="background:#eaf3de; padding:10px; border-radius:8px; border:1px solid #bbf7d0;">
                 <div style="font-size:0.6rem; font-weight:900; color:#166534; margin-bottom:3px;">RESPUESTA ADMIN:</div>
                 <div style="font-size:0.7rem; color:#166534; font-weight:700;">"${inc.admin_response}"</div>
               </div>
             ` : `<div style="font-size:0.6rem; color:#e63946; font-weight:900;">EN ESPERA DE RESPUESTA</div>`}
           </div>
         `).join('');
      }
      
      elModal.innerHTML = html`
          <div style="position:fixed; top:0; left:0; width:100%; height:100vh;
                      background:rgba(0,0,0,0.8); z-index:99999; display:flex;
                      align-items:center; justify-content:center; padding:20px;">
            <div style="background:white; width:100%; max-width:400px;
                        border-radius:24px; padding:24px; text-align:center;
                        animation: popIn 0.3s forwards;">
               <h3 style="font-weight:900; color:var(--primary); margin:0 0 15px;">MIS REPORTES (Últimos 10)</h3>
               <div style="max-height:60vh; overflow-y:auto; margin-bottom:20px;">${listHtml}</div>
               <button onclick="handleAction('CLOSE_MODAL')" style="width:100%; background:#f8f9fa; color:#1a1a2e; border:none; border-radius:50px; padding:14px; font-size:0.8rem; font-weight:900; cursor:pointer;">CERRAR</button>
            </div>
          </div>
      `;
    }
  }

  const processExit = (newStatus) => {
    const payMethod = document.querySelector('.pay-active')?.dataset.method || 'EFECTIVO_USD'
    const lvl = state.levels.find(l=>l.name===selectedSlot.levelName)
    const slotData = lvl.slots[selectedSlot.sIdx]
    lvl.slots[selectedSlot.sIdx] = { ...slotData, status:newStatus, plate: newStatus==='FREE'?null:slotData.plate, phone: newStatus==='FREE'?null:slotData.phone, entryTime: newStatus==='FREE'?null:slotData.entryTime }
    updateParkingState(state); 
    const realAmount = pendingPayment?.amount || 0
    logMovement({ 
      type: 'EXIT', 
      plate: slotData.plate, 
      slot: slotData.label, 
      category: slotData.category, 
      guardName, 
      paymentStatus: newStatus === 'FREE' ? 'PAGADO' : 'DEUDA', 
      payMethod, 
      amount: realAmount,
      entryTime: slotData.entryTime,
      exitTime: new Date().toISOString()
    })
    
    // Persistir sesión de estacionamiento en Supabase
    const vState = getParkingState()
    const finalAmount = pendingPayment?.amount || 0
    supabase.from('parking_sessions').insert({
      building_id: vState.buildingId,
      vehicle_plate: selectedSlot?.plate || '',
      entry_time: selectedSlot?.entryTime || new Date().toISOString(),
      exit_time: new Date().toISOString(),
      guard_name: vState.guardName || '',
      category: selectedSlot?.category || '',
      slot_label: selectedSlot?.label || '',
      amount: finalAmount || 0,
      pay_method: payMethod || '',
      status: 'EXITED'
    }).then(({ error }) => {
      if (error) console.warn('[Sloty] parking_sessions insert error:', error)
    })

    // Registrar salida en trazabilidad
    import('../visitors.js').then(m => {
      m.logAccess({
        visitor_id: null,
        guard_name: guardName,
        full_name: slotData.metadata?.nombre || 'Vehículo Estacionado',
        plate: slotData.plate || '',
        visits_to: slotData.metadata?.apto ? `Apto ${slotData.metadata.apto}` : '',
        type: 'EXIT'
      });
    });

    currentView='MAP'; render()
  }

  const checkOvertimeVisitors = (state) => {
     let overstayMsg = '';
     
     state.levels.forEach(level => {
        level.slots.forEach(slot => {
           if (slot.status === 'OCCUPIED' && slot.entryTime && slot.category) {
              const list = state.settings?.categories || CAT;
              const catObj = list.find(c => c.id === slot.category || c.cat === slot.category);
              const maxHours = catObj ? catObj.maxHours : null;
              
              if (maxHours != null && maxHours > 0) {
                 const hoursStayed = (new Date() - new Date(slot.entryTime)) / 3600000;
                 if (hoursStayed > maxHours) {
                    const labelName = catObj.label || slot.category;
                    const name = slot.metadata?.nombre || slot.plate || labelName;
                    const phone = slot.phone || '';
                    
                    let waButton = '';
                    if (phone) {
                       let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
                       if (cleaned.length === 10 || cleaned.length === 11) {
                          if (!cleaned.startsWith('58')) {
                             cleaned = '58' + (cleaned.length === 11 ? cleaned.slice(1) : cleaned);
                          }
                       } else if (cleaned.length > 7 && !cleaned.startsWith('58')) {
                          cleaned = ''; // formateo no válido
                       }
                       
                       if (cleaned.length >= 10 && cleaned.startsWith('58')) {
                          const message = encodeURIComponent(`Hola ${name}, te escribimos desde ${state.buildingName} — tu tiempo de visita (${labelName}) está por vencer, por favor coordina tu salida.`);
                          waButton = `<button onclick="window.open('https://wa.me/${cleaned}?text=${message}', '_blank')" style="background:#22c55e; color:white; border:none; padding:8px 12px; border-radius:10px; font-weight:900; cursor:pointer; font-size:0.65rem; margin-top:8px;">ESCRÍBELE AL VISITANTE (WP)</button>`;
                       }
                    }
                    
                    overstayMsg += `
                      <div style="background:#fff3cd; border:2px solid #ffeeba; border-radius:16px; padding:15px; margin-bottom:10px;">
                         <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                               <div style="font-size:0.7rem; font-weight:900; color:#856404; text-transform:uppercase;">EXCEDE TIEMPO PERMITIDO (${labelName.toUpperCase()})</div>
                               <div style="font-size:1rem; font-weight:900; color:#856404; margin-top:4px;">${name}</div>
                               <div style="font-size:0.7rem; color:#856404; font-weight:700;">Placa: ${slot.plate} · Puesto: ${slot.label}</div>
                            </div>
                            <button onclick="handleAction('REPORT_INCIDENT', {plate:'${slot.plate}', slot:'${slot.label}', type:'TIEMPO EXCEDIDO'})" style="background:#856404; color:white; border:none; border-radius:10px; padding:6px 10px; font-weight:900; font-size:0.65rem; cursor:pointer; height:fit-content;">REPORTAR</button>
                         </div>
                         ${waButton}
                      </div>
                    `;
                 }
              }
           }
        });
     });
     return overstayMsg;
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
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
            <div style="font-size:0.65rem;font-weight:900;color:rgba(255,255,255,0.4);letter-spacing:1px;text-transform:uppercase;">GARITA ACTIVA</div>
            <span style="background:rgba(245,197,24,0.15); color:#F5C518; font-size:0.65rem; font-weight:900; padding:2px 8px; border-radius:6px; border:1px solid rgba(245,197,24,0.3);">${state.buildingCode || ''}</span>
            <span id="header-conn-status" style="font-size:0.65rem; font-weight:900; padding:2px 8px; border-radius:6px; background:${navigator.onLine ? 'rgba(34,197,94,0.15)' : 'rgba(245,197,24,0.15)'}; color:${navigator.onLine ? '#22c55e' : '#ce8a05'}; border:1px solid ${navigator.onLine ? 'rgba(34,197,94,0.3)' : 'rgba(245,197,24,0.3)'};">
               ● ${navigator.onLine ? 'En Línea' : 'Offline'}
            </span>
            <span id="header-sync-queue" style="font-size:0.65rem; font-weight:900; padding:2px 8px; border-radius:6px; background:rgba(255,255,255,0.06); color:#ce8a05; border:1px solid rgba(255,255,255,0.15); display:${getSyncQueueCount() > 0 ? 'inline-block' : 'none'};">
               ⏳ Carga: <b id="header-sync-count">${getSyncQueueCount()}</b>
            </span>
          </div>
          <div style="font-size:1.1rem; font-weight:900; color:white; margin-top:2px;">${(state.buildingName || '').toUpperCase()}</div>
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
        <div style="text-align:right; flex-shrink:0;">
          <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;">DISPONIBLES</div>
          <div id="header-disp" style="font-size:2.4rem;font-weight:900;color:#F5C518;line-height:0.9;">${total-occ}<span style="font-size:0.6rem; color:rgba(255,255,255,0.3); display:block;">de ${total} puestos</span></div>
        </div>
      </div>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
        <button data-action="PAUSE_SHIFT" style="background:#1a1a2e; color:#F5C518; border:2px solid rgba(245,197,24,0.3); border-radius:16px; padding:12px; font-size:0.75rem; font-weight:900; letter-spacing:1px; cursor:pointer;">
          ⏸ PAUSAR TURNO
        </button>
        <button onclick="handleAction('REPORT_INCIDENT')" style="background:#e63946; color:white; border:none; border-radius:16px; padding:12px; font-size:0.75rem; font-weight:900; letter-spacing:1px; cursor:pointer;">
          ⚠️ INCIDENTE
        </button>
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

    state.personnel = personnel || []

    screens.guardPin.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;padding:40px 24px;">
        <div style="display:flex;width:100%;justify-content:space-between;align-items:center;margin-bottom:30px;">
          <button id="btn-back-guard" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.5rem;cursor:pointer;">←</button>
          <button id="btn-change-build" style="background:rgba(255,255,255,0.1);border:none;color:white;padding:6px 12px;border-radius:8px;font-size:0.6rem;font-weight:900;cursor:pointer;">CAMBIAR EDIFICIO</button>
        </div>
        <img src="/sloty-logo-v2.png" alt="Sloty" style="width:120px;height:auto;display:block;margin-bottom:8px;" />
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

    // Si no hay nivel, solo ocultamos el mapa pero dejamos la búsqueda
    const hasLevels = !!level;

    return `
    <div style="background:#1a1a2e;padding:0 16px 20px;display:flex;gap:12px;overflow-x:auto;">
      ${state.levels.map(l=>`<button data-action="TAB_LEVEL" data-level="${l.name}" style="padding:10px 20px;border-radius:24px;border:none;font-weight:700;font-size:0.8rem;background:${activeLevel===l.name?'#F5C518':'rgba(255,255,255,0.08)'};color:${activeLevel===l.name?'#1a1a2e':'white'};">${l.name}</button>`).join('')}
    </div>

    <!-- INCOMING NOTIFICATION BANNER -->
    <div id="incoming-residents-area" style="padding:0 20px;"></div>
    <div id="overtime-banner-area" style="padding:0 20px; margin-top:20px;">
       ${checkOvertimeVisitors(state)}
    </div>
    <div id="push-banner-area" style="padding:0 20px; margin-top:20px;">
       ${window.renderPushBanner ? window.renderPushBanner() : ''}
    </div>

    <div style="padding:16px 20px 100px;">
      
      <div style="z-index:100; margin-bottom:20px;">
         <div id="scanner-wrapper" style="margin-bottom:15px; ${scannerActive ? '' : 'display:none;'}">
            <div id="qr-reader" style="border-radius:24px; overflow:hidden; background: #000; aspect-ratio: 1/1; box-shadow:0 10px 30px rgba(0,0,0,0.2);"></div>
            <button data-action="BACK_MAP" style="width:100%; padding:14px; background:white; color:#e63946; border:2px solid #e63946; border-radius:14px; margin-top:15px; font-weight:800; font-size:0.75rem;">CANCELAR ESCANEO</button>
         </div>
         
         ${!scannerActive ? `
           <div style="background:white; padding:15px; border-radius:24px; box-shadow:0 10px 30px rgba(0,0,0,0.05); margin-bottom:15px;">
              <div style="font-size:0.6rem; font-weight:900; color:#999; text-transform:uppercase; margin-bottom:10px;">SALIDA RÁPIDA</div>
              <div style="display:flex; gap:10px; align-items:center;">
                 <input type="text" id="fast-exit-plate" inputmode="text" autocapitalize="characters" placeholder="Ej. ABC123" style="flex:1; min-width:0; box-sizing:border-box; border:2px solid #eee; border-radius:14px; padding:14px; font-weight:900; outline:none; text-transform:uppercase;">
                 <button data-action="FAST_EXIT_SEARCH" style="background:#1a1a2e; color:#F5C518; border:none; padding:14px 20px; border-radius:14px; font-weight:900; flex-shrink:0; cursor:pointer;">BUSCAR</button>
              </div>
           </div>
           
           <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <button data-action="SHOW_SCANNER" style="background:#1a1a2e; color:#F5C518; padding:18px; border:none; border-radius:18px; font-weight:900; font-size:0.8rem; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 10px 20px rgba(26,26,46,0.3);">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                 ESCANEAR (ENTRADAS / SALIDAS)
              </button>
              <button data-action="SHOW_MANUAL_ENTRY" style="background:#22c55e; color:white; padding:18px; border:none; border-radius:18px; font-weight:900; font-size:0.8rem; box-shadow:0 10px 20px rgba(34,197,94,0.3);">
                 NUEVO INGRESO
              </button>
           </div>
         ` : ''}
      </div>

      ${hasLevels ? `
      <div class="parking-canvas" style="margin-bottom:80px;">
        <div class="parking-column">${level.slots.slice(0, Math.ceil(level.slots.length/2)).map((s,i)=>renderSpot(s,level.name,i)).join('')}</div>
        <div class="parking-lane"><div style="opacity:0.1; font-size:3rem;">↑</div></div>
        <div class="parking-column">${level.slots.slice(Math.ceil(level.slots.length/2)).map((s,i)=>renderSpot(s,level.name,i+Math.ceil(level.slots.length/2))).join('')}</div>
      </div>
      ` : '<div style="padding:40px 20px; text-align:center; color:#999; font-weight:700;">No hay puestos configurados.<br><span style="font-size:0.7rem; color:#bbb; margin-top:10px; display:block;">Pide a un administrador que asigne puestos a este edificio de Supabase.</span></div>'}
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
    const freeHours = state.settings?.freeHours || 8
    const limit = new Date(now.getTime() + freeHours * 3600000)
    
    return `
    <div style="padding:20px;padding-bottom:100px;">
      
      <!-- PREMIUM TICKET HEADER -->
      <div style="background:#1a1a2e; color:white; border-radius:24px 24px 0 0; padding:30px 24px; position:relative; overflow:hidden;">
        <div style="font-size:0.6rem; font-weight:500; color:var(--accent); letter-spacing:2px; margin-bottom:5px;">TICKET DE INGRESO</div>
        <div style="display:flex; justify-content:space-between; align-items:flex-end;">
          <div>
            <div style="font-size:2rem; font-weight:700; letter-spacing:-1px; color:var(--accent);">${state.buildingName.toUpperCase()}</div>
            <div style="display:flex; gap:15px; margin-top:8px;">
               <div>
                 <div style="font-size:0.55rem; font-weight:500; color:rgba(255,255,255,0.4); text-transform:uppercase;">INGRESO</div>
                 <div style="font-size:0.9rem; font-weight:900;">${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}).toLowerCase()}</div>
               </div>
               <div>
                 <div style="font-size:0.55rem; font-weight:500; color:#F5C518; text-transform:uppercase;">VENCE LÍMITE (${freeHours}h)</div>
                 <div style="font-size:0.9rem; font-weight:900; color:#F5C518;">${limit.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}).toLowerCase()}</div>
               </div>
            </div>
          </div>
          <div style="text-align:right;">
             <div style="font-size:0.6rem; font-weight:500; color:rgba(255,255,255,0.4); margin-bottom:4px;">ASIGNADO A</div>
             <div style="font-size:2.4rem; font-weight:900; color:#22c55e; line-height:0.8;">${selectedSlot.label}</div>
          </div>
        </div>
        <div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:rgba(34,197,94,0.05); border-radius:50%; pointer-events:none;"></div>
      </div>

        ${window.scannedPassData ? `
          <div style="background:#e0f2fe; border:2px solid #3b82f6; border-radius:16px; padding:15px; margin-bottom:15px;">
            <div style="font-size:0.6rem; font-weight:900; color:#0284c7; text-transform:uppercase; margin-bottom:4px;">PASE VERIFICADO</div>
            <div style="font-size:1.1rem; font-weight:900; color:#1a1a2e;">${window.scannedPassData.visitor_name}</div>
            <div style="font-size:0.75rem; font-weight:700; color:#0284c7;">A Torre ${window.scannedPassData.subscriptions?.tower || '-'} Apto ${window.scannedPassData.subscriptions?.apt || '-'}</div>
            <button onclick="window.scannedPassData=null; handleAction('BACK_MAP')" style="font-size:0.6rem; margin-top:8px; background:none; border:none; text-decoration:underline; color:#e63946; cursor:pointer;">Cancelar Pase</button>
          </div>
        ` : ''}

        <input type="text" id="entry-plate" inputmode="text" autocapitalize="characters" placeholder="PLACA" value="${window.scannedPassData?.visitor_plate || ''}" style="width:100%;padding:18px;border:2px solid #eee;border-radius:12px;font-size:1.8rem;font-weight:900;text-align:center;margin-bottom:15px;">
        <input type="tel" id="entry-phone" placeholder="WHATSAPP (Opcional)" style="width:100%;padding:14px;border:2px solid #eee;border-radius:12px;margin-bottom:15px;">
        
        <!-- DYNAMIC CUSTOM FIELDS -->
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
          ${(state.settings?.customFields && state.settings.customFields.length > 0 ? state.settings.customFields : [
             {id:'nombre', label:'Nombre del Visitante'}, 
             {id:'torre', label:'Torre'}, 
             {id:'apto', label:'Piso / Apto'}
          ]).map(f => {
            const fid = f.id.toLowerCase();
            let defVal = '';
            if (window.scannedPassData) {
               if (fid === 'nombre' || fid === 'nombre completo' || fid.includes('visitante')) defVal = window.scannedPassData.visitor_name;
               else if (fid === 'torre' || fid === 'edificio') defVal = window.scannedPassData.subscriptions?.tower || '';
               else if (fid.includes('apto') || fid.includes('piso')) defVal = window.scannedPassData.subscriptions?.apt || '';
            }
            return `
            <div>
              <label style="font-size:0.6rem; font-weight:500; color:#999; margin-left:12px; text-transform:uppercase;">${f.label} *</label>
              <input type="text" id="custom-${f.id}" placeholder="Ingresar ${f.label.toLowerCase()}" value="${defVal}" required
                style="width:100%; padding:14px; border:2px solid #eee; border-radius:12px; font-weight:700; outline:none; text-transform:uppercase;">
            </div>
          `}).join('')}
        </div>

        <div style="grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px; display: ${state.settings?.categories?.length ? 'grid' : 'none'};">
          ${(state.settings?.categories || CAT).map((c,i)=>`<button class="cat-chip ${i===0?'cat-active':''}" data-cat="${c.id || c.cat}" data-color="${c.color}" style="padding:10px;border-radius:12px;border:2px solid #eee;background:white;font-size:0.7rem;font-weight:700;">${c.label}</button>`).join('')}
        </div>
        
        <div style="background:#f8f9fa;padding:15px;border-radius:16px;margin-bottom:20px;text-align:center;">
          <div style="font-size:0.6rem;font-weight:500;color:#999;margin-bottom:10px;">¿CUÁNDO PAGARÁ?</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px; margin-bottom:12px;">
            <button class="timing-chip timing-active" data-timing="EXIT" style="padding:12px;border-radius:12px;border:none;font-weight:700;">AL SALIR</button>
            <button class="timing-chip" data-timing="PRE" style="padding:12px;border-radius:12px;border:none;font-weight:700;">PRE-PAGO ($${
               (state.settings?.tariffs?.filter(t => t.active).length > 0) ? state.settings.tariffs.filter(t => t.active)[0].baseRate : (state.settings?.baseRate || 1)
            })</button>
          </div>
          
          <div id="prepay-selector" style="display:none; transition: all 0.3s;">
             <div style="font-size:0.55rem; font-weight:500; color:#bbb; margin:10px 0 8px;">MÉTODO DE PAGO</div>
             <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                ${PAY.map((p,i) => `<button class="pay-chip ${i===0?'pay-active':''}" data-method="${p.m}" style="padding:8px; border-radius:12px; border:1px solid #eee; background:white; font-size:0.55rem; font-weight:700;">${p.label}</button>`).join('')}
             </div>
          </div>
        </div>
        <button data-action="CONFIRM_ENTRY" class="btn-new-entry" style="width:100%; padding:18px; border:none; border-radius:16px; font-size:0.9rem; font-weight:700; background:#1a1a2e;color:#F5C518;box-shadow: 0 10px 20px rgba(26,26,46,0.2);">↓ CONFIRMAR INGRESO</button>
      </div>
    </div>`
  }

  const renderSuccessTicket = () => {
    const slot = selectedSlot
    const qrData = JSON.stringify({ plate: slot.plate, slot: slot.label })
    const now = new Date()
    const freeHours = state.settings?.freeHours || 8
    const limit = new Date(now.getTime() + freeHours * 3600000)
    
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
                 <div style="font-size:0.6rem; font-weight:800; color:#bbb; text-transform:uppercase; margin-bottom:5px;">VENCE LÍMITE (${freeHours}h)</div>
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
    let totalOwed = 0
    let appliedTariffName = 'CORTESÍA / PAGADO'
    
    const activeTariffs = state.settings?.tariffs?.filter(t => t.active) || [];
    
    if (activeTariffs.length > 0) {
       for (let t of activeTariffs) {
           if (hoursStayed > t.freeHours || selectedSlot.status === 'DEBT') {
               if (t.baseRate >= totalOwed) {
                   totalOwed = t.baseRate;
                   appliedTariffName = t.name;
               }
           }
       }
    } else {
       const freeHours = state.settings?.freeHours || 8;
       if (hoursStayed > freeHours || selectedSlot.status === 'DEBT') {
           totalOwed = state.settings?.baseRate || 1;
           appliedTariffName = 'TARIFA BASE';
       }
    }
    
    if (selectedSlot.paymentStatus === 'PAGADO') {
       if (totalOwed > 0) {
          appliedTariffName = 'MULTA POR D�A ADICIONAL';
       } else {
          appliedTariffName = 'PAGADO EN PRE-PAGO';
       }
    }
    if (selectedSlot.status === 'DEBT' && totalOwed === 0 && selectedSlot.paymentStatus !== 'PAGADO') {
       totalOwed = activeTariffs.length > 0 ? activeTariffs[0].baseRate : (state.settings?.baseRate || 1);
       appliedTariffName = 'PAGO DE DEUDA';
    }
    
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
           <div style="font-size:0.6rem; font-weight:700; color:${totalOwed > 0 ? '#e63946' : '#22c55e'}; margin-top:4px;">${appliedTariffName.toUpperCase()}</div>
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
<div style="background:rgba(245,197,24,0.1); border:1.5px solid #F5C518;
            border-radius:14px; padding:12px; margin-top:12px; text-align:left;">
  <div style="font-size:0.65rem; font-weight:900; color:#D97706; margin-bottom:6px;">
    ⚠️ Equivalente en Bolívares
  </div>
  <div id="bs-equivalent" style="font-size:1.2rem; font-weight:900; color:#1a1a2e;">
    Calculando...
  </div>
  <div id="bcv-rate-guard" style="font-size:0.6rem; color:#999; font-weight:700; margin-top:2px;">
    Cargando tasa BCV...
  </div>
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
     if (!hasFeature('debt_tracking')) {
       return `<div style="padding:40px;text-align:center;">
         <div style="font-size:2rem;margin-bottom:12px;">🔒</div>
         <div style="font-weight:900;color:white;font-size:0.85rem;">
           Función no disponible</div>
         <div style="font-size:0.65rem;color:#999;margin-top:8px;line-height:1.5;">
           El cobro de mensualidades está disponible desde el plan Plata.
         </div>
       </div>`
     }

     const search = subSearchText.toLowerCase()
     const filtered = cachedResidents.filter(r => r.resident_name.toLowerCase().includes(search) || r.plate.toLowerCase().includes(search))

     return `
     <div style="padding:20px; padding-bottom:120px;">
        <h2 style="font-weight:900; color:var(--primary); margin-bottom:15px;">COBRAR MENSUALIDAD</h2>
        <input type="text" id="sub-search" inputmode="text" autocapitalize="characters" placeholder="Buscar por placa o nombre..." value="${subSearchText}" oninput="window.handleAction('UPDATE_SUB_SEARCH', this.value)" style="width:100%; padding:15px; border-radius:15px; border:2px solid #eee; margin-bottom:20px; font-weight:700; font-family:'Montserrat'; outline:none;">
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

  const renderSubPaymentForm = () => {
     // Calculo de deuda
     const exp = new Date(selectedResident.expiry_date || Date.now());
     let monthsOwed = (new Date() - exp) / (1000 * 60 * 60 * 24 * 30);
     monthsOwed = monthsOwed > 0 ? Math.ceil(monthsOwed) : 0;
     const debt = monthsOwed * (selectedResident.custom_price || 0);

     return `
     <div style="padding:20px; padding-bottom:120px;">
        <div style="background:white; border-radius:32px; padding:30px; box-shadow:0 15px 45px rgba(0,0,0,0.1);">
           <h2 style="font-weight:900; color:var(--primary); margin-bottom:5px; text-align:center;">PAGO DE MENSUALIDAD</h2>
           <div style="font-size:0.8rem; font-weight:700; color:#666; text-align:center; margin-bottom:20px;">${selectedResident.resident_name}</div>

           <div id="debt-card" data-debt="${debt.toFixed(2)}" style="background:${debt>0?'#FCEBEB':'#EAF3DE'}; padding:15px; border-radius:15px; text-align:center; margin-bottom:20px; border:1.5px solid ${debt>0?'#fca5a5':'#bbf7d0'};">
             <div style="font-size:0.6rem; font-weight:900; color:${debt>0?'#e63946':'#16a34a'}; text-transform:uppercase;">DEUDA ESTIMADA</div>
             <div style="font-size:1.8rem; font-weight:950; color:${debt>0?'#e63946':'#16a34a'};">$${debt.toFixed(2)}</div>
             <div id="debt-bs-equiv" style="font-size:0.75rem; font-weight:800; color:${debt>0?'#991b1b':'#166534'}; margin-top:2px;">calculando Bs...</div>
             <div style="font-size:0.65rem; color:${debt>0?'#991b1b':'#166534'}; font-weight:700;">${monthsOwed} Mes(es) Vencido(s)</div>
           </div>

           <div style="margin-bottom:20px;">
              <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">ABONO A REGISTRAR</label>
              <input id="sub-pay-amount" type="number" step="0.01" value="${subPaymentAmount}" style="width:100%; border:2px solid #eee; border-radius:18px; padding:18px; font-size:1.4rem; font-weight:900; outline:none; font-family:'Montserrat';">
           </div>

           <div style="margin-bottom:20px;">
              <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">MÉTODO DE PAGO</label>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                 ${PAY.map(p => `<button data-action="SET_SUB_METHOD" data-method="${p.m}" style="padding:10px; border-radius:10px; border:2px solid ${subPaymentMethod === p.m ? '#1a1a2e' : '#eee'}; background:${subPaymentMethod === p.m ? '#1a1a2e' : 'white'}; color:${subPaymentMethod === p.m ? 'white' : '#1a1a2e'}; font-size:0.65rem; font-weight:900;">${p.label}</button>`).join('')}
              </div>
           </div>

           ${['PAGO_MOVIL', 'ZELLE', 'OTRO'].includes(subPaymentMethod) ? `
              <div style="margin-bottom:20px;">
                 <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">REFERENCIA ${subPaymentMethod==='OTRO'?'/ ESPECIFICAR':''}</label>
                 <input id="sub-pay-ref" type="text" placeholder="Ej: 4522..." style="width:100%; border:2px solid #eee; border-radius:18px; padding:18px; font-size:1.4rem; font-weight:900; outline:none; font-family:'Montserrat';">
                 
                 <div style="margin-top:15px;">
                    <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:10px; display:block;">EVIDENCIA FOTOGRÁFICA</label>
                    <input type="file" id="sub-pay-photo" accept="image/*" capture="environment" style="display:none;" onchange="
                        const f = this.files[0];
                        if(!f) return;
                        const reader = new FileReader();
                        reader.onload = e => {
                           const img = new Image();
                           img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const max = 500;
                              let w = img.width; let h = img.height;
                              if (w > h) { if (w > max) { h *= max / w; w = max; } }
                              else { if (h > max) { w *= max / h; h = max; } }
                              canvas.width = w; canvas.height = h;
                              const ctx = canvas.getContext('2d');
                              ctx.drawImage(img, 0, 0, w, h);
                              window.subPaymentPhotoBase64 = canvas.toDataURL('image/jpeg', 0.6);
                              document.getElementById('sub-photo-preview').src = window.subPaymentPhotoBase64;
                              document.getElementById('sub-photo-preview').style.display = 'block';
                           };
                           img.src = e.target.result;
                        };
                        reader.readAsDataURL(f);
                    ">
                    <button onclick="document.getElementById('sub-pay-photo').click()" style="background:#f4f4f4; color:#666; border:2px dashed #ccc; border-radius:14px; width:100%; padding:15px; font-weight:900; cursor:pointer;">
                      📷 ADJUNTAR CAPTURA / FOTO
                    </button>
                    <img id="sub-photo-preview" style="display:none; width:100%; object-fit:cover; border-radius:14px; margin-top:10px; max-height:200px; border:2px solid #eee;">
                 </div>
              </div>
              </div>
           ` : ''}

           <button data-action="SUBMIT_SUB_PAYMENT" style="width:100%; padding:20px; background:#22c55e; color:white; border:none; border-radius:20px; font-weight:900; font-size:0.9rem; box-shadow:0 10px 25px rgba(34,197,94,0.3);">
              CONFIRMAR MENSUALIDAD
           </button>
        </div>
     </div>
  `
}

  const renderClosureSummary = () => {
    const openMovs = state.movements.filter(m => !m.closed && m.guardName === guardName)
    const total = openMovs.reduce((a,m) => a + (m.amount || 0), 0)
    const breakdown = openMovs.reduce((acc, m) => {
      acc[m.payMethod] = (acc[m.payMethod] || 0) + (m.amount || 0)
      return acc
    }, {})
    
    const todayEntries = state.movements.filter(m => m.type === 'ENTRY' && !m.closed && m.guardName === guardName).length;
    const todayExits = state.movements.filter(m => m.type === 'EXIT' && !m.closed && m.guardName === guardName).length;

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
          <div style="display:grid; gap:8px; margin-bottom:20px; max-height:200px; overflow-y:auto;">
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

          <div style="margin-bottom:20px; text-align:left;">
             <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">COMENTARIOS AL MÁSTER (Opcional)</label>
             <textarea id="closure-notes" rows="3" placeholder="Añade algún comentario sobre tu guardia..." style="width:100%; border:2px solid #eee; border-radius:18px; padding:15px; font-weight:700; font-family:var(--font); outline:none; resize:none;"></textarea>
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
    container.innerHTML = html`
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

  const renderShiftHandover = async (state, guardName) => {
    if (!state || !state.buildingId) return null;
    // Buscar el último turno cerrado de este edificio
    let lastShift = null;
    try {
      const { data: shifts } = await supabase
        .from('guard_shifts')
        .select('*')
        .eq('building_id', state.buildingId)
        .order('ended_at', { ascending: false })
        .limit(1);
      if (shifts && shifts.length > 0) {
        lastShift = shifts[0];
      }
    } catch (e) {
      console.warn("Error fetching last shift:", e);
    }

    if (!lastShift) return null; // primer turno, no hay entrega

    const earned = (lastShift.total_cash||0) + (lastShift.total_mobile||0) + (lastShift.total_bs||0);
    const end = new Date(lastShift.ended_at).toLocaleString('es-VE', { dateStyle:'short', timeStyle:'short' });

    // Contar carros actualmente adentro
    const carsInside = (state.movements||[]).filter(m => m.type === 'ENTRY' && !m.closed).length;

    return `
      <div style="min-height:100vh; background:#1a1a2e; display:flex;
                  flex-direction:column; align-items:center; justify-content:center;
                  padding:30px; text-align:center;">
        <div style="font-size:2rem; margin-bottom:8px;">🔄</div>
        <div style="font-size:0.7rem; font-weight:900; color:#F5C518;
                    letter-spacing:3px; text-transform:uppercase; margin-bottom:4px;">
          Entrega de Turno
        </div>
        <div style="font-size:0.75rem; color:rgba(255,255,255,0.4); margin-bottom:24px;">
          Último turno cerrado: ${end}
        </div>

        <div style="background:rgba(255,255,255,0.05); border-radius:24px;
                    padding:20px; width:100%; max-width:320px; margin-bottom:16px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
            <div style="background:#F5C518; border-radius:14px; padding:14px;">
              <div style="font-size:1.3rem; font-weight:900; color:#1a1a2e;">$${earned.toFixed(2)}</div>
              <div style="font-size:0.6rem; font-weight:900; color:#1a1a2e; margin-top:2px;">RECAUDADO</div>
            </div>
            <div style="background:rgba(255,255,255,0.08); border-radius:14px; padding:14px;">
              <div style="font-size:1.3rem; font-weight:900; color:white;">${carsInside}</div>
              <div style="font-size:0.6rem; font-weight:900; color:rgba(255,255,255,0.5); margin-top:2px;">CARROS ADENTRO</div>
            </div>
            <div style="background:rgba(255,255,255,0.08); border-radius:14px; padding:14px;">
              <div style="font-size:1.3rem; font-weight:900; color:white;">${lastShift.entries||0}</div>
              <div style="font-size:0.6rem; font-weight:900; color:rgba(255,255,255,0.5); margin-top:2px;">ENTRADAS</div>
            </div>
            <div style="background:rgba(255,255,255,0.08); border-radius:14px; padding:14px;">
              <div style="font-size:1.3rem; font-weight:900; color:white;">${lastShift.exits||0}</div>
              <div style="font-size:0.6rem; font-weight:900; color:rgba(255,255,255,0.5); margin-top:2px;">SALIDAS</div>
            </div>
          </div>

          <div style="font-size:0.65rem; color:rgba(255,255,255,0.4);
                      font-weight:700; text-align:left; margin-bottom:6px;">
            GUARDIA ANTERIOR
          </div>
          <div style="display:flex; align-items:center; gap:10px;
                      background:rgba(255,255,255,0.05); border-radius:12px; padding:10px;">
            <div style="width:36px; height:36px; border-radius:50%; background:#F5C518;
                        color:#1a1a2e; font-size:0.9rem; font-weight:900;
                        display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              ${lastShift.guard_name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
            </div>
            <div style="text-align:left;">
              <div style="font-size:0.8rem; font-weight:900; color:white;">${lastShift.guard_name}</div>
              <div style="font-size:0.65rem; color:rgba(255,255,255,0.4); font-weight:700;">Turno completado</div>
            </div>
          </div>
        </div>

        <button data-action="CONFIRM_HANDOVER"
                style="background:#F5C518; color:#1a1a2e; border:none;
                       border-radius:50px; padding:14px 40px; font-size:0.8rem;
                       font-weight:900; letter-spacing:1px; cursor:pointer;
                       text-transform:uppercase; width:100%; max-width:320px;">
          ENTENDIDO — INICIAR MI TURNO
        </button>
      </div>`;
  };

  const render = async () => {
    const freshState = getParkingState()
    if (!elShell) renderShell(freshState)

    if (currentView === 'PAUSED') {
      if (elShell) elShell.style.display = 'none';
      const footer = container.querySelector('#guard-footer-area');
      if (footer) footer.style.display = 'none';

      const html = `
        <div style="display:flex; flex-direction:column; align-items:center;
                    justify-content:center; height:100vh; background:#1a1a2e;
                    color:white; text-align:center; padding:40px; font-family:'Montserrat', sans-serif;">
          <div style="font-size:3rem; margin-bottom:16px;">🔒</div>
          <div style="font-size:1rem; font-weight:900; color:#F5C518;
                      text-transform:uppercase; letter-spacing:2px;">
            Turno Pausado
          </div>
          <div style="font-size:0.75rem; color:rgba(255,255,255,0.5); margin-top:8px;">
            Ingresa tu PIN de guardia para continuar
          </div>
          <input id="resume-pin-paused" type="password" inputmode="numeric"
                 maxlength="6" placeholder="••••"
                 style="margin-top:24px; padding:16px 24px; border-radius:50px;
                        border:2px solid #F5C518; background:transparent;
                        color:white; font-size:1.6rem; text-align:center;
                        width:180px; outline:none; font-weight:900;"
                 oninput="if(this.value.length >= 4) window.handleAction('RESUME_SHIFT', this.value)" />
          <div id="resume-pin-error" style="color:#e63946; font-size:0.75rem; font-weight:700; margin-top:12px; display:none;">PIN incorrecto</div>
        </div>`;

      elContent.innerHTML = html;
      setTimeout(() => {
        const input = document.getElementById('resume-pin-paused');
        if (input) input.focus();
      }, 100);
      return;
    }

    if (elShell) elShell.style.display = 'block';
    const footerElement = container.querySelector('#guard-footer-area');
    if (footerElement) footerElement.style.display = 'block';
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
    else if (currentView === 'SUB_PAYMENT_LOADING') {
      html = `
        <div style="padding:20px; font-family:'Montserrat', sans-serif;">
          <div style="font-size:0.7rem; font-weight:900; color:#999; letter-spacing:2px; text-transform:uppercase; margin-bottom:16px;">Mensualidades</div>
          <div style="height:48px; background:#eef0f3; border-radius:14px; margin-bottom:20px; animation: pulse 1.5s infinite ease-in-out;"></div>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${[1, 2, 3, 4].map(() => `
              <div style="background:white; border-radius:20px; padding:16px; border:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                <div style="flex:1;">
                  <div style="height:14px; width:45%; background:#eef0f3; border-radius:6px; margin-bottom:8px; animation: pulse 1.5s infinite; opacity:0.6;"></div>
                  <div style="height:10px; width:70%; background:#eef0f3; border-radius:4px; animation: pulse 1.5s infinite; opacity:0.6;"></div>
                </div>
                <div style="height:32px; width:70px; background:#eef0f3; border-radius:10px; animation: pulse 1.5s infinite; opacity:0.6;"></div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    if (elContent.innerHTML !== html) {
      elContent.innerHTML = html;
      if (scannerActive) initQRScanner()
      setupLocalInteractions()
    }

    // Populate BCV equivalent for debt display
    if (currentView === 'SUB_PAYMENT_FORM') {
      getExchangeRate().then(bcv => {
        const el = document.getElementById('debt-bs-equiv');
        if (!el) return;
        const debtCard = document.getElementById('debt-card');
        const debt = parseFloat(debtCard?.dataset?.debt || '0');
        if (bcv?.rate) {
          el.textContent = debt > 0
            ? `≈ Bs. ${Math.round(debt * bcv.rate).toLocaleString('es-VE')} (Tasa BCV: ${Number(bcv.rate).toFixed(2)})`
            : 'Sin deuda';
        } else {
          el.textContent = 'Tasa BCV no disponible';
        }
      });
    }

    if (currentView === 'MAP') checkIncomingResidents();
    
    const footer = container.querySelector('#guard-footer-area')
    if (['MAP', 'SUB_PAYMENT', 'CLOSURE', 'SUB_PAYMENT_LOADING'].includes(currentView)) {
       footer.innerHTML = renderBottomNav();
    } else {
       footer.innerHTML = html`
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
        let subs = []
        if (navigator.onLine) {
          try {
            const { data } = await supabase.from('subscriptions').select('resident_name, apt, vehicle_brand, vehicle_model, vehicle_color').eq('building_id', buildingId).ilike('plate', `%${plate}%`)
            subs = data || []
          } catch(e) {
            console.warn('[Sloty] Error querying subscriptions online, fallback to offline:', e)
          }
        }

        // Búsqueda de respaldo offline para residentes en state.levels y cachedResidents
        if (subs.length === 0) {
          if (cachedResidents && cachedResidents.length > 0) {
            const matches = cachedResidents.filter(r => r.plate && r.plate.toUpperCase().includes(plate.toUpperCase()))
            matches.forEach(m => {
              subs.push({
                resident_name: m.resident_name || 'Residente',
                apt: m.apt || '',
                vehicle_brand: m.vehicle_brand || '',
                vehicle_model: m.vehicle_model || '',
                vehicle_color: m.vehicle_color || ''
              })
            })
          }
          if (subs.length === 0 && state && state.levels) {
            state.levels.forEach(level => {
              if (level.slots) {
                level.slots.forEach(slot => {
                  if (slot.plate && slot.plate.toUpperCase().includes(plate.toUpperCase()) && slot.category === 'RESIDENTE') {
                    subs.push({
                      resident_name: slot.metadata?.nombre || 'Residente',
                      apt: slot.metadata?.apto || '',
                      vehicle_brand: '',
                      vehicle_model: '',
                      vehicle_color: ''
                    })
                  }
                })
              }
            })
          }
        }

        if (subs && subs.length > 0) {
           const infoDiv = document.createElement('div')
           infoDiv.id = 'visitor-suggestion'
           infoDiv.style = "background:#F5C518; color:#1a1a2e; padding:10px; border-radius:10px; margin-bottom:10px; font-weight:900; font-size:0.75rem; text-align:center;"
           const res = subs[0];
           infoDiv.innerHTML = `
             <div>🚗 RESIDENTE: ${res.resident_name} (Apto ${res.apt || '-'})</div>
             ${res.vehicle_brand || res.vehicle_model || res.vehicle_color ? `
               <div style="font-size:0.6rem; color:rgba(26,26,46,0.6); font-weight:700; margin-top:4px;">
                 ${[res.vehicle_brand, res.vehicle_model, res.vehicle_color].filter(Boolean).join(' · ')}
               </div>` : ''}
           `;
           plateEl.parentNode.insertBefore(infoDiv, plateEl.nextSibling)
           
           const catBtn = document.querySelector('[data-cat="RESIDENTE"]')
           if(catBtn) {
              document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('cat-active'))
              catBtn.classList.add('cat-active')
           }

           const btnConfirm = document.querySelector('[data-action="CONFIRM_ENTRY"]');
           if (btnConfirm) {
              btnConfirm.style.transform = 'scale(1.05)';
              btnConfirm.style.boxShadow = '0 0 20px rgba(22, 163, 74, 0.5)';
              btnConfirm.style.background = '#16a34a';
              btnConfirm.focus();
           }
        } else {
           window.cachedVisitor = null;
           const resultList = await searchVisitorByPlate(plate);
           const found = resultList && resultList.length > 0 ? resultList[0] : null;
           if (!found) return;
           
           window.cachedVisitor = found;

           const banner = document.createElement('div');
           banner.id = 'visitor-freq-banner';
           banner.style.cssText = 'background:linear-gradient(135deg, #1a1a2e, #16213e); color:white; padding:12px; border-radius:12px; margin-top:8px; display:flex; justify-content:space-between; align-items:center; border:1px solid #F5C518;';
           banner.innerHTML = html`
             <div>
               <div style="color:#F5C518;font-size:0.6rem;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">⭐ VISITANTE FRECUENTE</div>
               <div style="font-size:1rem;font-weight:900;">${found.name || found.company}</div>
               <div style="font-size:0.7rem;opacity:0.7;">${found.visit_count || 1} visitas anteriores · ${found.r_visits_to || ''}</div>
             </div>
             <div style="display:flex; gap:8px;">
                <button id="btn-use-freq" style="background:#22c55e; color:white; border:none; padding:8px 12px; border-radius:8px; font-weight:900; font-size:0.7rem; cursor:pointer;">SÍ, MISMO DESTINO</button>
                <button id="btn-edit-freq" style="background:#444; color:white; border:none; padding:8px 12px; border-radius:8px; font-weight:900; font-size:0.7rem; cursor:pointer;">EDITAR</button>
             </div>
           `;
           plateEl.parentNode.insertBefore(banner, plateEl.nextSibling);

           setTimeout(() => {
              document.getElementById('btn-use-freq').onclick = () => {
                  const catBtn = document.querySelector('.cat-chip[data-cat="' + (found.category || 'VISITANTE') + '"]');
                  if (catBtn) catBtn.click();
                 const phoneEl = document.getElementById('entry-phone');
                 if (phoneEl) phoneEl.value = found.phone || '';
                 const nameEl = document.getElementById('custom-nombre');
                 if (nameEl) nameEl.value = found.name || found.full_name || '';
                 const aptoEl = document.getElementById('custom-apto');
                 if (aptoEl) {
                    const vTo = found.visits_to || found.r_visits_to || '';
                    aptoEl.value = vTo.startsWith('Apto ') ? vTo.slice(5) : vTo;
                 }
                 banner.remove();
              };
              document.getElementById('btn-edit-freq').onclick = () => {
                 const phoneEl = document.getElementById('entry-phone');
                  if (phoneEl) phoneEl.value = found.phone || '';
                  const nameEl = document.getElementById('custom-nombre');
                  if (nameEl) nameEl.value = found.name || found.full_name || '';
                  const aptoEl = document.getElementById('custom-apto');
                  if (aptoEl) {
                     const vTo = found.visits_to || found.r_visits_to || '';
                     aptoEl.value = vTo.startsWith('Apto ') ? vTo.slice(5) : vTo;
                  }
                 banner.remove();
                 const catBtn = document.querySelector('.cat-chip[data-cat="' + (found.category || 'VISITANTE') + '"]');
                  if (catBtn) catBtn.click();
              };
           }, 0);
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

  const startModule = async () => {
    const handover = await renderShiftHandover(state, guardName);
    if (handover) {
      container.innerHTML = handover;
    } else {
      await render();
    }
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

  startModule()

  container._cleanup = () => {
    clearInterval(syncInt)
    window.removeEventListener('sloty-sync-updated', handleSyncUpdated)
    window.removeEventListener('sloty-connection-status', handleConnectionStatus)
    window.removeEventListener('sloty-sync-downloaded', handleSyncDownloaded)
    window.removeEventListener('sloty-resident-coming', handleResidentComing)
  }
}
