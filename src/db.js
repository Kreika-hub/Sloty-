import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta?.env?.VITE_SUPABASE_URL || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || ''
const SUPABASE_KEY = import.meta?.env?.VITE_SUPABASE_KEY || import.meta?.env?.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) || ''

export const isUUID = (str) => {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
};

export const isSupabaseConfigured = () => {
  return Boolean(
    SUPABASE_URL && 
    SUPABASE_KEY && 
    !SUPABASE_URL.includes('your_supabase_project_url') &&
    !SUPABASE_URL.includes('placeholder.supabase.co') &&
    SUPABASE_KEY !== 'placeholder-anon-key'
  );
};

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key');

const STORAGE_KEY = 'sloty_state'
const SYNC_QUEUE_KEY = 'sloty_sync_queue'

// 1. OFFLINE SYNC QUEUE SYSTEM (IndexedDB with LocalStorage Fallback)
const DB_NAME = 'sloty_pwa_db'
const STORE_NAME = 'sync_queue'
const MAX_QUEUE_SIZE = 200

let inMemoryQueue = []
let idbDatabase = null

const initIDB = () => {
    return new Promise((resolve) => {
        try {
            if (typeof indexedDB === 'undefined') return resolve(null);
            const request = indexedDB.open(DB_NAME, 1)
            request.onerror = (e) => {
                console.warn('[Sloty IDB] Failed to open IndexedDB, falling back to localStorage:', e)
                resolve(null)
            }
            request.onsuccess = (e) => {
                resolve(e.target.result)
            }
            request.onupgradeneeded = (e) => {
                const db = e.target.result
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: '_internalId' })
                }
            }
        } catch (err) {
            console.warn('[Sloty IDB] IndexedDB not supported or permission denied:', err)
            resolve(null)
        }
    })
}

const fallbackToLocalStorage = () => {
    try {
        if (typeof localStorage === 'undefined') return;
        const raw = localStorage.getItem(SYNC_QUEUE_KEY)
        inMemoryQueue = raw ? JSON.parse(raw) : []
        console.log(`[Sloty IDB] Loaded ${inMemoryQueue.length} tasks from localStorage fallback`)
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sloty-sync-updated', { detail: { count: inMemoryQueue.length } }))
        }
    } catch(e) {
        inMemoryQueue = []
    }
}

const loadQueueFromStorage = async () => {
    idbDatabase = await initIDB()
    if (idbDatabase) {
        return new Promise((resolve) => {
            try {
                const transaction = idbDatabase.transaction([STORE_NAME], 'readonly')
                const store = transaction.objectStore(STORE_NAME)
                const request = store.getAll()
                request.onsuccess = () => {
                    inMemoryQueue = request.result || []
                    console.log(`[Sloty IDB] Loaded ${inMemoryQueue.length} tasks from IndexedDB`)
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('sloty-sync-updated', { detail: { count: inMemoryQueue.length } }))
                    }
                    resolve(inMemoryQueue)
                }
                request.onerror = () => {
                    fallbackToLocalStorage()
                    resolve(inMemoryQueue)
                }
            } catch(e) {
                fallbackToLocalStorage()
                resolve(inMemoryQueue)
            }
        })
    } else {
        fallbackToLocalStorage()
        return inMemoryQueue
    }
}

const persistToLocalStorage = () => {
    try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(inMemoryQueue))
    } catch(e) {
        console.error('[Sloty IDB] localStorage write failed:', e)
    }
}

