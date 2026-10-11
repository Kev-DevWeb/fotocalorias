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
  /** Identificador usado en AI_PROVIDERS (ej: "gemini", "github", "groq") */
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
  constructor(public provider: string, message: string, public status?: number) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
  }
}
