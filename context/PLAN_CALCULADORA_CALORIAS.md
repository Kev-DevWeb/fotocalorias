# 📊 Plan de Implementación: Calculadora de Calorías y Macronutrientes

## Objetivo
Implementar un sistema de cálculo personalizado de requerimientos calóricos y macronutrientes basado en datos biométricos del usuario (peso, estatura, edad, sexo) y su objetivo fitness (ganar músculo, perder grasa, o mantener peso).

---

## 🧮 Fórmulas y Metodología

### 1. Cálculo de Tasa Metabólica Basal (TMB)

La TMB es la cantidad de calorías que el cuerpo necesita en reposo para mantener funciones vitales.

#### Fórmula de Mifflin-St Jeor (Más precisa y recomendada)

**Para Hombres:**
```
TMB = (10 × peso_kg) + (6.25 × altura_cm) - (5 × edad) + 5
```

**Para Mujeres:**
```
TMB = (10 × peso_kg) + (6.25 × altura_cm) - (5 × edad) - 161
```

**Ejemplo:**
- Hombre de 75 kg, 175 cm, 30 años
- TMB = (10 × 75) + (6.25 × 175) - (5 × 30) + 5
- TMB = 750 + 1093.75 - 150 + 5 = **1698.75 kcal/día**

---

### 2. Cálculo de Gasto Energético Total Diario (TDEE)

El TDEE es la TMB multiplicada por un factor de actividad física.

#### Factores de Actividad (Multiplicadores)

| Nivel de Actividad | Factor | Descripción |
|-------------------|--------|-------------|
| Sedentario | 1.2 | Poco o ningún ejercicio |
| Ligera | 1.375 | Ejercicio ligero 1-3 días/semana |
| Moderada | 1.55 | Ejercicio moderado 3-5 días/semana |
| Activa | 1.725 | Ejercicio intenso 6-7 días/semana |
| Muy Activa | 1.9 | Ejercicio muy intenso, trabajo físico |

**Fórmula:**
```
TDEE = TMB × Factor_Actividad
```

**Ejemplo (continuando del anterior):**
- TMB = 1698.75 kcal
- Actividad Moderada (1.55)
- TDEE = 1698.75 × 1.55 = **2633 kcal/día**

---

### 3. Ajustes según Objetivo Fitness

#### A) Ganar Músculo (Superávit Calórico)
```
Calorías_Objetivo = TDEE + (300 a 500 kcal)
```
- Superávit moderado: +300 kcal (ganancia más limpia)
- Superávit agresivo: +500 kcal (ganancia más rápida)

**Distribución de Macronutrientes:**
- **Proteína**: 2.0 - 2.2 g/kg de peso corporal
- **Grasa**: 25-30% del total de calorías
- **Carbohidratos**: El resto de las calorías

**Ejemplo (75 kg, TDEE 2633 kcal, superávit +300):**
- Calorías objetivo: 2933 kcal
- Proteína: 75 × 2.2 = 165 g (660 kcal)
- Grasa: 2933 × 0.27 = 792 kcal ÷ 9 = 88 g
- Carbohidratos: (2933 - 660 - 792) ÷ 4 = 370 g

#### B) Perder Grasa (Déficit Calórico)
```
Calorías_Objetivo = TDEE - (300 a 500 kcal)
```
- Déficit moderado: -300 kcal (pérdida sostenible ~0.3 kg/semana)
- Déficit agresivo: -500 kcal (pérdida rápida ~0.5 kg/semana)

**Distribución de Macronutrientes:**
- **Proteína**: 2.2 - 2.5 g/kg (mayor para preservar músculo)
- **Grasa**: 20-25% del total de calorías
- **Carbohidratos**: El resto de las calorías

**Ejemplo (75 kg, TDEE 2633 kcal, déficit -400):**
- Calorías objetivo: 2233 kcal
- Proteína: 75 × 2.4 = 180 g (720 kcal)
- Grasa: 2233 × 0.23 = 514 kcal ÷ 9 = 57 g
- Carbohidratos: (2233 - 720 - 514) ÷ 4 = 250 g

#### C) Mantener Peso (Mantenimiento)
```
Calorías_Objetivo = TDEE (sin ajuste)
```