const persistQueue = async () => {
    if (idbDatabase) {
        try {
            const transaction = idbDatabase.transaction([STORE_NAME], 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            const clearReq = store.clear()
            clearReq.onsuccess = () => {
                for (const task of inMemoryQueue) {
                    store.add(task)
                }
            }
        } catch (e) {
            console.warn('[Sloty IDB] Write to IndexedDB failed, using localStorage fallback:', e)
            persistToLocalStorage()
        }
    } else {
        persistToLocalStorage()
    }
}

export const enqueueSync = async (task) => {
    if (!task) return;

    // Si la tarea involucra un building_id o ID que NO es UUID válido (ej. mock o test local),
    // no se encola remotamente para evitar error Postgres 22P02 y bucles de reintentos.
    if (task.data) {
        const isValidPayload = (item) => {
            if (!item || typeof item !== 'object') return true;
            if (item.building_id && !isUUID(item.building_id)) return false;
            if (['buildings', 'personnel', 'subscriptions', 'vehicles'].includes(task.table)) {
                if (item.id && !isUUID(item.id)) return false;
            }
            return true;
        };
        if (Array.isArray(task.data)) {
            const validItems = task.data.filter(isValidPayload);
            if (validItems.length === 0) return;
            task.data = validItems;
        } else if (!isValidPayload(task.data)) {
            return;
        }
    }

    const item = { _internalId: Date.now() + Math.random(), _retries: 0, ...task }
    inMemoryQueue.push(item)
    if (inMemoryQueue.length > MAX_QUEUE_SIZE) {
        inMemoryQueue = inMemoryQueue.slice(inMemoryQueue.length - MAX_QUEUE_SIZE)
    }
    await persistQueue()
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sloty-sync-updated', { detail: { count: inMemoryQueue.length } }))
    }
    triggerSyncUp()
}

export const getSyncQueueCount = () => {
    return inMemoryQueue.length
}

export const isTaskPending = (taskId) => {
    return inMemoryQueue.some(t => t.data && (t.data.id === taskId || t.data.visitor_id === taskId))
}

const cleanQueue = async (idsToRemove) => {
    inMemoryQueue = inMemoryQueue.filter(t => !idsToRemove.includes(t._internalId))
    await persistQueue()
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sloty-sync-updated', { detail: { count: inMemoryQueue.length } }))
    }
}

let isSyncing = false
const triggerSyncUp = async () => {
    if ((typeof navigator !== 'undefined' && !navigator.onLine) || isSyncing || !isSupabaseConfigured()) return
    isSyncing = true
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sloty-sync-updated', { detail: { count: inMemoryQueue.length } }))
    }
    if (inMemoryQueue.length === 0) { isSyncing = false; return }

    const removeIds = []
    const currentTasks = [...inMemoryQueue]
    
    for (const task of currentTasks) {
        try {
            if (task.table === 'personnel' && Array.isArray(task.data)) {
                task.data.forEach(item => delete item.active);
                task.data = task.data.filter(item => isUUID(item.id) || !item.id);
                if (task.data.length === 0) {
                    removeIds.push(task._internalId);
                    continue;
                }
            }

            // Validar si el payload contiene building_id o id que no sea UUID
            if (task.data) {
                const isInvalid = (d) => {
                    if (!d || typeof d !== 'object') return false;
                    if (d.building_id && !isUUID(d.building_id)) return true;
                    if (['buildings', 'personnel', 'subscriptions', 'vehicles'].includes(task.table)) {
                        if (d.id && !isUUID(d.id)) return true;
                    }
                    return false;
                };

                const hasInvalidData = Array.isArray(task.data)
                    ? task.data.some(isInvalid)
                    : isInvalid(task.data);

                if (hasInvalidData) {
                    console.warn('[Sloty Sync] Tarea aislada localmente por UUID no válido (evitando 22P02):', task);
                    removeIds.push(task._internalId);
                    continue;
                }
            }

            if (task.action === 'INSERT') {
                const { error } = await supabase.from(task.table).insert(task.data)
                if (error) throw error
            }
            if (task.action === 'UPSERT') {
                const options = task.onConflict ? { onConflict: task.onConflict } : {}
                const { error } = await supabase.from(task.table).upsert(task.data, options)
                if (error) throw error
            }
            removeIds.push(task._internalId)
        } catch (e) {
            console.error('[Sloty Sync Error]:', e, 'Task:', task)
            task._retries = (task._retries || 0) + 1
            if (e?.code === '22P02' || task._retries >= 3) {
                console.warn('[Sloty] Descartando tarea tras fallo o error 22P02:', task)
                removeIds.push(task._internalId)
            }
        }
    }
    
    if (removeIds.length > 0) await cleanQueue(removeIds)
    isSyncing = false
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sloty-sync-updated', { detail: { count: inMemoryQueue.length } }))
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        window.dispatchEvent(new CustomEvent('sloty-connection-status', { detail: { online: true } }))
        triggerSyncUp()
    })
    window.addEventListener('offline', () => {
        window.dispatchEvent(new CustomEvent('sloty-connection-status', { detail: { online: false } }))
    })
}

