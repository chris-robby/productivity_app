import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useState } from 'react';
import { useAppStore } from '../store';

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [hasAuth, setHasAuth] = useState(false);
  const [hasGoal, setHasGoal] = useState(false);
  const isDemoMode = useAppStore((state) => state.isDemoMode);

  if (isDemoMode) {
    return <Redirect href="/(tabs)" />;
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setHasAuth(false);
        setLoading(false);
        return;
      }

      setHasAuth(true);

      // Check if user has an active goal
      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('status', 'active')
        .limit(1);

      setHasGoal(goals && goals.length > 0);
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!hasAuth) {
    return <Redirect href="/auth/login" />;
  }

  if (!hasGoal) {
    return <Redirect href="/goal-setup" />;
  }

  return <Redirect href="/(tabs)" />;
}
