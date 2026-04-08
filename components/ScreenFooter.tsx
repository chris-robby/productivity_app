import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/colors';

interface ScreenFooterProps {
  onBack: () => void;
  children: React.ReactNode;
  /** Set to true when the footer should be absolutely positioned over a ScrollView. */
  absolute?: boolean;
}

/**
 * Standardised screen footer with a "← Back" button on the left and
 * custom content (e.g. a primary action button) on the right.
 *
 * Usage:
 *   <ScreenFooter onBack={handleBack} absolute>
 *     <TouchableOpacity style={styles.primaryBtn} onPress={handleNext}>
 *       <Text style={styles.primaryBtnText}>Next →</Text>
 *     </TouchableOpacity>
 *   </ScreenFooter>
 */
export function ScreenFooter({ onBack, children, absolute = false }: ScreenFooterProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View
      style={[
        styles.footer,
        absolute && styles.footerAbsolute,
        { paddingBottom: Math.max(insets.bottom, 16) },
      ]}
    >
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      {children}
    </View>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    footerAbsolute: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    backButton: {
      padding: 12,
    },
    backButtonText: {
      fontSize: 16,
      color: colors.primary,
    },
  });
}