// Initialize the queue asynchronously on script load
loadQueueFromStorage().then(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
        triggerSyncUp()
    }
})

const defaultState = {
  buildingName: "Edificio Sloty",
  buildingCode: "SLO-1234",
  location: { city: "Caracas", state: "DC" },
  adminInfo: { name: "Administrador Sloty", email: "", phone: "", registered: true },
  personnel: [],
  levels: [],
  movements: [],
  auditLog: [],
  notifications: [],
  closures: [],
  ads: [],
  stats: {
    totalCollected: 0
  },
  settings: {
    freeHours: 8, baseRate: 1, extraPerHour: 0, rentalSlotsCap: null,
    customFields: [ 
       { id: 'torre', label: 'Torre', required: true }, 
       { id: 'piso', label: 'Piso', required: true }, 
       { id: 'apto', label: 'Apartamento', required: true } 
    ],
    categories: [
      { id:'VISITANTE', label:'Visitante', color:'#F5C518', tag:'V', txt:'#000000', maxHours: 8 },
      { id:'RESIDENTE', label:'Residente', color:'#38bdf8', tag:'R', txt:'white', maxHours: null },
      { id:'MERCADO', label:'Mercado', color:'#22c55e', tag:'M', txt:'white', maxHours: 0.5 }
    ]
  }
}

const recalcStatsData = (state = {}) => {
  let total = 0, occupied = 0, debt = 0
  if (state && Array.isArray(state.levels)) {
    state.levels.forEach(lvl => {
        if (lvl && Array.isArray(lvl.slots)) {
            lvl.slots.forEach(s => {
                if (!s) return
                total++
                if (s.status === 'OCCUPIED') occupied++
                if (s.status === 'DEBT') debt++
            })
            lvl.capacity = lvl.slots.length
        }
    })
  }
  const currentStats = (state && typeof state.stats === 'object' && state.stats) ? state.stats : {}
  return { ...currentStats, totalSpots: total, occupied, debt: debt }
}

const IGNORE_WORDS = [
  'edificio', 'edificios', 'residencia', 'residencias',
  'torre', 'torres', 'conjunto', 'centro', 'complejo',
  'estacionamiento', 'parque', 'parqueadero',
  'el', 'la', 'los', 'las', 'de', 'del', 'y'
]

export const getCleanPrefix = (name) => {
  const words = (name || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => !IGNORE_WORDS.includes(w) && w.length > 0)
  const meaningful = words[0] || 'SLO'
  return meaningful.substring(0, 3).toUpperCase()
}


