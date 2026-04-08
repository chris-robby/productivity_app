import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store';
import { useTheme } from '../../contexts/ThemeContext';
import { ColorPalette } from '../../constants/colors';
import { updateUserSettings } from '../../services/database/settings';

interface ActiveGoal {
  id: string;
  goal_text: string;
  total_tasks: number;
  completed_tasks: number;
  target_date: string;
  user_context?: string;
}

interface RecentTask {
  task_title: string;
  completed_at: string | null;
}

export default function ProfileScreen() {
  const [email, setEmail] = useState('');
  const [goal, setGoal] = useState<ActiveGoal | null>(null);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [editingContext, setEditingContext] = useState(false);
  const [contextValue, setContextValue] = useState('');
  const [savingContext, setSavingContext] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDemoMode = useAppStore((state) => state.isDemoMode);
  const { colors, theme, setTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  useFocusEffect(
    useCallback(() => {
      if (!isDemoMode) loadData();
    }, [isDemoMode])
  );

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setEmail(user.email || '');

    const { data: goalData } = await supabase
      .from('goals')
      .select('id, goal_text, total_tasks, completed_tasks, target_date, user_context')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (goalData) {
      setGoal(goalData);
      setContextValue(goalData.user_context || '');

      const { data: tasks } = await supabase
        .from('daily_tasks')
        .select('task_title, completed_at')
        .eq('goal_id', goalData.id)
        .eq('completed', true)
        .order('completed_at', { ascending: false })
        .limit(5);
      setRecentTasks(tasks || []);
    }
  }

  async function handleSaveContext() {
    if (!goal) return;
    setSavingContext(true);
    await supabase.from('goals').update({ user_context: contextValue }).eq('id', goal.id);
    setGoal((g) => g ? { ...g, user_context: contextValue } : g);
    setSavingContext(false);
    setEditingContext(false);
  }

  async function handleToggleTheme() {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (!isDemoMode) {
      try { await updateUserSettings({ theme: newTheme }); } catch (error) {
        console.error('Failed to save theme preference:', error);
      }
    }
  }

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth/login');
        },
      },
    ]);
  }

  async function handleSetNewGoal() {
    Alert.alert(
      'Set New Goal',
      'Your current goal will be archived. Your progress is saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue', style: 'destructive', onPress: async () => {
            if (goal) {
              await supabase.from('goals').update({ status: 'abandoned' }).eq('id', goal.id);
            }
            router.replace('/goal-setup');
          },
        },
      ]
    );
  }

  const initials = email ? email[0].toUpperCase() : '?';
  const total = goal?.total_tasks ?? 0;
  const done = goal?.completed_tasks ?? 0;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const daysLeft = goal
    ? Math.max(0, Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={colors.statusBar} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar ─────────────────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.emailText}>{email || 'Demo User'}</Text>
        </View>

        {/* ── Goal progress ───────────────────────────────────────────────── */}
        {goal ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CURRENT GOAL</Text>
            <Text style={styles.goalText} numberOfLines={2}>{goal.goal_text}</Text>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
            </View>

            <View style={styles.progressMeta}>
              <Text style={styles.progressPct}>{progressPct}% complete</Text>
              <Text style={styles.daysLeft}>{daysLeft}d left</Text>
            </View>
            <Text style={styles.taskCount}>{done} / {total} tasks done</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CURRENT GOAL</Text>
            <Text style={styles.emptyText}>No active goal. Set one to get started.</Text>
            <TouchableOpacity style={styles.setGoalBtn} onPress={() => router.push('/goal-setup')}>
              <Text style={styles.setGoalBtnText}>Set a Goal</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── About You ───────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>ABOUT YOU</Text>
            {!editingContext && (
              <TouchableOpacity onPress={() => setEditingContext(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {editingContext ? (
            <>
              <TextInput
                style={styles.contextInput}
                value={contextValue}
                onChangeText={setContextValue}
                multiline
                placeholder="Tell the AI about yourself — your schedule, experience, constraints..."
                placeholderTextColor={colors.placeholder}
                autoFocus
              />
              <View style={styles.contextActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setContextValue(goal?.user_context || '');
                    setEditingContext(false);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveContext} disabled={savingContext}>
                  <Text style={styles.saveBtnText}>{savingContext ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.contextText}>
              {contextValue
                ? contextValue
                : 'Add context about yourself — this helps the AI give you more relevant suggestions.'}
            </Text>
          )}
        </View>

        {/* ── Recent wins ─────────────────────────────────────────────────── */}
        {recentTasks.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>RECENT WINS</Text>
            {recentTasks.map((t, i) => (
              <View key={i} style={styles.winRow}>
                <View style={styles.winDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.winTitle}>{t.task_title}</Text>
                  {t.completed_at && (
                    <Text style={styles.winDate}>
                      {new Date(t.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Settings ────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>SETTINGS</Text>

          <TouchableOpacity style={styles.settingRow} onPress={handleToggleTheme}>
            <Ionicons name={theme === 'dark' ? 'moon-outline' : 'sunny-outline'} size={18} color={colors.textSecondary} />
            <Text style={styles.settingRowLabel}>Theme</Text>
            <Text style={styles.settingRowValue}>{theme === 'dark' ? 'Dark' : 'Light'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingRow} onPress={handleSetNewGoal}>
            <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.settingRowLabel}>Set New Goal</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.border} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingRow, styles.logoutRow]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={[styles.settingRowLabel, styles.logoutLabel]}>Logout</Text>
          </TouchableOpacity>
        </View>
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
    scroll: { flex: 1 },
    scrollInner: { paddingHorizontal: 20 },

    // ── Avatar ───────────────────────────────────────────────────────────────
    avatarSection: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatarText: {
      fontSize: 30,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    emailText: {
      fontSize: 15,
      color: colors.textSecondary,
    },

    // ── Card ─────────────────────────────────────────────────────────────────
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
    },
    cardLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 1.2,
      marginBottom: 10,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },

    // ── Goal progress ────────────────────────────────────────────────────────
    goalText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 22,
      marginBottom: 16,
    },
    progressTrack: {
      height: 6,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: {
      height: 6,
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    progressMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    progressPct: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    daysLeft: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    taskCount: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 14,
    },
    setGoalBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    setGoalBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },

    // ── About You ────────────────────────────────────────────────────────────
    contextText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
    },
    contextInput: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 21,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    contextActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 12,
    },
    cancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelBtnText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    saveBtn: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    saveBtnText: {
      fontSize: 14,
      color: colors.textOnPrimary,
      fontWeight: '600',
    },

    // ── Recent wins ──────────────────────────────────────────────────────────
    winRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    winDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
      marginTop: 6,
    },
    winTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      lineHeight: 20,
    },
    winDate: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },

    // ── Settings rows ────────────────────────────────────────────────────────
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingRowLabel: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    settingRowValue: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    logoutRow: {
      borderBottomWidth: 0,
    },
    logoutLabel: {
      color: colors.error,
    },
  });
}
