import { useState, useMemo } from 'react';
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
import { useConversationStore } from '../store/conversationStore';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/colors';

export default function GoalSetupScreen() {
  const [goalText, setGoalText] = useState('');
  const router = useRouter();
  const setGoalTextInStore = useConversationStore((state) => state.setGoalText);
  const reset = useConversationStore((state) => state.reset);
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  function handleStart() {
    if (!goalText.trim()) return;
    reset();
    setGoalTextInStore(goalText.trim());
    router.push('/conversation');
  }

  const examples = [
    'Get promoted to senior engineer in 6 months',
    'Learn to code and build my first app',
    'Run a marathon by end of year',
    'Start a profitable side business',
  ];

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
          <Text style={styles.emoji}>🎯</Text>
          <Text style={styles.title}>What is your goal?</Text>
          <Text style={styles.subtitle}>
            I'll help you create a personalized roadmap to achieve it
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Type your goal here..."
            placeholderTextColor={colors.placeholder}
            value={goalText}
            onChangeText={setGoalText}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            autoFocus
          />

          <TouchableOpacity
            style={[
              styles.startButton,
              !goalText.trim() && styles.startButtonDisabled,
            ]}
            onPress={handleStart}
            disabled={!goalText.trim()}
          >
            <Text style={styles.startButtonText}>Start →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.examples}>
          <Text style={styles.examplesTitle}>💡 Examples:</Text>
          {examples.map((example, index) => (
            <TouchableOpacity
              key={index}
              style={styles.exampleItem}
              onPress={() => setGoalText(example)}
            >
              <Text style={styles.exampleText}>• {example}</Text>
            </TouchableOpacity>
          ))}
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
      padding: 20,
      paddingTop: 60,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
    },
    emoji: {
      fontSize: 64,
      marginBottom: 16,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    searchContainer: {
      marginBottom: 40,
    },
    searchInput: {
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      minHeight: 100,
      marginBottom: 16,
      color: colors.text,
      backgroundColor: colors.inputBackground,
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
      flex: 1,
    },
    examplesTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    exampleItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    exampleText: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },
  });
}
