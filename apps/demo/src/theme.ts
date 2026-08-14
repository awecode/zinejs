export type DemoTheme = 'light' | 'dark';

const STORAGE_KEY = 'zine-demo-theme';

export function resolveTheme(): DemoTheme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getTheme(): DemoTheme {
  const current = document.documentElement.dataset.theme;
  if (current === 'light' || current === 'dark') return current;
  return resolveTheme();
}

export function applyTheme(theme: DemoTheme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}

export function setTheme(theme: DemoTheme): void {
  applyTheme(theme);
}

export function initTheme(): DemoTheme {
  const theme = resolveTheme();
  applyTheme(theme);
  return theme;
}

export function createThemeToggle(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-toggle';
  const sync = (): void => {
    const theme = getTheme();
    btn.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    btn.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
    );
  };
  btn.addEventListener('click', () => {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    sync();
  });
  sync();
  return btn;
}
