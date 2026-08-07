import fs from 'fs';

// 1. PATCH guard.js
let guardPath = 'src/modules/guard.js';
let content = fs.readFileSync(guardPath, 'utf8');

// A. Initialize elModal and previousView
const targetModal = '  let elModal = null';
const replModal = `  let elModal = document.createElement('div')
  elModal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(5px);z-index:9998;display:none;align-items:center;justify-content:center;padding:20px;"
  container.appendChild(elModal)`;

if (content.includes(targetModal)) {
  content = content.replace(targetModal, replModal);
  console.log('✓ Replaced elModal initialization');
} else {
  console.log('⚠ Could not find targetModal');
}

const targetActiveLevel = '  let activeLevel = null';
const replActiveLevel = `  let activeLevel = null
  let previousView = 'MAP'`;

if (content.includes(targetActiveLevel)) {
  content = content.replace(targetActiveLevel, replActiveLevel);
  console.log('✓ Replaced activeLevel and previousView');
}

// B. Safeguard CONFIRM_ENTRY
const targetConfirmEntry = `    CONFIRM_ENTRY: () => {
      const plate = document.getElementById('entry-plate')?.value.trim().toUpperCase()`;
const replConfirmEntry = `    CONFIRM_ENTRY: () => {
      if (!selectedSlot) return showToast('No hay puesto seleccionado', 'error')
      const plate = document.getElementById('entry-plate')?.value.trim().toUpperCase()`;

if (content.includes(targetConfirmEntry)) {
  content = content.replace(targetConfirmEntry, replConfirmEntry);
  console.log('✓ Replaced CONFIRM_ENTRY start check');
}

const targetEditing = '                      const isEditingSameSlot = (l.name === selectedSlot.levelName && s.label === selectedSlot.label);';
const replEditing = '                      const isEditingSameSlot = selectedSlot && (l.name === selectedSlot.levelName && s.label === selectedSlot.label);';

if (content.includes(targetEditing)) {
  content = content.replace(targetEditing, replEditing);
  console.log('✓ Replaced isEditingSameSlot check');
}

// C. Fix setupLocalInteractions Click Handlers (Visitor Autocomplete)
const targetLocal = `            setTimeout(() => {
               document.getElementById('btn-use-freq').onclick = () => {
                  document.getElementById('movement-name').value = found.name || '';
                  document.getElementById('movement-company').value = found.company || '';
                  document.getElementById('movement-ci').value = found.ci || '';
                  
                  const fields = found.last_custom_fields || {};
                  if (fields['torre'] && document.getElementById('cf-torre')) document.getElementById('cf-torre').value = fields['torre'];
                  if (fields['piso'] && document.getElementById('cf-piso')) document.getElementById('cf-piso').value = fields['piso'];
                  if (fields['apartamento'] && document.getElementById('cf-apartamento')) document.getElementById('cf-apartamento').value = fields['apartamento'];
                  if (fields['destino_final'] && document.getElementById('cf-destino_final')) document.getElementById('cf-destino_final').value = fields['destino_final'];
                  
                  banner.remove();
                  document.querySelector('.cat-chip[data-cat="VISITA"]')?.click();
               };
               document.getElementById('btn-edit-freq').onclick = () => {
                  document.getElementById('movement-name').value = found.name || '';
                  document.getElementById('movement-ci').value = found.ci || '';
                  banner.remove();
                  document.querySelector('.cat-chip[data-cat="VISITA"]')?.click();
               };
            }, 0);`;

const replLocal = `            setTimeout(() => {
               const useFreqBtn = document.getElementById('btn-use-freq');
               if (useFreqBtn) {
                  useFreqBtn.onclick = () => {
                     const nameEl = document.getElementById('custom-nombre');
                     if (nameEl) nameEl.value = found.name || found.company || '';
                     
                     const fields = found.last_custom_fields || {};
                     Object.keys(fields).forEach(key => {
                        const el = document.getElementById(\`custom-\${key}\`);
                        if (el) el.value = fields[key];
                     });
                     
                     banner.remove();
                     document.querySelector('.cat-chip[data-cat="VISITANTE"]')?.click();
                  };
               }
               const editFreqBtn = document.getElementById('btn-edit-freq');
               if (editFreqBtn) {
                  editFreqBtn.onclick = () => {
                     const nameEl = document.getElementById('custom-nombre');
                     if (nameEl) nameEl.value = found.name || found.company || '';
                     banner.remove();
                     document.querySelector('.cat-chip[data-cat="VISITANTE"]')?.click();
                  };
               }
            }, 0);`;

