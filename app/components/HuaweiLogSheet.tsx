'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { buildClipboardText, formatForHuawei, huaweiIntentUrl, isAndroid, type HuaweiLoggable } from '@/lib/huawei-health';
import { Button } from './ui/Button';
import { MacroDot, type MacroKey } from './ui/dataviz';
import { Sheet } from './ui/Sheet';

type Loggable = HuaweiLoggable & { id: string };

interface HuaweiLogSheetProps {
  /** Comida a pasar a Huawei Health; null cierra la hoja */
  log: Loggable | null;
  onMarkLogged: (id: string) => Promise<void>;
  onClose: () => void;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function HuaweiLogSheet({ log, onMarkLogged, onClose }: HuaweiLogSheetProps) {
  // Se conserva la última comida para que no desaparezca mientras la hoja se cierra
  const [shown, setShown] = useState(log);
  if (log && log !== shown) setShown(log);

  return (
    <Sheet
      open={Boolean(log)}
      onOpenChange={(open) => !open && onClose()}
      eyebrow={shown ? `Huawei Health · ${formatForHuawei(shown).mealLabel}` : 'Huawei Health'}
      title="Pasar a Huawei"
    >
      {shown && <HuaweiValues key={shown.id} log={shown} onMarkLogged={onMarkLogged} onClose={onClose} />}
    </Sheet>
  );
}

function HuaweiValues({ log, onMarkLogged, onClose }: { log: Loggable } & Pick<HuaweiLogSheetProps, 'onMarkLogged' | 'onClose'>) {
  const data = formatForHuawei(log);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const copyValue = async (label: string, value: string) => {
    const ok = await copy(value);
    setCopyFailed(!ok);
    setCopied(ok ? label : null);
  };

  const copyAndOpen = async () => {
    await copyValue('texto', buildClipboardText(log));
    if (isAndroid()) window.location.href = huaweiIntentUrl();
  };

  const markLogged = async () => {
    setSaving(true);
    try {
      await onMarkLogged(log.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const macros: [MacroKey, string, number][] = [
    ['protein', 'Proteína', data.protein],
    ['carbs', 'Carbos', data.carbs],
    ['fat', 'Grasa', data.fat],
  ];

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => copyValue('nombre', data.title)}
        className="rounded-[20px] border-2 border-outline bg-ground px-4 py-3 text-left transition-colors hover:bg-track"
      >
        <span className="block text-xs font-semibold text-ink-2">Nombre</span>
        <span className="block select-all text-[15px] font-bold [text-wrap:pretty]">{data.title}</span>
      </button>

      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => copyValue('kcal', String(data.kcal))}
          className="flex flex-col items-center gap-0.5 rounded-[20px] border-2 border-sticker bg-mango px-1 py-3 text-sticker"
        >
          <span className="select-all font-display text-2xl font-extrabold leading-none">{data.kcal}</span>
          <span className="text-xs font-bold">kcal</span>
        </button>
        {macros.map(([macro, label, grams]) => (
          <button
            key={macro}
            type="button"
            onClick={() => copyValue(label, String(grams))}
            className="flex flex-col items-center gap-0.5 rounded-[20px] border-2 border-outline bg-card px-1 py-3 transition-colors hover:bg-ground"
          >
            <span className="select-all font-display text-2xl font-extrabold leading-none">{grams} g</span>
            <span className="flex items-center gap-1 text-xs font-semibold text-ink-2">
              <MacroDot macro={macro} className="size-2" />
              {label}
            </span>
          </button>
        ))}
      </div>

      <p aria-live="polite" className="min-h-5 text-center text-[13px] text-ink-2">
        {copyFailed
          ? 'No se pudo copiar: selecciona el valor y cópialo a mano'
          : copied
            ? `Copiado: ${copied}`
            : 'Toca un valor para copiarlo'}
      </p>

      <Button size="lg" onClick={copyAndOpen}>
        <Copy className="size-[18px]" aria-hidden="true" /> Copiar y abrir Huawei Health <ExternalLink className="size-4" aria-hidden="true" />
      </Button>
      <Button variant="outline" onClick={markLogged} disabled={saving}>
        <Check className="size-[18px]" aria-hidden="true" /> {saving ? 'Guardando…' : 'Ya lo registré'}
      </Button>
    </div>
  );
}
