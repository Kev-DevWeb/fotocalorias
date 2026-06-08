import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  
  if (!clientID) {
    return NextResponse.json(
      { error: 'Configuración faltante: NEXT_PUBLIC_GOOGLE_CLIENT_ID no está definido en las variables de entorno.' },
      { status: 500 }
    );
  }

  // Obtener redirect_uri base dinámica (en base al host)
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/auth/google-fit/callback`;

  // Scopes requeridos para leer actividad (calorías quemadas)
  const scopes = [
    'https://www.googleapis.com/auth/fitness.activity.read'
  ].join(' ');

  // URL del consentimiento OAuth 2.0 de Google
  const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
    `client_id=${clientID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&access_type=offline` + 
    `&prompt=consent`;

  return NextResponse.redirect(oauthUrl);
}

export const runtime = 'nodejs';
