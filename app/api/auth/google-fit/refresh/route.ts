import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json({ error: 'Falta el refresh token' }, { status: 400 });
    }

    const clientID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientID || !clientSecret) {
      return NextResponse.json({ error: 'Configuración de servidor faltante para OAuth' }, { status: 500 });
    }

    // Petición a Google OAuth 2.0 para refrescar el token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientID,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.error_description || errorData.error || 'Error al refrescar token');
    }

    const data = await tokenResponse.json();

    // Calcular la fecha exacta de expiración
    const expiresAt = Date.now() + (data.expires_in * 1000);

    return NextResponse.json({
      accessToken: data.access_token,
      // Si Google no retorna un nuevo refresh token, conservamos el actual
      refreshToken: data.refresh_token || refreshToken,
      expiresAt,
    });

  } catch (err: any) {
    console.error('❌ Error al refrescar token de Google Fit:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor al refrescar token' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
