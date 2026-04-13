import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { suggestTasks, TaskSuggestion, regenerateRoadmap } from '../services/aiService';
import { format, parseISO, addDays, eachDayOfInterval } from 'date-fns';
import { supabase } from '../lib/supabase';
import {
  getGoalById,
  getHabitsForGoal,
  getUpcomingTaskTitlesForGoal,
  updateGoalText,
  deleteGoal,
  deleteHabitAndFutureTasks,
  updateHabitSchedule,
} from '../services/database/adapter';
import { useTier } from '../store/tierStore';
import { PaywallSheet } from '../components/PaywallSheet';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { ColorPalette } from '../constants/colors';
import { Goal, RoadmapPhase } from '../types';

const CHIP_DAYS = [
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
  { label: 'Su', value: 0 },
];

type HabitEntry = { id: string; habit_text: string; days: number[] };

export default function GoalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [phases, setPhases] = useState<RoadmapPhase[]>([]);

  // Inline editing
  const [editingField, setEditingField] = useState<'title' | 'timeline' | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [editTimelineValue, setEditTimelineValue] = useState('');
  const [updatingPlan, setUpdatingPlan] = useState(false);


  // Delete modal
  const [showDelete, setShowDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Paywall
  const [showPaywall, setShowPaywall] = useState(false);

  // AI suggestions sheet
  const [showSuggest, setShowSuggest] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [addingIdx, setAddingIdx] = useState<number | null>(null);
  const [dayOverrides, setDayOverrides] = useState<Record<number, number[]>>({});
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);

  const [habits, setHabits] = useState<HabitEntry[]>([]);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [habitEditDays, setHabitEditDays] = useState<number[]>([]);
  const [savingHabit, setSavingHabit] = useState(false);

  const { styles, colors } = useThemedStyles(getStyles);
  const { isPremium } = useTier();

  async function handleReeval() {
    if (!goal) return;
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    setShowSuggest(true);
    setLoadingSuggestions(true);
    setSuggestions([]);
    setAddedIds(new Set());
    try {
      const { suggestions: fetched } = await suggestTasks(
        goal.id,
        goal.goal_text,
        goal.user_context ?? undefined
      );
      setSuggestions(fetched);
      const overrides: Record<number, number[]> = {};
      fetched.forEach((s, i) => { overrides[i] = s.suggestedDays ?? []; });
      setDayOverrides(overrides);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load suggestions. Please try again.');
      setShowSuggest(false);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function handleAddSuggestion(suggestion: TaskSuggestion, idx: number) {
    if (!goal) return;
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    setAddingIdx(idx);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const activeDays = dayOverrides[idx] ?? suggestion.suggestedDays;

      // Save habit
      const { error: habitErr } = await supabase.from('habits').insert({
        goal_id: goal.id,
        user_id: user.id,
        habit_text: suggestion.task,
        frequency: 'custom',
        frequency_days: activeDays.length,
      });
      if (habitErr) throw habitErr;

      // Pre-generate daily_tasks for the next 30 days
      const startDate = new Date();
      const days = eachDayOfInterval({ start: startDate, end: addDays(startDate, 29) });
      const taskRows = days
        .filter((day) => activeDays.includes(day.getDay()))
        .map((day) => ({
          goal_id: goal.id,
          task_title: suggestion.task,
          scheduled_date: format(day, 'yyyy-MM-dd'),
          estimated_minutes: 0,
          priority: 'medium',
          completed: false,
          failed: false,
        }));

      if (taskRows.length > 0) {
        const { error: tasksErr } = await supabase.from('daily_tasks').insert(taskRows);
        if (tasksErr) throw tasksErr;
      }

      setAddedIds((prev) => new Set(prev).add(idx));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add task.');
    } finally {
      setAddingIdx(null);
    }
  }

  function handleDeleteHabit(habit: HabitEntry) {
    Alert.alert(
      'Remove task?',
      `"${habit.habit_text}" will be removed from your plan and all future scheduled sessions will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!goal) return;
            try {
              const today = format(new Date(), 'yyyy-MM-dd');
              await deleteHabitAndFutureTasks(habit.id, goal.id, habit.habit_text, today);
              setHabits((prev) => prev.filter((h) => h.id !== habit.id));
              if (editingHabitId === habit.id) setEditingHabitId(null);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove task.');
            }
          },
        },
      ]
    );
  }

  async function handleSaveHabitDays(habit: HabitEntry) {
    if (!goal) return;
    setSavingHabit(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await updateHabitSchedule(habit.id, goal.id, habit.habit_text, today, habitEditDays);
      setHabits((prev) => prev.map((h) => h.id === habit.id ? { ...h, days: habitEditDays } : h));
      setEditingHabitId(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update schedule.');
    } finally {
      setSavingHabit(false);
    }
  }


  function startEditTitle() {
    if (!goal) return;
    setEditTitleValue(goal.goal_text);
    setEditingField('title');
  }

  function startEditTimeline() {
    if (!goal) return;
    setEditTimelineValue(String(goal.timeline_months ?? ''));
    setEditingField('timeline');
  }

  function cancelEdit() {
    setEditingField(null);
  }

  async function handleSaveInline() {
    if (!goal || !editingField) return;

    const newTitle = editingField === 'title' ? editTitleValue.trim() : goal.goal_text;
    const newTimeline =
      editingField === 'timeline'
        ? parseInt(editTimelineValue, 10) || goal.timeline_months
        : goal.timeline_months;

    if (editingField === 'title' && !newTitle) return;
    if (editingField === 'timeline' && !newTimeline) return;

    setUpdatingPlan(true);
    setEditingField(null);

    try {
      await updateGoalText(goal.id, newTitle, newTimeline);
      setGoal({ ...goal, goal_text: newTitle, timeline_months: newTimeline });

      if (isPremium) {
        const changes: string[] = [];
        if (editingField === 'title' && newTitle !== goal.goal_text)
          changes.push(`Goal text updated to: "${newTitle}"`);
        if (editingField === 'timeline' && newTimeline !== goal.timeline_months)
          changes.push(`Timeline changed from ${goal.timeline_months} months to ${newTimeline} months`);

        const { goalId } = await regenerateRoadmap({
          goalId: goal.id,
          goal: newTitle,
          timelineMonths: newTimeline,
          context: {},
          preContext: changes.join('. '),
          userContext: goal.user_context ?? '',
        });
        router.push({ pathname: '/roadmap-preview', params: { goalId, reeval: 'true' } });
      }
    } catch (e) {
      console.error('Failed to update plan:', e);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setUpdatingPlan(false);
    }
  }

  async function handleConfirmDelete() {
    if (!goal || !deleteReason.trim()) return;
    setDeleting(true);
    try {
      await deleteGoal(goal.id);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to remove goal.');
    } finally {
      setDeleting(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (id) loadDetail(id);
    }, [id])
  );

  async function loadDetail(goalId: string) {
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      const phasesPromise = isPremium
        ? supabase.from('roadmap_phases').select('*').eq('goal_id', goalId).order('phase_number').then((r) => r.data)
        : Promise.resolve(null);

      const [goalData, habitsData, futureTasks, phaseData] = await Promise.all([
        getGoalById(goalId),
        getHabitsForGoal(goalId),
        getUpcomingTaskTitlesForGoal(goalId, today),
        phasesPromise,
      ]);

      if (goalData) setGoal(goalData);
      if (phaseData) setPhases(phaseData as RoadmapPhase[]);

      if (habitsData.length > 0) {
        const dayMap: Record<string, Set<number>> = {};
        for (const t of futureTasks) {
          const dow = new Date(t.scheduled_date + 'T00:00:00').getDay();
          if (!dayMap[t.task_title]) dayMap[t.task_title] = new Set();
          dayMap[t.task_title].add(dow);
        }
        setHabits(habitsData.map((h) => ({
          id: h.id,
          habit_text: h.habit_text,
          days: Array.from(dayMap[h.habit_text] ?? new Set<number>()),
        })));
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!goal) {
    return (
      <View style={styles.centered}>
        <StatusBar style={colors.statusBar} />
        <Text style={styles.emptyText}>Goal not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const today = new Date();
  const currentPhaseIndex = phases.findIndex(
    (p) =>
      p.start_date &&
      p.end_date &&
      new Date(p.start_date) <= today &&
      today <= new Date(p.end_date)
  );

  const canSaveTitle = editingField === 'title' && editTitleValue.trim().length > 0;
  const canSaveTimeline =
    editingField === 'timeline' &&
    editTimelineValue.trim().length > 0 &&
    parseInt(editTimelineValue, 10) > 0;
  const canSave = canSaveTitle || canSaveTimeline;

  return (
    <View style={styles.container}>
      <StatusBar style={colors.statusBar} />

      {/* Updating plan overlay */}
      {updatingPlan && (
        <View style={styles.updatingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.updatingText}>Updating your plan…</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Roadmap</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Goal card */}
        <View style={styles.goalCard}>
          <Text style={styles.goalLabel}>YOUR GOAL</Text>

          {/* Title — inline editable */}
          <View style={styles.editableRow}>
            {editingField === 'title' ? (
              <TextInput
                style={styles.titleInput}
                value={editTitleValue}
                onChangeText={setEditTitleValue}
                multiline
                autoFocus
                textAlignVertical="top"
                placeholderTextColor={colors.placeholder}
              />
            ) : (
              <>
                <Text style={[styles.goalText, { flex: 1 }]}>{goal.goal_text}</Text>
                <TouchableOpacity
                  onPress={startEditTitle}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.editIcon}
                >
                  <Ionicons name="pencil-outline" size={16} color={colors.placeholder} />
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.metaRow}>
            {/* Timeline — inline editable */}
            {goal.timeline_months !== undefined && goal.timeline_months !== null ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Timeline</Text>
                {editingField === 'timeline' ? (
                  <View style={styles.timelineInputRow}>
                    <TextInput
                      style={styles.timelineInput}
                      value={editTimelineValue}
                      onChangeText={setEditTimelineValue}
                      keyboardType="number-pad"
                      autoFocus
                      placeholderTextColor={colors.placeholder}
                    />
                    <Text style={styles.metaValue}> months</Text>
                  </View>
                ) : (
                  <View style={styles.metaValueRow}>
                    <Text style={styles.metaValue}>{goal.timeline_months} months</Text>
                    <TouchableOpacity
                      onPress={startEditTimeline}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.editIconSmall}
                    >
                      <Ionicons name="pencil-outline" size={13} color={colors.placeholder} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null}

            {goal.target_date ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Target date</Text>
                <Text style={styles.metaValue}>
                  {format(new Date(goal.target_date), 'MMM d, yyyy')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Save / Cancel — shown when editing a field */}
        {editingField && (
          <View style={styles.inlineActions}>
            <TouchableOpacity style={styles.cancelEditBtn} onPress={cancelEdit}>
              <Text style={styles.cancelEditText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveUpdateBtn, !canSave && styles.btnDisabled]}
              onPress={handleSaveInline}
              disabled={!canSave}
            >
              <Ionicons name="flash-outline" size={16} color={colors.textOnPrimary} />
              <Text style={styles.saveUpdateText}>Save & Update Plan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Re-evaluate */}
        {!editingField && (
          <TouchableOpacity style={styles.reevalBtn} onPress={handleReeval} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
            <Text style={styles.reevalText}>Re-evaluate with AI</Text>
          </TouchableOpacity>
        )}


        {/* Your Tasks */}
        {habits.length > 0 && !editingField && (
          <View style={[styles.section, { marginBottom: 20 }]}>
            <Text style={styles.sectionTitle}>Your Tasks</Text>
            {habits.map((habit) => {
              const isEditing = editingHabitId === habit.id;
              return (
                <View key={habit.id} style={[styles.habitCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <View style={styles.habitHeader}>
                    <Text style={[styles.habitText, { color: colors.text }]} numberOfLines={2}>
                      {habit.habit_text}
                    </Text>
                    {!isEditing && (
                      <View style={{ flexDirection: 'row', gap: 14 }}>
                        <TouchableOpacity
                          onPress={() => { setEditingHabitId(habit.id); setHabitEditDays(habit.days); }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="pencil-outline" size={16} color={colors.placeholder} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteHabit(habit)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.placeholder} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <DayChips
                    days={isEditing ? habitEditDays : habit.days}
                    onChange={isEditing ? setHabitEditDays : undefined}
                    colors={colors}
                  />
                  {isEditing && (
                    <View style={styles.habitActions}>
                      <TouchableOpacity
                        style={[styles.habitCancelBtn, { borderColor: colors.border }]}
                        onPress={() => setEditingHabitId(null)}
                        disabled={savingHabit}
                      >
                        <Text style={[styles.habitCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.habitSaveBtn, { backgroundColor: colors.primary }, (savingHabit || habitEditDays.length === 0) && styles.btnDisabled]}
                        onPress={() => handleSaveHabitDays(habit)}
                        disabled={savingHabit || habitEditDays.length === 0}
                      >
                        <Text style={styles.habitSaveText}>{savingHabit ? 'Saving…' : 'Save'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Phases */}
        {phases.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Phases</Text>
            {phases.map((phase, i) => {
              const isCurrent = i === currentPhaseIndex;
              const isPast =
                phase.end_date
                  ? new Date(phase.end_date) < today && !isCurrent
                  : false;

              return (
                <View
                  key={phase.id}
                  style={[styles.phaseCard, isCurrent && styles.phaseCardCurrent]}
                >
                  <View style={styles.phaseCardHeader}>
                    <View
                      style={[
                        styles.phaseNumBadge,
                        isCurrent && styles.phaseNumBadgeCurrent,
                        isPast && styles.phaseNumBadgePast,
                      ]}
                    >
                      {isPast ? (
                        <Ionicons name="checkmark" size={14} color={colors.textOnPrimary} />
                      ) : (
                        <Text style={styles.phaseNumText}>{phase.phase_number}</Text>
                      )}
                    </View>

                    <View style={styles.phaseTitleCol}>
                      <Text
                        style={[
                          styles.phaseTitle,
                          isCurrent && styles.phaseTitleCurrent,
                          isPast && styles.phaseTitlePast,
                        ]}
                      >
                        {phase.phase_title}
                      </Text>
                      {phase.start_date && phase.end_date && (
                        <Text style={styles.phaseDates}>
                          {format(parseISO(phase.start_date), 'MMM d')} –{' '}
                          {format(parseISO(phase.end_date), 'MMM d, yyyy')}
                        </Text>
                      )}
                    </View>

                    {isCurrent && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Active</Text>
                      </View>
                    )}
                  </View>

                  {phase.phase_description ? (
                    <Text style={styles.phaseDesc}>{phase.phase_description}</Text>
                  ) : null}

                  {phase.milestones && phase.milestones.length > 0 && (
                    <View style={styles.milestones}>
                      {phase.milestones.slice(0, 3).map((week: any, idx: number) => (
                        <Text key={idx} style={styles.milestoneItem}>
                          · Week {week.weekNumber}: {week.focus}
                        </Text>
                      ))}
                      {phase.milestones.length > 3 && (
                        <Text style={styles.milestoneMore}>
                          +{phase.milestones.length - 3} more weeks
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Delete */}
        <View style={styles.dangerZone}>
          <TouchableOpacity
            style={styles.deleteGoalBtn}
            onPress={() => { setDeleteReason(''); setShowDelete(true); }}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={17} color={colors.error} />
            <Text style={styles.deleteGoalText}>Remove Goal</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* AI Suggestions sheet */}
      <Modal
        visible={showSuggest}
        transparent
        animationType="slide"
        onRequestClose={() => !loadingSuggestions && setShowSuggest(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !loadingSuggestions && setShowSuggest(false)} />
          <View style={[styles.suggestSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.suggestHeader}>
              <Text style={[styles.suggestTitle, { color: colors.text }]}>AI Suggestions</Text>
              <TouchableOpacity
                onPress={() => setShowSuggest(false)}
                disabled={loadingSuggestions}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.suggestSub, { color: colors.textSecondary }]}>
              Tasks to add to your plan. Tap Add to include any that resonate.
            </Text>

            {loadingSuggestions ? (
              <View style={styles.suggestLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.suggestLoadingText, { color: colors.textSecondary }]}>
                  Reviewing your plan…
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.suggestScroll}>
                {suggestions.map((s, idx) => (
                  <View key={idx} style={[styles.suggestionCard, { borderColor: colors.border }]}>
                    <Text style={[styles.suggestionTask, { color: colors.text }]}>{s.task}</Text>
                    <DayChips
                      days={dayOverrides[idx] ?? s.suggestedDays ?? []}
                      onChange={(newDays) => setDayOverrides((prev) => ({ ...prev, [idx]: newDays }))}
                      colors={colors}
                    />
                    <Text style={[styles.suggestionReason, { color: colors.textSecondary, marginTop: 10 }]}>
                      {s.reason}
                    </Text>

                    {expandedSuggestion === idx && s.howTo && (
                      <View style={[styles.howToBox, { backgroundColor: colors.surfaceElevated }]}>
                        <Text style={[styles.howToLabel, { color: colors.primary }]}>HOW TO</Text>
                        <Text style={[styles.howToText, { color: colors.text }]}>{s.howTo}</Text>
                      </View>
                    )}

                    <View style={styles.suggestionFooter}>
                      {s.howTo ? (
                        <TouchableOpacity
                          onPress={() => setExpandedSuggestion(expandedSuggestion === idx ? null : idx)}
                          style={styles.howToToggle}
                        >
                          <Text style={[styles.howToToggleText, { color: colors.primary }]}>
                            {expandedSuggestion === idx ? 'Hide ↑' : 'See how →'}
                          </Text>
                        </TouchableOpacity>
                      ) : <View />}
                      <TouchableOpacity
                        style={[
                          styles.addSuggestionBtn,
                          { backgroundColor: addedIds.has(idx) ? colors.success : colors.primary },
                          addingIdx === idx && { opacity: 0.6 },
                        ]}
                        onPress={() => handleAddSuggestion(s, idx)}
                        disabled={addedIds.has(idx) || addingIdx !== null}
                      >
                        {addingIdx === idx ? (
                          <ActivityIndicator size="small" color={colors.textOnPrimary} />
                        ) : (
                          <Text style={styles.addSuggestionBtnText}>
                            {addedIds.has(idx) ? 'Added ✓' : 'Add'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Delete modal */}
      <Modal visible={showDelete} transparent animationType="fade" onRequestClose={() => setShowDelete(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDelete(false)} />
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Remove this goal?</Text>
            {goal && (
              <Text style={styles.modalGoalName} numberOfLines={2}>{goal.goal_text}</Text>
            )}
            <Text style={styles.modalLabel}>Why are you removing it?</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Goal changed, no longer relevant, achieved it early..."
              placeholderTextColor={colors.placeholder}
              value={deleteReason}
              onChangeText={setDeleteReason}
              multiline
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDelete(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, (!deleteReason.trim() || deleting) && styles.btnDisabled]}
                onPress={handleConfirmDelete}
                disabled={!deleteReason.trim() || deleting}
              >
                <Text style={styles.deleteConfirmText}>{deleting ? 'Removing…' : 'Remove'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PaywallSheet visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </View>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      gap: 16,
    },
    emptyText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    backBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    backBtnText: {
      fontSize: 15,
      color: colors.primary,
      fontWeight: '600',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 24,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    content: {
      flex: 1,
    },

    // ── Updating overlay ───────────────────────────────────────────────────────
    updatingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      zIndex: 100,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    updatingText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },

    // ── Goal card ─────────────────────────────────────────────────────────────
    goalCard: {
      backgroundColor: colors.surface,
      margin: 16,
      padding: 20,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    goalLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 1.2,
      marginBottom: 8,
    },
    editableRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    goalText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 24,
    },
    editIcon: {
      marginLeft: 8,
      marginTop: 4,
    },
    editIconSmall: {
      marginLeft: 6,
    },
    titleInput: {
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 24,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 10,
      padding: 10,
      minHeight: 60,
    },
    metaRow: {
      flexDirection: 'row',
      gap: 16,
    },
    metaItem: {
      flex: 1,
    },
    metaLabel: {
      fontSize: 11,
      color: colors.placeholder,
      marginBottom: 3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    metaValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metaValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    timelineInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    timelineInput: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      minWidth: 48,
      textAlign: 'center',
    },

    // ── Inline save/cancel ────────────────────────────────────────────────────
    inlineActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 16,
    },
    cancelEditBtn: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    cancelEditText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    saveUpdateBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    saveUpdateText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },

    // ── Re-evaluate ───────────────────────────────────────────────────────────
    reevalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 20,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    reevalText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },


    // ── Phases ────────────────────────────────────────────────────────────────
    section: {
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    phaseCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
    },
    phaseCardCurrent: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    phaseCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 6,
    },
    phaseNumBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      marginTop: 1,
    },
    phaseNumBadgeCurrent: {
      backgroundColor: colors.primary,
    },
    phaseNumBadgePast: {
      backgroundColor: colors.success,
    },
    phaseNumText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    phaseTitleCol: {
      flex: 1,
    },
    phaseTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    phaseTitleCurrent: {
      color: colors.text,
    },
    phaseTitlePast: {
      color: colors.placeholder,
    },
    phaseDates: {
      fontSize: 12,
      color: colors.placeholder,
    },
    activeBadge: {
      backgroundColor: 'rgba(74,144,196,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginLeft: 8,
    },
    activeBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    phaseDesc: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 8,
      marginLeft: 40,
    },
    milestones: {
      marginLeft: 40,
      gap: 4,
    },
    milestoneItem: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    milestoneMore: {
      fontSize: 12,
      color: colors.placeholder,
      marginTop: 2,
    },

    // ── Danger zone ───────────────────────────────────────────────────────────
    dangerZone: {
      marginHorizontal: 16,
      marginTop: 24,
      gap: 10,
    },
    deleteGoalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.error,
    },
    deleteGoalText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.error,
    },

    // ── Delete modal ──────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.overlay,
      paddingHorizontal: 24,
    },
    modalBox: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 14,
    },
    modalGoalName: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '500',
      marginBottom: 14,
      lineHeight: 18,
    },
    modalLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 10,
    },
    modalInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.text,
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: 20,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cancelBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    deleteConfirmBtn: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.error,
      alignItems: 'center',
    },
    deleteConfirmText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    btnDisabled: {
      opacity: 0.35,
    },

    // ── AI Suggestions sheet ──────────────────────────────────────────────────
    suggestSheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
      maxHeight: '85%',
    },
    suggestHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    suggestTitle: {
      fontSize: 20,
      fontWeight: '700',
    },
    suggestSub: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
    },
    suggestLoading: {
      alignItems: 'center',
      paddingVertical: 40,
      gap: 14,
    },
    suggestLoadingText: {
      fontSize: 15,
    },
    suggestScroll: {
      flexGrow: 0,
    },
    suggestionCard: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    },
    suggestionTask: {
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 4,
    },
    suggestionReason: {
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 14,
    },
    addSuggestionBtn: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      minWidth: 80,
    },
    addSuggestionBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    suggestionFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    howToToggle: {
      paddingVertical: 6,
      paddingHorizontal: 2,
    },
    howToToggleText: {
      fontSize: 13,
      fontWeight: '600',
    },
    howToBox: {
      borderRadius: 10,
      padding: 12,
      marginTop: 12,
    },
    howToLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginBottom: 6,
    },
    howToText: {
      fontSize: 13,
      lineHeight: 20,
    },

    // ── Your Tasks ────────────────────────────────────────────────────────────
    habitCard: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    habitHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    habitText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      marginRight: 8,
    },
    habitActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    habitCancelBtn: {
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1.5,
    },
    habitCancelText: {
      fontSize: 13,
      fontWeight: '600',
    },
    habitSaveBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 10,
      alignItems: 'center',
    },
    habitSaveText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
  });
}

function DayChips({
  days,
  onChange,
  colors,
}: {
  days: number[];
  onChange?: (days: number[]) => void;
  colors: ColorPalette;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
      {CHIP_DAYS.map((d) => {
        const active = days.includes(d.value);
        return (
          <TouchableOpacity
            key={d.value}
            onPress={() => {
              if (!onChange) return;
              onChange(active ? days.filter((x) => x !== d.value) : [...days, d.value]);
            }}
            disabled={!onChange}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 1.5,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primary : 'transparent',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: active ? colors.textOnPrimary : colors.textSecondary }}>
              {d.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
