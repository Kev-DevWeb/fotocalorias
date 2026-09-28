export type AnalysisInput =
  | { kind: 'image'; imageBase64: string; mimeType: string; portionContext?: string }
  | { kind: 'text'; description: string };

export interface NutritionProvider {
  /** Identificador usado en AI_PROVIDERS (ej: "gemini", "github", "groq") */
  id: string;
  /** Devuelve true si el proveedor tiene su API key configurada */
  isConfigured(): boolean;
  /** Devuelve el texto crudo del modelo (idealmente JSON) y el modelo usado */
  generate(input: AnalysisInput, prompt: string, timeoutMs: number): Promise<{ text: string; model: string }>;
}

export class ProviderError extends Error {
  constructor(public provider: string, message: string, public status?: number) {
    super(`[${provider}] ${message}`);
  }
}
