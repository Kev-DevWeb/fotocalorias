import { NextRequest, NextResponse } from 'next/server';
import { analyzeWithFallback } from '@/lib/ai';

// Validación de seguridad
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function POST(request: NextRequest) {
  try {
    const { image, mimeType, portionContext } = await request.json();

    if (!image || !mimeType) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) return NextResponse.json({ error: 'Formato no soportado' }, { status: 400 });

    // Estimación rápida del tamaño a partir del base64
    const imageSize = Math.ceil((image.length * 3) / 4);
    if (imageSize > MAX_IMAGE_SIZE) return NextResponse.json({ error: 'Imagen muy grande' }, { status: 400 });

    const context = typeof portionContext === 'string' ? portionContext.slice(0, 300) : undefined;
    const result = await analyzeWithFallback({ kind: 'image', imageBase64: image, mimeType, portionContext: context });

    if (!result.ok) {
      console.error('❌ Análisis de imagen falló:', result.attempts);
      return NextResponse.json({
        error: 'El servicio de análisis no está disponible en este momento. Intenta de nuevo o escribe los detalles manualmente.',
      }, { status: 503 });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
