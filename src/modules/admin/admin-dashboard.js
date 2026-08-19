/**
 * Admin Dashboard — HOME tab renderer and metrics loader
 * Extracted from admin.js (Phase C refactor)
 */
import { supabase, getParkingState } from '../../db.js'
import { store } from './admin-store.js'

// ─── EXPIRING SUBSCRIPTIONS BANNER ────────────────────────────
export const checkExpiringSubscriptions = async (buildingId) => {
  const today   = new Date();
  const in3days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [{ data: expired }, { data: expiring }] = await Promise.all([
    supabase.from('subscriptions')
      .select('id, resident_name, expiry_date, phone')
      .eq('building_id', buildingId)
      .lt('expiry_date', today.toISOString())
      .eq('status', 'ACTIVE'),
    supabase.from('subscriptions')
      .select('id, resident_name, expiry_date, phone')
      .eq('building_id', buildingId)
      .lte('expiry_date', in3days.toISOString())
      .gte('expiry_date', today.toISOString())
  ]);

  const expiredCount  = (expired  || []).length;
  const expiringCount = (expiring || []).length;
  if (expiredCount === 0 && expiringCount === 0) return;

  const existing = document.getElementById('expiry-alert-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'expiry-alert-banner';
  banner.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:9999;
    background:#e63946;color:white;padding:calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px 16px;font-size:0.75rem;
    font-weight:900;display:flex;justify-content:space-between;align-items:center;`;
  banner.innerHTML = `
    <span>
      ${expiredCount  > 0 ? `🚨 ${expiredCount} vencida${expiredCount  !== 1 ? 's' : ''}` : ''}
      ${expiringCount > 0 ? `⚠️ ${expiringCount} vence${expiringCount !== 1 ? 'n' : ''} en 3 días` : ''}
    </span>
    <div style="display:flex;gap:8px;align-items:center;">
      <button onclick="handleAction('GO_TO_SUBS')"
        style="background:white;color:#e63946;border:none;border-radius:6px;
               padding:4px 10px;font-size:0.65rem;font-weight:900;cursor:pointer;">
        VER
      </button>
      <button onclick="document.getElementById('expiry-alert-banner').remove()"
        style="background:transparent;color:white;border:none;
               font-size:1.2rem;cursor:pointer;line-height:1;">×</button>
    </div>`;
  document.body.appendChild(banner);
};

// ─── HOME METRICS LOADER ──────────────────────────────────────
export const loadHomeMetrics = async () => {
  if (store.metricsLoading) return
  store.metricsLoading = true
  const s = getParkingState()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  
  const [subsRes, paysRes, pendRes] = await Promise.all([
    supabase.from('subscriptions').select('id,custom_price,expiry_date,status').eq('building_id', s.buildingId),
    supabase.from('payments').select('amount').eq('building_id', s.buildingId).eq('status', 'CONFIRMED').gte('payment_date', monthStart),
    supabase.from('payments').select('id').eq('building_id', s.buildingId).eq('status', 'PENDING')
  ])
  
  store.cachedMetrics = {
    subs: subsRes.data || [],
    pays: paysRes.data || [],
    pends: pendRes.data || [],
    loadedAt: Date.now()
  }
  store.metricsLoading = false
}

// ─── HOME TAB RENDERER ───────────────────────────────────────
export const renderHome = async (state, ads = []) => {
  const movements = state.movements || []
  const stats = state.stats || { totalSpots: 0, occupied: 0 }
  const total = stats.totalSpots || 0
  const occ = stats.occupied || 0
  const perc = total > 0 ? Math.round((occ / total) * 100) : 0
  const dash = 251.2
  const offset = dash - (perc / 100) * dash

  const activeAds = (ads || []).filter(a => a.active) || []

  let avgHours = 0;
  const salidas = movements.filter(m => m.type === 'EXIT');
  if (salidas.length > 0) {
    let totalMs = 0; let counted = 0;
    salidas.forEach(sal => {
      const ing = movements.find(m => (m.type === 'ENTRY' || m.type === 'INGRESO') && m.plate === sal.plate && m.timestamp < sal.timestamp);
      if (ing) { totalMs += (new Date(sal.timestamp) - new Date(ing.timestamp)); counted++; }
    });
    if (counted > 0) avgHours = (totalMs / counted) / (1000 * 60 * 60);
  }

  // --- MONTHLY INTELLIGENCE: use cached data ---
  const now = new Date()
  const in7days = new Date(now.getTime() + 7 * 86400000).toISOString()

  if (!store.cachedMetrics) store.cachedMetrics = { subs: [], pays: [], pends: [] };
  const subs = store.cachedMetrics?.subs || []
  const pays = store.cachedMetrics?.pays || []
  const pends = store.cachedMetrics?.pends || []

  const proyectado = subs.reduce((a, s) => a + (s.custom_price || 0), 0)
  const cobradoMes = pays.reduce((a, p) => a + (p.amount || 0), 0)
  const pendientesCount = pends.length
  const porVencer = subs.filter(s => {
    const exp = new Date(s.expiry_date)
    return exp > now && exp <= new Date(in7days)
  }).length
  const vencidos = subs.filter(s => new Date(s.expiry_date) < now).length
  const activos = subs.filter(s => new Date(s.expiry_date) >= now).length

  // Alertas de suscripción proximas a vencer
  const alertSus = subs.filter(s => {
    const exp = new Date(s.expiry_date);
    const diff = (exp - now) / 86400000;
    return diff <= 3;
  }).sort((a,b) => new Date(a.expiry_date) - new Date(b.expiry_date)).slice(0, 3);

  const alertHtml = alertSus.length > 0 ? `
      <div style="margin-bottom:25px;">
        <div style="font-size:0.6rem; font-weight:900; color:#e63946; letter-spacing:1px; margin-bottom:10px;">🔴 ALERTAS DE VENCIMIENTO</div>
        <div style="display:grid; gap:10px;">
          ${alertSus.map(s => {
            const exp = new Date(s.expiry_date);
            const diff = Math.ceil((exp - now) / 86400000);
            return `
              <div data-action="TAB" data-tab="SUBS" style="background:rgba(230,57,70,0.05); border:1.5px solid rgba(230,57,70,0.2); border-radius:18px; padding:15px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                <div style="flex:1;">
                   <div style="font-size:0.8rem; font-weight:900; color:#1a1a2e; text-transform:uppercase;">${s.resident_name || 'Residente'}</div>
                   <div style="font-size:0.6rem; color:#e63946; font-weight:700;">${diff < 0 ? `Vencido hace ${Math.abs(diff)} días` : diff === 0 ? 'Vence hoy' : `Vence en ${diff} días`}</div>
                </div>
                <div style="background:#e63946; color:white; font-size:0.55rem; font-weight:900; padding:4px 10px; border-radius:8px;">COBRAR</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : '';

  const statCard = (label, value, sub, color, tab = 'SUBS') => `
      <div data-action="TAB" data-tab="${tab}" style="background:white;padding:18px;border-radius:22px;border:1px solid #f0f0f0;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.03);">
        <div style="font-size:0.5rem;font-weight:800;color:#555555;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${label}</div>
        <div style="font-size:1.5rem;font-weight:900;color:${color};">${value}</div>
        <div style="font-size:0.55rem;font-weight:700;color:#555555;margin-top:4px;">${sub}</div>
      </div>`

  // CAJA EN VIVO
  const liveUsd = movements.filter(m => !m.closed && m.payMethod === 'EFECTIVO_USD').reduce((a,m)=>a+(m.amount||0),0);
  const liveBs = movements.filter(m => !m.closed && m.payMethod === 'EFECTIVO_BS').reduce((a,m)=>a+(m.amount||0),0);
  const livePm = movements.filter(m => !m.closed && m.payMethod === 'PAGO_MOVIL').reduce((a,m)=>a+(m.amount||0),0);
  const liveTransfer = movements.filter(m => !m.closed && m.payMethod === 'TRANSFERENCIA').reduce((a,m)=>a+(m.amount||0),0);
  const liveZelle = movements.filter(m => !m.closed && m.payMethod === 'ZELLE').reduce((a,m)=>a+(m.amount||0),0);

  const rate = store.currentBcv?.rate || 40;
  const liveTotalUsd = liveUsd + liveBs + livePm + liveTransfer + liveZelle;
  const liveTotalBs = (liveBs + livePm + liveTransfer) * rate;

  const cajaEnVivoHtml = `
      <div data-action="TAB" data-tab="FINANCE" style="cursor:pointer; background:linear-gradient(135deg, #1a1a2e 0%, #2a2a4e 100%); border-radius:24px; padding:22px; margin-bottom:25px; box-shadow:0 10px 30px rgba(0,0,0,0.15); display:flex; justify-content:space-between; align-items:center; position:relative; overflow:hidden;">
        <div style="position:absolute; right:-20px; top:-20px; width:120px; height:120px; background:rgba(255,255,255,0.03); border-radius:50%;"></div>
        <div style="position:absolute; right:40px; bottom:-40px; width:80px; height:80px; background:rgba(34,197,94,0.05); border-radius:50%;"></div>
        <div style="z-index:1;">
           <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
             <div style="width:8px; height:8px; background:#22c55e; border-radius:50%; box-shadow:0 0 10px #22c55e; animation:skPulse 1.5s infinite;"></div>
             <div style="font-size:0.65rem; font-weight:900; color:white; letter-spacing:1px; text-transform:uppercase;">CAJA EN VIVO (Garita)</div>
           </div>
           <div style="display:flex; align-items:baseline; gap:10px;">
             <div style="font-size:2.2rem; font-weight:900; color:#22c55e; line-height:1;">$${liveTotalUsd.toFixed(2)}</div>
             <div style="font-size:1.1rem; font-weight:700; color:#ffffff;">≈ Bs. ${liveTotalBs.toLocaleString('es-VE', {minimumFractionDigits:2})}</div>
           </div>
           <div style="font-size:0.6rem; font-weight:800; color:rgba(255,255,255,0.85); margin-top:8px; display:flex; gap:10px; flex-wrap:wrap;">
             <span>USD: $${liveUsd.toFixed(2)}</span>
             <span>Bs (Efect.): Bs. ${(liveBs * rate).toLocaleString('es-VE', {maximumFractionDigits:0})}</span>
             <span>P. Móvil: Bs. ${(livePm * rate).toLocaleString('es-VE', {maximumFractionDigits:0})}</span>
             <span>Zelle: $${liveZelle.toFixed(2)}</span>
           </div>
        </div>
        <div style="background:rgba(255,255,255,0.1); width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; z-index:1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    `;

  return `
      <div style="padding:20px; padding-bottom:100px; background:#f8f9fa;">
        ${cajaEnVivoHtml}
        ${alertHtml}


        <!-- STATS DASHBOARD -->
        <div class="stats-dashboard">
           <div class="usage-circle-container">
              <div style="font-size:0.6rem; font-weight:800; color:#999; margin-bottom:15px; text-transform:uppercase;">DENSIDAD DE USO</div>
              <div style="position:relative; width:100px; height:100px;">
                <svg width="100" height="100" viewBox="0 0 100 100" style="transform:rotate(-90deg);">
                  <circle cx="50" cy="50" r="40" stroke="#eee" stroke-width="10" fill="none" />
                  <circle cx="50" cy="50" r="40" stroke="#22c55e" stroke-width="10" fill="none"
                    stroke-dasharray="${dash}" stroke-dashoffset="${offset}" stroke-linecap="round" style="transition:all 1s;" />
                </svg>
                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.2rem; font-weight:900; color:var(--primary);">${perc}%</div>
              </div>
              <div style="margin-top:15px; text-align:center;">
                <div style="font-size:0.8rem; font-weight:900; color:var(--primary);">${occ} de ${total}</div>
                <div style="font-size:0.55rem; font-weight:700; color:#999;">OCUPADOS</div>
              </div>
           </div>
           <div class="mini-stat-card">
              <div style="font-size:0.55rem; font-weight:800; color:#999; text-transform:uppercase;">FLUJO DEL DÍA</div>
              <div style="font-size:1.4rem; font-weight:900; color:var(--primary);">${(state.movements || []).filter(m => new Date(m.timestamp) >= new Date().setHours(0,0,0,0)).length}</div>
              <div style="font-size:0.5rem; color:#22c55e; font-weight:700;">Hoy</div>
           </div>
           <div class="mini-stat-card">
              <div style="font-size:0.55rem; font-weight:800; color:#999; text-transform:uppercase;">PERMANENCIA</div>
              <div style="font-size:1.4rem; font-weight:900; color:var(--primary);">${avgHours > 0 ? avgHours.toFixed(1) + 'h' : '0.0h'}</div>
              <div style="font-size:0.5rem; color:#bbb; font-weight:700;">Promedio</div>
           </div>
        </div>

        <!-- RESUMEN MENSUAL -->
        <div style="margin-bottom:25px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <div style="font-size:0.7rem; font-weight:900; color:var(--primary); text-transform:uppercase; letter-spacing:1px;">RESUMEN MENSUAL</div>
            <div style="font-size:0.6rem; font-weight:700; color:#bbb;">${now.toLocaleString('es-ES',{month:'long',year:'numeric'}).toUpperCase()}</div>
          </div>

          <!-- PROYECTADO + COBRADO: destacados -->
          <div style="background:#1a1a2e; border-radius:24px; padding:22px; margin-bottom:12px; display:grid; grid-template-columns:1fr 1fr; gap:0;">
            <div style="border-right:1px solid rgba(255,255,255,0.1); padding-right:20px;">
              <div style="font-size:0.5rem;font-weight:800;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">INGRESO PROYECTADO</div>
              <div style="font-size:1.8rem;font-weight:900;color:#F5C518;">$${proyectado}</div>
              <div style="font-size:0.55rem;font-weight:700;color:rgba(255,255,255,0.3);margin-top:4px;">${activos} residentes activos</div>
            </div>
            <div style="padding-left:20px;">
              <div style="font-size:0.5rem;font-weight:800;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">COBRADO ESTE MES</div>
              <div style="font-size:1.8rem;font-weight:900;color:#22c55e;">$${cobradoMes.toFixed(0)}</div>
              <div style="font-size:0.55rem;font-weight:700;color:rgba(255,255,255,0.3);margin-top:4px;">${proyectado > 0 ? Math.round((cobradoMes/proyectado)*100) : 0}% del proyectado</div>
            </div>
          </div>

          <!-- ALERTAS: grid 2x2 -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            ${statCard('PENDIENTES DE CONFIRMAR', pendientesCount, 'Pagos reportados', pendientesCount > 0 ? '#f59e0b' : '#22c55e', 'SUBS')}
            ${statCard('POR VENCER', porVencer, 'Próximos 7 días', porVencer > 0 ? '#f59e0b' : '#22c55e', 'SUBS')}
            ${statCard('MOROSOS', vencidos, 'Suscripción vencida', vencidos > 0 ? '#e63946' : '#22c55e', 'SUBS')}
            ${statCard('AL CORRIENTE', activos, 'Solventes hoy', '#22c55e', 'SUBS')}
          </div>
        </div>

        <!-- GESTIÓN RÁPIDA REMOVED POR SOLICITUD -->

           <!-- ADS CAROUSEL ALIGNED AL FINAL -->
           ${activeAds.length ? `
             <div style="margin-top: 20px;">
               <div style="font-size:0.7rem; font-weight:900; color:var(--primary); margin-bottom:15px; text-transform:uppercase;">NOTICIAS & ANUNCIOS</div>
               <div class="carousel-container glass-card" style="border-radius:24px; padding:0; height:180px;">
                 <div class="carousel-track" id="main-carousel">
                   ${activeAds.map(ad => `<div class="ad-card" style="aspect-ratio:auto; height:180px;"><img src="${ad.image_url}" style="object-fit:cover;"></div>`).join('')}
                 </div>
               </div>
             </div>
           ` : ''}

      </div>`
}
