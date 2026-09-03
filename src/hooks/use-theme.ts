import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const storageKey = 'via-carraria-theme';

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(storageKey);
  return saved === 'light' || saved === 'dark' || saved === 'system'
    ? saved
    : 'light';
}

export function useTheme(): {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
} {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (): void => {
      const nextTheme =
        theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme;
      root.dataset.theme = nextTheme;
      root.style.colorScheme = nextTheme;
    };

    applyTheme();
    window.localStorage.setItem(storageKey, theme);
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [theme]);

  return { theme, resolvedTheme, setTheme };
}
