"use client";

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  addDoc, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc,
  doc,
  setDoc,
  query,
  orderBy,
  where,
  updateDoc,
  deleteField
} from 'firebase/firestore';
import { Camera, Check, Trash2, Loader2, Pizza, LogOut, Settings, X, ChevronLeft, ChevronRight, Calendar, Droplet, Activity } from 'lucide-react';
import { UserProfile, MacroTargets, calculateDailyProgress } from '@/lib/calorie-calculator';
import AuthForm from './components/AuthForm';
import ProfileSetup from './components/ProfileSetup';
import ProgressDashboard from './components/ProgressDashboard';
import imageCompression from 'browser-image-compression';

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicialización segura para Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

// Habilitar Offline Persistence de FireStore
let db: ReturnType<typeof getFirestore>;

if (!getApps().length || getApps()[0].name === "[DEFAULT]") {
  // Solo inicializar con caché si estamos en el cliente y es la primera vez
  if (typeof window !== 'undefined' && !getApps().length) {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
    });
  } else {
    db = getFirestore(app);
  }
} else {
  db = getFirestore(app);
}

// --- TIPOS ---
interface NutritionData {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  sodium?: number;
  confidence?: string;
  detected_items?: string[];
  portion_note?: string;
  error?: string;
  nova_group?: number;
  nova_reason?: string;
}

interface CalorieLog extends NutritionData {
  id: string;
  createdAt: any;
  imagePreview?: string;
  meal_type?: 'desayuno' | 'almuerzo' | 'cena' | 'snack';
}

interface UserData {
  email: string;
  displayName: string;
  profile?: UserProfile;
  targets?: MacroTargets;
  createdAt: any;
  updatedAt: any;
  googleFitTokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

// --- FUNCIÓN PARA ANALIZAR IMAGEN ---
async function analyzeImageWithGemini(
  base64Image: string, 
  mimeType: string = 'image/jpeg',
  rateLimitCheck: () => boolean,
  portionContext: string = ''
): Promise<NutritionData | null> {
  try {
    // Verificar rate limit antes de hacer la petición
    if (!rateLimitCheck()) {
      throw new Error('⏱️ Demasiadas peticiones. Espera un momento antes de analizar otra imagen (límite: 15 por minuto)');
    }

    console.log('🚀 =================================');
    console.log('📤 NUEVA PETICIÓN A GEMINI API');
    console.log('🕐 Timestamp:', new Date().toISOString());
    console.log('📊 Tipo MIME:', mimeType);
    console.log('📏 Tamaño base64:', base64Image.length, 'caracteres');
    console.log('🚀 =================================');
    
    const response = await fetch('/api/analyze-food', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        mimeType: mimeType,
        portionContext: portionContext
      })
    });

    console.log('📥 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Error response:', errorData);
      throw new Error(errorData.error || 'Error al analizar la imagen');
    }

    const result = await response.json();
    console.log('✅ Resultado de Gemini:', result);
    
    if (result.error) {
      console.warn('⚠️ Gemini reportó error:', result.error);
      return null;
    }

    console.log('🎉 Análisis exitoso:', result.food_name);
    return result;

  } catch (error) {
    console.error("❌ Error analizando imagen:", error);
    throw error; // Re-lanzar el error para que se capture arriba
  }
}

// --- FUNCIÓN PARA ANALIZAR TEXTO ---
async function analyzeTextWithGemini(
  description: string,
  rateLimitCheck: () => boolean
): Promise<NutritionData | null> {
  try {
    // Verificar rate limit antes de hacer la petición
    if (!rateLimitCheck()) {
      throw new Error('⏱️ Demasiadas peticiones. Espera un momento antes de analizar otro alimento (límite: 15 por minuto)');
    }

    console.log('🚀 =================================');
    console.log('📤 NUEVA PETICIÓN DE TEXTO A GEMINI API');
    console.log('🕐 Timestamp:', new Date().toISOString());
    console.log('📝 Descripción:', description);
    console.log('🚀 =================================');
    
    const response = await fetch('/api/analyze-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: description
      })
    });

    console.log('📥 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Error response:', errorData);
      throw new Error(errorData.error || 'Error al analizar el texto');
    }

    const result = await response.json();
    console.log('✅ Resultado de Gemini:', result);
    
    if (result.error) {
      console.warn('⚠️ Gemini reportó error:', result.error);
      return null;
    }

    console.log('🎉 Análisis exitoso:', result.food_name);
    return result;

  } catch (error) {
    console.error("❌ Error analizando texto:", error);
    throw error;
  }
}

