'use client';

import { RefreshCw } from 'lucide-react';

/** Aviso cuando el servidor ya corre una versión más nueva que la que tiene cargada el navegador. */
export default function StaleVersionBanner() {
  return (
    <div className="flex items-center justify-between gap-3 bg-slate-900 px-4 py-2 text-sm text-white" role="status">
      <span>Hay una versión nueva de xCal.</span>
      <button
        onClick={() => window.location.reload()}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 font-semibold transition-colors hover:bg-orange-600"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Actualizar
      </button>
    </div>
  );
}
