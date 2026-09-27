import { fetchWithTimeout } from '../fetch-timeout';
import { geminiResponseSchema } from '../prompt';
import { ProviderError, type NutritionProvider } from '../types';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

export const geminiProvider: NutritionProvider = {
  id: 'gemini',
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),

  async generate(input, prompt, timeoutMs) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
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
          temperature: 0.2,
          maxOutputTokens: 1024,
          // El schema se envía SIEMPRE: sin él Gemini responde con el formato que quiere
          responseMimeType: 'application/json',
          responseSchema: geminiResponseSchema,
          thinkingConfig: { thinkingLevel: 'MINIMAL' },
        },
      }),
    }, timeoutMs);

    if (!response.ok) {
      throw new ProviderError('gemini', `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`, response.status);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];
    const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
    if (!text) {
      throw new ProviderError('gemini', `Sin texto en la respuesta (finishReason: ${candidate?.finishReason ?? 'desconocido'})`);
    }
    return { text, model: MODEL };
  },
};
