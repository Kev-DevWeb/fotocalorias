import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Obtener origen dinámico para postMessage
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  if (error) {
    return new NextResponse(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'GOOGLE_FIT_AUTH_ERROR', error: '${error}' }, '${origin}');
            window.close();
          </script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }

  if (!code) {
    return new NextResponse('Falta el código de autorización', { status: 400 });
  }

  const clientID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    return new NextResponse('Configuración de servidor faltante para OAuth', { status: 500 });
  }

  const redirectUri = `${origin}/api/auth/google-fit/callback`;

  try {
    // Intercambiar el código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientID,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.error_description || errorData.error || 'Error al obtener tokens');
    }

    const tokens = await tokenResponse.json();

    // Calcular fecha exacta de expiración
    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    // Retornar un HTML que envíe los tokens al opener y cierre el popup
    const responseHtml = `
      <html>
        <head>
          <title>Google Fit Auth Callback</title>
        </head>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f8fafc; color: #1e293b;">
          <h2 style="color: #f97316;">Sincronizando con xCal...</h2>
          <p>Esta ventana se cerrará automáticamente.</p>
          <script>
            const authData = {
              accessToken: '${tokens.access_token}',
              refreshToken: '${tokens.refresh_token || ""}',
              expiresAt: ${expiresAt}
            };
            window.opener.postMessage({ type: 'GOOGLE_FIT_AUTH_SUCCESS', tokens: authData }, '${origin}');
            window.close();
          </script>
        </body>
      </html>
    `;

    return new NextResponse(responseHtml, { headers: { 'Content-Type': 'text/html' } });

  } catch (err: any) {
    console.error('❌ Error intercambiando código OAuth:', err);
    return new NextResponse(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'GOOGLE_FIT_AUTH_ERROR', error: '${err.message || err}' }, '${origin}');
            window.close();
          </script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }
}

export const runtime = 'nodejs';