if (content.includes(targetLocal)) {
  content = content.replace(targetLocal, replLocal);
  console.log('✓ Replaced autocomplete handlers');
} else {
  console.log('⚠ Could not find targetLocal for autocomplete');
}

// D. Hiding header & footer during PAUSE, custom renderPausedScreen, and Skeleton loader in render
const targetRenderHdr = `  // ── RENDER COMPONENTS ────────────────────────────────────────
  const renderHeader = (state) => {`;
const replRenderHdr = `  const renderPausedScreen = () => {
    return \`
      <div style="display:flex; flex-direction:column; align-items:center;
                  justify-content:center; min-height:85vh; background:#1a1a2e;
                  color:white; text-align:center; padding:40px; border-radius:24px; margin:20px;">
        <div style="font-size:4rem; margin-bottom:20px;">🔒</div>
        <div style="font-size:1.3rem; font-weight:900; color:#F5C518;
                    text-transform:uppercase; letter-spacing:2px;">
          Turno Pausado
        </div>
        <div style="font-size:0.85rem; color:rgba(255,255,255,0.5);
                    margin-top:10px;">
          Ingresa tu PIN de guardia para continuar
        </div>
        <input id="resume-pin" type="password" inputmode="numeric"
               maxlength="6" placeholder="••••••"
               style="margin-top:30px; padding:15px 25px; border-radius:50px;
                      border:3px solid #F5C518; background:transparent;
                      color:white; font-size:1.8rem; text-align:center;
                      width:200px; outline:none; letter-spacing:8px;"
               oninput="if(this.value.length>=4) handleAction('RESUME_SHIFT', this.value)" />
      </div>\`;
  }

  // ── RENDER COMPONENTS ────────────────────────────────────────
  const renderHeader = (state) => {`;

if (content.includes(targetRenderHdr)) {
  content = content.replace(targetRenderHdr, replRenderHdr);
  console.log('✓ Added renderPausedScreen helper');
}

// E. PAUSE / RESUME actions
const targetPauseResume = `    PAUSE_SHIFT: () => {
      showPinModal('Pausar Turno', 'Ingresa tu PIN de guardia para pausar el turno:', (pin) => {
        const guard = state.personnel?.find(p => p.pin === pin);
        if (!guard) return false;

        if (shiftData) shiftData.pausedAt = new Date().toISOString();

        document.body.innerHTML = \`
          <div style="display:flex; flex-direction:column; align-items:center;
                      justify-content:center; height:100vh; background:#1a1a2e;
                      color:white; text-align:center; padding:40px;">
            <div style="font-size:3rem; margin-bottom:16px;">🔒</div>
            <div style="font-size:1rem; font-weight:900; color:#F5C518;
                        text-transform:uppercase; letter-spacing:2px;">
              Turno Pausado
            </div>
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.5);
                        margin-top:8px;">
              Ingresa tu PIN para continuar
            </div>
            <input id="resume-pin" type="password" inputmode="numeric"
                   maxlength="6" placeholder="••••••"
                   style="margin-top:24px; padding:12px 20px; border-radius:50px;
                          border:2px solid #F5C518; background:transparent;
                          color:white; font-size:1.2rem; text-align:center;
                          width:160px; outline:none;"
                   oninput="if(this.value.length>=4) handleAction('RESUME_SHIFT', this.value)" />
          </div>\`;
        return true;
      });
    },
    RESUME_SHIFT: async (pin) => {
      const guard = state.personnel?.find(p => p.pin === pin);
      if (!guard) {
        document.querySelector('#resume-pin').value = '';
        document.querySelector('#resume-pin').placeholder = 'PIN incorrecto';
        return;
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

      // Volver al panel normal (restaurar shell si fue borrado por innerHTML global)
      location.reload();
    },`;

