/**
 * Compara los proveedores de IA: % de respuestas válidas según Zod y latencia.
 *
 *   npx tsx --env-file=.env.local scripts/test-providers.ts [foto1.jpg foto2.png ...]
 *
 * Sin API keys solo corre las pruebas offline de normalización.
 */
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { getProviderChain, parseModelOutput } from '../lib/ai';
import { buildPrompt } from '../lib/ai/prompt';
import type { AnalysisInput } from '../lib/ai/types';

// 1. Pruebas offline: respuestas "mal formadas" reales que antes rompían el parseo
const MESSY_OUTPUTS = [
  '```json\n{"food_name":"Tacos","calories":"450 kcal","protein":20.6,"carbs":40,"fat":18,"nova_group":0}\n```',
  'Claro, aquí tienes: {"foodName":"Ensalada","kcal":180,"proteins":5,"carbohydrates":12,"fats":11,"sugar":null}',
  '{"result":{"food_name":"Pizza","calories":800,"protein":30,"carbs":90,"fat":35,"detected_items":"queso, masa"}}',
  '[{"name":"Manzana","calories":95,"protein":0,"carbs":25,"fat":0,"nova_group":7}]',
  '{"error":"No se detectó comida"}',
];
let offlineOk = 0;
for (const raw of MESSY_OUTPUTS) {
  try {
    const parsed = parseModelOutput(raw);
    offlineOk++;
    console.log('  ✓', JSON.stringify(parsed));
  } catch (e) {
    console.log('  ✗', raw.slice(0, 60), '→', (e as Error).message.slice(0, 120));
  }
}
console.log(`Normalización offline: ${offlineOk}/${MESSY_OUTPUTS.length}\n`);

// 2. Pruebas en vivo contra cada proveedor configurado
const TEXTS = [
  '2 tacos al pastor con piña y salsa verde',
  'un plato de arroz blanco con pechuga de pollo a la plancha y ensalada',
  'una coca cola de 600 ml y unas papas sabritas',
  'avena con leche, plátano y una cucharada de crema de cacahuate',
  'hamburguesa doble con queso y papas fritas medianas',
];
const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const inputs: AnalysisInput[] = [
  ...TEXTS.map((description) => ({ kind: 'text' as const, description })),
  ...process.argv.slice(2).map((file) => ({
    kind: 'image' as const,
    imageBase64: readFileSync(file).toString('base64'),
    mimeType: MIME[extname(file).toLowerCase()] ?? 'image/jpeg',
  })),
];

(async () => {
  const chain = getProviderChain('github,gemini,groq,openrouter');
  if (chain.length === 0) console.log('Sin API keys configuradas: se omiten las pruebas en vivo.');
  for (const provider of chain) {
    let valid = 0;
    const times: number[] = [];
    for (const input of inputs) {
      const t0 = Date.now();
      try {
        const { text } = await provider.generate(input, buildPrompt(input), 20_000);
        parseModelOutput(text);
        valid++;
      } catch (e) {
        console.log(`  ${provider.id} ✗ ${(e as Error).message.slice(0, 150)}`);
      }
      times.push(Date.now() - t0);
    }
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    console.log(`${provider.id}: ${valid}/${inputs.length} válidas, ${avg} ms promedio`);
  }
})();
