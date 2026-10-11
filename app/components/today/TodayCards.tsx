'use client';

import { useEffect, useRef } from 'react';
import { Activity, Loader2, Minus, Plus, RefreshCw, TriangleAlert } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { DailyProgress } from '@/lib/calorie-calculator';
import { cn } from '@/lib/cn';
import { Button } from '../ui/Button';
import { AnimatedNumber, CalorieRing, LimitMeter, MacroMeter } from '../ui/dataviz';
import { Card, Chip } from '../ui/primitives';

const formatNumber = (n: number) => Math.round(n).toLocaleString('es-MX');

/** Confeti con los colores de la app. Se carga solo cuando hace falta. */
async function celebrate() {
  const confetti = (await import('canvas-confetti')).default;
  confetti({ particleCount: 90, spread: 75, origin: { y: 0.35 }, colors: ['#ffb81f', '#ff93a6', '#2f9e5b', '#2a84d6', '#231a2b'] });
}

interface CalorieHeroProps {
  calories: DailyProgress['calories'];
  /** Calorías de ejercicio; null si Google Fit no está conectado */
  activity: number | null;
  /** Solo se celebra el día de hoy */
  canCelebrate: boolean;
  className?: string;
}

/** Bloque principal: cuánto queda del día, con el anillo de avance. */
export function CalorieHero({ calories, activity, canCelebrate, className }: CalorieHeroProps) {
  const over = calories.consumed > calories.target;
  const reduceMotion = useReducedMotion();

  // Confeti al cruzar la meta, no al abrir un día que ya la tenía cumplida
  const previous = useRef<number | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = calories.percentage;
    if (before !== null && before < 100 && calories.percentage >= 100 && canCelebrate && !reduceMotion) celebrate();
  }, [calories.percentage, canCelebrate, reduceMotion]);

  return (
    <section
      aria-label="Calorías del día"
      className={cn('flex flex-col gap-4 rounded-[32px] border-2 border-sticker bg-mango p-5 text-sticker shadow-sticker-lg lg:flex-row lg:items-center lg:gap-8 lg:p-7', className)}
    >
      <div className="flex items-center justify-between lg:hidden">
        <h2 className="font-display text-xl font-bold">Calorías del día</h2>
        <span className="rounded-full bg-sticker px-2.5 py-1 text-[13px] font-bold text-[#faf4e6]">{calories.percentage}%</span>
      </div>

      <div className="self-center">
        <CalorieRing percentage={calories.percentage} label={`${formatNumber(calories.consumed)} de ${formatNumber(calories.target)} kcal consumidas`}>
          <div className="flex flex-col items-center lg:hidden">
            <AnimatedNumber value={Math.abs(calories.target - calories.consumed)} className="font-display text-[54px] font-extrabold leading-none tracking-tight" />
            <span className="text-sm font-semibold">{over ? 'kcal de más' : 'kcal te quedan'}</span>
          </div>
          <span className="hidden font-display text-[44px] font-extrabold tracking-tight lg:block">{calories.percentage}%</span>
        </CalorieRing>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="hidden flex-col gap-1 lg:flex">
          <h2 className="text-[15px] font-bold">Calorías del día</h2>
          <AnimatedNumber value={Math.abs(calories.target - calories.consumed)} className="font-display text-[88px] font-extrabold leading-[0.9] tracking-tighter" />
          <span className="text-base font-semibold">{over ? 'kcal de más' : 'kcal te quedan'}</span>
        </div>

        {over && (
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            Pasaste tu meta del día
          </p>
        )}

        <dl className="grid grid-cols-3 overflow-hidden rounded-[20px] border-2 border-sticker bg-card text-ink">
          <Stat label="Consumidas" value={formatNumber(calories.consumed)} />
          <Stat label="Actividad" value={activity === null ? '—' : `+${formatNumber(activity)}`} divided />
          <Stat label="Meta" value={formatNumber(calories.target)} divided />
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, value, divided }: { label: string; value: string; divided?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-0.5 px-2 py-2.5 text-center lg:px-3.5 lg:text-left', divided && 'border-l-2 border-sticker')}>
      <dt className="text-xs font-semibold text-ink-2">{label}</dt>
      <dd className="font-display text-xl font-bold">{value}</dd>
    </div>
  );
}

/** Proteína, carbohidratos y grasas. */
export function MacroGrid({ progress, className }: { progress: DailyProgress; className?: string }) {
  return (
    <section aria-label="Macronutrientes" className={cn('grid grid-cols-3 gap-2.5 lg:grid-cols-1', className)}>
      <MacroMeter macro="protein" label="Proteína" {...progress.protein} />
      <MacroMeter macro="carbs" label="Carbos" {...progress.carbs} />
      <MacroMeter macro="fat" label="Grasas" {...progress.fat} />
    </section>
  );
}

