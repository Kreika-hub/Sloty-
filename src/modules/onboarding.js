/**
 * Onboarding Module — Lightweight 3-step setup wizard for newly registered buildings
 * Guides administrators through:
 * 1. Condominium/Building profile
 * 2. Initial parking structure (first floor & slot count)
 * 3. First guard/operator setup (name & PIN)
 */
import { escapeHTML } from '../utils/sanitize.js'
import { supabase, saveParkingState, getParkingState, enqueueSync } from '../db.js'

export const shouldShowOnboarding = (state) => {
  if (!state) return false;
  if (state.onboarding_completed) return false;
  const isFirstLogin = localStorage.getItem(`sloty_first_login_${state.buildingId}`) === 'true' || state.is_first_login === true;
  const hasNoLevels = !state.levels || state.levels.length === 0;
  const hasNoPersonnel = !state.personnel || state.personnel.length === 0;
  return isFirstLogin || (hasNoLevels && hasNoPersonnel);
};

export const markOnboardingComplete = (state) => {
  state.onboarding_completed = true;
  state.is_first_login = false;
  localStorage.setItem(`sloty_first_login_${state.buildingId}`, 'false');
  saveParkingState(state);
  
  if (state.buildingId && !state.isBypass) {
    supabase.from('buildings').update({ is_first_login: false }).eq('id', state.buildingId)
      .then(() => console.log('[Sloty Onboarding] Flag is_first_login updated in DB'))
      .catch(err => console.warn('[Sloty Onboarding] Failed to update is_first_login in DB:', err));
  }
};

