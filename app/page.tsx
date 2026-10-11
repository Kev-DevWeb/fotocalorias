'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useDayData } from '@/hooks/useDayData';
import { useFoodAnalysis } from '@/hooks/useFoodAnalysis';
import { useHealthSync } from '@/hooks/useHealthSync';
import { useSession } from '@/hooks/useSession';
import { calculateDailyProgress } from '@/lib/calorie-calculator';
import type { CalorieLog, MealType, NutritionData } from '@/lib/types';
import { AddMealSheet } from './components/add-meal/AddMealSheet';
import { AuthScreen } from './components/auth/AuthScreen';
import { GuestScreen } from './components/guest/GuestScreen';
import HuaweiLogSheet from './components/HuaweiLogSheet';
import { ProfileScreen } from './components/profile/ProfileScreen';
import { AppShell, type AppView } from './components/shell/AppShell';
import StaleVersionBanner from './components/StaleVersionBanner';
import { TodayScreen } from './components/today/TodayScreen';
import { Logo } from './components/ui/primitives';
import { ConfirmDialog } from './components/ui/Sheet';

const DEFAULT_WATER_TARGET_ML = 2000;
const ML_PER_KG = 35;

function Splash() {
  return (
    <div role="status" aria-label="Cargando" className="grid min-h-dvh place-items-center">
      <Logo size={64} className="animate-float" />
    </div>
  );
}

export default function Home() {
  const session = useSession();
  const { user, userData } = session;

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<AppView>('hoy');
  const [isGuest, setIsGuest] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [addOpen, setAddOpen] = useState(false);
  const [huaweiLog, setHuaweiLog] = useState<CalorieLog | null>(null);
  // La comida a borrar se conserva mientras el diálogo se cierra
  const [deleteTarget, setDeleteTarget] = useState<CalorieLog | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const day = useDayData(user, selectedDate);
  const health = useHealthSync({ user, userData, selectedDate, logs: day.logs, waterIntake: day.waterIntake, isManualChangeRef: day.isManualChangeRef });
  const analysis = useFoodAnalysis();

  if (session.isInitializing) return <Splash />;

  const banner = analysis.staleVersion ? <StaleVersionBanner /> : null;

  if (!user) {
    const leaveGuest = (mode: 'login' | 'register') => {
      setAuthMode(mode);
      setAddOpen(false);
      setIsGuest(false);
    };
    if (!isGuest) {
      return <AuthScreen initialMode={authMode} onLogin={session.login} onRegister={session.register} onGuest={() => setIsGuest(true)} />;
    }
    return (
      <>
        <GuestScreen banner={banner} onAddMeal={() => setAddOpen(true)} onSignIn={() => leaveGuest('login')} onCreateAccount={() => leaveGuest('register')} />
        <AddMealSheet open={addOpen} onOpenChange={setAddOpen} analysis={analysis} onRequestAccount={() => leaveGuest('register')} />
      </>
    );
  }

  // Sesión iniciada, esperando el documento del usuario
  if (!userData) return <Splash />;

  const displayName = (userData.displayName || user.displayName || 'Usuario').trim();
  const fitConnected = health.isConnected;

  const logout = async () => {
    setIsGuest(false);
    setAuthMode('login');
    setView('hoy');
    setAddOpen(false);
    analysis.reset();
    await session.logout();
  };

  const fit = { connected: fitConnected, onConnect: health.connect, onDisconnect: health.disconnect };

  if (session.needsProfile) {
    return (
      <ProfileScreen onboarding displayName={displayName.split(' ')[0]} email={userData.email} profile={userData.profile} targets={userData.targets} onSave={session.saveProfile} fit={fit} onLogout={logout} />
    );
  }

  const totals = day.logs.reduce(
    (sum, log) => ({
      calories: sum.calories + (log.calories || 0),
      protein: sum.protein + (log.protein || 0),
      carbs: sum.carbs + (log.carbs || 0),
      fat: sum.fat + (log.fat || 0),
      sugar: sum.sugar + (log.sugar || 0),
      fiber: sum.fiber + (log.fiber || 0),
      sodium: sum.sodium + (log.sodium || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0, sodium: 0 },
  );

  // El ejercicio registrado en Google Fit sube la meta de calorías del día
  const progress = userData.targets
    ? calculateDailyProgress(totals, { ...userData.targets, calories: userData.targets.calories + (fitConnected ? health.caloriesBurned : 0) })
    : null;

  const waterTarget = userData.profile?.weight ? Math.round(userData.profile.weight * ML_PER_KG) : DEFAULT_WATER_TARGET_ML;

  const saveMeal = async (data: NutritionData, mealType: MealType) => {
    await day.addLog(data, mealType);
    // La comida se guarda con la hora actual: si se veía otro día, se vuelve a hoy para encontrarla
    const now = new Date();
    if (selectedDate.toDateString() !== now.toDateString()) setSelectedDate(now);
    setView('hoy');
  };

  const changeWater = (deltaMl: number) => {
    day.updateHydration(deltaMl).catch((error) => {
      console.error('Error al guardar la hidratación:', error);
      toast.error('No se pudo guardar el agua. Intenta de nuevo.');
    });
  };

  const deleteLog = async () => {
    if (!deleteTarget) return;
    try {
      await day.deleteLog(deleteTarget.id);
      toast.success('Comida borrada');
    } catch (error) {
      console.error('Error al borrar la comida:', error);
      toast.error('No se pudo borrar. Intenta de nuevo.');
    }
  };

  return (
    <>
      <AppShell view={view} onViewChange={setView} onAddMeal={() => setAddOpen(true)} onLogout={logout} displayName={displayName} banner={banner}>
        {view === 'hoy' ? (
          <TodayScreen
            displayName={displayName.split(' ')[0]}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            progress={progress}
            water={{ current: day.waterIntake, target: waterTarget, onChange: changeWater }}
            activity={{ connected: fitConnected, syncing: health.isSyncing, caloriesBurned: health.caloriesBurned, onConnect: health.connect, onSync: health.syncNow }}
            logs={day.logs}
            onHuawei={setHuaweiLog}
            onDeleteLog={(log) => {
              setDeleteTarget(log);
              setConfirmDelete(true);
            }}
            onEditProfile={() => setView('perfil')}
          />
        ) : (
          <ProfileScreen displayName={displayName} email={userData.email} profile={userData.profile} targets={userData.targets} onSave={session.saveProfile} fit={fit} onLogout={logout} />
        )}
      </AppShell>

      <AddMealSheet open={addOpen} onOpenChange={setAddOpen} analysis={analysis} onSave={saveMeal} />
      <HuaweiLogSheet log={huaweiLog} onMarkLogged={day.markHuaweiLogged} onClose={() => setHuaweiLog(null)} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Borrar esta comida?"
        description={deleteTarget ? `«${deleteTarget.food_name}» se quitará de tu día. No se puede deshacer.` : undefined}
        confirmLabel="Borrar"
        onConfirm={deleteLog}
      />
    </>
  );
}
