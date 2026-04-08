import { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversationStore, TaskEntry } from '../store/conversationStore';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/colors';
import { ScreenFooter } from '../components/ScreenFooter';
import { DAYS, ALL_DAYS } from '../constants/days';

type Step = 'tasks' | 'timeline';

const TIMELINE_OPTIONS = [
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
];

const FIRST_PLACEHOLDER = 'e.g. Go for a 30-minute run';

function newTask(): TaskEntry {
  return { id: Math.random().toString(36).slice(2), text: '', days: [] };
}

export default function HabitSetupScreen() {
  const [step, setStep] = useState<Step>('tasks');
  const [tasks, setTasks] = useState<TaskEntry[]>([newTask(), newTask(), newTask()]);
  const [timelineMonths, setTimelineMonths] = useState(3);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const goalText = useConversationStore((s) => s.goalText);
  const setTasksInStore = useConversationStore((s) => s.setTasks);
  const setTimelineInStore = useConversationStore((s) => s.setTimeline);

  const filledTasks = tasks
    .filter((t) => t.text.trim().length > 0)
    .map((t) => ({ ...t, days: t.days.length > 0 ? t.days : [...ALL_DAYS] }));

  const canContinue = filledTasks.length > 0;

  function updateTask(id: string, changes: Partial<TaskEntry>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  }

  function removeTask(id: string) {
    if (tasks.length <= 1) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function toggleDay(taskId: string, day: number, currentDays: number[]) {
    const next = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];
    updateTask(taskId, { days: next });
  }

  function toggleEveryday(taskId: string, currentDays: number[]) {
    const isEveryday = ALL_DAYS.every((d) => currentDays.includes(d));
    updateTask(taskId, { days: isEveryday ? [] : [...ALL_DAYS] });
  }

  function handleContinue() {
    if (!canContinue) return;
    if (step === 'tasks') {
      setStep('timeline');
    } else {
      setTasksInStore(filledTasks);
      setTimelineInStore(timelineMonths);
      router.push('/journey-preview');
    }
  }

  // ── Step 2: Timeline ──────────────────────────────────────────────────────
  if (step === 'timeline') {
    return (
      <View style={styles.container}>
        <StatusBar style={colors.statusBar} />
        <View style={[styles.timelinePage, { paddingTop: insets.top + 24 }]}>
          <Text style={styles.timelineHeading}>When do you want to achieve this?</Text>
          <View style={styles.timelineGrid}>
            {TIMELINE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.months}
                style={[styles.timelineCard, timelineMonths === opt.months && styles.timelineCardActive]}
                onPress={() => setTimelineMonths(opt.months)}
              >
                <Text style={[styles.timelineCardText, timelineMonths === opt.months && styles.timelineCardTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <ScreenFooter onBack={() => setStep('tasks')}>
          <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
            <Text style={styles.continueBtnText}>Preview →</Text>
          </TouchableOpacity>
        </ScreenFooter>
      </View>
    );
  }

  // ── Step 1: Tasks ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          { paddingTop: insets.top + 28, paddingBottom: 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Goal recap */}
        <Text style={styles.goalLabel}>YOUR GOAL</Text>
        <Text style={styles.goalText} numberOfLines={2}>{goalText}</Text>

        <Text style={styles.heading}>What will you do daily?</Text>

        {/* Task rows */}
        <View style={styles.list}>
          {tasks.map((task, index) => {
            const isExpanded = expandedId === task.id;
            const isEveryday = ALL_DAYS.every((d) => task.days.includes(d));
            const hasDays = task.days.length > 0;

            return (
              <View key={task.id}>
                <View style={styles.row}>
                  {/* Square checkbox — decorative, shows this is a checklist */}
                  <View style={styles.checkbox} />

                  {/* Input */}
                  <TextInput
                    style={styles.rowInput}
                    placeholder={index === 0 ? FIRST_PLACEHOLDER : ''}
                    placeholderTextColor={colors.placeholder}
                    value={task.text}
                    onChangeText={(text) => updateTask(task.id, { text })}
                    returnKeyType="done"
                    autoCapitalize="sentences"
                  />

                  {/* Actions — only shown when row has text */}
                  {task.text.trim().length > 0 && (
                    <View style={styles.rowActions}>
                      <TouchableOpacity
                        onPress={() => setExpandedId(isExpanded ? null : task.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[styles.actionBtn, hasDays && styles.actionBtnActive]}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={16}
                          color={hasDays ? colors.textOnPrimary : colors.textSecondary}
                        />
                      </TouchableOpacity>
                      {tasks.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removeTask(task.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.actionBtn}
                        >
                          <Ionicons name="close" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                {/* Days selector */}
                {isExpanded && (
                  <View style={styles.daysRow}>
                    {DAYS.map((d) => (
                      <TouchableOpacity
                        key={d.value}
                        style={[styles.dayChip, !isEveryday && task.days.includes(d.value) && styles.dayChipActive]}
                        onPress={() => {
                          if (isEveryday) {
                            updateTask(task.id, { days: [d.value] });
                          } else {
                            toggleDay(task.id, d.value, task.days);
                          }
                        }}
                      >
                        <Text style={[styles.dayChipText, !isEveryday && task.days.includes(d.value) && styles.dayChipTextActive]}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.dayChip, styles.everydayChip, isEveryday && styles.dayChipActive]}
                      onPress={() => toggleEveryday(task.id, task.days)}
                    >
                      <Text style={[styles.dayChipText, isEveryday && styles.dayChipTextActive]}>
                        Every day
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.rowDivider} />
              </View>
            );
          })}
        </View>

        {/* Add row */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setTasks((p) => [...p, newTask()])}
        >
          <Ionicons name="add" size={18} color={colors.textSecondary} />
          <Text style={styles.addBtnText}>Add another</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScreenFooter onBack={() => router.back()}>
        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={styles.continueBtnText}>Continue →</Text>
        </TouchableOpacity>
      </ScreenFooter>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollInner: { paddingHorizontal: 24 },

    goalLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 1.4,
      marginBottom: 6,
    },
    goalText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 32,
    },
    heading: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 24,
    },

    // ── Task list ─────────────────────────────────────────────────────────────
    list: {
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 12,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 0,
      borderWidth: 1.5,
      borderColor: colors.border,
      flexShrink: 0,
    },
    rowInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      paddingVertical: 0,
      lineHeight: 22,
    },
    rowActions: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    actionBtn: {
      width: 28,
      height: 28,
      borderRadius: 4,
      backgroundColor: colors.surfaceElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionBtnActive: {
      backgroundColor: colors.primary,
    },
    rowDivider: {
      height: 1,
      backgroundColor: colors.border,
      opacity: 0.5,
    },

    // ── Days selector ─────────────────────────────────────────────────────────
    daysRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingBottom: 12,
      paddingLeft: 32,
    },
    dayChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    everydayChip: {
      paddingHorizontal: 12,
    },
    dayChipText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    dayChipTextActive: {
      color: colors.textOnPrimary,
    },

    // ── Add button ────────────────────────────────────────────────────────────
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 16,
      paddingLeft: 32,
    },
    addBtnText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },

    // ── Continue button ───────────────────────────────────────────────────────
    continueBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 0,
      minWidth: 140,
      alignItems: 'center',
    },
    continueBtnDisabled: { opacity: 0.4 },
    continueBtnText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '600' },

    // ── Timeline page ─────────────────────────────────────────────────────────
    timelinePage: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: 'center',
    },
    timelineHeading: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 32,
    },
    timelineGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    timelineCard: {
      width: '45%',
      paddingVertical: 28,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    timelineCardActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    timelineCardText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    timelineCardTextActive: {
      color: colors.textOnPrimary,
    },
  });
}
