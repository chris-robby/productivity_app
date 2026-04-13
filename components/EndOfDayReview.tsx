import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { DailyTask } from '../types';
import { useTaskStore } from '../store/taskStore';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { ColorPalette } from '../constants/colors';

interface EndOfDayReviewProps {
  visible: boolean;
  incompleteTasks: DailyTask[];
  onClose: () => void;
}

const FAILURE_REASONS = [
  'Ran out of time',
  'Too tired / low energy',
  'Unexpected events',
  'Lost motivation',
  'Task was too difficult',
  'Other (specify below)',
];

export function EndOfDayReview({
  visible,
  incompleteTasks,
  onClose,
}: EndOfDayReviewProps) {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { styles, colors } = useThemedStyles(getStyles);

  const submitFailureReason = useTaskStore((state) => state.submitFailureReason);

  const currentTask = incompleteTasks[currentTaskIndex];

  async function handleSubmit() {
    if (!selectedReason) return;

    setSubmitting(true);

    try {
      const reason =
        selectedReason === 'Other (specify below)'
          ? customReason
          : selectedReason;

      await submitFailureReason(currentTask.id, reason);

      if (currentTaskIndex < incompleteTasks.length - 1) {
        setCurrentTaskIndex(currentTaskIndex + 1);
        setSelectedReason('');
        setCustomReason('');
      } else {
        handleClose();
      }
    } catch (error) {
      console.error('Error submitting reason:', error);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkip() {
    if (currentTaskIndex < incompleteTasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
      setSelectedReason('');
      setCustomReason('');
    } else {
      handleClose();
    }
  }

  function handleClose() {
    setCurrentTaskIndex(0);
    setSelectedReason('');
    setCustomReason('');
    onClose();
  }

  if (!currentTask) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Review</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.intro}>
            <Text style={styles.introEmoji}>📝</Text>
            <Text style={styles.introTitle}>
              You didn't complete all tasks today
            </Text>
            <Text style={styles.introSubtitle}>
              Help us understand why so we can adjust your plan
            </Text>
          </View>

          <View style={styles.progress}>
            <Text style={styles.progressText}>
              Task {currentTaskIndex + 1} of {incompleteTasks.length}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      ((currentTaskIndex + 1) / incompleteTasks.length) * 100
                    }%`,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.taskCard}>
            <Text style={styles.taskLabel}>Incomplete Task:</Text>
            <Text style={styles.taskTitle}>{currentTask.task_title}</Text>
            {currentTask.task_description && (
              <Text style={styles.taskDescription}>
                {currentTask.task_description}
              </Text>
            )}
          </View>

          <View style={styles.reasonsSection}>
            <Text style={styles.reasonsTitle}>Why didn't you complete this?</Text>

            {FAILURE_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonOption,
                  selectedReason === reason && styles.reasonOptionSelected,
                ]}
                onPress={() => setSelectedReason(reason)}
              >
                <View
                  style={[
                    styles.radio,
                    selectedReason === reason && styles.radioSelected,
                  ]}
                >
                  {selectedReason === reason && (
                    <View style={styles.radioInner} />
                  )}
                </View>
                <Text
                  style={[
                    styles.reasonText,
                    selectedReason === reason && styles.reasonTextSelected,
                  ]}
                >
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}

            {selectedReason === 'Other (specify below)' && (
              <TextInput
                style={styles.customInput}
                placeholder="Please describe the reason..."
                placeholderTextColor={colors.placeholder}
                value={customReason}
                onChangeText={setCustomReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedReason ||
                (selectedReason === 'Other (specify below)' &&
                  !customReason.trim())) &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={
              !selectedReason ||
              (selectedReason === 'Other (specify below)' &&
                !customReason.trim()) ||
              submitting
            }
          >
            <Text style={styles.submitButtonText}>
              {submitting
                ? 'Submitting...'
                : currentTaskIndex < incompleteTasks.length - 1
                ? 'Next Task →'
                : 'Submit'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      paddingTop: 60,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeButton: {
      fontSize: 24,
      color: colors.textSecondary,
      width: 30,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    intro: {
      alignItems: 'center',
      padding: 24,
    },
    introEmoji: {
      fontSize: 48,
      marginBottom: 12,
    },
    introTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    introSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    progress: {
      paddingHorizontal: 24,
      marginBottom: 24,
    },
    progressText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
      textAlign: 'center',
    },
    progressBar: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
    },
    taskCard: {
      backgroundColor: colors.surface,
      margin: 16,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.error,
    },
    taskLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.error,
      marginBottom: 8,
    },
    taskTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    taskDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    reasonsSection: {
      padding: 16,
    },
    reasonsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    reasonOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      marginBottom: 12,
    },
    reasonOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(74,144,196,0.1)',
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.inputBorder,
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    reasonText: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
    },
    reasonTextSelected: {
      color: colors.primary,
      fontWeight: '500',
    },
    customInput: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      minHeight: 80,
      marginTop: 8,
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
    footer: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    skipButton: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.inputBorder,
      alignItems: 'center',
    },
    skipButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    submitButton: {
      flex: 2,
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.4,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
}
