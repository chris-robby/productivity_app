import { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useGoalStore } from '../store/goalStore';
import { useTier } from '../store/tierStore';
import { regenerateRoadmap } from '../services/aiService';
import { format } from 'date-fns';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { ColorPalette } from '../constants/colors';
import { RoadmapPhase } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PHASE_PALETTES = [
  { header: '#1A4A8C', body: '#EEF4FF', accent: '#4A80C4', text: '#1A2E4A' },
  { header: '#5B1A8C', body: '#F5EEFF', accent: '#8A4AC4', text: '#2E1A4A' },
  { header: '#0D7A6B', body: '#EEFAF8', accent: '#1DA898', text: '#0D3530' },
  { header: '#8C3D1A', body: '#FFF3EE', accent: '#C46030', text: '#3A1A08' },
  { header: '#1A6B30', body: '#EEFAF2', accent: '#30A850', text: '#0D3518' },
] as const;

const GOLD = {
  header: '#7A5C00',
  body: '#FFFCEE',
  accent: '#C8960A',
  text: '#3A2E00',
};

type PhasePalette = (typeof PHASE_PALETTES)[number];

type CardData =
  | { type: 'phase'; phase: RoadmapPhase; palette: PhasePalette; index: number }
  | { type: 'results' };

export default function RoadmapPreviewScreen() {
  const { goalId, reeval } = useLocalSearchParams<{ goalId: string; reeval?: string }>();
  const isReeval = reeval === 'true';
  const router = useRouter();
  const navigation = useNavigation();
  const { styles, colors } = useThemedStyles(getStyles);
  const insets = useSafeAreaInsets();

  const currentGoal = useGoalStore((state) => state.currentGoal);
  const roadmapPhases = useGoalStore((state) => state.roadmapPhases);
  const loadGoal = useGoalStore((state) => state.loadGoal);
  const { isPremium } = useTier();

  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;

  const [editVisible, setEditVisible] = useState(false);
  const [contextValue, setContextValue] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (goalId) {
      loadGoal(goalId).finally(() => setLoading(false));
    }
  }, [goalId]);

  const cards: CardData[] = useMemo(() => {
    if (!roadmapPhases.length) return [];
    return [
      ...roadmapPhases.map((phase, i) => ({
        type: 'phase' as const,
        phase,
        palette: PHASE_PALETTES[i % PHASE_PALETTES.length],
        index: i,
      })),
      { type: 'results' as const },
    ];
  }, [roadmapPhases]);

  function navigateTo(nextIdx: number) {
    if (nextIdx === currentIndex || animating) return;
    if (nextIdx < 0 || nextIdx >= cards.length) return;

    const dir = nextIdx > currentIndex ? 1 : -1;
    setAnimating(true);

    Animated.timing(translateX, {
      toValue: -dir * SCREEN_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(nextIdx);
      translateX.setValue(dir * SCREEN_WIDTH);
      Animated.spring(translateX, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start(() => setAnimating(false));
    });
  }

  function handleStart() {
    if (isReeval) {
      router.back();
    } else {
      navigation.reset({ index: 0, routes: [{ name: '(tabs)' }] });
    }
  }

  function openEdit() {
    setContextValue(currentGoal?.user_context ?? '');
    setEditVisible(true);
  }

  async function handleRegenerate() {
    if (!currentGoal || !goalId) return;
    if (!isPremium) {
      Alert.alert('Premium Feature', 'Regenerating your roadmap is available on the premium plan.');
      return;
    }
    setRegenerating(true);
    try {
      await regenerateRoadmap({
        goalId,
        goal: currentGoal.goal_text,
        timelineMonths: currentGoal.timeline_months,
        context: currentGoal.initial_conversation ?? {},
        preContext: '',
        userContext: contextValue.trim(),
      });
      await loadGoal(goalId);
      setEditVisible(false);
      setCurrentIndex(0);
      translateX.setValue(0);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to regenerate. Please try again.');
    } finally {
      setRegenerating(false);
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

  if (!currentGoal || cards.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style={colors.statusBar} />
        <Text style={styles.loadingText}>Goal not found</Text>
      </View>
    );
  }

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === cards.length - 1;
  const card = cards[currentIndex];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={colors.statusBar} />

      {/* Progress dots */}
      <View style={styles.dots}>
        {cards.map((_, i) => {
          const isResultsDot = i === cards.length - 1;
          const isActive = i === currentIndex;
          const isPast = i < currentIndex;
          return (
            <View
              key={`dot-${i}`}
              style={[
                styles.dot,
                isPast && styles.dotPast,
                isActive && styles.dotActive,
                isResultsDot && !isActive && !isPast && styles.dotGold,
                isResultsDot && isActive && styles.dotGoldActive,
              ]}
            />
          );
        })}
      </View>

      {/* Animated card */}
      <Animated.View style={[styles.cardArea, { transform: [{ translateX }] }]}>
        {card.type === 'phase' ? (
          <PhaseCard
            phase={card.phase}
            palette={card.palette}
            phaseNumber={card.index + 1}
            totalPhases={cards.length - 1}
          />
        ) : (
          <ResultsCard goal={currentGoal} phases={roadmapPhases} />
        )}
      </Animated.View>

      {/* Navigation */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.backBtn, isFirst && styles.backBtnInvisible]}
          onPress={() => navigateTo(currentIndex - 1)}
          disabled={isFirst || animating}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextBtn, isLast && styles.nextBtnGold]}
          onPress={isLast ? handleStart : () => navigateTo(currentIndex + 1)}
          disabled={animating}
        >
          <Text style={styles.nextBtnText}>
            {isLast ? (isReeval ? 'Confirm Plan' : 'Start Plan') : 'Next'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      {/* Edit button — bottom right */}
      <View style={styles.editRow}>
        <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
          <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.editBtnText}>Edit Goal</Text>
        </TouchableOpacity>
      </View>

      {/* Edit / Regenerate modal */}
      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !regenerating && setEditVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            {regenerating ? (
              <View style={styles.regeneratingBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.regeneratingText, { color: colors.text }]}>
                  Rebuilding your roadmap...
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Update Your Context</Text>
                  <TouchableOpacity
                    onPress={() => setEditVisible(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                  Update your constraints or situation — we'll rebuild the plan without re-asking questions.
                </Text>

                <TextInput
                  style={[
                    styles.contextInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.primary,
                    },
                  ]}
                  value={contextValue}
                  onChangeText={setContextValue}
                  placeholder="e.g. I now have 2 hours free each evening, I have a £500 budget..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[styles.regenBtn, !contextValue.trim() && styles.regenBtnDisabled]}
                  onPress={handleRegenerate}
                  disabled={!contextValue.trim()}
                >
                  <Ionicons name="refresh-outline" size={18} color={colors.textOnPrimary} />
                  <Text style={styles.regenBtnText}>Regenerate Plan</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Phase Card ───────────────────────────────────────────────────────────────

function PhaseCard({
  phase,
  palette,
  phaseNumber,
  totalPhases,
}: {
  phase: RoadmapPhase;
  palette: PhasePalette;
  phaseNumber: number;
  totalPhases: number;
}) {
  return (
    <View style={[pcStyles.card, { backgroundColor: palette.body }]}>
      <View style={[pcStyles.header, { backgroundColor: palette.header }]}>
        <Text style={pcStyles.phaseOf}>
          PHASE {phaseNumber} OF {totalPhases}
        </Text>
        <Text style={pcStyles.phaseTitle}>{phase.phase_title}</Text>
        {phase.start_date && phase.end_date && (
          <Text style={pcStyles.dates}>
            {format(new Date(phase.start_date), 'MMM d')} —{' '}
            {format(new Date(phase.end_date), 'MMM d, yyyy')}
          </Text>
        )}
      </View>

      <ScrollView
        style={pcStyles.body}
        contentContainerStyle={pcStyles.bodyContent}
        showsVerticalScrollIndicator
        indicatorStyle="black"
      >
        <Text style={[pcStyles.description, { color: palette.text }]}>
          {phase.phase_description}
        </Text>

        {Array.isArray(phase.milestones) && phase.milestones.length > 0 && (
          <View style={pcStyles.weeks}>
            <Text style={[pcStyles.weeksLabel, { color: palette.accent }]}>WEEKLY FOCUS</Text>
            {phase.milestones.filter(w => w && w.focus).map((week, i) => (
              <View key={week.weekNumber ?? i} style={pcStyles.weekRow}>
                <View style={[pcStyles.weekDot, { backgroundColor: palette.accent }]} />
                <View style={pcStyles.weekText}>
                  <Text style={[pcStyles.weekFocus, { color: palette.text }]}>
                    <Text style={[pcStyles.weekNum, { color: palette.accent }]}>
                      {week.weekNumber ? `Wk ${week.weekNumber} · ` : ''}
                    </Text>
                    {week.focus}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const pcStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  phaseOf: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  phaseTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 34,
    marginBottom: 8,
  },
  dates: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 24,
    paddingBottom: 32,
  },
  description: {
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 20,
  },
  weeks: {
    gap: 14,
  },
  weeksLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  weekDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 9,
  },
  weekText: {
    flex: 1,
  },
  weekNum: {
    fontSize: 15,
    fontWeight: '700',
  },
  weekFocus: {
    fontSize: 16,
    lineHeight: 24,
  },
});

// ── Results Card ─────────────────────────────────────────────────────────────

function ResultsCard({ goal, phases }: { goal: any; phases: RoadmapPhase[] }) {
  return (
    <View style={[rcStyles.card, { backgroundColor: GOLD.body }]}>
      <View style={[rcStyles.header, { backgroundColor: GOLD.header }]}>
        <Text style={rcStyles.trophy}>🏆</Text>
        <Text style={rcStyles.title}>Expected Results</Text>
        <Text style={rcStyles.subtitle}>What completing this plan achieves</Text>
      </View>

      <ScrollView
        style={rcStyles.body}
        contentContainerStyle={rcStyles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[rcStyles.goalBox, { borderColor: GOLD.accent }]}>
          <Text style={[rcStyles.goalLabel, { color: GOLD.accent }]}>YOUR GOAL</Text>
          <Text style={[rcStyles.goalText, { color: GOLD.text }]}>{goal.goal_text}</Text>
          {goal.target_date && (
            <Text style={[rcStyles.target, { color: GOLD.accent }]}>
              🎯 Target: {format(new Date(goal.target_date), 'MMMM d, yyyy')}
            </Text>
          )}
        </View>

        <Text style={[rcStyles.outcomesTitle, { color: GOLD.accent }]}>WHAT YOU'LL COMPLETE</Text>

        {phases.map((phase, i) => (
          <View key={phase.phase_title ?? i} style={rcStyles.outcomeRow}>
            <View style={[rcStyles.check, { backgroundColor: GOLD.accent }]}>
              <Text style={rcStyles.checkText}>✓</Text>
            </View>
            <View style={rcStyles.outcomeRight}>
              <Text style={[rcStyles.outcomePhase, { color: GOLD.accent }]}>Phase {i + 1}</Text>
              <Text style={[rcStyles.outcomeTitle, { color: GOLD.text }]}>
                {phase.phase_title}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const rcStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  trophy: {
    fontSize: 44,
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFD700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 24,
    paddingBottom: 32,
  },
  goalBox: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  goalLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  goalText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 10,
  },
  target: {
    fontSize: 13,
    fontWeight: '600',
  },
  outcomesTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  outcomeRight: {
    flex: 1,
  },
  outcomePhase: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  outcomeTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
});

// ── Main Styles ──────────────────────────────────────────────────────────────

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
      fontSize: 16,
      color: colors.textSecondary,
    },

    // Progress dots
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 14,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 22,
      backgroundColor: colors.primary,
    },
    dotPast: {
      backgroundColor: colors.primary,
      opacity: 0.4,
    },
    dotGold: {
      backgroundColor: '#C8960A',
      opacity: 0.4,
    },
    dotGoldActive: {
      width: 22,
      opacity: 1,
      backgroundColor: '#FFD700',
    },

    // Card area
    cardArea: {
      flex: 1,
    },

    // Navigation
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    backBtnInvisible: {
      opacity: 0,
    },
    backBtnText: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 14,
    },
    nextBtnGold: {
      backgroundColor: '#B8860B',
    },
    nextBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },

    // Edit button row
    editRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editBtnText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },

    // Modal
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    modalSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
    },
    modalSub: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    contextInput: {
      borderWidth: 2,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      minHeight: 130,
      marginBottom: 16,
      lineHeight: 22,
    },
    regenBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 15,
      borderRadius: 14,
    },
    regenBtnDisabled: {
      opacity: 0.4,
    },
    regenBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    regeneratingBox: {
      alignItems: 'center',
      paddingVertical: 40,
      gap: 16,
    },
    regeneratingText: {
      fontSize: 16,
      fontWeight: '500',
    },
  });
}
