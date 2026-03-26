export interface ColorPalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  primary: string;
  success: string;
  highlight: string;
  error: string;
  border: string;
  inputBackground: string;
  inputBorder: string;
  placeholder: string;
  tabBar: string;
  tabBarBorder: string;
  statusBar: 'light' | 'dark';
}

export const darkColors: ColorPalette = {
  background: '#1A1E2E',
  surface: '#21253A',
  surfaceElevated: '#2A2F45',
  text: '#D4D6E2',
  textSecondary: '#8E93A6',
  primary: '#4A90C4',
  success: '#5DAA85',
  highlight: '#C4882A',
  error: '#E05C5C',
  border: '#2E3348',
  inputBackground: '#21253A',
  inputBorder: '#3A3F55',
  placeholder: '#5C6275',
  tabBar: '#21253A',
  tabBarBorder: '#2E3348',
  statusBar: 'light',
};

export const lightColors: ColorPalette = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
  primary: '#007AFF',
  success: '#34C759',
  highlight: '#FF9500',
  error: '#FF3B30',
  border: '#E0E0E0',
  inputBackground: '#FFFFFF',
  inputBorder: '#DDDDDD',
  placeholder: '#999999',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E0E0E0',
  statusBar: 'dark',
};

export const themes = {
  dark: darkColors,
  light: lightColors,
} as const;
