"use client";

import React from 'react';
import { DailyProgress } from '@/lib/calorie-calculator';
import { Flame, Target } from 'lucide-react';

interface ProgressDashboardProps {
  progress: DailyProgress;
}

const MacroBar = ({ 
  label, 
  consumed, 
  target, 
  percentage, 
  color,
  icon
}: { 
  label: string; 
  consumed: number; 
  target: number; 
  percentage: number; 
  color: string;
  icon: string;
}) => {
  const isComplete = percentage >= 100;
  const isOverTarget = percentage > 100;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
          <span>{icon}</span>
          {label}
        </span>
        <span className={`text-sm font-semibold ${isOverTarget ? 'text-red-600' : 'text-gray-600'}`}>
          {consumed} / {target}g {isComplete && !isOverTarget && '✓'}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color} ${isComplete && !isOverTarget ? 'animate-pulse' : ''}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="flex justify-between items-center">
        <div className={`text-xs font-medium ${isOverTarget ? 'text-red-500' : 'text-gray-500'}`}>
          {isOverTarget ? `+${Math.round((consumed - target) * 10) / 10}g sobre el objetivo` : `${Math.round((target - consumed) * 10) / 10}g restantes`}
        </div>
        <div className={`text-xs font-bold ${isOverTarget ? 'text-red-600' : 'text-gray-600'}`}>
          {percentage}%
        </div>
      </div>
    </div>
  );
};

export default function ProgressDashboard({ progress }: ProgressDashboardProps) {
  const caloriesIsOver = progress.calories.percentage > 100;
  const caloriesRemaining = progress.calories.remaining;

  return (
    <div className="space-y-6">
      {/* Calorías Principales */}
      <div className={`rounded-xl p-6 shadow-lg text-white transition-all ${
        caloriesIsOver 
          ? 'bg-gradient-to-br from-red-500 to-red-600' 
          : 'bg-gradient-to-br from-orange-500 to-red-500'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6" />
            <span className="text-sm font-medium opacity-90">Calorías del Día</span>
          </div>
          {progress.calories.percentage >= 90 && (
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-medium">
              {progress.calories.percentage >= 100 ? '¡Meta alcanzada!' : '¡Casi!'}
            </span>
          )}
        </div>
        
        <div className="flex items-end gap-3 mb-4">
          <span className="text-5xl font-bold">{progress.calories.consumed}</span>
          <span className="text-2xl opacity-80 mb-2">/ {progress.calories.target}</span>
          <span className="text-lg opacity-70 mb-2">kcal</span>
        </div>
        
        <div className="w-full bg-white/20 rounded-full h-4 overflow-hidden backdrop-blur-sm">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress.calories.percentage, 100)}%` }}
          />
        </div>
        
        <div className="mt-3 flex justify-between text-sm font-medium">
          {caloriesIsOver ? (
            <>
              <span>⚠️ {progress.calories.consumed - progress.calories.target} kcal sobre el objetivo</span>
              <span>{progress.calories.percentage}%</span>
            </>
          ) : caloriesRemaining > 0 ? (
            <>
              <span>🎯 {caloriesRemaining} kcal restantes</span>
              <span>{progress.calories.percentage}%</span>
            </>
          ) : (
            <>
              <span>✅ ¡Objetivo cumplido!</span>
              <span>100%</span>
            </>
          )}
        </div>
      </div>
      
      {/* Macronutrientes */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-gray-800">Macronutrientes</h3>
          </div>
          <div className="text-xs text-gray-500">
            Objetivos diarios
          </div>
        </div>
        
        <MacroBar
          label="Proteína"
          consumed={progress.protein.consumed}
          target={progress.protein.target}
          percentage={progress.protein.percentage}
          color="bg-blue-500"
          icon="🥩"
        />
        
        <MacroBar
          label="Carbohidratos"
          consumed={progress.carbs.consumed}
          target={progress.carbs.target}
          percentage={progress.carbs.percentage}
          color="bg-green-500"
          icon="🍚"
        />
        
        <MacroBar
          label="Grasas"
          consumed={progress.fat.consumed}
          target={progress.fat.target}
          percentage={progress.fat.percentage}
          color="bg-yellow-500"
          icon="🥑"
        />
        
        <MacroBar
          label="Azúcar"
          consumed={progress.sugar.consumed}
          target={progress.sugar.target}
          percentage={progress.sugar.percentage}
          color="bg-pink-500"
          icon="🍬"
        />
        
        <MacroBar
          label="Fibra"
          consumed={progress.fiber.consumed}
          target={progress.fiber.target}
          percentage={progress.fiber.percentage}
          color="bg-purple-500"
          icon="🌾"
        />
        
        <MacroBar
          label="Sodio"
          consumed={progress.sodium.consumed}
          target={progress.sodium.target}
          percentage={progress.sodium.percentage}
          color="bg-red-500"
          icon="🧂"
        />
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{progress.protein.percentage}%</div>
          <div className="text-xs text-blue-700 font-medium">Proteína</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{progress.carbs.percentage}%</div>
          <div className="text-xs text-green-700 font-medium">Carbos</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{progress.fat.percentage}%</div>
          <div className="text-xs text-yellow-700 font-medium">Grasas</div>
        </div>
        <div className="bg-pink-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-pink-600">{progress.sugar.percentage}%</div>
          <div className="text-xs text-pink-700 font-medium">Azúcar</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">{progress.fiber.percentage}%</div>
          <div className="text-xs text-purple-700 font-medium">Fibra</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{progress.sodium.percentage}%</div>
          <div className="text-xs text-red-700 font-medium">Sodio</div>
        </div>
      </div>
    </div>
  );
}
