import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración optimizada para Vercel
  // No necesita 'output: export' porque Vercel soporta SSR y API Routes
  images: {
    domains: [], // Agregar dominios si usas imágenes externas
  },
  env: {
    // Commit del build. Las rutas de la API envían el suyo en `x-app-version`;
    // si difieren, el navegador tiene una versión vieja en caché.
    NEXT_PUBLIC_APP_VERSION: (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7),
  },
};

export default nextConfig;
