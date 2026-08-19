/**
 * Admin Finance — Live cash, payments, audits and reports (FINANCE tab)
 * Extracted from admin.js (Phase C Lot 2 refactor)
 */
import { supabase, getParkingState, logAudit, showToast, getExchangeRate, hasFeature } from '../../db.js'
import { escapeHTML } from '../../utils/sanitize.js'
import { ICONS } from './admin-ui-components.js'
import { store } from './admin-store.js'

// ─── FINANCE TAB RENDERER (FINANCE) ───────────────────────────
export const renderFinanceSummary = async (state) => {
  if (!hasFeature('finance_report')) {
    return `<div style="padding:40px; text-align:center; color:#999;">
      <div style="font-size:2rem; margin-bottom:12px;">🔒</div>
      <div style="font-weight:900; color:#1a1a2e;">Función no disponible</div>
      <div style="font-size:0.75rem; margin-top:8px;">
        Disponible desde plan Plata. Contacta a tu administrador Sloty.
      </div>
    </div>`
  }

  const now = new Date()
  const todayStr = new Date().toISOString().split('T')[0]

  const subsPays = store.cachedFinance?.subsPays || [];
  const todayPays = store.cachedFinance?.todayPays || [];
  const guardShifts = store.cachedFinance?.guardShifts || [];

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
  
  // Revenue calculations
  const revToday = movs.filter(m => new Date(m.timestamp) >= todayStart).reduce((a, m) => a + (m.amount || 0), 0)
  const revWeek = movs.filter(m => new Date(m.timestamp) >= sevenDaysAgo).reduce((a, m) => a + (m.amount || 0), 0)
  const projection = revWeek > 0 ? (revWeek / 7) * 7 : 0 

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
          <div style="font-size:0.95rem; font-weight:900; color:#F5C518;">Bs. ${Number(bcv.rate).toLocaleString('es-VE', {minimumFractionDigits:2})}</div>
          <div style="font-size:0.5rem; color:rgba(255,255,255,0.4); font-weight:700;">${bcv.source === 'manual' ? '⚠️ Manual' : '✓ BCV'} · ${bcv.fecha}</div>
        `;
      }
      const f2 = document.getElementById('finance-month-bcv');
      if (f2) {
        f2.innerHTML = `Bs. ${Number(bcv.rate).toLocaleString('es-VE', {minimumFractionDigits:2})} / USD ${bcv.source === 'manual' ? '· ⚠️ Manual' : '· ✓ BCV'} · ${bcv.fecha}`;
        f2.style.display = 'block';
      }
    });
  }, 50);

  return `
  <div style="padding:20px; padding-bottom:120px; background:#f8f9fa;">
    <!-- CABECERA -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
       <div>
         <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin:0;">FINANZAS & REPORTES</h2>
         <div style="font-size:0.6rem; color:#999; font-weight:800; text-transform:uppercase; margin-top:2px;">Centro contable administrativo</div>
       </div>
       <div id="finance-bcv-rate" style="background:#1a1a2e; color:white; border-radius:16px; padding:8px 15px; text-align:right; border:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:0.95rem; font-weight:900; color:#F5C518;">Bs. --.--</div>
          <div style="font-size:0.5rem; color:rgba(255,255,255,0.4); font-weight:700;">Cargando...</div>
       </div>
    </div>

    <!-- TARJETAS DESTACADAS -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
       <div style="background:white; padding:20px; border-radius:24px; border:1px solid #eee; box-shadow:0 10px 30px rgba(0,0,0,0.02);">
          <div style="font-size:0.5rem; font-weight:800; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Ingresos Totales (Garita)</div>
          <div style="font-size:1.6rem; font-weight:950; color:var(--primary);">$${revToday.toFixed(2)}</div>
          <div style="font-size:0.55rem; font-weight:700; color:#22c55e; margin-top:4px;">Hoy (${successfulCollections} Transacciones)</div>
       </div>
       <div style="background:white; padding:20px; border-radius:24px; border:1px solid #eee; box-shadow:0 10px 30px rgba(0,0,0,0.02);">
          <div style="font-size:0.5rem; font-weight:800; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Cobros de Mensualidades</div>
          <div style="font-size:1.6rem; font-weight:950; color:#22c55e;">$${subsRevToday.toFixed(2)}</div>
          <div style="font-size:0.55rem; font-weight:700; color:#555555; margin-top:4px;">Hoy ($${subsRevMonth.toFixed(0)} este mes)</div>
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
    BACK_TO_FINANCE: () => {
      store.pendingAction = null;
      store.cachedFinance = null; 
      store.cachedSubsAt = 0; 
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
          const { data: shifts } = await supabase.from('guard_shifts')
            .select('ended_at, started_at, guard_name, movements, total_cash, total_bs, total_mobile')
            .eq('building_id', state.buildingId)
            .order('ended_at', { ascending: false })
            .limit(50);
          
          let shiftHtml = '<table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:12px;">' +
             '<tr style="background:#1a1a2e; color:white;"><th style="padding:10px; text-align:left;">FECHA DE CIERRE</th><th style="padding:10px; text-align:left;">GUARDIA</th><th style="padding:10px; text-align:left;">DETALLE COBROS (Movimientos)</th><th style="padding:10px; text-align:right;">TOTAL CIERRE</th></tr>';
             
          (shifts || []).forEach(s => {
             const m = s.movements || [];
             const e = m.filter(x=>x.type==='ENTRY').length;
             const x = m.filter(x=>x.type==='EXIT').length;
             const sum = (s.total_cash||0) + (s.total_mobile||0) + (s.total_bs||0);
             shiftHtml += `<tr style="border-bottom:1px solid #eee;">
               <td style="padding:10px;">${s.ended_at ? new Date(s.ended_at).toLocaleString() : new Date(s.started_at).toLocaleString()}</td>
               <td style="padding:10px; font-weight:bold;">${escapeHTML(s.guard_name)}</td>
               <td style="padding:10px;">
                 <div style="font-weight:bold; margin-bottom:4px;">${e} Entradas / ${x} Salidas</div>
                 <div style="font-size:10px; color:#555;">
                   USD Efec: $${(s.total_cash||0).toFixed(2)} | BS Efec: $${(s.total_bs||0).toFixed(2)} | PagoMóvil: $${(s.total_mobile||0).toFixed(2)}
                 </div>
               </td>
               <td style="padding:10px; text-align:right;">
                 <div style="font-weight:bold; font-size:16px; color:#22c55e;">$${sum.toFixed(2)}</div>
               </td>
             </tr>`;
          });
          shiftHtml += '</table>';
          
          const win = window.open('', '_blank');
          win.document.write(`
            <html><head><title>Reporte Contable - Sloty</title>
            <style>body{font-family:'Montserrat', sans-serif; color:#333; padding:40px; margin:0;} @media print{ @page {margin: 1cm;} }</style>
            </head><body>
               <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #F5C518; padding-bottom:15px; margin-bottom:30px;">
                  <div>
                     <h1 style="color:#1a1a2e; margin:0; font-size:24px;">REPORTE CONTABLE</h1>
                     <div style="color:#666; font-size:14px; margin-top:5px;">Generado el ${new Date().toLocaleString()}</div>
                  </div>
                  <h2 style="color:#1a1a2e; text-transform:uppercase; margin:0;">${escapeHTML(state.buildingName)}</h2>
               </div>
               
               <h3 style="color:#1a1a2e; border-bottom:1px solid #ccc; padding-bottom:5px;">Auditoría de Cierres de Turno (Últimos 50)</h3>
               ${shiftHtml}
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
