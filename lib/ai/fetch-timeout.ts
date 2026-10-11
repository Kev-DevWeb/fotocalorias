/** fetch con tiempo límite; `signal` permite además abortarlo desde fuera. */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  return fetch(url, { ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
}