let hasBootedDown = false
export const syncDown = async (buildingCode) => {
    if (!navigator.onLine || !isSupabaseConfigured() || !buildingCode || buildingCode.startsWith('DEV-')) return
    console.log('[Sloty] Inicia descarga de sincronización para:', buildingCode)
    
    try {
        const { data: bData } = await supabase
            .from('buildings')
            .select('*')
            .eq('code', buildingCode.toUpperCase())
            .single()
            
        if (!bData) {
            console.warn('[Sloty] Edificio no encontrado en la nube')
            return
        }
        
        const buildingId = bData.id
        initGlobalRealtime(buildingId, bData.code)
        
        const [ { data: sData }, { data: aData }, { data: pData } ] = await Promise.all([
            supabase.from('parking_slots').select('*').eq('building_id', buildingId),
            supabase.from('access_logs').select('*').eq('building_id', buildingId).limit(200).order('timestamp', { ascending: false }),
            supabase.from('personnel').select('*').eq('building_id', buildingId)
        ])

        const state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
        state.buildingId = buildingId 
        state.buildingName = bData.name
        state.buildingCode = bData.code
        state.plan = bData.plan || 'TRIAL'
        state.membership_status = bData.membership_status || 'ACTIVE'
        state.features_override = bData.features_override || {}
        state.logo_url = bData.logo_url || null
        if (bData.trial_started_at) state.trial_started_at = bData.trial_started_at
        
        if (pData) state.personnel = pData

        if (sData && sData.length > 0) {
            const levelMap = {}
            sData.forEach(slot => {
                if (!levelMap[slot.level_name]) {
                    levelMap[slot.level_name] = { 
                        name: slot.level_name, 
                        collapsed: slot.level_collapsed || false, 
                        color: slot.level_color || null,
                        slots: [] 
                    }
                }
                levelMap[slot.level_name].slots.push({
                   label: slot.slot_label,
                   status: slot.status,
                   category: slot.category
                })
            })
            state.levels = Object.values(levelMap)
        }

        if (aData) {
           const mappedLogs = aData.map(l => ({
               id: l.id,
               type: l.type,
               timestamp: l.timestamp,
               plate: l.plate,
               slot: l.slot_label,
               category: l.category,
               guardName: l.guard_name,
               payMethod: l.pay_method,
               amount: l.amount,
               reference: l.reference,
               paymentStatus: l.payment_status,
               metadata: l.metadata,
               closed: l.closed
           }))
           state.movements = mappedLogs
        }

        state.stats = recalcStatsData(state)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        hasBootedDown = true
        console.log('[Sloty] Sincronización exitosa.')
    } catch (e) {
        console.error('[Sloty] Download sync error:', e)
    }
}

export const getParkingState = () => {
  let state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
        state = JSON.parse(raw)
        if (state.settings && state.settings.customFields) {
           if (!state.settings.customFields.some(f => f.id === 'piso')) {
              state.settings.customFields.splice(1, 0, { id: 'piso', label: 'Piso', required: true })
              localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
           }
        }
        if (!hasBootedDown) setTimeout(() => syncDown(state.buildingCode), 100)
    }
  } catch(e) {}
  
  if (!state) {
      state = JSON.parse(JSON.stringify(defaultState))
      state.buildingCode = `${getCleanPrefix(state.buildingName)}-${Math.floor(1000 + Math.random() * 9000)}`
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
  return state
}

export const saveParkingState = (state) => {
  state.stats = recalcStatsData(state)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  
  if (state.buildingId && isUUID(state.buildingId)) {
      const payload = []
      state.levels.forEach(l => {
          l.slots.forEach(s => {
              payload.push({
                  building_id: state.buildingId,
                  level_name: l.name,
                  slot_label: s.label,
                  status: s.status,
                  category: s.category,
                  level_collapsed: l.collapsed,
                  level_color: l.color
              })
          })
      })
      if (payload.length > 0) {
          enqueueSync({ 
             table: 'parking_slots', 
             action: 'UPSERT', 
             onConflict: 'building_id,level_name,slot_label',
             data: payload 
          })
      }
      
      // Personnel UPSERT
      if (state.personnel) {
         const pPayload = state.personnel.map(p => {
             const item = {
                 id: p.id,
                 building_id: state.buildingId,
                 name: p.name,
                 phone: p.phone,
                 shift: p.shift,
                 photo: p.photo
             }
             if (p.pin) {
                 item.pin = p.pin
             }
             return item;
         })
         if (pPayload.length > 0) {
            enqueueSync({ table: 'personnel', action: 'UPSERT', data: pPayload })
         }
      }
  }

  return state
}

export const updateParkingState = (state) => saveParkingState(state)

