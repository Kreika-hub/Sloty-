import { getParkingState, saveParkingState, logAudit, supabase } from '../db.js'

export const initMaster = (container) => {
  let activeTab = 'SYSTEM'
  let selectedBuilding = null
  let selectedBuildingData = null
  let buildingStats = null
  let recentMemberships = []
  let masterChannel = null
  let pendingProofsCount = 0
  let notifCount = 0
  
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
      const id = btn.dataset.id;
      actions.OPEN_DOSSIER(id);
    },
    SET_PLAN: async (btn) => {
      const plan = btn.dataset.plan;
      await supabase.from('buildings').update({ plan }).eq('id', selectedBuilding);
      selectedBuildingData.plan = plan;
      render();
    },
    TOGGLE_STATUS: async (btnOrId) => {
      const id = typeof btnOrId === 'string' ? btnOrId : selectedBuilding;
      if (!id) return;
      const { data: bld } = await supabase.from('buildings').select('membership_status').eq('id', id).single();
      if (!bld) return;
      
      const newStatus = bld.membership_status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await supabase.from('buildings').update({ membership_status: newStatus }).eq('id', id);
      
      if (id === selectedBuilding && selectedBuildingData) {
        selectedBuildingData.membership_status = newStatus;
      }
      
      if (document.getElementById('dossier-overlay')) {
          document.getElementById('dossier-overlay').remove();
          actions.OPEN_DOSSIER(id);
      }
      render();
    },
    CHANGE_PLAN: async (id) => {
      if (!id) return;
      const { data: bld } = await supabase.from('buildings')
        .select('name, plan').eq('id', id).single();
      if (!bld) return;

      const PLAN_OPTIONS = [
        { key: 'TRIAL',  label: 'Trial',  price: 'Gratis',   slots: '10 puestos',  color: '#888' },
        { key: 'BRONCE', label: 'Bronce', price: '$29/mes',  slots: '50 puestos',  color: '#cd7f32' },
        { key: 'PLATA',  label: 'Plata',  price: '$59/mes',  slots: '150 puestos', color: '#aaa' },
        { key: 'ORO',    label: 'Oro',    price: '$99/mes',  slots: 'Ilimitado',   color: '#F5C518' },
      ];

      const overlay = document.createElement('div');
      overlay.id = 'change-plan-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:flex-end;justify-content:center;';
      overlay.innerHTML =
        '<div style="background:#1a1a2e; border-radius:24px 24px 0 0; padding:24px;'
        + ' width:100%; max-width:500px; border:1px solid rgba(255,255,255,0.1);'
        + ' font-family:\'Montserrat\',sans-serif;">'
        + '<div style="font-size:0.65rem; font-weight:900; color:#999; text-transform:uppercase; letter-spacing:2px; margin-bottom:4px;">Cambiar Plan</div>'
        + '<div style="font-size:1rem; font-weight:900; color:white; margin-bottom:20px;">' + bld.name + '</div>'
        + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">'
        + PLAN_OPTIONS.map(p =>
            '<button onclick="window._selectMasterPlan(\'' + p.key + '\')"'
            + ' id="plan-btn-' + p.key + '"'
            + ' style="background:' + (bld.plan === p.key ? p.color : 'rgba(255,255,255,0.06)') + ';'
            + 'color:' + (bld.plan === p.key ? (p.key === 'ORO' ? '#1a1a2e' : 'white') : 'rgba(255,255,255,0.7)') + ';'
            + 'border:2px solid ' + (bld.plan === p.key ? p.color : 'rgba(255,255,255,0.1)') + ';'
            + 'border-radius:14px; padding:14px 12px; cursor:pointer; text-align:left; transition:all 0.15s;">'
            + '<div style="font-size:0.85rem; font-weight:900;">' + p.label + '</div>'
            + '<div style="font-size:0.7rem; opacity:0.8; margin-top:2px;">' + p.price + '</div>'
            + '<div style="font-size:0.6rem; opacity:0.6; margin-top:1px;">' + p.slots + '</div>'
            + (bld.plan === p.key ? '<div style="font-size:0.6rem; font-weight:900; margin-top:4px; opacity:0.8;">\u2713 Plan actual</div>' : '')
            + '</button>'
          ).join('')
        + '</div>'
        + '<div style="display:flex; gap:10px;">'
        + '<button onclick="document.getElementById(\'change-plan-overlay\').remove(); delete window._selectMasterPlan; delete window._currentPlanId;"'
        + ' style="flex:1; padding:14px; background:rgba(255,255,255,0.06); color:white; border:none; border-radius:12px; font-weight:900; cursor:pointer; font-family:\'Montserrat\',sans-serif;">CANCELAR</button>'
        + '<button id="btn-confirm-plan" style="flex:2; padding:14px; background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.4); border:none; border-radius:12px; font-weight:900; cursor:pointer; font-family:\'Montserrat\',sans-serif;" disabled>SELECCIONA UN PLAN</button>'
        + '</div>'
        + '</div>';

      document.body.appendChild(overlay);

      let selectedPlan = bld.plan;
      window._currentPlanId = id;

      window._selectMasterPlan = (planKey) => {
        selectedPlan = planKey;
        PLAN_OPTIONS.forEach(p => {
          const btn = document.getElementById('plan-btn-' + p.key);
          if (!btn) return;
          const isSelected = p.key === planKey;
          btn.style.background = isSelected ? p.color : 'rgba(255,255,255,0.06)';
          btn.style.color = isSelected ? (p.key === 'ORO' ? '#1a1a2e' : 'white') : 'rgba(255,255,255,0.7)';
          btn.style.border = '2px solid ' + (isSelected ? p.color : 'rgba(255,255,255,0.1)');
        });
        const confirmBtn = document.getElementById('btn-confirm-plan');
        const plan = PLAN_OPTIONS.find(p => p.key === planKey);
        confirmBtn.disabled = false;
        confirmBtn.style.background = '#F5C518';
        confirmBtn.style.color = '#1a1a2e';
        confirmBtn.textContent = 'CAMBIAR A ' + (plan?.label?.toUpperCase() || '');
      };

      document.getElementById('btn-confirm-plan').onclick = async () => {
        if (!selectedPlan || selectedPlan === bld.plan) { overlay.remove(); return; }

        // Confirmación de pago nativa
        const paid = selectedPlan === 'TRIAL' ? false : confirm('\u00bfYa recibiste el pago de este cliente?');
        let amount = 0;
        let method = 'EFECTIVO';
        if (paid) {
          const rawAmount = prompt('\u00bfCu\u00e1nto pagaron? (en d\u00f3lares)');
          amount = parseFloat(rawAmount) || 0;
          const rawMethod = prompt('M\u00e9todo de pago:\n1 = Efectivo\n2 = Pago M\u00f3vil\n3 = Transferencia\n4 = Zelle\n\nEscribe el n\u00famero:');
          const methodMap = { '1':'EFECTIVO', '2':'PAGO_MOVIL', '3':'TRANSFERENCIA', '4':'ZELLE' };
          method = methodMap[rawMethod] || 'EFECTIVO';
        }

        if (!confirm('\u00bfConfirmar upgrade a plan ' + selectedPlan + ' para ' + bld.name + '?')) return;

        const durations = { TRIAL: 15, BRONCE: 30, PLATA: 30, ORO: 30 };
        const days = durations[selectedPlan] || 30;
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + days);

        const updates = [supabase.from('buildings').update({
          plan: selectedPlan,
          membership_status: 'ACTIVE',
          membership_expiry: expiry.toISOString()
        }).eq('id', id)];

        if (paid && amount > 0) {
          updates.push(supabase.from('sloty_memberships').insert({
            building_id: id, plan_key: selectedPlan, status: 'CONFIRMED',
            amount, payment_method: method,
            paid_at: new Date().toISOString(), expiry_date: expiry.toISOString()
          }));
        }

        await Promise.all(updates);
        overlay.remove();
        delete window._selectMasterPlan;
        delete window._currentPlanId;
        if (document.getElementById('dossier-overlay')) {
          document.getElementById('dossier-overlay').remove();
          actions.OPEN_DOSSIER(id);
        }
        render();
      };
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
    CONTACT_COLLECTION: async (id) => {
        const { data: bld } = await supabase.from('buildings').select('name, phone, plan').eq('id', id).single();
        if (!bld || !bld.phone) return alert('No hay teléfono registrado para este edificio.');
        const phone = bld.phone.replace(/\D/g, '');
        const msg = encodeURIComponent(`Hola admin de ${bld.name}, te contactamos de Sloty. Tienes una deuda pendiente por tu plan ${bld.plan}. Por favor, realiza el pago a la brevedad para reactivar tu servicio.`);
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    },
    ACTIVATE_CASH: (btn) => {
      const bId = btn.dataset.id
      const bName = 'Confirmar Pago en Efectivo'
      actions.REGISTER_PAYMENT({ dataset: { id: bId, plan: 'SELECCIONADO', name: bName } })
    },
    APPROVE_PROOF: async (raw) => {
      // Support both old object call and new pipe-string call from dossier
      const isRaw = typeof raw === 'string'
      const proofId    = isRaw ? raw.split('|')[0] : raw?.id
      const buildingId = isRaw ? raw.split('|')[1] : raw?.building_id
      const planKey    = isRaw ? raw.split('|')[2] : raw?.plan_key
      if (!proofId || !buildingId) return

      const durations = { TRIAL: 15, BRONCE: 30, PLATA: 30, ORO: 30 }
      const days = durations[planKey] || 30
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + days)

      await Promise.all([
        supabase.from('building_payment_proofs').update({
          status: 'CONFIRMED',
          reviewed_at: new Date().toISOString()
        }).eq('id', proofId),
        supabase.from('buildings').update({
          membership_status: 'ACTIVE',
          plan: planKey || 'BRONCE',
          membership_expiry: expiry.toISOString()
        }).eq('id', buildingId),
        supabase.from('sloty_memberships').insert({
          building_id: buildingId, plan_key: planKey, status: 'CONFIRMED',
          paid_at: new Date().toISOString(), expiry_date: expiry.toISOString()
        })
      ])

      document.getElementById('dossier-overlay')?.remove()
      render()
    },
    REJECT_PROOF: async (raw) => {
      const isRaw = typeof raw === 'string'
      const proofId    = isRaw ? raw.split('|')[0] : raw?.id
      const buildingId = isRaw ? raw.split('|')[1] : raw?.building_id
      if (!proofId || !buildingId) return

      const reason = prompt('Motivo del rechazo (opcional):') || ''

      await Promise.all([
        supabase.from('building_payment_proofs').update({
          status: 'REJECTED',
          reviewed_at: new Date().toISOString(),
          reference: reason ? `RECHAZADO: ${reason}` : 'RECHAZADO'
        }).eq('id', proofId),
        supabase.from('buildings').update({
          membership_status: 'SUSPENDED'
        }).eq('id', buildingId)
      ])

      document.getElementById('dossier-overlay')?.remove()
      render()
    },
    OPEN_DOSSIER: async (btn) => {
      const buildingId = typeof btn === 'string' ? btn : btn.dataset.id
      const today    = new Date()
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

      const [
        { data: bld },
        { data: subs },
        { data: pays },
        { data: personnel },
        { data: shifts },
        { data: proofs },
        { data: incidents },
        { count: slotsCount }
      ] = await Promise.all([
        supabase.from('buildings').select('*').eq('id', buildingId).single(),
        supabase.from('subscriptions').select('id,resident_name,plate,expiry_date,status').eq('building_id', buildingId),
        supabase.from('payments').select('amount,status,payment_date,method').eq('building_id', buildingId).gte('payment_date', firstDay),
        supabase.from('personnel').select('name,role,pin').eq('building_id', buildingId),
        supabase.from('guard_shifts').select('guard_name,ended_at,total_cash,total_mobile,total_bs,entries,exits,absences').eq('building_id', buildingId).order('ended_at', { ascending: false }).limit(5),
        supabase.from('building_payment_proofs').select('*, buildings(name, phone, admin_email, city, code)').eq('building_id', buildingId).order('created_at', { ascending: false }).limit(10),
        supabase.from('incidents').select('id,type,description,guard_name,created_at,resolved').eq('building_id', buildingId).eq('resolved', false).limit(10),
        supabase.from('parking_slots').select('*', { count: 'exact', head: true }).eq('building_id', buildingId)
      ])

      const confirmedPays   = (pays || []).filter(p => p.status === 'CONFIRMED')
      const pendingPays     = (pays || []).filter(p => p.status === 'PENDING')
      const totalIncome     = confirmedPays.reduce((a, p) => a + (Number(p.amount) || 0), 0)
      const activeResidents = (subs || []).filter(s => new Date(s.expiry_date) > today).length
      const expiredResidents = (subs || []).length - activeResidents
      const pendingProofs   = (proofs || []).filter(p => p.status === 'PENDING')

      const expiryDate  = bld?.membership_expiry ? new Date(bld.membership_expiry) : null
      const daysLeft    = expiryDate ? Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)) : null
      const expiryColor = !daysLeft ? '#999' : daysLeft < 0 ? '#e63946' : daysLeft <= 7 ? '#F5C518' : '#22c55e'

      document.getElementById('dossier-overlay')?.remove()
      const overlay = document.createElement('div')
      overlay.id = 'dossier-overlay'
      overlay.style.cssText = `position:fixed;inset:0;background:#0f0f1a;z-index:9999;overflow-y:auto;font-family:'Montserrat',sans-serif;`
      overlay.innerHTML = `
        <div style="max-width:600px; margin:0 auto; padding:20px; padding-bottom:80px;">

          <!-- HEADER -->
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px; padding-top:10px;">
            <button onclick="document.getElementById('dossier-overlay').remove()"
              style="background:rgba(255,255,255,0.08); color:white; border:none;
                     border-radius:50px; padding:8px 16px; font-size:0.7rem;
                     font-weight:900; cursor:pointer;">&#8592; VOLVER</button>
            <div>
              <div style="font-size:1.1rem; font-weight:900; color:white;">${bld?.name || 'Edificio'}</div>
              <div style="font-size:0.65rem; color:#999; font-weight:700;">${bld?.code || ''} &middot; ${bld?.city || ''}</div>
            </div>
          </div>

          <!-- ALERTA COMPROBANTES PENDIENTES -->
          ${pendingProofs.length > 0 ? `
            <div style="background:rgba(245,197,24,0.12); border:1.5px solid #F5C518;
                        border-radius:16px; padding:14px 16px; margin-bottom:16px;
                        display:flex; align-items:center; gap:10px;">
              <span style="font-size:1.4rem;">&#128206;</span>
              <div style="flex:1;">
                <div style="font-size:0.8rem; font-weight:900; color:#F5C518;">
                  ${pendingProofs.length} comprobante${pendingProofs.length > 1 ? 's' : ''} pendiente${pendingProofs.length > 1 ? 's' : ''} de revisi&oacute;n
                </div>
                <div style="font-size:0.65rem; color:rgba(255,255,255,0.4); margin-top:2px;">
                  Desliza abajo para revisar y aprobar
                </div>
              </div>
            </div>` : ''}

          <!-- M&Eacute;TRICAS PRINCIPALES -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
            <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:16px; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900; color:#F5C518;">$${totalIncome.toFixed(2)}</div>
              <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">INGRESOS ESTE MES</div>
            </div>
            <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:16px; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900; color:white;">${slotsCount || 0}</div>
              <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">PUESTOS TOTALES</div>
            </div>
            <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:16px; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900; color:#22c55e;">${activeResidents}</div>
              <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">RESIDENTES AL D&Iacute;A</div>
            </div>
            <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:16px; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900; color:#e63946;">${expiredResidents}</div>
              <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">VENCIDOS</div>
            </div>
          </div>

          <!-- MEMBRES&Iacute;A SLOTY -->
          <div style="background:rgba(255,255,255,0.06); border-radius:16px; padding:16px; margin-bottom:16px;">
            <div style="font-size:0.65rem; font-weight:900; color:#999;
                        text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Membres&iacute;a Sloty</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:0.9rem; font-weight:900; color:white;">Plan ${bld?.plan || 'TRIAL'}</div>
                <div style="font-size:0.65rem; color:${expiryColor}; font-weight:700; margin-top:2px;">
                  ${daysLeft === null ? 'Sin fecha de vencimiento' :
                    daysLeft < 0 ? `Vencido hace ${Math.abs(daysLeft)} d&iacute;as` :
                    daysLeft === 0 ? 'Vence hoy' : `Vence en ${daysLeft} d&iacute;as`}
                </div>
              </div>
          <div style="display:flex; gap:8px;">
            ${(bld?.membership_status === 'SUSPENDED' || bld?.membership_status === 'PENDING_CASH') ? `
              <button onclick="window.handleMasterAction('CONTACT_COLLECTION','${buildingId}')"
                style="background:rgba(230,57,70,0.1); color:#e63946; border:1px solid #e63946;
                       border-radius:8px; padding:8px 12px; font-size:0.65rem;
                       font-weight:900; cursor:pointer; display:flex; align-items:center; gap:6px;">
                💬 COBRAR DEUDA
              </button>
            ` : ''}
            <button onclick="window.handleMasterAction('CHANGE_PLAN','${buildingId}')"
              style="background:rgba(245,197,24,0.1); color:#F5C518; border:1px solid #F5C518;
                     border-radius:8px; padding:8px 12px; font-size:0.65rem;
                     font-weight:900; cursor:pointer;">
              CAMBIAR PLAN
            </button>
            <button onclick="window.handleMasterAction('TOGGLE_STATUS','${buildingId}')"
              style="background:${bld?.membership_status === 'SUSPENDED' ? 'rgba(34,197,94,0.1)' : 'rgba(230,57,70,0.1)'};
                     color:${bld?.membership_status === 'SUSPENDED' ? '#22c55e' : '#e63946'};
                     border:1px solid ${bld?.membership_status === 'SUSPENDED' ? '#22c55e' : '#e63946'};
                     border-radius:8px; padding:8px 12px; font-size:0.65rem;
                     font-weight:900; cursor:pointer;">
              ${bld?.membership_status === 'SUSPENDED' ? 'ACTIVAR' : 'SUSPENDER'}
            </button>
          </div>
        </div>
      </div>

      <!-- COMPROBANTES PENDIENTES -->
      ${pendingProofs.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:0.65rem; font-weight:900; color:#F5C518;
                      text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">
            Comprobantes Pendientes
          </div>
          ${pendingProofs.map(p => `
            <div style="background:rgba(245,197,24,0.06); border:1px solid rgba(245,197,24,0.2);
                        border-radius:14px; padding:14px; margin-bottom:10px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <div>
                  <div style="font-size:0.8rem; font-weight:900; color:white;">
                    Plan ${p.plan_key || '—'} · $${Number(p.amount || 0).toFixed(2)}
                  </div>
                  <div style="font-size:0.65rem; color:#999; margin-top:2px;">
                    ${p.reference || 'Sin referencia'} ·
                    ${new Date(p.created_at || p.submitted_at).toLocaleString('es-VE', { dateStyle:'short', timeStyle:'short' })}
                  </div>
                </div>
              </div>
              ${p.proof_image ? `
                <img src="${p.proof_image}" alt="Comprobante"
                     style="width:100%; border-radius:10px; margin-bottom:10px;
                            max-height:200px; object-fit:cover; cursor:pointer;"
                     onclick="window.open('${p.proof_image}','_blank')" />` : ''}
              <div style="display:flex; gap:8px;">
                <button onclick="window.handleMasterAction('APPROVE_PROOF','${p.id}|${buildingId}|${p.plan_key}')"
                  style="flex:1; background:#22c55e; color:white; border:none;
                         border-radius:10px; padding:10px; font-size:0.7rem;
                         font-weight:900; cursor:pointer;">
                  ✓ APROBAR
                </button>
                <button onclick="window.handleMasterAction('REJECT_PROOF','${p.id}|${buildingId}')"
                  style="flex:1; background:#e63946; color:white; border:none;
                         border-radius:10px; padding:10px; font-size:0.7rem;
                         font-weight:900; cursor:pointer;">
                  ✗ RECHAZAR
                </button>
                ${bld?.phone ? `
                  <a href="https://wa.me/${bld.phone.replace(/\D/g,'')}?text=Hola, revisamos tu comprobante de pago para el plan ${p.plan_key}."
                     target="_blank"
                     style="background:rgba(255,255,255,0.08); color:white; border:none;
                            border-radius:10px; padding:10px 12px; font-size:0.75rem;
                            font-weight:900; cursor:pointer; text-decoration:none;
                            display:flex; align-items:center;">
                    💬
                  </a>` : ''}
              </div>
            </div>`).join('')}
        </div>` : ''}

      <!-- PAGOS PENDIENTES DEL MES -->
      ${pendingPays.length > 0 ? `
        <div style="background:rgba(230,57,70,0.06); border:1px solid rgba(230,57,70,0.2);
                    border-radius:14px; padding:14px; margin-bottom:16px;">
          <div style="font-size:0.65rem; font-weight:900; color:#e63946;
                      text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
            ${pendingPays.length} Pago${pendingPays.length > 1 ? 's' : ''} de Residente Pendiente${pendingPays.length > 1 ? 's' : ''}
          </div>
          <div style="font-size:0.75rem; color:rgba(255,255,255,0.5);">
            El admin del edificio tiene pagos de residentes sin aprobar este mes.
          </div>
        </div>` : ''}

      <!-- INCIDENTES SIN RESOLVER -->
      ${(incidents || []).length > 0 ? `
        <div style="background:rgba(230,57,70,0.06); border:1px solid rgba(230,57,70,0.2);
                    border-radius:14px; padding:14px; margin-bottom:16px;">
          <div style="font-size:0.65rem; font-weight:900; color:#e63946;
                      text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
            ${incidents.length} Incidente${incidents.length > 1 ? 's' : ''} Sin Resolver
          </div>
          ${incidents.map(i => `
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.6); margin-bottom:4px;">
              ⚠️ ${i.type} — ${i.description?.slice(0,60)}${i.description?.length > 60 ? '...' : ''}
            </div>`).join('')}
        </div>` : ''}

      <!-- PERSONAL -->
      <div style="background:rgba(255,255,255,0.06); border-radius:14px;
                  padding:14px; margin-bottom:16px;">
        <div style="font-size:0.65rem; font-weight:900; color:#999;
                    text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">
          Personal (${(personnel || []).length})
        </div>
        ${(personnel || []).length === 0 ?
          `<div style="color:rgba(255,255,255,0.3); font-size:0.75rem;">Sin personal registrado</div>` :
          (personnel || []).map(p => `
            <div style="display:flex; justify-content:space-between; align-items:center;
                        padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
              <div style="color:white; font-size:0.8rem; font-weight:700;">${p.name}</div>
              <span style="background:rgba(245,197,24,0.1); color:#F5C518; font-size:0.6rem;
                           font-weight:900; padding:2px 8px; border-radius:6px;">
                ${p.role || 'GUARDIA'}
              </span>
            </div>`).join('')}
      </div>

      <!-- ÚLTIMOS TURNOS -->
      <div style="background:rgba(255,255,255,0.06); border-radius:14px;
                  padding:14px; margin-bottom:16px;">
        <div style="font-size:0.65rem; font-weight:900; color:#999;
                    text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">
          Últimos Turnos de Guardia
        </div>
        ${(shifts || []).length === 0 ?
          `<div style="color:rgba(255,255,255,0.3); font-size:0.75rem;">Sin turnos registrados</div>` :
          (shifts || []).map(s => {
            const earned = (s.total_cash||0) + (s.total_mobile||0) + (s.total_bs||0);
            const absMin = (s.absences||[]).reduce((a, ab) => a + (ab.duration_min||0), 0);
            return `
              <div style="display:flex; justify-content:space-between; align-items:center;
                          padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <div>
                  <div style="color:white; font-size:0.8rem; font-weight:700;">${s.guard_name}</div>
                  <div style="color:#999; font-size:0.6rem; font-weight:700; margin-top:2px;">
                    ${new Date(s.ended_at).toLocaleString('es-VE',{dateStyle:'short',timeStyle:'short'})}
                    · ${s.entries||0} entradas
                    ${absMin > 0 ? `· <span style="color:#e63946;">⏸${absMin}min</span>` : ''}
                  </div>
                </div>
                <div style="color:#F5C518; font-size:0.85rem; font-weight:900;">
                  $${earned.toFixed(2)}
                </div>
              </div>`;
          }).join('')}
      </div>

      <!-- CONTACTO -->
      ${bld?.phone || bld?.admin_email ? `
        <div style="background:rgba(255,255,255,0.06); border-radius:14px;
                    padding:14px; margin-bottom:16px;">
          <div style="font-size:0.65rem; font-weight:900; color:#999;
                      text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">
            Contacto
          </div>
          ${bld.phone ? `
            <a href="https://wa.me/${bld.phone.replace(/\D/g,'')}"
               target="_blank"
               style="display:flex; align-items:center; gap:10px; color:white;
                      text-decoration:none; padding:8px 0;">
              <span style="font-size:1.2rem;">💬</span>
              <span style="font-size:0.8rem; font-weight:700;">${bld.phone}</span>
            </a>` : ''}
          ${bld.admin_email ? `
            <a href="mailto:${bld.admin_email}"
               style="display:flex; align-items:center; gap:10px; color:white;
                      text-decoration:none; padding:8px 0;">
              <span style="font-size:1.2rem;">✉️</span>
              <span style="font-size:0.8rem; font-weight:700;">${bld.admin_email}</span>
            </a>` : ''}
        </div>` : ''}

    </div>`;

  document.body.appendChild(overlay);
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
    ADD_AD: async (file) => {
      if (!file) return
      try {
        const ext      = file.name.split('.').pop()
        const filePath = `ads/${Date.now()}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('ads')
          .upload(filePath, file, { upsert: true })

        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage
          .from('ads')
          .getPublicUrl(filePath)

        const target = document.getElementById('ad-target-bld')?.value
        const bId = target === 'GLOBAL' ? null : target

        await supabase.from('ads').insert({
          image_url: urlData.publicUrl,
          active: true,
          building_id: bId,
          timestamp: new Date().toISOString()
        })
        render()
      } catch(e) {
        console.error('Error subiendo anuncio:', e)
        alert('Error al subir el anuncio. Intenta de nuevo.')
      }
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
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:999;display:flex;align-items:flex-end;justify-content:center;overflow-y:auto;';
      overlay.innerHTML =
        '<div id="nb-sheet" style="background:#1a1a2e; border-radius:24px 24px 0 0; padding:28px;'
        + ' width:100%; max-width:500px; border:1px solid rgba(255,255,255,0.1); padding-bottom:40px;">'
        + '<div style="font-size:1rem; font-weight:900; color:white; margin-bottom:4px;">Nuevo Edificio</div>'
        + '<div style="font-size:0.7rem; color:#999; margin-bottom:20px;">Registro manual desde Master Panel</div>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">NOMBRE *</label>'
        + '<input id="nb-name" placeholder="Ej. Residencial El Prado" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;"/>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">CÓDIGO ÚNICO *</label>'
        + '<input id="nb-code" placeholder="Ej: SLO-0042" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;"/>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">EMAIL ADMINISTRADOR</label>'
        + '<input id="nb-email" type="email" placeholder="admin@edificio.com" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;"/>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">TELÉFONO CONTACTO</label>'
        + '<input id="nb-phone" placeholder="+584129135799" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;"/>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">CIUDAD</label>'
        + '<input id="nb-city" placeholder="Caracas" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;"/>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">PLAN</label>'
        + '<select id="nb-plan" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;appearance:none;">'
        + '<option value="TRIAL">Trial (Gratis · 15 días)</option>'
        + '<option value="BRONCE">Bronce ($29/mes)</option>'
        + '<option value="PLATA">Plata ($59/mes)</option>'
        + '<option value="ORO">Oro ($99/mes)</option>'
        + '</select>'
        + '<div id="nb-payment-section" style="display:none;">'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">MONTO PAGADO ($)</label>'
        + '<input id="nb-amount" type="number" placeholder="0.00" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;"/>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">MÉTODO DE PAGO</label>'
        + '<select id="nb-method" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:20px;box-sizing:border-box;appearance:none;">'
        + '<option value="EFECTIVO">Efectivo</option>'
        + '<option value="PAGO_MOVIL">Pago Móvil</option>'
        + '<option value="TRANSFERENCIA">Transferencia</option>'
        + '<option value="ZELLE">Zelle</option>'
        + '</select>'
        + '</div>'
        + '<div style="display:flex; gap:10px;">'
        + '<button id="nb-cancel" style="flex:1;padding:14px;background:rgba(255,255,255,0.08);color:white;border:none;border-radius:12px;font-weight:900;cursor:pointer;">CANCELAR</button>'
        + '<button id="nb-confirm" style="flex:2;padding:14px;background:#F5C518;color:#1a1a2e;border:none;border-radius:12px;font-weight:900;cursor:pointer;">CREAR EDIFICIO</button>'
        + '</div>'
        + '</div>';
      document.body.appendChild(overlay);

      const planSel = document.getElementById('nb-plan');
      const paySection = document.getElementById('nb-payment-section');
      planSel.onchange = () => {
        paySection.style.display = planSel.value === 'TRIAL' ? 'none' : 'block';
      };

      document.getElementById('nb-cancel').onclick = () => overlay.remove();
      document.getElementById('nb-confirm').onclick = async () => {
        const name   = document.getElementById('nb-name').value.trim();
        const code   = document.getElementById('nb-code').value.trim();
        const city   = document.getElementById('nb-city').value.trim();
        const phone  = document.getElementById('nb-phone').value.trim();
        const email  = document.getElementById('nb-email').value.trim();
        const plan   = document.getElementById('nb-plan').value;
        const amount = parseFloat(document.getElementById('nb-amount')?.value) || 0;
        const method = document.getElementById('nb-method')?.value || 'EFECTIVO';
        if (!name || !code) {
          document.getElementById('nb-name').style.border = '1px solid #e63946';
          document.getElementById('nb-code').style.border = '1px solid #e63946';
          return;
        }
        const durations = { TRIAL: 15, BRONCE: 30, PLATA: 30, ORO: 30 };
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + (durations[plan] || 30));
        const { data: newBld, error } = await supabase.from('buildings').insert({
          name, code, city, phone: phone || null,
          admin_email: email || null,
          plan, membership_status: 'ACTIVE',
          membership_expiry: expiry.toISOString(),
          created_at: new Date().toISOString()
        }).select().single();
        if (error) { alert('Error al crear el edificio: ' + error.message); return; }
        if (plan !== 'TRIAL' && amount > 0 && newBld) {
          await supabase.from('sloty_memberships').insert({
            building_id: newBld.id, plan_key: plan, status: 'CONFIRMED',
            amount, payment_method: method,
            paid_at: new Date().toISOString(), expiry_date: expiry.toISOString()
          });
        }
        overlay.remove();
        render();
        // Ofrecer envío de enlace si hay teléfono
        if (phone && newBld) {
          if (confirm('¿Enviar enlace de acceso al admin por WhatsApp?')) {
            const loginUrl = window.location.origin + window.location.pathname;
            const msg = encodeURIComponent(
              'Hola! Bienvenido a Sloty \u{1F680}\n\nTu edificio *' + name + '* ya est\u00e1 activo.\n\n'
              + '\u{1F449} Accede aqu\u00ed: ' + loginUrl + '\n'
              + '\u{1F511} C\u00f3digo de edificio: *' + code + '*\n'
              + (email ? '\u{1F4E7} Email admin: *' + email + '*\n' : '')
              + '\n\u00a1\u00c9xito con tu gesti\u00f3n! \u{1F680}'
            );
            window.open('https://wa.me/' + phone.replace(/\D/g,'') + '?text=' + msg, '_blank');
          }
        }
      };
    },
    DELETE_BUILDING: async (btn) => {
      const id   = btn.dataset.id;
      const name = btn.dataset.name || 'este edificio';
      if (!confirm('\u26a0\ufe0f \u00bfEliminar ' + name + '?\n\nEsta acci\u00f3n es IRREVERSIBLE y borrar\u00e1 todos los datos asociados.')) return;
      const { error } = await supabase.from('buildings').delete().eq('id', id);
      if (error) { alert('Error al eliminar: ' + error.message); return; }
      render();
    },
    SEND_ACCESS_LINK: async (id) => {
      if (!id) return
      const { data: bld } = await supabase.from('buildings').select('name, phone, code, admin_email').eq('id', id).single()
      if (!bld) return alert('No se encontró el edificio.')
      if (!bld.phone) return alert('El edificio no tiene teléfono registrado.')
      const phone = bld.phone.replace(/\D/g, '')
      const loginUrl = `${window.location.origin}${window.location.pathname}`
      const msg = encodeURIComponent(
        `Hola! Bienvenido a Sloty 🚀\n\nTu edificio *${bld.name}* ya está activo.\n\n` +
        `👉 Accede aquí: ${loginUrl}\n` +
        `🔑 Código de edificio: *${bld.code}*\n\n` +
        `Inicia sesión con tu email *${bld.admin_email || '(el que registraste)'}* y configura tu panel.`
      )
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
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
      ${[
        { k:'NOTIFICATIONS', l:'🔔 Actividad' },
        { k:'BUILDINGS',     l:'Edificios'    },
        { k:'MEMBERSHIPS',   l:'Membresías'   },
        { k:'ADS',           l:'Anuncios'     },
        { k:'SYSTEM',        l:'Sistema'      }
      ].map(t => `
        <div data-action="TAB" data-tab="${t.k}"
             style="padding:14px 16px; font-size:0.72rem; font-weight:900;
                    cursor:pointer; white-space:nowrap; letter-spacing:0.5px;
                    border-bottom:3px solid ${activeTab === t.k ? '#F5C518' : 'transparent'};
                    color:${activeTab === t.k ? '#F5C518' : 'rgba(255,255,255,0.4)'};
                    position:relative;">
          ${t.l}
          ${t.k === 'NOTIFICATIONS' && notifCount > 0 ? `
            <span id="master-notif-badge"
                  style="position:absolute; top:8px; right:2px;
                         background:#e63946; color:white; font-size:9px;
                         font-weight:900; width:16px; height:16px;
                         border-radius:50%; display:inline-flex;
                         align-items:center; justify-content:center;">
              ${notifCount}
            </span>` : ''}
          ${t.k === 'MEMBERSHIPS' && pendingProofsCount > 0 ? `
            <span id="master-pending-badge"
                  style="position:absolute; top:8px; right:4px;
                         background:#e63946; color:white; font-size:9px;
                         font-weight:900; width:16px; height:16px;
                         border-radius:50%; display:inline-flex;
                         align-items:center; justify-content:center;">
              ${pendingProofsCount}
            </span>` : ''}
        </div>`).join('')}
    </div>`

  const renderNotifications = (proofs = [], newBuildings = []) => {
    const planColors = { TRIAL:'#888', BRONCE:'#cd7f32', PLATA:'#aaa', ORO:'#F5C518' }
    const planPrices = { TRIAL:'Gratis', BRONCE:'$29/mes', PLATA:'$59/mes', ORO:'$99/mes' }

    const pendingProofs = proofs.filter(p => !p.status || p.status === 'PENDING')
    const historyProofs = proofs.filter(p => p.status && p.status !== 'PENDING')

    if (proofs.length === 0) return `
      <div style="padding:40px 20px; text-align:center;">
        <div style="font-size:3rem; margin-bottom:12px;">📭</div>
        <div style="font-size:0.8rem; font-weight:900; color:rgba(255,255,255,0.4);
                    text-transform:uppercase; letter-spacing:2px;">
          Sin solicitudes recientes
        </div>
      </div>`;

    const renderProofCard = (p, isPending) => {
          const bld = p.buildings || {}
          const submitted = p.created_at
            ? new Date(p.created_at).toLocaleString('es-VE', { dateStyle:'medium', timeStyle:'short' })
            : 'Fecha desconocida'
          const planColor = planColors[p.plan_key] || '#888'
          const planPrice = planPrices[p.plan_key] || ''
          const raw = `${p.id}|${p.building_id}|${p.plan_key}`
          const phone = (bld.phone || '').replace(/\D/g, '')
          const loginUrl = window.location.origin + window.location.pathname
          const welcomeMsg = encodeURIComponent(
            '\u2705 *\u00a1Bienvenido a Sloty!*\n\n' +
            'Hola, tu comprobante fue aprobado y tu edificio *' + (bld.name || 'tu edificio') + '* ya est\u00e1 activo en la plataforma.\n\n' +
            '\ud83d\udcf1 *Accede aqu\u00ed:* ' + loginUrl + '\n' +
            '\ud83d\udd11 *C\u00f3digo de edificio:* ' + (bld.code || '\u2014') + '\n' +
            '\ud83d\udce6 *Plan activado:* ' + (p.plan_key || '') + ' (' + planPrice + ')\n\n' +
            'Si tienes alguna duda estamos aqu\u00ed para ayudarte. \u00a1\u00c9xito con tu gesti\u00f3n! \ud83d\ude80'
          )
          const rejectMsg = encodeURIComponent(
            '\u274c *Comprobante Rechazado \u2014 Sloty*\n\n' +
            'Hola, revisamos tu comprobante de pago para el plan *' + (p.plan_key || '') + '* y no pudimos aprobarlo.\n\n' +
            'Por favor verifica los datos y vuelve a intentarlo. Si crees que es un error, escr\u00edbenos aqu\u00ed mismo.'
          )

          let actionsHtml = '';
          if (isPending) {
             actionsHtml = `
              <!-- ACCIONES -->
              <div style="padding:14px 18px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                  <button onclick="window.handleMasterAction('APPROVE_PROOF','${raw}')"
                    style="background:#22c55e; color:white; border:none; border-radius:12px;
                           padding:12px; font-size:0.75rem; font-weight:900; cursor:pointer;">
                    \u2713 APROBAR
                  </button>
                  <button onclick="window.handleMasterAction('REJECT_PROOF','${p.id}|${p.building_id}')"
                    style="background:#e63946; color:white; border:none; border-radius:12px;
                           padding:12px; font-size:0.75rem; font-weight:900; cursor:pointer;">
                    \u2717 RECHAZAR
                  </button>
                </div>
                ${phone ? `
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                    <a href="https://wa.me/${phone}?text=${welcomeMsg}" target="_blank"
                       style="background:#25D366; color:white; border-radius:12px; padding:10px;
                              font-size:0.65rem; font-weight:900; text-decoration:none; text-align:center; display:block;">
                      \ud83d\udcac WS Bienvenida
                    </a>
                    <a href="https://wa.me/${phone}?text=${rejectMsg}" target="_blank"
                       style="background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.6);
                              border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:10px;
                              font-size:0.65rem; font-weight:900; text-decoration:none; text-align:center; display:block;">
                      \ud83d\udcac WS Rechazo
                    </a>
                  </div>
                  <a href="https://wa.me/${phone}" target="_blank"
                     style="display:block; background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.4);
                            border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px;
                            font-size:0.65rem; font-weight:900; text-decoration:none; text-align:center;">
                    \ud83d\udcac Abrir chat directo con el admin
                  </a>` : `
                  <div style="background:rgba(255,255,255,0.04); border-radius:12px; padding:10px; text-align:center;">
                    <div style="font-size:0.65rem; color:rgba(255,255,255,0.3); font-weight:700;">
                      Sin tel\u00e9fono registrado \u2014 edita el edificio para agregar contacto
                    </div>
                  </div>`}
              </div>
             `;
          } else {
             // Historial actions
             const sColor = p.status === 'CONFIRMED' ? '#22c55e' : '#e63946';
             const sLabel = p.status === 'CONFIRMED' ? 'APROBADO' : 'RECHAZADO';
             actionsHtml = `
              <div style="padding:14px 18px; text-align:center;">
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                   <span style="font-size:0.65rem; color:#999; font-weight:800; text-transform:uppercase;">Estado Final:</span><br>
                   <span style="font-size:0.9rem; font-weight:900; color:${sColor};">${sLabel}</span>
                </div>
              </div>
             `;
          }

          return `
            <div style="background:#0f1127; border:1px solid ${isPending ? 'rgba(245,197,24,0.2)' : 'rgba(255,255,255,0.1)'};
                        border-radius:20px; overflow:hidden; margin-bottom:20px; opacity:${isPending ? '1' : '0.8'};">

              <!-- HEADER EDIFICIO -->
              <div style="padding:16px 18px 12px; background:${isPending ? 'rgba(245,197,24,0.05)' : 'rgba(255,255,255,0.02)'};
                          border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div>
                    <div style="font-size:1rem; font-weight:900; color:white; margin-bottom:2px;">
                      ${bld.name || 'Edificio sin nombre'}
                    </div>
                    <div style="font-size:0.65rem; color:#999; font-weight:700;">
                      ${bld.code || '\u2014'} \u00b7 ${bld.city || 'Ciudad no registrada'}
                    </div>
                  </div>
                  <span style="background:${planColor}; color:${p.plan_key === 'ORO' ? '#1a1a2e' : 'white'};
                               padding:4px 10px; border-radius:8px; font-size:0.65rem; font-weight:900;">
                    ${p.plan_key || 'TRIAL'}
                  </span>
                </div>
              </div>

              <!-- DATOS DE CONTACTO -->
              <div style="padding:12px 18px; border-bottom:1px solid rgba(255,255,255,0.06);
                          display:flex; gap:16px; flex-wrap:wrap;">
                ${bld.admin_email ? `
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span>\u2709\ufe0f</span>
                    <span style="font-size:0.7rem; color:rgba(255,255,255,0.6); font-weight:700;">${bld.admin_email}</span>
                  </div>` : ''}
                ${bld.phone ? `
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span>\ud83d\udcf1</span>
                    <span style="font-size:0.7rem; color:rgba(255,255,255,0.6); font-weight:700;">${bld.phone}</span>
                  </div>` : ''}
              </div>

              <!-- DATOS DEL PAGO -->
              <div style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="font-size:0.6rem; font-weight:900; color:#999;
                            text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">
                  Detalles del Pago
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                  <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:10px;">
                    <div style="font-size:1.1rem; font-weight:900; color:#F5C518;">
                      $${Number(p.amount || 0).toFixed(2)}
                    </div>
                    <div style="font-size:0.6rem; color:#999; font-weight:700; margin-top:2px;">MONTO</div>
                  </div>
                  <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:10px;">
                    <div style="font-size:0.75rem; font-weight:900; color:white; word-break:break-all;">
                      ${p.reference || 'Sin referencia'}
                    </div>
                    <div style="font-size:0.6rem; color:#999; font-weight:700; margin-top:2px;">REFERENCIA</div>
                  </div>
                </div>
                <div style="font-size:0.65rem; color:rgba(255,255,255,0.3); font-weight:700; margin-top:8px;">
                  \ud83d\udcc5 Enviado: ${submitted}
                </div>
              </div>

              <!-- COMPROBANTE -->
              ${p.proof_image ? `
                <div style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06);">
                  <div style="font-size:0.6rem; font-weight:900; color:#999;
                              text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
                    Comprobante
                  </div>
                  <img src="${p.proof_image}" alt="Comprobante de pago"
                       style="width:100%; border-radius:12px; max-height:280px;
                              object-fit:contain; background:rgba(255,255,255,0.03); cursor:pointer;"
                       onclick="window.open('${p.proof_image}','_blank')" />
                  <div style="font-size:0.6rem; color:rgba(255,255,255,0.3); font-weight:700;
                              margin-top:6px; text-align:center;">
                    Toca la imagen para verla completa
                  </div>
                </div>` : `
                <div style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06);">
                  <div style="background:rgba(230,57,70,0.08); border:1px dashed rgba(230,57,70,0.3);
                              border-radius:10px; padding:12px; text-align:center;">
                    <div style="font-size:0.7rem; color:#e63946; font-weight:700;">
                      \u26a0\ufe0f Sin comprobante adjunto
                    </div>
                  </div>
                </div>`}

              ${actionsHtml}
            </div>`
    };

    return `
      <div style="padding:16px; padding-bottom:100px;">
        ${pendingProofs.length > 0 ? `
        <div style="font-size:0.65rem; font-weight:900; color:#F5C518;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:14px;">
          ${pendingProofs.length} solicitud${pendingProofs.length > 1 ? 'es' : ''} pendiente${pendingProofs.length > 1 ? 's' : ''}
        </div>
        ${pendingProofs.map(p => renderProofCard(p, true)).join('')}
        ` : `
        <div style="padding:40px 20px; text-align:center; background:rgba(255,255,255,0.02); border-radius:20px; margin-bottom:20px;">
          <div style="font-size:3rem; margin-bottom:12px;">✅</div>
          <div style="font-size:0.8rem; font-weight:900; color:rgba(255,255,255,0.4);
                      text-transform:uppercase; letter-spacing:2px;">
            Al día
          </div>
          <div style="font-size:0.7rem; color:rgba(255,255,255,0.25); margin-top:8px;">
            No hay solicitudes pendientes por revisar.
          </div>
        </div>
        `}

        ${historyProofs.length > 0 ? `
        <div style="font-size:0.65rem; font-weight:900; color:#999;
                    letter-spacing:2px; text-transform:uppercase; margin-top:30px; margin-bottom:14px; border-top:1px solid rgba(255,255,255,0.1); padding-top:20px;">
          Historial (${historyProofs.length}) <span style="font-size:0.55rem; font-weight:600; color:rgba(255,255,255,0.3);">— toca para expandir</span>
        </div>
        ${historyProofs.map((p, idx) => {
          const bld = p.buildings || {};
          const sColor = p.status === 'CONFIRMED' ? '#22c55e' : '#e63946';
          const sLabel = p.status === 'CONFIRMED' ? 'APROBADO' : 'RECHAZADO';
          const sEmoji = p.status === 'CONFIRMED' ? '\u2705' : '\u274c';
          const planColor = { TRIAL:'#888', BRONCE:'#cd7f32', PLATA:'#aaa', ORO:'#F5C518' }[p.plan_key] || '#888';
          const submitted = p.created_at
            ? new Date(p.created_at).toLocaleString('es-VE', { dateStyle:'short', timeStyle:'short' })
            : '---';
          const hId = 'hist-card-' + idx;
          return `
          <div style="background:#0f1127; border:1px solid rgba(255,255,255,0.08); border-radius:16px; overflow:hidden; margin-bottom:10px; opacity:0.85;">
            <div onclick="(function(){var b=document.getElementById('${hId}');b.style.display=b.style.display==='none'?'block':'none';})();"
                 style="padding:14px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
              <div style="flex:1;">
                <div style="font-size:0.85rem; font-weight:900; color:white;">${bld.name || 'Edificio'}</div>
                <div style="font-size:0.6rem; color:#999; margin-top:2px;">${submitted} &nbsp;&middot;&nbsp; $${Number(p.amount||0).toFixed(2)}</div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="background:${planColor}; color:${p.plan_key==='ORO'?'#1a1a2e':'white'}; padding:2px 8px; border-radius:6px; font-size:0.6rem; font-weight:900;">${p.plan_key||'?'}</span>
                <span style="font-size:0.75rem; font-weight:900; color:${sColor};">${sEmoji} ${sLabel}</span>
                <span style="color:rgba(255,255,255,0.3); font-size:0.8rem;">&#8250;</span>
              </div>
            </div>
            <div id="${hId}" style="display:none;">
              ${renderProofCard(p, false)}
            </div>
          </div>`;
        }).join('')}
        ` : ''}
      </div>`;
  }


  const renderBuildings = (buildings = []) => {
    return `<div style="padding:20px 20px 0;">
      <button data-action="ADD_BUILDING"
        style="width:100%; background:#F5C518; color:#1a1a2e; border:none;
               border-radius:14px; padding:14px; font-size:0.8rem;
               font-weight:900; cursor:pointer; letter-spacing:1px;
               text-transform:uppercase; margin-bottom:16px;">
        + NUEVO EDIFICIO
      </button>

      ${buildings.map(b => `
        <div style="background:rgba(255,255,255,0.06);padding:20px;border-radius:16px;border:1px solid rgba(255,255,255,0.1);margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <div data-action="SELECT_BUILDING" data-id="${b.id}" style="flex:1; cursor:pointer;">
            <div style="font-size:1rem;font-weight:900;color:white;">${b.name}</div>
            <div style="font-size:0.6rem;color:#999;margin-top:4px;">${b.code}</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span>${getBadge(b.plan || 'TRIAL', b.membership_status || 'ACTIVE')}</span>
            <button data-action="DELETE_BUILDING" data-id="${b.id}" data-name="${b.name}"
              style="background:rgba(230,57,70,0.1); border:1px solid rgba(230,57,70,0.3); color:#e63946;
                     width:34px; height:34px; border-radius:10px; cursor:pointer; font-size:0.9rem;
                     display:flex; align-items:center; justify-content:center;">
              🗑️
            </button>
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
           ${renderChart(Object.values(byMonth).reverse().slice(0, 6))}
        </div>

        <div style="font-size:0.7rem; font-weight:900; color:#999;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;">
          Matriz de Beneficios por Plan
        </div>

        <div style="display:grid; gap:10px; margin-bottom:24px;">
          <div style="background:rgba(255,255,255,0.06); border-radius:14px; padding:16px; display:flex; align-items:center; gap:15px;">
            <div style="background:#888; color:white; font-size:0.6rem; font-weight:900; padding:6px 12px; border-radius:8px; min-width:60px; text-align:center;">TRIAL</div>
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.7); line-height:1.4;">Gestión Básica • Hasta 10 puestos • Menú Guardia Simple</div>
          </div>
          <div style="background:rgba(255,255,255,0.06); border-radius:14px; padding:16px; display:flex; align-items:center; gap:15px;">
            <div style="background:#cd7f32; color:white; font-size:0.6rem; font-weight:900; padding:6px 12px; border-radius:8px; min-width:60px; text-align:center;">BRONCE</div>
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.7); line-height:1.4;">Hasta 50 puestos • Control Caja Chica • Registro Ilimitado</div>
          </div>
          <div style="background:rgba(255,255,255,0.06); border-radius:14px; padding:16px; display:flex; align-items:center; gap:15px;">
            <div style="background:#aaa; color:white; font-size:0.6rem; font-weight:900; padding:6px 12px; border-radius:8px; min-width:60px; text-align:center;">PLATA</div>
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.7); line-height:1.4;">Hasta 150 puestos • Control de Deudores • Multi-Turno</div>
          </div>
          <div style="background:rgba(245,197,24,0.1); border:1px solid #F5C518; border-radius:14px; padding:16px; display:flex; align-items:center; gap:15px;">
            <div style="background:#F5C518; color:#1a1a2e; font-size:0.6rem; font-weight:900; padding:6px 12px; border-radius:8px; min-width:60px; text-align:center;">ORO</div>
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.9); line-height:1.4;">Puestos Ilimitados • Absolutamente todos los módulos financieros • Soporte Técnico VIP</div>
          </div>
        </div>

      </div>

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
    // Exponer la función actions() globalmente para los onclick inline del dosier
    window.handleMasterAction = (action, payload) => {
      if (actions[action]) actions[action](payload)
    }

    if (!elShell) renderShell()
    elShell.innerHTML = tabBar()

    // Suscribir Realtime si no está activo
    if (!masterChannel) {
      masterChannel = supabase
        .channel('master-proofs')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'building_payment_proofs'
        }, () => {
          pendingProofsCount++
          notifCount++
          const badge = document.getElementById('master-pending-badge')
          if (badge) { badge.textContent = pendingProofsCount; badge.style.display = 'inline-flex' }
          const nBadge = document.getElementById('master-notif-badge')
          if (nBadge) { nBadge.textContent = notifCount; nBadge.style.display = 'inline-flex' }
          else { const ta = document.getElementById('master-tabs-area'); if (ta) ta.innerHTML = tabBar() }
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'buildings'
        }, () => {
          notifCount++
          const nBadge = document.getElementById('master-notif-badge')
          if (nBadge) { nBadge.textContent = notifCount; nBadge.style.display = 'inline-flex' }
          else { const ta = document.getElementById('master-tabs-area'); if (ta) ta.innerHTML = tabBar() }
        })
        .subscribe()
    }
    
    let html = ''
    if (activeTab === 'NOTIFICATIONS') {
      notifCount = 0  // reset badge
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const [
        { data: proofs },
        { data: newBlds }
      ] = await Promise.all([
        supabase.from('building_payment_proofs')
          .select('*, buildings(name, phone, admin_email, city, code)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('buildings')
          .select('*')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
      ])
      html = renderNotifications(proofs || [], newBlds || [])
    }
    else if (activeTab === 'BUILDINGS') {
      const { data: bld } = await supabase.from('buildings').select('*').order('created_at', { ascending: false })
      html = renderBuildings(bld || [])
    }
    else if (activeTab === 'MEMBERSHIPS') {
      pendingProofsCount = 0  // reset badge al abrir la pestaña
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
            actions.ADD_AD(file)
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
