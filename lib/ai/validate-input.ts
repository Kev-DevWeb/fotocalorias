import { InputError } from './errors';

// Validación de lo que envía el cliente antes de gastar una llamada al modelo.

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // Vercel corta el cuerpo en 4.5 MB; 3 MB en base64 son 4 MB
const MIN_IMAGE_BYTES = 64;
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];

/**
 * Limpia texto del usuario para usarlo dentro del prompt: sin caracteres de
 * control ni delimitadores que permitan salirse del bloque de datos.
 */
export function cleanText(raw: unknown, opts: { min?: number; max: number; label?: string }): string {
  const label = opts.label ?? 'La descripción';
  if (typeof raw !== 'string') throw new InputError('INVALID_INPUT', `Falta ${label.toLowerCase()}.`);
  const text = raw
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/[<>`{}]/g, ' ')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < (opts.min ?? 0)) throw new InputError('INVALID_INPUT', `${label} es muy corta.`);
  if (text.length > opts.max) throw new InputError('INVALID_INPUT', `${label} es muy larga (máximo ${opts.max} caracteres).`);
  return text;
}

/** Tipo real de la imagen según sus primeros bytes, o null si no es un formato admitido. */
export function sniffImageType(head: Uint8Array): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (head.length >= 8 && png.every((b, i) => head[i] === b)) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  if (head.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (head.length >= 12 && ascii(4, 8) === 'ftyp' && HEIC_BRANDS.includes(ascii(8, 12))) return 'image/heic';
  return null;
}

export interface ValidImage {
  base64: string;
  /** Tipo detectado en los bytes; no se confía en el que declara el cliente */
  mimeType: string;
  bytes: number;
}

export function validateImage(raw: unknown): ValidImage {
  if (typeof raw !== 'string' || !raw) throw new InputError('INVALID_IMAGE', 'Falta la imagen.');
  // Acepta también un data URL completo
  const base64 = raw.replace(/^data:[^;,]+;base64,/, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) throw new InputError('INVALID_IMAGE');

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const bytes = (base64.length / 4) * 3 - padding;
  if (bytes > MAX_IMAGE_BYTES) throw new InputError('IMAGE_TOO_LARGE');
  if (bytes < MIN_IMAGE_BYTES) throw new InputError('INVALID_IMAGE');

  const mimeType = sniffImageType(Buffer.from(base64.slice(0, 32), 'base64'));
  if (!mimeType) throw new InputError('INVALID_IMAGE');
  return { base64, mimeType, bytes };
}
