import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/colors';

/**
 * Combines useTheme() with memoized style creation.
 * Replaces the repeated:
 *   const { colors } = useTheme();
 *   const styles = useMemo(() => getStyles(colors), [colors]);
 * pattern across components.
 */
export function useThemedStyles<T>(getStyles: (colors: ColorPalette) => T) {
  const { colors, theme, setTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return { styles, colors, theme, setTheme };
}