/** Azúcar y sodio tienen máximo; la fibra, mínimo. */
export function OtherNutrients({ progress, className }: { progress: DailyProgress; className?: string }) {
  return (
    <Card aria-label="Otros nutrientes" role="group" className={cn('flex flex-col gap-3 px-4 py-3.5', className)}>
      <LimitMeter label="Azúcar" unit="g" kind="max" consumed={progress.sugar.consumed} target={progress.sugar.target} />
      <LimitMeter label="Fibra" unit="g" kind="min" consumed={progress.fiber.consumed} target={progress.fiber.target} />
      <LimitMeter label="Sodio" unit="mg" kind="max" consumed={progress.sodium.consumed} target={progress.sodium.target} />
    </Card>
  );
}

const GLASS_ML = 250;
const MAX_GLASSES = 12;

function Glass({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 32" className="h-auto min-w-0 max-w-6 flex-1">
      <motion.path
        d="M3 2h18l-2 26a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"
        stroke="var(--outline)"
        strokeWidth="2"
        strokeLinejoin="round"
        initial={false}
        animate={{ fill: filled ? 'var(--water)' : 'var(--water-soft)' }}
        transition={{ duration: 0.25 }}
      />
    </svg>
  );
}

interface HydrationCardProps {
  current: number;
  target: number;
  onChange: (deltaMl: number) => void;
  className?: string;
}

export function HydrationCard({ current, target, onChange, className }: HydrationCardProps) {
  const percentage = target > 0 ? Math.round((current / target) * 100) : 0;
  const glasses = Math.min(MAX_GLASSES, Math.max(1, Math.ceil(target / GLASS_ML)));
  const filled = Math.min(glasses, Math.floor(current / GLASS_ML));
  const done = current >= target;

  return (
    <Card aria-label="Agua" role="group" className={cn('flex flex-col gap-3.5 p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="font-display text-xl font-bold">Agua</h2>
          <p className="text-[13px] text-ink-2">
            <AnimatedNumber value={current} className="font-bold text-ink" /> / {formatNumber(target)} ml
          </p>
        </div>
        <Chip tone="water">{done ? '¡Meta cumplida!' : `${percentage}%`}</Chip>
      </div>

      {/* Los vasos se encogen para caber siempre en una sola fila */}
      <div aria-hidden="true" className="flex gap-1.5">
        {Array.from({ length: glasses }, (_, i) => (
          <Glass key={i} filled={i < filled} />
        ))}
      </div>

      <div className="flex gap-2.5">
        <Button variant="outline" size="icon" onClick={() => onChange(-GLASS_ML)} disabled={current <= 0} aria-label="Restar 250 ml" className="size-12">
          <Minus className="size-5" strokeWidth={2.6} aria-hidden="true" />
        </Button>
        <Button onClick={() => onChange(GLASS_ML)} className="flex-1 px-2 shadow-sticker-sm">
          <Plus className="size-[18px]" strokeWidth={2.6} aria-hidden="true" />
          250 ml
        </Button>
        <Button variant="outline" onClick={() => onChange(500)} className="flex-1 px-2">
          <Plus className="size-[18px]" strokeWidth={2.6} aria-hidden="true" />
          500 ml
        </Button>
      </div>
    </Card>
  );
}

export interface ActivityState {
  connected: boolean;
  syncing: boolean;
  caloriesBurned: number;
  onConnect: () => void;
  onSync: () => void;
}

/** Google Fit: calorías de ejercicio del día, o la invitación a conectarlo. */
export function ActivityCard({ connected, syncing, caloriesBurned, onConnect, onSync, className }: ActivityState & { className?: string }) {
  return (
    <Card aria-label="Actividad" role="group" className={cn('flex flex-col gap-3 px-4 py-3.5', className)}>
      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[14px] border-2 border-sticker bg-guayaba text-sticker">
          <Activity className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h2 className="text-[15px] font-bold">Google Fit</h2>
          <p className="text-[13px] text-ink-2">
            {connected ? (
              <>
                Ejercicio del día: <span className="font-bold text-ink">+{formatNumber(caloriesBurned)} kcal</span>
              </>
            ) : (
              'Sin conectar'
            )}
          </p>
        </div>
        {connected && (
          <Button variant="outline" size="sm" onClick={onSync} disabled={syncing}>
            {syncing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
            Sincronizar
          </Button>
        )}
      </div>
      {!connected && (
        <>
          <p className="text-[13px] leading-relaxed text-ink-2">
            Conecta tus pasos y entrenamientos para ajustar tu meta de calorías del día según lo que gastas.
          </p>
          <Button variant="outline" onClick={onConnect}>
            Conectar Google Fit
          </Button>
        </>
      )}
    </Card>
  );
}
