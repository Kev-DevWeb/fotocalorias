'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { Credit } from '../shell/AppShell';
import { ThemeToggle } from '../shell/ThemeToggle';
import { Button } from '../ui/Button';
import { Field, Logo } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';

type Mode = 'login' | 'register';

const MODES: { value: Mode; label: string }[] = [
  { value: 'login', label: 'Entrar' },
  { value: 'register', label: 'Crear cuenta' },
];

const AUTH_ERRORS: Record<string, string> = {
  'auth/email-already-in-use': 'Este correo ya está registrado.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/user-not-found': 'No hay una cuenta con ese correo.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a probar.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet e intenta de nuevo.',
};

function authMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  return AUTH_ERRORS[code] ?? 'No se pudo entrar. Intenta de nuevo.';
}

const STICKERS = [
  { emoji: '🌮', className: 'left-[6%] top-[14%] -rotate-12 bg-guayaba', delay: 0 },
  { emoji: '🥑', className: 'right-[8%] top-[10%] rotate-6 bg-card', delay: 0.6 },
  { emoji: '🍓', className: 'right-[14%] bottom-[12%] -rotate-6 bg-card', delay: 1.2 },
  { emoji: '🍳', className: 'left-[12%] bottom-[10%] rotate-12 bg-guayaba', delay: 1.8 },
];

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, displayName: string) => Promise<void>;
  onGuest: () => void;
  initialMode?: Mode;
}

export function AuthScreen({ onLogin, onRegister, onGuest, initialMode = 'login' }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isLogin = mode === 'login';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!isLogin && !displayName.trim()) {
      setError('Escribe tu nombre.');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) await onLogin(email, password);
      else await onRegister(email, password, displayName.trim());
    } catch (err) {
      console.error('Error de autenticación:', err);
      setError(authMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <section className="relative flex shrink-0 flex-col justify-end overflow-hidden border-b-2 border-sticker bg-mango px-6 pb-7 pt-10 text-sticker lg:w-1/2 lg:justify-center lg:border-b-0 lg:border-r-2 lg:px-16 lg:py-16">
        <div aria-hidden="true" className="absolute inset-0">
          {STICKERS.map(({ emoji, className, delay }) => (
            <motion.span
              key={emoji}
              className={`absolute hidden size-16 place-items-center rounded-[22px] border-2 border-sticker text-3xl shadow-[4px_4px_0_var(--sticker)] sm:grid lg:size-20 lg:text-4xl ${className}`}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay }}
            >
              {emoji}
            </motion.span>
          ))}
        </div>
        <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
          <div className="flex items-center gap-2.5">
            <Logo size={44} />
            <span className="font-display text-3xl font-extrabold leading-none tracking-tight">xCal</span>
          </div>
          <h1 className="mt-6 font-display text-[44px] font-extrabold leading-[0.95] tracking-tighter [text-wrap:balance] lg:text-7xl">Tu comida, en números.</h1>
          <p className="mt-3 max-w-sm text-base font-medium leading-relaxed lg:text-lg">
            Toma una foto o describe lo que comiste: la IA calcula calorías y macros, y tú llevas tu día.
          </p>
        </div>
      </section>

      <main className="flex flex-1 flex-col items-center px-5 py-7 lg:justify-center lg:px-16">
        <div className="flex w-full max-w-md flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[28px] font-extrabold leading-none tracking-tight">{isLogin ? 'Qué gusto verte' : 'Crea tu cuenta'}</h2>
            <ThemeToggle />
          </div>

          <Segmented
            label="Entrar o crear cuenta"
            options={MODES}
            value={mode}
            onChange={(next) => {
              setMode(next);
              setError('');
            }}
          />

          <form onSubmit={submit} className="flex flex-col gap-3.5">
            {!isLogin && (
              <Field id="auth-name" label="Nombre" autoComplete="name" placeholder="Tu nombre" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            )}
            <Field
              id="auth-email"
              label="Correo"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Field
              id="auth-password"
              label="Contraseña"
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              minLength={6}
              hint={isLogin ? undefined : 'Mínimo 6 caracteres.'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-2xl border-2 border-danger-fill bg-danger-soft px-3.5 py-3 text-sm font-semibold text-danger">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            <Button type="submit" variant="strong" size="lg" disabled={loading} className="mt-1">
              {loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
              {isLogin ? (loading ? 'Entrando…' : 'Entrar') : loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </form>

          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
            <span aria-hidden="true" className="h-0.5 flex-1 bg-line" />
            o
            <span aria-hidden="true" className="h-0.5 flex-1 bg-line" />
          </div>

          <Button variant="outline" size="lg" onClick={onGuest}>
            Probar sin cuenta
          </Button>

          <Credit className="pt-2 text-center" />
        </div>
      </main>
    </div>
  );
}
