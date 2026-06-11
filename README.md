# FotoCalorías 📸🥗
> Aplicación web para tracking nutricional con análisis de imágenes mediante IA

[![Next.js](https://img.shields.io/badge/Next.js-16.0.3-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)
[![Firebase](https://img.shields.io/badge/Backend-Firebase-orange)](https://firebase.google.com/)

## ✨ Características

- 📸 **Escaneo con IA**: Toma una foto y obtén análisis nutricional automático con Gemini AI
- 👋 **Modo Invitado**: Prueba sin registro (análisis sin guardar datos)
- 👤 **Multi-usuario**: Autenticación con email y contraseña
- 🧮 **Calculadora personalizada**: Objetivos calóricos basados en peso, estatura, edad y sexo
- 🎯 **Metas fitness**: Ganar músculo (+350 kcal), perder grasa (-400 kcal) o mantener peso
- 📊 **Dashboard visual**: Barras de progreso en tiempo real para calorías y macros
- 🔄 **Sincronización en tiempo real**: Firestore con listeners automáticos

##  Pruebalo en:

https://xcal-fawn.vercel.app/

## 🛠️ Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore + Authentication)
- **IA**: Google Gemini AI (`gemini-2.0-flash-exp`)
- **Hosting**: Vercel (serverless)
- **Cálculos**: Fórmula Mifflin-St Jeor

## 🚀 Instalación

```bash
git clone https://github.com/TU_USUARIO/fotocalorias.git
cd fotocalorias
npm install
```

Crea un archivo `.env.local` en la raíz con tus credenciales:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
GEMINI_API_KEY=
```

> Obtén las claves de Firebase en [console.firebase.google.com](https://console.firebase.google.com)
> y la de Gemini en [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

```bash
npm run dev  # http://localhost:3000
```

## 🔐 Seguridad

- API Key de Gemini expuesta solo en el servidor (API Route)
- Firestore Rules: cada usuario accede únicamente a sus propios datos
- Autenticación gestionada con Firebase Auth

## 📄 Licencia

Proyecto privado — Todos los derechos reservados
