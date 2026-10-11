'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Desplaza la fecha conservando la hora, igual que hacía el selector anterior. */
function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

interface DayStripProps {
  selected: Date;
  onSelect: (date: Date) => void;
  className?: string;
}

/** Semana (lunes a domingo) del día elegido. No deja ir al futuro. */
export function DayStrip({ selected, onSelect, className }: DayStripProps) {
  const today = new Date();
  const mondayOffset = -((selected.getDay() + 6) % 7);
  const week = DAY_LABELS.map((label, i) => ({ label, date: shiftDays(selected, mondayOffset + i) }));
  const isFuture = (date: Date) => date > today && !sameDay(date, today);

  // La semana siguiente solo existe si su lunes ya llegó
  const nextMonday = shiftDays(selected, mondayOffset + 7);
  const canGoForward = !isFuture(nextMonday);
  const goForward = () => {
    const target = shiftDays(selected, 7);
    onSelect(isFuture(target) ? today : target);
  };

  const arrowClasses = 'grid h-[60px] w-8 shrink-0 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-track hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <nav aria-label="Semana" className={cn('flex items-center gap-1', className)}>
      <button type="button" onClick={() => onSelect(shiftDays(selected, -7))} aria-label="Semana anterior" className={arrowClasses}>
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
        {week.map(({ label, date }) => {
          const isSelected = sameDay(date, selected);
          return (
            <button
              key={label}
              type="button"
              disabled={isFuture(date)}
              aria-current={isSelected ? 'date' : undefined}
              aria-label={date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
              onClick={() => onSelect(date)}
              className={cn(
                'flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-[18px] border-2 transition-colors disabled:opacity-35',
                isSelected
                  ? 'border-inverse bg-inverse text-on-inverse shadow-[3px_3px_0_var(--mango)]'
                  : 'border-transparent text-ink-2 hover:bg-track disabled:hover:bg-transparent',
              )}
            >
              <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
              <span className="font-display text-lg font-bold leading-none">{date.getDate()}</span>
              {sameDay(date, today) && !isSelected && <span aria-hidden="true" className="size-1 rounded-full bg-mango" />}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={goForward} disabled={!canGoForward} aria-label="Semana siguiente" className={arrowClasses}>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </nav>
  );
}
