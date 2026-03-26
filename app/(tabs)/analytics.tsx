import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../lib/supabase';
import { useGoalStore } from '../../store/goalStore';
import { useAppStore } from '../../store';
import { format, subDays } from 'date-fns';
import { useTheme } from '../../contexts/ThemeContext';
import { ColorPalette } from '../../constants/colors';

interface DailyStats {
  date: string;
  completed: number;
  total: number;
}

export default function AnalyticsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState<DailyStats[]>([]);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [topFailureReasons, setTopFailureReasons] = useState<
    { reason: string; count: number }[]
  >([]);
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const isDemoMode = useAppStore((state) => state.isDemoMode);

  const currentGoal = useGoalStore((state) => state.currentGoal);

  useEffect(() => {
    if (!isDemoMode) loadAnalytics();
  }, [isDemoMode]);

  async function loadAnalytics() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const stats: DailyStats[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');

        const { data: tasks } = await supabase
          .from('daily_tasks')
          .select('completed')
          .eq('scheduled_date', date);

        if (tasks) {
          stats.push({
            date,
            completed: tasks.filter((t) => t.completed).length,
            total: tasks.length,
          });
        }
      }
      setWeeklyStats(stats);

      const { data: allTasks } = await supabase
        .from('daily_tasks')
        .select('completed');

      if (allTasks) {
        setTotalTasks(allTasks.length);
        setTotalCompleted(allTasks.filter((t) => t.completed).length);
      }

      const { data: failures } = await supabase
        .from('task_failures')
        .select('user_reason')
        .eq('user_id', user.id)
        .limit(50);

      if (failures) {
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
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  }

  const avgCompletionRate =
    totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  const maxTasks = Math.max(...weeklyStats.map((s) => s.total), 1);

  return (
    <View style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
        {currentGoal && (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            🎯 {currentGoal.goal_text}
          </Text>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.statsCard}>
          <Text style={styles.cardTitle}>📈 Your Progress</Text>

          <View style={styles.mainStat}>
            <Text style={styles.mainStatValue}>{avgCompletionRate}%</Text>
            <Text style={styles.mainStatLabel}>Average Completion Rate</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalCompleted}</Text>
              <Text style={styles.statLabel}>Tasks Completed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {totalTasks - totalCompleted}
              </Text>
              <Text style={styles.statLabel}>Tasks Incomplete</Text>
            </View>
          </View>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Last 7 Days</Text>

          <View style={styles.chart}>
            {weeklyStats.map((stat, index) => {
              const completionRate =
                stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;
              const height = stat.total > 0 ? (stat.total / maxTasks) * 100 : 0;
              const barColor =
                completionRate >= 80
                  ? colors.success
                  : completionRate >= 50
                  ? colors.highlight
                  : colors.error;

              return (
                <View key={index} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        { height: `${height}%`, backgroundColor: barColor },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>
                    {format(new Date(stat.date), 'EEE')[0]}
                  </Text>
                  <Text style={styles.barValue}>
                    {stat.completed}/{stat.total}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {topFailureReasons.length > 0 && (
          <View style={styles.reasonsCard}>
            <Text style={styles.cardTitle}>🔍 Common Incomplete Reasons</Text>

            {topFailureReasons.map((item, index) => (
              <View key={index} style={styles.reasonItem}>
                <View style={styles.reasonRank}>
                  <Text style={styles.reasonRankText}>{index + 1}</Text>
                </View>
                <View style={styles.reasonContent}>
                  <Text style={styles.reasonText}>{item.reason}</Text>
                  <Text style={styles.reasonCount}>{item.count}x</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.insightsCard}>
          <Text style={styles.cardTitle}>💡 Insights</Text>

          {avgCompletionRate >= 80 ? (
            <Text style={styles.insightText}>
              🎉 Excellent work! You're completing {avgCompletionRate}% of your
              tasks. Keep up the momentum!
            </Text>
          ) : avgCompletionRate >= 60 ? (
            <Text style={styles.insightText}>
              👍 You're doing well at {avgCompletionRate}%. Try to identify
              patterns in incomplete tasks to improve further.
            </Text>
          ) : (
            <Text style={styles.insightText}>
              💪 You're at {avgCompletionRate}% completion. Consider reviewing
              your task load or breaking tasks into smaller steps.
            </Text>
          )}
        </View>

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
      padding: 20,
      paddingTop: 60,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.primary,
    },
    content: {
      flex: 1,
    },
    statsCard: {
      backgroundColor: colors.surface,
      margin: 16,
      padding: 20,
      borderRadius: 12,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    mainStat: {
      alignItems: 'center',
      marginBottom: 24,
    },
    mainStatValue: {
      fontSize: 48,
      fontWeight: 'bold',
      color: colors.primary,
    },
    mainStatLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 16,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    chartCard: {
      backgroundColor: colors.surface,
      margin: 16,
      marginTop: 0,
      padding: 20,
      borderRadius: 12,
    },
    chart: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      height: 150,
    },
    barContainer: {
      flex: 1,
      alignItems: 'center',
    },
    barWrapper: {
      width: '100%',
      height: 120,
      justifyContent: 'flex-end',
      paddingHorizontal: 4,
    },
    bar: {
      width: '100%',
      borderRadius: 4,
      minHeight: 4,
    },
    barLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
      fontWeight: '600',
    },
    barValue: {
      fontSize: 10,
      color: colors.placeholder,
    },
    reasonsCard: {
      backgroundColor: colors.surface,
      margin: 16,
      marginTop: 0,
      padding: 20,
      borderRadius: 12,
    },
    reasonItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    reasonRank: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    reasonRankText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    reasonContent: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    reasonText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    reasonCount: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    insightsCard: {
      backgroundColor: colors.surface,
      margin: 16,
      marginTop: 0,
      padding: 20,
      borderRadius: 12,
    },
    insightText: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },
  });
}
