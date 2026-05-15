import { supabase } from '../db.js'

const SVG = {
  MONEY: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  HOME:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  USER:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  CAR:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
  CHECK: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="20 6 9 17 4 12"/></svg>`,
  CLOCK: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
}

export function initResident(container, subscription) {
  let subData = subscription
  let activeTab = 'PANEL'
  let payments = []
  let reportMode = false

  const fetchData = async () => {
    const { data: latest } = await supabase.from('subscriptions').select('*').eq('id', subData.id).single()
    if (latest) subData = latest
    const { data: pays } = await supabase.from('payments')
      .select('*').eq('subscription_id', subData.id)
      .order('payment_date', { ascending: false })
    payments = pays || []
  }

  const showInlineAlert = (msg, ok = true) => {
    const el = document.getElementById('res-inline-alert')
    if (!el) return
    el.textContent = msg
    el.style.background = ok ? '#dcfce7' : '#fee2e2'
    el.style.color = ok ? '#15803d' : '#dc2626'
    el.style.display = 'block'
    setTimeout(() => { if (el) el.style.display = 'none' }, 4000)
  }

  const renderPaymentForm = () => `
    <div style="background:white;border-radius:24px;padding:25px;border:1px solid #f0f0f0;margin-bottom:20px;">
      <div style="font-size:0.7rem;font-weight:900;color:#1a1a2e;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px;">REPORTAR PAGO</div>
      <div id="res-inline-alert" style="display:none;padding:12px 16px;border-radius:12px;font-weight:700;font-size:0.8rem;margin-bottom:15px;"></div>

      <div style="display:grid;gap:14px;">
        <div>
          <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:6px;">MÉTODO DE PAGO</label>
          <select id="pay-method" style="width:100%;padding:14px;border-radius:14px;border:1.5px solid #e5e7eb;font-family:'Montserrat',sans-serif;font-size:0.85rem;font-weight:700;color:#1a1a2e;background:white;outline:none;">
            <option value="EFECTIVO">💵 Efectivo</option>
            <option value="PAGO_MOVIL">📱 Pago Móvil</option>
            <option value="TRANSFERENCIA">🏦 Transferencia</option>
          </select>
        </div>

        <div>
          <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:6px;">FECHA DEL PAGO</label>
          <input type="date" id="pay-date" value="${new Date().toISOString().split('T')[0]}"
            style="width:100%;padding:14px;border-radius:14px;border:1.5px solid #e5e7eb;font-family:'Montserrat',sans-serif;font-size:0.85rem;font-weight:700;color:#1a1a2e;outline:none;">
        </div>

        <div>
          <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:6px;">MONTO PAGADO</label>
          <input type="number" id="pay-amount" placeholder="${subData.custom_price || 0}" value="${subData.custom_price || ''}"
            style="width:100%;padding:14px;border-radius:14px;border:1.5px solid #e5e7eb;font-family:'Montserrat',sans-serif;font-size:0.85rem;font-weight:700;color:#1a1a2e;outline:none;">
        </div>

        <div id="pay-ref-group">
          <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:6px;">REFERENCIA / CONFIRMACIÓN</label>
          <input type="text" id="pay-ref" placeholder="Ej: 0012345678"
            style="width:100%;padding:14px;border-radius:14px;border:1.5px solid #e5e7eb;font-family:'Montserrat',sans-serif;font-size:0.85rem;font-weight:700;color:#1a1a2e;outline:none;text-transform:uppercase;">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:5px;">
          <button id="btn-cancel-report" style="padding:16px;border-radius:16px;border:none;background:#f4f4f4;color:#666;font-weight:900;font-size:0.75rem;cursor:pointer;">CANCELAR</button>
          <button id="btn-submit-payment" style="padding:16px;border-radius:16px;border:none;background:#1a1a2e;color:#F5C518;font-weight:900;font-size:0.75rem;cursor:pointer;letter-spacing:0.5px;">ENVIAR REPORTE</button>
        </div>
      </div>
    </div>
  `

  const renderPaymentHistory = () => {
    if (!payments.length) return `<div style="text-align:center;padding:30px;color:#bbb;font-size:0.8rem;font-weight:700;">Sin pagos registrados aún</div>`
    return payments.map(p => {
      const method = p.method === 'EFECTIVO' ? '💵 Efectivo' : p.method === 'PAGO_MOVIL' ? '📱 Pago Móvil' : '🏦 Transferencia'
      const status = p.status === 'CONFIRMED' ? `<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:20px;font-size:0.6rem;font-weight:900;display:flex;align-items:center;gap:4px;">${SVG.CHECK} CONFIRMADO</span>`
        : `<span style="background:#fef9c3;color:#a16207;padding:3px 10px;border-radius:20px;font-size:0.6rem;font-weight:900;display:flex;align-items:center;gap:4px;">${SVG.CLOCK} PENDIENTE</span>`
      return `
        <div style="background:white;padding:18px 20px;border-radius:20px;border:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:900;color:#1a1a2e;font-size:0.9rem;">$${p.amount}</div>
            <div style="font-size:0.6rem;color:#999;font-weight:700;margin-top:3px;">${method} · ${new Date(p.payment_date).toLocaleDateString()}</div>
            ${p.reference ? `<div style="font-size:0.6rem;color:#bbb;font-weight:700;">Ref: ${p.reference}</div>` : ''}
          </div>
          ${status}
        </div>`
    }).join('')
  }

  const render = async () => {
    await fetchData()
    const isPaid = new Date(subData.expiry_date) > new Date()

    let contentHtml = ''

    if (activeTab === 'PANEL') {
      contentHtml = `
        <div style="margin-top:-50px;padding:0 24px;">
          <div style="background:white;border-radius:32px;padding:30px;box-shadow:0 15px 45px rgba(0,0,0,0.1);text-align:center;position:relative;">
            <div style="position:absolute;top:20px;right:20px;background:${isPaid ? '#22c55e' : '#e63946'};color:white;padding:4px 12px;border-radius:20px;font-size:0.6rem;font-weight:900;">${isPaid ? 'SOLVENTE' : 'MOROSO'}</div>

            <div style="font-weight:900;font-size:1.4rem;color:#1a1a2e;margin-bottom:4px;">${subData.resident_name}</div>
            <div style="font-size:0.75rem;font-weight:800;color:#999;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">${subData.plate}</div>

            <!-- MENSUALIDAD ACORDADA -->
            <div style="background:#f9f9f9;border-radius:16px;padding:14px;margin-bottom:20px;display:flex;align-items:center;justify-content:center;gap:10px;">
              <div style="color:#1a1a2e;opacity:0.4;">${SVG.MONEY}</div>
              <div>
                <div style="font-size:0.55rem;font-weight:800;color:#bbb;text-transform:uppercase;">MENSUALIDAD ACORDADA</div>
                <div style="font-size:1.6rem;font-weight:900;color:#1a1a2e;">$${subData.custom_price || 0}</div>
              </div>
            </div>

            <div id="res-qr-container" style="display:flex;justify-content:center;margin-bottom:24px;padding:15px;background:#f9f9f9;border-radius:20px;"></div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:1.5px dashed #eee;padding-top:20px;">
              <div>
                <div style="font-size:0.55rem;font-weight:800;color:#bbb;text-transform:uppercase;">TORRE / PISO</div>
                <div style="font-weight:900;color:#1a1a2e;">${subData.tower || '-'}-${subData.floor || '-'}</div>
              </div>
              <div>
                <div style="font-size:0.55rem;font-weight:800;color:#bbb;text-transform:uppercase;">VENCE</div>
                <div style="font-weight:900;color:#1a1a2e;">${new Date(subData.expiry_date).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>

        <div style="padding:24px;">
          <button id="res-btn-coming" style="width:100%;padding:24px;background:${subData.is_coming ? '#F5C518' : '#1a1a2e'};color:${subData.is_coming ? '#1a1a2e' : 'white'};border:none;border-radius:24px;font-weight:900;font-size:1rem;box-shadow:0 10px 25px ${subData.is_coming ? 'rgba(245,197,24,0.3)' : 'rgba(26,26,46,0.2)'};cursor:pointer;display:flex;align-items:center;justify-content:center;gap:12px;">
            <div style="color:${subData.is_coming ? '#1a1a2e' : 'white'};opacity:0.8;">${SVG.CAR}</div>
            <span>${subData.is_coming ? 'VOY EN CAMINO...' : 'AVISAR QUE LLEGO'}</span>
          </button>
        </div>`

    } else if (activeTab === 'PAGOS') {
      contentHtml = `
        <div style="padding:0 24px;margin-top:20px;">
          <!-- RESUMEN FINANCIERO -->
          <div style="background:#1a1a2e;border-radius:28px;padding:25px;text-align:center;margin-bottom:20px;">
            <div style="font-size:0.6rem;font-weight:800;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:5px;">CUOTA MENSUAL ACORDADA</div>
            <div style="font-size:2.5rem;font-weight:900;color:#F5C518;">$${subData.custom_price || 0}</div>
            <div style="font-size:0.65rem;font-weight:700;color:${isPaid ? '#22c55e' : '#e63946'};margin-top:8px;">
              ${isPaid ? '✓ AL DÍA' : '⚠ VENCIDO'} · Próximo vencimiento: ${new Date(subData.expiry_date).toLocaleDateString()}
            </div>
          </div>

          ${reportMode ? renderPaymentForm() : `
            <button id="btn-start-report" style="width:100%;padding:18px;background:white;color:#1a1a2e;border:2px solid #1a1a2e;border-radius:20px;font-weight:900;font-size:0.85rem;cursor:pointer;margin-bottom:20px;letter-spacing:0.5px;">
              + REPORTAR PAGO
            </button>
          `}

          <!-- HISTORIAL -->
          <div style="font-size:0.7rem;font-weight:900;color:#1a1a2e;text-transform:uppercase;letter-spacing:1px;margin-bottom:15px;">HISTORIAL DE PAGOS</div>
          <div style="display:grid;gap:10px;">
            ${renderPaymentHistory()}
          </div>
        </div>`

    } else if (activeTab === 'PERFIL') {
      contentHtml = `
        <div style="padding:0 24px;margin-top:20px;">
          <div style="background:white;border-radius:32px;padding:30px;box-shadow:0 15px 45px rgba(0,0,0,0.05);border:1.5px solid #f0f0f0;">
            <div style="display:grid;gap:20px;">
              <div>
                <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:5px;">Nombre Completo</label>
                <div style="font-weight:800;color:#1a1a2e;font-size:1.1rem;padding:15px;background:#f9f9f9;border-radius:14px;">${subData.resident_name}</div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                <div>
                  <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:5px;">Torre / Piso</label>
                  <div style="font-weight:800;color:#1a1a2e;font-size:1.1rem;padding:15px;background:#f9f9f9;border-radius:14px;text-align:center;">${subData.tower || '-'}-${subData.floor || '-'}</div>
                </div>
                <div>
                  <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:5px;">Apartamento</label>
                  <div style="font-weight:800;color:#1a1a2e;font-size:1.1rem;padding:15px;background:#f9f9f9;border-radius:14px;text-align:center;">${subData.apt || '-'}</div>
                </div>
              </div>
              <div>
                <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:5px;">Teléfono</label>
                <div style="font-weight:800;color:#1a1a2e;font-size:1.1rem;padding:15px;background:#f9f9f9;border-radius:14px;">${subData.phone || '---'}</div>
              </div>
              <div>
                <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:5px;">PIN de Acceso</label>
                <div style="font-weight:900;color:#F5C518;font-size:1.2rem;padding:15px;background:#1a1a2e;border-radius:14px;text-align:center;letter-spacing:5px;">${subData.pin ? '••••' : '----'}</div>
              </div>
            </div>
          </div>
        </div>`
    }

    container.innerHTML = `
      <div style="min-height:100vh;background:#f8f9fa;font-family:'Montserrat',sans-serif;padding-bottom:120px;">
        <div style="background:#1a1a2e;padding:40px 24px 80px;text-align:center;position:relative;overflow:hidden;">
          <button id="res-logout" style="position:absolute;top:20px;right:20px;background:none;border:none;color:white;opacity:0.5;font-weight:700;cursor:pointer;font-size:0.75rem;">SALIR</button>
          <img src="/sloty-logo-v2.png.png" style="width:100px;margin-bottom:10px;">
          <h1 style="color:white;font-size:1.2rem;font-weight:900;margin:0;">PANEL RESIDENTE</h1>
        </div>

        ${contentHtml}

        <!-- BOTTOM NAV -->
        <div style="position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;padding:10px 20px calc(env(safe-area-inset-bottom,8px) + 8px);display:flex;justify-content:space-around;align-items:center;box-shadow:0 -5px 30px rgba(0,0,0,0.2);z-index:1000;">
          <button class="res-nav-btn" data-tab="PAGOS" style="background:none;border:none;color:${activeTab==='PAGOS'?'#F5C518':'rgba(255,255,255,0.4)'};display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:800;font-size:0.55rem;cursor:pointer;letter-spacing:0.5px;">
            ${SVG.MONEY}<span>PAGOS</span>
          </button>
          <button class="res-nav-btn" data-tab="PANEL" style="background:none;border:none;color:${activeTab==='PANEL'?'#F5C518':'rgba(255,255,255,0.4)'};display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:800;font-size:0.55rem;cursor:pointer;letter-spacing:0.5px;">
            ${SVG.HOME}<span>PANEL</span>
          </button>
          <button class="res-nav-btn" data-tab="PERFIL" style="background:none;border:none;color:${activeTab==='PERFIL'?'#F5C518':'rgba(255,255,255,0.4)'};display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:800;font-size:0.55rem;cursor:pointer;letter-spacing:0.5px;">
            ${SVG.USER}<span>PERFIL</span>
          </button>
        </div>
      </div>`

    // QR
    if (activeTab === 'PANEL') {
      setTimeout(() => {
        const qrEl = document.getElementById('res-qr-container')
        if (qrEl && typeof QRCode !== 'undefined') {
          new QRCode(qrEl, { text: JSON.stringify({ plate: subData.plate, status: isPaid ? 'PAID' : 'DEBT' }), width: 150, height: 150, colorDark: '#1a1a2e', colorLight: '#f9f9f9', correctLevel: QRCode.CorrectLevel.H })
        }
        const btnComing = document.getElementById('res-btn-coming')
        if (btnComing) {
          btnComing.onclick = async () => {
            const newState = !subData.is_coming
            btnComing.disabled = true
            await supabase.from('subscriptions').update({ is_coming: newState }).eq('id', subData.id)
            subData.is_coming = newState
            render()
          }
        }
      }, 100)
    }

    // Pagos listeners
    if (activeTab === 'PAGOS') {
      const btnStart = document.getElementById('btn-start-report')
      if (btnStart) btnStart.onclick = () => { reportMode = true; render() }

      const btnCancel = document.getElementById('btn-cancel-report')
      if (btnCancel) btnCancel.onclick = () => { reportMode = false; render() }

      const methodSel = document.getElementById('pay-method')
      const refGroup = document.getElementById('pay-ref-group')
      if (methodSel && refGroup) {
        const toggleRef = () => { refGroup.style.display = methodSel.value === 'EFECTIVO' ? 'none' : 'block' }
        methodSel.onchange = toggleRef
        toggleRef()
      }

      const btnSubmit = document.getElementById('btn-submit-payment')
      if (btnSubmit) {
        btnSubmit.onclick = async () => {
          const method = document.getElementById('pay-method').value
          const date = document.getElementById('pay-date').value
          const amount = parseFloat(document.getElementById('pay-amount').value)
          const ref = document.getElementById('pay-ref')?.value?.trim() || null

          if (!date || !amount) return showInlineAlert('Completa fecha y monto', false)
          if ((method !== 'EFECTIVO') && !ref) return showInlineAlert('Ingresa la referencia de pago', false)

          btnSubmit.textContent = 'Enviando...'
          btnSubmit.disabled = true

          const { error } = await supabase.from('payments').insert({
            subscription_id: subData.id,
            building_id: subData.building_id,
            resident_name: subData.resident_name,
            method,
            payment_date: date,
            amount,
            reference: ref,
            status: 'PENDING'
          })

          if (error) {
            showInlineAlert('Error al enviar. Intenta de nuevo.', false)
            btnSubmit.textContent = 'ENVIAR REPORTE'
            btnSubmit.disabled = false
          } else {
            reportMode = false
            render()
          }
        }
      }
    }

    document.getElementById('res-logout').onclick = () => location.reload()
    container.querySelectorAll('.res-nav-btn').forEach(btn => {
      btn.onclick = () => { reportMode = false; activeTab = btn.dataset.tab; render() }
    })
  }

  render()
}
