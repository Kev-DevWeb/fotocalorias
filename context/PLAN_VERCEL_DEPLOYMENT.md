# 🚀 Plan de Implementación: Vercel Deployment

## Objetivo
Desplegar la aplicación FotoCalorías en Vercel (100% GRATIS) con soporte para múltiples usuarios, autenticación segura, API Routes serverless, y almacenamiento personalizado de datos biométricos. Vercel es la plataforma nativa para Next.js y ofrece deployment automático desde GitHub.

---

## 🎁 Ventajas de Vercel vs Firebase Hosting

### ✅ Plan Gratuito Generoso
- **100 GB de ancho de banda/mes** (vs 360 MB/día Firebase)
- **Despliegues ilimitados**
- **Serverless Functions incluidas** (100 GB-Hrs/mes)
- **SSL automático** incluido
- **CDN Global** Edge Network
- **Zero configuration** para Next.js

### ✅ Características Premium Gratis
- **Automatic HTTPS**
- **Custom domains** (1 dominio gratis)
- **Preview deployments** automáticos en PRs
- **Analytics básico**
- **Environment variables** UI amigable
- **Rollbacks instantáneos**
- **Edge Functions** (opcional)

### ✅ Integración Perfecta
- **Git-based workflow** automático
- **GitHub/GitLab/Bitbucket** integration
- **Build cache** inteligente
- **Hot reload** en development
- **API Routes** nativas de Next.js (sin Cloud Functions)

---

## 📋 Prerequisitos

### 1. Cuenta de Vercel
- Crear cuenta en [vercel.com](https://vercel.com/signup)
- **Recomendado**: Sign up con GitHub (deployment automático)
- Plan Hobby (gratuito, sin tarjeta de crédito)

### 2. Firebase (Solo para Backend)
- Cuenta Firebase para Firestore + Authentication
- **NO NECESITAS** Firebase Hosting (Vercel reemplaza esto)
- Configurar Firestore y Auth como antes

### 3. Repositorio Git
```bash
# Si no tienes repo, crear uno
cd c:\Users\Muñe\Documents\GitHub\xCal\fotocalorias
git init
git add .
git commit -m "Initial commit for Vercel deployment"

# Crear repo en GitHub y push
git remote add origin https://github.com/TU_USUARIO/fotocalorias.git
git branch -M main
git push -u origin main
```

---

## 🏗️ Pasos de Implementación

### Fase 1: Preparar el Proyecto

#### 1.1 Verificar `next.config.ts`

El archivo ya está configurado para Vercel (NO requiere `output: 'export'`):

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración optimizada para Vercel
  images: {
    domains: [], // Agregar dominios si usas imágenes externas
  },
};

export default nextConfig;
```

#### 1.2 Crear `.vercelignore` (Opcional)

```
node_modules
.next
.env.local
.env*.local
.git
```

#### 1.3 Verificar Variables de Entorno

Tu `.env.local` debe contener:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=fotocalorias-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=fotocalorias-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=fotocalorias-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**⚠️ IMPORTANTE**: `.env.local` NO se sube a Git. Configurarás estas variables en el dashboard de Vercel.

---

### Fase 2: Deploy Automático desde GitHub

#### 2.1 Conectar Repositorio a Vercel

1. **Ir a [vercel.com/new](https://vercel.com/new)**
2. **Import Git Repository**
3. Seleccionar tu repo `fotocalorias`
4. Vercel detecta automáticamente que es Next.js

#### 2.2 Configurar Variables de Entorno

En la pantalla de import:

1. Click en **Environment Variables**
2. Agregar cada variable (⚠️ Sin las comillas):

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSy...` | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `fotocalorias-xxx.firebaseapp.com` | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `fotocalorias-xxx` | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `fotocalorias-xxx.appspot.com` | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `123456789012` | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:123456789012:web:abc...` | Production, Preview, Development |
| `GEMINI_API_KEY` | `AIzaSy...` (⚠️ **Secret**) | Production, Preview, Development |

**Tip**: Marca `GEMINI_API_KEY` como **Sensitive** (oculta el valor).

#### 2.3 Deploy

1. Click **Deploy**
2. Vercel construirá automáticamente:
   - `npm install`
   - `npm run build`
   - Deploy a CDN global

⏱️ **Tiempo estimado**: 1-2 minutos

#### 2.4 Verificar Deployment

Vercel te dará una URL como:
```
✅ Production: https://fotocalorias.vercel.app
📸 Preview: https://fotocalorias-git-main-tu-usuario.vercel.app
```

---

### Fase 3: Configurar Firebase para Vercel

#### 3.1 Actualizar Authorized Domains en Firebase

1. Ir a **Firebase Console** → **Authentication** → **Settings**
2. Scroll a **Authorized domains**
3. Agregar:
   ```
   fotocalorias.vercel.app
   fotocalorias-git-main-tu-usuario.vercel.app
   ```

#### 3.2 Firestore Rules (Igual que antes)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /users/{userId}/calorie_logs/{logId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

### Fase 4: Workflow Automático

#### 4.1 Continuous Deployment

**Cada vez que hagas push a GitHub**:
```bash
git add .
git commit -m "Update feature"
git push
```

**Vercel automáticamente**:
- ✅ Detecta el push
- ✅ Construye la app
- ✅ Despliega a producción
- ✅ Invalida CDN cache
- ✅ Te notifica en Dashboard

#### 4.2 Preview Deployments

**Cada vez que crees un Pull Request**:
- Vercel crea un **preview deployment** único
- URL temporal: `https://fotocalorias-pr-123.vercel.app`
- Perfecto para testing antes de merge