export const logMovement = (movement) => {
  const state = getParkingState()
  const rate = Number(_bcvCache?.rate || 40.0)
  
  const amountUsd = Number(Number(movement.amount || 0).toFixed(2))
  const amountBs = Number(Number(amountUsd * rate).toFixed(2))

  const entry = {
    ...movement,
    id: `m-${Date.now()}`,
    timestamp: new Date().toISOString(),
    closed: false,
    amount_usd: amountUsd,
    amount_bs: amountBs,
    bcv_rate_used: rate
  }
  state.movements = state.movements || []
  state.movements.unshift(entry)
  
  if (movement.type === 'SALIDA') {
    if (movement.amount) state.stats.totalCollected += movement.amount
  }
  
  saveParkingState(state)
  
  if (!state.buildingId || !isUUID(state.buildingId)) { return; }
  
  enqueueSync({
      table: 'access_logs',
      action: 'INSERT',
      data: {
          id: entry.id,
          building_id: state.buildingId,
          timestamp: entry.timestamp,
          type: entry.type,
          plate: entry.plate,
          slot_label: entry.slot,
          category: entry.category,
          guard_name: entry.guardName,
          pay_method: entry.payMethod,
          amount: entry.amount,
          amount_usd: amountUsd,
          amount_bs: amountBs,
          bcv_rate_used: rate,
          reference: entry.reference,
          payment_status: entry.paymentStatus,
          metadata: entry.metadata,
          closed: false
      }
  })

  if (entry.plate) {
      enqueueSync({
          table: 'visitor_plates',
          action: 'UPSERT',
          onConflict: 'plate',
          data: { plate: entry.plate, category: entry.category, last_seen: entry.timestamp }
      })
  }
}

export const saveClosure = async (closure) => {
  const state = getParkingState()
  state.closures = state.closures || []

  const closedIds = closure.movements.map(m => m.id)
  state.movements.forEach(m => {
    if (closedIds.includes(m.id)) m.closed = true
  })

  const closureObj = {
    ...closure,
    id: `c-${Date.now()}`,
    timestamp: new Date().toISOString()
  }
  state.closures.unshift(closureObj)
  saveParkingState(state)

  // Subir a Supabase solo si buildingId es UUID válido y Supabase está configurado
  if (state.buildingId && isUUID(state.buildingId) && isSupabaseConfigured()) {
    try {
      await supabase.from('guard_shifts').insert({
        building_id:  state.buildingId,
        guard_name:   closure.guardName || closure.guard || 'Guardia',
        guard_id:     (closure.guardId && isUUID(closure.guardId)) ? closure.guardId : null,
        started_at:   closure.startedAt  || new Date().toISOString(),
        ended_at:     new Date().toISOString(),
        total_cash:   closure.methods?.EFECTIVO_USD || closure.totals?.cash || 0,
        total_mobile: closure.methods?.PAGO_MOVIL || closure.totals?.mobile || 0,
        total_bs:     closure.methods?.EFECTIVO_BS || closure.totals?.bs || 0,
        entries:      closure.movements.filter(m => m.type === 'ENTRY').length,
        exits:        closure.movements.filter(m => m.type === 'EXIT').length,
        absences:     closure.absences  || [],
        movements:    closure.movements || [],
        guard_notes:  closure.notes || null
      })
    } catch (e) {
      console.warn('[Sloty] No se pudo subir el cierre a la nube:', e)
    }
  }
}

