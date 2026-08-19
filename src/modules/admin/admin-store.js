/**
 * Admin Store — Shared mutable state for admin modules
 * Extracted from admin.js closure (Phase C refactor)
 * 
 * This module replaces the closure-scoped variables that were previously
 * shared between all functions inside initAdmin(). Any module that needs
 * to read or write cache/state data imports `store` from here.
 */
import { supabase } from '../../db.js'

// ─── SHARED MUTABLE STATE ─────────────────────────────────────
export const store = {
  // Cache: Home metrics
  cachedMetrics: null,
  metricsLoading: false,
  currentBcv: null,

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
}

// ─── SUBSCRIPTIONS CACHE ──────────────────────────────────────
export const getSubsCached = async (buildingId) => {
  if (store.cachedSubs && Date.now() - store.cachedSubsAt < store.SUBS_TTL) return store.cachedSubs;
  let subsResData = [];
  let bldResData = null;
  try {
    const [subsRes, bldRes] = await Promise.all([
      supabase.from('subscriptions')
        .select('id,resident_name,plate,expiry_date,custom_price,tower,apt,phone,is_coming,slots_count,status')
        .eq('building_id', buildingId)
        .order('created_at', { ascending: false }),
      supabase.from('buildings')
        .select('monthly_rate,monthly_slots_limit')
        .eq('id', buildingId).single()
    ]);
    subsResData = subsRes?.data || [];
    bldResData = bldRes?.data || null;
  } catch (e) {
    console.warn('[Sloty] Error fetching subscriptions or building plan:', e);
  }
  store.cachedSubs = { subs: subsResData, bld: bldResData };
  store.cachedSubsAt = Date.now();
  return store.cachedSubs;
};

// ─── FINANCE REALTIME CHANNEL ─────────────────────────────────
export const subscribeFinanceRealtime = (buildingId) => {
  if (store.financeChannel) return; // ya suscrito
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
