import { supabase } from './db.js'

let currentDevRole = 'MASTER'

export function setDevRole(role) {
  currentDevRole = role
}

// MODO DESARROLLO: Permite entrar con cualquier dato
export async function login(email, password) {
  console.log('Modo Desarrollo: Login bypass para', email, 'con rol', currentDevRole)
  return { user: { id: 'dev-user-id', email } }
}

export async function logout() {
  console.log('Modo Desarrollo: Logout')
}

export async function getSession() {
  return null 
}

export async function getUserRole(userId) {
  return { role: currentDevRole, building_id: 'dev-building-id' }
}
