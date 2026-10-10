// Límite de peticiones por ventana deslizante.
//
// La implementación guarda los contadores en memoria: vive en cada instancia del
// servidor y se reinicia con cada despliegue o arranque en frío. Es un freno
// suficiente para una app personal, no una garantía. Si hiciera falta un límite
// estricto, basta con otra clase que implemente `RateLimiter` sobre un almacén
// externo (por ejemplo Upstash Redis); las rutas no cambian.

export interface RateRule {
  name: string;
  limit: number;
  windowMs: number;
}

export interface RateDecision {
  allowed: boolean;
  /** Regla que se excedió */
  rule?: RateRule;
  retryAfterSec?: number;
}

export interface RateLimiter {
  /** Registra una petición si cabe en todas las reglas; si no, la rechaza sin registrarla. */
  hit(key: string, rules: RateRule[]): RateDecision;
}

export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private maxKeys = 5000, private now: () => number = Date.now) {}

  hit(key: string, rules: RateRule[]): RateDecision {
    const now = this.now();
    const longest = Math.max(...rules.map((r) => r.windowMs));
    const stamps = (this.hits.get(key) ?? []).filter((t) => t > now - longest);

    for (const rule of rules) {
      const inWindow = stamps.filter((t) => t > now - rule.windowMs);
      if (inWindow.length >= rule.limit) {
        this.hits.set(key, stamps);
        const retryAfterSec = Math.max(1, Math.ceil((inWindow[0] + rule.windowMs - now) / 1000));
        return { allowed: false, rule, retryAfterSec };
      }
    }

    stamps.push(now);
    // Reinsertar deja la clave como la más reciente; al llenarse se descarta la más antigua
    this.hits.delete(key);
    this.hits.set(key, stamps);
    if (this.hits.size > this.maxKeys) this.hits.delete(this.hits.keys().next().value as string);
    return { allowed: true };
  }
}
