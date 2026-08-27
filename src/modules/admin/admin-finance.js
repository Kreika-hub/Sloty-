/**
 * Admin Finance — Live cash, payments, audits and reports (FINANCE tab)
 * Extracted from admin.js (Phase C Lot 2 refactor)
 */
import { supabase, getParkingState, saveParkingState, logAudit, showToast, getExchangeRate, enqueueSync, isUUID } from '../../db.js'
import { escapeHTML } from '../../utils/sanitize.js'
import { ICONS } from './admin-ui-components.js'
import { store, getExpensesCached, invalidateExpensesCache, hasFeature } from './admin-store.js'

// ─── PAGOS PENDIENTES DE RESIDENTES ──────────────────────────
export const loadPendingPayments = async () => {
  const state = getParkingState();
  if (!state.buildingId || !isUUID(state.buildingId)) {
    store.pendingPayments = [];
    return;
  }
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id,
        amount,
        payment_method,
        reference,
        proof_image,
        status,
        created_at,
        subscriptions (
          id,
          resident_name,
          plate,
          phone,
          expiry_date
        )
      `)
      .eq('building_id', state.buildingId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) throw error;
    store.pendingPayments = data || [];
  } catch (err) {
    console.warn('[Sloty Finance] Error cargando pagos pendientes:', err);
    store.pendingPayments = [];
  }
};

// ─── FINANCE TAB RENDERER (FINANCE) ───────────────────────────
export const renderFinanceSummary = async (state) => {
  if (!hasFeature('finance_module')) {
    return `<div style="padding:40px; text-align:center; color:#999;">
      <div style="font-size:2rem; margin-bottom:12px;">🔒</div>
      <div style="font-weight:900; color:#1a1a2e;">Función no disponible</div>
      <div style="font-size:0.75rem; margin-top:8px;">
        Disponible desde plan Bronce. Contacta a tu administrador Sloty.
      </div>
    </div>`
  }

  const now = new Date()
  const todayStr = new Date().toISOString().split('T')[0]

  const subsPays = store.cachedFinance?.subsPays || [];
  const todayPays = store.cachedFinance?.todayPays || [];
  const guardShifts = store.cachedFinance?.guardShifts || [];
  const expenses = await getExpensesCached(state.buildingId);

  // Group by guard
  const byGuard = {};
  guardShifts.forEach(s => {
    if (!byGuard[s.guard_name]) byGuard[s.guard_name] = [];
    byGuard[s.guard_name].push(s);
  });
  const subsRevMonth = subsPays.reduce((a, p) => a + (p.amount || 0), 0)
  const subsRevToday = todayPays.reduce((a, p) => a + (p.amount || 0), 0)

  const todayStart = new Date().setHours(0,0,0,0)
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const movs = state.movements || []
  
  // Revenue & Expenses calculations
  const revToday = movs.filter(m => new Date(m.timestamp) >= todayStart).reduce((a, m) => a + (m.amount || 0), 0)
  const totalIncomeMonth = subsRevMonth + revToday;
  const totalExpensesMonth = (expenses || []).reduce((a, x) => a + (Number(x.amount_usd) || Number(x.amount) || 0), 0);
  const netBalanceMonth = totalIncomeMonth - totalExpensesMonth;

  // Inventory
  const successfulCollections = movs.filter(m => (m.amount || 0) > 0).length

  // Methods breakdown
  const methods = movs.reduce((acc, m) => {
    if (m.payMethod && m.amount) {
      const key = m.payMethod.toUpperCase().replace(/\s/g, '_')
      acc[key] = (acc[key] || 0) + m.amount
    }
    return acc
  }, {})

  setTimeout(() => {
    getExchangeRate().then(bcv => {
      if (!bcv) return;
      const f1 = document.getElementById('finance-bcv-rate');
      if (f1) {
        f1.innerHTML = `
          <div style="font-size:1.05rem; font-weight:900; color:#F5C518;">Bs. ${Number(bcv.rate).toLocaleString('es-VE', {minimumFractionDigits:2})}</div>
          <div style="font-size:0.75rem; color:rgba(255,255,255,0.7); font-weight:700;">${bcv.source === 'manual' ? '⚠️ Manual' : '✓ BCV'} · ${bcv.fecha}</div>
        `;
      }
    });
  }, 50);

  await loadPendingPayments();
  const pendingPayments = store.pendingPayments || [];
  const pendingSection = pendingPayments.length > 0 ? `
    <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px solid #f59e0b; border-radius: 24px; padding: 24px; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.5rem;">⏳</span>
          <div>
            <div style="font-size: 0.9rem; font-weight: 900; color: #92400e;">PAGOS POR CONFIRMAR</div>
            <div style="font-size: 0.65rem; font-weight: 700; color: #b45309;">${pendingPayments.length} residente${pendingPayments.length !== 1 ? 's' : ''} esperando aprobación</div>
          </div>
        </div>
        <span style="background: #f59e0b; color: white; font-size: 0.6rem; font-weight: 900; padding: 4px 12px; border-radius: 50px;">PENDIENTES</span>
      </div>
      <div style="display: grid; gap: 12px;">
        ${pendingPayments.map(p => {
          const sub = p.subscriptions || {};
          const createdAt = new Date(p.created_at).toLocaleString('es-VE');
          return `
            <div style="background: white; border-radius: 16px; padding: 16px; border: 1px solid #fde68a; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div style="flex: 1; min-width: 200px;">
                <div style="font-size: 0.85rem; font-weight: 900; color: #1a1a2e;">${escapeHTML(sub.resident_name || 'Sin nombre')}</div>
                <div style="font-size: 0.65rem; font-weight: 700; color: #666; margin-top: 2px;">
                  ${escapeHTML(sub.plate || '---')} ・ ${escapeHTML(sub.phone || '---')}
                </div>
                <div style="font-size: 0.6rem; font-weight: 700; color: #999; margin-top: 4px;">
                  $${Number(p.amount || 0).toFixed(2)} ・ ${escapeHTML(p.payment_method || '---')} ・ ${escapeHTML(p.reference || '---')}
                </div>
                <div style="font-size: 0.55rem; font-weight: 700; color: #bbb; margin-top: 2px;">Enviado: ${createdAt}</div>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${p.proof_image ? `
                  <button data-action="VIEW_PROOF" data-url="${escapeHTML(p.proof_image)}" data-resident="${escapeHTML(sub.resident_name || '')}"
                    style="padding: 10px 16px; background: #1a1a2e; color: #F5C518; border: none; border-radius: 12px; font-weight: 900; font-size: 0.7rem; cursor: pointer;">
                    📎 VER COMPROBANTE
                  </button>
                ` : ''}
                <button data-action="APPROVE_PAYMENT" data-id="${p.id}" data-sub-id="${sub.id || ''}" data-amount="${p.amount || 0}"
                  style="padding: 10px 16px; background: #22c55e; color: white; border: none; border-radius: 12px; font-weight: 900; font-size: 0.7rem; cursor: pointer;">
                  ✓ APROBAR
                </button>
                <button data-action="REJECT_PAYMENT" data-id="${p.id}" data-sub-id="${sub.id || ''}"
                  style="padding: 10px 16px; background: #e63946; color: white; border: none; border-radius: 12px; font-weight: 900; font-size: 0.7rem; cursor: pointer;">
                  ✕ RECHAZAR
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  return `
  <div style="padding:20px; padding-bottom:120px; background:#f8f9fa;">
    <!-- CABECERA -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
       <div>
         <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin:0;">FINANZAS & REPORTES</h2>
         <div style="font-size:0.6rem; color:#999; font-weight:800; text-transform:uppercase; margin-top:2px;">Centro contable administrativo</div>
       </div>
       <div id="finance-bcv-rate" style="background:#1a1a2e; color:white; border-radius:16px; padding:10px 18px; text-align:right; border:1px solid rgba(255,255,255,0.15);">
          <div style="font-size:1.05rem; font-weight:900; color:#F5C518;">Bs. ${rateVal.toLocaleString('es-VE', {minimumFractionDigits:2})}</div>
          <div style="font-size:0.75rem; color:rgba(255,255,255,0.7); font-weight:700;">Tasa Activa</div>
       </div>
    </div>

    <!-- SECCIÓN PAGOS PENDIENTES (POR CONFIRMAR) -->
    ${pendingSection}

    <!-- TARJETA PRINCIPAL: BALANCE NETO REAL -->
    <div style="background:#1a1a2e; color:white; border-radius:30px; padding:25px; margin-bottom:20px; box-shadow:0 15px 35px rgba(26,26,46,0.15); border:1px solid rgba(255,255,255,0.08);">
       <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
          <div>
             <div style="font-size:0.6rem; font-weight:800; color:#F5C518; text-transform:uppercase; letter-spacing:1px;">BALANCE NETO DE CAJA (MES)</div>
             <div style="font-size:2.2rem; font-weight:950; color:${netBalanceMonth >= 0 ? '#22c55e' : '#e63946'}; margin-top:2px;">
                ${netBalanceMonth >= 0 ? '+' : ''}$${netBalanceMonth.toFixed(2)}
             </div>
             <div style="font-size:0.75rem; color:rgba(255,255,255,0.7); font-weight:700; margin-top:2px;">
                ≈ Bs. ${netBalanceBs.toLocaleString('es-VE', {minimumFractionDigits:2})}
             </div>
          </div>
          <button data-action="SHOW_EXPENSE_MODAL" style="background:#F5C518; color:#1a1a2e; border:none; padding:12px 18px; border-radius:14px; font-weight:900; font-size:0.7rem; cursor:pointer; text-transform:uppercase; display:flex; align-items:center; gap:6px; box-shadow:0 6px 15px rgba(245,197,24,0.3);">
             <span>+</span> REGISTRAR GASTO
          </button>
       </div>

       <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
          <div>
             <div style="font-size:0.55rem; color:#999; font-weight:800; text-transform:uppercase;">TOTAL INGRESOS</div>
             <div style="font-size:1.1rem; font-weight:900; color:#22c55e; margin-top:2px;">+$${totalIncomeMonth.toFixed(2)}</div>
          </div>
          <div style="text-align:right;">
             <div style="font-size:0.55rem; color:#999; font-weight:800; text-transform:uppercase;">TOTAL GASTOS / EGRESOS</div>
             <div style="font-size:1.1rem; font-weight:900; color:#e63946; margin-top:2px;">-$${totalExpensesMonth.toFixed(2)}</div>
          </div>
       </div>
    </div>

    <!-- TARJETAS DESTACADAS -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
       <div style="background:white; padding:20px; border-radius:24px; border:1px solid #eee; box-shadow:0 10px 30px rgba(0,0,0,0.02);">
          <div style="font-size:0.5rem; font-weight:800; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Ingresos Garita (Hoy)</div>
          <div style="font-size:1.6rem; font-weight:950; color:var(--primary);">$${revToday.toFixed(2)}</div>
          <div style="font-size:0.55rem; font-weight:700; color:#22c55e; margin-top:4px;">${successfulCollections} Transacciones</div>
       </div>
       <div style="background:white; padding:20px; border-radius:24px; border:1px solid #eee; box-shadow:0 10px 30px rgba(0,0,0,0.02);">
          <div style="font-size:0.5rem; font-weight:800; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Mensualidades (Mes)</div>
          <div style="font-size:1.6rem; font-weight:950; color:#22c55e;">$${subsRevMonth.toFixed(2)}</div>
          <div style="font-size:0.55rem; font-weight:700; color:#555555; margin-top:4px;">Hoy: $${subsRevToday.toFixed(2)}</div>
       </div>
    </div>

    <!-- LISTADO DE GASTOS / EGRESOS DEL MES -->
    <div style="background:white; padding:25px; border-radius:28px; border:1px solid #eee; margin-bottom:25px; box-shadow:0 10px 30px rgba(0,0,0,0.02);">
       <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
          <div style="font-size:0.75rem; font-weight:900; color:var(--primary); text-transform:uppercase; letter-spacing:1px;">
             Egresos & Gastos Operativos (${(expenses || []).length})
          </div>
          <button data-action="SHOW_EXPENSE_MODAL" style="background:#f4f4f4; color:var(--primary); border:none; padding:6px 12px; border-radius:10px; font-weight:800; font-size:0.6rem; cursor:pointer;">
             + NUEVO GASTO
          </button>
       </div>
       <div style="display:grid; gap:10px;">
          ${(expenses || []).slice(0, 8).map(x => {
             const xUsd = Number(x.amount_usd) || Number(x.amount) || 0;
             const xBs = Number(x.amount_bs) || (xUsd * (x.bcv_rate_used || rateVal));
             return `
             <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:#fafafa; border-radius:16px; border:1px solid #f0f0f0;">
                <div>
                   <div style="display:flex; align-items:center; gap:6px;">
                      <span style="background:rgba(230,57,70,0.1); color:#e63946; padding:2px 8px; border-radius:6px; font-size:0.55rem; font-weight:900; text-transform:uppercase;">
                         ${escapeHTML(x.category || 'GASTO')}
                      </span>
                      <span style="font-size:0.8rem; font-weight:800; color:var(--primary);">
                         ${escapeHTML(x.description || 'Sin descripción')}
                      </span>
                   </div>
                   <div style="font-size:0.55rem; color:#999; font-weight:700; margin-top:4px;">
                      ${new Date(x.expense_date || x.created_at).toLocaleDateString()} · ${escapeHTML(x.payment_method || 'EFECTIVO')}
                   </div>
                </div>
                <div style="text-align:right;">
                   <div style="font-size:0.95rem; font-weight:900; color:#e63946;">-$${xUsd.toFixed(2)}</div>
                   <div style="font-size:0.55rem; color:#999; font-weight:700;">≈ Bs. ${xBs.toLocaleString('es-VE', {minimumFractionDigits:2})}</div>
                </div>
             </div>
             `;
          }).join('') || '<div style="text-align:center; padding:25px; color:#ccc; font-weight:700; font-size:0.7rem;">Sin egresos registrados este mes</div>'}
       </div>
    </div>

    <!-- DESGLOSE DE MÉTODOS -->
    <div style="background:white; padding:25px; border-radius:28px; border:1px solid #eee; margin-bottom:25px; box-shadow:0 10px 30px rgba(0,0,0,0.02);">
       <div style="font-size:0.75rem; font-weight:900; color:var(--primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">Métodos de Pago (Garita Hoy)</div>
       <div style="display:grid; gap:10px;">
          ${Object.entries(methods).map(([method, amount]) => `
             <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background:#fafafa; border-radius:14px; border:1px solid #f0f0f0;">
                <span style="font-size:0.75rem; font-weight:800; color:#4b5563;">${escapeHTML(method)}</span>
                <span style="font-size:0.85rem; font-weight:900; color:var(--primary);">$${amount.toFixed(2)}</span>
             </div>
          `).join('') || '<div style="text-align:center; padding:20px; color:#ccc; font-weight:700; font-size:0.7rem;">Sin transacciones hoy</div>'}
       </div>
    </div>

    <!-- RENDIMIENTO Y REPORTES -->
    <div style="background:white; padding:25px; border-radius:28px; border:1px solid #eee; margin-bottom:25px; box-shadow:0 10px 30px rgba(0,0,0,0.02);">
       <div style="font-size:0.75rem; font-weight:900; color:var(--primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">Descarga de Reportes Contables</div>
       <div style="display:flex; gap:10px; width:100%;">
          <button data-action="DOWNLOAD_REPORT" data-type="CSV" style="background:#f4f4f4; color:#666; border:none; padding:8px 12px; border-radius:10px; font-weight:900; font-size:0.6rem; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.05); flex-shrink:0;">↓ CSV</button>
          <button data-action="DOWNLOAD_REPORT" data-type="PDF" style="background:#1a1a2e; color:#F5C518; border:none; padding:8px 12px; border-radius:10px; font-weight:900; font-size:0.65rem; cursor:pointer; box-shadow:0 4px 10px rgba(26,26,46,0.2); flex-shrink:0; text-align:center;">↓ REPORTE PDF</button>
       </div>
    </div>

    <!-- RENDIMIENTO DE GUARDIAS -->
    <div style="margin-bottom:25px;">
       <div style="font-size:0.7rem; font-weight:900; color:var(--primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">RENDIMIENTO DE OPERADORES (Últimos 30 días)</div>
       <div style="display:grid; gap:12px;">
          ${Object.entries(byGuard).map(([name, shifts]) => {
             const cash = shifts.reduce((a, s) => a + (s.total_cash||0), 0)
             const mob = shifts.reduce((a, s) => a + (s.total_mobile||0), 0)
             const bs = shifts.reduce((a, s) => a + (s.total_bs||0), 0)
             const total = cash + mob + bs
             const entries = shifts.reduce((a, s) => a + (s.entries||0), 0)
             const exits = shifts.reduce((a, s) => a + (s.exits||0), 0)
             return `
             <div data-action="VIEW_GUARD_DETAIL" data-guard="${escapeHTML(name)}" style="background:white; border:1px solid #f0f0f0; border-radius:24px; padding:20px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; box-shadow:0 4px 15px rgba(0,0,0,0.02);">
                <div>
                   <div style="font-weight:900; color:var(--primary); font-size:0.95rem; text-transform:uppercase;">${escapeHTML(name)}</div>
                   <div style="font-size:0.55rem; color:#999; font-weight:800; margin-top:3px;">
                      ${shifts.length} Turno${shifts.length !== 1 ? 's' : ''} · ${entries} Entradas / ${exits} Salidas
                   </div>
                </div>
                <div style="text-align:right; display:flex; align-items:center; gap:10px;">
                   <div>
                      <div style="font-size:1.1rem; font-weight:950; color:#22c55e;">$${total.toFixed(0)}</div>
                      <div style="font-size:0.45rem; color:#bbb; font-weight:800;">RECAUDADO</div>
                   </div>
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; color:#bbb;"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
             </div>`
          }).join('') || '<div style="text-align:center; padding:40px; color:#ccc; font-weight:700; font-size:0.7rem;">Sin datos de operadores</div>'}
       </div>
    </div>

    <!-- HISTORIAL DE CIERRES DE TURNO -->
    <div>
       <div style="font-size:0.7rem; font-weight:900; color:var(--primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">CIERRES DE TURNO RECIENTES</div>
       <div style="display:grid; gap:12px;">
          ${guardShifts.map(c => {
             const sum = (c.total_cash||0) + (c.total_mobile||0) + (c.total_bs||0)
             return `
             <div style="background:white; border:1px solid #f0f0f0; border-radius:24px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.02);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                   <div>
                      <div style="font-weight:900; color:var(--primary); font-size:0.85rem; text-transform:uppercase;">${escapeHTML(c.guard_name)}</div>
                      <div style="font-size:0.55rem; color:#bbb; font-weight:700; margin-top:2px;">
                         Cerrado: ${c.ended_at ? new Date(c.ended_at).toLocaleString() : 'Turno Activo'}
                      </div>
                   </div>
                   <div style="text-align:right;">
                      <div style="font-size:1.1rem; font-weight:950; color:#22c55e;">$${sum.toFixed(2)}</div>
                      <div style="font-size:0.45rem; color:#bbb; font-weight:800;">CIERRE TOTAL</div>
                   </div>
                </div>
                <div style="background:#fafafa; border-radius:14px; padding:10px; display:flex; justify-content:space-between; font-size:0.6rem; font-weight:800; color:#666; border:1px solid #f5f5f5;">
                   <span>💵 USD: $${(c.total_cash||0).toFixed(0)}</span>
                   <span>💵 BS: $${(c.total_bs||0).toFixed(0)}</span>
                   <span>📱 Pago Móvil: $${(c.total_mobile||0).toFixed(0)}</span>
                </div>
             </div>`
          }).join('') || '<div style="text-align:center; padding:40px; color:#ccc; font-weight:700; font-size:0.7rem;">No hay cierres registrados</div>'}
       </div>
    </div>
  </div>`
}

// ─── ACTIONS INITIALIZER ─────────────────────────────────────
export const initFinanceActions = (actions, container, refresh) => {
  Object.assign(actions, {
    VIEW_PROOF: (btn) => {
      const url = btn.dataset.url;
      const resident = btn.dataset.resident;
      const modal = document.getElementById('modal-layer');
      if (!modal) return;
      modal.style.pointerEvents = 'auto';
      modal.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.9); backdrop-filter: blur(15px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;">
          <div style="background: white; border-radius: 24px; width: 100%; max-width: 500px; padding: 24px; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <div style="font-size: 0.9rem; font-weight: 900; color: #1a1a2e;">📎 Comprobante — ${escapeHTML(resident || '')}</div>
              <button data-action="CANCEL_MODAL" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #999;">×</button>
            </div>
            <img src="${escapeHTML(url)}" style="width: 100%; border-radius: 16px; border: 1px solid #eee;" onerror="this.style.display='none'; this.parentElement.innerHTML+='<div style=\\'text-align:center;padding:20px;color:#999;font-weight:700;\\'>No se pudo cargar la imagen</div>'">
          </div>
        </div>
      `;
    },

    APPROVE_PAYMENT: async (btn) => {
      const paymentId = btn.dataset.id;
      const subId = btn.dataset.subId;
      const amount = parseFloat(btn.dataset.amount) || 0;
      btn.textContent = '...';
      btn.disabled = true;

      try {
        // 1. Actualizar pago a CONFIRMED
        const { error: payErr } = await supabase
          .from('payments')
          .update({ status: 'CONFIRMED', confirmed_at: new Date().toISOString() })
          .eq('id', paymentId);

        if (payErr) throw payErr;

        // 2. Extender suscripción 30 días
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);
        const { error: subErr } = await supabase
          .from('subscriptions')
          .update({
            expiry_date: newExpiry.toISOString(),
            status: 'ACTIVE',
            last_payment_date: new Date().toISOString()
          })
          .eq('id', subId);

        if (subErr) throw subErr;

        // 3. Notificar al residente por WhatsApp
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('resident_name, phone, expiry_date')
          .eq('id', subId)
          .single();

        if (sub?.phone) {
          const cleanPhone = sub.phone.replace(/\D/g, '');
          const targetPhone = cleanPhone.startsWith('58') ? cleanPhone : (cleanPhone.startsWith('0') ? '58' + cleanPhone.slice(1) : '58' + cleanPhone);
          const expiryFormatted = new Date(newExpiry).toLocaleDateString('es-VE');
          const msg = `¡Hola ${sub.resident_name}! 👋\n\nTu pago de $${amount.toFixed(2)} ha sido *APROBADO* ✅.\n\n📅 Nueva vigencia hasta: ${expiryFormatted}\n\n¡Gracias por confiar en Sloty! 🚗`;
          window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        }

        showToast('Pago aprobado y suscripción actualizada', 'success');
        logAudit('APPROVE_PAYMENT', { payment_id: paymentId, subscription_id: subId, amount });

        // Recargar
        await loadPendingPayments();
        store.cachedFinance = null;
        refresh();
      } catch (err) {
        console.error('Error aprobando pago:', err);
        showToast('Error al aprobar el pago', 'error');
        btn.textContent = '✓ APROBAR';
        btn.disabled = false;
      }
    },

    REJECT_PAYMENT: async (btn) => {
      const paymentId = btn.dataset.id;
      const subId = btn.dataset.subId;
      if (!confirm('¿Rechazar este pago? El residente deberá enviar un nuevo comprobante.')) return;

      btn.textContent = '...';
      btn.disabled = true;

      try {
        const { error } = await supabase
          .from('payments')
          .update({ status: 'REJECTED', rejected_at: new Date().toISOString() })
          .eq('id', paymentId);

        if (error) throw error;

        // Notificar rechazo
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('resident_name, phone')
          .eq('id', subId)
          .single();

        if (sub?.phone) {
          const cleanPhone = sub.phone.replace(/\D/g, '');
          const targetPhone = cleanPhone.startsWith('58') ? cleanPhone : (cleanPhone.startsWith('0') ? '58' + cleanPhone.slice(1) : '58' + cleanPhone);
          const msg = `Hola ${sub.resident_name},\n\nRevisamos tu comprobante de pago y *no pudimos verificarlo* ⚠️.\n\nPor favor, envía un nuevo comprobante claro con la referencia visible.\n\nEquipo Sloty 🚗`;
          window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        }

        showToast('Pago rechazado', 'success');
        logAudit('REJECT_PAYMENT', { payment_id: paymentId, subscription_id: subId });

        await loadPendingPayments();
        store.cachedFinance = null;
        refresh();
      } catch (err) {
        console.error('Error rechazando pago:', err);
        showToast('Error al rechazar el pago', 'error');
        btn.textContent = '✕ RECHAZAR';
        btn.disabled = false;
      }
    },

    BACK_TO_FINANCE: () => {
      store.pendingAction = null;
      store.cachedFinance = null; 
      store.cachedSubsAt = 0; 
      refresh();
    },
    SHOW_EXPENSE_MODAL: () => {
      const rateVal = store.currentBcv?.rate || 40.0;
      store.pendingAction = {
        type: 'CUSTOM_MODAL',
        title: 'Registrar Gasto / Egreso',
        content: `
          <div style="padding:10px; font-family:'Montserrat',sans-serif; text-align:left;">
            <div style="margin-bottom:15px;">
              <label style="font-size:0.65rem; font-weight:800; color:#666; text-transform:uppercase;">Categoría de Gasto</label>
              <select id="expense-category" style="width:100%; padding:14px; border-radius:14px; border:1.5px solid #eee; margin-top:6px; font-weight:700; font-family:inherit; background:#fafafa;">
                <option value="MANTENIMIENTO">🛠️ Mantenimiento / Reparaciones</option>
                <option value="NOMINA_GUARDIAS">👮 Nómina / Pago Guardias</option>
                <option value="SERVICIOS">⚡ Servicios (Luz, Agua, Internet)</option>
                <option value="CAJA_CHICA">📦 Caja Chica / Insumos</option>
                <option value="HONORARIOS">⚖️ Honorarios Profesionales</option>
                <option value="OTRO">📝 Otro Egreso Operativo</option>
              </select>
            </div>

            <div style="margin-bottom:15px;">
              <label style="font-size:0.65rem; font-weight:800; color:#666; text-transform:uppercase;">Descripción del Gasto</label>
              <input type="text" id="expense-desc" placeholder="Ej. Bombillos garita, quincena operador..." style="width:100%; padding:14px; border-radius:14px; border:1.5px solid #eee; margin-top:6px; font-weight:700; font-family:inherit; background:#fafafa;">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
              <div>
                <label style="font-size:0.65rem; font-weight:800; color:#666; text-transform:uppercase;">Monto en Dólares ($)</label>
                <input type="number" step="0.01" id="expense-amount-usd" placeholder="0.00" style="width:100%; padding:14px; border-radius:14px; border:1.5px solid #eee; margin-top:6px; font-weight:900; font-size:1.1rem; color:#e63946; font-family:inherit; background:#fafafa;">
              </div>
              <div>
                <label style="font-size:0.65rem; font-weight:800; color:#666; text-transform:uppercase;">Método de Pago</label>
                <select id="expense-method" style="width:100%; padding:14px; border-radius:14px; border:1.5px solid #eee; margin-top:6px; font-weight:700; font-family:inherit; background:#fafafa;">
                  <option value="EFECTIVO_USD">💵 Efectivo USD</option>
                  <option value="PAGO_MOVIL">📱 Pago Móvil</option>
                  <option value="TRANSFERENCIA">🏦 Transferencia</option>
                  <option value="EFECTIVO_BS">💵 Efectivo Bs</option>
                  <option value="ZELLE">🇺🇸 Zelle</option>
                </select>
              </div>
            </div>

            <!-- EQUIVALENTE EN BOLÍVARES EN VIVO -->
            <div id="expense-ves-preview" style="background:#f8f9fa; border:1px solid #eee; border-radius:14px; padding:12px 14px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.65rem; font-weight:800; color:#999; text-transform:uppercase;">Equivalente en Bs:</span>
              <span id="expense-ves-val" style="font-size:0.95rem; font-weight:900; color:#1a1a2e;">Bs. 0,00</span>
            </div>

            <div style="display:flex; gap:10px;">
              <button data-action="BACK_TO_FINANCE" style="flex:1; padding:15px; border-radius:14px; background:#f4f4f4; color:#666; font-weight:900; font-size:0.75rem; border:none; cursor:pointer;">
                CANCELAR
              </button>
              <button data-action="SUBMIT_EXPENSE" style="flex:2; padding:15px; border-radius:14px; background:#e63946; color:white; font-weight:900; font-size:0.75rem; border:none; cursor:pointer; text-transform:uppercase; box-shadow:0 6px 15px rgba(230,57,70,0.3);">
                ✓ REGISTRAR EGRESO
              </button>
            </div>
          </div>
        `
      };
      refresh();

      setTimeout(() => {
        const usdInput = document.getElementById('expense-amount-usd');
        const vesVal = document.getElementById('expense-ves-val');
        if (usdInput && vesVal) {
          usdInput.addEventListener('input', () => {
            const val = parseFloat(usdInput.value) || 0;
            vesVal.textContent = `Bs. ${(val * rateVal).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
          });
        }
      }, 100);
    },
    SUBMIT_EXPENSE: async () => {
      const cat = document.getElementById('expense-category')?.value || 'OTRO';
      const desc = document.getElementById('expense-desc')?.value?.trim();
      const amountUsd = parseFloat(document.getElementById('expense-amount-usd')?.value);
      const method = document.getElementById('expense-method')?.value || 'EFECTIVO_USD';

      if (!amountUsd || isNaN(amountUsd) || amountUsd <= 0) {
        alert('Por favor ingresa un monto válido mayor a $0.00.');
        return;
      }
      if (!desc) {
        alert('Por favor ingresa una breve descripción del gasto.');
        return;
      }

      const rateVal = store.currentBcv?.rate || 40.0;
      const amountBs = parseFloat((amountUsd * rateVal).toFixed(2));
      const state = getParkingState();

      const expensePayload = {
        id: `exp-${Date.now()}`,
        building_id: state.buildingId,
        category: cat,
        description: desc,
        amount_usd: amountUsd,
        amount_bs: amountBs,
        bcv_rate_used: rateVal,
        payment_method: method,
        expense_date: new Date().toISOString()
      };

      try {
        await supabase.from('building_expenses').insert([expensePayload]);
      } catch (e) {
        console.warn('[Sloty] Error inserting to building_expenses in Supabase, enqueuing sync:', e);
        enqueueSync({ table: 'building_expenses', action: 'INSERT', data: [expensePayload] });
      }

      // Guardar también en estado local
      state.expenses = state.expenses || [];
      state.expenses.unshift(expensePayload);
      saveParkingState(state);

      logAudit('REGISTRO_EGRESO', { category: cat, desc, amount_usd: amountUsd, amount_bs: amountBs });
      invalidateExpensesCache();
      showToast('Egreso registrado con éxito', 'success');

      store.pendingAction = null;
      store.cachedFinance = null;
      refresh();
    },
    VIEW_CLOSURE: (btn) => {
      const id = btn.dataset.id
      const state = getParkingState()
      const c = (state.closures || []).find(x => x.id === id)
      if (!c) return
      
      const expected = { EFECTIVO_USD: 0, EFECTIVO_BS: 0, PAGO_MOVIL: 0, TRANSFERENCIA: 0, ZELLE: 0 };
      const declared = { EFECTIVO_USD: 0, EFECTIVO_BS: 0, PAGO_MOVIL: 0, TRANSFERENCIA: 0, ZELLE: 0 };
      
      const normalizeMethodKey = (m) => {
        let k = (m || 'EFECTIVO_USD').toUpperCase().replace(/\s/g, '_');
        if (k === 'EFECTIVO') return 'EFECTIVO_USD';
        return k;
      };

      (c.movements || []).forEach(m => {
        const key = normalizeMethodKey(m.payMethod);
        if (expected[key] !== undefined) {
          expected[key] += (m.amount || 0);
        } else {
          expected[key] = (m.amount || 0);
        }
      });

      Object.entries(c.methods || {}).forEach(([m, val]) => {
        const key = normalizeMethodKey(m);
        if (declared[key] !== undefined) {
          declared[key] += (val || 0);
        } else {
          declared[key] = (val || 0);
        }
      });

      const allKeys = Array.from(new Set([...Object.keys(expected), ...Object.keys(declared)]));
      let totalExpected = 0;
      let totalDeclared = 0;
      let totalDiff = 0;

      const methodNames = {
        EFECTIVO_USD: 'Efectivo $',
        EFECTIVO_BS: 'Efectivo Bs',
        PAGO_MOVIL: 'Pago Móvil',
        TRANSFERENCIA: 'Transferencia',
        ZELLE: 'Zelle'
      };

      const tableRows = allKeys.map(key => {
        const expVal = expected[key] || 0;
        const decVal = declared[key] || 0;
        const diffVal = decVal - expVal;
        
        totalExpected += expVal;
        totalDeclared += decVal;
        totalDiff += diffVal;

        return `
          <tr style="border-bottom:1px solid #eee; font-size:0.75rem;">
            <td style="padding:12px 10px; font-weight:800; color:#374151;">${methodNames[key] || key}</td>
            <td style="padding:12px 10px; text-align:right; font-weight:700; color:#4b5563;">$${expVal.toFixed(2)}</td>
            <td style="padding:12px 10px; text-align:right; font-weight:900; color:#1f2937;">$${decVal.toFixed(2)}</td>
            <td style="padding:12px 10px; text-align:right; font-weight:900; color:${diffVal < 0 ? '#ef4444' : diffVal > 0 ? '#22c55e' : '#6b7280'};">
              ${diffVal === 0 ? '$0.00' : (diffVal > 0 ? '+' : '') + '$' + diffVal.toFixed(2)}
            </td>
          </tr>
        `;
      }).join('');

      store.pendingAction = {
        type: 'CUSTOM_MODAL',
        title: `Cierre: ${escapeHTML(c.guard_name)}`,
        content: `
          <div style="padding:10px; text-align:left;">
             <div style="font-size:0.6rem; font-weight:800; color:#9b9b9b; text-transform:uppercase; margin-bottom:15px;">
                Fecha Cierre: ${new Date(c.ended_at || c.timestamp).toLocaleString()}
             </div>
             
             <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
               <thead>
                 <tr style="border-bottom:2px solid #e5e7eb; font-size:0.6rem; font-weight:900; color:#9ca3af; text-transform:uppercase;">
                   <th style="padding:8px 10px; text-align:left;">Método</th>
                   <th style="padding:8px 10px; text-align:right;">Esperado</th>
                   <th style="padding:8px 10px; text-align:right;">Declarado</th>
                   <th style="padding:8px 10px; text-align:right;">Diferencia</th>
                 </tr>
               </thead>
               <tbody>
                 ${tableRows}
                 <tr style="border-top:2px solid #e5e7eb; font-size:0.8rem; font-weight:900; background:#f9fafb;">
                   <td style="padding:15px 10px; color:#111827;">Total</td>
                   <td style="padding:15px 10px; text-align:right; color:#4b5563;">$${totalExpected.toFixed(2)}</td>
                   <td style="padding:15px 10px; text-align:right; color:#111827;">$${totalDeclared.toFixed(2)}</td>
                   <td style="padding:15px 10px; text-align:right; color:${totalDiff < 0 ? '#ef4444' : totalDiff > 0 ? '#22c55e' : '#111827'};">
                     $${totalDiff.toFixed(2)}
                   </td>
                 </tr>
               </tbody>
             </table>

             ${c.comments ? `
               <div style="background:#f3f4f6; border-radius:16px; padding:15px; margin-bottom:20px;">
                  <div style="font-size:0.55rem; font-weight:800; color:#6b7280; text-transform:uppercase; margin-bottom:5px;">Comentarios del Guardia</div>
                  <div style="font-size:0.75rem; color:#374151; font-weight:700; line-height:1.4;">"${escapeHTML(c.comments)}"</div>
               </div>
             ` : ''}

             <div style="text-align:center;">
                <button onclick="window.print()" style="background:#f3f4f6; border:none; padding:12px 25px; border-radius:15px; font-weight:900; font-size:0.75rem; color:var(--primary); cursor:pointer; width:100%; display:inline-flex; align-items:center; justify-content:center; gap:8px;">
                   🖨️ IMPRIMIR COMPROBANTE
                </button>
             </div>
          </div>
        `
      };
      refresh();
    },
    VIEW_GUARD_DETAIL: async (btn) => {
      const guardName = btn.dataset.guard;
      const state = getParkingState();
      // 🛡️ Data Minimization: select explicit columns
      const { data: gShifts } = await supabase
        .from('guard_shifts')
        .select('id, guard_name, started_at, ended_at, total_cash, total_mobile, total_bs, entries, exits, absences')
        .eq('building_id', state.buildingId)
        .eq('guard_name', guardName)
        .order('ended_at', { ascending: false });

      const { data: incs } = await supabase
        .from('incidents')
        .select('type,description,resolved,created_at')
        .eq('building_id', state.buildingId)
        .eq('guard_name', guardName);

      const shifts = gShifts || [];
      const totalEarned = shifts.reduce((a, s) => a + (s.total_cash||0) + (s.total_mobile||0) + (s.total_bs||0), 0);
      const totalEntries = shifts.reduce((a, s) => a + (s.entries||0), 0);
      const totalExits = shifts.reduce((a, s) => a + (s.exits||0), 0);
      const totalAbsMin = shifts.reduce((a, s) => a + (s.absences||[]).reduce((b, ab) => b + (ab.duration_min||0), 0), 0);
      
      const totalIncidents = (incs||[]).length;

      store.pendingAction = {
        type: 'CUSTOM_MODAL',
        title: `Detalle: ${guardName}`,
        content: `
        <div style="max-height:80vh; overflow-y:auto; padding:10px; text-align:left;">
          <!-- RESUMEN GLOBAL DEL GUARDIA -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
            <div style="background:#1a1a2e; color:white; padding:20px; border-radius:20px; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900;">$${totalEarned.toFixed(2)}</div>
              <div style="font-size:0.6rem; color:#F5C518; font-weight:700; margin-top:4px;">TOTAL RECAUDADO</div>
            </div>
            <div style="background:#F5C518; color:#1a1a2e; padding:20px; border-radius:20px; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900;">${shifts.length}</div>
              <div style="font-size:0.6rem; font-weight:700; margin-top:4px;">TURNOS TOTALES</div>
            </div>
          </div>

          <!-- ESTADÍSTICAS OPERACIONALES -->
          <div style="background:#fafafa; border:1px solid #eee; border-radius:24px; padding:20px; margin-bottom:20px; display:grid; grid-template-columns:1fr 1fr; gap:15px;">
             <div>
                <div style="font-size:0.5rem; color:#999; font-weight:800; text-transform:uppercase;">Vehículos Ingresados</div>
                <div style="font-size:1.2rem; font-weight:900; color:var(--primary);">${totalEntries}</div>
             </div>
             <div>
                <div style="font-size:0.5rem; color:#999; font-weight:800; text-transform:uppercase;">Vehículos Salidos</div>
                <div style="font-size:1.2rem; font-weight:900; color:var(--primary);">${totalExits}</div>
             </div>
             <div>
                <div style="font-size:0.5rem; color:#999; font-weight:800; text-transform:uppercase;">Ausencias (Tiempo)</div>
                <div style="font-size:1.2rem; font-weight:900; color:#ef4444;">${totalAbsMin} Min</div>
             </div>
             <div>
                <div style="font-size:0.5rem; color:#999; font-weight:800; text-transform:uppercase;">Incidentes Reportados</div>
                <div style="font-size:1.2rem; font-weight:900; color:#f59e0b;">${totalIncidents}</div>
             </div>
          </div>

          <!-- HISTORIAL DE TURNOS -->
          <div style="font-size:0.65rem; font-weight:900; color:var(--primary); text-transform:uppercase; margin-bottom:12px; letter-spacing:0.5px;">Últimos Turnos</div>
          <div style="display:grid; gap:10px;">
             ${shifts.map(s => {
               const sum = (s.total_cash||0) + (s.total_mobile||0) + (s.total_bs||0)
               return `
               <div style="background:white; border:1px solid #f0f0f0; border-radius:18px; padding:15px; font-size:0.7rem;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                     <div style="font-weight:900; color:#1a1a2e;">${s.ended_at ? new Date(s.ended_at).toLocaleDateString() : 'Turno Activo'}</div>
                     <div style="font-weight:900; color:#22c55e;">$${sum.toFixed(2)}</div>
                  </div>
                  <div style="font-size:0.55rem; color:#999; font-weight:700;">
                     Entradas: ${s.entries} | Salidas: ${s.exits} | Ausencias: ${(s.absences||[]).length}
                  </div>
               </div>`
             }).join('') || '<div style="text-align:center; padding:20px; color:#ccc;">Sin turnos recientes</div>'}
          </div>
        </div>`
      };
      refresh();
    },
    DOWNLOAD_REPORT: async (btn) => {
      const type = btn.dataset.type;
      const state = getParkingState();
      btn.textContent = '...';
      
      try {
        if (type === 'CSV') {
          // 🛡️ Data Minimization: select explicit columns
          const { data: logs } = await supabase.from('access_logs')
            .select('type, created_at, guard_name, plate, is_resident, custom_price, visitors(resident_name, company, destination, tower, apt)')
            .eq('building_id', state.buildingId)
            .order('created_at', { ascending: false })
            .limit(1000);
            
          let csv = 'Fecha,Tipo,Placa,Residente,Monto,Guardia,Torre,Apto\n';
          (logs || []).forEach(l => {
            csv += `"${new Date(l.created_at).toLocaleString()}","${l.type}","${l.plate || ''}","${l.is_resident ? 'SI' : 'NO'}","${l.custom_price||0}","${l.guard_name||''}","${l.visitors?.tower||''}","${l.visitors?.apt||''}"\n`;
          });
          const uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
          const link = document.createElement('a');
          link.href = uri;
          link.download = `Sloty_Trace_${Date.now()}.csv`;
          document.body.appendChild(link);
          link.click();
          link.remove();
        } else if (type === 'PDF') {
          // 🛡️ Data Minimization: select explicit columns
          const [ { data: shifts }, { data: expenses }, { data: pays } ] = await Promise.all([
            supabase.from('guard_shifts')
              .select('ended_at, started_at, guard_name, movements, total_cash, total_bs, total_mobile')
              .eq('building_id', state.buildingId)
              .order('ended_at', { ascending: false })
              .limit(30),
            supabase.from('building_expenses')
              .select('category, description, amount_usd, amount_bs, bcv_rate_used, payment_method, expense_date')
              .eq('building_id', state.buildingId)
              .order('expense_date', { ascending: false })
              .limit(30),
            supabase.from('payments')
              .select('amount, method, payment_date, status')
              .eq('building_id', state.buildingId)
              .eq('status', 'CONFIRMED')
              .order('payment_date', { ascending: false })
              .limit(30)
          ]);
          
          const totalSubsIncome = (pays || []).reduce((a, p) => a + (Number(p.amount) || 0), 0);
          const totalGuardIncome = (shifts || []).reduce((a, s) => a + (Number(s.total_cash)||0) + (Number(s.total_mobile)||0) + (Number(s.total_bs)||0), 0);
          const totalIncome = totalSubsIncome + totalGuardIncome;
          const totalExp = (expenses || []).reduce((a, e) => a + (Number(e.amount_usd) || 0), 0);
          const netBalance = totalIncome - totalExp;
          const rateVal = store.currentBcv?.rate || 40.0;
          const netBalanceBs = netBalance * rateVal;

          let expensesRows = (expenses || []).map(e => `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:8px 10px;">${new Date(e.expense_date).toLocaleDateString()}</td>
              <td style="padding:8px 10px; font-weight:bold; color:#e63946;">${escapeHTML(e.category)}</td>
              <td style="padding:8px 10px;">${escapeHTML(e.description)}</td>
              <td style="padding:8px 10px;">${escapeHTML(e.payment_method || 'EFECTIVO')}</td>
              <td style="padding:8px 10px; text-align:right; font-weight:bold; color:#e63946;">-$${Number(e.amount_usd || 0).toFixed(2)}</td>
            </tr>
          `).join('') || '<tr><td colspan="5" style="padding:15px; text-align:center; color:#999;">Sin egresos registrados</td></tr>';

          let shiftHtml = '<table style="width:100%; border-collapse:collapse; margin-top:15px; font-size:12px;">' +
             '<tr style="background:#1a1a2e; color:white;"><th style="padding:10px; text-align:left;">FECHA DE CIERRE</th><th style="padding:10px; text-align:left;">GUARDIA</th><th style="padding:10px; text-align:left;">DETALLE COBROS</th><th style="padding:10px; text-align:right;">TOTAL CIERRE</th></tr>';
             
          (shifts || []).forEach(s => {
             const m = s.movements || [];
             const e = m.filter(x=>x.type==='ENTRY').length;
             const x = m.filter(x=>x.type==='EXIT').length;
             const sum = (s.total_cash||0) + (s.total_mobile||0) + (s.total_bs||0);
             shiftHtml += `<tr style="border-bottom:1px solid #eee;">
               <td style="padding:10px;">${s.ended_at ? new Date(s.ended_at).toLocaleString() : new Date(s.started_at).toLocaleString()}</td>
               <td style="padding:10px; font-weight:bold;">${escapeHTML(s.guard_name)}</td>
               <td style="padding:10px;">
                 <div style="font-weight:bold; margin-bottom:2px;">${e} Entradas / ${x} Salidas</div>
                 <div style="font-size:10px; color:#666;">USD: $${(s.total_cash||0).toFixed(2)} | Bs Efec: $${(s.total_bs||0).toFixed(2)} | PagoMóvil: $${(s.total_mobile||0).toFixed(2)}</div>
               </td>
               <td style="padding:10px; text-align:right;">
                 <div style="font-weight:bold; font-size:14px; color:#22c55e;">$${sum.toFixed(2)}</div>
               </td>
             </tr>`;
          });
          shiftHtml += '</table>';
          
          const win = window.open('', '_blank');
          win.document.write(`
            <html><head><title>Estado de Cuenta y Reporte Financiero - Sloty</title>
            <style>
              body{font-family:'Montserrat', sans-serif; color:#333; padding:40px; margin:0;}
              .card{background:#f8f9fa; border-radius:12px; padding:15px; margin-bottom:20px; border:1px solid #eee;}
              .badge{padding:4px 8px; border-radius:6px; font-weight:bold; font-size:11px;}
              @media print{ @page {margin: 1.2cm;} body{padding:0;} }
            </style>
            </head><body>
               <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #F5C518; padding-bottom:15px; margin-bottom:25px;">
                  <div>
                     <h1 style="color:#1a1a2e; margin:0; font-size:24px; letter-spacing:0.5px;">ESTADO DE CUENTA Y BALANCE FINANCIERO</h1>
                     <div style="color:#666; font-size:13px; margin-top:4px;">Generado el ${new Date().toLocaleString()} · Tasa BCV: Bs. ${rateVal.toFixed(2)}</div>
                  </div>
                  <div style="text-align:right;">
                    <h2 style="color:#1a1a2e; text-transform:uppercase; margin:0; font-size:20px;">${escapeHTML(state.buildingName)}</h2>
                    <div style="color:#888; font-size:11px; font-weight:bold; margin-top:2px;">CÓDIGO: ${escapeHTML(state.buildingCode)}</div>
                  </div>
               </div>
               
               <!-- RESUMEN EJECUTIVO -->
               <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:15px; margin-bottom:30px;">
                  <div class="card" style="border-left:4px solid #22c55e;">
                     <div style="font-size:11px; font-weight:bold; color:#666; text-transform:uppercase;">TOTAL INGRESOS</div>
                     <div style="font-size:22px; font-weight:900; color:#22c55e; margin-top:4px;">+$${totalIncome.toFixed(2)}</div>
                     <div style="font-size:10px; color:#888; margin-top:2px;">Garita + Mensualidades</div>
                  </div>
                  <div class="card" style="border-left:4px solid #e63946;">
                     <div style="font-size:11px; font-weight:bold; color:#666; text-transform:uppercase;">TOTAL EGRESOS / GASTOS</div>
                     <div style="font-size:22px; font-weight:900; color:#e63946; margin-top:4px;">-$${totalExp.toFixed(2)}</div>
                     <div style="font-size:10px; color:#888; margin-top:2px;">Operatividad y Nómina</div>
                  </div>
                  <div class="card" style="border-left:4px solid #1a1a2e; background:#1a1a2e; color:white;">
                     <div style="font-size:11px; font-weight:bold; color:#F5C518; text-transform:uppercase;">BALANCE NETO REAL</div>
                     <div style="font-size:22px; font-weight:900; color:${netBalance >= 0 ? '#22c55e' : '#e63946'}; margin-top:4px;">
                        ${netBalance >= 0 ? '+' : ''}$${netBalance.toFixed(2)}
                     </div>
                     <div style="font-size:10px; color:rgba(255,255,255,0.7); margin-top:2px;">≈ Bs. ${netBalanceBs.toLocaleString('es-VE', {minimumFractionDigits:2})}</div>
                  </div>
               </div>

               <!-- TABLA DE EGRESOS -->
               <h3 style="color:#1a1a2e; border-bottom:1.5px solid #ddd; padding-bottom:6px; margin-bottom:10px; font-size:15px;">1. Egresos y Gastos Operativos Recientes</h3>
               <table style="width:100%; border-collapse:collapse; margin-bottom:30px; font-size:12px;">
                  <tr style="background:#f4f4f5; font-size:11px; text-transform:uppercase;">
                     <th style="padding:8px 10px; text-align:left;">Fecha</th>
                     <th style="padding:8px 10px; text-align:left;">Categoría</th>
                     <th style="padding:8px 10px; text-align:left;">Descripción</th>
                     <th style="padding:8px 10px; text-align:left;">Método</th>
                     <th style="padding:8px 10px; text-align:right;">Monto USD</th>
                  </tr>
                  ${expensesRows}
               </table>

               <!-- TABLA DE CIERRES -->
               <h3 style="color:#1a1a2e; border-bottom:1.5px solid #ddd; padding-bottom:6px; margin-bottom:10px; font-size:15px;">2. Cierres de Turno en Garita (Últimos 30)</h3>
               ${shiftHtml}

               <div style="margin-top:40px; padding-top:20px; border-top:1px solid #ddd; text-align:center; font-size:11px; color:#888;">
                  Documento emitido por el Sistema de Gestión Sloty. Válido como reporte administrativo interno.
               </div>
            </body></html>
          `);
          win.document.close();
          win.print();
        }
      } catch (e) {
        console.error('Report Generation Error:', e);
        showToast('Error al generar el reporte', 'error');
      } finally {
        btn.textContent = type === 'CSV' ? '↓ CSV' : '↓ REPORTE PDF';
      }
    }
  });
}
