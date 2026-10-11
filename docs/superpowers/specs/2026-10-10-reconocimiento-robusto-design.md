# Reconocimiento de foto y texto robusto

Fecha: 2026-10-10. Rama: `feat/robust-analysis`.

## Objetivo
Que el análisis por foto y por texto responda siempre o falle con un mensaje claro, sin guardar datos falsos, para uso personal y de conocidos en producción, sin costo.

## Problemas medidos en producción (commit `c6faa8f`)
1. Un solo modelo en producción (`gemini-3.1-flash-lite`), sin respaldo configurado.
2. La misma frase tardó de 1.4 s a 12 s; al pasar el límite de 12 s la petición falló con 503. No hay reintentos.
3. Lo que no es comida se devuelve como comida de 0 kcal ("Objeto no comestible", "No se detectó comida"), porque el schema obliga a llenar nombre y calorías.
4. El modelo de respaldo de Groq (`llama-4-scout`) fue retirado el 17/07/2026.
5. La misma frase dio 380 o 480 kcal según el intento.
6. La API responde sin login; el límite de peticiones solo vive en el navegador.
7. Imagen corrupta → 503; JSON inválido → 500.
8. El cliente falla con respuestas no JSON, no tiene tiempo límite y descarta la foto o el texto al fallar.
9. No se puede corregir el resultado antes de guardar.
10. No hay pruebas, CI ni monitoreo.

## Decisiones
- Usuarios: el dueño y conocidos. Con sesión, uso normal con límite por usuario; invitado, 5 análisis por día por IP.
- Respaldo: Gemini, GitHub Models y Groq, todos en plan gratuito.
- El modelo devuelve un desglose por alimento; el servidor suma los totales y el usuario puede ajustar gramos antes de guardar.

## Diseño

### Contrato de salida del modelo (`lib/ai/contract.ts`)
`is_food`, `not_food_reason`, `food_name`, `items[]` (`name`, `quantity`, `grams`, `calories`, `protein`, `carbs`, `fat`, `sugar`, `fiber`, `sodium`), `confidence`, `portion_note`, `nova_group`, `nova_reason`. Una sola definición genera el schema Zod, el de Gemini y el estricto tipo OpenAI.

### Respuesta de la API
Se mantienen los campos planos (`food_name`, `calories`, `protein`, `carbs`, `fat`, `sugar`, `fiber`, `sodium`, `confidence`, `detected_items`, `portion_note`, `nova_group`, `nova_reason`, `model_used`) y se agregan `items` y `warnings`.

Errores: `{ error, code, retryable }` con estado HTTP propio.

| code | HTTP | reintentar |
|---|---|---|
| `NO_FOOD` | 422 | no |
| `INVALID_INPUT`, `INVALID_IMAGE` | 400 | no |
| `IMAGE_TOO_LARGE` | 413 | no |
| `UNAUTHORIZED` | 401 | no |
| `RATE_LIMITED`, `GUEST_LIMIT` | 429 | no |
| `UPSTREAM_UNAVAILABLE` | 503 | sí |
| `INTERNAL` | 500 | sí |

### Finalización (`lib/ai/finalize.ts`)
- `is_food: false` → `NO_FOOD`.
- `is_food: true` sin alimentos → salida inválida; se intenta otro candidato.
- Totales = suma de `items`.
- Más de 9.5 kcal por gramo en un alimento → resultado imposible; se intenta otro candidato y solo se devuelve, con aviso, si ninguno da algo mejor.
- Si las kcal no cuadran con 4·P + 4·C + 9·G (fuera de bebidas alcohólicas), se agrega un aviso y la confianza baja a "Baja".

### Motor (`lib/ai/engine.ts`)
- Candidatos = proveedor + modelo. Orden por defecto: Gemini, GitHub Models, Groq y luego los modelos secundarios.
- Cobertura: si el candidato en curso no responde en 4 s (texto) o 6 s (imagen), se lanza el siguiente en paralelo; gana la primera respuesta válida y se aborta la otra.
- 429, 5xx, timeout, bloqueo o salida inválida → siguiente candidato. 400, 401, 403 y 404 descartan ese candidato para el resto de la petición.
- Al agotar la lista, una segunda vuelta tras una espera con jitter, dentro de un presupuesto total de 25 s.
- Temperatura 0 y `seed` fijo en todos los proveedores. Caché en memoria para texto.

### Entrada (`lib/ai/validate-input.ts`)
- Texto: se limpian caracteres de control y delimitadores; 3 a 500 caracteres; entra al prompt entre etiquetas y marcado como dato.
- Imagen: base64 válido, tipo detectado por sus primeros bytes (JPEG, PNG, WebP, HEIC), máximo 3 MB.

### Acceso (`lib/auth/verify-firebase-token.ts`, `lib/rate-limit.ts`)
- El cliente envía `Authorization: Bearer <ID token de Firebase>`; el servidor lo verifica con las llaves públicas de Google (`jose`).
- Límites en memoria: 30 por hora y 150 por día por usuario; 5 por día por IP para invitados. El contador es por instancia y se reinicia con cada despliegue; la interfaz permite cambiar a un almacén externo.

### Cliente (`lib/analysis-client.ts`, `app/page.tsx`)
- Un solo `analyzeFood()`: tiempo límite de 35 s, lectura segura de respuestas no JSON, un reintento en fallos reintentables.
- Al fallar se conserva la foto o el texto y se ofrece "Reintentar".
- Aviso de versión: las rutas envían `x-app-version`; si difiere de la versión del cliente, se ofrece actualizar.

### Desglose y ajuste (`lib/nutrition-math.ts`, `app/components/AnalysisEditor.tsx`)
Lista de alimentos con gramos editables y opción de quitar; multiplicadores ½×, 1×, 1½×, 2×; totales recalculados en vivo. Se guardan los totales ajustados, `items` y `adjusted`.

### Operación
- `GET /api/health`: versión y proveedores configurados. Con `?deep=1` y `x-health-token`, un análisis mínimo por candidato.
- CI en GitHub Actions: typecheck, lint del alcance nuevo y pruebas. Un workflow diario llama al health profundo de producción.

## Pruebas
`node:test` con `tsx` para: extracción de JSON, normalización, finalización, validación de entrada, motor con proveedores falsos, límites, verificación de token, cliente con `fetch` simulado y cálculo de porciones.

## Fuera de alcance
Rediseño visual, conversión de HEIC en el cliente, migración de Google Fit, almacén externo para límites y la app instalada en el teléfono.
