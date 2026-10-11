'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Activity, Equal, Loader2, LogOut, Save, TrendingDown, TrendingUp, TriangleAlert, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  calculateNutritionTargets,
  validateProfile,
  type ActivityLevel,
  type Gender,
  type Goal,
  type MacroTargets,
  type UserProfile,
} from '@/lib/calorie-calculator';
import { cn } from '@/lib/cn';
import { Credit } from '../shell/AppShell';
import { ThemeSelect } from '../shell/ThemeToggle';
import { Button } from '../ui/Button';
import { AnimatedNumber, MacroDot, type MacroKey } from '../ui/dataviz';
import { Card, Chip, Field, Logo, Overline } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';
import { ConfirmDialog } from '../ui/Sheet';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Femenino' },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; detail: string }[] = [
  { value: 'sedentary', label: 'Sedentario', detail: 'Poco o nada de ejercicio' },
  { value: 'light', label: 'Ligera', detail: '1 a 3 días por semana' },
  { value: 'moderate', label: 'Moderada', detail: '3 a 5 días por semana' },
  { value: 'active', label: 'Activa', detail: '6 a 7 días por semana' },
  { value: 'very_active', label: 'Muy activa', detail: 'Ejercicio intenso a diario' },
];

const GOALS: { value: Goal; label: string; detail: string; icon: LucideIcon }[] = [
  { value: 'lose_fat', label: 'Perder grasa', detail: 'Déficit calórico moderado', icon: TrendingDown },
  { value: 'maintain', label: 'Mantener peso', detail: 'Calorías de mantenimiento', icon: Equal },
  { value: 'gain_muscle', label: 'Ganar músculo', detail: 'Superávit calórico moderado', icon: TrendingUp },
];

const MACROS: [MacroKey, string][] = [
  ['protein', 'Proteína'],
  ['carbs', 'Carbos'],
  ['fat', 'Grasas'],
];

interface ProfileScreenProps {
  displayName: string;
  email: string;
  profile?: UserProfile;
  targets?: MacroTargets;
  /** Lanza si no se pudo guardar */
  onSave: (profile: UserProfile, targets: MacroTargets) => Promise<void>;
  /** Primera vez: aún no hay perfil, así que no hay navegación alrededor */
  onboarding?: boolean;
  fit: { connected: boolean; onConnect: () => void; onDisconnect: () => void };
  onLogout: () => void;
}

