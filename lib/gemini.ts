export function extractJsonFromGemini(rawText: string): string | null {
  // 1. Try fenced code blocks first; return the first block that is valid JSON.
  const fencedRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let fencedMatch: RegExpExecArray | null;
  while ((fencedMatch = fencedRegex.exec(rawText)) !== null) {
    const candidate = fencedMatch[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // not valid JSON – try the next fenced block
    }
  }

  // Helper: scan `text` for the first balanced openChar…closeChar slice that
  // parses as valid JSON.  Advances past rejected slices to keep searching.
  function extractBalanced(text: string, openChar: string, closeChar: string): string | null {
    let from = 0;
    outer: while (true) {
      const startIndex = text.indexOf(openChar, from);
      if (startIndex === -1) break;

      let depth = 0;
      let inString = false;
      let escapeNext = false;

      for (let i = startIndex; i < text.length; i += 1) {
        const char = text[i];

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

        if (char === openChar) {
          depth += 1;
          continue;
        }

        if (char === closeChar) {
          depth -= 1;
          if (depth === 0) {
            const candidate = text.slice(startIndex, i + 1);
            try {
              JSON.parse(candidate);
              return candidate;
            } catch {
              // not valid JSON – advance past this closing char and try again
              from = i + 1;
              continue outer;
            }
          }
        }
      }

      // No matching closeChar found for this openChar – advance past it
      from = startIndex + 1;
    }
    return null;
  }

  // 2. Scan for JSON objects ({...}).
  const objectResult = extractBalanced(rawText, '{', '}');
  if (objectResult !== null) return objectResult;

  // 3. Scan for JSON arrays ([...]).
  return extractBalanced(rawText, '[', ']');
}
