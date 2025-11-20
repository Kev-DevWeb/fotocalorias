# FotoCalorías 📸🥗

> Aplicación web inteligente para tracking nutricional con análisis de imágenes mediante IA

[![Next.js](https://img.shields.io/badge/Next.js-16.0.3-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)
[![Firebase](https://img.shields.io/badge/Backend-Firebase-orange)](https://firebase.google.com/)

## ✨ Características

- 📸 **Escaneo de comida con IA**: Toma foto y obtén análisis nutricional automático con Gemini AI
- 👤 **Multi-usuario**: Sistema de autenticación con email/password
- 🧮 **Calculadora personalizada**: Objetivos calóricos basados en biometría (peso, estatura, edad, sexo)
- 🎯 **Metas fitness**: Ganar músculo (+350 kcal), perder grasa (-400 kcal), o mantener peso
- 📊 **Dashboard visual**: Barras de progreso en tiempo real para calorías y macros
- 🔄 **Sincronización en tiempo real**: Firestore con listeners automáticos
- 🚀 **Rendimiento**: Deployed en Vercel con CDN global

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore + Authentication)
- **IA**: Google Gemini AI (gemini-2.0-flash-exp)
- **Hosting**: Vercel (serverless)
- **Cálculos**: Fórmulas Mifflin-St Jeor

## 🚀 Inicio Rápido

### 1. Clonar e instalar

```bash
git clone https://github.com/TU_USUARIO/fotocalorias.git
cd fotocalorias
npm install
```

### 2. Configurar variables de entorno

Crear `.env.local` en la raíz:

```env
# Firebase (obtener en console.firebase.google.com)
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_proyecto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef

# Gemini AI (obtener en aistudio.google.com/apikey)
GEMINI_API_KEY=tu_gemini_api_key
```

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## 📦 Scripts

```bash
npm run dev      # Desarrollo local
npm run build    # Build para producción
npm run start    # Servidor de producción
npm run lint     # Linter
```

## 🌐 Deploy a Vercel (100% Gratis)

1. Push a GitHub
2. Ir a [vercel.com/new](https://vercel.com/new)
3. Importar repo y configurar variables de entorno
4. Deploy automático en 2 minutos

**Guía completa**: Ver `context/PLAN_VERCEL_DEPLOYMENT.md`

## 📚 Documentación Completa

Toda la documentación está en `/context`:

- `DOCUMENTACION_PROYECTO.md` - Arquitectura completa
- `PLAN_VERCEL_DEPLOYMENT.md` - Guía de deployment
- `PLAN_GEMINI_API.md` - Integración IA
- `PLAN_CALCULADORA_CALORIAS.md` - Fórmulas
- `SETUP.md` (raíz) - Inicio rápido

## 🎯 Flujo de Usuario

1. **Registro** → Crea cuenta
2. **Perfil** → Configura biometría y objetivo
3. **Escanear** → Toma foto de comida
4. **Análisis** → IA identifica nutrientes
5. **Progreso** → Ve barras actualizarse

## 🧮 Calculadora

Usa **Mifflin-St Jeor** + factor de actividad + ajuste por objetivo:
- 💪 Ganar músculo: +350 kcal
- ⚖️ Mantener: ±0 kcal
- 🔥 Perder grasa: -400 kcal

## 🔐 Seguridad

- ✅ API Key Gemini en servidor (API Route)
- ✅ Firestore rules: cada usuario solo ve sus datos
- ✅ Firebase Auth para autenticación

## 📄 Licencia

Proyecto privado - Todos los derechos reservados

---

⭐️ **Desarrollado con Next.js + Firebase + Gemini AI**
