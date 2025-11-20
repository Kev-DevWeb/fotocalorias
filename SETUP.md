# 🚀 FotoCalorías - Guía de Inicio Rápido

## ✅ Archivos Creados

He modernizado completamente la aplicación FotoCalorías con las siguientes mejoras:

### 📁 Nueva Estructura de Archivos

```
fotocalorias/
├── lib/
│   └── calorie-calculator.ts         # ✅ Calculadora de calorías y macros
├── app/
│   ├── components/
│   │   ├── AuthForm.tsx               # ✅ Login y registro
│   │   ├── ProfileSetup.tsx           # ✅ Configuración de perfil biométrico
│   │   └── ProgressDashboard.tsx      # ✅ Dashboard con progreso visual
│   ├── api/
│   │   └── analyze-food/
│   │       └── route.ts               # ✅ API segura para Gemini AI
│   └── page.tsx                       # ✅ Página principal (reescrita)
├── context/
│   ├── DOCUMENTACION_PROYECTO.md      # 📚 Documentación completa
│   ├── PLAN_VERCEL_DEPLOYMENT.md      # 📚 Guía de deployment en Vercel
│   ├── PLAN_GEMINI_API.md             # 📚 Guía de integración IA
│   └── PLAN_CALCULADORA_CALORIAS.md   # 📚 Fórmulas nutricionales
├── .env.local                         # ⚙️ Variables de entorno (configura!)
├── vercel.json                        # ✅ Configuración Vercel
└── next.config.ts                     # ✅ Optimizado para Vercel
```

---

## 🎯 Características Implementadas

### ✅ Sistema Multi-Usuario
- **Autenticación real** con Firebase Auth (Email/Password)
- Cada usuario tiene su **propio perfil y datos**
- Login y registro funcional
- Sesión persistente

### ✅ Calculadora de Calorías Personalizada
- Basada en **peso, estatura, edad y sexo**
- Considera **nivel de actividad física**
- Ajuste automático según **objetivo**:
  - 🔥 Perder grasa (déficit calórico -400 kcal)
  - ⚖️ Mantener peso (mantenimiento)
  - 💪 Ganar músculo (superávit +350 kcal)
- Usa fórmulas científicas (Mifflin-St Jeor)

### ✅ Dashboard con Progreso Visual
- **Barras de progreso** para:
  - Calorías totales
  - Proteínas
  - Carbohidratos
  - Grasas
- Muestra **consumido vs. objetivo**
- Indicadores visuales al alcanzar metas
- Porcentajes en tiempo real

### ✅ Análisis con IA (Gemini)
- API route segura (API Key en servidor)
- Análisis nutricional automático
- Detección de alimentos
- Estimación de porciones

---

## ⚙️ Configuración Necesaria

### Paso 1: Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto "fotocalorias"
3. Habilita **Firestore Database**
4. Habilita **Authentication** → Email/Password
5. En Project Settings, copia las credenciales de tu app web

### Paso 2: Configurar Gemini AI

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crea una API Key
3. Cópiala

### Paso 3: Editar `.env.local`

Abre el archivo `.env.local` y reemplaza los valores:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=fotocalorias-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=fotocalorias-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=fotocalorias-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Gemini AI
GEMINI_API_KEY=AIzaSy...
```

### Paso 4: Instalar Dependencias

```bash
npm install
```

### Paso 5: Ejecutar en Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 🎬 Flujo de Usuario

### Primera Vez

1. **Registro**: El usuario crea cuenta con email/password
2. **Configuración**: Completa perfil biométrico (peso, estatura, edad, etc.)
3. **Cálculo automático**: El sistema calcula objetivos personalizados
4. **Dashboard**: Ve sus metas diarias de calorías y macros

### Uso Diario

1. **Escanear comida**: Toma foto con el botón flotante
2. **Análisis IA**: Gemini identifica alimentos y calcula nutrientes
3. **Confirmar**: Revisa y guarda el registro
4. **Progreso**: Ve barras actualizarse en tiempo real
5. **Historial**: Consulta comidas del día

---

## 🔧 Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Linting
npm run lint

# Instalar dependencia adicional
npm install <package>
```

