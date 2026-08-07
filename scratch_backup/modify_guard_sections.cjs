const fs = require('fs');

let content = fs.readFileSync('src/modules/guard.js', 'utf8');

// Normalize line endings to \n
content = content.replace(/\r\n/g, '\n');

// 1. Update imports
const oldImport = `import { getParkingState, updateParkingState, logMovement, logNotification, saveClosure, supabase, hasFeature, showToast } from '../db.js'`;
const newImport = `import { getParkingState, updateParkingState, logMovement, logNotification, saveClosure, supabase, hasFeature, showToast, getExchangeRate } from '../db.js'`;

if (content.includes(oldImport)) {
  content = content.replace(oldImport, newImport);
  console.log('Imports updated successfully');
} else {
  console.log('Imports already updated or not found');
}

// 2. Declare bcvData and load it on start
const oldVars = `  let subPaymentAmount = 0
  let subPaymentMethod = 'EFECTIVO_USD'
  let selectedResident = null`;
const newVars = `  let subPaymentAmount = 0
  let subPaymentMethod = 'EFECTIVO_USD'
  let selectedResident = null
  let bcvData = null

  // Fetch exchange rate automatically on guard module load
  getExchangeRate().then(bcv => {
    bcvData = bcv;
    if (typeof render === 'function') render();
  }).catch(e => console.warn('Exchange rate load error in guard:', e));`;

if (content.includes(oldVars)) {
  content = content.replace(oldVars, newVars);
  console.log('Variables cache updated successfully');
} else {
  console.log('Variables already updated or not found');
}

// 3. Update SELECT_RESIDENT_PAY, SET_SUB_METHOD, and SUBMIT_SUB_PAYMENT
const oldActions = `    SELECT_RESIDENT_PAY: (btn) => {
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

      if (['PAGO_MOVIL', 'TRANSFERENCIA'].includes(method) && !ref) return showToast('Introduce la referencia', 'error')

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
    },`;

const newActions = `    SELECT_RESIDENT_PAY: (btn) => {
      const id = btn.dataset.id
      selectedResident = cachedResidents.find(r => r.id === id)
      subPaymentAmount = selectedResident.custom_price || 0
      subPaymentMethod = 'EFECTIVO_USD'
      currentView = 'SUB_PAYMENT_FORM'; render()
    },
    SET_SUB_METHOD: (btn) => {
      subPaymentMethod = btn.dataset.method
      const rate = bcvData?.rate || 40
      if (subPaymentMethod === 'EFECTIVO_BS' || subPaymentMethod === 'PAGO_MOVIL') {
        const inp = document.getElementById('sub-pay-amount')
        if (inp && parseFloat(inp.value) === selectedResident.custom_price) {
          subPaymentAmount = Math.round((selectedResident.custom_price || 10) * rate)
        }
      } else {
        const inp = document.getElementById('sub-pay-amount')
        if (inp && Math.abs(parseFloat(inp.value) - Math.round((selectedResident.custom_price || 10) * rate)) < 5) {
          subPaymentAmount = selectedResident.custom_price || 10
        }
      }
      render()
    },
    SUBMIT_SUB_PAYMENT: async () => {
      const amountInputVal = parseFloat(document.getElementById('sub-pay-amount').value) || 0
      const ref = document.getElementById('sub-pay-ref')?.value?.trim() || ''
      const bank = document.getElementById('sub-pay-bank')?.value || ''
      const date = document.getElementById('sub-pay-date')?.value || new Date().toISOString().split('T')[0]
      const method = subPaymentMethod

      if (['PAGO_MOVIL', 'TRANSFERENCIA'].includes(method) && !ref) return showToast('Introduce la referencia', 'error')

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

      let finalUsdAmount = amountInputVal
      let processedRef = ref
      const rate = bcvData?.rate || 40

      if (method === 'EFECTIVO_BS' || method === 'PAGO_MOVIL') {
        finalUsdAmount = amountInputVal / rate
        processedRef = \`\${ref} (Bs. \${Number(amountInputVal).toFixed(2)})\`.trim()
      }

      // Registramos el pago como PENDIENTE para aprobación de admin
      await supabase.from('payments').insert({
         building_id: state.buildingId || localStorage.getItem('sloty_building_id'),
         subscription_id: selectedResident.id,
         amount: finalUsdAmount,
         method: method,
         reference: processedRef,
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
         amount: finalUsdAmount,
         payMethod: method,
         reference: processedRef,
         paymentStatus: 'PENDIENTE',
         metadata: { bank, date }
      })

      showToast('Pago registrado. Pendiente de aprobación por administración.', 'success')
      currentView = 'MAP'; render()
    },`;

