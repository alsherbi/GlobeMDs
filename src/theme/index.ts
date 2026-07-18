// GlobeMDs design tokens.
// NOTE: brand colors are a best-effort medical navy/teal until the real
// GlobeMDs.com brand palette is provided — swap the `palette` values only;
// everything else derives from them.

import { useColorScheme } from 'react-native';

export const palette = {
  navy900: '#062B3C',
  navy700: '#0B4F6C',
  navy500: '#14719A',
  teal400: '#1FA5C9',
  teal100: '#DCF1F7',
  green600: '#1E8E5A',
  gold500: '#C99A2E',
  red600: '#C0392B',
  gray900: '#16212B',
  gray700: '#3C4A57',
  gray500: '#6B7A88',
  gray300: '#C3CDD6',
  gray100: '#EEF2F5',
  white: '#FFFFFF',
};

export interface Theme {
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    textMuted: string;
    primary: string;
    primaryText: string;
    accent: string;
    border: string;
    success: string;
    warning: string;
    danger: string;
    verified: string;
  };
  spacing: (n: number) => number;
  radius: { sm: number; md: number; lg: number; full: number };
  type: {
    title: { fontSize: number; fontWeight: '700' };
    heading: { fontSize: number; fontWeight: '600' };
    body: { fontSize: number; fontWeight: '400' };
    caption: { fontSize: number; fontWeight: '400' };
  };
}

const base = {
  spacing: (n: number) => n * 4,
  radius: { sm: 6, md: 10, lg: 16, full: 999 },
  type: {
    title: { fontSize: 24, fontWeight: '700' as const },
    heading: { fontSize: 17, fontWeight: '600' as const },
    body: { fontSize: 15, fontWeight: '400' as const },
    caption: { fontSize: 12.5, fontWeight: '400' as const },
  },
};

export const lightTheme: Theme = {
  ...base,
  colors: {
    background: palette.gray100,
    surface: palette.white,
    surfaceAlt: palette.teal100,
    text: palette.gray900,
    textMuted: palette.gray500,
    primary: palette.navy700,
    primaryText: palette.white,
    accent: palette.teal400,
    border: palette.gray300,
    success: palette.green600,
    warning: palette.gold500,
    danger: palette.red600,
    verified: palette.teal400,
  },
};

export const darkTheme: Theme = {
  ...base,
  colors: {
    background: '#0A141C',
    surface: '#122230',
    surfaceAlt: '#0E3446',
    text: '#E9F1F6',
    textMuted: '#8FA3B3',
    primary: palette.teal400,
    primaryText: palette.navy900,
    accent: palette.teal400,
    border: '#24384A',
    success: '#3BAF7C',
    warning: palette.gold500,
    danger: '#E06050',
    verified: palette.teal400,
  },
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}
