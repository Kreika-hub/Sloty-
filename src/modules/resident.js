import { supabase, getExchangeRate } from '../db.js'
import { html, raw } from '../utils/sanitize.js'

const uploadPaymentProof = async (file, paymentId, buildingId, residentName) => {
  if (!file) return null;
  try {
    const ext = file.name.split('.').pop();
    const filePath = `${buildingId}/${paymentId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, file, { upsert: true });

    if (uploadError) { console.error('Upload error:', uploadError); return null; }

    const { error: dbError } = await supabase
      .from('payment-proofs')
      .insert({
        building_id:   buildingId,
        payment_id:    paymentId,
        resident_name: residentName,
        file_path:     filePath,
        file_name:     file.name
      });

    if (dbError) { console.error('DB error:', dbError); return null; }
    return filePath;
  } catch(e) {
    console.error('uploadPaymentProof:', e);
    return null;
  }
};

const SVG = {
  MONEY: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  HOME:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  USER:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  CAR:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
  CHECK: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="20 6 9 17 4 12"/></svg>`,
  CLOCK: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
}

export async function initResident(container, subscription) {
  setTimeout(() => {
    import('./push.js').then(m => m.subscribeToPushNotifications(subscription.building_id, 'RESIDENT', subscription.id));
  }, 3000);
  let subData = subscription
  let activeTab = 'PANEL'
  let payments = []
  let reportMode = false
  let createPassMode = false
  let dataLoaded = false
  let visitorPasses = []
  let bcvData = null

  const fetchData = async () => {
    const { data: latest } = await supabase.from('subscriptions').select('*').eq('id', subData.id).single()
    if (latest) subData = latest
    const { data: pays } = await supabase.from('payments')
      .select('*').eq('subscription_id', subData.id)
      .order('payment_date', { ascending: false })
    payments = pays || []

    const { data: vpasses } = await supabase.from('visitor_passes')
      .select('*').eq('resident_id', subData.id)
      .order('created_at', { ascending: false })
    visitorPasses = vpasses || []

    try {
      if (!bcvData) {
        bcvData = await getExchangeRate()
      }
    } catch(e) {
      console.warn('Failed to load BCV rate in resident panel:', e)
    }

    dataLoaded = true
  }

  const _drawPassTicket = (img, visitorName, expectedDate) => {
     const canvas = document.createElement('canvas');
     canvas.width = 600;
     canvas.height = 900;
     const ctx = canvas.getContext('2d');
     
     // Ticket background
     ctx.fillStyle = '#1a1a2e';
     ctx.fillRect(0, 0, canvas.width, canvas.height);
     ctx.fillStyle = '#16213e';
     ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);
     
     // Decorate
     ctx.fillStyle = '#F5C518';
     ctx.fillRect(20, 20, canvas.width - 40, 8);
     
     ctx.fillStyle = '#ffffff';
     ctx.font = 'bold 36px sans-serif';
     ctx.textAlign = 'center';
     ctx.fillText('PASE DE INVITADO', 300, 100);
     
     ctx.font = '24px sans-serif';
     ctx.fillStyle = '#bbbbbb';
     ctx.fillText('Sloty Access', 300, 140);
     
     ctx.fillStyle = '#F5C518';
     ctx.font = 'bold 42px sans-serif';
     ctx.fillText(visitorName.toUpperCase(), 300, 250);
     
     ctx.fillStyle = '#ffffff';
     ctx.font = '28px sans-serif';
     ctx.fillText(new Date(expectedDate + 'T12:00:00').toLocaleDateString('es-VE', {weekday:'long', month:'long', day:'numeric'}), 300, 310);
     
     ctx.fillStyle = '#bbbbbb';
     ctx.font = '20px sans-serif';
     ctx.fillText('Destino: Torre ' + (subData.tower||'-') + ' / Apto ' + (subData.apt||'-'), 300, 360);
     
     // Dibuja QR
     ctx.fillStyle = 'white';
     ctx.fillRect(140, 420, 320, 320);
     ctx.drawImage(img, 150, 430, 300, 300);
     
     ctx.fillStyle = '#bbbbbb';
     ctx.font = 'bold 18px sans-serif';
     ctx.fillText('Muestra este c\u00f3digo al Guardia al llegar', 300, 800);
     
     const link = document.createElement('a');
     link.download = 'Pase-' + visitorName.replace(/\s+/g, '') + '.png';
     link.href = canvas.toDataURL('image/png');
     link.click();
  }

  window.downloadPassTicket = function(passId, visitorName, expectedDate) {
     const qrContainer = document.getElementById('qr-pass-' + passId)
     if (!qrContainer) return showInlineAlert('QR no encontrado, intenta de nuevo...', false);
     const img = qrContainer.querySelector('img')
     if (!img) return showInlineAlert('QR a\u00fan generando, espera un momento...', false)
     
     // Fix race condition: wait for img to fully load before drawing on canvas
     if (!img.complete || img.naturalWidth === 0) {
       showInlineAlert('Generando imagen... intenta de nuevo en un momento.', true)
       img.onload = () => _drawPassTicket(img, visitorName, expectedDate)
       return
     }
     _drawPassTicket(img, visitorName, expectedDate)
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

  const renderPaymentForm = () => {
    const rateText = bcvData?.rate 
      ? `Tasa BCV: Bs. ${Number(bcvData.rate).toLocaleString('es-VE', {minimumFractionDigits:2})} · ${bcvData.source === 'auto' || bcvData.source === 'dolarapi' || bcvData.source === 'dolarvzla' ? '✓ Oficial' : '⚠️ Manual'}` 
      : 'Cargando tasa oficial...';
    return `
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
          <div id="pago-movil-note" style="display:none;background:rgba(245,197,24,0.1);border:1.5px solid #F5C518;border-radius:14px;padding:12px;font-size:0.65rem;color:#D97706;font-weight:700;margin-top:8px;text-align:left;line-height:1.3;">
            ⚠️ Nota: Recuerda que debes colocar el valor del Pago Móvil en Bolívares (Bs.)
          </div>
          <div style="font-size:0.65rem; font-weight:800; color:#555; margin-top:6px; font-family:'Montserrat',sans-serif;">
            ℹ️ ${rateText}
          </div>
        </div>

        <div>
          <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:6px;">FECHA DEL PAGO</label>
          <input type="date" id="pay-date" value="${new Date().toISOString().split('T')[0]}"
            style="width:100%;padding:14px;border-radius:14px;border:1.5px solid #e5e7eb;font-family:'Montserrat',sans-serif;font-size:0.85rem;font-weight:700;color:#1a1a2e;outline:none;">
        </div>

        <div>
          <label id="pay-amount-label" style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:6px;">MONTO PAGADO ($)</label>
          <input type="number" id="pay-amount" placeholder="${subData.custom_price || 0}" value="${subData.custom_price || ''}"
            style="width:100%;padding:14px;border-radius:14px;border:1.5px solid #e5e7eb;font-family:'Montserrat',sans-serif;font-size:0.85rem;font-weight:700;color:#1a1a2e;outline:none;">
          <div id="pay-conversion-helper" style="font-size:0.7rem; font-weight:800; color:#1d512d; margin-top:6px; font-family:'Montserrat',sans-serif;"></div>
        </div>

        <div id="pay-ref-group">
          <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:6px;">REFERENCIA / CONFIRMACIÓN</label>
          <input type="text" id="pay-ref" placeholder="Ej: 0012345678"
            style="width:100%;padding:14px;border-radius:14px;border:1.5px solid #e5e7eb;font-family:'Montserrat',sans-serif;font-size:0.85rem;font-weight:700;color:#1a1a2e;outline:none;text-transform:uppercase;">
        </div>

        <div>
          <div style="font-size:0.7rem; font-weight:900; color:#999;
                      text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
            Comprobante (opcional)
          </div>
          <label style="display:flex; align-items:center; gap:10px;
                        background:#f8f9fa; border:1.5px dashed #ddd;
                        border-radius:14px; padding:12px 16px; cursor:pointer;">
            <span style="font-size:1.2rem;">📎</span>
            <span id="proof-label" style="font-size:0.75rem; color:#999; font-weight:700;">
              Toca para adjuntar imagen o PDF
            </span>
            <input type="file" id="payment-proof-file" accept="image/*,.pdf"
                   style="display:none;"
                   onchange="document.getElementById('proof-label').textContent =
                     this.files[0] ? this.files[0].name : 'Toca para adjuntar imagen o PDF'" />
          </label>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:5px;">
          <button id="btn-cancel-report" style="padding:16px;border-radius:16px;border:none;background:#f4f4f4;color:#666;font-weight:900;font-size:0.75rem;cursor:pointer;">CANCELAR</button>
          <button id="btn-submit-payment" style="padding:16px;border-radius:16px;border:none;background:#1a1a2e;color:#F5C518;font-weight:900;font-size:0.75rem;cursor:pointer;letter-spacing:0.5px;">ENVIAR REPORTE</button>
        </div>
      </div>
    </div>
  `
  }

  const renderPaymentHistory = () => {
    if (!payments.length) return `<div style="text-align:center;padding:30px;color:#bbb;font-size:0.8rem;font-weight:700;">Sin pagos registrados aún</div>`
    return payments.map(p => {
      const method = p.method === 'EFECTIVO' ? '💵 Efectivo' : p.method === 'PAGO_MOVIL' ? '📱 Pago Móvil' : '🏦 Transferencia'
      const status = p.status === 'CONFIRMED'
        ? `<span style="background:#dcfce7;color:#15803d;padding:3px 10px;
            border-radius:20px;font-size:0.6rem;font-weight:900;">✓ CONFIRMADO</span>`
        : p.status === 'REJECTED'
        ? `<span style="background:#fee2e2;color:#dc2626;padding:3px 10px;
            border-radius:20px;font-size:0.6rem;font-weight:900;">✕ RECHAZADO</span>`
        : `<span style="background:#fef9c3;color:#a16207;padding:3px 10px;
            border-radius:20px;font-size:0.6rem;font-weight:900;">⏳ PENDIENTE</span>`
      return `
        <div style="background:white;padding:18px 20px;border-radius:20px;border:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:900;color:#1a1a2e;font-size:0.9rem;">$${p.amount}</div>
            <div style="font-size:0.6rem;color:#999;font-weight:700;margin-top:3px;">${method} · ${new Date(p.payment_date).toLocaleDateString()}</div>
            ${p.reference ? `<div style="font-size:0.6rem;color:#bbb;font-weight:700;">Ref: ${p.reference}</div>` : ''}
            ${p.proof_url ? `
              <a href="${p.proof_url}" target="_blank" 
                style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;
                font-size:0.6rem;font-weight:800;color:#3b82f6;text-decoration:none;">
                📎 Ver comprobante
              </a>` : ''}
          </div>
          ${status}
        </div>`
    }).join('')
  }

  const render = async () => {
    if (!dataLoaded) { await fetchData(); dataLoaded = true }
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
          ${subData.is_coming ? `
          <p style="text-align:center; font-size:0.65rem; color:#999; font-weight:700; margin-top:10px; cursor:pointer;" id="res-cancel-coming">
            Cancelar aviso
          </p>
          ` : ''}
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
    } else if (activeTab === 'VISITAS') {
      contentHtml = `
        <div style="padding:0 24px;margin-top:20px;">
          <div style="background:#1a1a2e;border-radius:28px;padding:25px;text-align:center;margin-bottom:20px;">
            <div style="font-size:0.6rem;font-weight:800;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:5px;">CONTROL DE ACCESOS</div>
            <div style="font-size:1.8rem;font-weight:900;color:#F5C518;">PASES TEMPORALES</div>
            <div style="font-size:0.65rem;font-weight:700;color:#ccc;margin-top:8px;">
              Genera invitaciones rápidas para tus amigos o familiares.
            </div>
          </div>
          
          <div id="res-inline-alert" style="display:none;padding:12px 16px;border-radius:12px;font-weight:700;font-size:0.8rem;margin-bottom:15px;text-align:center;"></div>

          ${createPassMode ? `
            <div style="background:white;border-radius:24px;padding:25px;border:1px solid #f0f0f0;margin-bottom:20px;">
              <div style="font-size:0.7rem;font-weight:900;color:#1a1a2e;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px;">NUEVO PASE</div>
              <div style="display:grid;gap:14px;">
                <div>
                  <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:6px;">NOMBRE DEL INVITADO</label>
                  <input type="text" id="pass-name" placeholder="Ej: Juan Pérez"
                    style="width:100%;padding:14px;border-radius:14px;border:1.5px solid #e5e7eb;font-family:'Montserrat',sans-serif;font-size:0.85rem;font-weight:700;color:#1a1a2e;outline:none;">
                </div>
                <div>
                  <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:6px;">PLACA (OPCIONAL)</label>
                  <input type="text" id="pass-plate" placeholder="Ej: ABC-123"
                    style="width:100%;padding:14px;border-radius:14px;border:1.5px solid #e5e7eb;font-family:'Montserrat',sans-serif;font-size:0.85rem;font-weight:700;color:#1a1a2e;outline:none;text-transform:uppercase;">
                </div>
                <div>
                  <label style="font-size:0.6rem;font-weight:800;color:#999;text-transform:uppercase;display:block;margin-bottom:6px;">FECHA DE LA VISITA</label>
                  <input type="date" id="pass-date" value="${new Date().toISOString().split('T')[0]}" min="${new Date().toISOString().split('T')[0]}"
                    style="width:100%;padding:14px;border-radius:14px;border:1.5px solid #e5e7eb;font-family:'Montserrat',sans-serif;font-size:0.85rem;font-weight:700;color:#1a1a2e;outline:none;">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:5px;">
                  <button id="btn-cancel-pass" style="padding:16px;border-radius:16px;border:none;background:#f4f4f4;color:#666;font-weight:900;font-size:0.75rem;cursor:pointer;">CANCELAR</button>
                  <button id="btn-submit-pass" style="padding:16px;border-radius:16px;border:none;background:#22c55e;color:white;font-weight:900;font-size:0.75rem;cursor:pointer;letter-spacing:0.5px;">CREAR PASE</button>
                </div>
              </div>
            </div>
          ` : `
            <button id="btn-start-pass" style="width:100%;padding:18px;background:white;color:#22c55e;border:2px dashed #22c55e;border-radius:20px;font-weight:900;font-size:0.85rem;cursor:pointer;margin-bottom:20px;letter-spacing:0.5px;">
              + CREAR INVITACIÓN
            </button>
          `}

          <div style="font-size:0.7rem;font-weight:900;color:#1a1a2e;text-transform:uppercase;letter-spacing:1px;margin-bottom:15px;">MIS INVITADOS / PASES</div>
          <div style="display:grid;gap:15px;padding-bottom:20px;">
            ${visitorPasses.length === 0 ? '<div style="text-align:center;padding:30px;color:#bbb;font-size:0.8rem;font-weight:700;">Sin pases registrados</div>' :
              visitorPasses.map(vp => `
                <div style="background:white;padding:25px;border-radius:24px;border:1px solid #f0f0f0;display:flex;flex-direction:column;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,0.02);position:relative;overflow:hidden;">
                  <div style="position:absolute;top:15px;right:15px;font-size:0.55rem;font-weight:900;padding:4px 10px;border-radius:20px;
                    ${vp.is_used ? 'background:#f0f0f0;color:#999' : 'background:#e0f2fe;color:#0284c7'}">
                    ${vp.is_used ? 'UTILIZADO ✓' : 'VÁLIDO'}
                  </div>
                  <div style="font-weight:900;font-size:1.4rem;color:#1a1a2e;text-align:center;margin-top:10px;">${vp.visitor_name}</div>
                  <div style="font-size:0.75rem;font-weight:700;color:#999;text-align:center;margin-bottom:15px;">
                    Para el: ${new Date(vp.expected_date + 'T12:00:00').toLocaleDateString('es-VE', {weekday:'long', day:'2-digit', month:'long'})}
                  </div>
                  
                  <div id="qr-pass-${vp.id}" style="padding:15px;background:#f9f9f9;border-radius:20px;margin-bottom:15px;opacity:${vp.is_used ? '0.3' : '1'};"></div>
                  
                  ${vp.is_used ? `
                    <div style="font-size:0.7rem;color:#999;font-weight:800;">El visitante ya ingresó.</div>
                  ` : `
                    <button onclick="downloadPassTicket('${vp.id}', '${vp.visitor_name}', '${vp.expected_date}')"
                      style="background:#3b82f6;color:white;border:none;padding:12px 20px;border-radius:12px;font-weight:900;font-size:0.7rem;cursor:pointer;display:flex;align-items:center;gap:8px;">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      ENVIAR POR WHATSAPP (IMAGEN)
                    </button>
                    <button id="btn-del-pass-${vp.id}" style="background:none;color:#e63946;border:none;padding:8px;font-weight:700;font-size:0.6rem;margin-top:10px;text-decoration:underline;cursor:pointer;">ELIMINAR PASE</button>
                  `}
                </div>
              `).join('')
            }
          </div>
        </div>`
    }

    container.innerHTML = html`
      <div style="min-height:100vh;background:#f8f9fa;font-family:'Montserrat',sans-serif;padding-bottom:120px;">
        <div style="background:#1a1a2e;padding:40px 24px 80px;text-align:center;position:relative;overflow:hidden;">
          <button id="res-logout" style="position:absolute;top:20px;right:20px;background:none;border:none;color:white;opacity:0.5;font-weight:700;cursor:pointer;font-size:0.75rem;">SALIR</button>
          <img src="/sloty-logo-v2.png" style="width:100px;margin-bottom:10px;">
          <h1 style="color:white;font-size:1.2rem;font-weight:900;margin:0;">PANEL RESIDENTE</h1>
        </div>

        ${raw(contentHtml)}

        <!-- BOTTOM NAV -->
        <div style="position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;padding:10px 20px calc(env(safe-area-inset-bottom,8px) + 8px);display:flex;justify-content:space-around;align-items:center;box-shadow:0 -5px 30px rgba(0,0,0,0.2);z-index:1000;">
          <button class="res-nav-btn" data-tab="PAGOS" style="background:none;border:none;color:${activeTab==='PAGOS'?'#F5C518':'rgba(255,255,255,0.4)'};display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:800;font-size:0.55rem;cursor:pointer;letter-spacing:0.5px;">
            ${raw(SVG.MONEY)}<span>PAGOS</span>
          </button>
          <button class="res-nav-btn" data-tab="PANEL" style="background:none;border:none;color:${activeTab==='PANEL'?'#F5C518':'rgba(255,255,255,0.4)'};display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:800;font-size:0.55rem;cursor:pointer;letter-spacing:0.5px;">
            ${raw(SVG.HOME)}<span>PANEL</span>
          </button>
          <button class="res-nav-btn" data-tab="PERFIL" style="background:none;border:none;color:${activeTab==='PERFIL'?'#F5C518':'rgba(255,255,255,0.4)'};display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:800;font-size:0.55rem;cursor:pointer;letter-spacing:0.5px;">
            ${raw(SVG.USER)}<span>PERFIL</span>
          </button>
          <button class="res-nav-btn" data-tab="VISITAS" style="background:none;border:none;color:${activeTab==='VISITAS'?'#F5C518':'rgba(255,255,255,0.4)'};display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:800;font-size:0.55rem;cursor:pointer;letter-spacing:0.5px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg><span>VISITAS</span>
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
            dataLoaded = false
            render()
          }
        }
        const btnCancelComing = document.getElementById('res-cancel-coming')
        if (btnCancelComing) {
          btnCancelComing.onclick = async () => {
            await supabase.from('subscriptions').update({ is_coming: false }).eq('id', subData.id)
            subData.is_coming = false
            dataLoaded = false
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
      const amountInput = document.getElementById('pay-amount')
      
      if (methodSel && refGroup && amountInput) {
        const updateConversion = () => {
          const method = methodSel.value
          const amountVal = parseFloat(amountInput.value) || 0
          const rate = bcvData?.rate || 40

          const amountLabel = document.getElementById('pay-amount-label')
          if (amountLabel) {
            if (method === 'PAGO_MOVIL' || method === 'TRANSFERENCIA') {
              amountLabel.textContent = 'MONTO PAGADO EN BOLÍVARES (Bs.)'
            } else {
              amountLabel.textContent = 'MONTO PAGADO EN DÓLARES ($)'
            }
          }

          const helper = document.getElementById('pay-conversion-helper')
          if (helper) {
            if (method === 'PAGO_MOVIL' || method === 'TRANSFERENCIA') {
              const equivUsd = amountVal / rate
              helper.innerHTML = html`Equivale a <strong>$${equivUsd.toFixed(2)} USD</strong> (Tasa BCV: Bs. ${Number(rate).toFixed(2)})`
            } else {
              const equivBs = amountVal * rate
              helper.innerHTML = html`Equivale a <strong>Bs. ${Math.round(equivBs).toLocaleString('es-VE')}</strong> (Tasa BCV: Bs. ${Number(rate).toFixed(2)})`
            }
          }
        }

        const toggleRef = () => { 
          const method = methodSel.value
          refGroup.style.display = method === 'EFECTIVO' ? 'none' : 'block'
          const pmNote = document.getElementById('pago-movil-note')
          if (pmNote) {
            pmNote.style.display = method === 'PAGO_MOVIL' ? 'block' : 'none'
          }

          const rate = bcvData?.rate || 40
          if (method === 'PAGO_MOVIL' || method === 'TRANSFERENCIA') {
            amountInput.value = Math.round((subData.custom_price || 10) * rate)
          } else {
            amountInput.value = subData.custom_price || 10
          }
          updateConversion()
        }

        methodSel.onchange = toggleRef
        amountInput.oninput = updateConversion
        toggleRef()
      }

      const proofInput = document.getElementById('payment-proof-file')
      if (proofInput) {
        proofInput.onchange = () => {
          const label = document.getElementById('proof-label')
          if (label && proofInput.files[0]) {
            label.textContent = proofInput.files[0].name
            label.style.color = '#1a1a2e'
          }
        }
      }

      const btnSubmit = document.getElementById('btn-submit-payment')
      if (btnSubmit) {
        btnSubmit.onclick = async () => {
          const method = document.getElementById('pay-method').value
          const date = document.getElementById('pay-date').value
          const amountInputVal = parseFloat(amountInput?.value || '0')
          const ref = document.getElementById('pay-ref')?.value?.trim() || null

          if (!date || !amountInputVal) return showInlineAlert('Completa fecha y monto', false)
          if ((method !== 'EFECTIVO') && !ref) 
            return showInlineAlert('Ingresa la referencia de pago', false)

          btnSubmit.textContent = 'Enviando...'
          btnSubmit.disabled = true

          let finalUsdAmount = amountInputVal
          let processedRef = ref
          const rate = bcvData?.rate || 40

          if (method === 'PAGO_MOVIL' || method === 'TRANSFERENCIA') {
            finalUsdAmount = amountInputVal / rate
            processedRef = `${ref} (Bs. ${Number(amountInputVal).toFixed(2)})`
          }

          const { data, error } = await supabase.from('payments').insert({
            subscription_id: subData.id,
            building_id: subData.building_id,
            resident_name: subData.resident_name,
            method, payment_date: date, amount: finalUsdAmount,
            reference: processedRef, status: 'PENDING'
          }).select('id').single()

          if (!error && data?.id) {
            const proofFile = document.querySelector('#payment-proof-file')?.files?.[0];
            if (proofFile) {
              await uploadPaymentProof(
                proofFile,
                data.id,
                subData.building_id,
                subData.resident_name || 'Residente'
              );
            }

            // Notify admin via push
            supabase.functions.invoke('send-push', {
              body: {
                building_id: subData.building_id,
                role: 'ADMIN',
                title: '💰 Nuevo pago reportado',
                body: `${subData.resident_name} reportó un pago de $${finalUsdAmount.toFixed(2)} (${method})`
              }
            });

            showInlineAlert('✓ Pago reportado correctamente', true)
            reportMode = false
            dataLoaded = false
            render()
          } else {
            showInlineAlert('Error al enviar. Intenta de nuevo.', false)
            btnSubmit.textContent = 'ENVIAR REPORTE'
            btnSubmit.disabled = false
          }
        }
      }
    }

    if (activeTab === 'VISITAS') {
      const btnStart = document.getElementById('btn-start-pass')
      if (btnStart) btnStart.onclick = () => { createPassMode = true; render() }

      const btnCancel = document.getElementById('btn-cancel-pass')
      if (btnCancel) btnCancel.onclick = () => { createPassMode = false; render() }

      const btnSubmit = document.getElementById('btn-submit-pass')
      if (btnSubmit) {
        btnSubmit.onclick = async () => {
          const name = document.getElementById('pass-name').value.trim()
          const plate = document.getElementById('pass-plate')?.value.trim() || null
          const date = document.getElementById('pass-date').value
          
          if (!name || !date) return showInlineAlert('Completa nombre y fecha', false)
          
          btnSubmit.textContent = 'Guardando...'
          btnSubmit.disabled = true
          
          const { error } = await supabase.from('visitor_passes').insert({
            building_id: subData.building_id,
            resident_id: subData.id,
            visitor_name: name,
            visitor_plate: plate,
            expected_date: date
          });
          
          if (!error) {
            createPassMode = false
            dataLoaded = false
            render()
          } else {
            showInlineAlert('Error de red al crear pase. Intenta de nuevo', false)
            btnSubmit.textContent = 'CREAR PASE'
            btnSubmit.disabled = false
          }
        }
      }
      
      // Render QRs and listeners
      setTimeout(() => {
        visitorPasses.forEach(vp => {
          const qrEl = document.getElementById('qr-pass-' + vp.id)
          if (qrEl && typeof QRCode !== 'undefined') {
            qrEl.innerHTML = ''
            new QRCode(qrEl, { 
              text: JSON.stringify({ pass_id: vp.id }), 
              width: 160, height: 160, colorDark: vp.is_used ? '#999' : '#1a1a2e', colorLight: '#f9f9f9', correctLevel: QRCode.CorrectLevel.H 
            })
          }
          const delBtn = document.getElementById('btn-del-pass-' + vp.id)
          if (delBtn) {
            delBtn.onclick = async () => {
              delBtn.textContent = '...'
              delBtn.disabled = true
              await supabase.from('visitor_passes').delete().eq('id', vp.id)
              dataLoaded = false
              render()
            }
          }
        })
      }, 150)
    }

    document.getElementById('res-logout').onclick = () => {
      if (window.slotyLogout) window.slotyLogout()
      else {
        localStorage.clear()
        location.reload()
      }
    }
    container.querySelectorAll('.res-nav-btn').forEach(btn => {
      btn.onclick = () => { reportMode = false; activeTab = btn.dataset.tab; render() }
    })
  }

  const { data: bldCheck } = await supabase
    .from('buildings')
    .select('membership_status')
    .eq('id', subData.building_id)
    .single()
  
  if (bldCheck?.membership_status === 'SUSPENDED') {
    container.innerHTML = html`
      <div style="min-height:100vh;background:#1a1a2e;display:flex;
        flex-direction:column;align-items:center;justify-content:center;
        padding:40px;text-align:center;">
        <div style="font-size:3rem;margin-bottom:20px;">🔒</div>
        <div style="font-size:1.2rem;font-weight:900;color:white;
          margin-bottom:12px;">Servicio Suspendido</div>
        <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);
          line-height:1.6;max-width:280px;">
          La membresía de este edificio no está activa.
          Contacta al administrador de tu edificio.
        </div>
      </div>`
    return
  }

  render()
}
