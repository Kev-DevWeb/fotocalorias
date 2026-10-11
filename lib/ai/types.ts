export type AnalysisInput =
  | { kind: 'image'; imageBase64: string; mimeType: string; portionContext?: string }
  | { kind: 'text'; description: string };

export interface GenerateRequest {
  input: AnalysisInput;
  prompt: string;
  model: string;
  timeoutMs: number;
  /** Permite abortar la petición cuando otro candidato ya respondió */
  signal?: AbortSignal;
}

export interface NutritionProvider {
  /** Identificador usado en AI_PROVIDERS (ej: "gemini", "groq") */
  id: string;
  /** Devuelve true si el proveedor tiene su API key configurada */
  isConfigured(): boolean;
  /** Modelos del proveedor, en orden de preferencia */
  models(): string[];
  /** false si el proveedor no puede procesar esta entrada (ej. HEIC fuera de Gemini) */
  supports(input: AnalysisInput): boolean;
  /** Devuelve el texto crudo del modelo (idealmente JSON) */
  generate(req: GenerateRequest): Promise<{ text: string }>;
}

export class ProviderError extends Error {
  /**
   * @param fatal true si reintentar no sirve aunque no haya un estado HTTP de error
   *              (por ejemplo, un endpoint retirado que responde 200 con texto plano).
   */
  constructor(public provider: string, message: string, public status?: number, public fatal = false) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
  }
}

/**
 * Lee el cuerpo como JSON. Un servicio retirado o mal enrutado puede responder
 * 200 con texto plano; eso es un fallo del proveedor, no una respuesta rara del modelo.
 */
export async function readProviderJson(provider: string, response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // se reporta abajo
  }
  throw new ProviderError(provider, `El endpoint no devolvió JSON (HTTP ${response.status}): ${JSON.stringify(raw.slice(0, 80))}`, response.status, true);
}
