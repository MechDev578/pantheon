import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'pantheon-theme';
const THEME_COLORS: Record<Theme, string> = {
  dark: '#0a0a0b',
  light: '#ffffff',
};

function readDocumentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function syncMetaThemeColor(theme: Theme): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', THEME_COLORS[theme]);
  }
}

/**
 * Theme lives on <html data-theme>, the same attribute the MCP App host sets,
 * so a host-driven theme change and the in-app toggle stay in sync.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(readDocumentTheme);

  useEffect(() => {
    syncMetaThemeColor(readDocumentTheme());
    const observer = new MutationObserver(() => {
      const current = readDocumentTheme();
      setTheme(current);
      syncMetaThemeColor(current);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = readDocumentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    syncMetaThemeColor(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode, sandboxed iframe); the toggle still works.
    }
  }, []);

  return { theme, toggleTheme };
}
