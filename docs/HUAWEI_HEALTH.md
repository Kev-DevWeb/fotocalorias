# Integración con Huawei Health

**Decisión (2026-09-27): registro asistido.** Diseño en `docs/superpowers/specs/2026-09-27-huawei-registro-asistido-design.md`.

## Por qué no es automático
- Huawei Health solo deja que apps de terceros **escriban peso, presión y glucosa, no nutrición** ([FAQ de Health Sync](https://healthsync.app/f-a-q/)). Por eso los puentes como Health Sync no pueden meter comidas.
- Huawei Health tampoco escribe en Health Connect de forma oficial ([FitMesh](https://www.fitmesh.fit/en/blog/huawei-health-health-connect-sync)).
- La única escritura automática es la [API REST oficial de Health Kit](https://developer.huawei.com/consumer/en/doc/HMSCore-References/rest-overview-0000001254420693), que requiere cuenta de HUAWEI Developer y aprobación de scopes. Se descartó.

## Cómo funciona
1. En "Comidas del Día", cada comida tiene un botón **Huawei**.
2. La hoja muestra kcal y macros grandes (se copian al tocarlos). El botón "Copiar y abrir Huawei Health" copia `Nombre - N kcal` y abre la app con un intent de Android (`com.huawei.health`), o Play Store si no está instalada.
3. "Ya lo registré" guarda `huawei_logged_at` en el log de Firestore y la comida muestra ✓. El encabezado muestra cuántas comidas faltan.

Esto solo funciona en Android. En otros sistemas solo se copia el texto.
