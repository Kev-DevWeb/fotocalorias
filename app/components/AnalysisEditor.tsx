'use client';

import { useState } from 'react';
import { RotateCcw, TriangleAlert, X } from 'lucide-react';
import type { FoodItem } from '@/lib/ai/contract';
import { cn } from '@/lib/cn';
import { scaleItem, sumItems } from '@/lib/nutrition-math';

export interface EditableAnalysis {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  sodium?: number;
  items?: FoodItem[];
  detected_items?: string[];
  warnings?: string[];
  portion_note?: string;
  adjusted?: boolean;
}

interface AnalysisEditorProps<T extends EditableAnalysis> {
  /** Resultado tal como llegó; el editor siempre escala a partir de este original */
  result: T;
  onChange: (next: T) => void;
}

interface Row {
  factor: number;
  /** Texto del campo de gramos, para poder escribir libremente */
  gramsText: string;
  removed: boolean;
}

const QUICK_FACTORS: [string, number][] = [['½×', 0.5], ['1×', 1], ['1½×', 1.5], ['2×', 2]];
const MAX_GRAMS = 5000;

/** Alimentos del resultado; si no trae desglose (ingreso manual), el platillo completo cuenta como uno. */
function baseItems(result: EditableAnalysis): FoodItem[] {
  if (result.items && result.items.length > 0) return result.items;
  const whole: FoodItem = { name: result.food_name, calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat };
  if (result.sugar !== undefined) whole.sugar = result.sugar;
  if (result.fiber !== undefined) whole.fiber = result.fiber;
  if (result.sodium !== undefined) whole.sodium = result.sodium;
  return [whole];
}

/**
 * Desglose del análisis con ajuste de porciones antes de guardar: gramos por
 * alimento, quitar alimentos y multiplicadores rápidos para todo el platillo.
 */
export default function AnalysisEditor<T extends EditableAnalysis>({ result, onChange }: AnalysisEditorProps<T>) {
  // El original se fija al montar: los ajustes siempre parten de él, sin acumular redondeos
  const [base] = useState(result);
  const [items] = useState(() => baseItems(result));
  const [rows, setRows] = useState<Row[]>(() => items.map((item) => ({ factor: 1, gramsText: item.grams ? String(item.grams) : '', removed: false })));

  const apply = (next: Row[]) => {
    setRows(next);
    const scaled = items.flatMap((item, i) => (next[i].removed ? [] : [scaleItem(item, next[i].factor)]));
    const adjusted = next.some((row) => row.removed || row.factor !== 1);
    const update: EditableAnalysis = { ...base, ...sumItems(scaled), adjusted };
    if (base.items && base.items.length > 0) {
      update.items = scaled;
      update.detected_items = scaled.map((item) => item.name);
    }
    onChange(update as T);
  };

  const setAll = (factor: number) =>
    apply(rows.map((row, i) => ({ ...row, factor, gramsText: items[i].grams ? String(Math.max(1, Math.round(items[i].grams! * factor))) : '' })));

  const setGrams = (index: number, text: string) => {
    const grams = Number(text);
    const item = items[index];
    const valid = item.grams && Number.isFinite(grams) && grams > 0 && grams <= MAX_GRAMS;
    apply(rows.map((row, i) => (i === index ? { ...row, gramsText: text, factor: valid ? grams / item.grams! : row.factor } : row)));
  };

  const toggleRemoved = (index: number) => apply(rows.map((row, i) => (i === index ? { ...row, removed: !row.removed } : row)));

  const remaining = rows.filter((row) => !row.removed).length;
  const activeQuick = QUICK_FACTORS.find(([, factor]) => rows.every((row) => row.removed || row.factor === factor))?.[1];
  const hasBreakdown = Boolean(base.items && base.items.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {base.warnings && base.warnings.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-outline bg-mango-soft p-3 text-[13px] leading-relaxed" role="alert">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            {base.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[22px] border-2 border-outline bg-ground p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{hasBreakdown ? 'Desglose' : 'Porción'}</span>
          <div className="flex gap-1" role="group" aria-label="Ajustar todo el platillo">
            {QUICK_FACTORS.map(([label, factor]) => (
              <button
                key={label}
                type="button"
                onClick={() => setAll(factor)}
                aria-pressed={activeQuick === factor}
                className={cn(
                  'h-10 min-w-11 rounded-xl border-2 px-2 text-[13px] font-bold transition-colors',
                  activeQuick === factor ? 'border-inverse bg-inverse text-on-inverse' : 'border-outline bg-card text-ink hover:bg-track',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {hasBreakdown && (
          <ul className="mt-2 divide-y-2 divide-line">
            {items.map((item, i) => {
              const row = rows[i];
              const scaled = scaleItem(item, row.factor);
              return (
                <li key={`${item.name}-${i}`} className="flex items-center gap-2 py-2">
                  <div className={cn('min-w-0 flex-1', row.removed && 'opacity-60')}>
                    <p className={cn('truncate text-sm font-bold', row.removed && 'line-through')}>{item.name}</p>
                    <p className="text-xs text-ink-2">
                      {item.quantity ? `${item.quantity} · ` : ''}
                      <span className="font-bold text-ink">{row.removed ? 0 : scaled.calories} kcal</span>
                    </p>
                  </div>
                  {item.grams !== undefined && !row.removed && (
                    <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_GRAMS}
                        value={row.gramsText}
                        onChange={(e) => setGrams(i, e.target.value)}
                        aria-label={`Gramos de ${item.name}`}
                        className="h-11 w-[68px] rounded-xl border-2 border-outline bg-card px-2 text-right text-[15px] font-bold text-ink focus-visible:outline-offset-0"
                      />
                      g
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleRemoved(i)}
                    disabled={!row.removed && remaining <= 1}
                    aria-label={row.removed ? `Restaurar ${item.name}` : `Quitar ${item.name}`}
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-3 transition-colors hover:bg-track hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    {row.removed ? <RotateCcw className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
