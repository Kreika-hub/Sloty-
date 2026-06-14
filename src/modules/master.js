import { getParkingState, saveParkingState, logAudit, supabase } from '../db.js'

export const initMaster = (container) => {
  let activeTab = 'SYSTEM'
  let selectedBuilding = null
  let selectedBuildingData = null
  let buildingStats = null
  let recentMemberships = []
  
  // DOM Cache
  let elContent = null
  let elShell = null

  const FEATURES = [
    { key: 'whatsapp_alerts',   label: 'Alertas WhatsApp',     icon: '📱' },
    { key: 'debt_tracking',     label: 'Control de Deudas',    icon: '💸' },
    { key: 'frequent_visitors', label: 'Visitantes Frecuentes',icon: '🔁' },
    { key: 'audit_log',         label: 'Bitácora de Auditoría',icon: '📋' },
    { key: 'finance_report',    label: 'Reporte Financiero',   icon: '📊' },
    { key: 'multi_level',       label: 'Multinivel',           icon: '🏢' },
  ]
  const PLANS = [
    { key: 'TRIAL',  label: 'Trial',  maxSlots: 10,  color: '#888' },
    { key: 'BRONCE', label: 'Bronce', maxSlots: 50,  color: '#cd7f32' },
    { key: 'PLATA',  label: 'Plata',  maxSlots: 150, color: '#aaa'    },
    { key: 'ORO',    label: 'Oro',    maxSlots: 999, color: '#F5C518' },
  ]

  const getState = () => getParkingState()

  const actions = {
    TAB: (btn) => { activeTab = btn.dataset.tab; selectedBuilding = null; render() },
    BACK: () => { selectedBuilding = null; render() },
    SELECT_BUILDING: async (btn) => { 
      selectedBuilding = btn.dataset.id;
      // Fetch stats for building
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      const [ { count: slotsCount }, { count: resCount }, { data: pays },
              { data: mems }, { data: bld }, { data: personnel }, { data: shifts } ] =
        await Promise.all([
          supabase.from('parking_slots').select('*', { count: 'exact', head: true }).eq('building_id', selectedBuilding),
          supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('building_id', selectedBuilding),
          supabase.from('payments').select('amount').eq('building_id', selectedBuilding).eq('status', 'CONFIRMED').gte('payment_date', firstDay),
          supabase.from('sloty_memberships').select('*').eq('building_id', selectedBuilding).order('created_at', { ascending: false }).limit(5),
          supabase.from('buildings').select('*').eq('id', selectedBuilding).single(),
          supabase.from('personnel').select('name, role, pin').eq('building_id', selectedBuilding),
          supabase.from('guard_shifts').select('guard_name, ended_at, total_cash, total_mobile, total_bs, entries, exits, absences').eq('building_id', selectedBuilding).order('ended_at', { ascending: false }).limit(10)
        ]);

      const sumPays = pays ? pays.reduce((a,b) => a + (Number(b.amount) || 0), 0) : 0;
      buildingStats = { slotsCount: slotsCount || 0, resCount: resCount || 0, sumPays };
      recentMemberships = mems || [];
      selectedBuildingData = bld || {};
      selectedBuildingData._personnel = personnel || [];
      selectedBuildingData._shifts = shifts || [];
      render();
    },
    SET_PLAN: async (btn) => {
      const plan = btn.dataset.plan;
      await supabase.from('buildings').update({ plan }).eq('id', selectedBuilding);
      selectedBuildingData.plan = plan;
      render();
    },
    TOGGLE_STATUS: async () => {
      const newStatus = selectedBuildingData.membership_status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await supabase.from('buildings').update({ membership_status: newStatus }).eq('id', selectedBuilding);
      selectedBuildingData.membership_status = newStatus;
      render();
    },
    REGISTER_PAYMENT: (btn) => {
      const bId = btn.dataset.id
      const plan = btn.dataset.plan
      const bName = btn.dataset.name || 'Edificio'
      
      // Mostrar modal inline en master-content-area
      const overlay = document.createElement('div')
      overlay.id = 'master-modal'
      overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);
        z-index:999;display:flex;align-items:flex-end;justify-content:center;`
      overlay.innerHTML = `
        <div style="background:#1a1a2e;border-radius:24px 24px 0 0;padding:30px;
          width:100%;max-width:500px;border:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:1rem;font-weight:900;color:white;
            margin-bottom:6px;">Registrar Pago</div>
          <div style="font-size:0.7rem;color:#999;margin-bottom:20px;">${bName} · Plan ${plan}</div>
          <input id="master-pay-amount" type="number" placeholder="Monto" min="0" step="0.01"
            style="width:100%;padding:14px;border-radius:12px;border:none;
            background:rgba(255,255,255,0.08);color:white;font-size:1rem;
            font-weight:900;margin-bottom:12px;box-sizing:border-box;">
          <input id="master-pay-ref" type="text" placeholder="Referencia (opcional)"
            style="width:100%;padding:14px;border-radius:12px;border:none;
            background:rgba(255,255,255,0.08);color:white;font-size:0.8rem;
            font-weight:700;margin-bottom:20px;box-sizing:border-box;">
          <div style="display:flex;gap:10px;">
            <button id="master-pay-cancel"
              style="flex:1;padding:14px;background:rgba(255,255,255,0.08);
              color:white;border:none;border-radius:12px;font-weight:900;cursor:pointer;">
              CANCELAR
            </button>
            <button id="master-pay-confirm"
              style="flex:2;padding:14px;background:#F5C518;color:#1a1a2e;
              border:none;border-radius:12px;font-weight:900;cursor:pointer;">
              CONFIRMAR PAGO
            </button>
          </div>
        </div>`
      document.body.appendChild(overlay)

      document.getElementById('master-pay-cancel').onclick = () => overlay.remove()
      document.getElementById('master-pay-confirm').onclick = async () => {
        const amount = parseFloat(document.getElementById('master-pay-amount').value) || 0
        const ref = document.getElementById('master-pay-ref').value || ''
        if (amount <= 0) { 
          document.getElementById('master-pay-amount').style.border = '1px solid #e63946'
          return 
        }
        overlay.remove()
        const expiry = new Date()
        expiry.setDate(expiry.getDate() + 30)
        await supabase.from('sloty_memberships').insert({
          building_id: bId, plan_key: plan, status: 'CONFIRMED',
          amount, payment_reference: ref,
          paid_at: new Date().toISOString(), expiry_date: expiry.toISOString()
        })
        await supabase.from('buildings')
          .update({ membership_status: 'ACTIVE' }).eq('id', bId)
        render()
      }
    },
    ADD_AD: async (imgData) => {
      if(!imgData) return
      await supabase.from('ads').insert({ image_url: imgData, active: true })
      render()
    },
    TOGGLE_AD: async (btn) => {
      const id = btn.dataset.id;
      const isActive = btn.dataset.active === 'true';
      await supabase.from('ads').update({ active: !isActive }).eq('id', id)
      render()
    },
    REPOST_AD: async (btn) => {
      const id = btn.dataset.id;
      await supabase.from('ads').update({ timestamp: new Date().toISOString() }).eq('id', id)
      render()
    },
    DELETE_AD: async (btn) => {
      if(!confirm('¿Borrar anuncio definitivamente?')) return; 
      const id = btn.dataset.id;
      await supabase.from('ads').delete().eq('id', id)
      render()
    },
    ADD_BUILDING: () => {
      const overlay = document.createElement('div');
      overlay.id = 'master-modal';
      overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);
        z-index:999;display:flex;align-items:flex-end;justify-content:center;`;
      overlay.innerHTML = `
        <div style="background:#1a1a2e; border-radius:24px 24px 0 0; padding:28px;
                    width:100%; max-width:500px; border:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:1rem; font-weight:900; color:white; margin-bottom:4px;">
            Nuevo Edificio
          </div>
          <div style="font-size:0.7rem; color:#999; margin-bottom:20px;">
            Se creará en Supabase con plan Trial
          </div>
          <input id="nb-name" placeholder="Nombre del edificio"
            style="width:100%; padding:14px; border-radius:12px; border:none;
                  background:rgba(255,255,255,0.08); color:white; font-size:0.85rem;
                  font-weight:700; margin-bottom:10px; box-sizing:border-box;" />
          <input id="nb-code" placeholder="Código único (ej: SLO-0042)"
            style="width:100%; padding:14px; border-radius:12px; border:none;
                  background:rgba(255,255,255,0.08); color:white; font-size:0.85rem;
                  font-weight:700; margin-bottom:10px; box-sizing:border-box;" />
          <input id="nb-city" placeholder="Ciudad"
            style="width:100%; padding:14px; border-radius:12px; border:none;
                  background:rgba(255,255,255,0.08); color:white; font-size:0.85rem;
                  font-weight:700; margin-bottom:10px; box-sizing:border-box;" />
          <input id="nb-phone" placeholder="Teléfono de contacto (opcional)"
            style="width:100%; padding:14px; border-radius:12px; border:none;
                  background:rgba(255,255,255,0.08); color:white; font-size:0.85rem;
                  font-weight:700; margin-bottom:20px; box-sizing:border-box;" />
          <div style="display:flex; gap:10px;">
            <button id="nb-cancel"
              style="flex:1; padding:14px; background:rgba(255,255,255,0.08);
                    color:white; border:none; border-radius:12px;
                    font-weight:900; cursor:pointer;">
              CANCELAR
            </button>
            <button id="nb-confirm"
              style="flex:2; padding:14px; background:#F5C518; color:#1a1a2e;
                    border:none; border-radius:12px; font-weight:900; cursor:pointer;">
              CREAR EDIFICIO
            </button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      document.getElementById('nb-cancel').onclick = () => overlay.remove();
      document.getElementById('nb-confirm').onclick = async () => {
        const name  = document.getElementById('nb-name').value.trim();
        const code  = document.getElementById('nb-code').value.trim();
        const city  = document.getElementById('nb-city').value.trim();
        const phone = document.getElementById('nb-phone').value.trim();
        if (!name || !code) {
          document.getElementById('nb-name').style.border = '1px solid #e63946';
          document.getElementById('nb-code').style.border = '1px solid #e63946';
          return;
        }
        const { error } = await supabase.from('buildings').insert({
          name, code, city, phone: phone || null,
          plan: 'TRIAL', membership_status: 'ACTIVE',
          created_at: new Date().toISOString()
        });
        if (error) { alert('Error al crear el edificio: ' + error.message); return; }
        overlay.remove(); render();
      };
    },
    RESET_FULL: () => {
       if(confirm('⚠ ¿RESET FULL SYSTEM? Esto borrará el caché local por completo.')) { 
           if(confirm('¿Estás absolutamente seguro?')) {
               localStorage.clear(); location.reload() 
           }
       }
    },
    LOGOUT: () => {
      localStorage.removeItem('sloty_session'); location.reload();
    }
  }

  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]')
    if (btn && actions[btn.dataset.action]) actions[btn.dataset.action](btn)
  })

  // --- RENDERING ---
  const getBadge = (plan, status) => {
      if (status === 'SUSPENDED') return `<span style="background:#e63946; color:white; padding:2px 6px; border-radius:6px; font-size:0.6rem; font-weight:900;">SUSPENDIDO</span>`;
      const colors = { 'TRIAL': '#888', 'BRONCE': '#cd7f32', 'PLATA': '#aaa', 'ORO': '#F5C518' };
      const bg = colors[plan] || '#888';
      const c = plan === 'ORO' ? '#1a1a2e' : 'white';
      return `<span style="background:${bg}; color:${c}; padding:2px 6px; border-radius:6px; font-size:0.6rem; font-weight:900;">${plan}</span>`;
  }

  const tabBar = () => `
    <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.1);overflow-x:auto;background:#1a1a2e;position:sticky;top:0;z-index:90;">
      ${[{k:'BUILDINGS',l:'Edificios'},{k:'MEMBERSHIPS',l:'Membresías'},{k:'ADS',l:'Anuncios'},{k:'SYSTEM',l:'Sistema'}].map(t=>`
        <div data-action="TAB" data-tab="${t.k}" style="padding:14px 20px;font-size:0.75rem;font-weight:900;cursor:pointer;white-space:nowrap;letter-spacing:1px;border-bottom:3px solid ${activeTab===t.k?'#F5C518':'transparent'};color:${activeTab===t.k?'#F5C518':'rgba(255,255,255,0.4)'};">
          ${t.l}
        </div>`).join('')}
    </div>`

  const renderBuildings = (buildings = []) => {
    if (selectedBuilding && selectedBuildingData) {
      const b = selectedBuildingData;
      return `<div style="padding:20px;">
        <button data-action="BACK" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:0.8rem;cursor:pointer;margin-bottom:15px;font-weight:900;">← VOLVER</button>
        <div style="background:rgba(255,255,255,0.06);padding:20px;border-radius:16px;margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
             <div>
               <div style="font-size:1.2rem;font-weight:900;color:white;">${b.name || 'Edificio'}</div>
               <div style="font-size:0.7rem;color:#999;margin-top:4px;">${b.code || ''}</div>
             </div>
             <div>${getBadge(b.plan || 'TRIAL', b.membership_status || 'ACTIVE')}</div>
          </div>
          
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0;">
            <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:8px;text-align:center;"><div style="color:#F5C518;font-weight:900;font-size:1.2rem;">${buildingStats?.slotsCount || 0}</div><div style="font-size:0.5rem;color:#999;">PUESTOS</div></div>
            <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:8px;text-align:center;"><div style="color:#22c55e;font-weight:900;font-size:1.2rem;">${buildingStats?.resCount || 0}</div><div style="font-size:0.5rem;color:#999;">RESIDENTES</div></div>
            <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:8px;text-align:center;"><div style="color:white;font-weight:900;font-size:1.2rem;">$${(buildingStats?.sumPays || 0).toFixed(2)}</div><div style="font-size:0.5rem;color:#999;">INGRESOS (MES)</div></div>
          </div>
          
          <h4 style="color:white;font-size:0.8rem;margin-bottom:10px;">CONTROL DE PLAN</h4>
          <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
             ${PLANS.map(p => `<button data-action="SET_PLAN" data-plan="${p.key}" style="background:${b.plan===p.key?p.color:'rgba(255,255,255,0.1)'}; color:${b.plan===p.key && p.key==='ORO'?'#1a1a2e':'white'}; border:none; padding:8px 12px; border-radius:8px; font-weight:900; font-size:0.7rem; cursor:pointer;">${p.label.toUpperCase()}</button>`).join('')}
          </div>
          
          <h4 style="color:white;font-size:0.8rem;margin-bottom:10px;">ESTADO DEL SERVICIO</h4>
          <button data-action="TOGGLE_STATUS" style="background:${b.membership_status==='ACTIVE'?'rgba(230,57,70,0.2)':'rgba(34,197,94,0.2)'}; color:${b.membership_status==='ACTIVE'?'#e63946':'#22c55e'}; border:1px solid currentColor; padding:10px 15px; border-radius:8px; font-weight:900; font-size:0.7rem; width:100%; cursor:pointer;">
             ${b.membership_status==='ACTIVE' ? 'SUSPENDER EDIFICIO' : 'ACTIVAR EDIFICIO'}
          </button>
        </div>
        
        <h3 style="color:white; font-size:0.85rem; font-weight:900; margin-bottom:10px;">ÚLTIMOS PAGOS DE MEMBRESÍA</h3>
        <div style="display:grid;gap:8px;">
           ${recentMemberships.map(m => `
             <div style="background:rgba(255,255,255,0.06); padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                   <div style="color:white;font-weight:900;font-size:0.9rem;">$${m.amount}</div>
                   <div style="color:#999;font-size:0.6rem;">${new Date(m.paid_at).toLocaleDateString()} · Expira: ${new Date(m.expiry_date).toLocaleDateString()}</div>
                </div>
                <div style="font-size:0.65rem; color:#22c55e; font-weight:900; background:rgba(34,197,94,0.1); padding:4px 8px; border-radius:6px;">${m.status}</div>
             </div>
           `).join('')}
           ${!recentMemberships.length ? '<div style="color:#666; font-size:0.7rem;">No hay registros de pago.</div>' : ''}
        </div>

        <!-- PERSONAL -->
        <div style="margin-top:20px;">
          <div style="font-size:0.7rem; font-weight:900; color:#999;
                      letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;">
            Personal Registrado
          </div>
          ${(b._personnel || []).length === 0 ? `
            <div style="color:rgba(255,255,255,0.3); font-size:0.7rem; padding:12px;">
              Sin personal registrado
            </div>` :
            (b._personnel || []).map(p => `
              <div style="background:rgba(255,255,255,0.06); padding:10px 14px;
                          border-radius:10px; margin-bottom:6px;
                          display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="color:white; font-size:0.8rem; font-weight:900;">${p.name}</div>
                  <div style="color:#999; font-size:0.6rem; font-weight:700;">${p.role || 'GUARDIA'}</div>
                </div>
                <span style="background:rgba(245,197,24,0.1); color:#F5C518;
                            font-size:0.6rem; font-weight:900; padding:3px 8px;
                            border-radius:6px;">
                  PIN: ${p.pin}
                </span>
              </div>`).join('')}
        </div>

        <!-- ÚLTIMOS TURNOS -->
        <div style="margin-top:20px; margin-bottom:30px;">
          <div style="font-size:0.7rem; font-weight:900; color:#999;
                      letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;">
            Últimos Turnos de Guardia
          </div>
          ${(b._shifts || []).length === 0 ? `
            <div style="color:rgba(255,255,255,0.3); font-size:0.7rem; padding:12px;">
              Sin turnos registrados aún
            </div>` :
            (b._shifts || []).map(s => {
              const earned = (s.total_cash||0) + (s.total_mobile||0) + (s.total_bs||0);
              const absMin = (s.absences||[]).reduce((a, ab) => a + (ab.duration_min||0), 0);
              return `
                <div style="background:rgba(255,255,255,0.06); padding:12px 14px;
                            border-radius:10px; margin-bottom:6px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <div style="color:white; font-size:0.8rem; font-weight:900;">
                      ${s.guard_name}
                    </div>
                    <div style="color:#F5C518; font-size:0.8rem; font-weight:900;">
                      $${earned.toFixed(2)}
                    </div>
                  </div>
                  <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <span style="color:#999; font-size:0.6rem; font-weight:700;">
                      ${new Date(s.ended_at).toLocaleString('es-VE', { dateStyle:'short', timeStyle:'short' })}
                    </span>
                    <span style="color:#999; font-size:0.6rem; font-weight:700;">
                      🚗 ${s.entries||0} entradas
                    </span>
                    ${absMin > 0 ? `
                      <span style="color:#e63946; font-size:0.6rem; font-weight:700;">
                        ⏸ ${absMin}min ausente
                      </span>` : ''}
                  </div>
                </div>`;
            }).join('')}
        </div>
      </div>`
    }
    return `<div style="padding:20px 20px 0;">
      <button data-action="ADD_BUILDING"
        style="width:100%; background:#F5C518; color:#1a1a2e; border:none;
               border-radius:14px; padding:14px; font-size:0.8rem;
               font-weight:900; cursor:pointer; letter-spacing:1px;
               text-transform:uppercase; margin-bottom:16px;">
        + NUEVO EDIFICIO
      </button>

      ${buildings.map(b => `
        <div data-action="SELECT_BUILDING" data-id="${b.id}" style="background:rgba(255,255,255,0.06);padding:20px;border-radius:16px;cursor:pointer;border:1px solid rgba(255,255,255,0.1);margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div><div style="font-size:1rem;font-weight:900;color:white;">${b.name}</div><div style="font-size:0.6rem;color:#999;margin-top:4px;">${b.code}</div></div>
            <div>${getBadge(b.plan || 'TRIAL', b.membership_status || 'ACTIVE')}</div>
          </div>
        </div>
      `).join('')}
      ${!buildings.length ? '<div style="color:rgba(255,255,255,0.2);text-align:center;padding:40px;">No hay edificios registrados en Supabase</div>' : ''}
    </div>`
  }

  const renderMemberships = (buildings = []) => {
    const today = new Date();
    const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const getExpiryStatus = (expiryStr) => {
      if (!expiryStr) return 'none';
      const exp = new Date(expiryStr);
      if (exp < today) return 'expired';
      if (exp <= in7days) return 'soon';
      return 'ok';
    };

    const expiredCount = buildings.filter(b => getExpiryStatus(b.last_expiry) === 'expired').length;
    const soonCount    = buildings.filter(b => getExpiryStatus(b.last_expiry) === 'soon').length;

    const sorted = [...buildings].sort((a, b) => {
      const order = { expired: 0, soon: 1, none: 2, ok: 3 };
      return order[getExpiryStatus(a.last_expiry)] - order[getExpiryStatus(b.last_expiry)];
    });

    return `
      <div style="padding:20px; padding-bottom:100px;">
        <div style="font-size:0.7rem; font-weight:900; color:#999;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;">
          CONTROL DE MEMBRESÍAS
        </div>

        ${expiredCount > 0 ? `
          <div style="background:rgba(230,57,70,0.15); border:1px solid #e63946;
                      border-radius:14px; padding:12px 16px; margin-bottom:12px;
                      display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.2rem;">🚨</span>
            <div>
              <div style="font-size:0.75rem; font-weight:900; color:#e63946;">
                ${expiredCount} membresía${expiredCount > 1 ? 's' : ''} vencida${expiredCount > 1 ? 's' : ''}
              </div>
              <div style="font-size:0.65rem; color:rgba(255,255,255,0.5);">
                Requieren cobro inmediato
              </div>
            </div>
          </div>` : ''}

        ${soonCount > 0 ? `
          <div style="background:rgba(245,197,24,0.1); border:1px solid #F5C518;
                      border-radius:14px; padding:12px 16px; margin-bottom:16px;
                      display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.2rem;">⚠️</span>
            <div>
              <div style="font-size:0.75rem; font-weight:900; color:#F5C518;">
                ${soonCount} membresía${soonCount > 1 ? 's' : ''} vence${soonCount > 1 ? 'n' : ''} en menos de 7 días
              </div>
              <div style="font-size:0.65rem; color:rgba(255,255,255,0.5);">
                Programa el cobro pronto
              </div>
            </div>
          </div>` : ''}

        <div style="display:grid; gap:10px;">
          ${sorted.map(b => {
            const status = getExpiryStatus(b.last_expiry);
            const borderColor = status === 'expired' ? '#e63946' : status === 'soon' ? '#F5C518' : 'rgba(255,255,255,0.1)';
            const expLabel = b.last_expiry
              ? `Vence: ${new Date(b.last_expiry).toLocaleDateString('es-VE')}`
              : 'Sin pago registrado';
            return `
              <div style="background:rgba(255,255,255,0.06); padding:16px;
                          border-radius:14px; border:1.5px solid ${borderColor};
                          display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-weight:900; color:white; font-size:0.9rem;">
                    ${b.name}
                  </div>
                  <div style="display:flex; gap:6px; margin-top:4px; align-items:center; flex-wrap:wrap;">
                    ${getBadge(b.plan || 'TRIAL', b.membership_status || 'ACTIVE')}
                    <span style="color:${status === 'expired' ? '#e63946' : status === 'soon' ? '#F5C518' : '#999'};
                                font-size:0.6rem; font-weight:700;">
                      ${status === 'expired' ? '🔴' : status === 'soon' ? '🟡' : '🟢'} ${expLabel}
                    </span>
                  </div>
                </div>
                <button data-action="REGISTER_PAYMENT"
                        data-id="${b.id}" data-name="${b.name}" data-plan="${b.plan||'TRIAL'}"
                        style="background:${status === 'expired' ? '#e63946' : '#1a1a2e'};
                               color:${status === 'expired' ? 'white' : '#F5C518'};
                               border:1px solid ${status === 'expired' ? '#e63946' : '#F5C518'};
                               padding:8px 12px; border-radius:8px;
                               font-weight:900; font-size:0.65rem; cursor:pointer;
                               white-space:nowrap;">
                  COBRAR
                </button>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }
  // ─── SVG Area Chart Helper ─────────────────────────────────
  const makeAreaChart = (byMonth, months) => {
    if (!months || months.length === 0) {
      return '<div style="color:rgba(255,255,255,0.3);font-size:0.75rem;text-align:center;padding:20px;">Sin registros de pago aún</div>';
    }
    const chron = [...months].reverse();
    const values = chron.map(m => byMonth[m] || 0);
    const maxVal = Math.max(...values) || 1;
    const W = 300, H = 100;
    let pts = '', dots = '', labels = '';

    chron.forEach((m, idx) => {
      const val = values[idx];
      const x = chron.length === 1 ? W / 2 : (idx / (chron.length - 1)) * W;
      const y = H - ((val / maxVal) * (H - 20));
      pts += x + ',' + y + ' ';
      dots += '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#1a1a2e" stroke="#F5C518" stroke-width="2"/>';
      dots += '<text x="' + x + '" y="' + (y - 10) + '" fill="white" font-size="8" font-weight="900" font-family="Montserrat" text-anchor="middle">$' + val + '</text>';
      const parts = m.split('-');
      const lbl = new Date(parts[0], parts[1] - 1).toLocaleString('es-VE', { month: 'short' }).toUpperCase();
      labels += '<text x="' + x + '" y="' + (H + 16) + '" fill="rgba(255,255,255,0.5)" font-size="8" font-weight="700" font-family="Montserrat" text-anchor="middle">' + lbl + '</text>';
    });

    const areaPolygon = chron.length > 1
      ? '<polygon points="0,' + H + ' ' + pts + W + ',' + H + '" fill="url(#areaGrad)"/>'
      : '';

    return '<svg viewBox="0 -15 ' + W + ' ' + (H + 35) + '" style="width:100%;height:auto;display:block;overflow:visible;">'
      + '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="rgba(245,197,24,0.4)"/>'
      + '<stop offset="100%" stop-color="rgba(245,197,24,0)"/>'
      + '</linearGradient></defs>'
      + '<line x1="0" y1="' + H + '" x2="' + W + '" y2="' + H + '" stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="4"/>'
      + areaPolygon
      + '<polyline points="' + pts + '" fill="none" stroke="#F5C518" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + dots + labels
      + '</svg>';
  }

  const renderSystem = (buildings = [], memberships = [], eco = {}) => {
    const totalBld     = buildings.length;
    const activeBld    = buildings.filter(b => b.membership_status !== 'SUSPENDED').length;
    const suspendedBld = totalBld - activeBld;

    // Agrupar ingresos por mes
    const byMonth = {};
    memberships.forEach(m => {
      if (!m.paid_at) return;
      const key = m.paid_at.slice(0, 7); // YYYY-MM
      byMonth[key] = (byMonth[key] || 0) + (Number(m.amount) || 0);
    });
    const months = Object.keys(byMonth).sort().reverse().slice(0, 12);

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const thisMonthIncome = byMonth[thisMonth] || 0;
    const totalIncome = Object.values(byMonth).reduce((a, b) => a + b, 0);

    return `
      <div style="padding:20px; padding-bottom:100px;">
      
        <div style="font-size:0.7rem; font-weight:900; color:#F5C518;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;">
          Tracción de la Plataforma
        </div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:24px;">
          <div style="background:rgba(245,197,24,0.1); padding:16px; border:1px solid #F5C518; border-radius:14px; text-align:center;">
            <div style="font-size:1.4rem; font-weight:900; color:#F5C518;">${eco.residents || 0}</div>
            <div style="font-size:0.55rem; color:#F5C518; font-weight:900; margin-top:2px; text-transform:uppercase;">Usuarios Activos</div>
          </div>
          <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:14px; text-align:center;">
            <div style="font-size:1.4rem; font-weight:900; color:white;">${eco.movements || 0}</div>
            <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px; text-transform:uppercase;">Movimientos Rec.</div>
          </div>
          <div style="background:rgba(34,197,94,0.1); padding:16px; border:1px solid #22c55e; border-radius:14px; text-align:center;">
            <div style="font-size:1.4rem; font-weight:900; color:#22c55e;">${eco.personnel || 0}</div>
            <div style="font-size:0.55rem; color:#22c55e; font-weight:900; margin-top:2px; text-transform:uppercase;">Guardias Ops.</div>
          </div>
        </div>

        <div style="font-size:0.7rem; font-weight:900; color:#999;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;">
          Estadísticas Globales
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
          <div style="background:rgba(255,255,255,0.06); padding:16px;
                      border-radius:14px; text-align:center;">
            <div style="font-size:1.8rem; font-weight:900; color:white;">${totalBld}</div>
            <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">EDIFICIOS TOTALES</div>
          </div>
          <div style="background:rgba(255,255,255,0.06); padding:16px;
                      border-radius:14px; text-align:center;">
            <div style="font-size:1.8rem; font-weight:900; color:#22c55e;">${activeBld}</div>
            <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">ACTIVOS</div>
          </div>
          <div style="background:rgba(255,255,255,0.06); padding:16px;
                      border-radius:14px; text-align:center;">
            <div style="font-size:1.8rem; font-weight:900; color:#F5C518;">$${thisMonthIncome.toFixed(2)}</div>
            <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">INGRESOS ESTE MES</div>
          </div>
          <div style="background:rgba(255,255,255,0.06); padding:16px;
                      border-radius:14px; text-align:center;">
            <div style="font-size:1.8rem; font-weight:900; color:white;">$${totalIncome.toFixed(2)}</div>
            <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">INGRESOS TOTALES</div>
          </div>
        </div>

        <div style="font-size:0.7rem; font-weight:900; color:#999;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;">
          Evolución de Ingresos
        </div>
        
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:16px; padding:20px; margin-bottom:24px;">
          ${makeAreaChart(byMonth, months)}
        </div>

        <div style="font-size:0.7rem; font-weight:900; color:#e63946;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;">
          Zona de Peligro
        </div>
        <button data-action="RESET_FULL"
          style="width:100%; padding:14px; background:rgba(230,57,70,0.1);
                 color:#e63946; border:1px solid #e63946; border-radius:12px;
               font-weight:900; cursor:pointer; font-size:0.8rem;">
          RESET FULL SYSTEM (DESARROLLO)
        </button>
      </div>`;
  }

  const renderAds = (ads = []) => `
    <div style="padding:20px; padding-bottom:100px;">
      <h3 style="color:white; font-weight:900; margin-bottom:8px;">GESTIÓN DE ANUNCIOS</h3>
      <p style="color:rgba(255,255,255,0.4); font-size:0.65rem; line-height:1.4; margin-bottom:20px;">
        Los anuncios se mostrarán en el carrusel principal de todos los usuarios.
      </p>

      <!-- UPLOAD AREA -->
      <div style="background:rgba(255,255,255,0.06); padding:24px; border-radius:24px; border:1px dashed rgba(255,255,255,0.2); text-align:center; margin: 0 10px 30px 10px;">
        <div style="font-size:2rem; margin-bottom:10px;">📸</div>
        <div style="color:white; font-weight:900; font-size:0.9rem; margin-bottom:4px;">Subir Nueva Imagen</div>
        <div style="color:#F5C518; font-weight:700; font-size:0.6rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">Tamaño ideal: 800x350 px</div>
        
        <input type="file" id="ad-file-input" accept="image/*" style="display:none;">
        <button onclick="document.getElementById('ad-file-input').click()" 
          style="background:#F5C518; color:#1a1a2e; border:none; padding:12px 24px; border-radius:12px; font-weight:900; font-size:0.8rem; cursor:pointer; width:100%;">
          SELECCIONAR DESDE TELÉFONO
        </button>
      </div>

      <div style="margin: 0 10px;">
        <div style="font-size:0.7rem; font-weight:900; color:#F5C518; margin-bottom:15px; text-transform:uppercase; letter-spacing:1px;">HISTORIAL DE ANUNCIOS</div>
        
        <div class="ads-history-grid">
          ${ads.map(a => `
            <div class="ad-history-item">
              <img src="${a.image_url}">
              <div class="ad-history-actions">
                 <button data-action="REPOST_AD" data-id="${a.id}" style="background:white; border:none; width:30px; height:30px; border-radius:50%; font-size:0.8rem;" title="Repost">🔁</button>
                 <button data-action="TOGGLE_AD" data-id="${a.id}" data-active="${a.active}" style="background:white; border:none; width:30px; height:30px; border-radius:50%; font-size:0.8rem;" title="Toggle">${a.active ? '👁️' : '🚫'}</button>
                 <button data-action="DELETE_AD" data-id="${a.id}" style="background:#e63946; color:white; border:none; width:30px; height:30px; border-radius:50%; font-size:0.8rem;" title="Delete">🗑️</button>
              </div>
              ${!a.active ? `<div style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:white; font-size:0.5rem; padding:2px 4px; border-radius:4px;">OCULTO</div>` : ''}
            </div>
          `).join('')}
          ${!ads.length ? '<div style="grid-column:span 3; text-align:center; padding:40px; color:rgba(255,255,255,0.2); font-size:0.8rem;">No hay anuncios subidos</div>' : ''}
        </div>
      </div>
    </div>`

  const renderShell = () => {
    container.innerHTML = `<div id="master-shell" style="background:#1a1a2e;min-height:100vh;font-family:'Montserrat',sans-serif;">
      <div style="background:#F5C518;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;"><div style="font-size:1.1rem;font-weight:900;letter-spacing:-1px;color:#1a1a2e;">SLOTY MASTER</div><button data-action="LOGOUT" style="background:#1a1a2e;color:#F5C518;border:none;padding:5px 12px;border-radius:6px;font-size:0.7rem;font-weight:900;cursor:pointer;">SALIR</button></div>
      <div id="master-tabs-area"></div><div id="master-content-area"></div>
    </div>`
    elShell = container.querySelector('#master-tabs-area')
    elContent = container.querySelector('#master-content-area')
  }

  const render = async () => {
    if (!elShell) renderShell()
    elShell.innerHTML = tabBar()
    
    let html = ''
    if (activeTab === 'BUILDINGS') {
      const { data: bld } = await supabase.from('buildings').select('*').order('created_at', { ascending: false })
      html = renderBuildings(bld || [])
    }
    else if (activeTab === 'MEMBERSHIPS') {
      const { data: bld } = await supabase.from('buildings').select('*')
      const { data: mems } = await supabase.from('sloty_memberships').select('*').order('expiry_date', { ascending: false })
      const enrichedBld = (bld || []).map(b => {
         const bMems = (mems || []).filter(m => m.building_id === b.id && m.status === 'CONFIRMED');
         b.last_expiry = bMems.length > 0 ? bMems[0].expiry_date : null;
         return b;
      })
      html = renderMemberships(enrichedBld)
    }
    else if (activeTab === 'ADS') {
      const { data: ads } = await supabase.from('ads').select('*').order('timestamp', { ascending: false })
      html = renderAds(ads || [])
      
      // Attach file input listener
      setTimeout(() => {
        const input = document.getElementById('ad-file-input')
        if(input) {
          input.onchange = (e) => {
            const file = e.target.files[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = (ev) => actions.ADD_AD(ev.target.result)
            reader.readAsDataURL(file)
          }
        }
      }, 100);
    }
    else if (activeTab === 'SYSTEM') {
      const [
        { data: bld }, 
        { data: mems },
        { count: resCount },
        { count: persCount },
        { count: movCount }
      ] = await Promise.all([
        supabase.from('buildings').select('*'),
        supabase.from('sloty_memberships').select('amount, paid_at'),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
        supabase.from('personnel').select('*', { count: 'exact', head: true }),
        supabase.from('access_logs').select('*', { count: 'exact', head: true })
      ])
      
      html = renderSystem(bld || [], mems || [], {
          residents: resCount || 0,
          personnel: persCount || 0,
          movements: movCount || 0
      })
    }
    
    elContent.innerHTML = html
  }

  render()
}
