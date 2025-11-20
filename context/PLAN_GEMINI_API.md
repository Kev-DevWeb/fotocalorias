# 🤖 Plan de Implementación: Gemini AI API

## Objetivo
Integrar Google Gemini AI para analizar imágenes de comida y devolver información nutricional estimada (calorías, proteínas, carbohidratos, grasas). El sistema es compatible con múltiples usuarios, cada uno con sus propios objetivos calóricos personalizados.

---

## 🎯 Arquitectura Actual vs. Recomendada

### ❌ Implementación Actual (Insegura para Producción)
```
Cliente (Browser) → Gemini API (directo con API Key)
```

**Problemas:**
- API Key expuesta en el navegador
- Cualquiera puede extraer la key y usarla
- Sin control de rate limiting
- Sin posibilidad de caché de respuestas
- Errores CORS en producción

### ✅ Implementación Recomendada (Segura)
```
Cliente → API Route (Next.js) → Gemini API
```

**Ventajas:**
- API Key segura en el servidor
- Control de rate limiting
- Caché de respuestas
- Validación de imágenes
- Logs y monitoreo
- Sin problemas CORS

---

## 📋 Prerequisitos

### 1. Obtener API Key de Gemini

1. Visitar [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Iniciar sesión con cuenta Google
3. Click en **"Get API Key"** → **"Create API Key"**
4. Copiar la API Key (formato: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`)

### 2. Configurar Variables de Entorno

Agregar a `.env.local`:
```env
# ... otras variables de Firebase ...

# Gemini AI
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

⚠️ **IMPORTANTE**: Esta variable **NO** tiene prefijo `NEXT_PUBLIC_` porque debe mantenerse en el servidor.

---

## 🏗️ Pasos de Implementación

### Fase 1: Crear API Route en Next.js

#### 1.1 Crear estructura de carpetas
```bash
mkdir app/api
mkdir app/api/analyze-food
```

#### 1.2 Crear endpoint de análisis

Crear `app/api/analyze-food/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';

// Configuración del modelo
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash-exp';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Validación de seguridad
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    // Validar API Key
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Configuración de servidor incompleta' },
        { status: 500 }
      );
    }

    // Obtener imagen del body
    const { image, mimeType } = await request.json();

    // Validaciones
    if (!image || !mimeType) {
      return NextResponse.json(
        { error: 'Faltan parámetros: image y mimeType requeridos' },
        { status: 400 }
      );
    }

    // Validar tipo MIME
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `Tipo de imagen no soportado. Usar: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validar tamaño (base64 aproximado)
    const imageSize = Buffer.from(image, 'base64').length;
    if (imageSize > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Imagen demasiado grande. Máximo 10MB' },
        { status: 400 }
      );
    }

    // Prompt mejorado para Gemini
    const prompt = `
Eres un nutricionista experto certificado. Analiza esta imagen de comida con precisión.

TAREAS:
1. Identifica TODOS los alimentos visibles
2. Estima las porciones de cada uno
3. Calcula el contenido nutricional TOTAL del plato

REGLAS:
- Si no hay comida clara, devuelve {"error": "No se detectó comida en la imagen"}
- Sé conservador en las estimaciones (mejor subestimar que sobrestimar)
- Si hay múltiples platos, suma todos los valores
- Considera condimentos, aceites y salsas visibles

RESPUESTA:
Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown, sin bloques de código):

{
  "food_name": "Descripción breve del plato completo",
  "calories": número entero (kcal totales),
  "protein": número entero (gramos totales),
  "carbs": número entero (gramos totales),
  "fat": número entero (gramos totales),
  "confidence": "Alta" | "Media" | "Baja",
  "detected_items": ["item1", "item2"],
  "portion_note": "Descripción breve del tamaño de porción estimado"
}

EJEMPLO:
{
  "food_name": "Pechuga de pollo a la plancha con arroz y ensalada",
  "calories": 450,
  "protein": 45,
  "carbs": 48,
  "fat": 8,
  "confidence": "Alta",
  "detected_items": ["pechuga de pollo", "arroz blanco", "lechuga", "tomate"],
  "portion_note": "Porción mediana (~250g plato completo)"
}
`;

    // Llamar a Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,  // Más determinístico para análisis nutricional
          topK: 32,
          topP: 1,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API Error:', errorData);
      
      return NextResponse.json(
        { error: 'Error al analizar la imagen. Intenta de nuevo.' },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Extraer texto de la respuesta
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return NextResponse.json(
        { error: 'Respuesta vacía de Gemini' },
        { status: 500 }
      );
    }

    // Limpiar y parsear JSON
    const cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let nutritionData;
    try {
      nutritionData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('JSON Parse Error:', cleanText);
      return NextResponse.json(
        { error: 'Respuesta inválida del modelo de IA' },
        { status: 500 }
      );
    }

    // Validar estructura de respuesta
    if (nutritionData.error) {
      return NextResponse.json(nutritionData, { status: 200 });
    }

    const requiredFields = ['food_name', 'calories', 'protein', 'carbs', 'fat'];
    const hasAllFields = requiredFields.every(field => 
      nutritionData.hasOwnProperty(field) && 
      (typeof nutritionData[field] === 'string' || typeof nutritionData[field] === 'number')
    );

    if (!hasAllFields) {
      return NextResponse.json(
        { error: 'Datos incompletos del análisis' },
        { status: 500 }
      );
    }

    // Devolver resultado exitoso
    return NextResponse.json(nutritionData, { status: 200 });

  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Configuración de ruta
export const runtime = 'edge'; // Opcional: usar Edge Runtime para mejor performance
export const maxDuration = 30; // Timeout de 30 segundos
```

---

### Fase 2: Actualizar Cliente (Frontend)

#### 2.1 Modificar función de análisis

En `app/page.tsx`, reemplazar la función `analyzeImageWithGemini`:

```typescript
// ELIMINAR función antigua que llama directamente a Gemini
// AGREGAR nueva función que llama a nuestra API Route:

async function analyzeImageWithGemini(base64Image: string, mimeType: string = 'image/jpeg') {
  try {
    const response = await fetch('/api/analyze-food', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        mimeType: mimeType
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al analizar la imagen');
    }

    const result = await response.json();
    
    if (result.error) {
      return null;
    }

    return result;

  } catch (error) {
    console.error("Error analizando imagen:", error);
    return null;
  }
}
```

#### 2.2 Actualizar llamada en handleFileSelect

```typescript
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    // Validar tipo de archivo
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Por favor selecciona una imagen JPG, PNG o WebP');
      return;
    }

    // Validar tamaño (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Máximo 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPreviewImage(base64String);
      
      // Extraer solo la parte base64 (sin el prefijo data:image/...)
      const base64Data = base64String.split(',')[1];
      analyzeImage(base64Data, file.type);
    };
    reader.readAsDataURL(file);
  }
};

