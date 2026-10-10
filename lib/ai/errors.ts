// Errores que la API devuelve al cliente: código estable, estado HTTP y mensaje para mostrar.

export type ErrorCode =
  | 'NO_FOOD'
  | 'INVALID_INPUT'
  | 'INVALID_IMAGE'
  | 'IMAGE_TOO_LARGE'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'GUEST_LIMIT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'NOT_CONFIGURED'
  | 'INTERNAL';

interface ErrorSpec {
  status: number;
  message: string;
  retryable: boolean;
}

export const ERRORS: Record<ErrorCode, ErrorSpec> = {
  NO_FOOD: { status: 422, message: 'No se detectó comida. Intenta con otra foto o describe el alimento con más detalle.', retryable: false },
  INVALID_INPUT: { status: 400, message: 'Los datos enviados no son válidos.', retryable: false },
  INVALID_IMAGE: { status: 400, message: 'La imagen no es válida. Usa una foto JPG, PNG o WebP.', retryable: false },
  IMAGE_TOO_LARGE: { status: 413, message: 'La imagen es demasiado pesada (máximo 3 MB).', retryable: false },
  UNAUTHORIZED: { status: 401, message: 'Tu sesión expiró. Inicia sesión de nuevo.', retryable: false },
  RATE_LIMITED: { status: 429, message: 'Hiciste muchos análisis seguidos. Espera un momento e intenta de nuevo.', retryable: false },
  GUEST_LIMIT: { status: 429, message: 'Llegaste al límite de análisis del modo invitado por hoy. Inicia sesión o crea una cuenta para seguir.', retryable: false },
  UPSTREAM_UNAVAILABLE: { status: 503, message: 'El servicio de análisis no está disponible en este momento. Intenta de nuevo en unos segundos.', retryable: true },
  NOT_CONFIGURED: { status: 500, message: 'El servidor no tiene proveedores de IA configurados.', retryable: false },
  INTERNAL: { status: 500, message: 'Error interno del servidor.', retryable: true },
};

export interface ErrorBody {
  error: string;
  code: ErrorCode;
  retryable: boolean;
}

export function errorBody(code: ErrorCode, message?: string): ErrorBody {
  return { error: message || ERRORS[code].message, code, retryable: ERRORS[code].retryable };
}

/** Error de validación de entrada: el cliente envió algo que no se puede analizar. */
export class InputError extends Error {
  constructor(public code: Extract<ErrorCode, 'INVALID_INPUT' | 'INVALID_IMAGE' | 'IMAGE_TOO_LARGE'>, message?: string) {
    super(message || ERRORS[code].message);
    this.name = 'InputError';
  }
}