const replPauseResume = `    PAUSE_SHIFT: () => {
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
        const pinEl = document.querySelector('#resume-pin');
        if (pinEl) {
          pinEl.value = '';
          pinEl.placeholder = 'Incorrecto';
        }
        return;
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
      await render();
    },`;

if (content.includes(targetPauseResume)) {
  content = content.replace(targetPauseResume, replPauseResume);
  console.log('✓ Replaced PAUSE_SHIFT and RESUME_SHIFT logic');
} else {
  console.log('⚠ Could not find targetPauseResume');
}

// F. SHOW_SUB_PAYMENT background loading
const targetBtnPay = `    SHOW_SUB_PAYMENT: async () => {
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
    },`;

const replBtnPay = `    SHOW_SUB_PAYMENT: async () => {
      // Show immediately if we already have cached data to prevent screen freezing
      if (cachedResidents && cachedResidents.length > 0) {
         currentView = 'SUB_PAYMENT';
         render();
      } else {
         currentView = 'SUB_PAYMENT_LOADING';
         render();
      }
      const buildingId = state.buildingId || localStorage.getItem('sloty_building_id')
      if (!buildingId) { showToast('Edificio no identificado', 'error'); return }
      
      try {
        const [ { data: subs }, { data: pays } ] = await Promise.all([
          supabase.from('subscriptions').select('*').eq('building_id', buildingId),
          supabase.from('payments').select('*').eq('building_id', buildingId).eq('status', 'PENDING')
        ]);
        
        cachedResidents = subs || [];
        cachedResidents.forEach(r => {
          r.hasPending = (pays || []).some(p => p.subscription_id === r.id);
        });
      } catch (err) {
        console.error("Error fetching subscription data:", err);
      }

      currentView = 'SUB_PAYMENT';
      render();
    },`;

if (content.includes(targetBtnPay)) {
  content = content.replace(targetBtnPay, replBtnPay);
  console.log('✓ Replaced SHOW_SUB_PAYMENT logic');
} else {
  console.log('⚠ Could not find targetBtnPay');
}

// G. render function refactoring (Hiding elements on PAUSED + Skeletons loading)
const targetRenderFunc = `  const render = async () => {
    if (!elContent) {
      renderShell(state)
    }
    const freshState = getParkingState()
    let html = ''
    if (currentView === 'MAP') html = renderMap(freshState)
    else if (currentView === 'ENTRY') html = renderEntryForm()
    else if (currentView === 'EXIT') html = renderExitForm()
    else if (currentView === 'TICKET') html = renderSuccessTicket()
    else if (currentView === 'PAYMENT') html = renderPaymentForm()
    else if (currentView === 'CLOSURE') html = renderClosureSummary()
    else if (currentView === 'SUB_PAYMENT') html = renderSubPaymentView()
    else if (currentView === 'SUB_PAYMENT_FORM') html = renderSubPaymentForm()
    else if (currentView === 'SUB_PAYMENT_LOADING') html = \`<div style="text-align:center; padding:100px 20px; font-weight:900; color:#999;">CARGANDO RESIDENTES...</div>\`
    
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
            ? \`≈ Bs. \${Math.round(debt * bcv.rate).toLocaleString('es-VE')} (Tasa BCV: \${Number(bcv.rate).toFixed(2)})\`
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
       footer.innerHTML = \`
         <div style="position:fixed;bottom:0;left:0;width:100%;padding:16px;background:white;border-top:1px solid #eee;z-index:200;">
           <button data-action="BACK_MAP" style="width:100%;padding:16px;background:#f8f9fa;border:none;border-radius:16px;font-weight:700;color:#999;">← VOLVER</button>
         </div>\`
    }
  }`;

