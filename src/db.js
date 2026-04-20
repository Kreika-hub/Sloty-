import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lyieecqqktjroxgokvmg.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5aWVlY3Fxa3Rqcm94Z29rdm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTU2NjQsImV4cCI6MjA5MTkzMTY2NH0.8wcb-S0Q8mG5CdcYwVkcYavKK1l-E1hBX8KS6n8AUpw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// SINGLE SOURCE OF TRUTH - stored in localStorage for persistence across reloads
const STORAGE_KEY = 'sloty_state'

const defaultState = {
  buildingName: "Edificio Las Danielas",
  buildingCode: "DAN-12245", // Unique code for discovery
  location: { city: "Caracas", state: "DC" },
  adminInfo: {
    name: "Administrador Sloty",
    email: "admin@sloty.com",
    registered: true
  },
  personnel: [], // { id, name, pin }
  levels: [],
  movements: [],
  auditLog: [],
  stats: {
    totalSpots: 0,
    occupied: 0,
    dead: 0,
    residents: 0,
    visitors: 0,
    totalCollected: 0, // Sum of all currency values converted or just total items
    totalDebt: 0
  },
  settings: {
    freeHours: 8,
    baseRate: 1,
    extraPerHour: 0,
    customFields: [
      { id: 'torre', label: 'Torre', required: true },
      { id: 'piso', label: 'Piso', required: true },
      { id: 'apto', label: 'Apartamento', required: true }
    ],
    categories: [
      { id:'VISITANTE', label:'Visitante', color:'#F5C518', tag:'V', txt:'#000000' },
      { id:'RESIDENTE', label:'Residente', color:'#e63946', tag:'R', txt:'white'   },
      { id:'MERCADO',   label:'Mercado',   color:'#22c55e', tag:'MK',txt:'white'   },
      { id:'DISCAPAC.', label:'Discap.',   color:'#3b82f6', tag:'D', txt:'white'   },
      { id:'ELECTRICO', label:'Eléctrico', color:'#0ed3cf', tag:'E', txt:'#000000' },
      { id:'MUDANZA',   label:'Mudanza',   color:'#a855f7', tag:'M', txt:'white'   }
    ]
  }
}

const recalcStats = (state) => {
  let total = 0, occupied = 0, debt = 0, residents = 0, visitors = 0
  state.levels.forEach(lvl => {
    lvl.slots.forEach(s => {
      total++
      if (s.status === 'OCCUPIED') {
        occupied++
        if (s.category === 'RESIDENTE') residents++
        else visitors++
      }
      if (s.status === 'DEBT') debt++
    })
    lvl.capacity = lvl.slots.length
  })
  state.stats = {
    ...state.stats,
    totalSpots: total,
    occupied,
    dead: debt
  }
  return state
}

const getCleanPrefix = (name) => {
  let prev = ""
  let n = name || ""
  while (prev !== n) {
    prev = n
    n = n.replace(/^(edificios?|torres?|residencias?|centros?|las?|los?|el|la)\s+/i, '').trim()
  }
  return n.substring(0, 3).toUpperCase().replace(/\s/g, '') || 'SLO'
}

export const getParkingState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const state = JSON.parse(raw)
      
      let migrated = false
      if (!state.settings) {
        state.settings = { 
          freeHours: 8, baseRate: 1, extraPerHour: 0,
          customFields: [
            { id: 'torre', label: 'Torre', required: true },
            { id: 'piso', label: 'Piso', required: true },
            { id: 'apto', label: 'Apartamento', required: true }
          ]
        }
        migrated = true
      }
      if (state.settings && !state.settings.customFields) {
        state.settings.customFields = [
          { id: 'torre', label: 'Torre', required: true },
          { id: 'piso', label: 'Piso', required: true },
          { id: 'apto', label: 'Apartamento', required: true }
        ]
        migrated = true
      }
      if (state.settings && !state.settings.categories) {
        state.settings.categories = [
          { id:'VISITANTE', label:'Visitante', color:'#F5C518', tag:'V', txt:'#000000' },
          { id:'RESIDENTE', label:'Residente', color:'#e63946', tag:'R', txt:'white'   },
          { id:'MERCADO',   label:'Mercado',   color:'#22c55e', tag:'MK',txt:'white'   },
          { id:'DISCAPAC.', label:'Discap.',   color:'#3b82f6', tag:'D', txt:'white'   },
          { id:'ELECTRICO', label:'Eléctrico', color:'#0ed3cf', tag:'E', txt:'#000000' },
          { id:'MUDANZA',   label:'Mudanza',   color:'#a855f7', tag:'M', txt:'white'   }
        ]
        migrated = true
      }
      
      const expectedPrefix = getCleanPrefix(state.buildingName)
      // Auto-migrate if old system was used (e.g. still has EDI- or LAS-)
      if (!state.buildingCode || (!state.buildingCode.startsWith(expectedPrefix + '-') && state.buildingCode.includes('-'))) {
        state.buildingCode = `${expectedPrefix}-${Math.floor(1000 + Math.random() * 9000)}`
        migrated = true
      }
      
      if (migrated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      }
      return state
    }
  } catch(e) {}
  
  // Create a fresh state with a randomized code for new instances
  const newState = JSON.parse(JSON.stringify(defaultState))
  const expectedPrefix = getCleanPrefix(newState.buildingName)
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  newState.buildingCode = `${expectedPrefix}-${randomSuffix}`
  return newState
}

export const saveParkingState = (state) => {
  const updated = recalcStats(state)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

// ALIAS used by admin.js and guard.js
export const updateParkingState = (state) => saveParkingState(state)

export const logMovement = (movement) => {
  const state = getParkingState()
  const entry = {
    ...movement,
    id: `m-${Date.now()}`,
    timestamp: new Date().toISOString()
  }
  state.movements.unshift(entry)
  if (movement.type === 'SALIDA') {
    if (movement.paymentStatus === 'PAGADO') state.stats.totalCollected += 1
    if (movement.paymentStatus === 'DEUDA') state.stats.totalDebt += 1
  }
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

export const resetState = () => {
  localStorage.removeItem(STORAGE_KEY)
}