---

## 📊 Estructura de Datos en Firestore

### Colección: `users`

```typescript
{
  uid: "abc123",
  email: "user@email.com",
  displayName: "Usuario",
  profile: {
    weight: 75,
    height: 175,
    age: 30,
    gender: "male",
    activityLevel: "moderate",
    goal: "lose_fat"
  },
  targets: {
    calories: 2233,
    protein: 180,
    carbs: 250,
    fat: 57
  }
}
```

### Subcolección: `users/{userId}/calorie_logs`

```typescript
{
  food_name: "Pechuga con arroz",
  calories: 450,
  protein: 45,
  carbs: 48,
  fat: 8,
  confidence: "Alta",
  imagePreview: "data:image/jpeg;base64,...",
  createdAt: Timestamp
}
```

---

## 🐛 Troubleshooting

### Error: "Firebase config not found"
- Verifica que `.env.local` existe
- Verifica que las variables empiezan con `NEXT_PUBLIC_`
- Reinicia el servidor (`npm run dev`)

### Error: "Gemini API key not valid"
- Verifica la key en Google AI Studio
- Verifica que `GEMINI_API_KEY` esté en `.env.local`
- La key NO debe tener `NEXT_PUBLIC_` (es server-side)

### Error: "Authentication not enabled"
- Ve a Firebase Console → Authentication
- Habilita Email/Password

### No aparecen los logs
- Verifica reglas de Firestore (ver `context/PLAN_FIREBASE_HOSTING.md`)
- Verifica que el usuario esté autenticado

---

## 📚 Documentación Adicional

Revisa la carpeta `context/` para guías detalladas:

- **DOCUMENTACION_PROYECTO.md**: Arquitectura completa
- **PLAN_VERCEL_DEPLOYMENT.md**: Deploy a Vercel (GRATIS)
- **PLAN_GEMINI_API.md**: Configuración avanzada de IA
- **PLAN_CALCULADORA_CALORIAS.md**: Fórmulas y ejemplos

---

## 🚀 Próximos Pasos

### Desarrollo Local

1. [ ] Configurar `.env.local` con tus credenciales
2. [ ] Ejecutar `npm run dev`
3. [ ] Probar registro y login
4. [ ] Configurar perfil con tus datos
5. [ ] Escanear primera comida

### Deploy a Producción (Vercel)

1. [ ] Crear cuenta en [vercel.com](https://vercel.com/signup) (GRATIS)
2. [ ] Pushear código a GitHub
3. [ ] Importar proyecto en Vercel
4. [ ] Configurar variables de entorno en Vercel Dashboard
5. [ ] Deploy automático en 2 minutos
6. [ ] Agregar dominio `.vercel.app` a Firebase Authorized Domains

**📖 Guía completa**: `context/PLAN_VERCEL_DEPLOYMENT.md`

---

## 💡 Tips

- **Perfil**: Puedes editarlo desde el ícono ⚙️ en el header
- **Objetivos**: Se recalculan automáticamente al cambiar el perfil
- **Progreso**: Las barras se actualizan en tiempo real
- **Historial**: Solo muestra comidas del día actual
- **Fotos**: Se comprimen automáticamente (máx 10MB)

---

## 🎨 Personalización

### Cambiar colores principales

Edita `app/globals.css` o busca `orange-500` en los componentes y reemplaza por tu color preferido.

### Ajustar objetivos calóricos

Edita `lib/calorie-calculator.ts`:
- Línea 64: Superávit para ganar músculo (default: +350)
- Línea 66: Déficit para perder grasa (default: -400)

### Modificar ratios de macros

Edita `lib/calorie-calculator.ts` función `calculateMacros`:
- Proteína por kg
- Porcentaje de grasas
- Carbohidratos (resto)

---

**¡Listo para empezar! 🎉**

Si tienes dudas, revisa la documentación en `/context/` o los comentarios en el código.
