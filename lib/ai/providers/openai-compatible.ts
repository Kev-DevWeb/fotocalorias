import { strictJsonSchema } from '../contract';
import { fetchWithTimeout } from '../fetch-timeout';
import { modelsFor, SAMPLING } from '../models';
import { ProviderError, type NutritionProvider } from '../types';

interface OpenAICompatibleConfig {
  id: string;
  baseUrl: string;
  apiKeyEnv: string;
  models: () => string[];
  /** 'json_schema' = structured outputs estricto; 'json_object' = JSON mode */
  responseFormat: 'json_schema' | 'json_object';
  /** Tamaño máximo de la imagen en base64 que acepta el endpoint */
  maxImageBase64Chars?: number;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Proveedor para cualquier API compatible con OpenAI Chat Completions (GitHub Models, Groq...). */
export function createOpenAICompatibleProvider(cfg: OpenAICompatibleConfig): NutritionProvider {
  return {
    id: cfg.id,
    isConfigured: () => Boolean(process.env[cfg.apiKeyEnv]),
    models: cfg.models,
    supports(input) {
      if (input.kind !== 'image') return true;
      if (!IMAGE_TYPES.includes(input.mimeType)) return false;
      return !cfg.maxImageBase64Chars || input.imageBase64.length <= cfg.maxImageBase64Chars;
    },

    async generate({ input, prompt, model, timeoutMs, signal }) {
      const content = input.kind === 'image'
        ? [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}` } },
          ]
        : prompt;

      const response_format = cfg.responseFormat === 'json_schema'
        ? { type: 'json_schema', json_schema: { name: 'nutrition', strict: true, schema: strictJsonSchema } }
        : { type: 'json_object' };

      const response = await fetchWithTimeout(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env[cfg.apiKeyEnv]}`,
        },
        body: JSON.stringify({
          model,
          ...SAMPLING,
          max_tokens: 2048,
          response_format,
          messages: [{ role: 'user', content }],
        }),
      }, timeoutMs, signal);

      if (!response.ok) {
        throw new ProviderError(cfg.id, `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`, response.status);
      }

      const result = await response.json();
      const choice = result.choices?.[0];
      const finishReason = choice?.finish_reason ?? 'desconocido';
      const text = choice?.message?.content;
      if (!text) throw new ProviderError(cfg.id, `Sin texto en la respuesta (finish_reason: ${finishReason})`);
      if (finishReason === 'length') throw new ProviderError(cfg.id, 'Respuesta incompleta (finish_reason: length)');
      return { text };
    },
  };
}

// GitHub Models: gratis con una cuenta de GitHub (PAT con permiso models:read).
export const githubModelsProvider = createOpenAICompatibleProvider({
  id: 'github',
  baseUrl: 'https://models.github.ai/inference',
  apiKeyEnv: 'GITHUB_MODELS_TOKEN',
  models: modelsFor.github,
  responseFormat: 'json_schema',
});

// Groq: plan gratuito, muy rápido. Acepta imágenes en base64 de hasta 4 MB.
export const groqProvider = createOpenAICompatibleProvider({
  id: 'groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  apiKeyEnv: 'GROQ_API_KEY',
  models: modelsFor.groq,
  responseFormat: 'json_object',
  maxImageBase64Chars: 4_000_000,
});
