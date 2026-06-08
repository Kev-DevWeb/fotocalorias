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
      return NextResponse.json({ error: 'Configuración de OAuth incompleta en el servidor' }, { status: 500 });
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientID,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error_description || errorData.error || 'Error al refrescar token');
    }

    const data = await response.json();
    const expiresAt = Date.now() + (data.expires_in * 1000);

    return NextResponse.json({
      accessToken: data.access_token,
      expiresAt: expiresAt
    });

  } catch (err: any) {
    console.error('❌ Error al refrescar token Google Fit:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
