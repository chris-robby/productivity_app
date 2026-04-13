import { useEffect, useState, useRef } from 'react';
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
import { getActiveGoal, getTasksForDateRange } from '../services/database/adapter';
import { useGoalStore } from '../store/goalStore';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { ColorPalette } from '../constants/colors';
import { ScreenHeader } from '../components/ScreenHeader';
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

  const { styles, colors } = useThemedStyles(getStyles);

  const currentGoal = useGoalStore((state) => state.currentGoal);
  const roadmapPhases = useGoalStore((state) => state.roadmapPhases);

  useEffect(() => {
    loadJourney();
  }, []);

  async function loadJourney() {
    setLoading(true);
    try {
      // 1. Resolve the current goal — prefer store cache, fall back to adapter
      let goal = currentGoal;
      if (!goal) {
        goal = await getActiveGoal();
        if (!goal) return;
        useGoalStore.getState().setCurrentGoal(goal);
        await useGoalStore.getState().loadGoal(goal.id);
      }

      // 2. Resolve phases — only premium AI-generated goals have them
      const phases = useGoalStore.getState().roadmapPhases;

      // 3. Derive date range — prefer phase boundaries, fall back to goal dates
      const startDate =
        phases.length > 0
          ? phases[0].start_date
          : goal.created_at?.split('T')[0] ?? format(new Date(), 'yyyy-MM-dd');

      const endDate =
        phases.length > 0
          ? phases[phases.length - 1].end_date
          : goal.target_date;

      if (!startDate || !endDate) return;

      // 4. Load tasks via adapter (SQLite for free, Supabase for premium)
      const tasks = await getTasksForDateRange(goal.id, startDate, endDate);

      // 5. Group by date
      const grouped: Record<string, DailyTask[]> = {};
      for (const task of tasks) {
        if (!grouped[task.scheduled_date]) grouped[task.scheduled_date] = [];
        grouped[task.scheduled_date].push(task);
      }

      // 6. Build one page per calendar day in the range
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

      // 7. Scroll to today
      const todayIndex = built.findIndex((p) => p.isToday);
      if (todayIndex !== -1) {
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index: todayIndex, animated: false });
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
                  {isDone && <Ionicons name="checkmark" size={14} color={colors.textOnPrimary} />}
                  {isFailed && <Ionicons name="close" size={14} color={colors.textOnPrimary} />}
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

      <ScreenHeader title="Journey" />

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

    // ── Full-screen day page ──────────────────────────────────────────────────
    page: {
      paddingHorizontal: 20,
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
      color: colors.textOnPrimary,
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
      borderRadius: 0,
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
