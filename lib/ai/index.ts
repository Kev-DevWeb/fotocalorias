import { nutritionDataSchema, normalizeNutrition, type ValidatedNutritionData } from '@/lib/schemas';
import { extractJson } from './extract-json';
import { buildPrompt } from './prompt';
import { geminiProvider } from './providers/gemini';
import { githubModelsProvider, groqProvider, openRouterProvider } from './providers/openai-compatible';
import type { AnalysisInput, NutritionProvider } from './types';

const ALL_PROVIDERS: Record<string, NutritionProvider> = {
  gemini: geminiProvider,
  github: githubModelsProvider,
  groq: groqProvider,
  openrouter: openRouterProvider,
};

const DEFAULT_ORDER = 'github,gemini,groq,openrouter';
// Presupuesto total por petición (Vercel maxDuration = 30 s); se reparte entre proveedores
const TOTAL_BUDGET_MS = 25_000;
const MAX_PER_PROVIDER_MS = 12_000;

export function getProviderChain(order = process.env.AI_PROVIDERS || DEFAULT_ORDER): NutritionProvider[] {
  return order
    .split(',')
    .map((id) => ALL_PROVIDERS[id.trim().toLowerCase()])
    .filter((p): p is NutritionProvider => Boolean(p) && p.isConfigured());
}

export type AnalysisResult =
  | { ok: true; data: ValidatedNutritionData | { error: string; model_used?: string } }
  | { ok: false; error: string; attempts: string[] };

/** Parsea y valida la respuesta cruda de un modelo. Lanza si no es utilizable. */
export function parseModelOutput(text: string): ValidatedNutritionData | { error: string } {
  const json = extractJson(text);
  if (!json) throw new Error('No se encontró JSON en la respuesta');
  const normalized = normalizeNutrition(JSON.parse(json));
  if (typeof normalized.error === 'string' && !normalized.food_name) {
    return { error: normalized.error };
  }
  delete normalized.error;
  return nutritionDataSchema.parse(normalized);
}

/**
 * Prueba cada proveedor configurado en orden. Si uno falla (HTTP, timeout o JSON
 * inválido según Zod) pasa al siguiente, en vez de devolver el error al usuario.
 */
export async function analyzeWithFallback(input: AnalysisInput, chain = getProviderChain()): Promise<AnalysisResult> {
  if (chain.length === 0) {
    return { ok: false, error: 'No hay proveedores de IA configurados (revisa las API keys)', attempts: [] };
  }

  const prompt = buildPrompt(input);
  const attempts: string[] = [];
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (const provider of chain) {
    const remaining = deadline - Date.now();
    if (remaining < 2_000) break;
    const started = Date.now();
    try {
      const { text, model } = await provider.generate(input, prompt, Math.min(MAX_PER_PROVIDER_MS, remaining));
      const data = parseModelOutput(text);
      console.log(`✅ ${provider.id}/${model} respondió en ${Date.now() - started} ms`);
      return { ok: true, data: { ...data, model_used: `${provider.id}/${model}` } };
    } catch (error) {
      const msg = error instanceof Error ? (error.name === 'AbortError' ? 'timeout' : error.message) : String(error);
      console.warn(`⚠️ ${provider.id} falló tras ${Date.now() - started} ms: ${msg.slice(0, 300)}`);
      attempts.push(`${provider.id}: ${msg.slice(0, 200)}`);
    }
  }

  return { ok: false, error: 'Ningún proveedor de IA devolvió una respuesta válida', attempts };
}
