import { useEffect, useState, useMemo } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useConversationStore } from '../store/conversationStore';
import { regenerateRoadmap } from '../services/aiService';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/colors';
import { Goal, RoadmapPhase } from '../types';

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

  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  function handleReeval() {
    if (!goal) return;
    useConversationStore.getState().reset();
    useConversationStore.getState().setReeval(goal.id, goal.goal_text);
    router.push('/conversation');
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
      // Save to Supabase
      await supabase
        .from('goals')
        .update({ goal_text: newTitle, timeline_months: newTimeline })
        .eq('id', goal.id);

      // Update local state so UI reflects the change immediately
      const updatedGoal = { ...goal, goal_text: newTitle, timeline_months: newTimeline };
      setGoal(updatedGoal);

      // Build a short context describing what changed
      const changes: string[] = [];
      if (editingField === 'title' && newTitle !== goal.goal_text)
        changes.push(`Goal text updated to: "${newTitle}"`);
      if (editingField === 'timeline' && newTimeline !== goal.timeline_months)
        changes.push(`Timeline changed from ${goal.timeline_months} months to ${newTimeline} months`);
      const preContext = changes.join('. ');

      // Trigger AI roadmap regeneration directly — no primer/questions
      const { goalId } = await regenerateRoadmap({
        goalId: goal.id,
        goal: newTitle,
        timelineMonths: newTimeline,
        context: {},
        preContext,
      });

      router.push({ pathname: '/roadmap-preview', params: { goalId, reeval: 'true' } });
    } catch (e) {
      console.error('Failed to update plan:', e);
    } finally {
      setUpdatingPlan(false);
    }
  }

  async function handleConfirmDelete() {
    if (!goal || !deleteReason.trim()) return;
    setDeleting(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Delete all future tasks for this goal — keep past tasks as history
      await supabase
        .from('daily_tasks')
        .delete()
        .eq('goal_id', goal.id)
        .gte('scheduled_date', today);

      // Archive the goal — status update is the critical call, done alone
      await supabase
        .from('goals')
        .update({ status: 'abandoned' })
        .eq('id', goal.id);

      // Save the reason into initial_context — fire and forget, non-critical
      supabase
        .from('goals')
        .update({
          initial_context: {
            ...(goal.initial_context ?? {}),
            abandonment_reason: deleteReason.trim(),
          },
        })
        .eq('id', goal.id)
        .then(() => {})
        .catch(() => {});

      router.back();
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (id) loadDetail(id);
  }, [id]);

  async function loadDetail(goalId: string) {
    setLoading(true);
    try {
      const [{ data: goalData }, { data: phaseData }] = await Promise.all([
        supabase.from('goals').select('*').eq('id', goalId).single(),
        supabase.from('roadmap_phases').select('*').eq('goal_id', goalId).order('phase_number'),
      ]);
      if (goalData) setGoal(goalData as Goal);
      if (phaseData) setPhases(phaseData as RoadmapPhase[]);
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
              <Ionicons name="flash-outline" size={16} color="#fff" />
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
                        <Ionicons name="checkmark" size={14} color="#fff" />
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
      backgroundColor: 'rgba(0,0,0,0.55)',
      zIndex: 100,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    updatingText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
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
      color: '#fff',
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
      backgroundColor: 'rgba(0,0,0,0.6)',
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
      color: '#FFFFFF',
    },
    btnDisabled: {
      opacity: 0.35,
    },
  });
}
