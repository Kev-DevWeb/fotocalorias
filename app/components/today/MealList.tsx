'use client';

import { Check, Smartphone, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { getFoodEmoji, MEAL_LABELS } from '@/lib/food';
import { countPendingHuawei } from '@/lib/huawei-health';
import type { CalorieLog } from '@/lib/types';
import { Button } from '../ui/Button';
import { MacroDot } from '../ui/dataviz';
import { Chip, FoodSticker, Overline } from '../ui/primitives';

interface MealListProps {
  logs: CalorieLog[];
  isToday: boolean;
  onHuawei: (log: CalorieLog) => void;
  onDelete: (log: CalorieLog) => void;
  className?: string;
}

export function MealList({ logs, isToday, onHuawei, onDelete, className }: MealListProps) {
  const pending = countPendingHuawei(logs);
  return (
    <section aria-label="Comidas del día" className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-extrabold tracking-tight lg:text-[28px]">Comidas del día</h2>
        {pending > 0 && <Chip tone="guayaba">{pending} por pasar a Huawei</Chip>}
      </div>

      {logs.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-outline px-5 py-10 text-center">
          <p className="font-bold">Sin registros en esta fecha</p>
          {isToday && <p className="mt-1 text-sm text-ink-2">Usa «Agregar comida» para analizar tu primer platillo.</p>}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {logs.map((log, index) => (
              <motion.li
                key={log.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              >
                <MealCard log={log} index={index} onHuawei={onHuawei} onDelete={onDelete} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function MealCard({ log, index, onHuawei, onDelete }: { log: CalorieLog; index: number } & Pick<MealListProps, 'onHuawei' | 'onDelete'>) {
  return (
    <article className="flex items-start gap-3 rounded-3xl border-2 border-outline bg-card p-3.5">
      <FoodSticker emoji={getFoodEmoji(log.food_name)} index={index} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="space-y-1">
          {log.meal_type && <Overline className="text-[11px]">{MEAL_LABELS[log.meal_type]}</Overline>}
          <h3 className="text-[15px] font-bold leading-snug [text-wrap:pretty]">{log.food_name}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-ink-2">
          <span className="font-display text-lg font-extrabold text-ink">{Math.round(log.calories)} kcal</span>
          <span className="flex items-center gap-1">
            <MacroDot macro="protein" className="size-2" />P {Math.round(log.protein)} g
          </span>
          <span className="flex items-center gap-1">
            <MacroDot macro="carbs" className="size-2" />C {Math.round(log.carbs)} g
          </span>
          <span className="flex items-center gap-1">
            <MacroDot macro="fat" className="size-2" />G {Math.round(log.fat)} g
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {log.huawei_logged_at ? (
            <Chip tone="good" className="h-8 px-3">
              <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
              Ya está en Huawei
            </Chip>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onHuawei(log)}>
              <Smartphone className="size-4" aria-hidden="true" />
              Pasar a Huawei
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => onDelete(log)} aria-label={`Borrar ${log.food_name}`} className="text-ink-3">
            <Trash2 className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  );
}
