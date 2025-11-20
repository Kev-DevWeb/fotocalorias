"use client";

import React, { useState } from 'react';
import { UserProfile, calculateNutritionTargets, validateProfile, MacroTargets } from '@/lib/calorie-calculator';
import { User, Save, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ProfileSetupProps {
  onSave: (profile: UserProfile, targets: MacroTargets) => Promise<void>;
  initialProfile?: Partial<UserProfile>;
}

export default function ProfileSetup({ onSave, initialProfile }: ProfileSetupProps) {
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    weight: initialProfile?.weight || undefined,
    height: initialProfile?.height || undefined,
    age: initialProfile?.age || undefined,
    gender: initialProfile?.gender || 'male',
    activityLevel: initialProfile?.activityLevel || 'moderate',
    goal: initialProfile?.goal || 'maintain',
  });
  
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validar
    const validationError = validateProfile(profile);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    // Calcular objetivos
    const targets = calculateNutritionTargets(profile as UserProfile);
    
    // Guardar
    setIsSaving(true);
    console.log('🔵 Iniciando guardado de perfil...');
    console.log('📊 Datos del perfil:', profile);
    console.log('🎯 Objetivos calculados:', targets);
    
    try {
      console.log('💾 Llamando a onSave...');
      await onSave(profile as UserProfile, targets);
      console.log('✅ Perfil guardado exitosamente');
    } catch (err) {
      console.error('❌ Error al guardar:', err);
      setError('Error al guardar el perfil. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
      console.log('🏁 Proceso de guardado finalizado');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-orange-500 p-3 rounded-full">
          <User className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Configura tu Perfil</h2>
          <p className="text-sm text-slate-600">Calcularemos tus objetivos personalizados</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Datos Biométricos */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <span className="text-orange-500">📊</span> Datos Biométricos
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Peso */}
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">
                Peso (kg) *
              </label>
              <input
                type="number"
                value={profile.weight || ''}
                onChange={(e) => setProfile({ ...profile, weight: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                placeholder="75"
                min="30"
                max="300"
                step="0.1"
                required
              />
            </div>
            
            {/* Estatura */}
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">
                Estatura (cm) *
              </label>
              <input
                type="number"
                value={profile.height || ''}
                onChange={(e) => setProfile({ ...profile, height: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                placeholder="175"
                min="100"
                max="250"
                required
              />
            </div>
          </div>
          
          {/* Edad */}
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">
              Edad (años) *
            </label>
            <input
              type="number"
              value={profile.age || ''}
              onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="30"
              min="15"
              max="100"
              required
            />
          </div>
          
          {/* Sexo */}
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-2">
              Sexo *
            </label>
            <div className="flex gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer border-2 rounded-lg p-3 transition-all hover:border-orange-300">
                <input
                  type="radio"
                  value="male"
                  checked={profile.gender === 'male'}
                  onChange={(e) => setProfile({ ...profile, gender: e.target.value as any })}
                  className="text-orange-500 focus:ring-orange-500"
                />
                <span className="font-medium">Masculino</span>
              </label>
              <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer border-2 rounded-lg p-3 transition-all hover:border-orange-300">
                <input
                  type="radio"
                  value="female"
                  checked={profile.gender === 'female'}
                  onChange={(e) => setProfile({ ...profile, gender: e.target.value as any })}
                  className="text-orange-500 focus:ring-orange-500"
                />
                <span className="font-medium">Femenino</span>
              </label>
            </div>
          </div>
        </div>

        {/* Estilo de Vida */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <span className="text-orange-500">🏃</span> Estilo de Vida
          </h3>
          
          {/* Nivel de Actividad */}
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-2">
              Nivel de Actividad Física *
            </label>
            <select
              value={profile.activityLevel}
              onChange={(e) => setProfile({ ...profile, activityLevel: e.target.value as any })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-900"
              required
            >
              <option value="sedentary">🪑 Sedentario (poco ejercicio)</option>
              <option value="light">🚶 Ligera (1-3 días/semana)</option>
              <option value="moderate">🏃 Moderada (3-5 días/semana)</option>
              <option value="active">💪 Activa (6-7 días/semana)</option>
              <option value="very_active">🔥 Muy Activa (ejercicio intenso diario)</option>
            </select>
          </div>
        </div>

        {/* Objetivo */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <span className="text-orange-500">🎯</span> Tu Objetivo
          </h3>
          
          <div className="space-y-3">
            <label className={`flex items-center gap-3 cursor-pointer border-2 rounded-lg p-4 transition-all ${profile.goal === 'lose_fat' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}>
              <input
                type="radio"
                value="lose_fat"
                checked={profile.goal === 'lose_fat'}
                onChange={(e) => setProfile({ ...profile, goal: e.target.value as any })}
                className="text-orange-500 focus:ring-orange-500"
              />
              <TrendingDown className="w-5 h-5 text-red-500" />
              <div className="flex-1">
                <div className="font-semibold">Perder Grasa</div>
                <div className="text-xs text-slate-600">Déficit calórico moderado</div>
              </div>
            </label>

            <label className={`flex items-center gap-3 cursor-pointer border-2 rounded-lg p-4 transition-all ${profile.goal === 'maintain' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}>
              <input
                type="radio"
                value="maintain"
                checked={profile.goal === 'maintain'}
                onChange={(e) => setProfile({ ...profile, goal: e.target.value as any })}
                className="text-orange-500 focus:ring-orange-500"
              />
              <Minus className="w-5 h-5 text-blue-500" />
              <div className="flex-1">
                <div className="font-semibold">Mantener Peso</div>
                <div className="text-xs text-slate-600">Calorías de mantenimiento</div>
              </div>
            </label>

            <label className={`flex items-center gap-3 cursor-pointer border-2 rounded-lg p-4 transition-all ${profile.goal === 'gain_muscle' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}>
              <input
                type="radio"
                value="gain_muscle"
                checked={profile.goal === 'gain_muscle'}
                onChange={(e) => setProfile({ ...profile, goal: e.target.value as any })}
                className="text-orange-500 focus:ring-orange-500"
              />
              <TrendingUp className="w-5 h-5 text-green-500" />
              <div className="flex-1">
                <div className="font-semibold">Ganar Músculo</div>
                <div className="text-xs text-slate-600">Superávit calórico moderado</div>
              </div>
            </label>
          </div>
        </div>
        
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        
        {/* Botón */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Calcular y Guardar
            </>
          )}
        </button>
      </form>
    </div>
  );
}
