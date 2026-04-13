export interface ColorPalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textOnPrimary: string;   // white text for use on primary/success/error backgrounds
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
  overlay: string;         // modal/backdrop overlay colour
  errorSubtle: string;     // translucent error tint (e.g. logout button bg)
  successSubtle: string;   // translucent success tint (e.g. completed task bg)
  statusBar: 'light' | 'dark';
}

export const darkColors: ColorPalette = {
  background: '#0F0F0F',
  surface: '#1C1C1C',
  surfaceElevated: '#262626',
  text: '#F0F0F0',
  textSecondary: '#8A8A8A',
  textOnPrimary: '#FFFFFF',
  primary: '#4A90C4',
  success: '#5DAA85',
  highlight: '#C4882A',
  error: '#E05C5C',
  border: '#2A2A2A',
  inputBackground: '#1C1C1C',
  inputBorder: '#333333',
  placeholder: '#555555',
  tabBar: '#1C1C1C',
  tabBarBorder: '#2A2A2A',
  overlay: 'rgba(0,0,0,0.75)',
  errorSubtle: 'rgba(224,92,92,0.12)',
  successSubtle: 'rgba(93,170,133,0.16)',
  statusBar: 'light',
};

export const lightColors: ColorPalette = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textOnPrimary: '#FFFFFF',
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
  overlay: 'rgba(0,0,0,0.5)',
  errorSubtle: 'rgba(255,59,48,0.1)',
  successSubtle: 'rgba(52,199,89,0.12)',
  statusBar: 'dark',
};

export const themes = {
  dark: darkColors,
  light: lightColors,
} as const;
