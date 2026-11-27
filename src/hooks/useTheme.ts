import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'pantheon-theme';

function readDocumentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/**
 * Theme lives on <html data-theme>, the same attribute the MCP App host sets,
 * so a host-driven theme change and the in-app toggle stay in sync.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(readDocumentTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readDocumentTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = readDocumentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode, sandboxed iframe); the toggle still works.
    }
  }, []);

  return { theme, toggleTheme };
}