---

## 🔧 Comandos Útiles

### Desarrollo Local
```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Build local (testing)
npm run build
npm start
```

### Vercel CLI (Opcional)

Instalar CLI:
```bash
npm i -g vercel
```

Deploy manual desde terminal:
```bash
# Login
vercel login

# Deploy a preview
vercel

# Deploy a producción
vercel --prod

# Ver logs
vercel logs

# Listar deployments
vercel ls
```

---

## 📊 Límites del Plan Gratuito (Hobby)

### ✅ Más que Suficiente para FotoCalorías

| Recurso | Límite | Uso Estimado (100 usuarios/día) |
|---------|--------|----------------------------------|
| **Bandwidth** | 100 GB/mes | ~10-15 GB/mes ✅ |
| **Serverless Execution** | 100 GB-Hrs/mes | ~5-10 GB-Hrs/mes ✅ |
| **Build Minutes** | Ilimitado | ✅ |
| **Deployments** | Ilimitado | ✅ |
| **Domains** | 1 custom (gratis) | ✅ |
| **Team Members** | Solo tú | ✅ |
| **Edge Functions** | 100,000 invocations/day | N/A (no usamos) |

### 🔄 Comparación Firebase vs Vercel

| Aspecto | Firebase Hosting | Vercel |
|---------|------------------|--------|
| **Precio** | $0.15/GB después de 360MB/día | 100 GB/mes gratis |
| **API Routes** | ❌ Necesita Cloud Functions ($$$) | ✅ Incluido gratis |
| **Build Time** | Manual (`firebase deploy`) | ✅ Automático (Git push) |
| **Rollbacks** | Manual | ✅ 1-click |
| **Preview URLs** | Manual con channels | ✅ Automático en PRs |
| **Next.js SSR** | ❌ Solo static export | ✅ Nativo |

**Veredicto**: Vercel es superior para Next.js y 100% gratis para tu caso de uso.

---

## 🌐 Dominio Personalizado (Opcional)

### Agregar tu Propio Dominio

1. **Comprar dominio** (ej: Namecheap, GoDaddy)
2. En Vercel Dashboard:
   - **Settings** → **Domains**
   - Agregar `fotocalorias.com`
