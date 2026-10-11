'use client';

import { Target } from 'lucide-react';
import { motion } from 'motion/react';
import type { DailyProgress } from '@/lib/calorie-calculator';
import type { CalorieLog } from '@/lib/types';
import { ThemeToggle } from '../shell/ThemeToggle';
import { Button } from '../ui/Button';
import { Card, Overline } from '../ui/primitives';
import { DayStrip } from './DayStrip';
import { MealList } from './MealList';
import { ActivityCard, CalorieHero, HydrationCard, MacroGrid, OtherNutrients, type ActivityState } from './TodayCards';

interface TodayScreenProps {
  displayName: string;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  /** null mientras el usuario no tenga objetivos calculados */
  progress: DailyProgress | null;
  water: { current: number; target: number; onChange: (deltaMl: number) => void };
  activity: ActivityState;
  logs: CalorieLog[];
  onHuawei: (log: CalorieLog) => void;
  onDeleteLog: (log: CalorieLog) => void;
  onEditProfile: () => void;
}

// Las tarjetas entran una tras otra al abrir la pantalla
const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 30 } } };

export function TodayScreen({ displayName, selectedDate, onSelectDate, progress, water, activity, logs, onHuawei, onDeleteLog, onEditProfile }: TodayScreenProps) {
  const today = new Date();
  const isToday = selectedDate.toDateString() === today.toDateString();
  const dateLabel = selectedDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <Overline>{dateLabel}</Overline>
            <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight lg:text-5xl">Hola, {displayName}</h1>
          </div>
          <ThemeToggle className="lg:hidden" />
        </div>
        <div className="flex flex-col items-stretch gap-2 lg:w-[460px] lg:items-end">
          <DayStrip selected={selectedDate} onSelect={onSelectDate} className="w-full" />
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => onSelectDate(today)} className="h-9 self-center lg:self-end">
              Volver a hoy
            </Button>
          )}
        </div>
      </header>

      {/*
        En celular todo va en una sola columna y las comidas quedan al final (por eso los `order`).
        En pantallas grandes hay dos columnas independientes: calorías y comidas a la izquierda,
        macros, agua y actividad a la derecha.
      */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-3 lg:items-start lg:gap-5">
        <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-6">
          <motion.div variants={item} className="order-1">
            {progress ? (
              <CalorieHero calories={progress.calories} activity={activity.connected ? activity.caloriesBurned : null} canCelebrate={isToday} />
            ) : (
              <Card className="flex flex-col items-start gap-3 p-5">
                <div aria-hidden="true" className="grid size-12 -rotate-[4deg] place-items-center rounded-2xl border-2 border-sticker bg-mango text-sticker">
                  <Target className="size-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-display text-xl font-bold">Aún no tienes objetivos</h2>
                  <p className="text-sm text-ink-2">Configura tu perfil para calcular tus calorías y macros del día.</p>
                </div>
                <Button onClick={onEditProfile}>Configurar perfil</Button>
              </Card>
            )}
          </motion.div>
          <motion.div variants={item} className="order-6 mt-2 lg:mt-0">
            <MealList logs={logs} isToday={isToday} onHuawei={onHuawei} onDelete={onDeleteLog} />
          </motion.div>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-5">
          {progress && (
            <>
              <motion.div variants={item} className="order-2">
                <MacroGrid progress={progress} />
              </motion.div>
              <motion.div variants={item} className="order-3">
                <OtherNutrients progress={progress} />
              </motion.div>
            </>
          )}
          <motion.div variants={item} className="order-4">
            <HydrationCard {...water} />
          </motion.div>
          <motion.div variants={item} className="order-5">
            <ActivityCard {...activity} />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
