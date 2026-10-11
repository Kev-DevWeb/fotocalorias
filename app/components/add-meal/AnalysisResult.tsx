'use client';

import { Check, Loader2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getFoodEmoji, MEAL_OPTIONS } from '@/lib/food';
import type { MealType, NutritionData } from '@/lib/types';
import AnalysisEditor from '../AnalysisEditor';
import { Button } from '../ui/Button';
import { AnimatedNumber, MacroDot, type MacroKey } from '../ui/dataviz';
import { Chip, FoodSticker, Overline } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';

const NOVA_LABELS: Record<number, string> = {
  1: 'Mínimamente procesado',
  2: 'Ingrediente culinario',
  3: 'Alimento procesado',
  4: 'Ultraprocesado',
};

const MACROS: [MacroKey, string, 'protein' | 'carbs' | 'fat'][] = [
  ['protein', 'Proteína', 'protein'],
  ['carbs', 'Carbos', 'carbs'],
  ['fat', 'Grasas', 'fat'],
];

interface AnalysisResultProps {
  /** Cambia con cada análisis: reinicia el editor de porciones */
  resultId: number;
  /** Lo que escribió el usuario a mano no lleva nivel de confianza */
  manual?: boolean;
  data: NutritionData;
  onChange: (data: NutritionData) => void;
  mealType: MealType;
  onMealTypeChange: (mealType: MealType) => void;
  /** Sin esta función (invitado) el resultado solo se muestra */
  onSave?: () => void;
  saving: boolean;
  onDiscard: () => void;
  /** Invitado: ir a crear una cuenta */
  onRequestAccount?: () => void;
}

/** Resultado de un análisis: totales, desglose ajustable y, con sesión, a qué comida del día va. */
export function AnalysisResult({ resultId, manual, data, onChange, mealType, onMealTypeChange, onSave, saving, onDiscard, onRequestAccount }: AnalysisResultProps) {
  const lowConfidence = data.confidence === 'Baja';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <FoodSticker emoji={getFoodEmoji(data.food_name)} size="lg" />
        <div className="min-w-0 space-y-1.5">
          <h3 className="font-display text-[22px] font-extrabold leading-tight tracking-tight [text-wrap:balance]">{data.food_name}</h3>
          <div className="flex flex-wrap gap-1.5">
            {manual && <Chip>Ingreso manual</Chip>}
            {!manual && data.confidence && (
              <Chip tone={lowConfidence ? 'mango' : 'neutral'}>
                {lowConfidence && <TriangleAlert className="size-3.5" aria-hidden="true" />}
                Confianza {data.confidence.toLowerCase()}
              </Chip>
            )}
            {data.adjusted && <Chip tone="guayaba">Ajustado</Chip>}
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border-2 border-sticker bg-mango px-5 py-4 text-sticker shadow-sticker">
        <p className="flex items-baseline gap-2">
          <AnimatedNumber value={data.calories} className="font-display text-[64px] font-extrabold leading-none tracking-tighter" />
          <span className="text-lg font-bold">kcal</span>
        </p>
        {data.portion_note && <p className="mt-1.5 text-[13px] font-medium leading-relaxed">{data.portion_note}</p>}
      </div>

      <AnalysisEditor key={resultId} result={data} onChange={onChange} />

      <dl className="grid grid-cols-3 gap-2">
        {MACROS.map(([macro, label, field]) => (
          <div key={macro} className="rounded-[20px] border-2 border-outline bg-card px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
              <MacroDot macro={macro} className="size-2" />
              {label}
            </dt>
            <dd className="font-display text-2xl font-extrabold leading-tight">
              <AnimatedNumber value={data[field]} /> g
            </dd>
          </div>
        ))}
      </dl>

      <dl className="grid grid-cols-3 divide-x-2 divide-line rounded-[20px] border-2 border-outline bg-card">
        <SmallStat label="Azúcar" value={data.sugar} unit="g" />
        <SmallStat label="Fibra" value={data.fiber} unit="g" />
        <SmallStat label="Sodio" value={data.sodium} unit="mg" />
      </dl>

      {data.nova_group && NOVA_LABELS[data.nova_group] && (
        <div className="rounded-[20px] border-2 border-outline bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold">
              NOVA {data.nova_group} · {NOVA_LABELS[data.nova_group]}
            </p>
            {/* Escala de 1 (natural) a 4 (ultraprocesado); el texto ya dice el grupo */}
            <div aria-hidden="true" className="flex shrink-0 gap-1">
              {[1, 2, 3, 4].map((step) => (
                <span key={step} className={cn('h-2.5 w-5 rounded-full', step <= data.nova_group! ? 'bg-ink' : 'bg-track')} />
              ))}
            </div>
          </div>
          {data.nova_reason && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{data.nova_reason}</p>}
        </div>
      )}

      {onSave ? (
        <>
          <div className="space-y-2">
            <Overline>¿En qué comida va?</Overline>
            <Segmented label="Tipo de comida" size="sm" options={MEAL_OPTIONS} value={mealType} onChange={onMealTypeChange} />
          </div>
          <div className="flex flex-col gap-2.5">
            <Button size="lg" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Check className="size-5" strokeWidth={2.6} aria-hidden="true" />}
              {saving ? 'Guardando…' : 'Guardar en mi día'}
            </Button>
            <Button variant="ghost" onClick={onDiscard} disabled={saving}>
              Descartar
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="rounded-[20px] border-2 border-outline bg-guayaba-soft px-4 py-3 text-[13px] leading-relaxed">
            Como invitado este análisis no se guarda. Con una cuenta llevas tus comidas, tu agua y tus metas del día.
          </p>
          {onRequestAccount && (
            <Button size="lg" onClick={onRequestAccount}>
              Crear cuenta gratis
            </Button>
          )}
          <Button variant="ghost" onClick={onDiscard}>
            Listo
          </Button>
        </div>
      )}
    </div>
  );
}

function SmallStat({ label, value, unit }: { label: string; value: number | undefined; unit: string }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <dt className="text-xs font-semibold text-ink-2">{label}</dt>
      <dd className="text-[15px] font-bold">
        {Math.round(value ?? 0)} {unit}
      </dd>
    </div>
  );
}
