'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { buttonClasses } from '../ui/Button';
import { Segmented } from '../ui/Segmented';

const noop = () => () => {};
/** false en el servidor y en la primera pintura: el tema real solo se conoce en el navegador. */
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

/** Botón que alterna entre claro y oscuro. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={buttonClasses({ variant: 'outline', size: 'icon', className: `shadow-sticker-sm ${className ?? ''}` })}
    >
      {isDark ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
    </button>
  );
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Auto' },
] as const;

/** Selector de tema con la opción de seguir al sistema. */
export function ThemeSelect({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const value = (mounted ? theme : 'system') as (typeof THEME_OPTIONS)[number]['value'];
  return <Segmented label="Tema" size="sm" options={THEME_OPTIONS} value={value ?? 'system'} onChange={setTheme} className={className} />;
}
