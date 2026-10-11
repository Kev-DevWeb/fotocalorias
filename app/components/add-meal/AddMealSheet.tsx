'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, Images, Loader2, Sparkles, X } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import type { FoodAnalysis } from '@/hooks/useFoodAnalysis';
import { getDefaultMealType, MEAL_LABELS } from '@/lib/food';
import type { MealType, NutritionData } from '@/lib/types';
import AnalysisErrorPanel from '../AnalysisErrorPanel';
import { Button } from '../ui/Button';
import { Field, FoodSticker } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { AnalysisResult } from './AnalysisResult';

type Tab = 'foto' | 'texto' | 'manual';

const TABS: { value: Tab; label: string }[] = [
  { value: 'foto', label: 'Foto' },
  { value: 'texto', label: 'Texto' },
  { value: 'manual', label: 'Manual' },
];

const TITLES = { idle: '¿Qué comiste?', analyzing: 'Un momento…', error: 'No se pudo analizar', result: 'Revisa y guarda' } as const;

interface AddMealSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: FoodAnalysis;
  /** Guarda la comida en el día. Sin esta función (invitado) el resultado solo se muestra */
  onSave?: (data: NutritionData, mealType: MealType) => Promise<void>;
  /** Invitado: ir a crear una cuenta */
  onRequestAccount?: () => void;
}

