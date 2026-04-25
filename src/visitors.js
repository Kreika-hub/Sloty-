import { supabase } from './db.js'

const getBuildingId = () => localStorage.getItem('sloty_active_building') || 'DAN-12245'

// Buscar visitante por placa (autocomplete)
export const searchVisitorByPlate = async (plate) => {
  if (!plate || plate.length < 2) return []
  const { data, error } = await supabase
    .rpc('search_visitor_by_plate', {
      search_plate: plate.toUpperCase(),
      search_building: getBuildingId()
    })
  if (error) { console.error('searchVisitorByPlate:', error); return [] }
  return data || []
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
