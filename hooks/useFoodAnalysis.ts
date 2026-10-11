'use client';

import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { analyzeFood, isStaleClient, type AnalyzeRequest } from '@/lib/analysis-client';
import { auth } from '@/lib/firebase';
import type { NutritionData } from '@/lib/types';

export type AnalysisStage =
  | { kind: 'idle' }
  | { kind: 'analyzing'; source: 'image' | 'text' }
  | { kind: 'result'; source: 'image' | 'text' | 'manual'; data: NutritionData; id: number }
  | { kind: 'error'; source: 'image' | 'text'; message: string };

export interface PickedImage {
  /** data URL para mostrar la vista previa */
  preview: string;
  base64: string;
  mimeType: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/**
 * Flujo de análisis de una comida (foto, texto o ingreso manual), igual para
 * usuarios con sesión e invitados. Guardar el resultado es cosa de quien lo usa.
 */
export function useFoodAnalysis() {
  const [stage, setStage] = useState<AnalysisStage>({ kind: 'idle' });
  const [image, setImage] = useState<PickedImage | null>(null);
  const [portionContext, setPortionContext] = useState('');
  const [description, setDescription] = useState('');
  const [staleVersion, setStaleVersion] = useState(false);
  const [resultCount, setResultCount] = useState(0);

  const showResult = (source: 'image' | 'text' | 'manual', data: NutritionData) => {
    const id = resultCount + 1;
    setResultCount(id);
    setStage({ kind: 'result', source, data, id });
  };

  const run = async (request: AnalyzeRequest, source: 'image' | 'text') => {
    setStage({ kind: 'analyzing', source });
    const outcome = await analyzeFood(request, {
      // Con sesión se envía el token; sin él la petición cuenta como invitado
      getToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
    });
    if (isStaleClient(outcome.serverVersion)) setStaleVersion(true);

    if (outcome.ok) {
      showResult(source, outcome.data);
      if (source === 'text') setDescription('');
      return;
    }
    // La foto o el texto se conservan para reintentar
    setStage({ kind: 'error', source, message: outcome.message });
  };

  /** Valida y comprime la foto elegida. Devuelve un mensaje de error, o null si quedó lista. */
  const pickFile = async (file: File): Promise<string | null> => {
    if (!ALLOWED_TYPES.includes(file.type)) return 'Elige una imagen JPG, PNG o WebP.';
    if (file.size > MAX_FILE_BYTES) return 'La imagen es demasiado grande (máximo 10 MB).';
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true, initialQuality: 0.8 });
      const preview = await readAsDataUrl(compressed);
      setImage({ preview, base64: preview.split(',')[1], mimeType: compressed.type });
      setPortionContext('');
      setStage({ kind: 'idle' });
      return null;
    } catch (error) {
      console.error('Error al procesar la imagen:', error);
      return 'No se pudo procesar la imagen. Intenta con otra.';
    }
  };

  const analyzeImage = () => {
    if (!image) return;
    return run({ kind: 'image', imageBase64: image.base64, mimeType: image.mimeType, portionContext }, 'image');
  };

  const analyzeText = () => {
    const text = description.trim();
    if (!text) return;
    return run({ kind: 'text', description: text }, 'text');
  };

  const setManual = (entry: NutritionData) => showResult('manual', entry);

  /** Ajustes hechos en el editor de porciones sobre el resultado actual. */
  const updateResult = (data: NutritionData) => {
    setStage((current) => (current.kind === 'result' ? { ...current, data } : current));
  };

  /** Vuelve al formulario conservando la foto o el texto. */
  const backToInput = () => setStage({ kind: 'idle' });

  const clearImage = () => {
    setImage(null);
    setPortionContext('');
  };

  /** Deja todo listo para una comida nueva. */
  const reset = () => {
    setStage({ kind: 'idle' });
    clearImage();
    setDescription('');
  };

  return {
    stage,
    image,
    portionContext,
    setPortionContext,
    description,
    setDescription,
    staleVersion,
    pickFile,
    analyzeImage,
    analyzeText,
    setManual,
    updateResult,
    backToInput,
    clearImage,
    reset,
  };
}

export type FoodAnalysis = ReturnType<typeof useFoodAnalysis>;
