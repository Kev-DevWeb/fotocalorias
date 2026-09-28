'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { buildClipboardText, formatForHuawei, huaweiIntentUrl, isAndroid, type HuaweiLoggable } from '@/lib/huawei-health';

interface HuaweiLogSheetProps {
  log: HuaweiLoggable & { id: string };
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

  const values: [string, string, string][] = [
    ['kcal', String(data.kcal), 'text-orange-600 bg-orange-50'],
    ['Proteína', `${data.protein} g`, 'text-blue-600 bg-blue-50'],
    ['Carbos', `${data.carbs} g`, 'text-green-600 bg-green-50'],
    ['Grasa', `${data.fat} g`, 'text-yellow-600 bg-yellow-50'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl p-5 pb-8 shadow-xl animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Registrar en Huawei Health · {data.mealLabel}</p>
            <button onClick={() => copyValue('nombre', data.title)} className="text-left">
              <h3 className="font-bold text-lg text-slate-800 truncate select-all">{data.title}</h3>
            </button>
          </div>
          <button onClick={onClose} className="text-slate-400 p-1" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-2">
          {values.map(([label, value, color]) => (
            <button
              key={label}
              onClick={() => copyValue(label, value.replace(' g', ''))}
              className={`rounded-xl py-3 flex flex-col items-center ${color}`}
            >
              <span className={`font-black select-all ${label === 'kcal' ? 'text-2xl' : 'text-lg'}`}>{value}</span>
              <span className="text-[10px] font-semibold opacity-80">{label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-center h-4 mb-3 text-slate-500">
          {copyFailed
            ? 'No se pudo copiar: selecciona el valor y cópialo manualmente'
            : copied
              ? `✓ Copiado: ${copied}`
              : 'Toca un valor para copiarlo'}
        </p>

        <button
          onClick={copyAndOpen}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl mb-2"
        >
          <Copy className="w-4 h-4" /> Copiar y abrir Huawei Health <ExternalLink className="w-4 h-4" />
        </button>
        <button
          onClick={markLogged}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl disabled:opacity-50"
        >
          <Check className="w-4 h-4" /> {saving ? 'Guardando...' : 'Ya lo registré'}
        </button>
      </div>
    </div>
  );
}
