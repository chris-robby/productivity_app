import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, format, eachDayOfInterval } from 'date-fns';
import { useConversationStore } from '../store/conversationStore';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/colors';
import { ScreenFooter } from '../components/ScreenFooter';
import { DAY_LABELS, ALL_DAYS, formatDays } from '../constants/days';
import { supabase } from '../lib/supabase';

export default function JourneyPreviewScreen() {
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const goalText = useConversationStore((s) => s.goalText);
  const userContext = useConversationStore((s) => s.userContext);
  const tasks = useConversationStore((s) => s.tasks);
  const timelineMonths = useConversationStore((s) => s.timelineMonths);

  const targetDate = addDays(new Date(), timelineMonths * 30);

  async function handleStart() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const startDate = new Date();

      // 1. Save goal
      const { data: goal, error: goalErr } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          goal_text: goalText,
          timeline_months: timelineMonths,
          target_date: format(targetDate, 'yyyy-MM-dd'),
          status: 'active',
          initial_conversation: {},
          user_context: userContext || null,
        })
        .select()
        .single();

      if (goalErr || !goal) throw goalErr ?? new Error('Failed to save goal');

      // 2. Save habits
      const { error: habitErr } = await supabase.from('habits').insert(
        tasks.map((t) => ({
          goal_id: goal.id,
          user_id: user.id,
          habit_text: t.text.trim(),
          frequency: 'custom',
          frequency_days: t.days.length,
        }))
      );
      if (habitErr) throw habitErr;

      // 3. Pre-generate daily_tasks for the next 30 days
      const days = eachDayOfInterval({ start: startDate, end: addDays(startDate, 29) });
      const taskRows: object[] = [];

      for (const day of days) {
        const dow = day.getDay();
        for (const task of tasks) {
          if (task.days.includes(dow)) {
            taskRows.push({
              goal_id: goal.id,
              task_title: task.text.trim(),
              scheduled_date: format(day, 'yyyy-MM-dd'),
              estimated_minutes: 0,
              priority: 'medium',
              completed: false,
              failed: false,
            });
          }
        }
      }

      if (taskRows.length > 0) {
        const { error: tasksErr } = await supabase.from('daily_tasks').insert(taskRows);
        if (tasksErr) throw tasksErr;
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          { paddingTop: insets.top + 24, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Your plan</Text>

        <Text style={styles.metaLabel}>GOAL</Text>
        <Text style={styles.goalText}>{goalText}</Text>

        <Text style={styles.metaLabel}>TARGET DATE</Text>
        <Text style={styles.targetDate}>{format(targetDate, 'MMMM d, yyyy')}</Text>

        <Text style={styles.metaLabel}>WHAT YOU'LL DO</Text>

        {tasks.map((task) => (
          <View key={task.id} style={styles.taskRow}>
            <Text style={styles.taskText}>{task.text}</Text>
            <Text style={styles.taskDays}>{formatDays(task.days)}</Text>
          </View>
        ))}
      </ScrollView>

      <ScreenFooter onBack={() => router.back()} absolute>
        <TouchableOpacity
          style={[styles.startBtn, saving && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.startBtnText}>Start Tracking →</Text>
          )}
        </TouchableOpacity>
      </ScreenFooter>
    </View>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollInner: { paddingHorizontal: 24 },

    heading: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 28,
    },
    metaLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 1.2,
      marginBottom: 6,
    },
    goalText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 24,
      marginBottom: 20,
    },
    targetDate: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 28,
    },
    taskRow: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    taskText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    taskDays: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    startBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      minWidth: 160,
      alignItems: 'center',
    },
    startBtnDisabled: { opacity: 0.5 },
    startBtnText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
  });
}
