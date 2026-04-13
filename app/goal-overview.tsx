import { useState, useCallback } from 'react';
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
import { getAllGoals } from '../services/database/adapter';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { ColorPalette } from '../constants/colors';
import { ScreenHeader } from '../components/ScreenHeader';
import { Goal } from '../types';

export default function GoalOverviewScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);

  const { styles, colors } = useThemedStyles(getStyles);

  useFocusEffect(
    useCallback(() => {
      loadGoals();
    }, [])
  );

  async function loadGoals() {
    setLoading(true);
    try {
      const all = await getAllGoals();
      setGoals(all.filter((g) => g.status === 'active'));
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
      <ScreenHeader title="Goals" />

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
      marginHorizontal: 20,
      marginBottom: 10,
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderRadius: 12,
    },
    goalText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 22,
      marginRight: 10,
    },
    addGoalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginTop: 8,
      paddingVertical: 16,
      borderRadius: 12,
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
