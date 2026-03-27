import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useGoalStore } from '../store/goalStore';
import { format } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/colors';

export default function RoadmapPreviewScreen() {
  const { goalId, reeval } = useLocalSearchParams<{ goalId: string; reeval?: string }>();
  const isReeval = reeval === 'true';
  const router = useRouter();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const currentGoal = useGoalStore((state) => state.currentGoal);
  const roadmapPhases = useGoalStore((state) => state.roadmapPhases);
  const loadGoal = useGoalStore((state) => state.loadGoal);

  useEffect(() => {
    if (goalId) {
      loadGoal(goalId).finally(() => setLoading(false));
    }
  }, [goalId]);

  function handleStartTasks() {
    if (isReeval) {
      // Go back to goal-detail — conversation was replaced so it sits directly below
      router.back();
    } else {
      // Reset the entire stack so goal-setup/conversation don't remain in history
      navigation.reset({ index: 0, routes: [{ name: '(tabs)' }] });
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Creating your roadmap...</Text>
      </View>
    );
  }

  if (!currentGoal) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style={colors.statusBar} />
        <Text style={styles.loadingText}>Goal not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.title}>
            {isReeval ? 'Your Plan is Updated!' : 'Your Roadmap is Ready!'}
          </Text>
          <Text style={styles.subtitle}>
            {isReeval
              ? 'Review your updated plan below before confirming'
              : "Here's your personalized plan to achieve your goal"}
          </Text>
        </View>

        <View style={styles.goalCard}>
          <Text style={styles.goalLabel}>🎯 Your Goal</Text>
          <Text style={styles.goalText}>{currentGoal.goal_text}</Text>

          <View style={styles.goalMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Timeline</Text>
              <Text style={styles.metaValue}>
                {currentGoal.timeline_months} months
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Target Date</Text>
              <Text style={styles.metaValue}>
                {format(new Date(currentGoal.target_date), 'MMM d, yyyy')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Your Personalized Plan</Text>

          {roadmapPhases.map((phase) => (
            <View key={phase.id} style={styles.phaseCard}>
              <Text style={styles.phaseNumber}>Phase {phase.phase_number}</Text>
              <Text style={styles.phaseTitle}>{phase.phase_title}</Text>
              <Text style={styles.phaseDescription}>
                {phase.phase_description}
              </Text>

              {phase.milestones && phase.milestones.length > 0 && (
                <View style={styles.milestones}>
                  <Text style={styles.milestonesTitle}>Weekly Focus:</Text>
                  {phase.milestones.slice(0, 3).map((week, idx) => (
                    <View key={idx} style={styles.weekItem}>
                      <Text style={styles.weekText}>
                        Week {week.weekNumber}: {week.focus}
                      </Text>
                    </View>
                  ))}
                  {phase.milestones.length > 3 && (
                    <Text style={styles.moreText}>
                      + {phase.milestones.length - 3} more weeks
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.nextSteps}>
          <Text style={styles.nextStepsTitle}>What's Next?</Text>
          <Text style={styles.nextStepsText}>• Daily tasks have been created for the next 2 weeks</Text>
          <Text style={styles.nextStepsText}>• Complete tasks each day to stay on track</Text>
          <Text style={styles.nextStepsText}>• AI will adjust your plan based on your progress</Text>
          <Text style={styles.nextStepsText}>• Review your analytics to see how you're doing</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartTasks}
        >
          <Text style={styles.startButtonText}>
            {isReeval ? 'Confirm Updated Plan →' : 'Start Daily Tasks →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      gap: 16,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textSecondary,
    },
    content: {
      flex: 1,
    },
    header: {
      alignItems: 'center',
      padding: 24,
      paddingTop: 60,
    },
    successEmoji: {
      fontSize: 64,
      marginBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    goalCard: {
      backgroundColor: colors.surface,
      margin: 16,
      padding: 20,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    goalLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    goalText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
      lineHeight: 28,
    },
    goalMeta: {
      flexDirection: 'row',
      gap: 16,
    },
    metaItem: {
      flex: 1,
    },
    metaLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    metaValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
    },
    phaseCard: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
    },
    phaseNumber: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 4,
    },
    phaseTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    phaseDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    milestones: {
      marginTop: 8,
    },
    milestonesTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    weekItem: {
      marginBottom: 6,
    },
    weekText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    moreText: {
      fontSize: 12,
      color: colors.placeholder,
      marginTop: 4,
    },
    nextSteps: {
      backgroundColor: colors.surface,
      margin: 16,
      padding: 20,
      borderRadius: 12,
    },
    nextStepsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    nextStepsText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 24,
      marginBottom: 8,
    },
    footer: {
      padding: 16,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    startButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    startButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
  });
}
