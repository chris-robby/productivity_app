import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ColorPalette } from '../constants/colors';

const FREE_FEATURES = [
  'Set goals manually',
  'Create your own daily tasks',
  'Track completions and streaks',
  'Basic analytics (7-day)',
  'Local notifications',
];

const PREMIUM_FEATURES = [
  'AI coach that refines your goal',
  'Personalised AI roadmap with phases',
  'Smart task suggestions',
  'Adaptive plan when you miss tasks',
  'Daily AI check-ins',
  'Full analytics and failure insights',
  'Cloud sync across devices',
  'Goal history across multiple goals',
];

export default function UpgradeScreen() {
  const { styles, colors } = useThemedStyles(getStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleUpgrade() {
    // Placeholder — wire up RevenueCat / Expo IAP here
    Alert.alert(
      'Coming Soon',
      'In-app purchase is not yet configured. Check back soon!',
      [{ text: 'OK' }]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={colors.statusBar} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.badge}>PREMIUM</Text>
        <Text style={styles.heading}>Achieve goals with AI by your side</Text>
        <Text style={styles.sub}>
          The free plan gets you started. Premium gets you there.
        </Text>

        {/* Comparison */}
        <View style={styles.comparisonRow}>
          {/* Free column */}
          <View style={[styles.comparisonCard, styles.freeCard]}>
            <Text style={styles.planLabel}>Free</Text>
            <Text style={styles.planPrice}>$0</Text>
            {FREE_FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark" size={14} color={colors.textSecondary} />
                <Text style={styles.featureTextSecondary}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Premium column */}
          <View style={[styles.comparisonCard, styles.premiumCard]}>
            <Text style={[styles.planLabel, { color: colors.textOnPrimary }]}>Premium</Text>
            <Text style={[styles.planPrice, { color: colors.textOnPrimary }]}>$X / mo</Text>
            {PREMIUM_FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.textOnPrimary} />
                <Text style={[styles.featureTextSecondary, { color: colors.textOnPrimary }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade}>
          <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
        </TouchableOpacity>

        <Text style={styles.legalText}>
          Cancel anytime. Billed monthly or annually.
        </Text>
      </ScrollView>
    </View>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      alignItems: 'flex-end',
    },
    scroll: { flex: 1 },
    scrollInner: { paddingHorizontal: 20 },

    badge: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 1.5,
      marginBottom: 12,
    },
    heading: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 32,
      marginBottom: 10,
    },
    sub: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: 28,
    },

    comparisonRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 28,
    },
    comparisonCard: {
      flex: 1,
      borderRadius: 16,
      padding: 16,
      gap: 8,
    },
    freeCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    premiumCard: {
      backgroundColor: colors.primary,
    },
    planLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    planPrice: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    featureTextSecondary: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },

    upgradeBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 14,
    },
    upgradeBtnText: {
      color: colors.textOnPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    legalText: {
      fontSize: 12,
      color: colors.placeholder,
      textAlign: 'center',
    },
  });
}
