import { supabase, unsubscribeGlobalRealtime } from './db.js'

let currentDevRole = localStorage.getItem('sloty_role') || 'MASTER'

export function setDevRole(role) {
  currentDevRole = role
  localStorage.setItem('sloty_role', role)
}

// AUTENTICACIÓN REAL CON SUPABASE AUTH
export async function login(email, password) {
  // Manejo de mock / bypass dev si se pasa correo de prueba especial (SOLO en desarrollo local)
  if (import.meta.env.DEV && (email === 'master' || email === 'nucita' || email === 'admin@test.com' || email === 'nucita.admin')) {
    const role = (email === 'master' || email === 'nucita') ? 'MASTER' : 'ADMIN'
    const session = { user: { id: role === 'MASTER' ? 'dev-master-id' : 'dev-admin-id', email } }
    localStorage.setItem('sloty_session', JSON.stringify(session))
    localStorage.setItem('sloty_role', role)
    return { session, user: session.user, role }
  }

  // 1. Supabase Auth real
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: error.message || 'Error de autenticación' }
  }
  if (!data?.user) {
    return { error: 'No se pudo obtener el usuario autenticado' }
  }

  // 2. Consultar perfil en tabla profiles
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileErr) {
    console.error('[Sloty Auth] Error consultando profiles:', profileErr)
    await supabase.auth.signOut()
    return { error: 'Error al verificar perfil de usuario' }
  }

  if (!profile || !profile.role) {
    await supabase.auth.signOut()
    return { error: 'Tu cuenta no tiene un rol asignado, contacta al administrador' }
  }

  const role = profile.role.toUpperCase()
  const buildingId = profile.building_id || null

  const session = {
    user: data.user,
    role,
    building_id: buildingId
  }

  localStorage.setItem('sloty_session', JSON.stringify(session))
  localStorage.setItem('sloty_role', role)
  if (buildingId) {
    localStorage.setItem('sloty_building_id', buildingId)
  } else {
    localStorage.removeItem('sloty_building_id')
  }

  return { session, user: data.user, role, building_id: buildingId }
}

export async function logout() {
  console.log('Centralized Logout: Cleaning all sloty state and signing out')
  try {
    await supabase.auth.signOut()
  } catch (e) {
    console.warn('[Sloty Auth] Error during signOut:', e)
  }
  try {
    unsubscribeGlobalRealtime()
  } catch (e) {
    console.warn('[Sloty] Failed to unsubscribe global realtime:', e)
  }
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('sloty_')) {
      localStorage.removeItem(key)
    }
  })
}

window.slotyLogout = () => {
  logout().then(() => {
    location.reload()
  }).catch((e) => {
    console.error('Logout error:', e)
    localStorage.clear()
    location.reload()
  })
}

export async function getSession() {
  try {
    const raw = localStorage.getItem('sloty_session')
    const localSession = raw ? JSON.parse(raw) : null
    if (import.meta.env.DEV && (localSession?.user?.id === 'dev-master-id' || localSession?.user?.id === 'dev-admin-id')) {
      return localSession
    }

    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) {
      localStorage.removeItem('sloty_session')
      localStorage.removeItem('sloty_role')
      localStorage.removeItem('sloty_building_id')
      return null
    }

    return localSession || { user: session.user }
  } catch (e) {
    return null
  }
}

export async function getUserRole(userId) {
  const role = localStorage.getItem('sloty_role') || currentDevRole
  const buildingId = localStorage.getItem('sloty_building_id') || 'dev-building-id'
  return { role, building_id: buildingId }
}