export const logAudit = async (action, details = {}) => {
  const state = getParkingState();
  if (!state.buildingId) return;

  const auditEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    building_id: state.buildingId,
    action: String(action || 'AUDIT_EVENT'),
    details: details || {},
    performed_by: state.currentUser?.name || state.adminInfo?.name || 'Administrador',
    performed_at: new Date().toISOString()
  };

  // 1. Guardar localmente en state.audit_logs (inalterable en cliente, limitado a 200)
  state.audit_logs = state.audit_logs || [];
  state.audit_logs.unshift(auditEntry);
  if (state.audit_logs.length > 200) {
    state.audit_logs = state.audit_logs.slice(0, 200);
  }
  saveParkingState(state);

  // 2. Encolar en sincronización y enviar solo si building_id es UUID válido
  if (isUUID(state.buildingId)) {
    enqueueSync({
      table: 'audit_log',
      action: 'INSERT',
      data: auditEntry
    });

    // 3. Intento directo en Supabase si hay conexión y credenciales válidas
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine && isSupabaseConfigured()) {
        await supabase.from('audit_log').insert(auditEntry);
      }
    } catch(e) {
      console.warn('[Sloty] audit_log direct insert error (queued via sync):', e);
    }
  }
};

export const logNotification = (type, guard, msg) => {
  const state = getParkingState()
  state.notifications = state.notifications || []
  state.notifications.unshift({
    id: `n-${Date.now()}`,
    type,
    guard,
    msg,
    timestamp: new Date().toISOString(),
    unread: true
  })
  saveParkingState(state)
}

export const markNotificationsRead = () => {
  const state = getParkingState()
  state.notifications?.forEach(n => n.unread = false)
  saveParkingState(state)
}


export const getBuildingPlan = () => {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return s?.plan || 'TRIAL'
  } catch(e) { return 'TRIAL' }
}

export const hasFeature = (featureKey) => {
  return true; // Bypass de plan para modo desarrollo (todas las funciones habilitadas)
}

export const showToast = (message, type = 'info') => {
  // Intentar usar Notificaciones nativas OS (Push) si están permitidas
  if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification('Sloty', {
        body: message,
        icon: '/icons/pwa-192x192.png',
        badge: '/icons/pwa-192x192.png',
        vibrate: type === 'error' ? [200, 100, 200] : [100]
      });
    }).catch(e => renderFallbackToast(message, type));
    return;
  }
  
  renderFallbackToast(message, type);
}

const renderFallbackToast = (message, type) => {
  const existing = document.getElementById('sloty-toast')
  if (existing) existing.remove()
  
  const toast = document.createElement('div')
  toast.id = 'sloty-toast'
  toast.className = 'native-toast'
  
  const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : '🔔')
  
  toast.innerHTML = `
    <div style="font-size:1.2rem;">${icon}</div>
    <div style="flex:1;">
      <div style="font-size:0.65rem; opacity:0.5; text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Sloty</div>
      <div>${message}</div>
    </div>
  `
  document.body.appendChild(toast)
  
  // Triggers the CSS transition
  requestAnimationFrame(() => toast.classList.add('show'))
  
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 400)
  }, 4000)
}

let _bcvCache = null;
try {
  const cached = localStorage.getItem('sloty_bcv_cache');
  if (cached) _bcvCache = JSON.parse(cached);
} catch (e) {}

const BCV_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas

