import { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, format } from 'date-fns';
import { useConversationStore } from '../store/conversationStore';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { ColorPalette } from '../constants/colors';
import { ScreenFooter } from '../components/ScreenFooter';
import { formatDays } from '../constants/days';
import { saveGoalWithHabits } from '../services/database/adapter';

export default function JourneyPreviewScreen() {
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { styles, colors } = useThemedStyles(getStyles);

  const goalText = useConversationStore((s) => s.goalText);
  const userContext = useConversationStore((s) => s.userContext);
  const tasks = useConversationStore((s) => s.tasks);
  const timelineMonths = useConversationStore((s) => s.timelineMonths);

  const targetDate = addDays(new Date(), timelineMonths * 30);

  async function handleStart() {
    setSaving(true);
    try {
      await saveGoalWithHabits({
        goalText,
        timelineMonths,
        userContext,
        tasks: tasks.map((t) => ({ text: t.text, days: t.days })),
      });
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
            <>
              <Text style={styles.startBtnText}>Start Tracking</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textOnPrimary} />
            </>
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
    scrollInner: { paddingHorizontal: 20 },

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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      minWidth: 160,
    },
    startBtnDisabled: { opacity: 0.5 },
    startBtnText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
  });
}
