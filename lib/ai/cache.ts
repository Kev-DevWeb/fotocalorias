// Caché en memoria con caducidad. Vive en cada instancia del servidor: es un
// atajo para que la misma descripción devuelva los mismos números, no una garantía.

export class TtlCache<V> {
  private entries = new Map<string, { value: V; expires: number }>();

  constructor(private maxEntries: number, private ttlMs: number) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Reinsertar lo deja como el más reciente
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

/** "1 Taza de  Café" y "1 taza de cafe" son la misma descripción. */
export function textCacheKey(description: string): string {
  return description.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
