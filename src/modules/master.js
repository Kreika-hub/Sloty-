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
    ACTIVATE_CASH: (btn) => {
      const bId = btn.dataset.id
      const bName = 'Confirmar Pago en Efectivo'
      actions.REGISTER_PAYMENT({ dataset: { id: bId, plan: 'SELECCIONADO', name: bName } })
    },
    APPROVE_PROOF: async (proof) => {
        const expiry = new Date()
        expiry.setDate(expiry.getDate() + 30)
        
        await Promise.all([
            supabase.from('building_payment_proofs').update({ status: 'CONFIRMED' }).eq('id', proof.id),
            supabase.from('buildings').update({ membership_status: 'ACTIVE', plan: proof.plan_key }).eq('id', proof.building_id),
            supabase.from('sloty_memberships').insert({
              building_id: proof.building_id, plan_key: proof.plan_key, status: 'CONFIRMED',
              amount: proof.amount, payment_reference: proof.reference,
              paid_at: new Date().toISOString(), expiry_date: expiry.toISOString()
            })
        ])
        render()
    },
    REJECT_PROOF: async (proof) => {
        await supabase.from('building_payment_proofs').update({ status: 'REJECTED' }).eq('id', proof.id)
        await supabase.from('buildings').update({ membership_status: 'SUSPENDED' }).eq('id', proof.building_id)
        render()
    },
    OPEN_DOSSIER: async (btn) => {
      const id = btn.dataset.id
      const { data: bld } = await supabase.from('buildings').select('*').eq('id', id).single()
      if (!bld) return

      const overlay = document.createElement('div')
      overlay.id = 'master-modal'
      overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);
        z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;`
      
      const badge = getBadge(bld.plan || 'TRIAL', bld.membership_status || 'ACTIVE')

      overlay.innerHTML = `
        <div style="background:#1a1a2e; border-radius:32px; width:100%; max-width:440px; border:1px solid rgba(255,255,255,0.1); overflow:hidden;">
          <div style="padding:28px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
             <div>
               <div style="font-size:0.6rem; font-weight:900; color:#F5C518; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Expediente de Edificio</div>
               <div style="font-size:1.3rem; font-weight:900; color:white;">${bld.name}</div>
             </div>
             <button id="dossier-close" style="background:rgba(255,255,255,0.05); border:none; width:40px; height:40px; border-radius:50%; color:white; font-size:1.5rem; cursor:pointer;">×</button>
          </div>
          
          <div style="padding:28px;">
             <!-- INFO GRID -->
             <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:28px;">
                <div>
                   <div style="font-size:0.55rem; color:#999; font-weight:800; text-transform:uppercase; margin-bottom:4px;">Administrador</div>
                   <div style="color:white; font-size:0.85rem; font-weight:700;">${bld.admin_email || 'No registrado'}</div>
                </div>
                <div>
                   <div style="font-size:0.55rem; color:#999; font-weight:800; text-transform:uppercase; margin-bottom:4px;">Teléfono</div>
                   <div style="color:white; font-size:0.85rem; font-weight:700;">${bld.phone || 'No registrado'}</div>
                </div>
                <div>
                   <div style="font-size:0.55rem; color:#999; font-weight:800; text-transform:uppercase; margin-bottom:4px;">Código Sloty</div>
                   <div style="color:#F5C518; font-size:0.9rem; font-weight:900;">${bld.code}</div>
                </div>
                <div>
                   <div style="font-size:0.55rem; color:#999; font-weight:800; text-transform:uppercase; margin-bottom:4px;">Ubicación</div>
                   <div style="color:white; font-size:0.85rem; font-weight:700;">${bld.city || 'No especificada'}</div>
                </div>
             </div>

             <!-- STATUS BANNER -->
             <div style="background:rgba(245,197,24,0.05); border-radius:20px; padding:18px; border:1px solid rgba(245,197,24,0.1); margin-bottom:28px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                   <div style="font-size:0.55rem; color:#999; font-weight:800; text-transform:uppercase; margin-bottom:4px;">Estatus Membresía</div>
                   <div style="display:flex; align-items:center; gap:8px;">${badge}</div>
                </div>
                <button id="btn-toggle-status" data-id="${bld.id}" data-current="${bld.membership_status}" style="background:${bld.membership_status === 'ACTIVE' ? '#e63946' : '#22c55e'}; color:white; border:none; border-radius:12px; padding:8px 14px; font-size:0.65rem; font-weight:900; cursor:pointer;">
                   ${bld.membership_status === 'ACTIVE' ? 'SUSPENDER' : 'ACTIVAR'}
                </button>
             </div>

             <!-- ACTIONS -->
             <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                <button id="btn-edit-bld" style="padding:16px; background:rgba(255,255,255,0.05); color:white; border:1px solid rgba(255,255,255,0.1); border-radius:14px; font-weight:900; cursor:pointer; font-size:0.75rem;">✏️ EDITAR DATOS</button>
                <button id="btn-delete-bld" style="padding:16px; background:rgba(230,57,70,0.1); color:#e63946; border:1px solid rgba(230,57,70,0.2); border-radius:14px; font-weight:900; cursor:pointer; font-size:0.75rem;">🗑️ ELIMINAR</button>
             </div>
             
             <button id="btn-contact-bld" style="width:100%; padding:18px; background:#25D366; color:white; border:none; border-radius:14px; font-weight:900; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:10px;">
                <span style="font-size:1.2rem;">📱</span> CONTACTAR POR WHATSAPP
             </button>
          </div>
        </div>`

      document.body.appendChild(overlay)
      document.getElementById('dossier-close').onclick = () => overlay.remove()

      document.getElementById('btn-contact-bld').onclick = () => {
         const phone = bld.phone ? bld.phone.replace(/\D/g, '') : ''
         if(!phone) return alert('Este edificio no tiene un teléfono registrado.')
         const msg = encodeURIComponent(`Hola, te contacto desde el soporte de Sloty respecto al edificio ${bld.name}.`)
         window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
      }
      
      document.getElementById('btn-toggle-status').onclick = async () => {
         const newS = bld.membership_status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
         await supabase.from('buildings').update({ membership_status: newS }).eq('id', bld.id)
         overlay.remove(); render()
      }

      document.getElementById('btn-delete-bld').onclick = async () => {
         if(!confirm('¿Estás seguro de eliminar este edificio permanentemente? Se borrarán todos sus datos.')) return
         await supabase.from('buildings').delete().eq('id', bld.id)
         overlay.remove(); render()
      }

      document.getElementById('btn-edit-bld').onclick = () => {
         overlay.remove()
         actions.EDIT_BUILDING_MASTER(bld)
      }
    },
    EXPORT_PDF: async () => {
      const { data: blds } = await supabase.from('buildings').select('*')
      const { data: mems } = await supabase.from('sloty_memberships').select('amount')
      const pendingCash = (blds||[]).filter(b => b.membership_status === 'PENDING_CASH').length
      const activeBld = (blds||[]).filter(b => b.membership_status === 'ACTIVE').length
      const totalIncome = (mems||[]).reduce((a,b)=>a+(Number(b.amount)||0), 0)
      
      const expiredList = (blds||[]).filter(b => b.membership_status === 'ACTIVE' && b.plan !== 'TRIAL')
        .map(b => `<tr><td style="padding:8px; border-bottom:1px solid #eee;">${b.name}</td><td style="padding:8px; border-bottom:1px solid #eee;">${b.phone||'N/A'}</td><td style="padding:8px; border-bottom:1px solid #eee; color:red;">Sujeto a Cobro</td></tr>`).join('')
      
      const toExport = `
      <html><head><title>Reporte de Recaudación - Sloty</title>
      <style>body{ font-family:sans-serif; padding:40px; color:#333; } table{ width:100%; border-collapse:collapse; margin-top:10px; } th,td{ text-align:left; }</style>
      </head><body>
      <h1>Reporte Mensual Sloty Master</h1>
      <p>Fecha de emisión: ${new Date().toLocaleString()}</p>
      <hr>
      <h3>Métricas Generales</h3>
      <ul>
        <li><b>Ingresos Totales (Histórico):</b> $${totalIncome.toFixed(2)}</li>
        <li><b>Edificios Activos:</b> ${activeBld}</li>
        <li><b>Total Edificios Registrados:</b> ${(blds||[]).length}</li>
      </ul>
      <h3>Pendientes por Aprobación</h3>
      <ul>
        <li>Pagos en Efectivo Pendientes: ${pendingCash}</li>
      </ul>
      <h3>Edificios Sujetos a Revisión (Morosos)</h3>
      ${expiredList ? `<table><tr><th>Edificio</th><th>Teléfono</th><th>Estado</th></tr>${expiredList}</table>` : '<p>Ninguno actualmente.</p>'}
      <br><br>
      <p style="text-align:center; font-size:0.8rem; color:#666;">Generado automáticamente por Sloty Premium</p>
      </body></html>
      `
      const w = window.open('', '_blank')
      w.document.write(toExport)
      w.document.close()
      w.focus()
      setTimeout(() => w.print(), 500)
    },
    EDIT_BUILDING_MASTER: (bld) => {
      const overlay = document.createElement('div')
      overlay.id = 'master-modal'
      overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.8);
        z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;`
      overlay.innerHTML = `
        <div style="background:#1a1a2e; border-radius:32px; width:100%; max-width:440px; border:1px solid rgba(255,255,255,0.1); padding:28px;">
          <div style="font-size:1.1rem; font-weight:900; color:white; margin-bottom:20px;">Editar Datos: ${bld.name}</div>
          
          <label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:8px;">NOMBRE EDIFICIO</label>
          <input id="edit-b-name" value="${bld.name}" style="width:100%; padding:14px; border-radius:12px; border:none; background:rgba(255,255,255,0.08); color:white; margin-bottom:16px; box-sizing:border-box;" />

          <label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:8px;">EMAIL ADMINISTRADOR</label>
          <input id="edit-b-email" value="${bld.admin_email || ''}" style="width:100%; padding:14px; border-radius:12px; border:none; background:rgba(255,255,255,0.08); color:white; margin-bottom:16px; box-sizing:border-box;" />

          <label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:8px;">TELÉFONO CONTACTO</label>
          <input id="edit-b-phone" value="${bld.phone || ''}" style="width:100%; padding:14px; border-radius:12px; border:none; background:rgba(255,255,255,0.08); color:white; margin-bottom:16px; box-sizing:border-box;" />

          <label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:8px;">CIUDAD</label>
          <input id="edit-b-city" value="${bld.city || ''}" style="width:100%; padding:14px; border-radius:12px; border:none; background:rgba(255,255,255,0.08); color:white; margin-bottom:24px; box-sizing:border-box;" />

          <div style="display:grid; grid-template-columns:1fr 2fr; gap:12px;">
             <button id="edit-b-cancel" style="padding:16px; background:rgba(255,255,255,0.05); color:white; border:none; border-radius:14px; font-weight:900; cursor:pointer;">CANCELAR</button>
             <button id="edit-b-save" style="padding:16px; background:#F5C518; color:#1a1a2e; border:none; border-radius:14px; font-weight:900; cursor:pointer;">GUARDAR CAMBIOS</button>
          </div>
        </div>`
      document.body.appendChild(overlay)
      document.getElementById('edit-b-cancel').onclick = () => overlay.remove()
      document.getElementById('edit-b-save').onclick = async () => {
         const updates = {
            name: document.getElementById('edit-b-name').value,
            admin_email: document.getElementById('edit-b-email').value,
            phone: document.getElementById('edit-b-phone').value,
            city: document.getElementById('edit-b-city').value
         }
         await supabase.from('buildings').update(updates).eq('id', bld.id)
         overlay.remove(); render()
      }
    },
    ADD_AD: async (imgData) => {
      if(!imgData) return
      const target = document.getElementById('ad-target-bld')?.value
      const bId = target === 'GLOBAL' ? null : target

      await supabase.from('ads').insert({ 
        image_url: imgData, 
        active: true,
        building_id: bId 
      })
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

    const expiredCount = buildings.filter(b => getExpiryStatus(b.last_expiry) === 'expired' && b.membership_status === 'ACTIVE').length;
    const soonCount    = buildings.filter(b => getExpiryStatus(b.last_expiry) === 'soon' && b.membership_status === 'ACTIVE').length;

    const pendingCash = buildings.filter(b => b.membership_status === 'PENDING_CASH');
    const pendingProofs = eco.proofs || [];

    const sorted = [...buildings].filter(b => b.membership_status === 'ACTIVE' || b.membership_status === 'SUSPENDED').sort((a, b) => {
      const order = { expired: 0, soon: 1, none: 2, ok: 3 };
      return order[getExpiryStatus(a.last_expiry)] - order[getExpiryStatus(b.last_expiry)];
    });

    const renderProofModal = (proof) => {
        const l = document.createElement('div')
        l.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; z-index:10000; padding:20px;'
        l.innerHTML = `
            <div style="background:#1a1a2e; border-radius:32px; width:100%; max-width:400px; overflow:hidden; border:1px solid rgba(255,255,255,0.1);">
                <div style="padding:20px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                    <div style="color:white; font-weight:900;">Comprobante de Pago</div>
                    <button class="close-p" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">×</button>
                </div>
                <div style="padding:10px; max-height:60vh; overflow-y:auto;">
                    <img src="${proof.proof_image}" style="width:100%; border-radius:12px;">
                </div>
                <div style="padding:20px; background:rgba(0,0,0,0.2); display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <button class="approve-p" style="padding:16px; background:#22c55e; color:white; border:none; border-radius:14px; font-weight:900; cursor:pointer; font-size:0.75rem;">Aprobar</button>
                    <button class="reject-p" style="padding:16px; background:#e63946; color:white; border:none; border-radius:14px; font-weight:900; cursor:pointer; font-size:0.75rem;">Rechazar</button>
                </div>
            </div>
        `
        document.body.appendChild(l)
        l.querySelector('.close-p').onclick = () => l.remove()
        l.querySelector('.approve-p').onclick = () => { actions.APPROVE_PROOF(proof); l.remove() }
        l.querySelector('.reject-p').onclick = () => { actions.REJECT_PROOF(proof); l.remove() }
    }
    
    // Inyectar helper a window temporalmente para que el HTML string pueda llamarlo
    window.viewProof = (idx) => renderProofModal(pendingProofs[idx])

    return `
      <div style="padding:20px; padding-bottom:100px;">
        <div style="font-size:0.7rem; font-weight:900; color:#999;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;">
          CONTROL DE MEMBRESÍAS
        </div>

        <!-- 💰 SECCIÓN: COMPROBANTES DE PAGO (NEW) -->
        ${pendingProofs.length > 0 ? `
        <div style="margin-bottom:24px;">
            <div style="font-size:0.6rem; font-weight:900; color:#F5C518; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">Comprobantes Pendientes (${pendingProofs.length})</div>
            <div style="display:grid; gap:10px;">
                ${pendingProofs.map((p, i) => `
                    <div style="background:rgba(34,197,94,0.05); border:1px solid rgba(34,197,94,0.2); border-radius:16px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; gap:12px; align-items:center;">
                           <div onclick="window.viewProof(${i})" style="width:45px; height:45px; border-radius:10px; background:rgba(255,255,255,0.05); cursor:pointer; overflow:hidden; border:1px solid rgba(255,255,255,0.1); flex-shrink:0;">
                               <img src="${p.proof_image}" style="width:100%; height:100%; object-fit:cover;">
                           </div>
                           <div>
                               <div style="font-size:0.85rem; font-weight:900; color:white;">${p.buildings?.name || 'Cargando...'}</div>
                               <div style="font-size:0.65rem; color:rgba(255,255,255,0.5); font-weight:700;">Ref: ${p.reference} · $${p.amount}</div>
                           </div>
                        </div>
                        <button onclick="window.viewProof(${i})" style="background:#F5C518; color:#1a1a2e; border:none; border-radius:10px; padding:8px 12px; font-size:0.65rem; font-weight:900; cursor:pointer;">REVISAR</button>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <!-- 💵 SECCIÓN: PAGOS EN EFECTIVO (NEW) -->
        ${pendingCash.length > 0 ? `
        <div style="margin-bottom:24px;">
            <div style="font-size:0.6rem; font-weight:900; color:#F5C518; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">Efectivo por Confirmar (${pendingCash.length})</div>
            <div style="display:grid; gap:10px;">
                ${pendingCash.map(b => `
                    <div style="background:rgba(255,197,24,0.05); border:1px solid rgba(255,197,24,0.2); border-radius:16px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-size:0.85rem; font-weight:900; color:white;">${b.name}</div>
                            <div style="font-size:0.65rem; color:#F5C518; font-weight:700; margin-top:2px;">ESPERANDO PAGO EN CASH</div>
                        </div>
                        <button data-action="ACTIVATE_CASH" data-id="${b.id}" style="background:#22c55e; color:white; border:none; border-radius:10px; padding:8px 12px; font-size:0.65rem; font-weight:900; cursor:pointer;">ACTIVAR</button>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

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
              <div data-action="OPEN_DOSSIER" data-id="${b.id}" style="background:rgba(255,255,255,0.06); padding:16px;
                          border-radius:14px; border:1.5px solid ${borderColor};
                          display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
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

        <button data-action="EXPORT_PDF" style="width:100%; margin-bottom: 24px; padding:16px; background:var(--primary); color:white; border:none; border-radius:14px; font-weight:900; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; justify-content:center; gap:8px;">
          📄 EXPORTAR RESUMEN MENSUAL A PDF
        </button>

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

  const renderAds = (ads = [], buildings = []) => `
    <div style="padding:20px; padding-bottom:100px;">
      <h3 style="color:white; font-weight:900; margin-bottom:8px;">GESTIÓN DE ANUNCIOS</h3>
      <p style="color:rgba(255,255,255,0.4); font-size:0.65rem; line-height:1.4; margin-bottom:20px;">
        Los anuncios se mostrarán en el carrusel principal de los usuarios según la segmentación.
      </p>

      <!-- UPLOAD AREA -->
      <div style="background:rgba(255,255,255,0.06); padding:24px; border-radius:24px; border:1px dashed rgba(255,255,255,0.2); text-align:center; margin: 0 10px 30px 10px;">
        <div style="font-size:2rem; margin-bottom:10px;">📸</div>
        <div style="color:white; font-weight:900; font-size:0.9rem; margin-bottom:12px;">Nueva Imagen Publicitaria</div>
        
        <div style="margin-bottom:15px; text-align:left;">
           <label style="color:#999;font-size:0.55rem;font-weight:900;display:block;margin-bottom:6px;text-transform:uppercase;">Segmentación (Destino)</label>
           <select id="ad-target-bld" style="width:100%; padding:12px; border-radius:10px; border:none; background:rgba(255,255,255,0.1); color:white; font-family:'Montserrat',sans-serif; font-size:0.8rem; font-weight:700;">
              <option value="GLOBAL">🌎 Global (Todos los edificios)</option>
              ${buildings.map(b => `<option value="${b.id}">🏢 ${b.name}</option>`).join('')}
           </select>
        </div>

        <input type="file" id="ad-file-input" accept="image/*" style="display:none;">
        <button onclick="document.getElementById('ad-file-input').click()" 
          style="background:#F5C518; color:#1a1a2e; border:none; padding:12px 24px; border-radius:12px; font-weight:900; font-size:0.8rem; cursor:pointer; width:100%;">
          SUBIR Y PUBLICAR
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
      const [
        { data: bld },
        { data: mems },
        { data: proofs }
      ] = await Promise.all([
        supabase.from('buildings').select('*'),
        supabase.from('sloty_memberships').select('*').order('expiry_date', { ascending: false }),
        supabase.from('building_payment_proofs').select('*, buildings(name)').eq('status', 'PENDING')
      ])

      const enrichedBld = (bld || []).map(b => {
         const bMems = (mems || []).filter(m => m.building_id === b.id && m.status === 'CONFIRMED');
         b.last_expiry = bMems.length > 0 ? bMems[0].expiry_date : null;
         return b;
      })
      html = renderMemberships(enrichedBld, { proofs: proofs || [] })
    }
    else if (activeTab === 'ADS') {
      const [ { data: ads }, { data: bld } ] = await Promise.all([
        supabase.from('ads').select('*').order('timestamp', { ascending: false }),
        supabase.from('buildings').select('id, name').order('name')
      ])
      html = renderAds(ads || [], bld || [])
      
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