/** Hoja para agregar una comida: por foto, por descripción o escribiendo los valores a mano. */
export function AddMealSheet({ open, onOpenChange, analysis, onSave, onRequestAccount }: AddMealSheetProps) {
  const { stage } = analysis;
  const [tab, setTab] = useState<Tab>('foto');
  const [mealType, setMealType] = useState<MealType>(() => getDefaultMealType());
  const [saving, setSaving] = useState(false);

  // Cada resultado nuevo propone la comida que toca según la hora
  const resultId = stage.kind === 'result' ? stage.id : null;
  const [seenResult, setSeenResult] = useState<number | null>(null);
  if (resultId !== seenResult) {
    setSeenResult(resultId);
    if (resultId !== null) setMealType(getDefaultMealType());
  }

  // Si el análisis termina con la hoja cerrada, se avisa para volver a abrirla
  const openRef = useRef(open);
  const reopenRef = useRef(() => onOpenChange(true));
  useEffect(() => {
    openRef.current = open;
    reopenRef.current = () => onOpenChange(true);
  });
  useEffect(() => {
    if (openRef.current) return;
    const action = { label: 'Ver', onClick: () => reopenRef.current() };
    if (stage.kind === 'result') toast.success('Tu análisis está listo', { action });
    if (stage.kind === 'error') toast.error('No se pudo analizar tu comida', { action });
  }, [stage.kind]);

  // Mientras la hoja se cierra sigue mostrando lo último que tenía, aunque el análisis ya se haya limpiado
  const [lastShown, setLastShown] = useState(stage);
  if (open && lastShown !== stage) setLastShown(stage);
  const view = open ? stage : lastShown;

  /** Al cerrar, un resultado (guardado o no) se descarta; la foto o el texto de un intento fallido se conservan. */
  const changeOpen = (next: boolean) => {
    if (!next) {
      if (stage.kind === 'result') analysis.reset();
      if (stage.kind === 'error') analysis.backToInput();
    }
    onOpenChange(next);
  };

  const save = async () => {
    if (!onSave || stage.kind !== 'result') return;
    setSaving(true);
    try {
      await onSave(stage.data, mealType);
      toast.success(`Guardado en ${MEAL_LABELS[mealType].toLowerCase()}`);
      changeOpen(false);
    } catch (error) {
      console.error('Error al guardar la comida:', error);
      toast.error('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={changeOpen} eyebrow="Agregar comida" title={TITLES[view.kind]}>
      {view.kind === 'idle' && (
        <div className="flex flex-col gap-4">
          <Segmented label="Cómo agregar la comida" options={TABS} value={tab} onChange={setTab} />
          {tab === 'foto' && <PhotoTab analysis={analysis} />}
          {tab === 'texto' && <TextTab analysis={analysis} />}
          {tab === 'manual' && <ManualTab onSubmit={analysis.setManual} />}
        </div>
      )}

      {view.kind === 'analyzing' && <Analyzing preview={view.source === 'image' ? analysis.image?.preview : undefined} />}

      {view.kind === 'error' && (
        <AnalysisErrorPanel
          message={view.message}
          onRetry={view.source === 'image' ? analysis.analyzeImage : analysis.analyzeText}
          onEdit={
            view.source === 'text'
              ? () => {
                  setTab('texto');
                  analysis.backToInput();
                }
              : undefined
          }
          onCancel={() => changeOpen(false)}
        />
      )}

      {view.kind === 'result' && (
        <AnalysisResult
          resultId={view.id}
          manual={view.source === 'manual'}
          data={view.data}
          onChange={analysis.updateResult}
          mealType={mealType}
          onMealTypeChange={setMealType}
          onSave={onSave ? save : undefined}
          saving={saving}
          onDiscard={() => changeOpen(false)}
          onRequestAccount={onRequestAccount}
        />
      )}
    </Sheet>
  );
}

function PhotoTab({ analysis }: { analysis: FoodAnalysis }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Permite volver a elegir la misma foto
    event.target.value = '';
    if (!file) return;
    setPreparing(true);
    const error = await analysis.pickFile(file);
    setPreparing(false);
    if (error) toast.error(error);
  };

  const inputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </>
  );

  if (preparing) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-10 text-sm font-semibold text-ink-2">
        <Loader2 className="size-7 animate-spin" aria-hidden="true" />
        Preparando la foto…
        {inputs}
      </div>
    );
  }

  if (!analysis.image) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center gap-2.5 rounded-[26px] border-2 border-sticker bg-mango px-3 py-7 text-sticker shadow-sticker transition-[translate,box-shadow] duration-100 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            <Camera className="size-9" aria-hidden="true" />
            <span className="text-[15px] font-bold">Tomar foto</span>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex flex-col items-center gap-2.5 rounded-[26px] border-2 border-outline bg-card px-3 py-7 transition-colors hover:bg-ground active:scale-[0.97]"
          >
            <Images className="size-9" aria-hidden="true" />
            <span className="text-[15px] font-bold">Elegir de galería</span>
          </button>
        </div>
        <p className="text-center text-[13px] leading-relaxed text-ink-2">Procura que se vea todo el platillo y con buena luz.</p>
        {inputs}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-[26px] border-2 border-outline bg-ground">
        {/* Vista previa local (data URL): no pasa por el optimizador de imágenes */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={analysis.image.preview} alt="Foto de tu comida" className="max-h-72 w-full object-cover" />
        <Button variant="outline" size="icon" onClick={analysis.clearImage} aria-label="Quitar foto" className="absolute right-2.5 top-2.5 shadow-sticker-sm">
          <X className="size-5" aria-hidden="true" />
        </Button>
      </div>
      <Field
        id="portion-context"
        label="Contexto (opcional)"
        hint="Ayuda a calcular mejor: «plato pequeño», «me comí la mitad»."
        placeholder="Ej. Plato hondo grande"
        maxLength={300}
        value={analysis.portionContext}
        onChange={(e) => analysis.setPortionContext(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && analysis.analyzeImage()}
      />
      <Button size="lg" onClick={analysis.analyzeImage}>
        <Sparkles className="size-5" aria-hidden="true" />
        Analizar foto
      </Button>
      {inputs}
    </div>
  );
}

const MAX_DESCRIPTION = 500;