// --- COMPONENTES UI ---
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-4 ${className}`}>
    {children}
  </div>
);

const Button = ({ 
  onClick, 
  children, 
  variant = 'primary', 
  className = "", 
  disabled = false,
  type = 'button'
}: { 
  onClick?: () => void; 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => {
  const baseStyles = "px-4 py-3 rounded-lg font-medium transition-all active:scale-95 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200 shadow-lg",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    outline: "border-2 border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-500"
  };

  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

// --- FUNCIÓN HELPER PARA OBTENER EMOJI DE COMIDA ---
function getFoodEmoji(foodName: string): string {
  if (!foodName) return '🍽️';
  const name = foodName.toLowerCase();
  if (name.includes('ensalada') || name.includes('salad') || name.includes('verdura') || name.includes('vegetal') || name.includes('brocoli') || name.includes('brócoli')) return '🥗';
  if (name.includes('carne') || name.includes('pollo') || name.includes('res') || name.includes('puerco') || name.includes('cerdo') || name.includes('steak') || name.includes('pechuga')) return '🍗';
  if (name.includes('pescado') || name.includes('fish') || name.includes('salmon') || name.includes('salmón') || name.includes('atun') || name.includes('atún') || name.includes('marisco')) return '🐟';
  if (name.includes('huevo') || name.includes('egg') || name.includes('omelet')) return '🍳';
  if (name.includes('fruta') || name.includes('manzana') || name.includes('platano') || name.includes('plátano') || name.includes('fresa') || name.includes('banana') || name.includes('naranja')) return '🍎';
  if (name.includes('agua') || name.includes('drink') || name.includes('jugo') || name.includes('refresco') || name.includes('bebida') || name.includes('licuado') || name.includes('café') || name.includes('cafe') || name.includes('té') || name.includes('te')) return '🥤';
  if (name.includes('arroz') || name.includes('rice') || name.includes('sushi')) return '🍚';
  if (name.includes('pan') || name.includes('bread') || name.includes('cereal') || name.includes('avena') || name.includes('galleta') || name.includes('toast')) return '🍞';
  if (name.includes('pizza')) return '🍕';
  if (name.includes('taco') || name.includes('quesadilla') || name.includes('burrito') || name.includes('fajita')) return '🌮';
  if (name.includes('hamburguesa') || name.includes('burger')) return '🍔';
  if (name.includes('postre') || name.includes('pastel') || name.includes('chocolate') || name.includes('dulce') || name.includes('helado') || name.includes('flan')) return '🍩';
  if (name.includes('pasta') || name.includes('espagueti') || name.includes('spaghetti') || name.includes('tallarines')) return '🍝';
  if (name.includes('sopa') || name.includes('caldo') || name.includes('ramen')) return '🍜';
  if (name.includes('queso') || name.includes('cheese')) return '🧀';
  if (name.includes('leche') || name.includes('yogur') || name.includes('yogurt') || name.includes('milk')) return '🥛';
  if (name.includes('nuez') || name.includes('nueces') || name.includes('almendra') || name.includes('cacahuate') || name.includes('maní')) return '🥜';
  return '🍽️';
}

function getDefaultMealType(): 'desayuno' | 'almuerzo' | 'cena' | 'snack' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'desayuno';
  if (hour >= 12 && hour < 18) return 'almuerzo';
  if (hour >= 18 && hour < 24) return 'cena';
  return 'snack';
}

// --- PÁGINA PRINCIPAL ---
export default function Home() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [logs, setLogs] = useState<CalorieLog[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<NutritionData | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para modo invitado
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestAnalysisResult, setGuestAnalysisResult] = useState<NutritionData | null>(null);
  const [guestPreviewImage, setGuestPreviewImage] = useState<string | null>(null);
  const [isGuestAnalyzing, setIsGuestAnalyzing] = useState(false);
  const guestFileInputRef = useRef<HTMLInputElement>(null);
  const guestCameraInputRef = useRef<HTMLInputElement>(null);
  
  // Estados de contexto de porción
  const [portionContext, setPortionContext] = useState('');
  const [guestPortionContext, setGuestPortionContext] = useState('');
  const [pendingBase64, setPendingBase64] = useState<string | null>(null);
  const [pendingMimeType, setPendingMimeType] = useState<string | null>(null);
  const [guestPendingBase64, setGuestPendingBase64] = useState<string | null>(null);
  const [guestPendingMimeType, setGuestPendingMimeType] = useState<string | null>(null);
  
  // Estado para modal de selección
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showGuestImagePickerModal, setShowGuestImagePickerModal] = useState(false);
  
  // Estados para descripción por texto
  const [showTextInputModal, setShowTextInputModal] = useState(false);
  const [showGuestTextInputModal, setShowGuestTextInputModal] = useState(false);
  const [foodDescription, setFoodDescription] = useState('');
  const [isAnalyzingText, setIsAnalyzingText] = useState(false);

  // Estados de Pacing de comidas e Hidratación
  const [selectedMealType, setSelectedMealType] = useState<'desayuno' | 'almuerzo' | 'cena' | 'snack'>('desayuno');
  const [guestSelectedMealType, setGuestSelectedMealType] = useState<'desayuno' | 'almuerzo' | 'cena' | 'snack'>('desayuno');
  const [waterIntake, setWaterIntake] = useState<number>(0);
  const [guestWaterIntake, setGuestWaterIntake] = useState<number>(0);

  // Estados de Google Fit
  const [caloriesBurned, setCaloriesBurned] = useState<number>(0);
  const [isSyncingFit, setIsSyncingFit] = useState(false);
  const [googleFitDebug, setGoogleFitDebug] = useState<string | null>(null);

  // Estados para entrada manual (cuando la IA falla o se acaban los tokens)
  const [showManualInputModal, setShowManualInputModal] = useState(false);
  const [manualEntry, setManualEntry] = useState<Partial<NutritionData>>({
    food_name: '', calories: 0, protein: 0, carbs: 0, fat: 0
  });

  // Estado para filtrado por fecha
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Estado de carga inicial
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Rate limiting para Gemini (15 peticiones por minuto máximo)
  const lastRequestTime = useRef<number>(0);
  const requestCount = useRef<number>(0);
  const requestTimestamps = useRef<number[]>([]);

  // Ref para controlar cuándo la hidratación se cambia manualmente y evitar bucles/sincronizaciones en la carga inicial o cambio de fecha
  const isManualChangeRef = useRef<boolean>(false);

  // Autenticación
  useEffect(() => {
    console.log('🔵 Inicializando autenticación...');
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log('👤 Estado de autenticación:', u ? `Usuario: ${u.email}` : 'Sin usuario');
      setUser(u);
      setIsInitializing(false);
    });
    return () => {
      console.log('🔴 Limpiando listener de autenticación');
      unsubscribe();
    };
  }, []);

  // Cargar datos del usuario
  useEffect(() => {
    if (!user) {
      setUserData(null);
      return;
    }

    console.log('📊 Configurando listener para datos de usuario:', user.uid);
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      console.log('📝 Datos de usuario recibidos:', snapshot.exists() ? 'Documento existe' : 'Documento no existe');
      if (snapshot.exists()) {
        setUserData(snapshot.data() as UserData);
        // Si no tiene perfil configurado, mostrar setup
        if (!snapshot.data().profile || !snapshot.data().targets) {
          setShowProfileSetup(true);
        }
      } else {
        // Crear documento de usuario si no existe
        console.log('✨ Creando documento de usuario nuevo');
        const newUserData: UserData = {
          email: user.email || '',
          displayName: user.displayName || 'Usuario',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        setDoc(userDocRef, newUserData).then(() => {
          console.log('✅ Documento de usuario creado');
        }).catch((error) => {
          console.error('❌ Error al crear documento de usuario:', error);
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Cargar logs de calorías
  useEffect(() => {
    if (!user) {
      setLogs([]);
      return;
    }

    console.log('🍔 Configurando listener para logs de calorías');
    const logsRef = collection(db, 'users', user.uid, 'calorie_logs');
    
    const q = query(
      logsRef,
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`📄 Logs recibidos: ${snapshot.docs.length} documentos`);
      const logsData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as CalorieLog[];
      
      // Filtrar solo los de la fecha seleccionada
      const filteredLogs = logsData.filter(log => {
        if (!log.createdAt) return false;
        
        let logDate: Date;
        if (log.createdAt.toDate) {
          // Es un Timestamp de cliente o servidor
          logDate = log.createdAt.toDate();
        } else if (log.createdAt.seconds) {
          // Backup si llega en raw format
          logDate = new Date(log.createdAt.seconds * 1000);
        } else {
          // Backup extremo para timestamp recién creado en cliente que aún no sincronizó
          logDate = new Date();
        }

        return logDate.toDateString() === selectedDate.toDateString();
      });

      console.log(`✅ Logs para ${selectedDate.toLocaleDateString()}: ${filteredLogs.length}`);
      setLogs(filteredLogs);
    });

    return () => unsubscribe();
  }, [user, selectedDate]);

  // Cargar logs de hidratación
  useEffect(() => {
    if (!user) {
      setWaterIntake(0);
      return;
    }

    const dateString = selectedDate.toISOString().split('T')[0];
    console.log('💧 Configurando listener para hidratación:', dateString);
    const hydrationDocRef = doc(db, 'users', user.uid, 'hydration_logs', dateString);
    
    const unsubscribe = onSnapshot(hydrationDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setWaterIntake(data.amount || 0);
      } else {
        setWaterIntake(0);
      }
    });

    return () => unsubscribe();
  }, [user, selectedDate]);

  // Actualizar categoría por defecto de comida cuando se abre un análisis
  useEffect(() => {
    if (previewImage) {
      setSelectedMealType(getDefaultMealType());
    }
  }, [previewImage]);

  useEffect(() => {
    if (guestPreviewImage || guestAnalysisResult) {
      setGuestSelectedMealType(getDefaultMealType());
    }
  }, [guestPreviewImage, guestAnalysisResult]);

  const hydrationTarget = userData?.profile?.weight 
    ? Math.round(userData.profile.weight * 35) 
    : 2000;

  const renderHydrationCard = (isGuest: boolean) => {
    const currentWater = isGuest ? guestWaterIntake : waterIntake;
    const target = hydrationTarget;
    const pct = target > 0 ? Math.round((currentWater / target) * 100) : 0;
    
    return (
      <Card className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-500/10 p-2 rounded-lg">
              <Droplet className="w-5 h-5 text-blue-500 fill-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Registro de Hidratación</h3>
              <p className="text-[11px] text-slate-500">Mantén tu cuerpo activo e hidratado</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-slate-800">{currentWater}</span>
            <span className="text-xs text-slate-500"> / {target} ml</span>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>

        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="text-xs font-bold text-blue-600">
            {currentWater >= target ? '💧 ¡Meta cumplida! ¡Buen trabajo!' : `${Math.max(0, target - currentWater)} ml restantes`}
          </div>
          
          <div className="flex gap-1">
            <button 
              onClick={() => updateHydration(-250)}
              className="px-2 py-1 border border-slate-200 text-slate-500 text-[10px] font-bold rounded hover:bg-slate-50 transition-colors"
              title="Restar 250ml"
            >
              -250
            </button>
            <button 
              onClick={() => updateHydration(250)}
              className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded hover:bg-blue-100 transition-colors"
            >
              +250 ml 🥛
            </button>
            <button 
              onClick={() => updateHydration(500)}
              className="px-2.5 py-1 bg-blue-500 text-white text-[10px] font-bold rounded hover:bg-blue-600 transition-colors shadow-sm shadow-blue-200"
            >
              +500 ml 🥤
            </button>
          </div>
        </div>
      </Card>
    );
  };

  // --- GOOGLE FIT INTEGRATION ---

  // Escuchar mensajes del popup de Google Fit
  useEffect(() => {
    const handleAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'GOOGLE_FIT_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        console.log('🔑 Tokens de Google Fit recibidos:', tokens);
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          try {
            await updateDoc(userDocRef, {
              googleFitTokens: tokens,
              updatedAt: serverTimestamp()
            });
            alert('¡Google Fit conectado exitosamente!');
            syncGoogleFit(selectedDate, tokens);
          } catch (err) {
            console.error('Error al guardar tokens de Google Fit:', err);
            alert('Error al guardar la conexión con Google Fit.');
          }
        }
      } else if (event.data?.type === 'GOOGLE_FIT_AUTH_ERROR') {
        console.error('❌ Error de Google Fit Auth:', event.data.error);
        alert(`Error al conectar con Google Fit: ${event.data.error}`);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [user, selectedDate, userData?.googleFitTokens]);

  // Cargar logs de actividad (Google Fit) de Firestore
  useEffect(() => {
    if (!user) {
      setCaloriesBurned(0);
      return;
    }

    const dateString = selectedDate.toISOString().split('T')[0];
    console.log('🔥 Configurando listener para actividad (Google Fit):', dateString);
    const activityDocRef = doc(db, 'users', user.uid, 'activity_logs', dateString);
    
    const unsubscribe = onSnapshot(activityDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCaloriesBurned(data.caloriesBurned || 0);
      } else {
        setCaloriesBurned(0);
      }
    });

    return () => unsubscribe();
  }, [user, selectedDate]);

  // Obtener un access token válido de Google Fit, refrescándolo de ser necesario
  const getValidAccessToken = async (tokens: { accessToken: string; refreshToken: string; expiresAt: number }) => {
    // Si expira en menos de un minuto, lo refrescamos
    if (Date.now() < tokens.expiresAt - 60000) {
      return tokens.accessToken;
    }

    console.log('🔄 Token de Google Fit expirado o por expirar. Refrescando...');
    try {
      const response = await fetch('/api/auth/google-fit/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken })
      });

      if (!response.ok) {
        throw new Error('Error al llamar al endpoint de refresco de Google Fit');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // Guardar nuevos tokens en Firestore
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          'googleFitTokens.accessToken': data.accessToken,
          ...(data.refreshToken ? { 'googleFitTokens.refreshToken': data.refreshToken } : {}),
          'googleFitTokens.expiresAt': data.expiresAt,
          updatedAt: serverTimestamp()
        });
      }

      return data.accessToken;
    } catch (err) {
      console.error('❌ Error al refrescar token de Google Fit:', err);
      throw err;
    }
  };

  // Sincronizar calorías quemadas desde la API de Google Fit
  const syncGoogleFit = async (date: Date, tokens: { accessToken: string; refreshToken: string; expiresAt: number }) => {
    if (!user) return;
    setIsSyncingFit(true);
    try {
      const validToken = await getValidAccessToken(tokens);
      
      const dateString = date.toISOString().split('T')[0];
      
      // Calcular límites de tiempo para la fecha seleccionada en milisegundos
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const startTimeMillis = startOfDay.getTime();

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const endTimeMillis = endOfDay.getTime();

      // 1. Fetch calories bucketed by Activity Segment
      // Esto nos permite ver los bloques de actividad (caminar, correr, etc.) y las calorías quemadas en cada bloque
      const expendedResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: 'com.google.calories.expended' }],
          bucketByActivitySegment: { minDurationMillis: 60000 },
          startTimeMillis,
          endTimeMillis
        })
      });

      if (!expendedResponse.ok) {
        const errorBody = await expendedResponse.text();
        throw new Error(`Error HTTP de Google Fit (Expended): ${expendedResponse.status} - ${errorBody}`);
      }
      const expendedData = await expendedResponse.json();

      console.log(`📦 Calorías por Actividad:`, JSON.stringify(expendedData, null, 2));
      setGoogleFitDebug(JSON.stringify(expendedData, null, 2));
      
      let activeCalories = 0;

      // Lista de códigos de actividad de Google Fit que representan inactividad
      // 0: In vehicle, 3: Still, 4: Unknown, 72-112: Sleeping variants
      const INACTIVE_ACTIVITIES = [0, 3, 4, 72, 73, 74, 75, 76, 109, 110, 111, 112];

      if (expendedData.bucket) {
        for (const bucket of expendedData.bucket) {
          const activityType = bucket.activity;
          
          // Si es una actividad real (caminar, correr, bici, etc.)
          if (typeof activityType === 'number' && !INACTIVE_ACTIVITIES.includes(activityType)) {
            if (bucket.dataset) {
              for (const dataset of bucket.dataset) {
                if (dataset.point) {
                  for (const point of dataset.point) {
                    if (point.value) {
                      for (const val of point.value) {
                        activeCalories += typeof val.fpVal === 'number' ? val.fpVal : (typeof val.intVal === 'number' ? val.intVal : 0);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      const roundedCalories = Math.round(activeCalories * 10) / 10;
      const activityDocRef = doc(db, 'users', user.uid, 'activity_logs', dateString);
      
      await setDoc(activityDocRef, {
        caloriesBurned: roundedCalories,
        updatedAt: serverTimestamp()
      }, { merge: true });

      console.log(`🔥 Sincronización exitosa con Google Fit para ${dateString}: ${roundedCalories} kcal`);
    } catch (err) {
      console.error('❌ Error al sincronizar con Google Fit:', err);
    } finally {
      setIsSyncingFit(false);
    }
  };

  // Asegurar que exista el origen de datos de nutrición en Google Fit
  const ensureNutritionDataSource = async (accessToken: string): Promise<string> => {
    try {
      // 1. Listar los orígenes de datos existentes para encontrar el nuestro
      const listResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources?dataTypeName=com.google.nutrition', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (listResponse.ok) {
        const listData = await listResponse.json();
        const existing = listData.dataSource?.find((ds: any) => ds.dataStreamName === 'xcal_nutrition');
        if (existing && existing.dataStreamId) {
          return existing.dataStreamId;
        }
      }
      
      // 2. Si no existe, lo creamos
      console.log('🌱 Creando origen de datos de nutrición en Google Fit...');
      const createResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataStreamName: 'xcal_nutrition',
          type: 'raw',
          application: {
            name: 'xCal'
          },
          dataType: {
            name: 'com.google.nutrition',
            field: [
              { name: 'nutrients', format: 'map' },
              { name: 'meal_type', format: 'integer' },
              { name: 'food_item', format: 'string' }
            ]
          }
        })
      });
      
      if (!createResponse.ok) {
        const errText = await createResponse.text();
        throw new Error(`Error al crear origen de datos: ${createResponse.status} - ${errText}`);
      }
      
      const data = await createResponse.json();
      return data.dataStreamId; // Google Fit retorna dataStreamId, no dataSourceId
    } catch (err) {
      console.error('❌ Error asegurando origen de datos de nutrición:', err);
      throw err;
    }
  };

  // Sincronizar alimentos/nutrición a Google Fit
  const syncNutritionToGoogleFit = async (
    dayLogs: CalorieLog[],
    date: Date,
    tokens: { accessToken: string; refreshToken: string; expiresAt: number }
  ) => {
    if (!user) return;
    try {
      const validToken = await getValidAccessToken(tokens);
      const dataSourceId = await ensureNutritionDataSource(validToken);
      
      // Calcular límites de tiempo en milisegundos y nanosegundos
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const startTimeMillis = startOfDay.getTime();

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const endTimeMillis = endOfDay.getTime();

      const datasetId = `${startTimeMillis * 1000000}-${endTimeMillis * 1000000}`;
      
      // Mapear cada log de calorías a un punto de datos de Google Fit
      const points = dayLogs.map((log, index) => {
        // Usar la fecha de creación del log si está disponible, de lo contrario distribuir en el día
        let logTimeMillis = startTimeMillis + (index * 60000); // Espaciar por 1 minuto
        if (log.createdAt && typeof log.createdAt.toMillis === 'function') {
          logTimeMillis = log.createdAt.toMillis();
        } else if (log.createdAt && typeof log.createdAt.seconds === 'number') {
          logTimeMillis = log.createdAt.seconds * 1000;
        }

        const nutrientsMap: Array<{ key: string; value: { fpVal: number } }> = [
          { key: 'calories', value: { fpVal: log.calories || 0 } }
        ];

        if (log.protein) nutrientsMap.push({ key: 'protein', value: { fpVal: log.protein } });
        if (log.carbs) nutrientsMap.push({ key: 'carbs.total', value: { fpVal: log.carbs } });
        if (log.fat) nutrientsMap.push({ key: 'fat.total', value: { fpVal: log.fat } });
        if (log.sugar) nutrientsMap.push({ key: 'sugar', value: { fpVal: log.sugar } });
        if (log.fiber) nutrientsMap.push({ key: 'dietary_fiber', value: { fpVal: log.fiber } });
        // Sodium en Google Fit se mide en GRAMOS. En la app se registra en miligramos (mg), por lo que dividimos entre 1000.
        if (log.sodium) nutrientsMap.push({ key: 'sodium', value: { fpVal: log.sodium / 1000 } });

        // Mapear tipo de comida
        let mealTypeVal = 0; // desconocido
        if (log.meal_type === 'desayuno') mealTypeVal = 1;
        else if (log.meal_type === 'almuerzo') mealTypeVal = 2;
        else if (log.meal_type === 'cena') mealTypeVal = 3;
        else if (log.meal_type === 'snack') mealTypeVal = 4;

        return {
          startTimeNanos: logTimeMillis * 1000000,
          endTimeNanos: (logTimeMillis + 1000) * 1000000, // Duración de 1 segundo
          dataTypeName: 'com.google.nutrition',
          value: [
            { mapVal: nutrientsMap },
            { intVal: mealTypeVal },
            { strVal: log.food_name || 'Alimento' }
          ]
        };
      });

      const response = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataSources/${dataSourceId}/datasets/${datasetId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataSourceId,
          minStartTimeNs: startTimeMillis * 1000000,
          maxEndTimeNs: endTimeMillis * 1000000,
          point: points
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error HTTP al sincronizar comida: ${response.status} - ${errorText}`);
      }

      console.log(`🍎 Sincronizados exitosamente ${points.length} alimentos con Google Fit para el día ${date.toISOString().split('T')[0]}`);
    } catch (err) {
      console.error('❌ Error al sincronizar alimentos con Google Fit:', err);
    }
  };

  // Asegurar que exista el origen de datos de hidratación en Google Fit
  const ensureHydrationDataSource = async (accessToken: string): Promise<string> => {
    try {
      const listResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources?dataTypeName=com.google.hydration', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (listResponse.ok) {
        const listData = await listResponse.json();
        const existing = listData.dataSource?.find((ds: any) => ds.dataStreamName === 'xcal_hydration');
        if (existing && existing.dataStreamId) {
          return existing.dataStreamId;
        }
      }
      
      console.log('💧 Creando origen de datos de hidratación en Google Fit...');
      const createResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataStreamName: 'xcal_hydration',
          type: 'raw',
          application: { name: 'xCal' },
          dataType: {
            name: 'com.google.hydration',
            field: [{ name: 'volume', format: 'floatPoint' }]
          }
        })
      });
      
      if (!createResponse.ok) {
        const errText = await createResponse.text();
        throw new Error(`Error al crear origen de datos de hidratación: ${createResponse.status} - ${errText}`);
      }
      
      const data = await createResponse.json();
      return data.dataStreamId;
    } catch (err) {
      console.error('❌ Error asegurando origen de datos de hidratación:', err);
      throw err;
    }
  };

  // Sincronizar hidratación a Google Fit
  const syncHydrationToGoogleFit = async (
    waterMl: number,
    date: Date,
    tokens: { accessToken: string; refreshToken: string; expiresAt: number }
  ) => {
    if (!user) return;
    try {
      const validToken = await getValidAccessToken(tokens);
      const dataSourceId = await ensureHydrationDataSource(validToken);
      
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const startTimeMillis = startOfDay.getTime();

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Para evitar que Google Fit sume de forma duplicada o acumulativa la hidratación
      // debido a cambios constantes en el timestamp de fin (Date.now()), usamos un rango fijo y constante
      // para el punto de ese día (de 00:00:00 a 00:00:01). De esta forma, Google Fit sobrescribirá
      // siempre el punto anterior para ese día en lugar de crear puntos nuevos.
      // Nos aseguramos de que no esté en el futuro limitándolo a Date.now().
      const pointStartTime = startTimeMillis;
      const pointEndTime = Math.min(startTimeMillis + 1000, Date.now());

      const datasetId = `${startTimeMillis * 1000000}-${endOfDay.getTime() * 1000000}`;
      
      // En Google Fit la hidratación es en litros
      const volumeLiters = waterMl / 1000;

      const points = [{
        startTimeNanos: pointStartTime * 1000000,
        endTimeNanos: pointEndTime * 1000000,
        dataTypeName: 'com.google.hydration',
        value: [{ fpVal: volumeLiters }]
      }];

      const response = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataSources/${dataSourceId}/datasets/${datasetId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataSourceId,
          minStartTimeNs: startTimeMillis * 1000000,
          maxEndTimeNs: endOfDay.getTime() * 1000000,
          point: volumeLiters > 0 ? points : [] // Si es 0, enviamos array vacío para limpiar el día
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error HTTP al sincronizar agua: ${response.status} - ${errorText}`);
      }

      console.log(`💧 Sincronizados exitosamente ${volumeLiters} L de agua con Google Fit`);
    } catch (err) {
      console.error('❌ Error al sincronizar agua con Google Fit:', err);
    }
  };

  // Desconectar Google Fit
  const disconnectGoogleFit = async () => {
    if (!user) return;
    if (confirm('¿Estás seguro de que deseas desconectar tu cuenta de Google Fit?')) {
      const userDocRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userDocRef, {
          googleFitTokens: deleteField(),
          updatedAt: serverTimestamp()
        });
        setCaloriesBurned(0);
        alert('Google Fit desconectado correctamente.');
      } catch (err) {
        console.error('Error al desconectar Google Fit:', err);
        alert('Error al intentar desconectar.');
      }
    }
  };

  // Abrir popup de autorización
  const connectGoogleFit = () => {
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    window.open(
      '/api/auth/google-fit',
      'GoogleFitAuth',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );
  };

  // Auto-sincronización al cambiar fecha o al detectar tokens
  useEffect(() => {
    if (user && userData?.googleFitTokens) {
      syncGoogleFit(selectedDate, userData.googleFitTokens);
    }
  }, [user, selectedDate, userData?.googleFitTokens?.accessToken]);

  // Auto-sincronización de nutrición a Google Fit al cambiar logs o fecha
  useEffect(() => {
    if (user) {
      if (userData?.googleFitTokens) {
        syncNutritionToGoogleFit(logs, selectedDate, userData.googleFitTokens);
      }
      
      // Enviar datos a la Companion App nativa (si estamos dentro del WebView)
      if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({
          type: 'SYNC_NUTRITION',
          payload: { logs, dateStr: selectedDate.toISOString() }
        }));
      }
    }
  }, [user, logs, selectedDate, userData?.googleFitTokens?.accessToken]);

  // Auto-sincronización de hidratación a Google Fit al cambiar agua consumida o fecha
  useEffect(() => {
    if (user && waterIntake >= 0) {
      if (isManualChangeRef.current) {
        isManualChangeRef.current = false;
        if (userData?.googleFitTokens) {
          syncHydrationToGoogleFit(waterIntake, selectedDate, userData.googleFitTokens);
        }
      }
      
      // Enviar datos a la Companion App nativa (si estamos dentro del WebView)
      if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({
          type: 'SYNC_HYDRATION',
          payload: { waterMl: waterIntake, dateStr: selectedDate.toISOString() }
        }));
      }
    }
  }, [user, waterIntake, selectedDate, userData?.googleFitTokens?.accessToken]);

  // Renderizar la tarjeta de Google Fit
  const renderGoogleFitCard = () => {
    if (isGuestMode || !user) return null;

    const isConnected = !!userData?.googleFitTokens;

    return (
      <Card className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isConnected ? 'bg-orange-50 text-orange-500' : 'bg-slate-100 text-slate-400'}`}>
              <Activity className={`w-5 h-5 ${isConnected && isSyncingFit ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Google Fit</h3>
              <p className="text-[11px] text-slate-500">
                {isConnected ? 'Actividad sincronizada' : 'Vincula tu actividad física diaria'}
              </p>
            </div>
          </div>
          {isConnected && (
            <span className="text-[10px] font-semibold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
              Sincronizado
            </span>
          )}
        </div>

        {isConnected ? (
          <div className="flex flex-col gap-3">
            <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-sans">Calorías de ejercicio</div>
                <div className="text-lg font-extrabold text-slate-700 flex items-baseline gap-1">
                  <span>+{Math.round(caloriesBurned)}</span>
                  <span className="text-xs font-normal text-slate-500 font-sans">kcal</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => syncGoogleFit(selectedDate, userData.googleFitTokens!)}
                  disabled={isSyncingFit}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 rounded border border-slate-200 text-slate-600 font-bold text-[10px] transition-colors flex items-center gap-1 disabled:opacity-50"
                  title="Sincronizar ahora"
                >
                  {isSyncingFit ? (
                    <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
                  ) : (
                    <span>🔄</span>
                  )}
                  <span>Sincronizar</span>
                </button>
                <button
                  onClick={disconnectGoogleFit}
                  className="px-2 py-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded text-[10px] font-bold transition-colors"
                >
                  Desconectar
                </button>
              </div>
            </div>
            {googleFitDebug && (
              <div className="text-[9px] font-mono bg-slate-900 text-slate-300 p-3 rounded-lg overflow-x-auto max-h-48 border border-slate-800">
                <div className="font-bold text-[10px] text-orange-400 mb-1 flex justify-between items-center">
                  <span>RESPUESTA API (DEBUG):</span>
                  <button 
                    onClick={() => setGoogleFitDebug(null)}
                    className="text-slate-500 hover:text-white"
                  >
                    cerrar
                  </button>
                </div>
                <pre className="whitespace-pre-wrap">{googleFitDebug}</pre>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              Sincroniza los datos de tus pasos y entrenamientos de Google Fit para ajustar tu meta calórica diaria automáticamente y comer más cuando gastas energía.
            </p>
            <button
              onClick={connectGoogleFit}
              className="w-full py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded font-bold text-xs shadow-sm shadow-orange-500/10 transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
            >
              <Activity className="w-4 h-4" />
              Conectar Google Fit
            </button>
          </div>
        )}
      </Card>
    );
  };

  // --- HANDLERS ---
  const handleLogin = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const handleRegister = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName });
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleSaveProfile = async (profile: UserProfile, targets: MacroTargets) => {
    console.log('🔵 handleSaveProfile llamado');
    console.log('👤 Usuario actual:', user?.uid);
    
    if (!user) {
      console.error('❌ No hay usuario autenticado');
      return;
    }
    
    try {
      console.log('📝 Preparando documento para Firestore...');
      const userDocRef = doc(db, 'users', user.uid);
      console.log('📍 Referencia del documento:', userDocRef.path);
      
      const dataToSave = {
        profile,
        targets,
        updatedAt: serverTimestamp()
      };
      console.log('💾 Datos a guardar:', dataToSave);
      
      console.log('⏳ Guardando en Firestore...');
      await setDoc(userDocRef, dataToSave, { merge: true });
      console.log('✅ Datos guardados exitosamente en Firestore');
      
      setShowProfileSetup(false);
      console.log('🎉 Perfil configurado correctamente');
    } catch (error) {
      console.error('❌ Error al guardar en Firestore:', error);
      console.error('📋 Detalles del error:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error; // Re-lanzar para que ProfileSetup lo capture
    }
  };

  // Verificar rate limit (15 peticiones por minuto)
  const checkRateLimit = () => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Limpiar timestamps antiguos (más de 1 minuto)
    requestTimestamps.current = requestTimestamps.current.filter(ts => ts > oneMinuteAgo);
    
    // Si hay menos de 15 peticiones en el último minuto, permitir
    if (requestTimestamps.current.length < 15) {
      requestTimestamps.current.push(now);
      console.log(`✅ Rate limit OK: ${requestTimestamps.current.length}/15 peticiones en el último minuto`);
      return true;
    }
    
    console.warn(`⚠️ Rate limit alcanzado: ${requestTimestamps.current.length}/15 peticiones`);
    return false;
  };

  // Función para comprimir imagen a miniatura súper ligera antes de guardar en Firestore (evita límite de 1MB)
  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 120;
        const MAX_HEIGHT = 120;
        
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
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.4));
      };
      img.src = base64;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert('Por favor selecciona una imagen JPG, PNG o WebP');
        return;
      }

      // Validar tamaño
      if (file.size > 10 * 1024 * 1024) {
        alert('La imagen es demasiado grande. Máximo 10MB');
        return;
      }

      try {
        // Comprimir imagen usando browser-image-compression
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          initialQuality: 0.8
        };
        const compressedFile = await imageCompression(file, options);
        console.log(`Imagen original: ${(file.size/1024/1024).toFixed(2)} MB`);
        console.log(`Imagen comprimida: ${(compressedFile.size/1024/1024).toFixed(2)} MB`);

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64String = reader.result as string;
          
          // Mostrar modal con preview y pedir contexto antes de analizar
          setPreviewImage(base64String);
          setPendingBase64(base64String.split(',')[1]);
          setPendingMimeType(compressedFile.type);
          setAnalysisResult(null);
          setIsAnalyzing(false);
          setPortionContext(''); // Resetear contexto cada vez
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error('Error al comprimir la imagen:', error);
        alert('Error al procesar la imagen. Intenta de nuevo.');
      }
    }
    
    // Limpiar el input para permitir seleccionar la misma imagen de nuevo
    e.target.value = '';
  };

  const triggerAnalysis = () => {
    if (pendingBase64 && pendingMimeType) {
      analyzeImage(pendingBase64, pendingMimeType);
    }
  };

  const analyzeImage = async (base64: string, mimeType: string) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    try {
      const result = await analyzeImageWithGemini(base64, mimeType, checkRateLimit, portionContext);
      
      if (result && !result.error) {
        setAnalysisResult(result);
      } else {
        alert("No pudimos identificar comida. Intenta una foto más clara.");
        setPreviewImage(null);
      }
    } catch (error: any) {
      console.error('❌ Error:', error);
      alert(error.message || "Error al analizar la imagen. Intenta de nuevo.");
      setPreviewImage(null);
    }
    
    setIsAnalyzing(false);
  };

  const saveLog = async () => {
    if (!user || !analysisResult) return;
    try {
      console.log('💾 Guardando comida (sin imagen):', analysisResult.food_name);
      
      const docRef = await addDoc(collection(db, 'users', user.uid, 'calorie_logs'), {
        ...analysisResult,
        createdAt: serverTimestamp(),
        imagePreview: null, // No guardamos imagen para mantener la base de datos 100% gratuita
        meal_type: selectedMealType
      });
      console.log('✅ Comida guardada con ID:', docRef.id);
      
      // Limpiar estados
      setPreviewImage(null);
      setAnalysisResult(null);
      
      // Resetear inputs de archivo
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      
      alert("✅ Comida registrada correctamente");
    } catch (error: any) {
      console.error('❌ Error al guardar:', error);
      console.error('❌ Detalles del error:', error?.message, error?.code);
      alert("❌ Error al guardar. Intenta de nuevo.");
    }
  };

  const deleteLog = async (id: string) => {
    if (confirm("¿Borrar este registro?")) {
      await deleteDoc(doc(db, 'users', user!.uid, 'calorie_logs', id));
    }
  };

  const updateHydration = async (amountChange: number) => {
    if (!user) {
      // Modo invitado
      setGuestWaterIntake(prev => Math.max(0, prev + amountChange));
      return;
    }
    
    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      const hydrationDocRef = doc(db, 'users', user.uid, 'hydration_logs', dateString);
      const newAmount = Math.max(0, waterIntake + amountChange);
      
      // Marcar que este cambio es manual para que el useEffect lo sincronice a Google Fit
      isManualChangeRef.current = true;
      
      await setDoc(hydrationDocRef, {
        amount: newAmount,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log(`💧 Hidratación actualizada a ${newAmount} ml`);
    } catch (error) {
      console.error('❌ Error al actualizar hidratación:', error);
      alert('Error al registrar el agua. Intenta de nuevo.');
    }
  };

  // Analizar texto (usuario autenticado)
  const handleTextSubmit = async () => {
    if (!foodDescription.trim()) {
      alert('Por favor describe el alimento');
      return;
    }

    setIsAnalyzingText(true);
    setShowTextInputModal(false);
    setIsAnalyzing(true); // Activar estado de análisis para mostrar loading
    setPreviewImage('text'); // Marcador para indicar que es análisis de texto

    try {
      const result = await analyzeTextWithGemini(foodDescription.trim(), checkRateLimit);
      
      if (result && !result.error) {
        setAnalysisResult(result);
      } else {
        alert("No se pudo identificar el alimento. Intenta ser más específico.");
        setPreviewImage(null);
      }
    } catch (error: any) {
      console.error('❌ Error:', error);
      alert(error.message || "Error al analizar el texto. Intenta de nuevo.");
      setPreviewImage(null);
    } finally {
      setIsAnalyzingText(false);
      setIsAnalyzing(false); // Desactivar loading
      setFoodDescription('');
    }
  };

  const handleManualSubmit = () => {
    if (!manualEntry.food_name) {
      alert("Por favor, ingresa el nombre de la comida");
      return;
    }
    
    // Crear el resultado directamente
    setAnalysisResult({
      food_name: manualEntry.food_name || 'Comida Manual',
      calories: manualEntry.calories || 0,
      protein: manualEntry.protein || 0,
      carbs: manualEntry.carbs || 0,
      fat: manualEntry.fat || 0,
      confidence: 'Alta'
    });
    
    setShowManualInputModal(false);
    setPreviewImage('text');
  };

  // Analizar texto (modo invitado)
  const handleGuestTextSubmit = async () => {
    if (!foodDescription.trim()) {
      alert('Por favor describe el alimento');
      return;
    }

    setIsAnalyzingText(true);
    setShowGuestTextInputModal(false);
    setIsGuestAnalyzing(true);
    setGuestPreviewImage('text');

    try {
      const result = await analyzeTextWithGemini(foodDescription.trim(), checkRateLimit);
      
      if (result && !result.error) {
        setGuestAnalysisResult(result);
      } else {
        alert("No se pudo identificar el alimento. Intenta ser más específico.");
        setGuestPreviewImage(null);
      }
    } catch (error: any) {
      console.error('❌ Error:', error);
      alert(error.message || "Error al analizar el texto. Intenta de nuevo.");
      setGuestPreviewImage(null);
    } finally {
      setIsAnalyzingText(false);
      setIsGuestAnalyzing(false);
      setFoodDescription('');
    }
  };

  // Calcular totales del día
  const totals = logs.reduce((acc, curr) => ({
    calories: acc.calories + (curr.calories || 0),
    protein: acc.protein + (curr.protein || 0),
    carbs: acc.carbs + (curr.carbs || 0),
    fat: acc.fat + (curr.fat || 0),
    sugar: acc.sugar + (curr.sugar || 0),
    fiber: acc.fiber + (curr.fiber || 0),
    sodium: acc.sodium + (curr.sodium || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0, sodium: 0 });

  // Calcular progreso si hay targets, ajustando la meta con las calorías quemadas por Google Fit
  const adjustedTargets = userData?.targets 
    ? {
        ...userData.targets,
        calories: userData.targets.calories + (userData.googleFitTokens ? caloriesBurned : 0)
      }
    : null;

  const progress = adjustedTargets 
    ? calculateDailyProgress(totals, adjustedTargets)
    : null;

  // Handler para modo invitado
  const handleGuestFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert('Por favor selecciona una imagen JPG, PNG o WebP');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('La imagen es demasiado grande. Máximo 10MB');
        return;
      }

      try {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          initialQuality: 0.8
        };
        const compressedFile = await imageCompression(file, options);
        console.log(`Imagen invitado original: ${(file.size/1024/1024).toFixed(2)} MB`);
        console.log(`Imagen invitado comprimida: ${(compressedFile.size/1024/1024).toFixed(2)} MB`);

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setGuestPreviewImage(base64String);
          setGuestPendingBase64(base64String.split(',')[1]);
          setGuestPendingMimeType(compressedFile.type);
          setGuestAnalysisResult(null);
          setIsGuestAnalyzing(false);
          setGuestPortionContext('');
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error('Error al comprimir la imagen:', error);
        alert('Error al procesar la imagen. Intenta de nuevo.');
      }
    }
    
    // Limpiar el input para permitir seleccionar la misma imagen de nuevo
    e.target.value = '';
  };

  const triggerGuestAnalysis = () => {
    if (guestPendingBase64 && guestPendingMimeType) {
      analyzeGuestImage(guestPendingBase64, guestPendingMimeType);
    }
  };

  const analyzeGuestImage = async (base64: string, mimeType: string) => {
    setIsGuestAnalyzing(true);
    setGuestAnalysisResult(null);
    
    try {
      const result = await analyzeImageWithGemini(base64, mimeType, checkRateLimit, guestPortionContext);
      
      if (result && !result.error) {
        setGuestAnalysisResult(result);
      } else {
        alert("No pudimos identificar comida. Intenta una foto más clara.");
        setGuestPreviewImage(null);
      }
    } catch (error: any) {
      console.error('❌ Error:', error);
      alert(error.message || "Error al analizar la imagen. Intenta de nuevo.");
      setGuestPreviewImage(null);
    }
    
    setIsGuestAnalyzing(false);
  };

  // Si no hay usuario, mostrar login o modo invitado
  if (!user && !isGuestMode) {
    return (
      <div className="relative">
        <AuthForm onLogin={handleLogin} onRegister={handleRegister} />
        <div className="fixed bottom-20 left-0 right-0 flex justify-center px-4">
          <Button 
            onClick={() => setIsGuestMode(true)}
            variant="outline"
            className="shadow-lg bg-white hover:bg-slate-50"
          >
            <Camera className="w-5 h-5" /> Probar como Invitado
          </Button>
        </div>
      </div>
    );
  }

  // Modo invitado
  if (isGuestMode && !user) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        {/* Header Invitado */}
        <header className="bg-white sticky top-0 z-10 border-b border-slate-200 px-4 py-4 shadow-sm">
          <div className="max-w-md mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 p-2 rounded-lg">
                <Pizza className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">xCal</h1>
                <p className="text-xs text-slate-500">Modo Invitado (solo análisis)</p>
              </div>
            </div>
            <Button
              onClick={() => setIsGuestMode(false)}
              variant="outline"
              className="text-xs px-3 py-1.5"
            >
              Iniciar Sesión
            </Button>
          </div>
        </header>

        <main className="max-w-md mx-auto p-4 space-y-6">
          {/* Info del Modo Invitado */}
          <Card className="bg-orange-50 border-orange-200">
            <div className="flex gap-3">
              <div className="text-3xl">👋</div>
              <div>
                <h3 className="font-bold text-slate-800 mb-1">Modo Invitado</h3>
                <p className="text-sm text-slate-600">
                  Escanea tu comida y obtén el análisis nutricional con IA. 
                  <strong> Los datos no se guardarán.</strong> Crea una cuenta para guardar tu progreso.
                </p>
              </div>
            </div>
          </Card>

          {/* Modal de Análisis Invitado */}
          {guestPreviewImage && (
            <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                {guestPreviewImage !== 'text' ? (
                  <div className="relative h-40 sm:h-48 bg-slate-100 flex-shrink-0">
                    <img src={guestPreviewImage} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => { setGuestPreviewImage(null); setGuestAnalysisResult(null); }}
                      className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="font-bold text-slate-800">Análisis de Comida</h3>
                    <button 
                      onClick={() => { setGuestPreviewImage(null); setGuestAnalysisResult(null); }}
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
                <div className="p-5 sm:p-6 flex-1 overflow-y-auto min-h-0 space-y-4">
                  {isGuestAnalyzing ? (
                    <div className="text-center py-8 space-y-4 my-auto">
                      <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
                      <p className="text-slate-600 font-medium animate-pulse">Analizando con IA...</p>
                    </div>
                  ) : guestAnalysisResult ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{guestAnalysisResult.food_name}</h3>
                        <p className="text-orange-500 font-bold text-lg">{guestAnalysisResult.calories} kcal</p>
                        {guestAnalysisResult.confidence && (
                          <p className="text-xs text-slate-500">Confianza: {guestAnalysisResult.confidence}</p>
                        )}
                      </div>
                      
                      {/* Clasificación NOVA */}
                      {guestAnalysisResult.nova_group && (
                        <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                          guestAnalysisResult.nova_group === 1 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                          guestAnalysisResult.nova_group === 2 ? 'bg-slate-50 border-slate-200 text-slate-800' :
                          guestAnalysisResult.nova_group === 3 ? 'bg-amber-50 border-amber-200 text-amber-900' :
                          'bg-rose-50 border-rose-200 text-rose-900'
                        }`}>
                          <div className="font-bold flex items-center gap-1.5 text-sm mb-0.5">
                            <span>
                              {guestAnalysisResult.nova_group === 1 ? '🟢' :
                               guestAnalysisResult.nova_group === 2 ? '⚪' :
                               guestAnalysisResult.nova_group === 3 ? '🟡' :
                               '🔴'}
                            </span>
                            Grupo NOVA {guestAnalysisResult.nova_group} - {
                              guestAnalysisResult.nova_group === 1 ? 'Mínimamente procesado' :
                              guestAnalysisResult.nova_group === 2 ? 'Ingrediente culinario' :
                              guestAnalysisResult.nova_group === 3 ? 'Alimento procesado' :
                              'Ultraprocesado'
                            }
                          </div>
                          {guestAnalysisResult.nova_reason && (
                            <p className="opacity-95">{guestAnalysisResult.nova_reason}</p>
                          )}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        <div className="bg-blue-50 rounded-lg p-1.5 sm:p-2 text-center">
                          <div className="text-[10px] sm:text-xs text-blue-600 font-semibold truncate">Proteína</div>
                          <div className="text-base sm:text-lg font-bold text-blue-700">{guestAnalysisResult.protein}g</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-1.5 sm:p-2 text-center">
                          <div className="text-[10px] sm:text-xs text-green-600 font-semibold truncate">Carbos</div>
                          <div className="text-base sm:text-lg font-bold text-green-700">{guestAnalysisResult.carbs}g</div>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-1.5 sm:p-2 text-center">
                          <div className="text-[10px] sm:text-xs text-yellow-600 font-semibold truncate">Grasas</div>
                          <div className="text-base sm:text-lg font-bold text-yellow-700">{guestAnalysisResult.fat}g</div>
                        </div>
                        <div className="bg-pink-50 rounded-lg p-1.5 sm:p-2 text-center">
                          <div className="text-[10px] sm:text-xs text-pink-600 font-semibold truncate">Azúcar</div>
                          <div className="text-base sm:text-lg font-bold text-pink-700">{guestAnalysisResult.sugar || 0}g</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-1.5 sm:p-2 text-center">
                          <div className="text-[10px] sm:text-xs text-purple-600 font-semibold truncate">Fibra</div>
                          <div className="text-base sm:text-lg font-bold text-purple-700">{guestAnalysisResult.fiber || 0}g</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-1.5 sm:p-2 text-center">
                          <div className="text-[10px] sm:text-xs text-red-600 font-semibold truncate">Sodio</div>
                          <div className="text-base sm:text-lg font-bold text-red-700">{guestAnalysisResult.sodium || 0}mg</div>
                        </div>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs leading-relaxed text-orange-700">
                        💡 <strong>Regístrate</strong> para guardar tus comidas y ver tu progreso diario
                      </div>
                      <div className="pt-3 border-t border-slate-100 mt-2">
                        <Button 
                          onClick={() => { setGuestPreviewImage(null); setGuestAnalysisResult(null); }}
                          variant="primary" 
                          className="w-full"
                        >
                          <Check className="w-5 h-5" /> Entendido
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800">Contexto opcional</h3>
                        <p className="text-sm text-slate-500 mb-2">
                          Ayuda a la IA a calcular mejor (ej. &quot;plato pequeño&quot;, &quot;me comí la mitad&quot;).
                        </p>
                        <input 
                          type="text" 
                          placeholder="Ej. Plato hondo grande..."
                          value={guestPortionContext}
                          onChange={(e) => setGuestPortionContext(e.target.value)}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 placeholder:text-slate-400"
                          onKeyDown={(e) => e.key === 'Enter' && triggerGuestAnalysis()}
                        />
                      </div>
                      <Button onClick={triggerGuestAnalysis} variant="primary" className="w-full">
                        <Camera className="w-4 h-4" /> Analizar Imagen
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tracker de Hidratación */}
          {renderHydrationCard(true)}

          {/* Instrucciones */}
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-white">
            <div className="text-6xl mb-4">📸</div>
            <p className="text-slate-600 mb-2 font-medium">Escanea tu comida</p>
            <p className="text-sm text-slate-400">Toca el botón de abajo para analizar con IA</p>
          </div>
        </main>

        {/* Botón Flotante de Escaneo */}
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-40">
          <Button 
            onClick={() => setShowGuestImagePickerModal(true)} 
            variant="primary"
            className="rounded-full px-8 py-4 shadow-xl shadow-orange-200 text-lg font-bold"
          >
            <Camera className="w-6 h-6" /> Escanear Comida
          </Button>
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={guestFileInputRef} 
            onChange={handleGuestFileSelect} 
          />
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            ref={guestCameraInputRef} 
            onChange={handleGuestFileSelect} 
          />
        </div>

        {/* Modal de Selección de Imagen (Invitado) */}
        {showGuestImagePickerModal && (
          <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4" onClick={() => setShowGuestImagePickerModal(false)}>
            <div className="bg-white rounded-t-3xl w-full max-w-md p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-900 mb-4 text-center">¿Cómo quieres agregar el alimento?</h3>
              <Button
                onClick={() => {
                  guestCameraInputRef.current?.click();
                  setShowGuestImagePickerModal(false);
                }}
                variant="primary"
                className="w-full py-4 text-base"
              >
                <Camera className="w-5 h-5" /> Tomar Foto
              </Button>
              <Button
                onClick={() => {
                  guestFileInputRef.current?.click();
                  setShowGuestImagePickerModal(false);
                }}
                variant="outline"
                className="w-full py-4 text-base bg-white hover:bg-slate-50"
              >
                <span className="text-xl">🖼️</span> Seleccionar de Galería
              </Button>
              <Button
                onClick={() => {
                  setShowGuestImagePickerModal(false);
                  setShowGuestTextInputModal(true);
                }}
                variant="outline"
                className="w-full py-4 text-base bg-white hover:bg-slate-50"
              >
                <span className="text-xl">✏️</span> Describir Alimento
              </Button>
              <Button
                onClick={() => setShowGuestImagePickerModal(false)}
                variant="secondary"
                className="w-full py-3 text-sm"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Modal de Descripción por Texto (Invitado) */}
        {showGuestTextInputModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowGuestTextInputModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-900">Describe tu alimento</h3>
              <p className="text-sm text-slate-600">Ejemplo: &quot;2 tacos de carne asada con tortilla de maíz&quot; o &quot;1 taza de arroz con pollo&quot;</p>
              <textarea
                value={foodDescription}
                onChange={(e) => setFoodDescription(e.target.value)}
                placeholder="Escribe aquí la descripción..."
                className="w-full h-32 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-900 placeholder:text-slate-400 resize-none"
                maxLength={500}
              />
              <div className="text-xs text-slate-500 text-right">{foodDescription.length}/500</div>
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowGuestTextInputModal(false);
                    setFoodDescription('');
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleGuestTextSubmit}
                  variant="primary"
                  className="flex-1"
                  disabled={!foodDescription.trim() || isAnalyzingText}
                >
                  {isAnalyzingText ? <Loader2 className="w-5 h-5 animate-spin" /> : '✨'} Analizar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Si está configurando perfil
  if (showProfileSetup) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <ProfileSetup 
          onSave={handleSaveProfile}
          initialProfile={userData?.profile}
        />
      </div>
    );
  }

  // Loading inicial
  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="animate-spin text-orange-500 w-12 h-12 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Cargando xCal...</p>
        </div>
      </div>
    );
  }
  
  // Loading datos de usuario
  if (user && !userData) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="animate-spin text-orange-500 w-12 h-12 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Cargando tu perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 border-b border-slate-200 px-4 py-4 shadow-sm">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-2 rounded-lg">
              <Pizza className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">xCal</h1>
              <p className="text-xs text-slate-500">Hola, {userData?.displayName || 'Usuario'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowProfileSetup(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Editar perfil"
            >
              <Settings className="w-5 h-5 text-slate-600" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6 pb-24">
        {/* Selector de Fecha */}
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-100">
          <button 
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d);
            }}
            className="p-2 hover:bg-slate-50 text-slate-500 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center justify-center gap-2 flex-col">
            <span className="text-sm font-bold text-slate-800 tracking-wide uppercase">
              {selectedDate.toDateString() === new Date().toDateString() 
                ? 'HOY' 
                : selectedDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>

          <button 
            onClick={() => {
              // No permitir avanzar más allá de hoy (opcional)
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              // Si d es mayor a hoy, podríamos bloquearlo, pero lo dejaremos libre o simplemente limitado a hoy:
              if (d <= new Date()) setSelectedDate(d);
            }}
            className={`p-2 rounded-lg transition-colors ${
              new Date(selectedDate).toDateString() === new Date().toDateString() 
              ? 'opacity-30 cursor-not-allowed text-slate-400' 
              : 'hover:bg-slate-50 text-slate-500'
            }`}
            disabled={new Date(selectedDate).toDateString() === new Date().toDateString()}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Dashboard de Progreso */}
        {progress && <ProgressDashboard progress={progress} caloriesBurned={userData?.googleFitTokens ? caloriesBurned : 0} />}

        {/* Tracker de Hidratación */}
        {renderHydrationCard(false)}

        {/* Sincronización Google Fit */}
        {renderGoogleFitCard()}

        {/* Modal de Análisis */}
        {previewImage && (
          <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              {previewImage !== 'text' ? (
                <div className="relative h-40 sm:h-48 bg-slate-100 flex-shrink-0">
                  <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => { setPreviewImage(null); setAnalysisResult(null); }}
                    className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                  <h3 className="font-bold text-slate-800">Análisis de Comida</h3>
                  <button 
                    onClick={() => { setPreviewImage(null); setAnalysisResult(null); }}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              <div className="p-5 sm:p-6 flex-1 overflow-y-auto min-h-0 space-y-4">
                {isAnalyzing ? (
                  <div className="text-center py-8 space-y-4 my-auto">
                    <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
                    <p className="text-slate-600 font-medium animate-pulse">Analizando con IA...</p>
                  </div>
                ) : analysisResult ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{analysisResult.food_name}</h3>
                      <p className="text-orange-500 font-bold text-lg">{analysisResult.calories} kcal</p>
                      {analysisResult.confidence && (
                        <p className="text-xs text-slate-500">Confianza: {analysisResult.confidence}</p>
                      )}
                    </div>
                    
                    {/* Clasificación NOVA */}
                    {analysisResult.nova_group && (
                      <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                        analysisResult.nova_group === 1 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                        analysisResult.nova_group === 2 ? 'bg-slate-50 border-slate-200 text-slate-800' :
                        analysisResult.nova_group === 3 ? 'bg-amber-50 border-amber-200 text-amber-900' :
                        'bg-rose-50 border-rose-200 text-rose-900'
                      }`}>
                        <div className="font-bold flex items-center gap-1.5 text-sm mb-0.5">
                          <span>
                            {analysisResult.nova_group === 1 ? '🟢' :
                             analysisResult.nova_group === 2 ? '⚪' :
                             analysisResult.nova_group === 3 ? '🟡' :
                             '🔴'}
                          </span>
                          Grupo NOVA {analysisResult.nova_group} - {
                            analysisResult.nova_group === 1 ? 'Mínimamente procesado' :
                            analysisResult.nova_group === 2 ? 'Ingrediente culinario' :
                            analysisResult.nova_group === 3 ? 'Alimento procesado' :
                            'Ultraprocesado'
                          }
                        </div>
                        {analysisResult.nova_reason && (
                          <p className="opacity-95">{analysisResult.nova_reason}</p>
                        )}
                      </div>
                    )}

                    {/* Selector de Categoría (Pacing) */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                        🍳 Categoría de Comida
                      </label>
                      <select 
                        value={selectedMealType} 
                        onChange={(e) => setSelectedMealType(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                      >
                        <option value="desayuno">🍳 Desayuno</option>
                        <option value="almuerzo">🍗 Almuerzo</option>
                        <option value="cena">🌙 Cena</option>
                        <option value="snack">🍎 Snack / Colación</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      <div className="bg-blue-50 rounded-lg p-1.5 sm:p-2 text-center">
                        <div className="text-[10px] sm:text-xs text-blue-600 font-semibold truncate">Proteína</div>
                        <div className="text-base sm:text-lg font-bold text-blue-700">{analysisResult.protein}g</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-1.5 sm:p-2 text-center">
                        <div className="text-[10px] sm:text-xs text-green-600 font-semibold truncate">Carbos</div>
                        <div className="text-base sm:text-lg font-bold text-green-700">{analysisResult.carbs}g</div>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-1.5 sm:p-2 text-center">
                        <div className="text-[10px] sm:text-xs text-yellow-600 font-semibold truncate">Grasas</div>
                        <div className="text-base sm:text-lg font-bold text-yellow-700">{analysisResult.fat}g</div>
                      </div>
                      <div className="bg-pink-50 rounded-lg p-1.5 sm:p-2 text-center">
                        <div className="text-[10px] sm:text-xs text-pink-600 font-semibold truncate">Azúcar</div>
                        <div className="text-base sm:text-lg font-bold text-pink-700">{analysisResult.sugar || 0}g</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-1.5 sm:p-2 text-center">
                        <div className="text-[10px] sm:text-xs text-purple-600 font-semibold truncate">Fibra</div>
                        <div className="text-base sm:text-lg font-bold text-purple-700">{analysisResult.fiber || 0}g</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-1.5 sm:p-2 text-center">
                        <div className="text-[10px] sm:text-xs text-red-600 font-semibold truncate">Sodio</div>
                        <div className="text-base sm:text-lg font-bold text-red-700">{analysisResult.sodium || 0}mg</div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 mt-2">
                      <Button onClick={saveLog} variant="primary" className="w-full">
                        <Check className="w-5 h-5" /> Confirmar y Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">Contexto opcional</h3>
                      <p className="text-sm text-slate-500 mb-2">
                        Ayuda a la IA a calcular mejor (ej. &quot;plato pequeño&quot;, &quot;me comí la mitad&quot;).
                      </p>
                      <input 
                        type="text" 
                        placeholder="Ej. Plato hondo grande..."
                        value={portionContext}
                        onChange={(e) => setPortionContext(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 placeholder:text-slate-400"
                        onKeyDown={(e) => e.key === 'Enter' && triggerAnalysis()}
                      />
                    </div>
                    <Button onClick={triggerAnalysis} variant="primary" className="w-full">
                      <Camera className="w-4 h-4" /> Analizar Imagen
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lista de Registros */}
        <div className="space-y-4">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            Comidas del Día
            <span className="text-sm font-normal text-slate-500">({logs.length})</span>
          </h2>
          {logs.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-white">
              <p className="text-slate-400 mb-2">Sin registros en esta fecha.</p>
              {selectedDate.toDateString() === new Date().toDateString() && (
                <p className="text-xs text-slate-400">Toca el botón &quot;+&quot; de abajo para escanear tu comida</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <Card key={log.id} className="flex items-center gap-4 p-3 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="w-16 h-16 rounded-xl bg-orange-50 border border-orange-100/50 flex items-center justify-center flex-shrink-0 text-3xl shadow-sm">
                    {getFoodEmoji(log.food_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-800 truncate">{log.food_name}</h4>
                      {log.meal_type && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          log.meal_type === 'desayuno' ? 'bg-amber-100 text-amber-800' :
                          log.meal_type === 'almuerzo' ? 'bg-sky-100 text-sky-800' :
                          log.meal_type === 'cena' ? 'bg-indigo-100 text-indigo-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {log.meal_type}
                        </span>
                      )}
                      {log.nova_group && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          log.nova_group === 1 ? 'bg-emerald-100 text-emerald-800' :
                          log.nova_group === 2 ? 'bg-slate-100 text-slate-800' :
                          log.nova_group === 3 ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`} title={log.nova_reason}>
                          NOVA {log.nova_group}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 flex-wrap">
                      <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{log.calories} kcal</span>
                      <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">P: {log.protein}g</span>
                      <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded">C: {log.carbs}g</span>
                      <span className="bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded">G: {log.fat}g</span>
                      {log.sugar !== undefined && log.sugar > 0 && (
                        <span className="bg-pink-50 text-pink-600 px-2 py-0.5 rounded">Az: {log.sugar}g</span>
                      )}
                      {log.fiber !== undefined && log.fiber > 0 && (
                        <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded">Fb: {log.fiber}g</span>
                      )}
                      {log.sodium !== undefined && log.sodium > 0 && (
                        <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded">Na: {log.sodium}mg</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteLog(log.id)} className="text-slate-300 hover:text-red-500 p-2">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Botón Flotante de Escaneo */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-40">
        <Button 
          onClick={() => setShowImagePickerModal(true)} 
          variant="primary"
          className="rounded-full px-8 py-4 shadow-xl shadow-orange-200 text-lg font-bold"
        >
          <Camera className="w-6 h-6" /> Escanear Comida
        </Button>
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
        />
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          ref={cameraInputRef} 
          onChange={handleFileSelect} 
        />
      </div>

      {/* Modal de Selección de Imagen (Autenticado) */}
      {showImagePickerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4" onClick={() => setShowImagePickerModal(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-4 text-center">¿Cómo quieres agregar el alimento?</h3>
            <Button
              onClick={() => {
                cameraInputRef.current?.click();
                setShowImagePickerModal(false);
              }}
              variant="primary"
              className="w-full py-4 text-base"
            >
              <Camera className="w-5 h-5" /> Tomar Foto
            </Button>
            <Button
              onClick={() => {
                fileInputRef.current?.click();
                setShowImagePickerModal(false);
              }}
              variant="outline"
              className="w-full py-4 text-base bg-white hover:bg-slate-50"
            >
              <span className="text-xl">🖼️</span> Seleccionar de Galería
            </Button>
            <Button
              onClick={() => {
                setShowImagePickerModal(false);
                setShowTextInputModal(true);
              }}
              variant="outline"
              className="w-full py-4 text-base bg-white hover:bg-slate-50"
            >
              <span className="text-xl">✏️</span> Describir con Inteligencia Artificial
            </Button>
            <Button
              onClick={() => {
                setShowImagePickerModal(false);
                setShowManualInputModal(true); // Abrir el modal de carga manual
              }}
              variant="outline"
              className="w-full py-4 text-base bg-white hover:bg-slate-50"
            >
              <span className="text-xl">✍️</span> Ingresar Macros Manualmente
            </Button>
            <Button
              onClick={() => setShowImagePickerModal(false)}
              variant="secondary"
              className="w-full py-3 text-sm"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Descripción por Texto (Autenticado) */}
      {showTextInputModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTextInputModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">Describe tu alimento</h3>
            <p className="text-sm text-slate-600">Ejemplo: &quot;2 tacos de carne asada con tortilla de maíz&quot; o &quot;1 taza de arroz con pollo&quot;</p>
            <textarea
              value={foodDescription}
              onChange={(e) => setFoodDescription(e.target.value)}
              placeholder="Escribe aquí la descripción..."
              className="w-full h-32 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-900 placeholder:text-slate-400 resize-none"
              maxLength={500}
            />
            <div className="text-xs text-slate-500 text-right">{foodDescription.length}/500</div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowTextInputModal(false);
                  setFoodDescription('');
                }}
                variant="secondary"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleTextSubmit}
                variant="primary"
                className="flex-1"
                disabled={!foodDescription.trim() || isAnalyzingText}
              >
                {isAnalyzingText ? <Loader2 className="w-5 h-5 animate-spin" /> : '✨'} Analizar
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Ingreso Manual */}
      {showManualInputModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowManualInputModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900">Ingreso Manual</h3>
              <button onClick={() => setShowManualInputModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5"/>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del alimento *</label>
                <input 
                  type="text" 
                  value={manualEntry.food_name} 
                  onChange={e => setManualEntry({...manualEntry, food_name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Ej. Manzana pequeña" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Calorías (kcal)</label>
                  <input 
                    type="number" min="0" 
                    value={manualEntry.calories || ''} 
                    onChange={e => setManualEntry({...manualEntry, calories: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proteínas (g)</label>
                  <input 
                    type="number" min="0" 
                    value={manualEntry.protein || ''} 
                    onChange={e => setManualEntry({...manualEntry, protein: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Carbohidratos (g)</label>
                  <input 
                    type="number" min="0" 
                    value={manualEntry.carbs || ''} 
                    onChange={e => setManualEntry({...manualEntry, carbs: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Grasas (g)</label>
                  <input 
                    type="number" min="0" 
                    value={manualEntry.fat || ''} 
                    onChange={e => setManualEntry({...manualEntry, fat: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg" 
                  />
                </div>
              </div>
              
              <Button onClick={handleManualSubmit} variant="primary" className="w-full mt-6">
                <Check className="w-5 h-5 mr-2" /> Guardar Macro
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