/** Datos del usuario, sus metas calculadas, apariencia y conexión con Google Fit. */
export function ProfileScreen({ displayName, email, profile, targets, onSave, onboarding, fit, onLogout }: ProfileScreenProps) {
  // Los números se guardan como texto para poder escribirlos libremente
  const [weight, setWeight] = useState(profile?.weight ? String(profile.weight) : '');
  const [height, setHeight] = useState(profile?.height ? String(profile.height) : '');
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '');
  const [gender, setGender] = useState<Gender>(profile?.gender ?? 'male');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile?.activityLevel ?? 'moderate');
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? 'maintain');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const draft: UserProfile = { weight: Number(weight), height: Number(height), age: Number(age), gender, activityLevel, goal };
  const draftIsValid = validateProfile(draft) === null;
  const changed = !profile || (Object.keys(draft) as (keyof UserProfile)[]).some((key) => draft[key] !== profile[key]);
  // Las metas se recalculan mientras se edita, antes de guardar; sin cambios se muestran las guardadas
  const preview = changed && draftIsValid ? calculateNutritionTargets(draft) : null;
  const shownTargets = preview ?? targets;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const validationError = validateProfile(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft, calculateNutritionTargets(draft));
      toast.success(onboarding ? '¡Listo! Ya tienes tus metas' : 'Perfil guardado');
    } catch (err) {
      console.error('Error al guardar el perfil:', err);
      setError('No se pudo guardar el perfil. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-5 lg:gap-6', onboarding && 'mx-auto min-h-dvh w-full max-w-xl px-4 pb-10 pt-6 lg:max-w-5xl lg:px-10')}>
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          {onboarding ? (
            <div className="mb-4 flex items-center gap-2.5">
              <Logo />
              <span className="font-display text-[28px] font-extrabold leading-none tracking-tight">xCal</span>
            </div>
          ) : (
            <Overline>Perfil y objetivos</Overline>
          )}
          <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight [text-wrap:balance] lg:text-5xl">
            {onboarding ? `Hola, ${displayName}. Cuéntanos de ti` : 'Tu perfil'}
          </h1>
          {onboarding && <p className="max-w-md text-[15px] leading-relaxed text-ink-2">Con estos datos calculamos tus calorías y macros del día. Puedes cambiarlos cuando quieras.</p>}
        </div>
        {onboarding && (
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="size-4" aria-hidden="true" />
            Salir
          </Button>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
        <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-[28px] border-2 border-outline bg-card p-4 lg:col-span-3 lg:p-6">
          <Group title="Tus datos">
            <div className="grid grid-cols-3 gap-3">
              <Field id="profile-weight" label="Peso (kg)" type="number" inputMode="decimal" step="0.1" min={30} max={300} placeholder="75" value={weight} onChange={(e) => setWeight(e.target.value)} />
              <Field id="profile-height" label="Estatura (cm)" type="number" inputMode="numeric" min={100} max={250} placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} />
              <Field id="profile-age" label="Edad" type="number" inputMode="numeric" min={15} max={100} placeholder="30" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[13px] font-bold">Sexo</p>
              <Segmented label="Sexo" options={GENDERS} value={gender} onChange={setGender} />
            </div>
          </Group>

          <Group title="Actividad física">
            <ChoiceList name="activity" label="Nivel de actividad física" options={ACTIVITY_LEVELS} value={activityLevel} onChange={setActivityLevel} columns />
          </Group>

          <Group title="Tu objetivo">
            <ChoiceList name="goal" label="Objetivo" options={GOALS} value={goal} onChange={setGoal} />
          </Group>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl border-2 border-danger-fill bg-danger-soft px-3.5 py-3 text-sm font-semibold text-danger">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={saving}>
            {saving ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Save className="size-5" aria-hidden="true" />}
            {saving ? 'Guardando…' : onboarding ? 'Calcular mis metas' : 'Guardar cambios'}
          </Button>
        </form>

        {/* En celular la meta va arriba del formulario; en pantallas grandes, en la columna derecha */}
        <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-4">
          <section aria-label="Meta diaria" className="order-first rounded-[28px] border-2 border-sticker bg-mango p-5 text-sticker shadow-sticker-lg lg:order-none">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold">Tu meta diaria</h2>
              {preview && <span className="rounded-full bg-sticker px-2.5 py-1 text-xs font-bold text-[#faf4e6]">Sin guardar</span>}
            </div>
            {shownTargets ? (
              <>
                <p className="mt-2 flex items-baseline gap-2">
                  <AnimatedNumber value={shownTargets.calories} className="font-display text-[64px] font-extrabold leading-none tracking-tighter" />
                  <span className="text-lg font-bold">kcal</span>
                </p>
                <dl className="mt-4 grid grid-cols-3 overflow-hidden rounded-[20px] border-2 border-sticker bg-card text-ink">
                  {MACROS.map(([macro, label], i) => (
                    <div key={macro} className={cn('px-2.5 py-2.5', i > 0 && 'border-l-2 border-sticker')}>
                      <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                        <MacroDot macro={macro} className="size-2" />
                        {label}
                      </dt>
                      <dd className="font-display text-xl font-bold">
                        <AnimatedNumber value={shownTargets[macro]} /> g
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="mt-2 text-[15px] font-medium leading-relaxed">Completa peso, estatura y edad para ver tus calorías y macros.</p>
            )}
          </section>

          {!onboarding && (
            <>
              <Card className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[14px] border-2 border-sticker bg-guayaba text-sticker">
                    <Activity className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <h2 className="text-[15px] font-bold">Google Fit</h2>
                    <p className="text-[13px] text-ink-2">Suma a tu meta las calorías que gastas en ejercicio.</p>
                  </div>
                  {fit.connected && <Chip tone="good">Conectado</Chip>}
                </div>
                {fit.connected ? (
                  <Button variant="outline" onClick={() => setConfirmDisconnect(true)}>
                    Desconectar
                  </Button>
                ) : (
                  <Button variant="outline" onClick={fit.onConnect}>
                    Conectar Google Fit
                  </Button>
                )}
              </Card>

              <Card className="flex flex-col gap-3 p-4 lg:hidden">
                <h2 className="text-[15px] font-bold">Apariencia</h2>
                <ThemeSelect />
              </Card>

              <Card className="flex items-center gap-3 p-4">
                <div aria-hidden="true" className="grid size-11 shrink-0 -rotate-[4deg] place-items-center rounded-2xl border-2 border-sticker bg-guayaba font-display text-xl font-extrabold text-sticker">
                  {displayName.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{displayName}</p>
                  <p className="truncate text-[13px] text-ink-2">{email}</p>
                </div>
                <Button variant="outline" size="sm" onClick={onLogout}>
                  <LogOut className="size-4" aria-hidden="true" />
                  Salir
                </Button>
              </Card>

              <Credit className="text-center lg:hidden" />
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="¿Desconectar Google Fit?"
        description="Tu meta dejará de ajustarse con el ejercicio y ya no se enviarán tus comidas ni tu agua a Google Fit."
        confirmLabel="Desconectar"
        onConfirm={fit.onDisconnect}
      />
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {children}
    </div>
  );
}

interface ChoiceListProps<T extends string> {
  name: string;
  label: string;
  options: readonly { value: T; label: string; detail: string; icon?: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
  /** Dos columnas cuando hay espacio */
  columns?: boolean;
}

/** Opciones excluyentes como tarjetas; por dentro son botones de radio nativos. */
function ChoiceList<T extends string>({ name, label, options, value, onChange, columns }: ChoiceListProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-2', columns && 'sm:grid-cols-2')}>
      {options.map(({ value: optionValue, label: optionLabel, detail, icon: Icon }) => {
        const selected = optionValue === value;
        return (
          <label
            key={optionValue}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-[18px] border-2 px-3.5 py-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-water',
              selected ? 'border-sticker bg-mango text-sticker shadow-[3px_3px_0_var(--shadow)]' : 'border-outline bg-ground hover:bg-track',
            )}
          >
            <input type="radio" name={name} value={optionValue} checked={selected} onChange={() => onChange(optionValue)} className="sr-only" />
            {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-tight">{optionLabel}</span>
              <span className={cn('block text-[13px] leading-snug', selected ? 'text-sticker' : 'text-ink-2')}>{detail}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
