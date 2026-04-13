import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversationStore } from '../store/conversationStore';
import { useTier } from '../store/tierStore';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { ColorPalette } from '../constants/colors';

export default function GoalSetupScreen() {
  const [goalText, setGoalText] = useState('');

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setGoalTextInStore = useConversationStore((state) => state.setGoalText);
  const reset = useConversationStore((state) => state.reset);
  const { isFree } = useTier();

  const { styles, colors } = useThemedStyles(getStyles);

  function handleStart() {
    if (!goalText.trim()) return;
    reset();
    setGoalTextInStore(goalText.trim());
    // Free users → manual habit-setup flow
    // Premium users → AI conversation flow
    router.push(isFree ? '/habit-setup' : '/conversation');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style={colors.statusBar} />

      {/* Back button */}
      {router.canGoBack() && (
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 16 }]}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Centered content */}
      <View style={styles.center}>
        <Text style={styles.heading}>What is your goal?</Text>
        <Text style={styles.sub}>Be specific — the clearer your goal, the better your roadmap.</Text>

        <TextInput
          style={styles.input}
          placeholder="e.g. Run a marathon by end of year"
          placeholderTextColor={colors.placeholder}
          value={goalText}
          onChangeText={setGoalText}
          multiline
          textAlignVertical="top"
          autoFocus
          scrollEnabled={false}
        />

        <TouchableOpacity
          style={[styles.btn, !goalText.trim() && styles.btnDisabled]}
          onPress={handleStart}
          disabled={!goalText.trim()}
        >
          <Text style={styles.btnText}>Continue</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.textOnPrimary} />
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
    backBtn: {
      position: 'absolute',
      left: 20,
      zIndex: 10,
    },
    center: {
      flex: 1,
      paddingHorizontal: 20,
      justifyContent: 'center',
      paddingBottom: 40,
    },
    heading: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    sub: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 28,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.inputBorder,
      borderRadius: 16,
      padding: 18,
      fontSize: 16,
      color: colors.text,
      lineHeight: 24,
      minHeight: 160,
      textAlignVertical: 'top',
      marginBottom: 16,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 15,
      paddingHorizontal: 28,
      borderRadius: 12,
    },
    btnDisabled: {
      opacity: 0.35,
    },
    btnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
  });
}