export const getExchangeRate = async () => {
  if (_bcvCache && _bcvCache.cachedAt && (Date.now() - _bcvCache.cachedAt < BCV_CACHE_TTL)) {
    return _bcvCache;
  }

  // Intentamos obtener la tasa desde la API de dolar-vzla o dolarapi
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.promedio && data.promedio > 10) {
        _bcvCache = {
          rate: Number(data.promedio),
          fecha: data.fechaActualizacion ? data.fechaActualizacion.slice(0,10) : new Date().toISOString().slice(0,10),
          source: 'dolarapi',
          cachedAt: Date.now()
        };
        localStorage.setItem('sloty_bcv_cache', JSON.stringify(_bcvCache));
        return _bcvCache;
      }
    }
  } catch(e) {
    console.warn('[Sloty] API BCV principal falló:', e);
  }

  // Backup automático intermedio: dolarvzla API
  try {
    const res = await fetch('https://rates.dolarvzla.com/bcv/current.json', {
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.current?.usd && data.current.usd > 10) {
        _bcvCache = {
          rate: Number(data.current.usd),
          fecha: data.current.date || new Date().toISOString().slice(0,10),
          source: 'dolarvzla',
          cachedAt: Date.now()
        };
        localStorage.setItem('sloty_bcv_cache', JSON.stringify(_bcvCache));
        return _bcvCache;
      }
    }
  } catch(e) {
    console.warn('[Sloty] API BCV de respaldo (dolarvzla) falló:', e);
  }

  // Respaldo secundario: config global de Supabase
  try {
    const { data } = await supabase
      .from('system_config')
      .select('bcv_rate, bcv_fecha, bcv_source')
      .eq('id', 'global')
      .single();

    if (data?.bcv_rate && data.bcv_rate > 10) {
      _bcvCache = {
        rate: data.bcv_rate,
        fecha: data.bcv_fecha,
        source: 'manual_db',
        cachedAt: Date.now()
      };
      localStorage.setItem('sloty_bcv_cache', JSON.stringify(_bcvCache));
      return _bcvCache;
    }
  } catch(e) {
    console.warn('[Sloty] Respaldo system_config falló:', e);
  }

  // Último recurso: usar offline cache si existe, aunque esté vencido
  if (_bcvCache && _bcvCache.rate) {
    return _bcvCache;
  }

  return { rate: 607.39, fecha: new Date().toISOString().slice(0,10), source: 'fallback_hardcoded' };
};

export const invalidateBCVCache = () => {
  _bcvCache = null;
  localStorage.removeItem('sloty_bcv_cache');
};

let globalRealtimeChannel = null;

export const initGlobalRealtime = (buildingId, buildingCode) => {
  if (globalRealtimeChannel) {
    console.log('[Sloty Realtime] Canal Realtime global ya existe, omitiendo.');
    return;
  }
  if (!buildingId || !isUUID(buildingId) || !isSupabaseConfigured()) {
    console.warn('[Sloty Realtime] No se puede inicializar realtime sin buildingId UUID válido o Supabase configurado');
    return;
  }
  console.log('[Sloty Realtime] Iniciando canal global para edificio:', buildingId);
  globalRealtimeChannel = supabase
    .channel('global-sync-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'parking_slots',
      filter: `building_id=eq.${buildingId}`
    }, (payload) => {
      console.log('[Sloty Realtime] Cambios detectados en parking_slots:', payload);
      syncDown(buildingCode).then(() => {
        window.dispatchEvent(new CustomEvent('sloty-sync-downloaded'));
      });
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'personnel',
      filter: `building_id=eq.${buildingId}`
    }, (payload) => {
      console.log('[Sloty Realtime] Cambios detectados en personnel:', payload);
      syncDown(buildingCode).then(() => {
        window.dispatchEvent(new CustomEvent('sloty-sync-downloaded'));
      });
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'access_logs',
      filter: `building_id=eq.${buildingId}`
    }, (payload) => {
      console.log('[Sloty Realtime] Cambios detectados en access_logs:', payload);
      syncDown(buildingCode).then(() => {
        window.dispatchEvent(new CustomEvent('sloty-sync-downloaded'));
      });
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'subscriptions',
      filter: `building_id=eq.${buildingId}`
    }, (payload) => {
      console.log('[Sloty Realtime] Cambios detectados en subscriptions:', payload);
      if (payload.new && payload.new.is_coming) {
        window.dispatchEvent(new CustomEvent('sloty-resident-coming', { detail: payload.new }));
      }
      syncDown(buildingCode).then(() => {
        window.dispatchEvent(new CustomEvent('sloty-subscriptions-updated', { detail: payload.new }));
      });
    })
    .subscribe((status) => {
      console.log('[Sloty Realtime] Estado de suscripción:', status);
    });
};

export const unsubscribeGlobalRealtime = () => {
  if (globalRealtimeChannel) {
    console.log('[Sloty Realtime] Desuscribiendo canal global realtime...');
    try {
      supabase.removeChannel(globalRealtimeChannel);
    } catch (e) {
      console.warn('[Sloty Realtime] Falló removeChannel:', e);
    }
    globalRealtimeChannel = null;
  }
};
