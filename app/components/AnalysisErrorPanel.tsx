'use client';

import { AlertTriangle, Pencil, RotateCcw } from 'lucide-react';

interface AnalysisErrorPanelProps {
  message: string;
  onRetry: () => void;
  /** Solo para el análisis por texto: volver a editar la descripción */
  onEdit?: () => void;
  onCancel: () => void;
}

/** Se muestra dentro del modal de análisis cuando falla, sin descartar la foto ni el texto. */
export default function AnalysisErrorPanel({ message, onRetry, onEdit, onCancel }: AnalysisErrorPanelProps) {
  return (
    <div className="space-y-4" role="alert">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <p>{message}</p>
      </div>
      <div className="space-y-2">
        <button
          onClick={onRetry}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-orange-600"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reintentar
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" /> Editar descripción
          </button>
        )}
        <button onClick={onCancel} className="w-full px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
          Cancelar
        </button>
      </div>
    </div>
  );
}
