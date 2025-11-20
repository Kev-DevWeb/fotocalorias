import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración optimizada para Vercel
  // No necesita 'output: export' porque Vercel soporta SSR y API Routes
  images: {
    domains: [], // Agregar dominios si usas imágenes externas
  },
};

export default nextConfig;
