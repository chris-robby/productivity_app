import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/colors';
import { Goal } from '../types';

export default function GoalOverviewScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);

  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  useFocusEffect(
    useCallback(() => {
      loadGoals();
    }, [])
  );

  async function loadGoals() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('goals')
        .select('*')
        .eq('status', 'active')
        .order('created_at');
      setGoals((data as Goal[]) ?? []);
    } finally {
      setLoading(false);
    }
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
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Goals</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {goals.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active goals yet.</Text>
          </View>
        ) : (
          goals.map((goal) => (
            <TouchableOpacity
              key={goal.id}
              style={styles.goalCard}
              onPress={() => router.push({ pathname: '/goal-detail', params: { id: goal.id } })}
              activeOpacity={0.75}
            >
              <Text style={styles.goalText} numberOfLines={2}>{goal.goal_text}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={styles.addGoalBtn}
          onPress={() => router.push('/goal-setup')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addGoalText}>Add New Goal</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
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
    backButton: {
      width: 24,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    content: {
      flex: 1,
      paddingTop: 12,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 80,
    },
    emptyText: {
      fontSize: 15,
      color: colors.textSecondary,
    },

    goalCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginBottom: 10,
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderRadius: 14,
    },
    goalText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 22,
      marginRight: 10,
    },

    // ── Add button ────────────────────────────────────────────────────────────
    addGoalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 8,
      paddingVertical: 16,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderStyle: 'dashed',
    },
    addGoalText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },

  });
}
