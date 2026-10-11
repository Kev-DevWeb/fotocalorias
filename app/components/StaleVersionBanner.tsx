'use client';

import { RefreshCw } from 'lucide-react';

/** Aviso cuando el servidor ya corre una versión más nueva que la que tiene cargada el navegador. */
export default function StaleVersionBanner() {
  return (
    <div className="flex items-center justify-between gap-3 bg-inverse px-4 py-2 text-sm font-semibold text-on-inverse" role="status">
      <span>Hay una versión nueva de xCal.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border-2 border-sticker bg-mango px-3 font-bold text-sticker"
      >
        <RefreshCw className="size-4" aria-hidden="true" /> Actualizar
      </button>
    </div>
  );
}
