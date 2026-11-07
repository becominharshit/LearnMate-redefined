import { ThemeMode } from '../types/study';

export const THEME_STORAGE_KEY = 'learnmate_theme_v1';

/**
 * Resolves the effective visual theme ('light' or 'dark') based on the mode setting
 * and system media query when mode is 'system'.
 */
export function getEffectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/**
 * Applies the given theme mode to documentElement synchronously.
 * Sets data-theme attribute and toggles the .dark class so both CSS variable selectors
 * and Tailwind dark: variants respond consistently.
 */
export function applyThemeToDom(mode: ThemeMode): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const effective = getEffectiveTheme(mode);
  const root = document.documentElement;

  root.setAttribute('data-theme', effective);
  if (effective === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  return effective;
}

/**
 * Subscribes to system color-scheme changes if mode is 'system'.
 */
export function listenToSystemThemeChanges(
  mode: ThemeMode,
  callback: (effective: 'light' | 'dark') => void
): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => {
    if (mode === 'system') {
      const effective = applyThemeToDom('system');
      callback(effective);
    }
  };

  try {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  } catch {
    // Fallback for older browsers
    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }
}
