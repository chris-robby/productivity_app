import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TIER_KEY = 'app_tier';

/**
 * null  = fresh install / new device — user hasn't chosen yet → show login screen
 * free  = user explicitly chose the free path
 * premium = user signed in with Supabase
 */
type Tier = 'free' | 'premium' | null;

interface TierStore {
  tier: Tier;
  hydrated: boolean;
  setTier: (tier: 'free' | 'premium') => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useTierStore = create<TierStore>((set) => ({
  tier: null,
  hydrated: false,

  setTier: async (tier) => {
    await AsyncStorage.setItem(TIER_KEY, tier);
    set({ tier });
  },

  hydrate: async () => {
    const stored = await AsyncStorage.getItem(TIER_KEY);
    const tier: Tier =
      stored === 'premium' ? 'premium' :
      stored === 'free'    ? 'free'    :
      null;
    set({ tier, hydrated: true });
  },
}));

/** Convenience hook — returns booleans so call sites read cleanly */
export function useTier() {
  const tier = useTierStore((s) => s.tier);
  return {
    tier,
    isPremium: tier === 'premium',
    isFree: tier === 'free',
  };
}
