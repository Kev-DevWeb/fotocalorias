# FotoCalorías - Documentación del Proyecto

## 📋 Resumen Ejecutivo

**FotoCalorías** es una aplicación web progresiva (PWA) construida con Next.js que permite a múltiples usuarios fotografiar sus comidas y obtener un análisis automático de contenido nutricional mediante inteligencia artificial (Gemini AI). La app calcula objetivos calóricos personalizados basados en el peso, estatura y meta fitness de cada usuario (ganar músculo, perder grasa o mantener peso), registrando el progreso diario de calorías y macronutrientes, y mostrando cuánto falta para alcanzar las metas diarias. Toda la información se almacena en Firebase Firestore.

---

## 🏗️ Arquitectura del Proyecto

### Stack Tecnológico

- **Framework**: Next.js 16.0.3 (App Router)
- **Lenguaje**: TypeScript 5.x
- **UI/Styling**: Tailwind CSS 4.x
- **Hosting**: Vercel (Deployment automático)
- **Base de Datos**: Firebase Firestore
- **Autenticación**: Firebase Auth (Email/Password)
- **IA**: Google Gemini AI (gemini-2.0-flash-exp)
- **Iconos**: Lucide React
- **Runtime**: React 19.2.0

### Estructura de Archivos

```
fotocalorias/
├── app/
│   ├── components/
│   │   ├── AuthForm.tsx            # Formulario de login/registro
│   │   ├── ProfileSetup.tsx        # Configuración de perfil biométrico
│   │   └── ProgressDashboard.tsx   # Dashboard con barras de progreso
│   ├── api/
│   │   └── analyze-food/
│   │       └── route.ts            # API Route serverless para Gemini AI
│   ├── globals.css                 # Estilos globales Tailwind
│   ├── layout.tsx                  # Layout raíz con metadata
│   └── page.tsx                    # Página principal multi-usuario
├── lib/
│   └── calorie-calculator.ts       # Lógica de cálculo de calorías
├── public/                         # Recursos estáticos
├── context/                        # 📁 Documentación del proyecto
│   ├── DOCUMENTACION_PROYECTO.md
│   ├── PLAN_VERCEL_DEPLOYMENT.md   # ✅ Guía de deployment en Vercel
│   ├── PLAN_GEMINI_API.md
│   └── PLAN_CALCULADORA_CALORIAS.md
├── .env.local                      # Variables de entorno (no en Git)
├── vercel.json                     # Configuración Vercel
├── eslint.config.mjs               # Configuración ESLint
├── next.config.ts                  # Configuración Next.js (optimizado Vercel)
├── package.json                    # Dependencias y scripts
├── tsconfig.json                   # Configuración TypeScript
└── SETUP.md                        # Guía de inicio rápido
```

---

## 🎯 Funcionalidades Principales

### 1. **Autenticación**
- Sistema de login con email/password
- **Modo Invitado**: Prueba la app sin registro (solo análisis, no guarda datos)
- Gestión de sesión persistente
- Botón "Probar como Invitado" en pantalla de login

### 2. **Gestión de Usuarios y Perfiles**
- Sistema multi-usuario con autenticación individual
- Cada usuario tiene su propio perfil personalizado
- Configuración de perfil con datos biométricos:
  - Peso corporal (kg)
  - Estatura (cm)
  - Edad y sexo
  - Objetivo fitness (ganar músculo / perder grasa / mantenerse)
- Cálculo automático de requerimientos calóricos y macronutrientes
- Datos completamente segregados por usuario

### 3. **Captura y Análisis de Imágenes**
- Captura desde cámara del dispositivo
- Vista previa inmediata
- Análisis automático con Gemini AI
- Detección de alimentos y estimación nutricional

### 4. **Registro Nutricional**
- Registro de:
  - Nombre del alimento
  - Calorías (kcal)
  - Proteínas (g)
  - Carbohidratos (g)
  - Grasas (g)
  - Imagen de la comida
  - Timestamp
  - Perfil de usuario
- Almacenamiento en Firebase Firestore

### 5. **Dashboard Diario con Objetivos**
- Resumen de calorías y macronutrientes del día
- **Visualización de progreso**: Muestra consumido vs. objetivo recomendado
- Barras de progreso para:
  - Calorías totales
  - Proteínas
  - Carbohidratos
  - Grasas
- Lista de comidas registradas
- Filtrado por usuario y fecha
- Totales acumulados en tiempo real
- Indicadores visuales cuando se alcanzan las metas diarias

### 6. **Gestión de Registros**
- Eliminación de registros individuales
- Actualización en tiempo real (listeners de Firestore)

---

## 🔧 Detalles Técnicos

### Flujo de Datos

```
Usuario → Captura Foto → Conversión Base64 
→ Gemini API (Análisis) → Resultado JSON 
→ Confirmación Usuario → Firestore (Guardado) 
→ Actualización UI (Real-time)
```

### Estructura de Datos en Firestore

**Colección de Usuarios**: `users`

