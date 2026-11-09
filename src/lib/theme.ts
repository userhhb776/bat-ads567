import { useEffect, useState } from 'react';

/** Device-only visual style; applied as data-theme on <html>. */
export type ThemeId = 'gotham' | 'glass-light' | 'glass-dark';
export const THEMES: { id: ThemeId; label: string; hint: string }[] = [
  { id: 'gotham', label: 'Gotham (padrão)', hint: 'Escuro com dourado e brilhos tonais' },
  { id: 'glass-light', label: 'Vidro claro', hint: 'Glassmorphism branco/prateado' },
  { id: 'glass-dark', label: 'Vidro escuro', hint: 'Glassmorphism grafite com reflexos dourados' },
];
const KEY = 'batgotham.theme';
const EVT = 'bg-theme-change';
export const THEME_BOOT = `try{var t=localStorage.getItem('${KEY}');if(t)document.documentElement.dataset.theme=t}catch(e){}`;
export function getTheme(): ThemeId {
  if (typeof window === 'undefined') return 'gotham';
  const t = localStorage.getItem(KEY) as ThemeId | null;
  return t && THEMES.some((x) => x.id === t) ? t : 'gotham';
}
export function setTheme(t: ThemeId) {
  localStorage.setItem(KEY, t);
  document.documentElement.dataset['theme'] = t;
  window.dispatchEvent(new Event(EVT));
}
export function useTheme() {
  const [t, setT] = useState<ThemeId>('gotham');
  useEffect(() => { const u = () => setT(getTheme()); u(); window.addEventListener(EVT, u); return () => window.removeEventListener(EVT, u); }, []);
  return t;
}
