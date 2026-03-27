import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversationStore } from '../store/conversationStore';
import { fetchGoalQuestions, generateRoadmap, regenerateRoadmap } from '../services/aiService';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/colors';

type Step = 'primer' | 'loading' | 'confirming' | 'questions' | 'generating';

export default function ConversationScreen() {
  const [step, setStep] = useState<Step>('loading');
  const [loadingMessage, setLoadingMessage] = useState('Understanding your goal...');
  const [redefinedGoal, setRedefinedGoal] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [editText, setEditText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputText, setInputText] = useState('');
  // Primer fields — only used in reeval mode
  const [primerWhat, setPrimerWhat] = useState('');
  const [primerNotes, setPrimerNotes] = useState('');

  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const goalText = useConversationStore((state) => state.goalText);
  const userContext = useConversationStore((state) => state.userContext);
  const previousAnswers = useConversationStore((state) => state.previousAnswers);
  const questions = useConversationStore((state) => state.questions);
  const answers = useConversationStore((state) => state.answers);
  const isReeval = useConversationStore((state) => state.isReeval);
  const reevalGoalId = useConversationStore((state) => state.reevalGoalId);
  const setGoalText = useConversationStore((state) => state.setGoalText);
  const setQuestions = useConversationStore((state) => state.setQuestions);
  const setAnswer = useConversationStore((state) => state.setAnswer);

  useEffect(() => {
    if (isReeval) {
      setStep('primer');
    } else {
      loadQuestions();
    }
  }, []);

  useEffect(() => {
    setInputText(answers[currentIndex] ?? '');
  }, [currentIndex]);

  async function loadQuestions(preContext?: string, goalOverride?: string) {
    setLoadingMessage(preContext ? 'Tailoring questions...' : 'Understanding your goal...');
    setStep('loading');
    try {
      const { redefinedGoal: refined, questions: fetched } = await fetchGoalQuestions(
        goalOverride ?? goalText,
        preContext,
        userContext || undefined,
        isReeval ? previousAnswers : undefined
      );
      setRedefinedGoal(refined);
      setEditText(refined);
      setQuestions(fetched);
      setStep('confirming');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load questions.', [
        { text: 'Go back', onPress: () => router.back() },
      ]);
    }
  }

  function handlePrimerSubmit() {
    if (!primerWhat.trim()) return;
    const combined =
      primerWhat.trim() +
      (primerNotes.trim() ? `\n\nAdditional context: ${primerNotes.trim()}` : '');
    loadQuestions(combined);
  }

  function handleConfirmGoal() {
    const finalGoal = editingGoal ? editText.trim() : redefinedGoal;
    if (!finalGoal) return;
    setGoalText(finalGoal);
    setStep('questions');
  }

  async function handleReaskWithEdit() {
    const newGoal = editText.trim();
    if (!newGoal) return;
    setGoalText(newGoal);
    setEditingGoal(false);
    const preContext = isReeval
      ? primerWhat.trim() +
        (primerNotes.trim() ? `\n\nAdditional context: ${primerNotes.trim()}` : '')
      : undefined;
    await loadQuestions(preContext, newGoal);
  }

  async function handleNext() {
    if (!inputText.trim()) return;
    setAnswer(currentIndex, inputText.trim());

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      await handleGenerate({ ...answers, [currentIndex]: inputText.trim() });
    }
  }

  function handleBack() {
    if (step === 'questions') {
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else {
        setStep('confirming');
      }
    } else if (step === 'confirming') {
      if (isReeval) {
        setStep('primer');
      } else {
        router.back();
      }
    } else {
      router.back();
    }
  }

  async function handleGenerate(finalAnswers: Record<number, string>) {
    setLoadingMessage(isReeval ? 'Updating your roadmap...' : 'Building your roadmap...');
    setStep('generating');
    try {
      const activeGoal = useConversationStore.getState().goalText;
      const timelineMatch = activeGoal.match(/(\d+)\s*(month|year)/i);
      const timelineMonths = timelineMatch
        ? timelineMatch[2].toLowerCase() === 'year'
          ? parseInt(timelineMatch[1]) * 12
          : parseInt(timelineMatch[1])
        : 6;

      const context: Record<string, string> = {};
      questions.forEach((q, i) => {
        context[`q${i + 1}`] = q;
        context[`a${i + 1}`] = finalAnswers[i] ?? '';
      });

      if (isReeval && reevalGoalId) {
        const combined =
          primerWhat.trim() +
          (primerNotes.trim() ? `\n\nAdditional context: ${primerNotes.trim()}` : '');
        const { goalId } = await regenerateRoadmap({
          goalId: reevalGoalId,
          goal: activeGoal,
          timelineMonths,
          context,
          preContext: combined,
          userContext,
        });
        // Always write the updated goal text back — backend may not do this
        await supabase
          .from('goals')
          .update({ goal_text: activeGoal })
          .eq('id', reevalGoalId);
        // If the backend created a brand-new goal, archive the old one
        if (goalId !== reevalGoalId) {
          await supabase
            .from('goals')
            .update({ status: 'abandoned' })
            .eq('id', reevalGoalId);
        }
        router.replace({ pathname: '/roadmap-preview', params: { goalId, reeval: 'true' } });
      } else {
        const { goalId } = await generateRoadmap({ goal: activeGoal, timelineMonths, context, userContext });
        router.replace({ pathname: '/roadmap-preview', params: { goalId } });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate roadmap. Please try again.');
      setStep('questions');
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (step === 'loading' || step === 'generating') {
    return (
      <View style={styles.centered}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </View>
    );
  }

  // ── Primer (reeval only) ─────────────────────────────────────────────────
  if (step === 'primer') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <StatusBar style={colors.statusBar} />
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={[styles.scrollInner, { paddingTop: insets.top + 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.primerLabel}>CURRENT GOAL</Text>
          <Text style={styles.primerGoal}>{goalText}</Text>

          <Text style={styles.primerQuestion}>What's changed, or what do you want to adjust?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. My timeline changed, I want to focus on different skills, I got promoted..."
            placeholderTextColor={colors.placeholder}
            value={primerWhat}
            onChangeText={setPrimerWhat}
            multiline
            autoFocus
            textAlignVertical="top"
          />

          <Text style={styles.primerNotesLabel}>Anything else the AI should know?</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="e.g. I can only work on this on weekdays, I have a budget constraint, I'm also learning X..."
            placeholderTextColor={colors.placeholder}
            value={primerNotes}
            onChangeText={setPrimerNotes}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextButton, !primerWhat.trim() && styles.nextButtonDisabled]}
            onPress={handlePrimerSubmit}
            disabled={!primerWhat.trim()}
          >
            <Text style={styles.nextButtonText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Confirming ───────────────────────────────────────────────────────────
  if (step === 'confirming') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <StatusBar style={colors.statusBar} />

        <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.confirmLabel}>
            {isReeval ? 'We understood the update as' : 'We understood your goal as'}
          </Text>

          {editingGoal ? (
            <TextInput
              style={styles.goalEditInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              textAlignVertical="top"
              placeholderTextColor={colors.placeholder}
            />
          ) : (
            <Text style={styles.goalText}>{redefinedGoal}</Text>
          )}

          <TouchableOpacity onPress={() => setEditingGoal(!editingGoal)}>
            <Text style={styles.editToggle}>
              {editingGoal ? 'Cancel edit' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          {editingGoal ? (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.continueLink}
                onPress={handleConfirmGoal}
                disabled={!editText.trim()}
              >
                <Text style={[styles.continueLinkText, !editText.trim() && styles.continueLinkDisabled]}>
                  Continue anyway
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextButton, !editText.trim() && styles.nextButtonDisabled]}
                onPress={handleReaskWithEdit}
                disabled={!editText.trim()}
              >
                <Text style={styles.nextButtonText}>Re-ask with this →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.nextButton} onPress={handleConfirmGoal}>
              <Text style={styles.nextButtonText}>Looks right →</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Questions ────────────────────────────────────────────────────────────
  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const canAdvance = inputText.trim().length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style={colors.statusBar} />

      <View style={[styles.progressContainer, { paddingTop: insets.top + 16 }]}>
        {questions.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentIndex && styles.dotActive,
              i < currentIndex && styles.dotDone,
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        <Text style={styles.stepLabel}>
          Question {currentIndex + 1} of {questions.length}
        </Text>
        <Text style={styles.question}>{question}</Text>

        <TextInput
          style={styles.input}
          placeholder="Your answer..."
          placeholderTextColor={colors.placeholder}
          value={inputText}
          onChangeText={setInputText}
          multiline
          autoFocus
          textAlignVertical="top"
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, !canAdvance && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canAdvance}
        >
          <Text style={styles.nextButtonText}>
            {isLast ? (isReeval ? 'Update Roadmap' : 'Generate Roadmap') : 'Next →'}
          </Text>
        </TouchableOpacity>
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
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      gap: 16,
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
    },

    // ── Primer ───────────────────────────────────────────────────────────
    scrollContent: {
      flex: 1,
    },
    scrollInner: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      paddingTop: 16,
    },
    primerLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 1.2,
      marginBottom: 8,
      marginTop: 8,
    },
    primerGoal: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 26,
      marginBottom: 32,
      padding: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
    },
    primerQuestion: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 30,
      marginBottom: 16,
    },
    primerNotesLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 20,
      marginBottom: 10,
    },
    notesInput: {
      minHeight: 80,
    },

    // ── Progress dots ─────────────────────────────────────────────────────
    progressContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingTop: 16,
      marginBottom: 32,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      backgroundColor: colors.primary,
      width: 24,
    },
    dotDone: {
      backgroundColor: colors.primary,
      opacity: 0.4,
    },

    // ── Content ───────────────────────────────────────────────────────────
    content: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: 'center',
    },
    confirmLabel: {
      fontSize: 14,
      color: colors.placeholder,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 16,
    },
    goalText: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 34,
      marginBottom: 20,
    },
    goalEditInput: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      minHeight: 100,
      marginBottom: 16,
      lineHeight: 30,
      backgroundColor: colors.inputBackground,
    },
    editToggle: {
      fontSize: 15,
      color: colors.primary,
    },
    stepLabel: {
      fontSize: 13,
      color: colors.placeholder,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    question: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 32,
      marginBottom: 32,
    },
    input: {
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      minHeight: 120,
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },

    // ── Footer ────────────────────────────────────────────────────────────
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 24,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    backButton: {
      padding: 12,
    },
    backButtonText: {
      fontSize: 16,
      color: colors.primary,
    },
    nextButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    nextButtonDisabled: {
      opacity: 0.4,
    },
    editActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    continueLink: {
      padding: 8,
    },
    continueLinkText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    continueLinkDisabled: {
      opacity: 0.4,
    },
    nextButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
