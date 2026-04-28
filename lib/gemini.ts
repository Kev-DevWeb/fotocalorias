export function extractJsonFromGemini(rawText: string): string | null {
  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const startIndex = rawText.indexOf('{');
  if (startIndex === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < rawText.length; i += 1) {
    const char = rawText[i];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return rawText.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}