**Distribución de Macronutrientes:**
- **Proteína**: 1.6 - 2.0 g/kg
- **Grasa**: 25-30% del total de calorías
- **Carbohidratos**: El resto de las calorías

**Ejemplo (75 kg, TDEE 2633 kcal):**
- Calorías objetivo: 2633 kcal
- Proteína: 75 × 1.8 = 135 g (540 kcal)
- Grasa: 2633 × 0.28 = 737 kcal ÷ 9 = 82 g
- Carbohidratos: (2633 - 540 - 737) ÷ 4 = 339 g

---

## 💻 Implementación en Código

### Archivo: `lib/calorie-calculator.ts`

```typescript
export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'gain_muscle' | 'lose_fat' | 'maintain';

export interface UserProfile {
  weight: number;        // kg
  height: number;        // cm
  age: number;           // años
  gender: Gender;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface MacroTargets {
  calories: number;
  protein: number;       // gramos
  carbs: number;         // gramos
  fat: number;           // gramos
}

// Factores de actividad física
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Calcula la Tasa Metabólica Basal (TMB) usando la fórmula de Mifflin-St Jeor
 */
function calculateBMR(profile: UserProfile): number {
  const { weight, height, age, gender } = profile;
  
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  
  if (gender === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }
  
  return Math.round(bmr);
}

/**
 * Calcula el Gasto Energético Total Diario (TDEE)
 */
function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  return Math.round(bmr * multiplier);
}

/**
 * Ajusta las calorías según el objetivo fitness
 */
function adjustCaloriesForGoal(tdee: number, goal: Goal): number {
  switch (goal) {
    case 'gain_muscle':
      return tdee + 350; // Superávit moderado
    case 'lose_fat':
      return tdee - 400; // Déficit moderado
    case 'maintain':
      return tdee;
    default:
      return tdee;
  }
}

/**
 * Calcula los macronutrientes objetivo
 */
function calculateMacros(
  targetCalories: number,
  weight: number,
  goal: Goal
): { protein: number; fat: number; carbs: number } {
  let proteinGrams: number;
  let fatPercentage: number;
  
  switch (goal) {
    case 'gain_muscle':
      proteinGrams = weight * 2.2; // 2.2g/kg
      fatPercentage = 0.27; // 27%
      break;
    case 'lose_fat':
      proteinGrams = weight * 2.4; // 2.4g/kg para preservar músculo
      fatPercentage = 0.23; // 23%
      break;
    case 'maintain':
      proteinGrams = weight * 1.8; // 1.8g/kg
      fatPercentage = 0.28; // 28%
      break;
    default:
      proteinGrams = weight * 1.8;
      fatPercentage = 0.28;
  }
  
  const proteinCalories = proteinGrams * 4; // 4 kcal/g
  const fatCalories = targetCalories * fatPercentage;
  const fatGrams = fatCalories / 9; // 9 kcal/g
  const carbCalories = targetCalories - proteinCalories - fatCalories;
  const carbGrams = carbCalories / 4; // 4 kcal/g
  
  return {
    protein: Math.round(proteinGrams),
    fat: Math.round(fatGrams),
    carbs: Math.round(carbGrams),
  };
}

/**
 * Función principal: Calcula todos los objetivos nutricionales
 */
export function calculateNutritionTargets(profile: UserProfile): MacroTargets {
  // 1. Calcular TMB
  const bmr = calculateBMR(profile);
  
  // 2. Calcular TDEE
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  
  // 3. Ajustar por objetivo
  const targetCalories = adjustCaloriesForGoal(tdee, profile.goal);
  
  // 4. Calcular macros
  const macros = calculateMacros(targetCalories, profile.weight, profile.goal);
  
  return {
    calories: targetCalories,
    ...macros,
  };
}

/**
 * Valida que el perfil sea válido
 */
export function validateProfile(profile: Partial<UserProfile>): string | null {
  if (!profile.weight || profile.weight < 30 || profile.weight > 300) {
    return 'Peso debe estar entre 30 y 300 kg';
  }
  
  if (!profile.height || profile.height < 100 || profile.height > 250) {
    return 'Estatura debe estar entre 100 y 250 cm';
  }
  
  if (!profile.age || profile.age < 15 || profile.age > 100) {
    return 'Edad debe estar entre 15 y 100 años';
  }
  
  if (!profile.gender || !['male', 'female'].includes(profile.gender)) {
    return 'Género debe ser masculino o femenino';
  }
  
  if (!profile.activityLevel || !Object.keys(ACTIVITY_MULTIPLIERS).includes(profile.activityLevel)) {
    return 'Nivel de actividad inválido';
  }
  
  if (!profile.goal || !['gain_muscle', 'lose_fat', 'maintain'].includes(profile.goal)) {
    return 'Objetivo inválido';
  }
  
  return null; // Sin errores
}

/**
 * Calcula el progreso hacia los objetivos diarios (para el dashboard)
 */
export interface DailyProgress {
  calories: { consumed: number; target: number; remaining: number; percentage: number };
  protein: { consumed: number; target: number; remaining: number; percentage: number };
  carbs: { consumed: number; target: number; remaining: number; percentage: number };
  fat: { consumed: number; target: number; remaining: number; percentage: number };
}

export function calculateDailyProgress(
  consumed: { calories: number; protein: number; carbs: number; fat: number },
  targets: MacroTargets
): DailyProgress {
  const calculateMetric = (consumed: number, target: number) => ({
    consumed,
    target,
    remaining: Math.max(0, target - consumed),
    percentage: Math.round((consumed / target) * 100),
  });
  
  return {
    calories: calculateMetric(consumed.calories, targets.calories),
    protein: calculateMetric(consumed.protein, targets.protein),
    carbs: calculateMetric(consumed.carbs, targets.carbs),
    fat: calculateMetric(consumed.fat, targets.fat),
  };
}
```

