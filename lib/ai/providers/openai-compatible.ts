import { fetchWithTimeout } from '../fetch-timeout';
import { strictJsonSchema } from '../prompt';
import { ProviderError, type NutritionProvider } from '../types';

interface OpenAICompatibleConfig {
  id: string;
  baseUrl: string;
  apiKeyEnv: string;
  /** Modelo con visión (se usa para imagen y texto salvo que se defina textModel) */
  model: string;
  textModel?: string;
  /** 'json_schema' = structured outputs estricto; 'json_object' = JSON mode */
  responseFormat: 'json_schema' | 'json_object';
  extraHeaders?: Record<string, string>;
}

/** Proveedor para cualquier API compatible con OpenAI Chat Completions (GitHub Models, Groq, OpenRouter...). */
export function createOpenAICompatibleProvider(cfg: OpenAICompatibleConfig): NutritionProvider {
  return {
    id: cfg.id,
    isConfigured: () => Boolean(process.env[cfg.apiKeyEnv]),

    async generate(input, prompt, timeoutMs) {
      const model = input.kind === 'text' ? cfg.textModel ?? cfg.model : cfg.model;
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
          ...cfg.extraHeaders,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 1024,
          response_format,
          messages: [{ role: 'user', content }],
        }),
      }, timeoutMs);

      if (!response.ok) {
        throw new ProviderError(cfg.id, `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`, response.status);
      }

      const result = await response.json();
      const text = result.choices?.[0]?.message?.content;
      if (!text) {
        throw new ProviderError(cfg.id, `Sin texto en la respuesta (finish_reason: ${result.choices?.[0]?.finish_reason ?? 'desconocido'})`);
      }
      return { text, model };
    },
  };
}

// GitHub Models: gratis con una cuenta de GitHub (PAT con permiso models:read).
export const githubModelsProvider = createOpenAICompatibleProvider({
  id: 'github',
  baseUrl: 'https://models.github.ai/inference',
  apiKeyEnv: 'GITHUB_MODELS_TOKEN',
  model: process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4.1-mini',
  responseFormat: 'json_schema',
});

// Groq: plan gratuito, muy rápido. Llama 4 Scout tiene visión.
export const groqProvider = createOpenAICompatibleProvider({
  id: 'groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  apiKeyEnv: 'GROQ_API_KEY',
  model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
  responseFormat: 'json_object',
});

// OpenRouter: modelos ":free" (opcional).
export const openRouterProvider = createOpenAICompatibleProvider({
  id: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKeyEnv: 'OPENROUTER_API_KEY',
  model: process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free',
  responseFormat: 'json_object',
  extraHeaders: { 'X-Title': 'fotocalorias' },
});
