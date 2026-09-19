import React, { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/** Applique le thème comme le script du layout : classe .dark sur <html>. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = window.localStorage.getItem('theme') as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial: Theme = saved === 'dark' || saved === 'light' ? saved : prefersDark ? 'dark' : 'light';
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
    window.localStorage.setItem('theme', newTheme);
  };

  return (
    <button
      className="toggle-btn"
      onClick={toggle}
      aria-pressed={theme === 'dark'}
      aria-label={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'}
    >
      {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
    </button>
  );
}
