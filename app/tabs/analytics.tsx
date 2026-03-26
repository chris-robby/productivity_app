import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { supabase } from '../../services/supabase';
import { useAppStore } from '../../store';
import { format, subDays } from 'date-fns';

export default function AnalyticsScreen() {
  const { currentGoal } = useAppStore();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [currentGoal]);

  const loadAnalytics = async () => {
    if (!currentGoal) {
      setIsLoading(false);
      return;
    }

    try {
      // Get last 7 days of snapshots
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), 6), 'yyyy-MM-dd');

      const { data: snapshots } = await supabase
        .from('progress_snapshots')
        .select('*')
        .eq('goal_id', currentGoal.id)
        .gte('snapshot_date', startDate)
        .lte('snapshot_date', endDate)
        .order('snapshot_date', { ascending: true });

      // Get failure reasons
      const { data: failures } = await supabase
        .from('task_failures')
        .select('ai_categorization, user_reason')
        .eq('user_id', currentGoal.user_id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Calculate stats
      const avgCompletion = snapshots && snapshots.length > 0
        ? snapshots.reduce((sum, s) => sum + s.completion_rate, 0) / snapshots.length
        : 0;

      // Count failure categories
      const failureCounts: Record<string, number> = {};
      failures?.forEach(f => {
        const cat = f.ai_categorization || 'other';
        failureCounts[cat] = (failureCounts[cat] || 0) + 1;
      });

      const topReasons = Object.entries(failureCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      setStats({
        snapshots: snapshots || [],
        avgCompletion,
        topReasons,
        totalTasks: currentGoal.total_tasks || 0,
        completedTasks: currentGoal.completed_tasks || 0,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!currentGoal || !stats) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Analytics Yet</Text>
        <Text style={styles.emptyText}>
          Complete some tasks to see your progress analytics!
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📈 Your Progress</Text>
      </View>

      {/* Overall Stats */}
      <View style={styles.statsCard}>
        <Text style={styles.cardTitle}>Overall Statistics</Text>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{Math.round(stats.avgCompletion)}%</Text>
            <Text style={styles.statLabel}>Avg Completion</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.completedTasks}</Text>
            <Text style={styles.statLabel}>Tasks Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalTasks}</Text>
            <Text style={styles.statLabel}>Total Tasks</Text>
          </View>
        </View>
      </View>

      {/* 7-Day Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Last 7 Days</Text>
        <View style={styles.chartContainer}>
          {stats.snapshots.map((snapshot: any, index: number) => {
            const height = snapshot.completion_rate;
            return (
              <View key={index} style={styles.barContainer}>
                <View style={styles.barBackground}>
                  <View style={[styles.bar, { height: `${height}%` }]} />
                </View>
                <Text style={styles.barLabel}>
                  {format(new Date(snapshot.snapshot_date), 'E').charAt(0)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Failure Reasons */}
      {stats.topReasons.length > 0 && (
        <View style={styles.reasonsCard}>
          <Text style={styles.cardTitle}>🔍 Common Challenges</Text>
          {stats.topReasons.map(([reason, count]: [string, number], index: number) => (
            <View key={index} style={styles.reasonItem}>
              <Text style={styles.reasonNumber}>{index + 1}.</Text>
              <Text style={styles.reasonText}>{formatReason(reason)}</Text>
              <Text style={styles.reasonCount}>({count}x)</Text>
            </View>
          ))}
        </View>
      )}

      {/* Goal Progress */}
      <View style={styles.goalCard}>
        <Text style={styles.cardTitle}>🎯 Goal Progress</Text>
        <Text style={styles.goalText}>{currentGoal.goal_text}</Text>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${currentGoal.current_completion_rate || 0}%` }
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round(currentGoal.current_completion_rate || 0)}% Complete
        </Text>
      </View>
    </ScrollView>
  );
}

function formatReason(reason: string): string {
  const mapping: Record<string, string> = {
    time: 'Ran out of time',
    energy: 'Low energy/tired',
    motivation: 'Lost motivation',
    external: 'Unexpected events',
    other: 'Other reasons',
  };
  return mapping[reason] || reason;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  statsCard: {
    backgroundColor: '#FFF',
    padding: 20,
    margin: 16,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: '#FFF',
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 120,
    alignItems: 'flex-end',
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barBackground: {
    width: 30,
    height: 100,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  reasonsCard: {
    backgroundColor: '#FFF',
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reasonNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginRight: 8,
    width: 20,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: '#000',
  },
  reasonCount: {
    fontSize: 14,
    color: '#666',
  },
  goalCard: {
    backgroundColor: '#FFF',
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 32,
    borderRadius: 12,
  },
  goalText: {
    fontSize: 16,
    color: '#000',
    marginBottom: 16,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
  },
});