const analyzeImage = async (base64: string, mimeType: string) => {
  setIsAnalyzing(true);
  setAnalysisResult(null);
  
  const result = await analyzeImageWithGemini(base64, mimeType);
  
  if (result && !result.error) {
    setAnalysisResult(result);
  } else {
    alert("No pudimos identificar comida. Intenta una foto más clara.");
    setPreviewImage(null);
  }
  
  setIsAnalyzing(false);
};
```

#### 2.3 Actualizar TypeScript types

Agregar al inicio de `page.tsx`:

```typescript
interface NutritionData {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence?: string;
  detected_items?: string[];
  portion_note?: string;
  error?: string;
}
```

---

### Fase 3: Mejoras Opcionales

#### 3.1 Rate Limiting (Prevenir abuso)

Instalar dependencia:
```bash
npm install @upstash/ratelimit @upstash/redis
```

Actualizar `app/api/analyze-food/route.ts`:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Configurar rate limit (10 requests por hora por IP)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
});

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.ip ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta más tarde.' },
      { status: 429 }
    );
  }

  // ... resto del código
}
```

#### 3.2 Caché de Respuestas

Implementar caché simple en memoria:

```typescript
// Cache simple (considerar Redis para producción)
const analysisCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hora

export async function POST(request: NextRequest) {
  const { image, mimeType } = await request.json();
  
  // Generar hash de la imagen para cache key
  const imageHash = Buffer.from(image).toString('base64').slice(0, 32);
  
  // Buscar en caché
  const cached = analysisCache.get(imageHash);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }
  
  // ... análisis con Gemini ...
  
  // Guardar en caché
  analysisCache.set(imageHash, {
    data: nutritionData,
    timestamp: Date.now()
  });
  
  return NextResponse.json(nutritionData);
}
```

#### 3.3 Logging y Monitoreo

Agregar logs estructurados:

```typescript
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // ... código existente ...
    
    // Log exitoso
    console.log(JSON.stringify({
      type: 'gemini_analysis',
      status: 'success',
      duration: Date.now() - startTime,
      food: nutritionData.food_name,
      confidence: nutritionData.confidence
    }));
    
    return NextResponse.json(nutritionData);
    
  } catch (error) {
    // Log de error
    console.error(JSON.stringify({
      type: 'gemini_analysis',
      status: 'error',
      duration: Date.now() - startTime,
      error: error.message
    }));
    
    throw error;
  }
}
```

---

## 🧪 Testing

### Test Manual (Development)

1. Iniciar servidor de desarrollo:
```bash
npm run dev
```

2. Probar endpoint directamente con curl:
```bash
curl -X POST http://localhost:3000/api/analyze-food \
  -H "Content-Type: application/json" \
  -d '{
    "image": "BASE64_STRING_AQUI",
    "mimeType": "image/jpeg"
  }'
```

