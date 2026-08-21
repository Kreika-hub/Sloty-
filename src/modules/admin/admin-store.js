/**
 * Admin Store — Shared mutable state for admin modules
 * Extracted from admin.js closure (Phase C refactor)
 * 
 * This module replaces the closure-scoped variables that were previously
 * shared between all functions inside initAdmin(). Any module that needs
 * to read or write cache/state data imports `store` from here.
 */
import { supabase, isUUID } from '../../db.js'

// ─── SHARED MUTABLE STATE ─────────────────────────────────────
export const store = {
  // Cache: Home metrics
  cachedMetrics: null,
  metricsLoading: false,
  currentBcv: (() => {
    try {
      const cached = localStorage.getItem('sloty_bcv_cache')
      return cached ? JSON.parse(cached) : { rate: 40.0, source: 'fallback_static', fecha: new Date().toISOString().slice(0, 10) }
    } catch (e) {
      return { rate: 40.0, source: 'fallback_static', fecha: new Date().toISOString().slice(0, 10) }
    }
  })(),

  // Cache: Subscriptions
  cachedSubs: null,
  cachedSubsAt: 0,
  SUBS_TTL: 30_000,

  // Cache: Finance
  cachedFinance: null,
  cachedFinanceAt: 0,
  FINANCE_TTL: 60_000,

  // Realtime channel reference
  financeChannel: null,

  // Tenant SaaS & Feature Flags
  features: null,
  membershipStatus: 'ACTIVE',
  billingDueDate: null,

  // Cache: Expenses
  cachedExpenses: null,
  cachedExpensesAt: 0,
  EXPENSES_TTL: 60_000,

  // UI state variables shared across modules
  editingResident: null,
  pendingAction: null,
  editingGuard: null,
  editingLevel: null,
  openPaletteLevel: null,
  activeTab: 'HOME',
  activeSettingsMenu: 'MAIN',
  reportFilter: 'HOY',
}

// ─── FEATURE FLAGS EVALUATOR ──────────────────────────────────
export const hasFeature = (featureKey) => {
  if (!store.features) return true;
  return store.features[featureKey] !== false;
};

// ─── SUBSCRIPTIONS CACHE ──────────────────────────────────────
export const getSubsCached = async (buildingId) => {
  if (store.cachedSubs && Date.now() - store.cachedSubsAt < store.SUBS_TTL) return store.cachedSubs;
  let subsResData = [];
  let bldResData = null;
  if (!buildingId || !isUUID(buildingId)) {
    store.cachedSubs = { subs: [], bld: null };
    store.cachedSubsAt = Date.now();
    return store.cachedSubs;
  }
  try {
    const [subsRes, bldRes] = await Promise.all([
      supabase.from('subscriptions')
        .select('id,resident_name,plate,expiry_date,custom_price,tower,apt,phone,is_coming,slots_count,status')
        .eq('building_id', buildingId)
        .order('created_at', { ascending: false }),
      supabase.from('buildings')
        .select('monthly_rate,monthly_slots_limit,features,membership_status,membership_expiry,plan')
        .eq('id', buildingId).single()
    ]);
    subsResData = subsRes?.data || [];
    bldResData = bldRes?.data || null;
    if (bldResData) {
      if (bldResData.features) store.features = bldResData.features;
      if (bldResData.membership_status) store.membershipStatus = bldResData.membership_status;
      if (bldResData.membership_expiry) store.billingDueDate = bldResData.membership_expiry;
    }
  } catch (e) {
    console.warn('[Sloty] Error fetching subscriptions or building plan:', e);
  }
  store.cachedSubs = { subs: subsResData, bld: bldResData };
  store.cachedSubsAt = Date.now();
  return store.cachedSubs;
};

// ─── FINANCE REALTIME CHANNEL ─────────────────────────────────
export const subscribeFinanceRealtime = (buildingId) => {
  if (store.financeChannel || !buildingId || !isUUID(buildingId)) return; // ya suscrito o ID inválido
  store.financeChannel = supabase
    .channel('finance-payments')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'payments',
      filter: `building_id=eq.${buildingId}`
    }, () => {
      store.cachedFinance = null; // invalida cache
      store.cachedSubsAt = 0;     // invalida subs también
    })
    .subscribe();
};

export const unsubscribeFinanceRealtime = () => {
  if (store.financeChannel) {
    supabase.removeChannel(store.financeChannel);
    store.financeChannel = null;
  }
};

// ─── EXPENSES CACHE ───────────────────────────────────────────
export const getExpensesCached = async (buildingId) => {
  if (store.cachedExpenses && (Date.now() - store.cachedExpensesAt < store.EXPENSES_TTL)) {
    return store.cachedExpenses;
  }
  let expenses = [];
  try {
    const { data } = await supabase
      .from('building_expenses')
      .select('id, category, description, amount_usd, amount_bs, bcv_rate_used, payment_method, expense_date, created_at')
      .eq('building_id', buildingId)
      .order('expense_date', { ascending: false })
      .limit(100);
    expenses = data || [];
  } catch (e) {
    console.warn('[Sloty] Error fetching building expenses from DB, fallback to local state:', e);
    const s = JSON.parse(localStorage.getItem('sloty_state') || '{}');
    expenses = s.expenses || [];
  }
  store.cachedExpenses = expenses;
  store.cachedExpensesAt = Date.now();
  return store.cachedExpenses;
};

export const invalidateExpensesCache = () => {
  store.cachedExpenses = null;
  store.cachedExpensesAt = 0;
};
