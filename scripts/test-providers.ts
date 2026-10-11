/**
 * Prueba en vivo cada candidato de IA (proveedor + modelo) por separado:
 * respuestas válidas, detección de "no es comida", consistencia y latencia.
 *
 *   npx tsx --env-file=.env.local scripts/test-providers.ts [foto1.jpg foto2.png ...]
 *
 * Solo prueba los proveedores que tengan su API key en el entorno.
 */
import { readFileSync } from 'node:fs';
import { getCandidates } from '../lib/ai';
import { runEngine, type Candidate } from '../lib/ai/engine';
import type { AnalysisInput } from '../lib/ai/types';
import { cleanText, validateImage } from '../lib/ai/validate-input';

const FOOD_TEXTS = [
  '2 tacos al pastor con piña y salsa verde',
  '1 taza de café con 6 galletas de mazapán y una guayaba',
  'un plato de arroz blanco con pechuga de pollo a la plancha y ensalada',
  'una coca cola de 600 ml y unas papas sabritas',
  'avena con leche, plátano y una cucharada de crema de cacahuate',
];
const NOT_FOOD_TEXTS = ['un ladrillo y tres tornillos', 'asdfgh qwerty zxcvb'];
const CONSISTENCY_TEXT = FOOD_TEXTS[1];
const CONSISTENCY_RUNS = 5;

const text = (description: string): AnalysisInput => ({ kind: 'text', description: cleanText(description, { min: 3, max: 500 }) });

function image(file: string): AnalysisInput {
  const valid = validateImage(readFileSync(file).toString('base64'));
  return { kind: 'image', imageBase64: valid.base64, mimeType: valid.mimeType };
}

/** Un solo intento contra un solo candidato, sin segunda vuelta que maquille los fallos. */
async function run(candidate: Candidate, input: AnalysisInput) {
  const started = Date.now();
  const result = await runEngine(input, { candidates: [candidate], hedgeAfterMs: 60_000, totalBudgetMs: 20_000, maxAttemptMs: 20_000, passes: 1 });
  return { result, ms: Date.now() - started };
}

(async () => {
  const candidates = getCandidates('gemini,github,groq');
  if (candidates.length === 0) {
    console.log('Sin API keys en el entorno: no hay nada que probar.');
    return;
  }
  const images = process.argv.slice(2);

  for (const candidate of candidates) {
    console.log(`\n=== ${candidate.id}`);
    const times: number[] = [];

    let valid = 0;
    const foodInputs = [...FOOD_TEXTS.map(text), ...images.map(image)];
    for (const input of foodInputs) {
      const { result, ms } = await run(candidate, input);
      times.push(ms);
      if (result.ok) valid++;
      else console.log(`  ✗ ${input.kind}: ${result.code} ${result.attempts.at(-1)?.detail ?? ''}`.slice(0, 220));
    }
    console.log(`  comida válida:    ${valid}/${foodInputs.length}`);

    let rejected = 0;
    for (const description of NOT_FOOD_TEXTS) {
      const { result, ms } = await run(candidate, text(description));
      times.push(ms);
      if (!result.ok && result.code === 'NO_FOOD') rejected++;
      else console.log(`  ✗ "${description}" → ${result.ok ? `comida de ${result.data.calories} kcal` : result.code}`);
    }
    console.log(`  no comida:        ${rejected}/${NOT_FOOD_TEXTS.length} rechazadas`);

    const kcals: (number | string)[] = [];
    for (let i = 0; i < CONSISTENCY_RUNS; i++) {
      const { result, ms } = await run(candidate, text(CONSISTENCY_TEXT));
      times.push(ms);
      kcals.push(result.ok ? result.data.calories : result.code);
    }
    const distinct = new Set(kcals).size;
    console.log(`  consistencia:     ${distinct === 1 ? 'igual' : `${distinct} valores distintos`} en ${CONSISTENCY_RUNS} intentos (${kcals.join(', ')} kcal)`);

    const sorted = [...times].sort((a, b) => a - b);
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    console.log(`  latencia:         ${avg} ms promedio, ${sorted.at(-1)} ms máximo`);
  }
})();