3. Probar desde la UI:
- Abrir app en navegador
- Capturar/seleccionar foto de comida
- Verificar respuesta en Network Tab (DevTools)

### Test de Producción

Después de deploy a Firebase:
```bash
curl -X POST https://fotocalorias-xxxxx.web.app/api/analyze-food \
  -H "Content-Type: application/json" \
  -d '{"image": "...", "mimeType": "image/jpeg"}'
```

---

## 💰 Costos y Límites

### Gemini API (Gratis hasta límite)

**Gemini 2.0 Flash:**
- **Input**: 1M tokens/día gratis
- **Output**: 1M tokens/día gratis
- **Imágenes**: ~258 tokens por imagen

**Estimación para FotoCalorías:**
- ~20 análisis de imagen/día por usuario
- 2 usuarios = 40 análisis/día
- ~10,320 tokens/día de input
- **Muy por debajo del límite gratuito**

### Cuándo Pagar
Si superan 1M tokens/día:
- $0.075 por 1M tokens input
- $0.30 por 1M tokens output

Para 2 usuarios: **Debería permanecer en tier gratuito indefinidamente**

---

## 📊 Mejores Prácticas

### 1. Optimización de Imágenes
```typescript
// Comprimir imagen antes de enviar
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
```

### 2. Manejo de Errores Robusto
```typescript
try {
  const result = await analyzeImageWithGemini(base64, mimeType);
  if (result.error) {
    throw new Error(result.error);
  }
  setAnalysisResult(result);
} catch (error) {
  if (error.message.includes('429')) {
    alert('Demasiadas solicitudes. Espera un momento.');
  } else if (error.message.includes('network')) {
    alert('Error de conexión. Verifica tu internet.');
  } else {
    alert('Error al analizar la imagen. Intenta de nuevo.');
  }
  setPreviewImage(null);
}
```

### 3. Feedback de Usuario
Agregar estados de UI más detallados:
```typescript
const [analysisStatus, setAnalysisStatus] = useState<string>('');

// Durante análisis:
setAnalysisStatus('Enviando imagen...');
// await upload
setAnalysisStatus('Analizando contenido nutricional...');
// await gemini
setAnalysisStatus('Procesando resultados...');
```

---

## ✅ Checklist de Implementación

### Configuración Inicial
- [ ] API Key de Gemini obtenida
- [ ] Variable `GEMINI_API_KEY` en `.env.local`
- [ ] `.env.local` en `.gitignore`

### Backend (API Route)
- [ ] Carpeta `app/api/analyze-food` creada
- [ ] Archivo `route.ts` creado con código completo
- [ ] Validaciones de seguridad implementadas
- [ ] Manejo de errores robusto

### Frontend
- [ ] Función `analyzeImageWithGemini` actualizada
- [ ] `handleFileSelect` con validaciones
- [ ] Types de TypeScript agregados
- [ ] UI de loading mejorada

### Testing
- [ ] Test local con `npm run dev` exitoso
- [ ] Test con diferentes tipos de imágenes
- [ ] Test con imágenes sin comida
- [ ] Test con imágenes de mala calidad
- [ ] Verificación de respuestas en Network Tab

### Producción
- [ ] Build con `npm run build` sin errores
- [ ] Variables de entorno en Firebase Hosting configuradas
- [ ] Deploy exitoso
- [ ] Test en URL de producción

### Opcionales
- [ ] Rate limiting implementado
- [ ] Caché de respuestas configurado
- [ ] Logging estructurado agregado
- [ ] Compresión de imágenes implementada

---

## 🐛 Troubleshooting

### Error: "GEMINI_API_KEY is not defined"
```bash
# Verificar que existe en .env.local
cat .env.local | grep GEMINI

# Reiniciar servidor de desarrollo
npm run dev
```

### Error: "API key not valid"
- Verificar que la key no tenga espacios
- Regenerar key en Google AI Studio
- Verificar que el proyecto tiene Gemini API habilitado

### Error: "Quota exceeded"
- Verificar uso en [Google AI Studio Dashboard](https://makersuite.google.com/)
- Esperar reset diario (medianoche PST)
- Considerar implementar caché

### Respuestas inconsistentes
- Ajustar `temperature` en generationConfig (más bajo = más determinístico)
- Mejorar prompt con más ejemplos
- Agregar validación adicional de resultados

### Imágenes muy grandes causan timeout
- Implementar compresión en cliente
- Reducir `maxDuration` y agregar mensaje de error claro

---

## 📚 Referencias

- [Gemini API Documentation](https://ai.google.dev/docs)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Google AI Studio](https://makersuite.google.com/)

---

**Última actualización**: 19 de noviembre de 2025