**Documento de Usuario**:
```typescript
{
  uid: string,                    // Firebase Auth UID
  email: string,                  // Email del usuario
  displayName: string,            // Nombre para mostrar
  profile: {
    weight: number,               // Peso en kg
    height: number,               // Estatura en cm
    age: number,                  // Edad en años
    gender: "male" | "female",    // Sexo
    activityLevel: string,        // "sedentary" | "light" | "moderate" | "active" | "very_active"
    goal: string,                 // "gain_muscle" | "lose_fat" | "maintain"
  },
  targets: {
    calories: number,             // Calorías objetivo diarias (calculadas)
    protein: number,              // Proteína objetivo en gramos
    carbs: number,                // Carbohidratos objetivo en gramos
    fat: number,                  // Grasas objetivo en gramos
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Colección de Logs**: `users/{userId}/calorie_logs`

**Documento de Log**:
```typescript
{
  food_name: string,           // "Pechuga con arroz"
  calories: number,            // 450
  protein: number,             // 35
  carbs: number,               // 45
  fat: number,                 // 12
  confidence: string,          // "Alta" | "Media" | "Baja"
  createdAt: Timestamp,        // Server timestamp
  imagePreview: string         // Base64 data URL
}
```

### API Gemini - Prompt Engineering

El sistema utiliza un prompt estructurado que:
1. Establece el rol de nutricionista experto
2. Define el formato exacto de respuesta (JSON)
3. Especifica los campos requeridos
4. Maneja casos de error (no comida detectada)

**Modelos utilizados**: `gemini-2.5-pro` con fallback a `gemini-2.5-flash`

---

## 🎨 Diseño de Interfaz

### Componentes Personalizados

1. **Card**: Contenedor con sombra y bordes redondeados
2. **Button**: Botón con variantes (primary, secondary, danger, outline)
3. **MacroPill**: Píldora para mostrar macronutrientes

### Paleta de Colores

- **Principal**: Naranja (#f97316 - orange-500)
- **Fondo**: Gris claro (#f8fafc - slate-50)
- **Texto**: Gris oscuro (#0f172a - slate-900)
- **Acentos**: 
  - Proteínas: Azul
  - Carbohidratos: Verde
  - Grasas: Amarillo

### Características UX

- Animaciones suaves con Tailwind
- Modal para análisis de imágenes
- Botón flotante para captura rápida
- Diseño mobile-first
- Feedback visual inmediato
- Estados de carga claros

---

## 🔐 Configuración Requerida

### Firebase (Actualmente sin configurar)

```javascript
// Reemplazar en page.tsx:
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

### Gemini AI (Actualmente sin configurar)

```javascript
// Reemplazar en page.tsx:
const GEMINI_API_KEY = "TU_GEMINI_API_KEY_AQUI";
```

---

## 📦 Scripts Disponibles

```bash
# Desarrollo local
npm run dev          # Inicia servidor en http://localhost:3000

# Producción
npm run build        # Construye la aplicación optimizada
npm start            # Inicia servidor de producción

# Linting
npm run lint         # Ejecuta ESLint
```

---

## 🚀 Estado Actual

### ✅ Implementado
- ✅ Sistema multi-usuario con autenticación Email/Password
- ✅ **Modo Invitado** para probar sin registro
- ✅ Formulario de login y registro (AuthForm)
- ✅ Configuración de perfil biométrico completo (ProfileSetup)
- ✅ Calculadora de calorías con fórmulas científicas (Mifflin-St Jeor)
- ✅ Dashboard con barras de progreso visual (ProgressDashboard)
- ✅ API Route serverless segura para Gemini AI
- ✅ Captura y análisis de imágenes
- ✅ Almacenamiento segregado por usuario en Firestore
- ✅ Filtrado por fecha y usuario
- ✅ Actualización en tiempo real
- ✅ Footer global con créditos a DevVisual Studio
- ✅ Proyecto configurado para Vercel

### ⚠️ Pendiente de Configuración
- Configurar variables de entorno en Vercel Dashboard
- Configurar credenciales de Firebase
- Configurar API Key de Gemini AI
- Agregar dominio de Vercel a Firebase Authorized Domains
- Primer deployment a Vercel

### 🔮 Mejoras Futuras (Ver planes)
- Variables de entorno para secretos
- Service Worker para PWA offline
- Historial semanal/mensual con gráficas de progreso
- Seguimiento de peso corporal en el tiempo
- Recalcular objetivos al actualizar perfil
- Sugerencias de comidas basadas en macros faltantes
- Exportación de datos
- Notificaciones push para recordar registrar comidas
- Modo oscuro
- Internacionalización
- Integración con wearables/báscula inteligente

---

## 🐛 Problemas Conocidos

1. **Configuración hardcoded**: Las credenciales están en el código fuente
2. **Sin validación de imágenes**: No se valida tamaño/formato antes de enviar
3. **Sin manejo de errores robusto**: Faltan try-catch en algunos lugares
4. **Sin límites de datos**: No hay paginación en la lista de comidas
5. **Sin sistema de autenticación real**: Actualmente usa login anónimo
6. **Sin calculadora de calorías**: Los objetivos no se calculan automáticamente
7. **Sin onboarding**: No hay flujo de configuración inicial del perfil

---

## 📚 Referencias

- [Next.js Docs](https://nextjs.org/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [Gemini AI Docs](https://ai.google.dev/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev)

---

## 👥 Sistema de Usuarios

- **Multi-usuario**: Soporte para número ilimitado de usuarios
- **Autenticación**: Firebase Authentication con email/password
- **Perfiles independientes**: Cada usuario tiene su configuración y datos separados
- **Objetivos personalizados**: Calculados según biometría y metas individuales

---

## 📄 Licencia

Proyecto privado - Todos los derechos reservados

---

**Última actualización**: 19 de noviembre de 2025