if (content.includes(oldActions)) {
  content = content.replace(oldActions, newActions);
  console.log('Abono actions updated successfully');
} else {
  console.log('Abono actions already updated or not found');
}

// 4. Update renderExitForm display totalOwed equivalent
const oldExitBlock = `        <div style="background:#f8f9fa; border-radius:16px; padding:15px; margin-bottom:24px; text-align:center; border:2px solid \${totalOwed > 0 ? '#e63946' : '#22c55e'};">
           <div style="font-size:0.6rem; font-weight:900; color:#999; text-transform:uppercase;">MONTO A COBRAR</div>
           <div style="font-size:2.2rem; font-weight:950; color:\${totalOwed > 0 ? '#e63946' : '#22c55e'};">$` + `\${totalOwed.toFixed(2)}</div>
           \${totalOwed > 0 ? \`<div style="font-size:0.6rem; font-weight:700; color:#e63946; margin-top:4px;">EXCESO DE TIEMPO (+8H)</div>\` : \`<div style="font-size:0.6rem; font-weight:700; color:#22c55e; margin-top:4px;">CORTESÍA / PAGADO</div>\`}
        </div>`;

const newExitBlock = `        <div style="background:#f8f9fa; border-radius:16px; padding:15px; margin-bottom:24px; text-align:center; border:2px solid \${totalOwed > 0 ? '#e63946' : '#22c55e'};">
           <div style="font-size:0.6rem; font-weight:900; color:#999; text-transform:uppercase;">MONTO A COBRAR</div>
           <div style="font-size:2.2rem; font-weight:950; color:\${totalOwed > 0 ? '#e63946' : '#22c55e'};">$` + `\${totalOwed.toFixed(2)}</div>
           \${totalOwed > 0 ? \`
             <div style="font-size:0.95rem; font-weight:900; color:#1a1a2e; margin-top:4px;">
               ≈ Bs. \${Math.round(totalOwed * (bcvData?.rate || 40)).toLocaleString('es-VE')}
             </div>
             <div style="font-size:0.55rem; font-weight:800; color:#999; margin-top:2px;">
               Tasa BCV: \${Number(bcvData?.rate || 40).toFixed(2)}
             </div>
             <div style="font-size:0.6rem; font-weight:700; color:#e63946; margin-top:4px;">EXCESO DE TIEMPO (+8H)</div>
           \` : \`<div style="font-size:0.6rem; font-weight:700; color:#22c55e; margin-top:4px;">CORTESÍA / PAGADO</div>\`}
        </div>`;

if (content.includes(oldExitBlock)) {
  content = content.replace(oldExitBlock, newExitBlock);
  console.log('Exit Form display updated successfully');
} else {
  console.log('Exit Form display already updated or not found');
}

// 5. Replace renderPaymentForm, renderSubPaymentForm, and renderClosureSummary entirely
const sliceStartMarker = 'const renderPaymentForm = () => ';
const sliceEndMarker = '  // ── CORE LOGIC ───────────────────────────────────────────────';

const idxStart = content.indexOf(sliceStartMarker);
const idxEnd = content.indexOf(sliceEndMarker);

