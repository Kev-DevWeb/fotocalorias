import { geminiResponseSchema } from '../contract';
import { fetchWithTimeout } from '../fetch-timeout';
import { modelsFor, SAMPLING } from '../models';
import { ProviderError, type NutritionProvider } from '../types';

// La comida no debería activar filtros, pero una foto con personas sí puede hacerlo
const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_NONE' }));

export const geminiProvider: NutritionProvider = {
  id: 'gemini',
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
  models: modelsFor.gemini,
  supports: () => true,

  async generate({ input, prompt, model, timeoutMs, signal }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const parts: Record<string, unknown>[] = [{ text: prompt }];
    if (input.kind === 'image') {
      parts.push({ inlineData: { mimeType: input.mimeType, data: input.imageBase64 } });
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          ...SAMPLING,
          maxOutputTokens: 2048,
          // El schema se envía SIEMPRE: sin él Gemini responde con el formato que quiere
          responseMimeType: 'application/json',
          responseSchema: geminiResponseSchema,
          thinkingConfig: { thinkingLevel: 'MINIMAL' },
        },
        safetySettings: SAFETY_SETTINGS,
      }),
    }, timeoutMs, signal);

    if (!response.ok) {
      throw new ProviderError('gemini', `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`, response.status);
    }

    const result = await response.json();
    const blockReason = result.promptFeedback?.blockReason;
    if (blockReason) throw new ProviderError('gemini', `Petición bloqueada (${blockReason})`);

    const candidate = result.candidates?.[0];
    const finishReason = candidate?.finishReason ?? 'desconocido';
    const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
    if (!text) throw new ProviderError('gemini', `Sin texto en la respuesta (finishReason: ${finishReason})`);
    // MAX_TOKENS o SAFETY dejan el JSON a medias
    if (finishReason !== 'STOP') throw new ProviderError('gemini', `Respuesta incompleta (finishReason: ${finishReason})`);
    return { text };
  },
};
