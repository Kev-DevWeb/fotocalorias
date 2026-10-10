'use client';

import { useState } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import type { FoodItem } from '@/lib/ai/contract';
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
    <div className="space-y-3">
      {base.warnings && base.warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            {base.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{hasBreakdown ? 'Desglose' : 'Porción'}</span>
          <div className="flex gap-1" role="group" aria-label="Ajustar todo el platillo">
            {QUICK_FACTORS.map(([label, factor]) => (
              <button
                key={label}
                onClick={() => setAll(factor)}
                aria-pressed={activeQuick === factor}
                className={`min-w-[40px] rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                  activeQuick === factor ? 'bg-orange-500 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {hasBreakdown && (
          <ul className="divide-y divide-slate-200">
            {items.map((item, i) => {
              const row = rows[i];
              const scaled = scaleItem(item, row.factor);
              return (
                <li key={`${item.name}-${i}`} className="flex items-center gap-2 py-2">
                  <div className={`min-w-0 flex-1 ${row.removed ? 'opacity-50' : ''}`}>
                    <p className={`truncate text-sm font-semibold text-slate-800 ${row.removed ? 'line-through' : ''}`}>{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.quantity ? `${item.quantity} · ` : ''}
                      <span className="font-semibold text-orange-600">{row.removed ? 0 : scaled.calories} kcal</span>
                    </p>
                  </div>
                  {item.grams !== undefined && !row.removed && (
                    <label className="flex flex-shrink-0 items-center gap-1 text-xs text-slate-500">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_GRAMS}
                        value={row.gramsText}
                        onChange={(e) => setGrams(i, e.target.value)}
                        aria-label={`Gramos de ${item.name}`}
                        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      g
                    </label>
                  )}
                  <button
                    onClick={() => toggleRemoved(i)}
                    disabled={!row.removed && remaining <= 1}
                    aria-label={row.removed ? `Restaurar ${item.name}` : `Quitar ${item.name}`}
                    className="flex-shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    {row.removed ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {base.portion_note && <p className="mt-2 text-xs leading-relaxed text-slate-500">{base.portion_note}</p>}
      </div>
    </div>
  );
}