export const renderOnboardingWizard = (container, state, onComplete) => {
  let currentStep = 1;
  const wizardData = {
    buildingName: state.buildingName || '',
    monthlyRate: state.monthly_rate || 20,
    levelName: 'Nivel 1 / Planta Baja',
    slotsCount: 15,
    guardName: '',
    guardPin: ''
  };

  const renderStep = () => {
    container.innerHTML = `
      <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(26,26,46,0.95); backdrop-filter:blur(15px); z-index:99999; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:20px; font-family:'Montserrat',sans-serif; color:white; box-sizing:border-box; overflow-y:auto;">
        
        <!-- Progress Banner -->
        <div style="width:100%; max-width:440px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:0.75rem; font-weight:900; color:#F5C518; text-transform:uppercase; letter-spacing:1px;">
              Paso ${currentStep} de 3 · Configuración Inicial
            </span>
            <button id="onboarding-skip-btn" style="background:none; border:none; color:rgba(255,255,255,0.4); font-size:0.75rem; font-weight:700; cursor:pointer;">
              Saltar por ahora
            </button>
          </div>
          <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden;">
            <div style="width:${(currentStep / 3) * 100}%; height:100%; background:#F5C518; transition:width 0.3s cubic-bezier(0.4, 0, 0.2, 1);"></div>
          </div>
        </div>

        <!-- Wizard Card -->
        <div style="background:#16213e; width:100%; max-width:440px; border-radius:30px; padding:35px 25px; box-shadow:0 25px 60px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); box-sizing:border-box;">
          
          ${currentStep === 1 ? `
            <div style="text-align:center; margin-bottom:25px;">
              <div style="font-size:3rem; margin-bottom:10px;">🏢</div>
              <h2 style="font-size:1.3rem; font-weight:900; color:white; margin:0 0 6px;">Bienvenido a Sloty</h2>
              <p style="font-size:0.8rem; color:rgba(255,255,255,0.6); margin:0;">Personaliza los datos de tu condominio o estacionamiento.</p>
            </div>

            <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:25px;">
              <div>
                <label style="font-size:0.7rem; font-weight:800; color:#F5C518; display:block; margin-bottom:6px; text-transform:uppercase;">Nombre del Condominio / Edificio</label>
                <input id="ob-bld-name" type="text" value="${escapeHTML(wizardData.buildingName)}" placeholder="Ej: Residencias Los Rosales" style="width:100%; box-sizing:border-box; padding:16px; border-radius:14px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat';">
              </div>

              <div>
                <label style="font-size:0.7rem; font-weight:800; color:#F5C518; display:block; margin-bottom:6px; text-transform:uppercase;">Tarifa Mensual Base ($ / mes)</label>
                <input id="ob-monthly-rate" type="number" step="0.01" value="${wizardData.monthlyRate}" placeholder="20.00" style="width:100%; box-sizing:border-box; padding:16px; border-radius:14px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat';">
              </div>
            </div>
          ` : ''}

          ${currentStep === 2 ? `
            <div style="text-align:center; margin-bottom:25px;">
              <div style="font-size:3rem; margin-bottom:10px;">🚗</div>
              <h2 style="font-size:1.3rem; font-weight:900; color:white; margin:0 0 6px;">Estructura de Puestos</h2>
              <p style="font-size:0.8rem; color:rgba(255,255,255,0.6); margin:0;">Crea tu primer nivel o piso para comenzar a operar.</p>
            </div>

            <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:25px;">
              <div>
                <label style="font-size:0.7rem; font-weight:800; color:#F5C518; display:block; margin-bottom:6px; text-transform:uppercase;">Nombre del Nivel o Piso</label>
                <input id="ob-level-name" type="text" value="${escapeHTML(wizardData.levelName)}" placeholder="Ej: PB / Sótano 1" style="width:100%; box-sizing:border-box; padding:16px; border-radius:14px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat';">
              </div>

              <div>
                <label style="font-size:0.7rem; font-weight:800; color:#F5C518; display:block; margin-bottom:6px; text-transform:uppercase;">Cantidad de Puestos Iniciales</label>
                <input id="ob-slots-count" type="number" min="1" max="200" value="${wizardData.slotsCount}" placeholder="15" style="width:100%; box-sizing:border-box; padding:16px; border-radius:14px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat';">
              </div>
            </div>
          ` : ''}

          ${currentStep === 3 ? `
            <div style="text-align:center; margin-bottom:25px;">
              <div style="font-size:3rem; margin-bottom:10px;">👮‍♂️</div>
              <h2 style="font-size:1.3rem; font-weight:900; color:white; margin:0 0 6px;">Primer Operador</h2>
              <p style="font-size:0.8rem; color:rgba(255,255,255,0.6); margin:0;">Crea el acceso para el guardia o vigilante de garita.</p>
            </div>

            <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:25px;">
              <div>
                <label style="font-size:0.7rem; font-weight:800; color:#F5C518; display:block; margin-bottom:6px; text-transform:uppercase;">Nombre del Guardia</label>
                <input id="ob-guard-name" type="text" value="${escapeHTML(wizardData.guardName)}" placeholder="Ej: Carlos Mendoza" style="width:100%; box-sizing:border-box; padding:16px; border-radius:14px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:white; font-weight:700; outline:none; font-family:'Montserrat';">
              </div>

              <div>
                <label style="font-size:0.7rem; font-weight:800; color:#F5C518; display:block; margin-bottom:6px; text-transform:uppercase;">PIN de Acceso (4 dígitos)</label>
                <input id="ob-guard-pin" type="password" maxlength="4" inputmode="numeric" placeholder="••••" style="width:100%; box-sizing:border-box; padding:16px; border-radius:14px; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:white; font-size:1.4rem; font-weight:900; text-align:center; outline:none; font-family:'Montserrat'; letter-spacing:4px;">
              </div>
            </div>
          ` : ''}

          <!-- Action Buttons -->
          <div style="display:flex; gap:12px;">
            ${currentStep > 1 ? `
              <button id="ob-btn-prev" style="flex:1; padding:18px; background:rgba(255,255,255,0.1); color:white; border:none; border-radius:16px; font-weight:800; font-size:0.85rem; cursor:pointer;">
                ← ATRÁS
              </button>
            ` : ''}
            <button id="ob-btn-next" style="flex:2; padding:18px; background:#F5C518; color:#1a1a2e; border:none; border-radius:16px; font-weight:900; font-size:0.9rem; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px;">
              ${currentStep === 3 ? 'FINALIZAR CONFIGURACIÓN' : 'CONTINUAR →'}
            </button>
          </div>

        </div>
      </div>
    `;

    // Hook events
    document.getElementById('onboarding-skip-btn').onclick = () => {
      markOnboardingComplete(state);
      const wizardLayer = container.querySelector('div');
      if (wizardLayer) wizardLayer.remove();
      if (onComplete) onComplete();
    };

    if (currentStep > 1) {
      document.getElementById('ob-btn-prev').onclick = () => {
        currentStep--;
        renderStep();
      };
    }

    document.getElementById('ob-btn-next').onclick = async () => {
      if (currentStep === 1) {
        const bName = document.getElementById('ob-bld-name').value.trim();
        const mRate = parseFloat(document.getElementById('ob-monthly-rate').value) || 20;
        if (!bName) {
          alert('Por favor, ingresa el nombre del condominio');
          return;
        }
        wizardData.buildingName = bName;
        wizardData.monthlyRate = mRate;
        state.buildingName = bName;
        state.monthly_rate = mRate;
        currentStep = 2;
        renderStep();
      } else if (currentStep === 2) {
        const lName = document.getElementById('ob-level-name').value.trim();
        const sCount = parseInt(document.getElementById('ob-slots-count').value) || 15;
        if (!lName) {
          alert('Por favor, ingresa el nombre de la primera planta o nivel');
          return;
        }
        wizardData.levelName = lName;
        wizardData.slotsCount = sCount;
        currentStep = 3;
        renderStep();
      } else if (currentStep === 3) {
        const gName = document.getElementById('ob-guard-name').value.trim();
        const gPin = document.getElementById('ob-guard-pin').value.trim();
        
        wizardData.guardName = gName;
        wizardData.guardPin = gPin;

        // Apply configuration to state
        // 1. Initial level
        if (!state.levels || state.levels.length === 0) {
          const slots = [];
          for (let i = 1; i <= wizardData.slotsCount; i++) {
            slots.push({
              id: `s-${Date.now()}-${i}`,
              label: `${i}`,
              status: 'FREE',
              category: 'VISITANTE',
              plate: '',
              entryTime: null,
              metadata: {}
            });
          }
          state.levels = [{
            id: `lvl-${Date.now()}`,
            name: wizardData.levelName,
            color: '#3a86ff',
            slots: slots
          }];
        }

        // 2. Initial guard
        if (wizardData.guardName && wizardData.guardPin) {
          state.personnel = state.personnel || [];
          const newGuard = {
            id: `g-${Date.now()}`,
            name: wizardData.guardName,
            pin: wizardData.guardPin,
            phone: '',
            active: true,
            photo_url: ''
          };
          state.personnel.push(newGuard);
          
          if (state.buildingId) {
            enqueueSync({
              table: 'personnel',
              action: 'UPSERT',
              data: {
                id: newGuard.id,
                building_id: state.buildingId,
                name: newGuard.name,
                pin: newGuard.pin,
                phone: newGuard.phone,
                photo_url: newGuard.photo_url
              }
            });
          }
        }

        markOnboardingComplete(state);
        
        // Remove wizard layer
        const wizardLayer = container.querySelector('div');
        if (wizardLayer) wizardLayer.remove();

        if (onComplete) onComplete();
      }
    };
  };

  renderStep();
};
