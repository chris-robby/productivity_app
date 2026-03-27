import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useConversationStore } from '../store/conversationStore';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/colors';

type Step = 'goal' | 'context';

export default function GoalSetupScreen() {
  const [step, setStep] = useState<Step>('goal');
  const [goalText, setGoalText] = useState('');
  const [userContext, setUserContext] = useState('');

  const router = useRouter();
  const setGoalTextInStore = useConversationStore((state) => state.setGoalText);
  const setUserContextInStore = useConversationStore((state) => state.setUserContext);
  const reset = useConversationStore((state) => state.reset);

  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  function handleGoalNext() {
    if (!goalText.trim()) return;
    setStep('context');
  }

  function handleStart() {
    reset();
    setGoalTextInStore(goalText.trim());
    setUserContextInStore(userContext.trim());
    router.push('/conversation');
  }

  const examples = [
    'Get promoted to senior engineer in 6 months',
    'Learn to code and build my first app',
    'Run a marathon by end of year',
    'Start a profitable side business',
  ];

  if (step === 'context') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <StatusBar style={colors.statusBar} />

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setStep('goal')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Tell us about yourself</Text>
            <Text style={styles.subtitle}>
              Help the AI personalise your roadmap. This is optional — skip if you prefer.
            </Text>
          </View>

          <Text style={styles.contextLabel}>YOUR GOAL</Text>
          <Text style={styles.contextGoalPreview} numberOfLines={2}>{goalText.trim()}</Text>

          <Text style={styles.contextInputLabel}>About you & any constraints</Text>
          <TextInput
            style={styles.contextInput}
            placeholder="e.g. I work full time with about 1 hour free each evening. I'm a complete beginner. I have a limited budget and can only work on weekdays..."
            placeholderTextColor={colors.placeholder}
            value={userContext}
            onChangeText={setUserContext}
            multiline
            autoFocus
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.skipBtn} onPress={handleStart}>
            <Text style={styles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.startButton, !userContext.trim() && styles.startButtonDisabled]}
            onPress={handleStart}
            disabled={!userContext.trim()}
          >
            <Text style={styles.startButtonText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style={colors.statusBar} />

      {router.canGoBack() && (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>What is your goal?</Text>
          <Text style={styles.subtitle}>
            I'll build you a personalised roadmap to achieve it.
          </Text>
        </View>

        <View style={styles.examples}>
          {examples.map((example, index) => (
            <TouchableOpacity
              key={index}
              style={styles.exampleItem}
              onPress={() => setGoalText(example)}
            >
              <Text style={styles.exampleText}>{example}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputArea}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Set your vision..."
            placeholderTextColor={colors.placeholder}
            value={goalText}
            onChangeText={setGoalText}
            multiline
            textAlignVertical="top"
            autoFocus
          />
          <TouchableOpacity
            style={[styles.sendBtn, !goalText.trim() && styles.sendBtnDisabled]}
            onPress={handleGoalNext}
            disabled={!goalText.trim()}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
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
    backBtn: {
      position: 'absolute',
      top: 60,
      left: 20,
      zIndex: 10,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 80,
      justifyContent: 'center',
    },
    scrollContent: {
      flex: 1,
    },
    scrollInner: {
      paddingHorizontal: 20,
      paddingTop: 80,
      paddingBottom: 24,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    inputArea: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    inputRow: {
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
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      maxHeight: 120,
      lineHeight: 22,
      paddingVertical: 4,
    },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    sendBtnDisabled: {
      opacity: 0.35,
    },
    // kept for context step (unused in goal step now):
    startButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    startButtonDisabled: {
      opacity: 0.4,
    },
    startButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    startButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    startButtonDisabled: {
      opacity: 0.4,
    },
    startButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    examples: {
      gap: 8,
      marginTop: 8,
    },
    exampleItem: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    exampleText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    // ── Context step ─────────────────────────────────────────────────────────
    contextLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 1.2,
      marginBottom: 6,
    },
    contextGoalPreview: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      backgroundColor: colors.surface,
      padding: 14,
      borderRadius: 10,
      marginBottom: 28,
      lineHeight: 22,
    },
    contextInputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 10,
    },
    contextInput: {
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      fontSize: 15,
      minHeight: 140,
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    skipBtn: {
      padding: 12,
    },
    skipBtnText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
  });
}
