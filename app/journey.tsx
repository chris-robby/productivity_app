import { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday, isTomorrow, parseISO, addDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useGoalStore } from '../store/goalStore';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/colors';
import { DailyTask } from '../types';


interface DayPage {
  date: string;
  title: string;
  isToday: boolean;
  tasks: DailyTask[];
}

export default function JourneyScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<DayPage[]>([]);
  const [pageHeight, setPageHeight] = useState(0);
  const listRef = useRef<FlatList>(null);

  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const currentGoal = useGoalStore((state) => state.currentGoal);
  const roadmapPhases = useGoalStore((state) => state.roadmapPhases);

  useEffect(() => {
    loadJourney();
  }, []);

  async function loadJourney() {
    setLoading(true);
    try {
      let goal = currentGoal;
      let phases = roadmapPhases;

      if (!goal) {
        const { data: goals } = await supabase
          .from('goals')
          .select('*')
          .eq('status', 'active')
          .limit(1);
        if (!goals?.length) return;
        goal = goals[0];
        useGoalStore.getState().setCurrentGoal(goal);
        await useGoalStore.getState().loadGoal(goal.id);
        phases = useGoalStore.getState().roadmapPhases;
      } else if (!phases.length) {
        await useGoalStore.getState().loadGoal(goal.id);
        phases = useGoalStore.getState().roadmapPhases;
      }

      const startDate = phases[0]?.start_date ?? goal.created_at?.split('T')[0];
      const endDate = phases[phases.length - 1]?.end_date ?? goal.target_date;
      if (!startDate || !endDate) return;

      const { data: tasks } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('goal_id', goal.id)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date')
        .order('priority', { ascending: false });

      if (!tasks) return;

      const grouped: Record<string, DailyTask[]> = {};
      for (const task of tasks as DailyTask[]) {
        if (!grouped[task.scheduled_date]) grouped[task.scheduled_date] = [];
        grouped[task.scheduled_date].push(task);
      }

      // Build a page for every calendar day in the range, not just days with tasks
      const built: DayPage[] = [];
      let cursor = parseISO(startDate);
      const end = parseISO(endDate);
      while (cursor <= end) {
        const date = format(cursor, 'yyyy-MM-dd');
        const d = cursor;
        let title: string;
        if (isToday(d)) title = 'Today';
        else if (isYesterday(d)) title = 'Yesterday';
        else if (isTomorrow(d)) title = 'Tomorrow';
        else title = format(d, 'EEE, MMM d, yyyy');
        built.push({ date, title, isToday: isToday(d), tasks: grouped[date] ?? [] });
        cursor = addDays(cursor, 1);
      }

      setPages(built);

      // Scroll to today's page
      const todayIndex = built.findIndex((p) => p.isToday);
      if (todayIndex !== -1) {
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            index: todayIndex,
            animated: false,
          });
        }, 300);
      }
    } finally {
      setLoading(false);
    }
  }

  function renderPage({ item }: { item: DayPage }) {
    const isPast = !item.isToday && parseISO(item.date) < new Date();

    return (
      <View style={[styles.page, pageHeight > 0 && { height: pageHeight }]}>
        {/* Day header */}
        <View style={[styles.dayHeader, item.isToday && styles.dayHeaderToday]}>
          <Text
            style={[styles.dayTitle, item.isToday && styles.dayTitleToday]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {item.isToday && (
            <View style={styles.todayPill}>
              <Text style={styles.todayPillText}>TODAY</Text>
            </View>
          )}
        </View>

        {/* Task list — scrollable within the page if needed */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.taskListContent}
        >
          {item.tasks.length === 0 ? (
            <Text style={styles.emptyDay}>No tasks scheduled</Text>
          ) : null}
          {item.tasks.map((task) => {
            const isDone = task.completed;
            const isFailed = task.failed && !task.completed;

            return (
              <View
                key={task.id}
                style={[
                  styles.taskCard,
                  isDone && styles.taskCardDone,
                  isFailed && styles.taskCardFailed,
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    isDone && styles.checkboxDone,
                    isFailed && styles.checkboxFailed,
                  ]}
                >
                  {isDone && <Ionicons name="checkmark" size={14} color="#fff" />}
                  {isFailed && <Ionicons name="close" size={14} color="#fff" />}
                </View>

                <View style={styles.taskContent}>
                  <Text
                    style={[
                      styles.taskTitle,
                      (isDone || isFailed) && styles.taskTitleCrossed,
                    ]}
                  >
                    {task.task_title}
                  </Text>
                  {isFailed && task.failure_reason ? (
                    <Text style={styles.failureReason}>
                      "{task.failure_reason}"
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Journey</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(item) => item.date}
        renderItem={renderPage}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
        onScrollToIndexFailed={() => {}}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No tasks found.</Text>
          </View>
        }
      />
    </View>
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
    },
    emptyText: {
      fontSize: 15,
      color: colors.textSecondary,
    },

    // ── App header ────────────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },

    // ── Full-screen day page ──────────────────────────────────────────────────
    page: {
      paddingHorizontal: 16,
    },
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingTop: 24,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 12,
    },
    dayHeaderToday: {
      borderBottomColor: colors.primary,
    },
    dayTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    dayTitleToday: {
      color: colors.primary,
    },
    todayPill: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 5,
    },
    todayPillText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.5,
    },

    // ── Task cards ────────────────────────────────────────────────────────────
    taskListContent: {
      gap: 10,
      paddingBottom: 20,
    },
    emptyDay: {
      fontSize: 14,
      color: colors.placeholder,
      fontStyle: 'italic',
      marginTop: 12,
    },
    taskCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
    },
    taskCardDone: {
      opacity: 0.6,
    },
    taskCardFailed: {
      opacity: 0.5,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.inputBorder,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      marginTop: 1,
    },
    checkboxDone: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkboxFailed: {
      backgroundColor: colors.error,
      borderColor: colors.error,
    },
    taskContent: {
      flex: 1,
    },
    taskTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      lineHeight: 21,
    },
    taskTitleCrossed: {
      textDecorationLine: 'line-through',
      color: colors.textSecondary,
    },
    failureReason: {
      fontSize: 12,
      color: colors.placeholder,
      fontStyle: 'italic',
      marginTop: 3,
      lineHeight: 16,
    },
  });
}
