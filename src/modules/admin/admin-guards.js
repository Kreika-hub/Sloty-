/**
 * Admin Guards — Operators, shifts, onboarding and credentials (PERSONAL tab)
 * Extracted from admin.js (Phase C Lot 3 refactor)
 */
import { getParkingState, saveParkingState, logAudit, showToast } from '../../db.js'
import { escapeHTML } from '../../utils/sanitize.js'
import { ICONS } from './admin-ui-components.js'
import { store } from './admin-store.js'

// ─── PERSONAL TAB RENDERER (PERSONAL) ────────────────────────
export const renderPersonnel = (state) => {
  const editingGuard = store.editingGuard;
  const editG = editingGuard ? state.personnel.find(p => p.id === editingGuard) : null;
  const now = new Date();
  const todayStart = new Date().setHours(0,0,0,0);

  return `
    <div style="padding:20px;padding-bottom:120px; background:#f8f9fa;">
      <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">GESTIÓN DE PERSONAL</h2>
      
      <div style="background:white; padding:30px; border-radius:32px; margin-bottom:35px; box-shadow:0 15px 40px rgba(0,0,0,0.04); border:1.5px solid #f0f0f0;">
        <div style="font-size:0.7rem; font-weight:800; color:#999; text-align:center; margin-bottom:20px; text-transform:uppercase; letter-spacing:1px;">
           ${editingGuard ? 'EDITAR PERFIL' : 'REGISTRAR NUEVO GUARDIA'}
        </div>
        
        <div style="display:flex; justify-content:center; margin-bottom:30px;">
          <div id="photo-dropzone" style="width:120px; height:120px; flex-shrink:0; border-radius:50%; background:#f9f9f9; border:2.5px dashed #ddd; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden; position:relative; transition:all 0.3s ease;">
            <img id="guard-photo-preview" src="${editG?.photo || ''}" style="width:100%; height:100%; object-fit:cover; display:${editG?.photo ? 'block' : 'none'};">
            <div id="photo-placeholder" style="text-align:center; color:#ccc; display:${editG?.photo ? 'none' : 'block'};">
              <div style="font-size:2rem; line-height:1;">+</div>
            </div>
          </div>
          <input type="file" id="guard-photo-input" accept="image/*" style="display:none;">
        </div>

        <input type="text" id="guard-name" value="${editG?.name || ''}" placeholder="Nombre Completo" style="width:100%; box-sizing:border-box; padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; margin-bottom:12px; font-family:var(--font); font-weight:700; outline:none; background:#fafafa;">
        <input type="tel" id="guard-phone" value="${editG?.phone || ''}" placeholder="Teléfono WhatsApp (Ej: 58412...)" style="width:100%; box-sizing:border-box; padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; margin-bottom:12px; font-family:var(--font); font-weight:700; outline:none; background:#fafafa;">
        
        <div style="margin-bottom:25px;">
          <select id="guard-shift" style="width:100%; box-sizing:border-box; padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; background:#fafafa; font-family:var(--font); font-weight:700; outline:none; appearance:none;">
            <option value="Mañana" ${editG?.shift==='Mañana'?'selected':''}>Mañana</option>
            <option value="Tarde" ${editG?.shift==='Tarde'?'selected':''}>Tarde</option>
            <option value="Noche" ${editG?.shift==='Noche'?'selected':''}>Noche</option>
            <option value="Rotativo" ${editG?.shift==='Rotativo'?'selected':''}>Rotativo</option>
          </select>
        </div>

        <div style="display:flex; gap:10px;">
          <button data-action="ADD_GUARD" style="flex:2; padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.85rem; letter-spacing:1px; text-transform:uppercase; box-shadow:0 10px 20px rgba(26,26,46,0.15);">
            ${editingGuard ? 'GUARDAR CAMBIOS' : 'AÑADIR A LA NOMINA'}
          </button>
          ${editingGuard ? `<button data-action="CANCEL_EDIT" style="flex:1; padding:20px; background:#f4f4f4; color:#666; border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.85rem; text-transform:uppercase;">CANCELAR</button>` : ''}
        </div>
      </div>

      <div style="display:grid; gap:12px; max-width: 480px; margin-left:auto; margin-right:auto;">
        ${(state.personnel || []).map(p => {
          const gMovs = (state.movements || []).filter(m => m.guardName === p.name);
          const todayCount = gMovs.filter(m => new Date(m.timestamp) >= todayStart).length;
          const lastActive = gMovs.length > 0 ? new Date(gMovs[0].timestamp) : null;
          const activeNow = lastActive && (now - lastActive) < 12 * 60 * 60 * 1000;

          return `
            <div style="background:white; padding:15px 20px; border-radius:24px; display:flex; justify-content:space-between; align-items:center; border:1.5px solid #f8f8f8; box-shadow:0 10px 30px rgba(0,0,0,0.02); box-sizing:border-box; width:100%;">
              <div style="display:flex; align-items:center; gap:15px;">
                <div style="width:60px; height:60px; border-radius:50%; background:#f0f0f0; overflow:hidden; border:2px solid #fff; box-shadow:0 5px 15px rgba(0,0,0,0.05); position:relative; flex-shrink:0;">
                   ${p.photo ? `<img src="${p.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#ccc; font-weight:900; background:#eee;">${p.name.charAt(0)}</div>`}
                   ${activeNow ? `<div style="position:absolute; bottom:4px; right:4px; width:12px; height:12px; background:#22c55e; border:2px solid white; border-radius:50%; box-shadow:0 0 10px rgba(34,197,94,0.5);"></div>` : ''}
                </div>
                <div>
                  <div style="display:flex; align-items:center; gap:8px;">
                     <div style="font-weight:900; color:var(--primary); font-size:1rem;">${escapeHTML(p.name)}</div>
                     <div style="font-size:0.5rem; background:#f0f0f0; padding:2px 8px; border-radius:10px; font-weight:800; color:#999; text-transform:uppercase;">${escapeHTML(p.shift)}</div>
                  </div>
                  <div style="font-size:0.7rem; color:#bbb; font-weight:700; margin-top:2px;">
                     ${p.pin ? `PIN: <span style="color:var(--primary); letter-spacing:2px;">●●●●</span>` : '<span style="color:#e63946;">PENDIENTE ACTIVACIÓN</span>'} · 
                     <span style="color:#22c55e; font-weight:800;">${todayCount} movs hoy</span>
                  </div>
                </div>
              </div>
              
              <div style="display:flex; align-items:center; gap:10px;">
                 <button data-action="SEND_WHATSAPP_GUARD" data-id="${p.id}" style="background:none; border:none; padding:0; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer;"><img src="/icons/whatsapp-svgrepo-com.svg" style="width:30px; height:30px; filter:drop-shadow(0 2px 4px rgba(34,197,94,0.3));"/></button>
                 <button data-action="EDIT_GUARD" data-id="${p.id}" style="background:#f4f4f4; color:#999; border:none; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.8rem;">✎</button>
                 <button data-action="DELETE_GUARD" data-id="${p.id}" style="color:#ffccd5; background:none; border:none; font-weight:900; cursor:pointer; font-size:0.65rem; text-transform:uppercase;">×</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>`
}

// ─── DOM HOOKS ──────────────────────────────────────────────
export const setupGuardHooks = (container) => {
  const dropzone = container.querySelector('#photo-dropzone')
  const input = container.querySelector('#guard-photo-input')
  const preview = container.querySelector('#guard-photo-preview')
  const placeholder = container.querySelector('#photo-placeholder')

  if (dropzone && input) {
    dropzone.onclick = () => input.click()
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      
      const reader = new FileReader()
      reader.onload = async (evt) => {
        // Compress base64 image on select
        const { compressBase64Image } = await import('./admin-ui-components.js')
        const compressed = await compressBase64Image(evt.target.result, 180, 0.65)
        if (preview) {
          preview.src = compressed
          preview.style.display = 'block'
        }
        if (placeholder) placeholder.style.display = 'none'
      }
      reader.readAsDataURL(file)
    }
  }
}

// ─── ACTIONS INITIALIZER ─────────────────────────────────────
export const initGuardActions = (actions, container, refresh) => {
  Object.assign(actions, {
    ADD_GUARD: async () => {
      const name = document.getElementById('guard-name').value.trim();
      const phone = document.getElementById('guard-phone').value.trim();
      const shift = document.getElementById('guard-shift').value;
      const photoEl = document.getElementById('guard-photo-preview');
      const photo = (photoEl && photoEl.style.display !== 'none') ? photoEl.src : null;
      
      if (!name || !phone) {
        store.pendingAction = {
          type: 'CUSTOM_MODAL',
          title: '⚠️ DATOS INCOMPLETOS',
          content: `<p style="color:#666; font-weight:700;">El nombre y el teléfono son obligatorios.</p>`
        };
        refresh();
        return;
      }
      
      const state = getParkingState();
      state.personnel = state.personnel || [];
      
      if (store.editingGuard) {
        const idx = state.personnel.findIndex(p => p.id === store.editingGuard);
        if (idx !== -1) state.personnel[idx] = { ...state.personnel[idx], name, phone, shift, photo };
        store.editingGuard = null;
      } else {
        state.personnel.push({ id: crypto.randomUUID(), name, phone, shift, photo });
      }
      
      saveParkingState(state);
      logAudit(`Actualizó/Registró guardia: ${name}`);
      
      // Clear form inputs
      document.getElementById('guard-name').value = '';
      document.getElementById('guard-phone').value = '';
      const previewEl = document.getElementById('guard-photo-preview');
      if (previewEl) {
         previewEl.src = '';
         previewEl.style.display = 'none';
      }
      const placeholderEl = document.getElementById('photo-placeholder');
      if (placeholderEl) {
         placeholderEl.style.display = 'block';
      }
      
      refresh();
    },
    EDIT_GUARD: (btn) => {
      store.editingGuard = btn.dataset.id;
      refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    CANCEL_EDIT: () => {
      store.editingGuard = null;
      refresh();
    },
    DELETE_GUARD: (btn) => {
      const id = btn.dataset.id;
      const state = getParkingState();
      const guard = state.personnel.find(p => p.id === id);
      if (!guard) return;

      store.pendingAction = {
        type: 'CONFIRM_MODAL',
        title: `¿ELIMINAR A ${guard.name.toUpperCase()}?`,
        content: '<p style="color:#666; font-weight:700;">Esta acción borrará de la nómina y revocará el acceso permanente de este operador.</p>',
        confirmAction: () => {
          const s = getParkingState();
          s.personnel = s.personnel.filter(p => p.id !== id);
          saveParkingState(s);
          logAudit(`Eliminó guardia de nómina: ${guard.name}`);
          store.pendingAction = null;
          refresh();
        }
      };
      refresh();
    },
    SEND_WHATSAPP_GUARD: (btn) => {
      const id = btn.dataset.id;
      const state = getParkingState();
      const p = state.personnel.find(x => x.id === id);
      
      if (!p || !p.phone) return showToast('No hay teléfono registrado', 'error');
      
      const url = `${window.location.origin}/onboarding.html?setup=${p.id}&bld=${state.buildingCode}`;
      const msg = `¡Bienvenido a Sloty, ${p.name}! 🚗\n\nHas sido añadido como operador para ${state.buildingName}.\n\nPor favor, ingresa al siguiente enlace para configurar tu PIN de seguridad e iniciar tus turnos:\n\n${url}`;
      
      window.open(`https://wa.me/${p.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  });
}
