# Registro asistido en Huawei Health

## Problema
Huawei Health no permite que apps de terceros escriban nutrición (solo peso, presión y glucosa), y se descartó la API oficial de Health Kit. El objetivo es que pasar una comida de fotocalorias a Huawei Health tome unos 10 segundos y que la app recuerde cuáles ya se pasaron.

Alcance: solo Android con Google y solo la dirección fotocalorias → Huawei.

## Diseño
- **`lib/huawei-health.ts`** (lógica pura): `formatForHuawei(log)`, `buildClipboardText(log)`, `huaweiIntentUrl()` y `countPendingHuawei(logs)`.
- **`app/components/HuaweiLogSheet.tsx`**: hoja inferior con el tipo de comida, el nombre, las kcal en grande y los macros (se copian al tocarlos). Tiene dos botones: "Copiar y abrir Huawei Health" (portapapeles + intent de Android) y "Ya lo registré".
- **Datos:** campo opcional `huawei_logged_at` (Timestamp) en `users/{uid}/calorie_logs/{id}`, escrito con `updateDoc`. Las reglas actuales ya permiten que el dueño haga el update.
- **`app/page.tsx`**: botón o ✓ en cada fila de "Comidas del Día" y el contador "Pendientes en Huawei: N".
- El modo invitado queda fuera porque no guarda comidas.

## Errores
- Si falla el portapapeles, se muestra el aviso "copia manualmente" y los valores quedan seleccionables.
- Si la app no está instalada, el intent usa `browser_fallback_url` y lleva a Play Store.
- Si falla `updateDoc`, se muestra un `alert` (igual que en el resto de la app) y la comida no se marca.

## Tests
- `lib/huawei-health.test.ts` con `node:test`: formato, redondeo, etiqueta de la comida, URL del intent y contador de pendientes.
- Prueba manual en un Android real: abre la app, copia el texto y el ✓ persiste al recargar.