const replRenderFunc = `  const render = async () => {
    if (!elContent) {
      renderShell(state)
    }
    const freshState = getParkingState()
    
    if (currentView === 'PAUSED') {
      if (elShell) elShell.style.display = 'none';
      const footer = container.querySelector('#guard-footer-area');
      if (footer) footer.style.display = 'none';
      
      const html = renderPausedScreen();
      if (elContent.innerHTML !== html) {
        elContent.innerHTML = html;
        const pinInp = document.getElementById('resume-pin');
        if (pinInp) {
          setTimeout(() => pinInp.focus(), 50);
        }
      }
      return;
    }

    if (elShell) {
      elShell.style.display = 'block';
      elShell.innerHTML = renderHeader(freshState);
    }

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
      html = \`
      <div style="padding:20px;">
         <style>
           @keyframes skeleton-shine {
             0% { background-position: 100% 50%; }
             100% { background-position: 0% 50%; }
           }
           .skeleton-box {
             background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
             background-size: 200% 100%;
             animation: skeleton-shine 1.5s infinite;
             border-radius: 8px;
           }
         </style>
         <h2 style="font-weight:900; color:var(--primary); margin-bottom:15px;">COBRAR MENSUALIDAD</h2>
         <div class="skeleton-box" style="height:50px; border-radius:15px; margin-bottom:20px; width:100%;"></div>
         
         <div style="display:grid; gap:12px;">
            \${[1, 2, 3, 4].map(() => \`
               <div style="background:white; padding:15px; border-radius:20px; border:1.5px solid #f0f0f0; display:flex; justify-content:space-between; align-items:center;">
                  <div style="flex:1;">
                     <div class="skeleton-box" style="height:16px; width:60%; margin-bottom:8px;"></div>
                     <div class="skeleton-box" style="height:12px; width:40%; margin-bottom:6px;"></div>
                     <div class="skeleton-box" style="height:10px; width:30%;"></div>
                  </div>
                  <div class="skeleton-box" style="height:35px; width:80px; border-radius:12px;"></div>
               </div>
            \`).join('')}
         </div>
      </div>\`;
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
            ? \`≈ Bs. \${Math.round(debt * bcv.rate).toLocaleString('es-VE')} (Tasa BCV: \${Number(bcv.rate).toFixed(2)})\`
            : 'Sin deuda';
        } else {
          el.textContent = 'Tasa BCV no disponible';
        }
      });
    }

    if (currentView === 'MAP') checkIncomingResidents();
    
    const footer = container.querySelector('#guard-footer-area')
    if (footer) {
      footer.style.display = 'block';
      if (['MAP', 'SUB_PAYMENT', 'CLOSURE', 'SUB_PAYMENT_LOADING'].includes(currentView)) {
         footer.innerHTML = renderBottomNav();
      } else {
         footer.innerHTML = \`
           <div style="position:fixed;bottom:0;left:0;width:100%;padding:16px;background:white;border-top:1px solid #eee;z-index:200;">
             <button data-action="BACK_MAP" style="width:100%;padding:16px;background:#f8f9fa;border:none;border-radius:16px;font-weight:700;color:#999;">← VOLVER</button>
           </div>\`
      }
    }
  }`;

if (content.includes(targetRenderFunc)) {
  content = content.replace(targetRenderFunc, replRenderFunc);
  console.log('✓ Replaced render function');
} else {
  console.log('⚠ Could not find targetRenderFunc');
}

// H. Adding building code and name explicitly in header template
const targetBld = '          <div style="font-size:0.6rem;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:2px;">GARITA ACTIVA</div>';
const replBld = '          <div style="font-size:0.6rem;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:2px;">GARITA ACTIVA · ${(state.buildingName || \'\').toUpperCase()} [\${state.buildingCode || \'\'}]</div>';

if (content.includes(targetBld)) {
  content = content.replace(targetBld, replBld);
  console.log('✓ Added explicit building code and name to renderHeader template');
} else {
  console.log('⚠ Could not find targetBld');
}

fs.writeFileSync(guardPath, content, 'utf8');
console.log('✓ guard.js patched successfully!');


// 2. PATCH main.js
let mainPath = 'src/main.js';
let mainContent = fs.readFileSync(mainPath, 'utf8');

const targetMainSync = '            await syncDown(buildingData.code);';
const replMainSync = "            syncDown(buildingData.code).catch(e => console.warn('syncDown error:', e));";

if (mainContent.includes(targetMainSync)) {
  mainContent = mainContent.replace(targetMainSync, replMainSync);
  console.log('✓ Replaced blocking syncDown with async syncDown in main.js');
  fs.writeFileSync(mainPath, mainContent, 'utf8');
} else {
  console.log('⚠ Could not find targetMainSync in main.js');
}
