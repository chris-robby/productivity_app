import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store';
import { useTheme } from '../../contexts/ThemeContext';
import { ColorPalette } from '../../constants/colors';
import { updateUserSettings } from '../../services/database/settings';

export default function SettingsScreen() {
  const [email, setEmail] = useState('');
  const router = useRouter();
  const isDemoMode = useAppStore((state) => state.isDemoMode);
  const { colors, theme, setTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    if (!isDemoMode) {
      loadUserData();
    }
  }, [isDemoMode]);

  async function loadUserData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || '');
    }
  }

  async function handleToggleTheme() {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (!isDemoMode) {
      try {
        await updateUserSettings({ theme: newTheme });
      } catch {
        // non-critical
      }
    }
  }

  async function handleLogout() {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/auth/login');
          },
        },
      ]
    );
  }

  async function handleResetGoal() {
    Alert.alert(
      'Reset Goal',
      'This will archive your current goal and let you set a new one. Your progress will be saved but the goal will become inactive. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: goals } = await supabase
                .from('goals')
                .select('id')
                .eq('status', 'active');

              if (goals && goals.length > 0) {
                await supabase
                  .from('goals')
                  .update({ status: 'abandoned' })
                  .eq('id', goals[0].id);
              }

              router.replace('/goal-setup');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset goal');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ General</Text>

          <TouchableOpacity style={styles.settingCard} onPress={handleToggleTheme}>
            <Text style={styles.settingLabel}>Theme</Text>
            <Text style={styles.settingValue}>{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</Text>
          </TouchableOpacity>

          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Text style={styles.settingValue}>Enabled</Text>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>AI Features</Text>
            <Text style={styles.settingValue}>Enabled</Text>
          </View>
        </View>

        {!isDemoMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Account</Text>

            <View style={styles.settingCard}>
              <Text style={styles.settingLabel}>Email</Text>
              <Text style={styles.settingValue} numberOfLines={1}>{email}</Text>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleResetGoal}
            >
              <Text style={styles.actionButtonText}>🔄 Set New Goal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.logoutButton]}
              onPress={handleLogout}
            >
              <Text style={[styles.actionButtonText, styles.logoutButtonText]}>
                🚪 Logout
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ About</Text>

          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>Version</Text>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              GoalAchiever uses AI to help you create and follow personalized
              roadmaps to achieve your goals. The AI learns from your progress
              and adjusts your plan to maximize success.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 AI Provider</Text>

          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>Current Provider</Text>
            <Text style={styles.settingValue}>Google Gemini (Free)</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.surface,
      padding: 20,
      paddingTop: 60,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    section: {
      marginTop: 24,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    settingCard: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 8,
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    settingLabel: {
      fontSize: 15,
      color: colors.text,
    },
    settingValue: {
      fontSize: 15,
      color: colors.textSecondary,
      maxWidth: '60%',
    },
    actionButton: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 8,
      marginBottom: 8,
      alignItems: 'center',
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    logoutButton: {
      backgroundColor: 'rgba(224,92,92,0.1)',
    },
    logoutButtonText: {
      color: colors.error,
    },
    infoBox: {
      backgroundColor: colors.surfaceElevated,
      padding: 16,
      borderRadius: 8,
      marginTop: 8,
      marginBottom: 16,
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
}
