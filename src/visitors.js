import { supabase } from './db.js'

const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const getBuildingId = () => {
  const keys = [
    localStorage.getItem('sloty_building_id'),
    localStorage.getItem('sloty_active_building'),
    (() => {
      try {
        const s = JSON.parse(localStorage.getItem('sloty_state'))
        return s?.buildingId || null
      } catch(e) { return null }
    })(),
    (() => {
      try {
        const s = JSON.parse(localStorage.getItem('sloty_parking_state'))
        return s?.buildingId || null
      } catch(e) { return null }
    })()
  ];
  return keys.find(k => k && typeof k === 'string' && isUUID(k)) || null;
}

// Buscar visitante localmente en el estado guardado (puestos y movimientos offline)
export const searchLocalVisitorByPlate = (plate) => {
  if (!plate) return []
  const plateUpper = plate.toUpperCase()
  const results = []
  const addedPlates = new Set()

  let state = null
  try {
    const raw = localStorage.getItem('sloty_parking_state') || localStorage.getItem('sloty_state')
    if (raw) state = JSON.parse(raw)
  } catch(e) {
    console.error('searchLocalVisitorByPlate parsing error:', e)
  }

  if (!state) return []

  // 1. Buscar en puestos de estacionamiento activos (ocupados)
  if (state.levels) {
    state.levels.forEach(level => {
      if (level.slots) {
        level.slots.forEach(slot => {
          if (slot.plate && slot.plate.toUpperCase().includes(plateUpper)) {
            const p = slot.plate.toUpperCase()
            if (!addedPlates.has(p)) {
              addedPlates.add(p)
              results.push({
                visitor_id: `offline-slot-${p}`,
                plate: p,
                name: slot.metadata?.nombre || slot.plate,
                company: '',
                category: slot.category || 'VISITANTE',
                phone: slot.phone || '',
                visits_to: slot.metadata?.apto || '',
                r_visits_to: slot.metadata?.apto || '',
                visit_count: 1
              })
            }
          }
        })
      }
    })
  }

  // 2. Buscar en el historial reciente de movimientos en el estado local
  if (state.movements) {
    state.movements.forEach(m => {
      if (m.plate && m.plate.toUpperCase().includes(plateUpper)) {
        const p = m.plate.toUpperCase()
        if (!addedPlates.has(p)) {
          addedPlates.add(p)
          results.push({
            visitor_id: `offline-mov-${m.id || Date.now()}`,
            plate: p,
            name: (m.metadata && (m.metadata.nombre || m.metadata.full_name)) || m.plate,
            company: '',
            category: m.category || 'VISITANTE',
            phone: m.phone || '',
            visits_to: (m.metadata && (m.metadata.apto || m.metadata.visits_to)) || '',
            r_visits_to: (m.metadata && (m.metadata.apto || m.metadata.visits_to)) || '',
            visit_count: 1
          })
        }
      }
    })
  }

  return results
}

// Buscar visitante por placa (autocomplete)
export const searchVisitorByPlate = async (plate) => {
  if (!plate || plate.length < 2) return []

  // Si no hay red, ir directo al respaldo local
  if (!navigator.onLine) {
    return searchLocalVisitorByPlate(plate)
  }

  const buildingId = getBuildingId()
  if (!buildingId) return []

  try {
    const { data, error } = await supabase
      .rpc('search_visitor_by_plate', {
        search_plate: plate.toUpperCase(),
        search_building: buildingId
      })
    if (error) { 
      console.error('searchVisitorByPlate RPC error, falling back local:', error)
      return searchLocalVisitorByPlate(plate) 
    }
    return data || []
  } catch (err) {
    console.error('searchVisitorByPlate exception, falling back local:', err)
    return searchLocalVisitorByPlate(plate)
  }
}

// Guardar o actualizar visitante + placa
export const saveVisitor = async ({ full_name, phone, visits_to, notes, plate, vehicle_desc }) => {
  const building_id = getBuildingId()

  // Buscar si ya existe un visitante con esa placa
  const existing = await searchVisitorByPlate(plate)
  let visitor_id = existing?.[0]?.visitor_id || null

  if (!visitor_id) {
    // Crear visitante nuevo
    const { data, error } = await supabase
      .from('visitors')
      .insert({ building_id, full_name, phone, visits_to, notes })
      .select('id')
      .single()
    if (error) { console.error('saveVisitor insert:', error); return null }
    visitor_id = data.id

    // Crear la placa
    await supabase.from('visitor_plates').insert({ visitor_id, plate: plate.toUpperCase(), vehicle_desc })
  } else {
    // Actualizar datos del visitante existente
    await supabase.from('visitors')
      .update({ full_name, phone, visits_to, notes, updated_at: new Date().toISOString() })
      .eq('id', visitor_id)

    // Verificar si esta placa ya está registrada
    const { data: plates } = await supabase
      .from('visitor_plates')
      .select('id')
      .eq('visitor_id', visitor_id)
      .eq('plate', plate.toUpperCase())

    // Si es una placa nueva para este visitante, agregarla
    if (!plates || plates.length === 0) {
      await supabase.from('visitor_plates').insert({ visitor_id, plate: plate.toUpperCase(), vehicle_desc })
    }
  }

  return visitor_id
}

// Registrar entrada en access_logs
export const logAccess = async ({ visitor_id, guard_name, full_name, plate, visits_to, notes, type = 'entry' }) => {
  const building_id = getBuildingId()
  const { error } = await supabase.from('access_logs').insert({
    building_id,
    visitor_id,
    guard_name,
    full_name,
    plate: plate.toUpperCase(),
    visits_to,
    notes,
    type
  })
  if (error) console.error('logAccess:', error)
}
