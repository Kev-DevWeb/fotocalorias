'use client';

import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import type { MacroTargets, UserProfile } from '@/lib/calorie-calculator';
import { auth, db } from '@/lib/firebase';
import type { UserData } from '@/lib/types';

/** Sesión de Firebase y documento del usuario (perfil, objetivos y conexión con Google Fit). */
export function useSession() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  // Se guarda junto con su dueño: al cambiar de cuenta no se muestra el documento de la anterior
  const [loaded, setLoaded] = useState<{ uid: string; data: UserData } | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const userData = user && loaded?.uid === user.uid ? loaded.data : null;

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsInitializing(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    return onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setLoaded({ uid: user.uid, data: snapshot.data() as UserData });
        return;
      }
      // Primera vez que entra: se crea su documento
      const newUserData: UserData = {
        email: user.email || '',
        displayName: user.displayName || 'Usuario',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      setDoc(userDocRef, newUserData).catch((error) => {
        console.error('❌ Error al crear documento de usuario:', error);
      });
    });
  }, [user]);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, displayName: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });
    // El documento del usuario pudo crearse antes de que la cuenta tuviera nombre
    await setDoc(doc(db, 'users', credential.user.uid), { displayName, updatedAt: serverTimestamp() }, { merge: true });
  };

  const logout = () => signOut(auth);

  /** Lanza si falla, para que el formulario muestre el error. */
  const saveProfile = async (profile: UserProfile, targets: MacroTargets) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), { profile, targets, updatedAt: serverTimestamp() }, { merge: true });
  };

  return {
    user,
    userData,
    isInitializing,
    /** true mientras el usuario no haya configurado peso, estatura, etc. */
    needsProfile: Boolean(userData && (!userData.profile || !userData.targets)),
    login,
    register,
    logout,
    saveProfile,
  };
}
