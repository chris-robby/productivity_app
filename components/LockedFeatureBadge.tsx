import { useState } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PaywallSheet } from './PaywallSheet';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { ColorPalette } from '../constants/colors';

interface Props {
  /** Wraps children — tapping opens the paywall */
  children?: React.ReactNode;
  style?: ViewStyle;
}

export function LockedFeatureBadge({ children, style }: Props) {
  const [showPaywall, setShowPaywall] = useState(false);
  const { styles, colors } = useThemedStyles(getStyles);

  return (
    <>
      <TouchableOpacity
        style={[styles.badge, style]}
        onPress={() => setShowPaywall(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="lock-closed" size={12} color={colors.textOnPrimary} />
        {children}
      </TouchableOpacity>

      <PaywallSheet visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
  });
}
