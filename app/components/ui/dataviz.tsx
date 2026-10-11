'use client';

import type { ReactNode } from 'react';
import NumberFlow from '@number-flow/react';
import { TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';

/** Número que "rueda" al cambiar. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  return <NumberFlow value={Math.round(value)} locales="es-MX" format={{ maximumFractionDigits: 0 }} className={className} />;
}

const RING = { size: 208, stroke: 18, radius: 88 };
const CIRCUMFERENCE = 2 * Math.PI * RING.radius;

/**
 * Anillo de avance de calorías. Va sobre el bloque mango, así que usa el tono
 * de las pegatinas en ambos temas; la pista es el mismo tono, atenuado.
 */
export function CalorieRing({ percentage, label, children }: { percentage: number; label: string; children: ReactNode }) {
  const progress = Math.min(Math.max(percentage, 0), 100) / 100;
  const center = RING.size / 2;
  return (
    <div className="relative size-52 shrink-0">
      <svg role="img" aria-label={label} viewBox={`0 0 ${RING.size} ${RING.size}`} className="size-full -rotate-90">
        <circle cx={center} cy={center} r={RING.radius} fill="none" stroke="var(--sticker)" strokeOpacity={0.16} strokeWidth={RING.stroke} />
        <motion.circle
          cx={center}
          cy={center}
          r={RING.radius}
          fill="none"
          stroke="var(--sticker)"
          strokeWidth={RING.stroke}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - progress) }}
          transition={{ type: 'spring', stiffness: 60, damping: 18 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export const NUTRIENT_COLORS = {
  protein: { dot: 'bg-protein', fill: 'bg-protein', track: 'bg-protein-soft' },
  carbs: { dot: 'bg-carbs', fill: 'bg-carbs', track: 'bg-carbs-soft' },
  fat: { dot: 'bg-fat', fill: 'bg-fat', track: 'bg-fat-soft' },
} as const;

export type MacroKey = keyof typeof NUTRIENT_COLORS;

/** Punto de color que identifica un macro junto a su nombre. El texto nunca lleva el color de la serie. */
export function MacroDot({ macro, className }: { macro: MacroKey; className?: string }) {
  return <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', NUTRIENT_COLORS[macro].dot, className)} />;
}

/** Barra de avance fina con extremos redondeados. */
export function MeterBar({ percentage, fillClass, trackClass, thin }: { percentage: number; fillClass: string; trackClass: string; thin?: boolean }) {
  return (
    <div aria-hidden="true" className={cn('overflow-hidden rounded-full', thin ? 'h-1.5' : 'h-2', trackClass)}>
      <motion.div
        className={cn('h-full rounded-full', fillClass)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
        transition={{ type: 'spring', stiffness: 90, damping: 20 }}
      />
    </div>
  );
}

interface MacroMeterProps {
  macro: MacroKey;
  label: string;
  consumed: number;
  target: number;
  percentage: number;
}

/** Macro principal: nombre con punto de color, consumido / meta y barra. */
export function MacroMeter({ macro, label, consumed, target, percentage }: MacroMeterProps) {
  return (
    <div className="flex flex-col gap-2 rounded-[22px] border-2 border-outline bg-card p-3">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
        <MacroDot macro={macro} />
        {label}
      </div>
      {/* En celular las tres tarjetas van lado a lado: la meta baja a su propia línea */}
      <div className="flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:gap-1">
        <AnimatedNumber value={consumed} className="font-display text-[26px] font-extrabold leading-none" />
        <span className="whitespace-nowrap text-xs font-semibold text-ink-3">/ {target} g</span>
      </div>
      <MeterBar percentage={percentage} fillClass={NUTRIENT_COLORS[macro].fill} trackClass={NUTRIENT_COLORS[macro].track} />
    </div>
  );
}

interface LimitMeterProps {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  /** 'max' = no conviene pasarse (azúcar, sodio); 'min' = conviene llegar (fibra) */
  kind: 'max' | 'min';
}

/** Nutriente secundario. Si se pasa de un máximo, lo dice con ícono y texto, no solo con color. */
export function LimitMeter({ label, consumed, target, unit, kind }: LimitMeterProps) {
  const over = kind === 'max' && consumed > target;
  const percentage = target > 0 ? (consumed / target) * 100 : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span className="font-bold">{label}</span>
        {over ? (
          <span className="flex items-center gap-1.5 font-bold text-danger">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            {Math.round(consumed)} / {target} {unit} · {Math.round(consumed - target)} {unit} de más
          </span>
        ) : (
          <span className="font-semibold text-ink-2">
            {Math.round(consumed)} / {target} {unit}
          </span>
        )}
      </div>
      <MeterBar percentage={percentage} thin fillClass={over ? 'bg-danger-fill' : 'bg-ink-2'} trackClass="bg-track" />
    </div>
  );
}
