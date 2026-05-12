import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lyieecqqktjroxgokvmg.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5aWVlY3Fxa3Rqcm94Z29rdm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTU2NjQsImV4cCI6MjA5MTkzMTY2NH0.8wcb-S0Q8mG5CdcYwVkcYavKK1l-E1hBX8KS6n8AUpw'

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

const enqueueSync = (task) => {
    const queue = getSyncQueue()
    queue.push({ _internalId: Date.now() + Math.random(), ...task })
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
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

    const successIds = []
    
    for (const task of queue) {
        try {
            if (task.action === 'INSERT') {
                const { error } = await supabase.from(task.table).insert(task.data)
                if (error) throw error
            }
            if (task.action === 'UPSERT') {
                const options = task.onConflict ? { onConflict: task.onConflict } : {}
                const { error } = await supabase.from(task.table).upsert(task.data, options)
                if (error) throw error
            }
            successIds.push(task._internalId)
        } catch (e) {
            console.error('[Sloty Sync Error]:', e, 'Task:', task)
            break 
        }
    }
    
    if (successIds.length > 0) cleanQueue(successIds)
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
const syncDown = async (buildingCode) => {
    if (!navigator.onLine || hasBootedDown) return
    hasBootedDown = true
    
    try {
        const { data: bData } = await supabase.from('buildings').select('*').eq('code', buildingCode).single()
        if (!bData) return
        const buildingId = bData.id

        const [ { data: sData }, { data: aData }, { data: pData } ] = await Promise.all([
            supabase.from('parking_slots').select('*').eq('building_id', buildingId),
            supabase.from('access_logs').select('*').eq('building_id', buildingId).limit(200).order('timestamp', { ascending: false }),
            supabase.from('personnel').select('*').eq('building_id', buildingId)
        ])

        const state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
        state.buildingId = buildingId 
        
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
            // We want to merge smoothly without destroying the frontend order, but overwriting is safer
            state.levels = Object.values(levelMap)
        }

        if (aData) {
           const existingIds = new Set((state.movements || []).map(m => m.id))
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
           
           mappedLogs.forEach(l => {
              if (!existingIds.has(l.id)) {
                 if (!state.movements) state.movements = []
                 state.movements.unshift(l) 
              }
           })
           // sort desc
           state.movements.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
        }

        state.stats = recalcStatsData(state)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
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
         const pPayload = state.personnel.map(p => ({
             id: p.id,
             building_id: state.buildingId,
             name: p.name,
             pin: p.pin,
             phone: p.phone,
             shift: p.shift,
             photo: p.photo,
             status: p.status
         }))
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
  
  enqueueSync({
      table: 'access_logs',
      action: 'INSERT',
      data: {
          id: entry.id,
          building_id: state.buildingId || state.buildingCode, 
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
