'use client';

import { useEffect, useRef, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CalorieLog, MealType, NutritionData } from '@/lib/types';

/**
 * Clave del día para los documentos de hidratación y actividad. Usa la fecha
 * en UTC, igual que siempre lo ha hecho la app, para seguir leyendo los
 * mismos documentos.
 */
export const dayKey = (date: Date) => date.toISOString().split('T')[0];

function logDate(log: CalorieLog): Date | null {
  const created = log.createdAt;
  if (!created) return null;
  if (created.toDate) return created.toDate();
  if (created.seconds) return new Date(created.seconds * 1000);
  // Registro recién creado en este dispositivo que aún no tiene hora del servidor
  return new Date();
}

/** Firestore no acepta `undefined`, y los avisos solo sirven en pantalla. */
function toFirestoreLog(result: NutritionData): Record<string, unknown> {
  const clean = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
  delete clean.warnings;
  delete clean.error;
  return clean;
}

// Misma referencia siempre, para no disparar efectos que dependen de la lista
const NO_LOGS: CalorieLog[] = [];

/** Comidas e hidratación del día seleccionado, con sus acciones. */
export function useDayData(user: FirebaseUser | null, selectedDate: Date) {
  // Lo cargado se guarda junto con su dueño: sin sesión, o al cambiar de cuenta, no se muestra lo anterior
  const [loadedLogs, setLoadedLogs] = useState<{ uid: string; logs: CalorieLog[] }>({ uid: '', logs: [] });
  const [loadedWater, setLoadedWater] = useState({ uid: '', amount: 0 });
  // Marca los cambios de agua hechos a mano, para que la sincronización no se dispare al cargar
  const isManualChangeRef = useRef(false);

  const logs = user && loadedLogs.uid === user.uid ? loadedLogs.logs : NO_LOGS;
  const waterIntake = user && loadedWater.uid === user.uid ? loadedWater.amount : 0;

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'calorie_logs'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as CalorieLog[];
      setLoadedLogs({ uid: user.uid, logs: all.filter((log) => logDate(log)?.toDateString() === selectedDate.toDateString()) });
    });
  }, [user, selectedDate]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'hydration_logs', dayKey(selectedDate)), (snapshot) => {
      setLoadedWater({ uid: user.uid, amount: snapshot.exists() ? snapshot.data().amount || 0 : 0 });
    });
  }, [user, selectedDate]);

  const addLog = async (result: NutritionData, mealType: MealType) => {
    if (!user) return;
    await addDoc(collection(db, 'users', user.uid, 'calorie_logs'), {
      ...toFirestoreLog(result),
      createdAt: serverTimestamp(),
      imagePreview: null, // No se guarda la imagen para mantener la base de datos gratuita
      meal_type: mealType,
    });
  };

  const deleteLog = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'calorie_logs', id));
  };

  const markHuaweiLogged = async (id: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'calorie_logs', id), { huawei_logged_at: serverTimestamp() });
  };

  const updateHydration = async (amountChange: number) => {
    if (!user) return;
    const newAmount = Math.max(0, waterIntake + amountChange);
    isManualChangeRef.current = true;
    await setDoc(
      doc(db, 'users', user.uid, 'hydration_logs', dayKey(selectedDate)),
      { amount: newAmount, updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

  return { logs, waterIntake, isManualChangeRef, addLog, deleteLog, markHuaweiLogged, updateHydration };
}
