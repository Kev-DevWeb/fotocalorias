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
  collection, 
  addDoc, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc,
  doc,
  setDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { Camera, Check, Trash2, Loader2, Pizza, LogOut, Settings, X } from 'lucide-react';
import { UserProfile, MacroTargets, calculateDailyProgress } from '@/lib/calorie-calculator';
import AuthForm from './components/AuthForm';
import ProfileSetup from './components/ProfileSetup';
import ProgressDashboard from './components/ProgressDashboard';

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "TU_API_KEY_AQUI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "TU_PROYECTO.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "TU_PROYECTO",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "TU_PROYECTO.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "...",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "..."
};

// Inicialización segura para Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

// --- TIPOS ---
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

interface CalorieLog extends NutritionData {
  id: string;
  createdAt: any;
  imagePreview?: string;
}

interface UserData {
  email: string;
  displayName: string;
  profile?: UserProfile;
  targets?: MacroTargets;
  createdAt: any;
  updatedAt: any;
}

// --- FUNCIÓN PARA ANALIZAR IMAGEN ---
async function analyzeImageWithGemini(base64Image: string, mimeType: string = 'image/jpeg'): Promise<NutritionData | null> {
  try {
    console.log('📤 Enviando imagen a Gemini API...');
    console.log('📊 Tipo MIME:', mimeType);
    console.log('📏 Tamaño base64:', base64Image.length, 'caracteres');
    
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
    return null;
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
  
  // Estado para modal de selección
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showGuestImagePickerModal, setShowGuestImagePickerModal] = useState(false);
  
  // Estado de carga inicial
  const [isInitializing, setIsInitializing] = useState(true);

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
      
      // Filtrar solo los de hoy
      const todayLogs = logsData.filter(log => {
        if (!log.createdAt) return false;
        const logDate = new Date(log.createdAt.seconds * 1000);
        return logDate.toDateString() === new Date().toDateString();
      });

      console.log(`✅ Logs de hoy: ${todayLogs.length}`);
      setLogs(todayLogs);
    });

    return () => unsubscribe();
  }, [user]);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPreviewImage(base64String);
        
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

  const saveLog = async () => {
    if (!user || !analysisResult) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'calorie_logs'), {
        ...analysisResult,
        createdAt: serverTimestamp(),
        imagePreview: previewImage 
      });
      setPreviewImage(null);
      setAnalysisResult(null);
    } catch (error) {
      console.error(error);
      alert("Error al guardar");
    }
  };

  const deleteLog = async (id: string) => {
    if (confirm("¿Borrar este registro?")) {
      await deleteDoc(doc(db, 'users', user!.uid, 'calorie_logs', id));
    }
  };

  // Calcular totales del día
  const totals = logs.reduce((acc, curr) => ({
    calories: acc.calories + (curr.calories || 0),
    protein: acc.protein + (curr.protein || 0),
    carbs: acc.carbs + (curr.carbs || 0),
    fat: acc.fat + (curr.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Calcular progreso si hay targets
  const progress = userData?.targets 
    ? calculateDailyProgress(totals, userData.targets)
    : null;

  // Handler para modo invitado
  const handleGuestFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setGuestPreviewImage(base64String);
        
        const base64Data = base64String.split(',')[1];
        analyzeGuestImage(base64Data, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeGuestImage = async (base64: string, mimeType: string) => {
    setIsGuestAnalyzing(true);
    setGuestAnalysisResult(null);
    
    const result = await analyzeImageWithGemini(base64, mimeType);
    
    if (result && !result.error) {
      setGuestAnalysisResult(result);
    } else {
      alert("No pudimos identificar comida. Intenta una foto más clara.");
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
                <h1 className="font-bold text-lg">FotoCalorías</h1>
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
              <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                <div className="relative h-64 bg-slate-100">
                  <img src={guestPreviewImage} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => { setGuestPreviewImage(null); setGuestAnalysisResult(null); }}
                    className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6">
                  {isGuestAnalyzing ? (
                    <div className="text-center py-8 space-y-4">
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
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-blue-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-blue-600 font-semibold">Proteína</div>
                          <div className="text-lg font-bold text-blue-700">{guestAnalysisResult.protein}g</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-green-600 font-semibold">Carbos</div>
                          <div className="text-lg font-bold text-green-700">{guestAnalysisResult.carbs}g</div>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-yellow-600 font-semibold">Grasas</div>
                          <div className="text-lg font-bold text-yellow-700">{guestAnalysisResult.fat}g</div>
                        </div>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                        💡 <strong>Regístrate</strong> para guardar tus comidas y ver tu progreso diario
                      </div>
                      <Button 
                        onClick={() => { setGuestPreviewImage(null); setGuestAnalysisResult(null); }}
                        variant="primary" 
                        className="w-full"
                      >
                        <Check className="w-5 h-5" /> Entendido
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

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
              <h3 className="text-lg font-bold text-slate-900 mb-4 text-center">¿Cómo quieres agregar la imagen?</h3>
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
                onClick={() => setShowGuestImagePickerModal(false)}
                variant="secondary"
                className="w-full py-3 text-sm"
              >
                Cancelar
              </Button>
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
          <p className="text-slate-600 font-medium">Cargando FotoCalorías...</p>
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
              <h1 className="font-bold text-lg">FotoCalorías</h1>
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

      <main className="max-w-md mx-auto p-4 space-y-6">
        {/* Dashboard de Progreso */}
        {progress && <ProgressDashboard progress={progress} />}

        {/* Modal de Análisis */}
        {previewImage && (
          <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
              <div className="relative h-64 bg-slate-100">
                <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => { setPreviewImage(null); setAnalysisResult(null); }}
                  className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                {isAnalyzing ? (
                  <div className="text-center py-8 space-y-4">
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
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-blue-600 font-semibold">Proteína</div>
                        <div className="text-lg font-bold text-blue-700">{analysisResult.protein}g</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-green-600 font-semibold">Carbos</div>
                        <div className="text-lg font-bold text-green-700">{analysisResult.carbs}g</div>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-yellow-600 font-semibold">Grasas</div>
                        <div className="text-lg font-bold text-yellow-700">{analysisResult.fat}g</div>
                      </div>
                    </div>
                    <Button onClick={saveLog} variant="primary" className="w-full mt-4">
                      <Check className="w-5 h-5" /> Confirmar y Guardar
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Lista de Registros */}
        <div className="space-y-4">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            Comidas de Hoy
            <span className="text-sm font-normal text-slate-500">({logs.length})</span>
          </h2>
          {logs.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-white">
              <p className="text-slate-400 mb-2">Sin registros hoy.</p>
              <p className="text-xs text-slate-400">Toca el botón de abajo para escanear tu comida</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <Card key={log.id} className="flex items-center gap-4 p-3 animate-in slide-in-from-bottom-2 duration-300">
                  {log.imagePreview ? (
                    <img src={log.imagePreview} className="w-16 h-16 rounded-lg object-cover bg-slate-100" alt="food" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-orange-100 flex items-center justify-center text-orange-500">
                      <Pizza className="w-8 h-8" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 truncate">{log.food_name}</h4>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{log.calories} kcal</span>
                      <span>P: {log.protein}g</span>
                      <span>C: {log.carbs}g</span>
                      <span>G: {log.fat}g</span>
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
            <h3 className="text-lg font-bold text-slate-900 mb-4 text-center">¿Cómo quieres agregar la imagen?</h3>
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
              onClick={() => setShowImagePickerModal(false)}
              variant="secondary"
              className="w-full py-3 text-sm"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
