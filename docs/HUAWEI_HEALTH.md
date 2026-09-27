# Integración con Huawei Health: investigación

Estado: **solo investigación, sin código todavía.** Fecha: 2026-09-27.

## Opción A: Health Kit REST API (oficial)
- Huawei ofrece una API REST en la nube de Health Kit para **escribir y leer** datos de salud, incluida la ingesta de nutrición ([referencia REST](https://developer.huawei.com/consumer/en/doc/HMSCore-References/rest-overview-0000001254420693), [modelo de datos](https://developer.huawei.com/consumer/en/doc/HMSCore-References/data-model-0000001054556973)).
- El flujo sería igual al de Google Fit en `app/api/auth/google-fit/*`: OAuth 2.0 con HUAWEI ID, se guardan los tokens en Firestore, se escribe cada comida como registro de nutrición y se leen las calorías quemadas.
- **Requisitos:** cuenta de HUAWEI Developer verificada, un proyecto en AppGallery Connect y **solicitar y obtener la aprobación de los scopes de Health Kit**. Huawei revisa el caso de uso y la política de privacidad, y la aprobación puede tardar días o semanas.
- Antes de programar hay que confirmar en la consola cuál es el scope exacto y el tipo de dato de nutrición, y si se aprueba para una app web personal.

## Opción B: puente a través de Health Connect
- Huawei Health **no escribe en Health Connect de forma oficial** porque vive en el ecosistema HMS ([FitMesh](https://www.fitmesh.fit/en/blog/huawei-health-health-connect-sync)).
- La app de terceros [Health Sync](https://play.google.com/store/apps/details?id=nl.appyhapps.healthsync) sincroniza datos entre Huawei Health, Health Connect y otras plataformas, aunque la cobertura de nutrición es limitada.
- Para una web app, Health Connect no sirve directamente porque es una API solo para Android on-device. Habría que tener una app nativa (el repo tiene `app.json` y `eas.json` de Expo, así que esto sería factible más adelante).

## Opción C: agregadores de pago
[Spike API](https://www.spikeapi.com/integrations/huawei-health) y [Thryve](https://www.thryve.health/features/connections/huawei-health-kit) ya tienen la aprobación de Huawei y exponen los datos por su propia API. Evitan el trámite con Huawei, pero cuestan.

## Opción D: sin cuenta, disponible hoy
- Un botón **"Compartir resumen del día"** (Web Share API) con las calorías y los macros, para copiarlos en la sección de nutrición de Huawei Health.
- Exportar a CSV.
- Es rápido y gratis, pero el registro sigue siendo manual.

## Recomendación
1. Ya: implementar la **Opción D** (menos de 1 hora).
2. Si quieres el registro automático: crear la cuenta de HUAWEI Developer (gratis) y solicitar los scopes de Health Kit. Mientras llega la aprobación, dejar lista la ruta OAuth reutilizando el patrón de Google Fit.
3. Aparte, conviene migrar Google Fit: sus REST APIs están deprecadas y Google las reemplaza por Health Connect.
