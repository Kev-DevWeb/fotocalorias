# 🔥 Plan de Implementación: Firebase Hosting

## Objetivo
Desplegar la aplicación FotoCalorías en Firebase Hosting con soporte para múltiples usuarios, autenticación segura, y almacenamiento personalizado de datos biométricos y objetivos nutricionales. La aplicación será accesible públicamente con SSL automático.

---

## 📋 Prerequisitos

### 1. Cuenta de Firebase
- Crear cuenta en [Firebase Console](https://console.firebase.google.com/)
- Crear nuevo proyecto llamado "fotocalorias" (o nombre preferido)
- Activar plan Blaze (pago por uso) para usar Cloud Functions si es necesario
- **IMPORTANTE**: Habilitar Firebase Authentication (Email/Password)

### 2. Firebase CLI
```bash
# Instalar Firebase CLI globalmente
npm install -g firebase-tools

# Verificar instalación
firebase --version
```

---

## 🏗️ Pasos de Implementación

### Fase 1: Configuración Inicial de Firebase

#### 1.1 Login en Firebase
```bash
firebase login
```

#### 1.2 Inicializar Firebase en el proyecto
```bash
cd c:\Users\Muñe\Documents\GitHub\xCal\fotocalorias
firebase init
```

**Seleccionar:**
- ✅ Hosting: Configure files for Firebase Hosting
- ✅ Firestore: Deploy rules and create indexes
- ✅ Authentication: Set up user authentication
- (Opcional) ✅ Storage: Configure security rules for Cloud Storage

**Configuración recomendada:**
```
? What do you want to use as your public directory? out
? Configure as a single-page app (rewrite all urls to /index.html)? Yes
? Set up automatic builds and deploys with GitHub? No
? File out/index.html already exists. Overwrite? No
```

#### 1.3 Configurar Authentication
En Firebase Console:
1. Ir a **Authentication**
2. Click en **Get Started**
3. En la pestaña **Sign-in method**, habilitar:
   - ✅ **Email/Password** (Native provider)
   - (Opcional) Google, Facebook, etc.
4. En **Settings** → **Authorized domains**, verificar que tu dominio esté listado

#### 1.4 Configurar Firestore
En Firebase Console:
1. Ir a **Firestore Database**
2. Crear base de datos en modo **producción**
3. Elegir ubicación cercana (ej: `us-central1`)

#### 1.5 Configurar reglas de Firestore

Crear/editar `firestore.rules`:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Colección de usuarios - Cada usuario solo puede leer/escribir su propio documento
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId;
      allow delete: if false; // No permitir eliminar usuarios desde el cliente
    }
    
    // Subcolección de logs de calorías - Solo el propietario puede acceder
    match /users/{userId}/calorie_logs/{logId} {
      // Solo el dueño del perfil puede leer sus logs
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Solo el dueño puede crear logs con validación de datos
      allow create: if request.auth != null 
                    && request.auth.uid == userId
                    && request.resource.data.keys().hasAll(['food_name', 'calories', 'protein', 'carbs', 'fat', 'createdAt'])
                    && request.resource.data.food_name is string
                    && request.resource.data.calories is number
                    && request.resource.data.protein is number
                    && request.resource.data.carbs is number
                    && request.resource.data.fat is number;
      
      // Solo el dueño puede actualizar o eliminar sus logs
      allow update, delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Desplegar reglas:
```bash
firebase deploy --only firestore:rules
```

---

### Fase 2: Configuración de Credenciales

#### 2.1 Obtener credenciales de Firebase

1. En Firebase Console, ir a **Project Settings** (⚙️)
2. Scroll hasta **Your apps** → **Web apps**
3. Click en **Add app** (</>) → Registrar app "FotoCalorías Web"
4. Copiar el objeto `firebaseConfig`

#### 2.2 Crear archivo de variables de entorno

Crear `.env.local` en la raíz del proyecto:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=fotocalorias-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=fotocalorias-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=fotocalorias-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

#### 2.3 Actualizar código para usar variables de entorno

Modificar `app/page.tsx`:
```typescript
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};
```

#### 2.4 Agregar `.env.local` al `.gitignore`

Crear/editar `.gitignore`:
```
.env.local
.env
.env*.local
```

---

### Fase 3: Configuración de Next.js para Hosting

#### 3.1 Configurar exportación estática

Editar `next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',  // Habilitar exportación estática
  images: {
    unoptimized: true  // Firebase Hosting no soporta Image Optimization
  }
};

export default nextConfig;
```

#### 3.2 Configurar Firebase Hosting

Crear/editar `firebase.json`:
```json
{
  "hosting": {
    "public": "out",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

Crear `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "calorie_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Nota**: Los índices compuestos adicionales se crearán automáticamente cuando Firebase detecte las queries. Si necesitas crear manualmente:

```json
{
  "indexes": [
    {
      "collectionGroup": "calorie_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "calorie_logs",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

### Fase 4: Build y Deploy

#### 4.1 Construir la aplicación
```bash
npm run build
```

Esto generará la carpeta `out/` con los archivos estáticos.

#### 4.2 Probar localmente
```bash
firebase serve
```

Visitar `http://localhost:5000` para verificar.

#### 4.3 Desplegar a Firebase Hosting
```bash
firebase deploy
```

O solo hosting:
```bash
firebase deploy --only hosting
```

#### 4.4 Verificar deployment
Firebase mostrará una URL como:
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/fotocalorias-xxxxx/overview
Hosting URL: https://fotocalorias-xxxxx.web.app
```

---

### Fase 5: Configuración Adicional (Opcional)

#### 5.1 Dominio Personalizado

1. En Firebase Console → Hosting → **Add custom domain**
2. Ingresar dominio (ej: `fotocalorias.com`)
3. Seguir instrucciones para configurar DNS:
   - Agregar registros A/CNAME en tu proveedor de DNS
   - Firebase provee SSL automático via Let's Encrypt

#### 5.2 Preview Channels (Para staging)
```bash
# Crear preview channel
firebase hosting:channel:deploy staging

# Ver preview
# URL: https://fotocalorias-xxxxx--staging-xxxxxxxx.web.app
```

#### 5.3 GitHub Actions para CI/CD

Crear `.github/workflows/firebase-hosting-merge.yml`:
```yaml
name: Deploy to Firebase Hosting on merge
on:
  push:
    branches:
      - main

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${{ secrets.FIREBASE_STORAGE_BUCKET }}
          NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}
          NEXT_PUBLIC_FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}
          
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: fotocalorias-xxxxx
```

---

## 📊 Costos Estimados

### Firebase Hosting (Plan Spark - Gratis)
- **Almacenamiento**: 10 GB
- **Transferencia**: 360 MB/día
- **SSL**: Incluido
- **CDN Global**: Incluido

### Firebase Authentication (Gratis)
- **Usuarios**: Ilimitados
- **Email/Password**: Incluido
- **Proveedores OAuth**: Incluidos

### Firestore (Plan Spark)
- **Documentos**: 50,000 lecturas/día
- **20,000 escrituras/día**
- **20,000 eliminaciones/día**
- **Almacenamiento**: 1 GB

**Para múltiples usuarios**:
- **Estimación por usuario/día**:
  - ~20-30 lecturas (cargar logs, perfil)
  - ~5-10 escrituras (registrar comidas)
  - ~50 documentos almacenados por mes
- **Hasta ~500 usuarios activos diarios** dentro del plan gratuito
- Para más usuarios, el costo es mínimo (~$0.18/100k lecturas)

### Plan Blaze (Si se necesita)
- Pago por uso después de límites gratuitos
- ~$0.18 por 100k lecturas
- ~$0.36 por 100k escrituras

---

## ✅ Checklist de Deployment

- [ ] Cuenta Firebase creada
- [ ] Proyecto Firebase creado
- [ ] Firebase CLI instalado
- [ ] **Firebase Authentication habilitado (Email/Password)**
- [ ] Firestore habilitado
- [ ] Reglas de Firestore configuradas para multi-usuario
- [ ] Variables de entorno configuradas
- [ ] `.env.local` en `.gitignore`
- [ ] `next.config.ts` con `output: 'export'`
- [ ] `firebase.json` configurado
- [ ] `npm run build` exitoso
- [ ] `firebase deploy` exitoso
- [ ] App accesible en URL de Firebase
- [ ] Autenticación funcionando
- [ ] Firestore leyendo/escribiendo correctamente
- [ ] (Opcional) Dominio personalizado configurado
- [ ] (Opcional) GitHub Actions configurado

---

## 🛠️ Comandos de Mantenimiento

```bash
# Ver logs de hosting
firebase hosting:logs

# Ver uso de cuotas
firebase projects:list

# Rollback a versión anterior
firebase hosting:rollback

# Eliminar versiones antiguas
firebase hosting:releases:delete <RELEASE_ID>

# Ver configuración actual
firebase hosting:sites:list
```

---

## 🐛 Troubleshooting Común

### Error: "Missing permissions"
```bash
firebase login --reauth
```

### Error: "Quota exceeded"
- Verificar plan en Firebase Console
- Considerar upgrade a Blaze

### Error: "Auth domain not configured"
- Verificar que el dominio esté en **Authorized domains** en Authentication
- Agregar manualmente si es necesario

### Error de CORS con Gemini API
- Gemini API debe llamarse desde servidor (ver PLAN_GEMINI_API.md)
- No es posible llamar directamente desde cliente en producción

### Usuarios no pueden registrarse
- Verificar que Email/Password esté habilitado en Authentication
- Revisar reglas de Firestore para colección `users`

### Errores de Build
```bash
# Limpiar cache
rm -rf .next out node_modules
npm install
npm run build
```

---

## 📚 Referencias

- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)

---

**Última actualización**: 19 de noviembre de 2025
