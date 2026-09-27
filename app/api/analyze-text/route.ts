import { NextRequest, NextResponse } from 'next/server';
import { analyzeWithFallback } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json();

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Falta la descripción del alimento' }, { status: 400 });
    }
    if (description.length < 3) {
      return NextResponse.json({ error: 'Descripción muy corta' }, { status: 400 });
    }
    if (description.length > 500) {
      return NextResponse.json({ error: 'Descripción muy larga (máximo 500 caracteres)' }, { status: 400 });
    }

    const result = await analyzeWithFallback({ kind: 'text', description });

    if (!result.ok) {
      console.error('❌ Análisis de texto falló:', result.attempts);
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
