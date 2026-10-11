'use client';

import { Pencil, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from './ui/Button';

interface AnalysisErrorPanelProps {
  message: string;
  onRetry: () => void;
  /** Solo para el análisis por texto: volver a editar la descripción */
  onEdit?: () => void;
  onCancel: () => void;
}

/** Se muestra dentro de la hoja de análisis cuando falla, sin descartar la foto ni el texto. */
export default function AnalysisErrorPanel({ message, onRetry, onEdit, onCancel }: AnalysisErrorPanelProps) {
  return (
    <div className="flex flex-col gap-4" role="alert">
      <div className="flex items-start gap-3 rounded-[22px] border-2 border-outline bg-mango-soft p-4 text-sm leading-relaxed">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>{message}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <Button size="lg" onClick={onRetry}>
          <RotateCcw className="size-[18px]" aria-hidden="true" /> Reintentar
        </Button>
        {onEdit && (
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden="true" /> Editar descripción
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