if (idxStart !== -1 && idxEnd !== -1) {
  const newMiddle = `const renderPaymentForm = () => {
    const rate = bcvData?.rate || 40;

    window.updatePayFormConversion = (val) => {
       const amountVal = parseFloat(val) || 0;
       const elBs = document.getElementById('bs-equivalent');
       if (elBs) {
          elBs.innerHTML = \`≈ Bs. \${Math.round(amountVal * rate).toLocaleString('es-VE')}\`;
       }
    };

    setTimeout(() => {
       const inp = document.getElementById('pay-amount');
       if (inp) window.updatePayFormConversion(inp.value);
    }, 50);

    return \`
    <div style="padding:20px; padding-bottom:120px;">
      <div style="background:white; border-radius:32px; padding:30px; box-shadow:0 15px 45px rgba(0,0,0,0.1);">
         <div style="text-align:center; margin-bottom:25px;">
            <div style="font-size:0.7rem; font-weight:900; color:#999; letter-spacing:1px; text-transform:uppercase;">DETALLE DE PAGO</div>
            <div style="font-size:2.5rem; font-weight:950; color:var(--primary); margin:5px 0;">$\\\${(pendingPayment?.amount || 0).toFixed(2)}</div>
            <div style="display:inline-block; background:#f4f4f4; padding:5px 15px; border-radius:20px; font-weight:900; font-size:0.65rem; color:#666;">
               \\\${(pendingPayment?.method || '').replace('_', ' ')}
            </div>
         </div>

         <div style="display:grid; gap:20px; margin-bottom:30px;">
            <div style="text-align:left;">
               <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">CANTIDAD RECIBIDA</label>
               <input id="pay-amount" type="number" step="0.01" value="\\\${pendingPayment?.amount || 0}" placeholder="0.00" oninput="window.updatePayFormConversion(this.value)" 
                   style="width:100%; border:2px solid #eee; border-radius:18px; padding:18px; font-size:1.4rem; font-weight:900; outline:none; font-family:'Montserrat';">
            </div>

            \\\${pendingPayment?.method === 'PAGO_MOVIL' ? \\\`
              <div style="text-align:left;">
                 <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">REFERENCIA (Últimos 4-6)</label>
                 <input id="pay-ref" type="text" placeholder="Ej: 4522" 
                    style="width:100%; border:2px solid #eee; border-radius:18px; padding:18px; font-size:1.4rem; font-weight:900; outline:none; font-family:'Montserrat';">
              </div>
             \\\` : ''}

             <div style="background:#f8f9fa; border-radius:18px; padding:18px; text-align:center;">
                <div style="font-size:0.6rem; font-weight:900; color:#bbb; text-transform:uppercase; margin-bottom:4px;">Equivalente Bolívares</div>
                <div id="bs-equivalent" style="font-size:1.2rem; font-weight:900; color:#1a1a2e;">
                   ≈ Bs. \\\${Math.round((pendingPayment?.amount || 0) * rate).toLocaleString('es-VE')}
                </div>
                <div id="bcv-rate-guard" style="font-size:0.6rem; font-weight:800; color:#999; margin-top:5px;">
                   Tasa BCV: Bs. \\\${Number(rate).toFixed(2)} · \\\${bcvData?.source === 'auto' ? '✓ Oficial' : '⚠️ Manual'}
                </div>
             </div>
         </div>

         <button data-action="SUBMIT_PAYMENT" style="width:100%; padding:22px; background:#22c55e; color:white; border:none; border-radius:22px; font-weight:900; font-size:1rem; box-shadow:0 10px 25px rgba(34,197,94,0.3);">
            CONFIRMAR Y REGISTRAR
         </button>
      </div>
    </div>
    \`;
  }

  const renderSubPaymentForm = () => {
     const rate = bcvData?.rate || 40;

     window.updateSubPayConversion = (val) => {
       const amountVal = parseFloat(val) || 0;
       const method = subPaymentMethod;
       const helper = document.getElementById('sub-pay-conversion-helper');
       const amountLabel = document.getElementById('sub-pay-amount-label');

       if (amountLabel) {
         if (method === 'EFECTIVO_BS' || method === 'PAGO_MOVIL') {
           amountLabel.textContent = 'MONTO PAGADO EN BOLÍVARES (Bs.)';
         } else {
           amountLabel.textContent = 'MONTO PAGADO EN DÓLARES ($)';
         }
       }

       if (helper) {
         if (method === 'EFECTIVO_BS' || method === 'PAGO_MOVIL') {
           const equivUsd = amountVal / rate;
           helper.innerHTML = \`Equivale a <strong>$\${equivUsd.toFixed(2)} USD</strong> (Tasa BCV: Bs. \${Number(rate).toFixed(2)})\`;
         } else {
           const equivBs = amountVal * rate;
           helper.innerHTML = \`Equivale a <strong>Bs. \${Math.round(equivBs).toLocaleString('es-VE')}</strong> (Tasa BCV: Bs. \${Number(rate).toFixed(2)})\`;
         }
       }
     };

     setTimeout(() => {
       const inp = document.getElementById('sub-pay-amount');
       if (inp) window.updateSubPayConversion(inp.value);
     }, 50);

     return \`
     <div style="padding:20px; padding-bottom:120px;">
         <div style="background:white; border-radius:32px; padding:30px; box-shadow:0 15px 45px rgba(0,0,0,0.1);">
            <h2 style="font-weight:900; color:var(--primary); margin-bottom:5px; text-align:center;">PAGO DE MENSUALIDAD</h2>
            <div style="font-size:0.8rem; font-weight:700; color:#666; text-align:center; margin-bottom:20px;">\\\${selectedResident.resident_name}</div>

            <div style="margin-bottom:20px;">
               <label id="sub-pay-amount-label" style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">MONTO A COBRAR</label>
               <input id="sub-pay-amount" type="number" step="0.01" value="\\\${subPaymentAmount}" oninput="window.updateSubPayConversion(this.value)" style="width:100%; border:2px solid #eee; border-radius:18px; padding:18px; font-size:1.4rem; font-weight:900; outline:none; font-family:'Montserrat';">
               <div id="sub-pay-conversion-helper" style="font-size:0.75rem; font-weight:900; color:#1d512d; margin-top:8px; font-family:'Montserrat';"></div>
            </div>

            <div style="margin-bottom:20px;">
               <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">MÉTODO DE PAGO</label>
               <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                  \\\${PAY.map(p => \\\`<button data-action="SET_SUB_METHOD" data-method="\\\${p.m}" style="padding:10px; border-radius:10px; border:2px solid \\\${subPaymentMethod === p.m ? '#1a1a2e' : '#eee'}; background:\\\${subPaymentMethod === p.m ? '#1a1a2e' : 'white'}; color:\\\${subPaymentMethod === p.m ? 'white' : '#1a1a2e'}; font-size:0.65rem; font-weight:900;">\\\${p.label}</button>\\\`).join('')}
               </div>
            </div>

            \\\${['PAGO_MOVIL', 'TRANSFERENCIA'].includes(subPaymentMethod) ? \\\`
               <div style="margin-bottom:20px;">
                  <label style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:8px; display:block;">REFERENCIA (Últimos 4-6)</label>
                  <input id="sub-pay-ref" type="text" placeholder="Ej: 4522" style="width:100%; border:2px solid #eee; border-radius:18px; padding:18px; font-size:1.4rem; font-weight:900; outline:none; font-family:'Montserrat';">
               </div>
            \\\` : ''}

            <button data-action="SUBMIT_SUB_PAYMENT" style="width:100%; padding:20px; background:#22c55e; color:white; border:none; border-radius:20px; font-weight:900; font-size:0.9rem; box-shadow:0 10px 25px rgba(34,197,94,0.3);">
               CONFIRMAR MENSUALIDAD
            </button>
         </div>
      </div>
     \`;
  }

  const renderClosureSummary = () => {
    const openMovs = state.movements.filter(m => !m.closed && m.guardName === guardName)
    const total = openMovs.reduce((a,m) => a + (m.amount || 0), 0)
    const breakdown = openMovs.reduce((acc, m) => {
      acc[m.payMethod] = (acc[m.payMethod] || 0) + (m.amount || 0)
      return acc
    }, {})
    
    const todayEntries = state.movements.filter(m => m.type === 'entry' && !m.closed && m.guardName === guardName).length;
    const todayExits = state.movements.filter(m => m.type === 'SALIDA' && !m.closed && m.guardName === guardName).length;

    return \`
    <div style="padding:20px; padding-bottom:120px;">
       
       <div style="background:white; border-radius:32px; padding:25px; box-shadow:0 10px 30px rgba(0,0,0,0.05); margin-bottom:20px;">
          <h2 style="font-weight:950; color:var(--primary); margin-bottom:15px; text-align:center;">RENDIMIENTO</h2>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
             <div style="background:rgba(34,197,94,0.1); border:1.5px solid rgba(34,197,94,0.3); border-radius:20px; padding:15px; text-align:center;">
                <div style="font-size:1.8rem; font-weight:950; color:#22c55e;">\\\${todayEntries}</div>
                <div style="font-size:0.6rem; font-weight:800; color:#22c55e; text-transform:uppercase;">AUTOS ENTRARON</div>
             </div>
             <div style="background:rgba(230,57,70,0.1); border:1.5px solid rgba(230,57,70,0.3); border-radius:20px; padding:15px; text-align:center;">
                <div style="font-size:1.8rem; font-weight:950; color:#e63946;">\\\${todayExits}</div>
                <div style="font-size:0.6rem; font-weight:800; color:#e63946; text-transform:uppercase;">AUTOS SALIERON</div>
             </div>
          </div>
       </div>

       <div style="background:white; border-radius:32px; padding:25px; box-shadow:0 10px 30px rgba(0,0,0,0.05);">
          <h2 style="font-weight:950; color:var(--primary); margin-bottom:5px; text-align:center;">CORTE DE CAJA</h2>
          <div style="font-size:0.65rem; font-weight:800; color:#bbb; text-align:center; margin-bottom:25px; text-transform:uppercase;">\\\${guardName.toUpperCase()} · \\\${new Date().toLocaleDateString()}</div>

          <!-- TOTALS -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:25px;">
             <div style="background:#1a1a2e; color:white; padding:20px 10px; border-radius:24px; text-align:center;">
                <div style="font-size:1.6rem; font-weight:950;">$\\\${total.toFixed(2)}</div>
                <div style="font-size:0.7rem; font-weight:900; color:var(--accent); margin-top:2px;">≈ Bs. \\\${Math.round(total * (bcvData?.rate || 40)).toLocaleString('es-VE')}</div>
                <div style="font-size:0.5rem; font-weight:800; color:var(--accent); text-transform:uppercase; margin-top:4px;">RECAUDO TOTAL</div>
             </div>
             <div style="background:#f8f9fa; padding:20px 10px; border-radius:24px; text-align:center;">
                <div style="font-size:1.6rem; font-weight:950;">\\\${openMovs.length}</div>
                <div style="font-size:0.5rem; font-weight:800; color:#999; text-transform:uppercase;">MOVIMIENTOS</div>
             </div>
          </div>

          <!-- METHODS -->
          <div style="background:#fdfdfd; border:1.5px solid #f8f8f8; border-radius:20px; padding:15px; margin-bottom:25px;">
             \\\${Object.entries(breakdown).map(([m, val]) => {
                const rate = bcvData?.rate || 40;
                const isBs = m === 'EFECTIVO_BS' || m === 'PAGO_MOVIL';
                const bsVal = isBs ? \\\` <span style="font-size:0.65rem; font-weight:900; color:#166534; margin-left:6px;">≈ Bs. \\\${Math.round(val * rate).toLocaleString('es-VE')}</span>\\\` : '';
                return \\\`
                   <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f4f4f4;">
                      <span style="font-size:0.65rem; font-weight:800; color:#666;">\\\\\\\${(m||'OTROS').replace('_', ' ')}</span>
                      <div>
                        <span style="font-size:0.85rem; font-weight:900; color:var(--primary);">$\\\\\\\${val.toFixed(2)}</span>
                        \\\\\\\${bsVal}
                      </div>
                    </div>
                \\\`;
             }).join('') || '<div style="text-align:center; padding:10px; color:#ccc; font-size:0.75rem;">Sin recaudos hoy</div>'}
          </div>

          <!-- RECENT LIST -->
          <div style="font-size:0.65rem; font-weight:900; color:#bbb; margin-bottom:10px; text-transform:uppercase;">ÚLTIMOS MOVIMIENTOS</div>
          <div style="display:grid; gap:8px; margin-bottom:30px; max-height:200px; overflow-y:auto;">
             \\\${openMovs.slice(0, 10).map(m => \\\`
               <div style="background:#fafafa; border-radius:12px; padding:10px 15px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-size:0.8rem; font-weight:900; color:var(--primary);">\\\${m.plate || '---'}</div>
                    <div style="font-size:0.5rem; color:#999; font-weight:700;">\\\${m.type} · \\\${m.slot}</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:0.8rem; font-weight:900; color:#22c55e;">+$\\\\\\\${(m.amount||0).toFixed(2)}</div>
                    <div style="font-size:0.45rem; color:#bbb; font-weight:800;">Ref: \\\${m.reference || 'EFEC'}</div>
                  </div>
               </div>
             \\\`).join('')}
          </div>

          <button data-action="FINALIZE_CLOSURE" style="width:100%; padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; font-size:0.9rem; box-shadow:0 10px 25px rgba(26,26,46,0.3);">
            CONFIRMAR Y ENVIAR CIERRE
          </button>
       </div>
    </div>
    \`;
  }

\n\n`;

  const finalContent = content.substring(0, idxStart) + newMiddle + content.substring(idxEnd);
  content = finalContent;
  console.log('Slices replaced successfully');
} else {
  console.error('Slice boundary not found!', idxStart, idxEnd);
}

fs.writeFileSync('src/modules/guard.js', content, 'utf8');
console.log('Successfully completed full guard.js mod session.');
