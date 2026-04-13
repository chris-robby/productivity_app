import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store';
import { useTierStore } from '../store/tierStore';
import { ThemeProvider } from '../contexts/ThemeContext';
import { getUserSettings } from '../services/database/settings';
import { initLocalDb, getActiveGoal, loadThemeLocally } from '../services/database/adapter';

export default function RootLayout() {
  const router = useRouter();
  const setTheme = useAppStore((state) => state.setTheme);
  const hydrateTier = useTierStore((s) => s.hydrate);
  const tierHydrated = useTierStore((s) => s.hydrated);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    async function init() {
      await hydrateTier();
      const tier = useTierStore.getState().tier;

      // Fresh install or new device — show login so existing users can sign in
      if (tier === null) {
        router.replace('/auth/login');
        return;
      }

      if (tier === 'free') {
        // Free users: init SQLite, restore theme from AsyncStorage, route by goal state
        initLocalDb();
        const savedTheme = await loadThemeLocally();
        if (savedTheme) setTheme(savedTheme);
        const goal = await getActiveGoal();
        router.replace(goal ? '/(tabs)' : '/goal-setup');
        return;
      }

      // Premium — check existing Supabase session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace('/auth/login');
          return;
        }
        try {
          const settings = await getUserSettings();
          const savedTheme = settings?.theme;
          setTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark');
        } catch {
          // Theme is non-critical — keep default if settings fail to load
        }
        router.replace('/(tabs)');
      } catch {
        router.replace('/auth/login');
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!tierHydrated || useTierStore.getState().tier !== 'premium') return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          router.replace('/auth/login');
          return;
        }
        if (session) {
          const settings = await getUserSettings();
          const savedTheme = settings?.theme;
          setTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [tierHydrated]);

  if (!fontsLoaded || !tierHydrated) {
    return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />;
  }

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="goal-setup" />
        <Stack.Screen name="conversation" />
        <Stack.Screen name="habit-setup" />
        <Stack.Screen name="roadmap-preview" />
        <Stack.Screen name="goal-overview" />
        <Stack.Screen name="goal-detail" />
        <Stack.Screen name="journey" />
        <Stack.Screen name="journey-preview" />
        <Stack.Screen name="upgrade" />
      </Stack>
    </ThemeProvider>
  );
}
