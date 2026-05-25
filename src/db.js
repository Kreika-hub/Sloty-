import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const STORAGE_KEY = 'sloty_state'
const SYNC_QUEUE_KEY = 'sloty_sync_queue'

// 1. OFFLINE SYNC QUEUE SYSTEM
const getSyncQueue = () => {
    try {
        const raw = localStorage.getItem(SYNC_QUEUE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch(e) { return [] }
}

const MAX_QUEUE_SIZE = 200

const enqueueSync = (task) => {
    let queue = getSyncQueue()
    queue.push({ _internalId: Date.now() + Math.random(), _retries: 0, ...task })
    // Trim oldest items if queue is too large
    if (queue.length > MAX_QUEUE_SIZE) {
        queue = queue.slice(queue.length - MAX_QUEUE_SIZE)
    }
    try {
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
    } catch (e) {
        // QuotaExceededError - aggressively trim queue and retry
        console.warn('[Sloty] localStorage quota exceeded, trimming sync queue')
        queue = queue.slice(Math.floor(queue.length / 2))
        try {
            localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
        } catch (e2) {
            // Last resort: clear the queue entirely
            localStorage.setItem(SYNC_QUEUE_KEY, '[]')
        }
    }
    triggerSyncUp()
}

const cleanQueue = (idsToRemove) => {
    let queue = getSyncQueue()
    queue = queue.filter(t => !idsToRemove.includes(t._internalId))
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
}

let isSyncing = false
const triggerSyncUp = async () => {
    if (!navigator.onLine || isSyncing) return
    isSyncing = true
    const queue = getSyncQueue()
    if (queue.length === 0) { isSyncing = false; return }

    const removeIds = []
    
    for (const task of queue) {
        try {
            // Sanitize bad personnel data that was queued previously
            if (task.table === 'personnel' && Array.isArray(task.data)) {
                task.data.forEach(item => delete item.active);
                // Remove personnel items with non-UUID ids (old Date.now() format)
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                task.data = task.data.filter(item => uuidRegex.test(item.id));
                if (task.data.length === 0) {
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
            // Track retries — discard tasks that keep failing
            task._retries = (task._retries || 0) + 1
            if (task._retries >= 3) {
                console.warn('[Sloty] Discarding task after 3 failures:', task)
                removeIds.push(task._internalId)
            }
            // Continue processing other tasks instead of breaking
        }
    }
    
    if (removeIds.length > 0) cleanQueue(removeIds)
    isSyncing = false
}

window.addEventListener('online', triggerSyncUp)

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
  settings: {
    freeHours: 8, baseRate: 1, extraPerHour: 0,
    customFields: [ { id: 'torre', label: 'Torre', required: true }, { id: 'apto', label: 'Apartamento', required: true } ],
    categories: [
      { id:'VISITANTE', label:'Visitante', color:'#F5C518', tag:'V', txt:'#000000' },
      { id:'RESIDENTE', label:'Residente', color:'#e63946', tag:'R', txt:'white'   }
    ]
  }
}

const recalcStatsData = (state) => {
  let total = 0, occupied = 0, debt = 0
  if (state.levels) {
    state.levels.forEach(lvl => {
        if (lvl.slots) {
            lvl.slots.forEach(s => {
                total++
                if (s.status === 'OCCUPIED') occupied++
                if (s.status === 'DEBT') debt++
            })
            lvl.capacity = lvl.slots.length
        }
    })
  }
  return { ...state.stats, totalSpots: total, occupied, dead: debt }
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

export const updateBuildingProfile = async (state, newName) => {
  const oldCode = state.buildingCode
  const newCode = `${getCleanPrefix(newName)}-${Math.floor(1000 + Math.random() * 9000)}`
  state.buildingName = newName
  state.buildingCode = newCode

  const { error } = await supabase
    .from('buildings')
    .update({ name: newName, code: newCode })
    .eq('code', oldCode)
    
  saveParkingState(state)
  return { error, newCode }
}

let hasBootedDown = false
export const syncDown = async (buildingCode) => {
    if (!navigator.onLine) return
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
  
  if (state.buildingId) {
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
  const entry = {
    ...movement,
    id: `m-${Date.now()}`,
    timestamp: new Date().toISOString(),
    closed: false
  }
  state.movements.unshift(entry)
  
  if (movement.type === 'SALIDA') {
    if (movement.amount) state.stats.totalCollected += movement.amount
  }
  
  saveParkingState(state)
  
  if (!state.buildingId) { console.warn('[Sloty] logMovement: buildingId missing, skip sync'); return; }
  
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
          onConflict: 'plate', // assuming 'plate' is the unique column
          data: { plate: entry.plate, category: entry.category, last_seen: entry.timestamp }
      })
  }
}

export const saveClosure = (closure) => {
  const state = getParkingState()
  state.closures = state.closures || []
  
  const closedIds = closure.movements.map(m => m.id)
  state.movements.forEach(m => {
    if (closedIds.includes(m.id)) m.closed = true
  })

  state.closures.unshift({
    ...closure,
    id: `c-${Date.now()}`,
    timestamp: new Date().toISOString()
  })
  
  saveParkingState(state)
}

export const logAudit = (action, user = 'ADMIN') => {
  const state = getParkingState()
  state.auditLog = state.auditLog || []
  state.auditLog.unshift({
    action,
    user,
    id: `a-${Date.now()}`,
    timestamp: new Date().toISOString()
  })
  saveParkingState(state)
}

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

export const resetState = () => {
  localStorage.removeItem(STORAGE_KEY)
}

export const getBuildingPlan = () => {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return s?.plan || 'TRIAL'
  } catch(e) { return 'TRIAL' }
}

export const hasFeature = (featureKey) => {
  const plan = getBuildingPlan()
  const PLAN_FEATURES = {
    TRIAL:  ['multi_level'],
    BRONCE: ['multi_level', 'audit_log'],
    PLATA:  ['multi_level', 'audit_log', 'finance_report', 'debt_tracking'],
    ORO:    ['multi_level', 'audit_log', 'finance_report', 'debt_tracking', 
             'frequent_visitors', 'whatsapp_alerts']
  }
  return (PLAN_FEATURES[plan] || PLAN_FEATURES['TRIAL']).includes(featureKey)
}
