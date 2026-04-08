import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '../../store';
import { useTheme } from '../../contexts/ThemeContext';
import { ColorPalette } from '../../constants/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setDemoMode = useAppStore((state) => state.setDemoMode);
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  async function handleDemo() {
    await supabase.auth.signOut();
    setDemoMode(true);
    router.replace('/(tabs)');
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { data: goals } = await supabase
        .from('goals')
        .select('*')
        .eq('status', 'active')
        .limit(1);

      if (goals && goals.length > 0) {
        router.replace('/(tabs)');
      } else {
        router.replace('/goal-setup');
      }
    } catch (error: any) {
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style={colors.statusBar} />

      <View style={styles.content}>
        <Text style={styles.title}>GoalAchiever</Text>
        <Text style={styles.subtitle}>AI-Powered Goal Success</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.placeholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/auth/signup')}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>
              Don't have an account? Sign Up
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDemo}
            style={styles.demoButton}
          >
            <Text style={styles.demoText}>Try Demo (no account needed)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      padding: 20,
    },
    title: {
      fontSize: 36,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 48,
      textAlign: 'center',
    },
    form: {
      gap: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
    button: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: colors.textOnPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    linkButton: {
      padding: 8,
      alignItems: 'center',
    },
    linkText: {
      color: colors.primary,
      fontSize: 14,
    },
    demoButton: {
      padding: 8,
      alignItems: 'center',
      marginTop: 8,
    },
    demoText: {
      color: colors.textSecondary,
      fontSize: 14,
      textDecorationLine: 'underline',
    },
  });
}
