'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, react-hooks/immutability, react-hooks/set-state-in-effect --
   Lógica movida tal cual desde app/page.tsx. Se conserva su forma para no cambiar el comportamiento. */

import { useEffect, useState, type MutableRefObject } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { dayKey } from '@/lib/day-key';
import { db } from '@/lib/firebase';
import type { CalorieLog, UserData } from '@/lib/types';

interface HealthSyncParams {
  user: FirebaseUser | null;
  userData: UserData | null;
  selectedDate: Date;
  logs: CalorieLog[];
  waterIntake: number;
  /** true cuando el usuario acaba de cambiar el agua a mano; evita sincronizar en la carga inicial */
  isManualChangeRef: MutableRefObject<boolean>;
}

/**
 * Sincronización con Google Fit (calorías de ejercicio, nutrición e hidratación)
 * y con la app nativa que envuelve la web (mensajes SYNC_NUTRITION y
 * SYNC_HYDRATION por ReactNativeWebView).
 */
export function useHealthSync({ user, userData, selectedDate, logs, waterIntake, isManualChangeRef }: HealthSyncParams) {
  const [caloriesBurned, setCaloriesBurned] = useState<number>(0);
  const [isSyncingFit, setIsSyncingFit] = useState(false);

  // Escuchar mensajes del popup de Google Fit
  useEffect(() => {
    const handleAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'GOOGLE_FIT_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        // Los tokens no se escriben en la consola
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          try {
            await updateDoc(userDocRef, {
              googleFitTokens: tokens,
              updatedAt: serverTimestamp()
            });
            toast.success('Google Fit conectado');
            syncGoogleFit(selectedDate, tokens);
          } catch (err) {
            console.error('Error al guardar tokens de Google Fit:', err);
            toast.error('No se pudo guardar la conexión con Google Fit.');
          }
        }
      } else if (event.data?.type === 'GOOGLE_FIT_AUTH_ERROR') {
        console.error('❌ Error de Google Fit Auth:', event.data.error);
        toast.error(`No se pudo conectar con Google Fit: ${event.data.error}`);
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

    const dateString = dayKey(selectedDate);
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
      
      const dateString = dayKey(date);

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

      console.log(`🍎 Sincronizados exitosamente ${points.length} alimentos con Google Fit para el día ${dayKey(date)}`);
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

  // Desconectar Google Fit (la confirmación la pide la interfaz)
  const disconnectGoogleFit = async () => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userDocRef, {
        googleFitTokens: deleteField(),
        updatedAt: serverTimestamp()
      });
      setCaloriesBurned(0);
      toast.success('Google Fit desconectado');
    } catch (err) {
      console.error('Error al desconectar Google Fit:', err);
      toast.error('No se pudo desconectar Google Fit.');
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

  const tokens = userData?.googleFitTokens;

  return {
    caloriesBurned,
    isSyncing: isSyncingFit,
    isConnected: Boolean(tokens),
    connect: connectGoogleFit,
    disconnect: disconnectGoogleFit,
    syncNow: () => {
      if (tokens) syncGoogleFit(selectedDate, tokens);
    },
  };
}
