import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ColorPalette } from '../constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const FEATURES = [
  { icon: 'sparkles-outline', label: 'AI goal coach that asks smart questions' },
  { icon: 'map-outline', label: 'Personalised AI-generated roadmap' },
  { icon: 'refresh-outline', label: 'Adaptive plan adjustments when you miss tasks' },
  { icon: 'chatbubble-outline', label: 'Daily AI check-ins and motivation' },
  { icon: 'cloud-upload-outline', label: 'Cloud sync across all your devices' },
  { icon: 'analytics-outline', label: 'Deep analytics and failure pattern insights' },
];

export function PaywallSheet({ visible, onClose }: Props) {
  const { styles, colors } = useThemedStyles(getStyles);
  const router = useRouter();

  function handleUpgrade() {
    onClose();
    router.push('/upgrade');
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.title}>Unlock Premium</Text>
        <Text style={styles.subtitle}>
          Everything you need to actually achieve your goals.
        </Text>

        <ScrollView style={styles.featureList} showsVerticalScrollIndicator={false}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name={f.icon as any} size={20} color={colors.primary} />
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade}>
          <Text style={styles.upgradeBtnText}>See Premium Plans</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dismissBtn} onPress={onClose}>
          <Text style={styles.dismissText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
      maxHeight: '70%',
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },
    featureList: {
      marginBottom: 20,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    featureText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
      lineHeight: 20,
    },
    upgradeBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 12,
    },
    upgradeBtnText: {
      color: colors.textOnPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    dismissBtn: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    dismissText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
  });
}
