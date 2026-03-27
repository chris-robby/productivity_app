import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store';
import { ThemeProvider } from '../contexts/ThemeContext';
import { getUserSettings } from '../services/database/settings';

export default function RootLayout() {
  const router = useRouter();
  const isDemoMode = useAppStore((state) => state.isDemoMode);
  const setTheme = useAppStore((state) => state.setTheme);

  useEffect(() => {
    if (isDemoMode) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session && !useAppStore.getState().isDemoMode) {
        router.replace('/auth/login');
        return;
      }
      if (session) {
        const settings = await getUserSettings();
        const savedTheme = settings?.theme;
        setTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session && !useAppStore.getState().isDemoMode) {
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
  }, [isDemoMode]);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="goal-setup" />
        <Stack.Screen name="conversation" />
        <Stack.Screen name="roadmap-preview" />
        <Stack.Screen name="goal-overview" />
        <Stack.Screen name="goal-detail" />
        <Stack.Screen name="journey" />
      </Stack>
    </ThemeProvider>
  );
}
