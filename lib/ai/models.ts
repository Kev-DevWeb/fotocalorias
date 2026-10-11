// IDs de modelo en un solo lugar. Los proveedores retiran modelos sin avisar al
// código: si uno deja de existir, se cambia aquí o con la variable de entorno,
// y /api/health?deep=1 lo detecta.

function list(value: string | undefined, fallback: string[]): string[] {
  const parsed = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return parsed.length ? parsed : fallback;
}

export const modelsFor = {
  // Dos modelos "lite": cada uno tiene su propia cuota gratuita y su latencia varía por separado.
  // gemini-3.5-flash se descartó: su cuota diaria es pequeña y devuelve 503 con frecuencia.
  gemini: () => list(process.env.GEMINI_MODELS ?? process.env.GEMINI_MODEL, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']),
  // Modelo de visión vigente en console.groq.com/docs/vision (llama-4-scout se retiró el 17/07/2026)
  groq: () => list(process.env.GROQ_MODELS ?? process.env.GROQ_MODEL, ['qwen/qwen3.8-27b']),
};

/** Misma semilla y temperatura 0 en todos los proveedores: la misma entrada debe dar el mismo resultado. */
export const SAMPLING = { temperature: 0, seed: 7 } as const;
