import { supabase, unsubscribeGlobalRealtime } from './db.js'

let currentDevRole = localStorage.getItem('sloty_role') || 'MASTER'

export function setDevRole(role) {
  currentDevRole = role
  localStorage.setItem('sloty_role', role)
}

// MODO DESARROLLO: Permite entrar con cualquier dato
export async function login(email, password) {
  console.log('Modo Desarrollo: Login bypass para', email, 'con rol', currentDevRole)
  const session = { user: { id: email === 'master' || email === 'nucita' ? 'dev-master-id' : 'dev-admin-id', email } }
  localStorage.setItem('sloty_session', JSON.stringify(session))
  return session
}

export async function logout() {
  console.log('Centralized Logout: Cleaning all sloty state')
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
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export async function getUserRole(userId) {
  const role = localStorage.getItem('sloty_role') || currentDevRole
  const buildingId = localStorage.getItem('sloty_building_id') || 'dev-building-id'
  return { role, building_id: buildingId }
}
