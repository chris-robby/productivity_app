import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useAppStore } from '../../store';
import { getTodayTasks, toggleTaskCompletion } from '../../services/database/tasks';
import { getCurrentGoal, updateGoalProgress } from '../../services/database/goals';
import { format } from 'date-fns';

export default function HomeScreen({ navigation }: any) {
  const { todayTasks, setTodayTasks, currentGoal, setCurrentGoal, toggleTaskComplete } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [tasks, goal] = await Promise.all([
        getTodayTasks(),
        getCurrentGoal(),
      ]);
      
      setTodayTasks(tasks);
      setCurrentGoal(goal);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggleTask = async (taskId: string) => {
    const task = todayTasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      await toggleTaskCompletion(taskId, !task.completed);
      toggleTaskComplete(taskId);
      
      if (currentGoal) {
        await updateGoalProgress(currentGoal.id);
      }
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const completedCount = todayTasks.filter(t => t.completed).length;
  const totalCount = todayTasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!currentGoal) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Active Goal</Text>
        <Text style={styles.emptyText}>
          Start by setting up your goal to get a personalized roadmap!
        </Text>
        <TouchableOpacity
          style={styles.setupButton}
          onPress={() => navigation.navigate('GoalSetup')}
        >
          <Text style={styles.setupButtonText}>Set Up My Goal</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>
        <Text style={styles.goalTitle}>🎯 {currentGoal.goal_text}</Text>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Today's Progress</Text>
          <Text style={styles.progressCount}>
            {completedCount}/{totalCount} tasks
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressPercent}>{Math.round(progressPercent)}%</Text>
      </View>

      <View style={styles.tasksSection}>
        <Text style={styles.sectionTitle}>📋 Today's Tasks</Text>
        
        {todayTasks.length === 0 ? (
          <View style={styles.emptyTasks}>
            <Text style={styles.emptyTasksText}>No tasks scheduled for today</Text>
          </View>
        ) : (
          todayTasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={styles.taskCard}
              onPress={() => handleToggleTask(task.id)}
            >
              <View style={styles.taskLeft}>
                <View style={[styles.checkbox, task.completed && styles.checkboxChecked]}>
                  {task.completed && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.taskContent}>
                  <Text style={[styles.taskTitle, task.completed && styles.taskTitleCompleted]}>
                    {task.task_title}
                  </Text>
                  {task.task_description && (
                    <Text style={styles.taskDescription}>{task.task_description}</Text>
                  )}
                  <View style={styles.taskMeta}>
                    <Text style={styles.taskTime}>⏱️ {task.estimated_minutes} min</Text>
                    <View style={[
                      styles.priorityBadge,
                      task.priority === 'high' && styles.priorityHigh,
                      task.priority === 'medium' && styles.priorityMedium,
                      task.priority === 'low' && styles.priorityLow,
                    ]}>
                      <Text style={styles.priorityText}>{task.priority}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
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
    marginBottom: 24,
    lineHeight: 24,
  },
  setupButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  setupButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFF',
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  progressSection: {
    backgroundColor: '#FFF',
    padding: 20,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  progressCount: {
    fontSize: 14,
    color: '#666',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
    textAlign: 'center',
  },
  tasksSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  emptyTasks: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTasksText: {
    fontSize: 16,
    color: '#999',
  },
  taskCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  taskLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCC',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskTime: {
    fontSize: 12,
    color: '#666',
    marginRight: 12,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityHigh: {
    backgroundColor: '#FF3B30',
  },
  priorityMedium: {
    backgroundColor: '#FF9500',
  },
  priorityLow: {
    backgroundColor: '#34C759',
  },
  priorityText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
