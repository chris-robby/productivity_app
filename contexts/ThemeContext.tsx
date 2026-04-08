import React, { createContext, useContext } from 'react';
import { Text, TextInput } from 'react-native';
import { useAppStore } from '../store';
import { themes, ColorPalette } from '../constants/colors';
import { Fonts } from '../constants/fonts';

interface ThemeContextValue {
  theme: 'dark' | 'light';
  colors: ColorPalette;
  setTheme: (theme: 'dark' | 'light') => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  colors: themes.dark,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const colors = themes[theme];

  // Apply Inter globally — any Text or TextInput without an explicit
  // fontFamily will inherit this default.
  const defaultTextStyle = { fontFamily: Fonts.regular };
  (Text as any).defaultProps = (Text as any).defaultProps ?? {};
  (Text as any).defaultProps.style = [defaultTextStyle, (Text as any).defaultProps.style];
  (TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
  (TextInput as any).defaultProps.style = [defaultTextStyle, (TextInput as any).defaultProps.style];

  return (
    <ThemeContext.Provider value={{ theme, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
