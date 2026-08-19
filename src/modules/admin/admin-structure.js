/**
 * Admin Structure — Structure, floors, colors and slots (STRUCTURE tab)
 * Extracted from admin.js (Phase C Lot 3 refactor)
 */
import { getParkingState, saveParkingState, logAudit, showToast } from '../../db.js'
import { escapeHTML } from '../../utils/sanitize.js'
import { ICONS } from './admin-ui-components.js'
import { store } from './admin-store.js'

// ─── STRUCTURE TAB RENDERER (STRUCTURE) ──────────────────────
export const renderLevels = (state) => {
  const editingLevel = store.editingLevel;
  const openPaletteLevel = store.openPaletteLevel;

  return `
    <div style="padding:20px; padding-bottom:120px;">
      <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">GESTIÓN DE ESTRUCTURA</h2>
      
      <!-- GENERAR PLANTA -->
      <div style="background:white; padding:30px; border-radius:32px; margin-bottom:-5px; box-shadow:0 15px 40px rgba(0,0,0,0.04); border:1.5px solid #f0f0f0;">
        <div style="font-size:0.7rem; font-weight:800; color:#999; text-align:center; margin-bottom:20px; text-transform:uppercase; letter-spacing:1px;">NUEVA PLANTA</div>
        <div class="input-stack" style="margin-bottom:20px;">
          <input type="text" id="level-name" placeholder="Piso / Área" style="padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; font-family:var(--font); font-weight:700; background:#fafafa; outline:none;">
          <input type="number" id="level-capacity" placeholder="Capacidad" style="padding:18px; border:1.5px solid #f0f0f0; border-radius:18px; font-family:var(--font); font-weight:700; background:#fafafa; outline:none;">
        </div>
        <button data-action="GENERATE" style="width:100%; padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.85rem; letter-spacing:1px; text-transform:uppercase;">CREAR PLANTA</button>
      </div>

      <div style="display:grid; gap:15px; margin-top:35px;">
        ${(state.levels || []).map(l => {
          const isEditing = editingLevel === l.name;
          const cardColor = l.color || '#1a1a2e';
          
          return `
          <div style="background:white; border-radius:28px; overflow:hidden; border:1.5px solid #f0f0f0; box-shadow:0 10px 30px rgba(0,0,0,0.02); position:relative;">
            <div style="height:6px; background:${cardColor}; width:100%;"></div>
            
            <!-- HEADER -->
            <div style="padding:20px; display:flex; justify-content:space-between; align-items:center;">
              <div style="flex:1;">
                ${isEditing ? `
                  <div style="display:flex; gap:8px;">
                    <input type="text" id="rename-input-${escapeHTML(l.name)}" value="${escapeHTML(l.name)}" style="flex:1; padding:8px 12px; border-radius:10px; border:1.5px solid var(--accent); font-weight:900; outline:none;">
                    <button data-action="CONFIRM_RENAME" data-oldname="${escapeHTML(l.name)}" style="background:var(--primary); color:white; border:none; border-radius:8px; padding:0 12px;">OK</button>
                  </div>
                ` : `
                  <div style="display:flex; align-items:center; gap:10px;">
                    <div style="font-size:1.1rem; font-weight:900; color:var(--primary);">${escapeHTML(l.name)}</div>
                    <button data-action="START_RENAME" data-name="${escapeHTML(l.name)}" style="background:none; border:none; color:#bbb; cursor:pointer; width:16px; height:20px;">${ICONS.EDIT}</button>
                  </div>
                  <div style="font-size:0.6rem; font-weight:700; color:#999; margin-top:2px;">${l.slots.length} Puestos · <span style="color:${cardColor}; text-transform:uppercase;">${l.color ? 'Personalizado' : 'Básico'}</span></div>
                `}
              </div>
              
              <div style="display:flex; align-items:center; gap:8px;">
                 <!-- PALETTE WRAPPER -->
                 <div style="display:flex; align-items:center; position:relative;">
                    <div style="display:${openPaletteLevel === l.name ? 'flex' : 'none'}; gap:4px; padding:6px; background:#f4f4f4; border-radius:12px; margin-right:8px; border:1px solid #eee; position:absolute; right:100%; top:50%; transform:translateY(-50%); z-index:10;">
                       ${['#1a1a2e','#e63946','#22c55e','#3b82f6','#a855f7'].map(c => `
                         <div data-action="SET_LEVEL_COLOR" data-name="${escapeHTML(l.name)}" data-color="${c}" style="width:16px; height:16px; border-radius:50%; background:${c}; cursor:pointer; border:${l.color===c?'2.5px solid white':'none'}; box-shadow:0 2px 5px rgba(0,0,0,0.1);"></div>
                       `).join('')}
                    </div>
                    <button data-action="TOGGLE_PALETTE" data-name="${escapeHTML(l.name)}" style="background:none; border:none; color:${openPaletteLevel===l.name?'var(--primary)':'#bbb'}; width:22px; height:22px; cursor:pointer; transition:all 0.2s;">
                       ${ICONS.PALETTE}
                    </button>
                 </div>

                 <button data-action="ADD_SLOT" data-name="${escapeHTML(l.name)}" style="background:#f4f4f4; border:none; color:var(--primary); width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; margin-left:4px;">${ICONS.PLUS}</button>
                 
                 <button data-action="TOGGLE_COLLAPSE" data-name="${escapeHTML(l.name)}" style="background:none; border:none; color:#bbb; cursor:pointer; width:24px; transition:transform 0.3s; transform:${l.collapsed?'rotate(0deg)':'rotate(180deg)'};">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
                 </button>
                 
                 <button data-action="DELETE_LEVEL" data-name="${escapeHTML(l.name)}" style="background:rgba(230,57,70,0.08); border:none; color:#e63946; cursor:pointer; width:36px; height:36px; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-left:4px; transition:all 0.2s;">
                    <span style="width:20px;">${ICONS.TRASH}</span>
                 </button>
              </div>
            </div>

            <!-- SLOTS AREA -->
            <div style="display:${l.collapsed ? 'none' : 'block'}; padding:0 20px 20px 20px;">
              <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${l.slots.map(s => `
                  <div style="padding:10px 14px; background:#f8f9fa; border-radius:12px; font-size:0.7rem; font-weight:900; color:var(--primary); display:flex; align-items:center; gap:8px; border:1px solid #f0f0f0;">
                    ${escapeHTML(s.label)}
                    <button data-action="DELETE_SLOT" data-levelname="${escapeHTML(l.name)}" data-label="${escapeHTML(s.label)}" style="border:none; background:none; color:#ddd; font-size:1.1rem; cursor:pointer; line-height:1; font-weight:400;">×</button>
                  </div>
                `).join('')}
                ${!l.slots.length ? '<div style="font-size:0.7rem; color:#bbb; font-weight:700; width:100%; text-align:center; padding:20px;">No hay puestos asignados</div>' : ''}
              </div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </div>`
}

// ─── ACTIONS INITIALIZER ─────────────────────────────────────
export const initStructureActions = (actions, container, refresh) => {
  Object.assign(actions, {
    TOGGLE_COLLAPSE: (btn) => {
      const name = btn.dataset.name
      const state = getParkingState()
      const found = state.levels.find(l => l.name === name)
      if (found) found.collapsed = !found.collapsed
      saveParkingState(state)
      refresh()
    },
    START_RENAME: (btn) => {
      store.editingLevel = btn.dataset.name
      refresh()
    },
    CONFIRM_RENAME: (btn) => {
      const oldName = btn.dataset.oldname
      const newName = document.getElementById(`rename-input-${oldName}`).value.trim()
      if (!newName) return showToast('Nombre inválido', 'error')
      
      const state = getParkingState()
      const found = state.levels.find(l => l.name === oldName)
      if (found) {
        found.name = newName
        // Update any slots under this level if needed (they don't store parent name inside slot objects)
        state.personnel?.forEach(p => {
          if (p.shift === oldName) p.shift = newName
        })
      }
      saveParkingState(state)
      logAudit(`Renombró planta ${oldName} a ${newName}`)
      store.editingLevel = null
      refresh()
    },
    CANCEL_RENAME: () => {
      store.editingLevel = null
      refresh()
    },
    SET_LEVEL_COLOR: (btn) => {
      const name = btn.dataset.name
      const color = btn.dataset.color
      const state = getParkingState()
      const found = state.levels.find(l => l.name === name)
      if (found) found.color = color
      saveParkingState(state)
      store.openPaletteLevel = null
      refresh()
    },
    TOGGLE_PALETTE: (btn) => {
      const name = btn.dataset.name
      store.openPaletteLevel = store.openPaletteLevel === name ? null : name
      refresh()
    },
    DELETE_LEVEL: (btn) => {
      const name = btn.dataset.name
      store.pendingAction = {
        type: 'CONFIRM_MODAL',
        title: `¿ELIMINAR ${name.toUpperCase()}?`,
        content: '<p style="color:#666; font-weight:700;">Esta acción borrará la planta y TODOS sus puestos permanentemente.</p>',
        confirmAction: () => {
          const state = getParkingState()
          state.levels = state.levels.filter(l => l.name !== name)
          saveParkingState(state)
          logAudit(`Eliminó planta: ${name}`)
          store.pendingAction = null
          refresh()
        }
      }
      refresh()
    },
    DELETE_SLOT: (btn) => {
      const { levelname, label } = btn.dataset
      const state = getParkingState()
      const level = state.levels.find(l => l.name === levelname)
      if (level) {
        level.slots = level.slots.filter(s => s.label !== label)
      }
      saveParkingState(state)
      refresh()
    },
    ADD_SLOT: (btn) => {
      const name = btn.dataset.name
      const state = getParkingState()
      const level = state.levels.find(l => l.name === name)
      if (level) {
        // Find next incremental number
        let nextNum = level.slots.length + 1
        let newLabel = `${name.substring(0, 2).toUpperCase()}-${nextNum}`
        while (level.slots.some(s => s.label === newLabel)) {
          nextNum++
          newLabel = `${name.substring(0, 2).toUpperCase()}-${nextNum}`
        }
        level.slots.push({ label: newLabel, active: true })
      }
      saveParkingState(state)
      refresh()
    },
    GENERATE: () => {
      const name = document.getElementById('level-name').value.trim()
      const cap = parseInt(document.getElementById('level-capacity').value) || 0
      
      if (!name || cap <= 0) return showToast('Datos inválidos', 'error')
      
      const state = getParkingState()
      state.levels = state.levels || []
      
      if (state.levels.some(l => l.name.toUpperCase() === name.toUpperCase())) {
        return showToast('Ese piso ya existe', 'error')
      }
      
      const prefix = name.substring(0, 2).toUpperCase()
      const slots = []
      for (let i = 1; i <= cap; i++) {
        slots.push({ label: `${prefix}-${i}`, active: true })
      }
      
      state.levels.push({ name, slots, collapsed: false })
      saveParkingState(state)
      logAudit(`Creó planta: ${name} con capacidad ${cap}`)
      
      // Clear inputs
      document.getElementById('level-name').value = ''
      document.getElementById('level-capacity').value = ''
      refresh()
    }
  })
}
