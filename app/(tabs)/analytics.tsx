import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  DimensionValue,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { getAnalyticsTasks, getFailureReasons, getAllGoals } from '../../services/database/adapter';
import { format, subDays, differenceInDays } from 'date-fns';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { ColorPalette } from '../../constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DonutChart from '../../components/DonutChart';
import { Goal } from '../../types';

const PIE_COLORS = ['#4A90C4', '#5DAA85', '#C4882A', '#E05C5C', '#9B6EC4'];

interface DailyStats {
  date: string;
  completed: number;
  total: number;
}

interface GoalStats {
  goal: Goal;
  totalTasks: number;
  totalCompleted: number;
  weeklyStats: DailyStats[];
}

export default function AnalyticsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [goalStats, setGoalStats] = useState<GoalStats[]>([]);
  const [topFailureReasons, setTopFailureReasons] = useState<
    { reason: string; count: number }[]
  >([]);
  const { styles, colors } = useThemedStyles(getStyles);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [])
  );

  async function loadAnalytics() {
    try {
      // Two queries: all active goals + all their tasks combined
      const allGoals = await getAllGoals();
      const activeGoals = allGoals.filter((g) => g.status === 'active');
      const allTasks = await getAnalyticsTasks();

      const today = format(new Date(), 'yyyy-MM-dd');

      const stats: GoalStats[] = activeGoals.map((goal) => {
        const goalTasks = allTasks.filter((t) => t.goal_id === goal.id);

        // Last 7 days, one entry per day
        const weeklyStats: DailyStats[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
          const dayTasks = goalTasks.filter((t) => t.scheduled_date === date);
          weeklyStats.push({
            date,
            completed: dayTasks.filter((t) => t.completed).length,
            total: dayTasks.length,
          });
        }

        // Completion rate: only tasks that were due (today or earlier)
        const dueTasks = goalTasks.filter((t) => t.scheduled_date <= today);
        return {
          goal,
          totalTasks: dueTasks.length,
          totalCompleted: dueTasks.filter((t) => t.completed).length,
          weeklyStats,
        };
      });

      setGoalStats(stats);

      const failures = await getFailureReasons();
      const reasonCounts: Record<string, number> = {};
      failures.forEach((f) => {
        const reason = f.user_reason || 'Unknown';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
      const sortedReasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopFailureReasons(sortedReasons);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.headerTitle}>Analytics</Text>
      </View>

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
        {goalStats.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No active goals found.</Text>
          </View>
        ) : (
          goalStats.map(({ goal, totalTasks, totalCompleted, weeklyStats }) => {
            const avgCompletionRate =
              totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

            const elapsedDays = Math.max(
              differenceInDays(new Date(), new Date(goal.created_at)),
              0
            );
            const totalDays = Math.max(
              differenceInDays(
                new Date(goal.target_date + 'T00:00:00'),
                new Date(goal.created_at)
              ),
              1
            );
            const timelineProgress = Math.min(elapsedDays / totalDays, 1);

            return (
              <View key={goal.id} style={styles.card}>
                {/* Goal name */}
                <Text style={styles.goalText} numberOfLines={2}>
                  {goal.goal_text}
                </Text>

                {/* Overall completion */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${avgCompletionRate}%` as DimensionValue },
                    ]}
                  />
                </View>
                <Text style={styles.progressLabel}>{avgCompletionRate}% complete</Text>

                {/* Timeline */}
                <Text style={styles.timelineLabel}>
                  Day {elapsedDays} of {totalDays}
                </Text>
                <View style={[styles.timelineTrack, { marginBottom: 20 }]}>
                  <View
                    style={[
                      styles.timelineFill,
                      { width: `${Math.round(timelineProgress * 100)}%` as DimensionValue },
                    ]}
                  />
                </View>

                {/* Last 7 days donuts */}
                <View style={styles.miniRow}>
                  {weeklyStats.map((stat) => {
                    const rate =
                      stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;
                    const dayColor =
                      stat.total === 0
                        ? colors.border
                        : rate >= 80
                        ? colors.success
                        : rate >= 50
                        ? colors.highlight
                        : colors.error;
                    return (
                      <View key={stat.date} style={styles.miniItem}>
                        <DonutChart
                          data={[
                            { value: stat.completed, color: dayColor },
                            {
                              value: Math.max(stat.total - stat.completed, 0),
                              color: colors.border,
                            },
                          ]}
                          size={44}
                          innerRadius={14}
                          emptyColor={colors.border}
                          backgroundColor={colors.surface}
                          gap={3}
                        />
                        <Text style={styles.miniDay}>
                          {format(new Date(stat.date + 'T00:00:00'), 'EEE')[0]}
                        </Text>
                        <Text style={styles.miniCount}>
                          {stat.completed}/{stat.total}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}

        {/* ── Common Incomplete Reasons (aggregated across all goals) ── */}
        {topFailureReasons.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Common Incomplete Reasons</Text>

            <View style={styles.pieRow}>
              <DonutChart
                data={topFailureReasons.map((item, i) => ({
                  value: item.count,
                  color: PIE_COLORS[i % PIE_COLORS.length],
                }))}
                size={160}
                innerRadius={0}
                emptyColor={colors.border}
                backgroundColor={colors.surface}
                gap={2}
              />

              <View style={styles.pieLegend}>
                {topFailureReasons.map((item, i) => (
                  <View key={item.reason} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: PIE_COLORS[i % PIE_COLORS.length] },
                      ]}
                    />
                    <Text style={styles.legendLabel} numberOfLines={1}>
                      {item.reason}
                    </Text>
                    <Text style={styles.legendValue}>{item.count}x</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    card: {
      backgroundColor: colors.surface,
      margin: 16,
      marginBottom: 0,
      padding: 20,
      borderRadius: 12,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 8,
    },

    // ── Per-goal card ──
    goalText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 22,
      marginBottom: 16,
    },
    progressTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginBottom: 6,
    },
    progressFill: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    progressLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    timelineLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    timelineTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    timelineFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },

    // ── Last 7 days donuts ──
    miniRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    miniItem: {
      alignItems: 'center',
      gap: 4,
    },
    miniDay: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    miniCount: {
      fontSize: 10,
      color: colors.placeholder,
    },

    // ── Reasons pie card ──
    pieRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
    },
    pieLegend: {
      flex: 1,
      gap: 10,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendLabel: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
    },
    legendValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
  });
}
