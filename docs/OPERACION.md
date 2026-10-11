# Operación del análisis de comida

Cómo está montado el reconocimiento por foto y texto, qué configurar y qué hacer cuando algo falla. El diseño completo está en `docs/superpowers/specs/2026-10-10-reconocimiento-robusto-design.md`.

## Variables de entorno (Vercel)

| Variable | Para qué | Obligatoria |
|---|---|---|
| `GEMINI_API_KEY` | Proveedor principal | Sí |
| `GROQ_API_KEY` | Proveedor de respaldo | Recomendada |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | El servidor verifica con él la sesión del usuario | Sí |
| `HEALTH_TOKEN` | Protege el diagnóstico profundo | Para el monitoreo |
| `AI_PROVIDERS` | Orden de proveedores. Por defecto `gemini,groq` | No |
| `GEMINI_MODELS`, `GROQ_MODELS` | Cambiar de modelo sin tocar código (lista separada por comas) | No |
| `USER_HOURLY_LIMIT`, `USER_DAILY_LIMIT`, `GUEST_DAILY_LIMIT` | Límites de uso. Por defecto 30, 150 y 5 | No |

Después de cambiar una variable en Vercel hay que volver a desplegar para que aplique.

## Cómo responde una petición
1. Se valida la entrada. Texto de 3 a 500 caracteres; imagen JPG, PNG, WebP o HEIC de hasta 3 MB.
2. Se identifica a quien pide. Con sesión iniciada aplica el límite por usuario; sin sesión cuenta como invitado, con 5 análisis por día por IP.
3. El motor consulta al primer candidato. Si tarda más de 2.5 s (texto) o 4.5 s (imagen), lanza el siguiente en paralelo y se queda con la primera respuesta válida. Tiene 25 s en total.
4. El servidor suma los totales a partir del desglose y revisa que sean posibles.

La respuesta incluye `model_used` (por ejemplo `gemini/gemini-3.5-flash-lite`), que dice qué modelo contestó.

## Diagnóstico

Qué versión está desplegada y qué proveedores tienen key:

```bash
curl https://xcal-fawn.vercel.app/api/health
```

Prueba en vivo de cada candidato, con texto y con imagen:

```bash
curl -H "x-health-token: $HEALTH_TOKEN" "https://xcal-fawn.vercel.app/api/health?deep=1"
```

En `candidates` viene el estado de cada uno:
- `ok`: respondió lo esperado.
- `transient`: cuota del día agotada, saturación o timeout. Se arregla solo.
- `fail`: requiere acción (ver la tabla de abajo).

Responde 200 si al menos un candidato está `ok` y ninguno está en `fail`; si no, 503.

En los logs de Vercel, cada análisis deja una línea `{"evt":"analysis",...}` con los intentos, su duración y el motivo de cada fallo. No incluye el texto ni la foto del usuario.

## Monitoreo diario
El workflow `.github/workflows/smoke.yml` llama al diagnóstico profundo una vez al día. Si falla, GitHub envía un correo.

Para activarlo, crea el secreto `HEALTH_TOKEN` en el repositorio (Settings → Secrets and variables → Actions) con el mismo valor que en Vercel. GitHub pausa los workflows programados tras 60 días sin actividad en el repositorio; se reactivan desde la pestaña Actions.

## Si el monitoreo falla

| Detalle del candidato | Causa probable | Qué hacer |
|---|---|---|
| `HTTP 404` o "model not found" | El proveedor retiró el modelo | Poner el modelo vigente en `GEMINI_MODELS` o `GROQ_MODELS` y volver a desplegar |
| `HTTP 401` o `403` | La key venció o perdió permisos | Generar otra key y actualizarla en Vercel |
| "Inventó comida en una imagen en blanco" o "No se encontró JSON" | El modelo no sigue el contrato | Cambiar de modelo en ese proveedor |
| "El endpoint no devolvió JSON" | El proveedor retiró o movió su API | Buscar el aviso del proveedor; si el servicio cerró, quitarlo de `AI_PROVIDERS` y del código |
| Todos en `transient` con `HTTP 429` | Se agotaron las cuotas gratuitas del día | Esperar al día siguiente; si se repite, agregar otro proveedor |
| Todos en `transient` con `HTTP 503` o `timeout` | Saturación general | Volver a correr el workflow más tarde |

Un solo candidato en `transient` no hace fallar el monitoreo: los demás cubren.

## Comparar modelos
Para decidir cuál modelo conviene de principal, el workflow `.github/workflows/compare.yml` ("Comparar modelos") pasa las mismas comidas por cada candidato por separado, sin respaldo ni caché. Se lanza a mano desde la pestaña Actions y deja una línea `RESULT {...}` por comida con las calorías, los macros y el tiempo de cada modelo. Repetir cada comida (`rounds`) muestra si el modelo responde siempre igual.

Lo mismo con una sola comida:

```bash
curl -H "x-health-token: $HEALTH_TOKEN" -H "content-type: application/json" \
  -d '{"description":"2 tortillas de maíz"}' https://xcal-fawn.vercel.app/api/health
```

El orden de los proveedores se cambia con `AI_PROVIDERS` (por ejemplo `groq,gemini`).

## Límites conocidos
- Los contadores de uso viven en la memoria de cada instancia del servidor y se reinician con cada despliegue. Frenan el uso normal, no un ataque decidido. `lib/rate-limit.ts` define la interfaz para cambiarlos por un almacén externo.
- La caché que hace que la misma descripción devuelva los mismos números también es por instancia y dura 24 horas.
- Las cuotas de los planes gratuitos cambian sin aviso; el dato vigente está en el panel de cada proveedor.

## Probar los proveedores en local
Con las keys en `.env.local`:

```bash
npm run test:providers -- foto1.jpg foto2.jpg
```

Reporta por candidato cuántas respuestas fueron válidas, si rechazó lo que no es comida, si repitió el mismo resultado y la latencia.
