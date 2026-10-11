'use client';

import type { ReactNode } from 'react';
import { House, LogOut, Plus, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '../ui/Button';
import { Logo } from '../ui/primitives';
import { ThemeSelect } from './ThemeToggle';

export type AppView = 'hoy' | 'perfil';

interface AppShellProps {
  view: AppView;
  onViewChange: (view: AppView) => void;
  onAddMeal: () => void;
  onLogout: () => void;
  displayName: string;
  /** Aviso que va arriba de todo (por ejemplo, versión nueva disponible) */
  banner?: ReactNode;
  children: ReactNode;
}

const NAV: { view: AppView; label: string; longLabel: string; icon: typeof House }[] = [
  { view: 'hoy', label: 'Hoy', longLabel: 'Hoy', icon: House },
  { view: 'perfil', label: 'Perfil', longLabel: 'Perfil y objetivos', icon: User },
];

export function Credit({ className }: { className?: string }) {
  return (
    <p className={cn('text-xs text-ink-3', className)}>
      Desarrollada por{' '}
      <a href="https://www.devvisualstudio.com/" target="_blank" rel="noopener noreferrer" className="font-bold text-ink underline-offset-2 hover:underline">
        DevVisual Studio
      </a>
    </p>
  );
}

/** Estructura de la app con sesión: barra lateral en pantallas grandes, barra inferior en celular. */
export function AppShell({ view, onViewChange, onAddMeal, onLogout, displayName, banner, children }: AppShellProps) {
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r-2 border-outline bg-card px-5 py-7 lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-[28px] font-extrabold leading-none tracking-tight">xCal</span>
        </div>

        <Button size="lg" onClick={onAddMeal} className="w-full whitespace-nowrap px-3">
          <Plus className="size-5" strokeWidth={2.6} aria-hidden="true" />
          Agregar comida
        </Button>

        <nav aria-label="Principal" className="flex flex-col gap-1.5">
          {NAV.map(({ view: target, longLabel, icon: Icon }) => (
            <button
              key={target}
              type="button"
              aria-current={view === target ? 'page' : undefined}
              onClick={() => onViewChange(target)}
              className={cn(
                'flex h-12 items-center gap-2.5 rounded-2xl px-3.5 text-[15px] font-bold transition-colors',
                view === target ? 'bg-inverse text-on-inverse' : 'text-ink hover:bg-track',
              )}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              {longLabel}
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <ThemeSelect />
          <div className="flex items-center gap-2.5">
            <div aria-hidden="true" className="grid size-11 shrink-0 -rotate-[4deg] place-items-center rounded-2xl border-2 border-sticker bg-guayaba font-display text-xl font-extrabold text-sticker">
              {displayName.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{displayName}</span>
            <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Cerrar sesión">
              <LogOut className="size-5" aria-hidden="true" />
            </Button>
          </div>
          <Credit />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {banner}
        <main className="mx-auto w-full max-w-xl px-4 pb-32 pt-5 lg:max-w-6xl lg:px-10 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      <nav
        aria-label="Principal"
        className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-40 mx-auto flex h-[68px] max-w-md items-center justify-around rounded-[26px] border-2 border-inverse bg-card px-2.5 shadow-sticker lg:hidden"
      >
        <BottomTab {...NAV[0]} active={view === 'hoy'} onClick={() => onViewChange('hoy')} />
        <button
          type="button"
          onClick={onAddMeal}
          aria-label="Agregar comida"
          className="-mt-9 grid size-[68px] place-items-center rounded-3xl border-2 border-sticker bg-mango text-sticker shadow-sticker transition-[translate,box-shadow] duration-100 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          <Plus className="size-8" strokeWidth={2.8} aria-hidden="true" />
        </button>
        <BottomTab {...NAV[1]} active={view === 'perfil'} onClick={() => onViewChange('perfil')} />
      </nav>
    </div>
  );
}

function BottomTab({ label, icon: Icon, active, onClick }: { label: string; icon: typeof House; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex h-12 w-24 items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-colors',
        active ? 'bg-inverse text-on-inverse' : 'text-ink-2',
      )}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
      {label}
    </button>
  );
}