---

## 🎨 Componente de UI: Formulario de Perfil

### Archivo: `app/components/ProfileSetup.tsx`

```typescript
"use client";

import React, { useState } from 'react';
import { UserProfile, calculateNutritionTargets, validateProfile, MacroTargets } from '@/lib/calorie-calculator';
import { User, Save } from 'lucide-react';

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
    try {
      await onSave(profile as UserProfile, targets);
    } catch (err) {
      setError('Error al guardar el perfil. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-8 h-8 text-orange-500" />
        <h2 className="text-2xl font-bold">Configura tu Perfil</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Peso */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Peso (kg) *
          </label>
          <input
            type="number"
            value={profile.weight || ''}
            onChange={(e) => setProfile({ ...profile, weight: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="75"
            min="30"
            max="300"
            required
          />
        </div>
        
        {/* Estatura */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estatura (cm) *
          </label>
          <input
            type="number"
            value={profile.height || ''}
            onChange={(e) => setProfile({ ...profile, height: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="175"
            min="100"
            max="250"
            required
          />
        </div>
        
        {/* Edad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Edad (años) *
          </label>
          <input
            type="number"
            value={profile.age || ''}
            onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="30"
            min="15"
            max="100"
            required
          />
        </div>
        
        {/* Sexo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sexo *
          </label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="male"
                checked={profile.gender === 'male'}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value as any })}
                className="mr-2"
              />
              <span>Masculino</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="female"
                checked={profile.gender === 'female'}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value as any })}
                className="mr-2"
              />
              <span>Femenino</span>
            </label>
          </div>
        </div>
        
        {/* Nivel de Actividad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nivel de Actividad Física *
          </label>
          <select
            value={profile.activityLevel}
            onChange={(e) => setProfile({ ...profile, activityLevel: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            required
          >
            <option value="sedentary">Sedentario (poco ejercicio)</option>
            <option value="light">Ligera (1-3 días/semana)</option>
            <option value="moderate">Moderada (3-5 días/semana)</option>
            <option value="active">Activa (6-7 días/semana)</option>
            <option value="very_active">Muy Activa (ejercicio intenso diario)</option>
          </select>
        </div>
        
        {/* Objetivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Objetivo Fitness *
          </label>
          <select
            value={profile.goal}
            onChange={(e) => setProfile({ ...profile, goal: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            required
          >
            <option value="lose_fat">Perder Grasa 🔥</option>
            <option value="maintain">Mantener Peso ⚖️</option>
            <option value="gain_muscle">Ganar Músculo 💪</option>
          </select>
        </div>
        
        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {/* Botón */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>Guardando...</>
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
```