function TextTab({ analysis }: { analysis: FoodAnalysis }) {
  const tooShort = analysis.description.trim().length < 3;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="meal-description" className="text-[13px] font-bold">
          Describe lo que comiste
        </label>
        <textarea
          id="meal-description"
          rows={4}
          maxLength={MAX_DESCRIPTION}
          value={analysis.description}
          onChange={(e) => analysis.setDescription(e.target.value)}
          placeholder="Ej. 2 tacos de carne asada con tortilla de maíz y una taza de café"
          className="w-full resize-none rounded-2xl border-2 border-outline bg-ground p-3.5 text-base leading-relaxed text-ink placeholder:text-ink-3 focus-visible:outline-offset-0"
        />
        <div className="flex justify-between gap-3 text-xs text-ink-3">
          <span>Con cantidades el cálculo sale mejor.</span>
          <span className="shrink-0 tabular-nums">
            {analysis.description.length}/{MAX_DESCRIPTION}
          </span>
        </div>
      </div>
      <Button size="lg" onClick={analysis.analyzeText} disabled={tooShort}>
        <Sparkles className="size-5" aria-hidden="true" />
        Analizar
      </Button>
    </div>
  );
}

const MANUAL_FIELDS = [
  ['calories', 'Calorías (kcal)'],
  ['protein', 'Proteína (g)'],
  ['carbs', 'Carbohidratos (g)'],
  ['fat', 'Grasas (g)'],
] as const;

const toAmount = (text: string) => Math.max(0, Math.round(Number(text)) || 0);

function ManualTab({ onSubmit }: { onSubmit: (entry: NutritionData) => void }) {
  const [name, setName] = useState('');
  const [amounts, setAmounts] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [missingName, setMissingName] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setMissingName(true);
      return;
    }
    onSubmit({
      food_name: name.trim(),
      calories: toAmount(amounts.calories),
      protein: toAmount(amounts.protein),
      carbs: toAmount(amounts.carbs),
      fat: toAmount(amounts.fat),
      confidence: 'Alta',
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
      <Field
        id="manual-name"
        label="Nombre del alimento"
        placeholder="Ej. Manzana pequeña"
        maxLength={120}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setMissingName(false);
        }}
        aria-invalid={missingName}
        aria-describedby={missingName ? 'manual-name-error' : undefined}
      />
      {missingName && (
        <p id="manual-name-error" role="alert" className="-mt-2 text-[13px] font-semibold text-danger">
          Escribe el nombre del alimento.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {MANUAL_FIELDS.map(([key, label]) => (
          <Field
            key={key}
            id={`manual-${key}`}
            label={label}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={amounts[key]}
            onChange={(e) => setAmounts({ ...amounts, [key]: e.target.value })}
          />
        ))}
      </div>
      <Button size="lg" type="submit">
        Continuar
      </Button>
    </form>
  );
}

const FLOATING = [
  { emoji: '🥑', className: '-left-10 top-2', delay: 0 },
  { emoji: '🌮', className: '-right-10 top-10', delay: 0.5 },
  { emoji: '🍓', className: '-bottom-3 -left-6', delay: 1 },
];

function Analyzing({ preview }: { preview?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-6 px-2 pb-4 pt-8 text-center">
      <div className="relative">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-40 rotate-[-3deg] rounded-[30px] border-2 border-outline object-cover shadow-sticker" />
        ) : (
          <FoodSticker emoji="🍽️" size="xl" index={1} className="size-32 text-6xl shadow-sticker" />
        )}
        {FLOATING.map(({ emoji, className, delay }) => (
          <motion.span
            key={emoji}
            aria-hidden="true"
            className={`absolute grid size-12 place-items-center rounded-2xl border-2 border-outline bg-card text-2xl ${className}`}
            animate={{ y: [0, -8, 0], rotate: [-6, 6, -6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay }}
          >
            {emoji}
          </motion.span>
        ))}
      </div>
      <div className="space-y-1.5">
        <p className="font-display text-2xl font-extrabold tracking-tight">Analizando tu comida</p>
        <p className="text-sm leading-relaxed text-ink-2">Identifico cada alimento y calculo sus calorías y macros. Suele tardar unos segundos.</p>
      </div>
      <div aria-hidden="true" className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-3 rounded-full border-2 border-sticker bg-mango"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }}
          />
        ))}
      </div>
    </div>
  );
}
