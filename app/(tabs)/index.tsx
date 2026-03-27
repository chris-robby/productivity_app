import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTaskStore } from '../../store/taskStore';
import { useGoalStore } from '../../store/goalStore';
import { useConversationStore } from '../../store/conversationStore';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { ColorPalette } from '../../constants/colors';
import { LeftSidebar } from '../../components/LeftSidebar';
import { Goal } from '../../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export default function TodayScreen() {
  const router = useRouter();
  const [showSidebar, setShowSidebar] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showReasonSheet, setShowReasonSheet] = useState(false);
  const [reasonTaskId, setReasonTaskId] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [submittingReason, setSubmittingReason] = useState(false);
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const [goalInputText, setGoalInputText] = useState('');

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const todaysTasks = useTaskStore((state) => state.todaysTasks);
  const loadTodaysTasks = useTaskStore((state) => state.loadTodaysTasks);
  const toggleTaskCompletion = useTaskStore((state) => state.toggleTaskCompletion);
  const submitFailureReason = useTaskStore((state) => state.submitFailureReason);

  useFocusEffect(
    useCallback(() => {
      loadTodaysTasks();
      loadActiveGoals();
    }, [])
  );

  async function loadActiveGoals() {
    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .eq('status', 'active')
      .order('created_at');

    if (goals && goals.length > 0) {
      setActiveGoals(goals as Goal[]);
      useGoalStore.getState().setCurrentGoal(goals[0]);
      useGoalStore.getState().loadGoal(goals[0].id);
    } else {
      setActiveGoals([]);
      useGoalStore.getState().setCurrentGoal(null);
    }
    setGoalsLoaded(true);
  }

  function handleGoalSubmit() {
    if (!goalInputText.trim()) return;
    useConversationStore.getState().reset();
    useConversationStore.getState().setGoalText(goalInputText.trim());
    router.push('/conversation');
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadTodaysTasks();
    setRefreshing(false);
  }

  function handleMarkNotDone(taskId: string) {
    setReasonTaskId(taskId);
    setReasonText('');
    setShowReasonSheet(true);
  }

  async function handleSubmitReason() {
    if (!reasonTaskId || !reasonText.trim()) return;
    setSubmittingReason(true);
    try {
      await submitFailureReason(reasonTaskId, reasonText.trim());
    } catch (error) {
      console.error('Error submitting reason:', error);
    } finally {
      setSubmittingReason(false);
      setShowReasonSheet(false);
      setReasonTaskId(null);
    }
  }

  // Show goal setup form when no active goals
  if (goalsLoaded && activeGoals.length === 0) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <StatusBar style={colors.statusBar} />
        <View style={[styles.goalSetupWrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
          {/* Hamburger — lets users with history access Journey & Goal Overview */}
          <TouchableOpacity
            onPress={() => setShowSidebar(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.goalSetupMenuBtn}
          >
            <Ionicons name="menu-outline" size={26} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.goalSetupTop}>
            <Text style={styles.goalSetupHeading}>What is your goal?</Text>
            <Text style={styles.goalSetupSub}>I'll build you a personalised roadmap to achieve it.</Text>
          </View>

          <View style={styles.goalInputRow}>
            <TextInput
              style={styles.goalInputField}
              placeholder="Set your vision..."
              placeholderTextColor={colors.placeholder}
              value={goalInputText}
              onChangeText={setGoalInputText}
              multiline
              textAlignVertical="top"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.goalSendBtn, !goalInputText.trim() && styles.goalSendBtnDisabled]}
              onPress={handleGoalSubmit}
              disabled={!goalInputText.trim()}
            >
              <MaterialCommunityIcons name="run" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <LeftSidebar visible={showSidebar} onClose={() => setShowSidebar(false)} />
      </KeyboardAvoidingView>
    );
  }

  // Priority + estimated_minutes tiebreak; done/failed sink to bottom
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sortedTasks = [...todaysTasks].sort((a, b) => {
    const aDone = a.completed || a.failed ? 1 : 0;
    const bDone = b.completed || b.failed ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    const pDiff = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
    if (pDiff !== 0) return pDiff;
    return (a.estimated_minutes ?? 0) - (b.estimated_minutes ?? 0);
  });

  const reasonTask = todaysTasks.find((t) => t.id === reasonTaskId);

  // Header subtitle: single goal shows trimmed text, multiple goals shows count
  const headerGoalLabel =
    activeGoals.length > 1
      ? `${activeGoals.length} goals active`
      : activeGoals[0]?.goal_text ?? null;

  // ─── Reason dialog ────────────────────────────────────────────────────────
  const reasonSheet = (
    <Modal
      visible={showReasonSheet}
      transparent
      animationType="fade"
      onRequestClose={() => setShowReasonSheet(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.dialogOverlay}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setShowReasonSheet(false)}
        />
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>What got in the way?</Text>
          {reasonTask && (
            <Text style={styles.dialogTaskName} numberOfLines={2}>
              {reasonTask.task_title}
            </Text>
          )}

          <TextInput
            style={styles.dialogInput}
            placeholder="e.g. I ran out of energy after work, the task felt unclear, something urgent came up…"
            placeholderTextColor={colors.placeholder}
            value={reasonText}
            onChangeText={setReasonText}
            multiline
            textAlignVertical="top"
            autoFocus
          />

          <View style={styles.dialogActions}>
            <TouchableOpacity
              style={styles.dialogCancel}
              onPress={() => setShowReasonSheet(false)}
            >
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dialogSubmit,
                !reasonText.trim() && styles.dialogSubmitDisabled,
              ]}
              onPress={handleSubmitReason}
              disabled={!reasonText.trim() || submittingReason}
            >
              <Text style={styles.dialogSubmitText}>
                {submittingReason ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar style={colors.statusBar} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setShowSidebar(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerHamburger}
          >
            <Ionicons name="menu-outline" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerDate}>
              {format(new Date(), 'EEEE, MMMM d')}
            </Text>
            {headerGoalLabel && (
              <TouchableOpacity onPress={() => router.push('/goal-overview')} activeOpacity={0.7}>
                <Text style={styles.headerGoal} numberOfLines={1}>
                  {headerGoalLabel}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Task list */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.tasksSection}>
          {sortedTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No tasks for today</Text>
            </View>
          ) : (
            sortedTasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;
              return (
                <View
                  key={task.id}
                  style={[
                    styles.taskCard,
                    task.completed && styles.taskCardCompleted,
                  ]}
                >
                  {/* Checkbox */}
                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      task.completed && styles.checkboxCompleted,
                    ]}
                    onPress={() => toggleTaskCompletion(task.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {task.completed && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>

                  {/* Task info — tap to expand */}
                  <TouchableOpacity
                    style={styles.taskContent}
                    onPress={() =>
                      setExpandedTaskId(isExpanded ? null : task.id)
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.taskTitle,
                        (task.completed || task.failed) && styles.taskTitleCompleted,
                      ]}
                    >
                      {task.task_title}
                    </Text>
                    {isExpanded && (
                      <>
                        {task.task_description ? (
                          <Text style={styles.taskDescription}>
                            {task.task_description}
                          </Text>
                        ) : null}
                        <View style={styles.taskMeta}>
                          <View
                            style={[
                              styles.priorityDot,
                              task.priority === 'high' && styles.priorityDotHigh,
                              task.priority === 'medium' && styles.priorityDotMedium,
                              task.priority === 'low' && styles.priorityDotLow,
                            ]}
                          />
                          {task.estimated_minutes > 0 && (
                            <Text style={styles.taskMetaText}>
                              ⏱ {task.estimated_minutes}m
                            </Text>
                          )}
                        </View>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Not-done button — only on tasks not yet resolved */}
                  {!task.completed && !task.failed && (
                    <TouchableOpacity
                      style={styles.notDoneBtn}
                      onPress={() => handleMarkNotDone(task.id)}
                    >
                      <Ionicons
                        name="close"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {reasonSheet}
      <LeftSidebar visible={showSidebar} onClose={() => setShowSidebar(false)} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ── Goal setup (no active goal) ──────────────────────────────────────────
    goalSetupWrap: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: 'space-between',
    },
    goalSetupTop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 60,
    },
    goalSetupHeading: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    goalSetupSub: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    goalInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    goalInputField: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      maxHeight: 120,
      lineHeight: 22,
      paddingVertical: 4,
    },
    goalSendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    goalSendBtnDisabled: {
      opacity: 0.35,
    },

    // ── Header ──────────────────────────────────────────────────────────────
    header: {
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    headerHamburger: {
      marginRight: 12,
      marginTop: 2,
    },
    headerTextCol: {
      flex: 1,
    },
    headerDate: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    headerGoal: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '500',
    },

    // ── Task list ───────────────────────────────────────────────────────────
    content: {
      flex: 1,
    },
    tasksSection: {
      padding: 16,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 80,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    taskCard: {
      backgroundColor: colors.surface,
      padding: 18,
      borderRadius: 12,
      marginBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
    },
    taskCardCompleted: {
      backgroundColor: colors.success + '28',
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    checkboxCompleted: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    taskContent: {
      flex: 1,
    },
    taskTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    taskTitleCompleted: {
      textDecorationLine: 'line-through',
      color: colors.textSecondary,
    },
    taskDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: 6,
      marginBottom: 4,
    },
    taskMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    taskMetaText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    priorityDotHigh: {
      backgroundColor: '#E05C5C',
    },
    priorityDotMedium: {
      backgroundColor: '#C4882A',
    },
    priorityDotLow: {
      backgroundColor: colors.primary,
    },
    notDoneBtn: {
      marginLeft: 10,
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ── Reason dialog ───────────────────────────────────────────────────────
    dialogOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 24,
    },
    dialog: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
    },
    dialogTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    dialogTaskName: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '500',
      marginBottom: 14,
      lineHeight: 18,
    },
    dialogInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.text,
      minHeight: 110,
      textAlignVertical: 'top',
      marginBottom: 20,
    },
    dialogActions: {
      flexDirection: 'row',
      gap: 12,
    },
    dialogCancel: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
    },
    dialogCancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    dialogSubmit: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    dialogSubmitDisabled: {
      opacity: 0.35,
    },
    dialogSubmitText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}
