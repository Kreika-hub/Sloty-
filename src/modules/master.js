import { getParkingState, saveParkingState, logAudit, supabase } from '../db.js'

export const initMaster = (container) => {
  let activeTab = 'BUILDINGS'
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
      
      const [ { count: slotsCount }, { count: resCount }, { data: pays }, { data: mems }, { data: bld } ] = await Promise.all([
        supabase.from('parking_slots').select('*', { count: 'exact', head: true }).eq('building_id', selectedBuilding),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('building_id', selectedBuilding),
        supabase.from('payments').select('amount').eq('building_id', selectedBuilding).eq('status', 'CONFIRMED').gte('payment_date', firstDay),
        supabase.from('sloty_memberships').select('*').eq('building_id', selectedBuilding).order('created_at', { ascending: false }).limit(5),
        supabase.from('buildings').select('*').eq('id', selectedBuilding).single()
      ]);

      const sumPays = pays ? pays.reduce((a,b) => a + (Number(b.amount) || 0), 0) : 0;
      buildingStats = { slotsCount: slotsCount || 0, resCount: resCount || 0, sumPays };
      recentMemberships = mems || [];
      selectedBuildingData = bld || {};
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
      </div>`
    }
    return `<div style="padding:20px;">
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

  const renderMemberships = (buildings = []) => `
    <div style="padding:20px;">
       <h3 style="color:white; font-weight:900; margin-bottom:15px;">CONTROL DE MEMBRESÍAS</h3>
       <div style="display:grid; gap:12px;">
         ${buildings.map(b => `
           <div style="background:rgba(255,255,255,0.06); padding:15px; border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
             <div>
                <div style="font-weight:900; color:white; font-size:0.9rem;">${b.name}</div>
                <div style="display:flex; gap:6px; margin-top:6px; align-items:center;">
                   ${getBadge(b.plan || 'TRIAL', b.membership_status || 'ACTIVE')}
                   <span style="color:#999; font-size:0.6rem; font-weight:700;">Exp: ${b.last_expiry ? new Date(b.last_expiry).toLocaleDateString() : 'N/A'}</span>
                </div>
             </div>
             <button data-action="REGISTER_PAYMENT" data-id="${b.id}" data-name="${b.name}" data-plan="${b.plan||'TRIAL'}" style="background:#1a1a2e; color:#F5C518; border:1px solid #F5C518; padding:8px 12px; border-radius:8px; font-weight:900; font-size:0.65rem; cursor:pointer;">COBRAR</button>
           </div>
         `).join('')}
       </div>
    </div>
  `

  const renderSystem = (buildings = [], memberships = []) => {
     const totalBld = buildings.length;
     const activeBld = buildings.filter(b => b.membership_status !== 'SUSPENDED').length;
     const suspendedBld = totalBld - activeBld;
     
     const now = new Date();
     const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
     const monthIncome = memberships.filter(m => m.paid_at >= firstDay).reduce((a, b) => a + (Number(b.amount) || 0), 0);

     return `
     <div style="padding:20px;">
        <h3 style="color:white; font-weight:900; margin-bottom:15px;">ESTADÍSTICAS GLOBALES</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:30px;">
           <div style="background:rgba(255,255,255,0.06); padding:20px; border-radius:16px; text-align:center;">
              <div style="font-size:2rem; font-weight:900; color:white;">${totalBld}</div>
              <div style="font-size:0.6rem; color:#999; font-weight:900;">EDIFICIOS TOTALES</div>
           </div>
           <div style="background:rgba(255,255,255,0.06); padding:20px; border-radius:16px; text-align:center;">
              <div style="font-size:2rem; font-weight:900; color:#22c55e;">${activeBld}</div>
              <div style="font-size:0.6rem; color:#999; font-weight:900;">EDIFICIOS ACTIVOS</div>
           </div>
           <div style="background:rgba(255,255,255,0.06); padding:20px; border-radius:16px; text-align:center;">
              <div style="font-size:2rem; font-weight:900; color:#e63946;">${suspendedBld}</div>
              <div style="font-size:0.6rem; color:#999; font-weight:900;">SUSPENDIDOS</div>
           </div>
           <div style="background:rgba(255,255,255,0.06); padding:20px; border-radius:16px; text-align:center;">
              <div style="font-size:2rem; font-weight:900; color:#F5C518;">$${monthIncome.toFixed(2)}</div>
              <div style="font-size:0.6rem; color:#999; font-weight:900;">INGRESOS (MES)</div>
           </div>
        </div>

        <h3 style="color:white; font-weight:900; margin-bottom:15px; color:#e63946;">ZONA DE PELIGRO</h3>
        <button data-action="RESET_FULL" style="width:100%;padding:15px;background:rgba(230,57,70,0.1);color:#e63946;border:1px solid #e63946;border-radius:12px;font-weight:900;cursor:pointer;">
           RESET FULL SYSTEM (DESARROLLO)
        </button>
     </div>
     `
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
      const { data: bld } = await supabase.from('buildings').select('*')
      const { data: mems } = await supabase.from('sloty_memberships').select('amount, paid_at')
      html = renderSystem(bld || [], mems || [])
    }
    
    elContent.innerHTML = html
  }

  render()
}