---

## 📊 Componente de UI: Dashboard de Progreso

### Archivo: `app/components/ProgressDashboard.tsx`

```typescript
"use client";

import React from 'react';
import { DailyProgress } from '@/lib/calorie-calculator';
import { Flame, Target } from 'lucide-react';

interface ProgressDashboardProps {
  progress: DailyProgress;
}

export default function ProgressDashboard({ progress }: ProgressDashboardProps) {
  const MacroBar = ({ 
    label, 
    consumed, 
    target, 
    percentage, 
    color 
  }: { 
    label: string; 
    consumed: number; 
    target: number; 
    percentage: number; 
    color: string; 
  }) => {
    const isComplete = percentage >= 100;
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm text-gray-600">
            {consumed} / {target}g {isComplete && '✓'}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color} ${isComplete ? 'animate-pulse' : ''}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 text-right">
          {percentage}%
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Calorías Principales */}
      <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Flame className="w-6 h-6" />
          <span className="text-sm font-medium opacity-90">Calorías del Día</span>
        </div>
        <div className="flex items-end gap-3 mb-4">
          <span className="text-5xl font-bold">{progress.calories.consumed}</span>
          <span className="text-2xl opacity-80 mb-2">/ {progress.calories.target} kcal</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-4 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all"
            style={{ width: `${Math.min(progress.calories.percentage, 100)}%` }}
          />
        </div>
        <div className="mt-3 flex justify-between text-sm">
          <span>{progress.calories.remaining > 0 ? `${progress.calories.remaining} kcal restantes` : '¡Meta alcanzada!'}</span>
          <span>{progress.calories.percentage}%</span>
        </div>
      </div>
      
      {/* Macronutrientes */}
      <div className="bg-white rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-orange-500" />
          <h3 className="font-bold text-gray-800">Macronutrientes</h3>
        </div>
        
        <MacroBar
          label="Proteína"
          consumed={progress.protein.consumed}
          target={progress.protein.target}
          percentage={progress.protein.percentage}
          color="bg-blue-500"
        />
        
        <MacroBar
          label="Carbohidratos"
          consumed={progress.carbs.consumed}
          target={progress.carbs.target}
          percentage={progress.carbs.percentage}
          color="bg-green-500"
        />
        
        <MacroBar
          label="Grasas"
          consumed={progress.fat.consumed}
          target={progress.fat.target}
          percentage={progress.fat.percentage}
          color="bg-yellow-500"
        />
      </div>
    </div>
  );
}
```

---

## ✅ Checklist de Implementación

### Backend
- [ ] Crear `lib/calorie-calculator.ts` con todas las fórmulas
- [ ] Implementar `calculateNutritionTargets()`
- [ ] Implementar `calculateDailyProgress()`
- [ ] Agregar validación de datos de perfil
- [ ] Tests unitarios para fórmulas

### Firebase
- [ ] Actualizar estructura de `users` collection con `profile` y `targets`
- [ ] Crear función Cloud para recalcular objetivos
- [ ] Actualizar reglas de Firestore
- [ ] Agregar índices necesarios

### Frontend
- [ ] Componente `ProfileSetup` para onboarding
- [ ] Componente `ProgressDashboard` para visualización
- [ ] Integrar calculadora al flujo de registro
- [ ] Guardar targets en Firestore al configurar perfil
- [ ] Cargar targets al iniciar sesión
- [ ] Actualizar dashboard principal con barras de progreso

### UX
- [ ] Pantalla de onboarding al primer login
- [ ] Botón para editar perfil
- [ ] Confirmación al cambiar objetivo (recalcula todo)
- [ ] Animaciones para barras de progreso
- [ ] Notificación cuando se alcanza meta diaria

---

## 📚 Referencias Científicas

- [Mifflin-St Jeor Equation](https://pubmed.ncbi.nlm.nih.gov/2305711/)
- [Protein Requirements for Athletes](https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8)
- [Energy Balance and Body Composition](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5786199/)

---

**Última actualización**: 19 de noviembre de 2025
