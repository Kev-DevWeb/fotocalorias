'use client';

import { useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { Credit } from '../shell/AppShell';
import { ThemeToggle } from '../shell/ThemeToggle';
import { HydrationCard } from '../today/TodayCards';
import { Button } from '../ui/Button';
import { Chip, FoodSticker, Logo } from '../ui/primitives';

const GUEST_WATER_TARGET = 2000;

interface GuestScreenProps {
  onAddMeal: () => void;
  /** Volver a la pantalla de inicio de sesión */
  onSignIn: () => void;
  onCreateAccount: () => void;
  /** Aviso que va arriba de todo (por ejemplo, versión nueva disponible) */
  banner?: ReactNode;
}

/** Modo invitado: se puede analizar comida, pero nada se guarda. */
export function GuestScreen({ onAddMeal, onSignIn, onCreateAccount, banner }: GuestScreenProps) {
  // El agua del invitado vive solo en esta visita
  const [water, setWater] = useState(0);

  return (
    <div className="min-h-dvh">
      {banner}
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-10 pt-5 lg:max-w-4xl lg:gap-6 lg:px-10 lg:pt-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-[28px] font-extrabold leading-none tracking-tight">xCal</span>
            <Chip tone="guayaba">Invitado</Chip>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={onSignIn}>
              Iniciar sesión
            </Button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
          <section className="relative overflow-hidden rounded-[32px] border-2 border-sticker bg-mango p-6 text-sticker shadow-sticker-lg lg:col-span-3 lg:p-8">
            <div aria-hidden="true" className="absolute -right-3 -top-3 flex gap-2">
              <FoodSticker emoji="🌮" index={0} size="lg" className="rotate-12 bg-guayaba" />
            </div>
            <h1 className="max-w-[15ch] font-display text-4xl font-extrabold leading-none tracking-tight [text-wrap:balance] lg:text-5xl">Prueba xCal sin cuenta</h1>
            <p className="mt-3 max-w-md text-[15px] font-medium leading-relaxed">
              Toma una foto o describe tu comida y la IA calcula calorías y macros. Como invitado tienes pocos análisis al día y nada se guarda.
            </p>
            <Button variant="strong" size="lg" onClick={onAddMeal} className="mt-5 w-full shadow-[4px_4px_0_var(--card)] sm:w-auto">
              <Sparkles className="size-5" aria-hidden="true" />
              Analizar comida
            </Button>
          </section>

          <div className="flex flex-col gap-4 lg:col-span-2">
            <HydrationCard current={water} target={GUEST_WATER_TARGET} onChange={(delta) => setWater((ml) => Math.max(0, ml + delta))} />
            <div className="rounded-[26px] border-2 border-dashed border-outline px-5 py-5">
              <p className="font-bold">Con una cuenta gratis</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">Guardas tus comidas, ves cuánto te queda del día y llevas tus metas de proteína, carbos y grasas.</p>
              <Button variant="outline" onClick={onCreateAccount} className="mt-3 w-full">
                Crear cuenta
              </Button>
            </div>
          </div>
        </div>

        <Credit className="pt-2 text-center" />
      </div>
    </div>
  );
}