3. Configurar DNS en tu proveedor:
   ```
   Type: A
   Name: @
   Value: 76.76.19.19
   
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```
4. **Vercel automáticamente**:
   - Provisiona SSL (Let's Encrypt)
   - Configura CDN
   - Redirige www → apex

⏱️ **Propagación DNS**: 5-30 minutos

---

## ✅ Checklist de Deployment

- [ ] Cuenta Vercel creada
- [ ] Repositorio GitHub creado
- [ ] Código pusheado a GitHub
- [ ] Firebase Firestore configurado
- [ ] Firebase Authentication habilitado (Email/Password)
- [ ] Firestore rules actualizadas
- [ ] Proyecto importado en Vercel
- [ ] Variables de entorno configuradas en Vercel
- [ ] Primer deployment exitoso
- [ ] URL `.vercel.app` agregada a Firebase Authorized Domains
- [ ] App accesible en `https://fotocalorias.vercel.app`
- [ ] Autenticación funcionando
- [ ] Firestore leyendo/escribiendo correctamente
- [ ] API Route `/api/analyze-food` funcionando
- [ ] (Opcional) Dominio personalizado configurado

---

## 🐛 Troubleshooting Común

### Error: "Build failed"
```bash
# Revisar logs en Vercel Dashboard
# Verificar que build local funcione:
npm run build
```

### Error: "Firebase not initialized"
- Verificar que TODAS las variables `NEXT_PUBLIC_FIREBASE_*` estén configuradas
- Verificar que no haya espacios ni comillas extra
- Re-deploy después de agregar variables

### Error: "GEMINI_API_KEY not found"
- Ir a Vercel Dashboard → Settings → Environment Variables
- Agregar `GEMINI_API_KEY` (marcada como Secret)
- Re-deploy

### Error: "Auth domain not authorized"
- Ir a Firebase Console → Authentication → Settings → Authorized domains
- Agregar: `fotocalorias.vercel.app` y `*.vercel.app` (wildcard para previews)

### Error 500 en API Route
- Revisar logs: Vercel Dashboard → Deployment → Functions
- Verificar que `GEMINI_API_KEY` esté configurada
- Verificar que la API key sea válida en [Google AI Studio](https://aistudio.google.com/apikey)

### Cambios no se reflejan
- Verificar que el commit esté pusheado: `git push`
- Esperar ~30 segundos para build automático
- Hard refresh: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)

---

## 🔄 GitHub Actions (CI/CD Avanzado)

Si quieres testing antes de deploy, crear `.github/workflows/test.yml`:

```yaml
name: Test Before Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${{ secrets.FIREBASE_STORAGE_BUCKET }}
          NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}
          NEXT_PUBLIC_FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

**Nota**: Vercel ya hace deploy automático, esto es solo para testing adicional.

---

## 📈 Monitoreo y Analytics

### Vercel Analytics (Gratis)

Habilitar en Vercel Dashboard:
1. **Analytics** tab
2. Click **Enable**
3. Agregar SDK (opcional):
   ```bash
   npm install @vercel/analytics
   ```
   
   En `app/layout.tsx`:
   ```typescript
   import { Analytics } from '@vercel/analytics/react';
   
   export default function RootLayout({ children }) {
     return (
       <html>
         <body>
           {children}
           <Analytics />
         </body>
       </html>
     );
   }
   ```

### Métricas Disponibles
- Page views
- Top pages
- Top referrers
- Device breakdown
- Real-time visitors

---

## 🛠️ Comandos de Mantenimiento

```bash
# Ver deployments
vercel ls

# Ver logs de producción
vercel logs https://fotocalorias.vercel.app

# Rollback a versión anterior
vercel rollback https://fotocalorias.vercel.app

# Eliminar deployment
vercel rm <deployment-url>

# Ver configuración
vercel env ls

# Agregar variable de entorno
vercel env add NOMBRE_VARIABLE
```

---

## 🎓 Recursos Adicionales

- [Vercel Docs](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Custom Domains](https://vercel.com/docs/concepts/projects/domains)
- [Vercel CLI](https://vercel.com/docs/cli)

---

## 💰 Upgrade a Pro (Si Necesitas)

**Solo considera Pro si**:
- Necesitas más de 100 GB bandwidth/mes
- Quieres colaboradores en el equipo
- Necesitas Web Analytics avanzado
- Quieres Password Protection en previews

**Precio**: $20/mes (por usuario)

**Para FotoCalorías**: Plan gratuito es más que suficiente.

---

**Última actualización**: 19 de noviembre de 2025

**Resumen**: Vercel es la mejor opción para desplegar Next.js. Es gratis, automático, y mucho más poderoso que Firebase Hosting para este proyecto. 🚀
