import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Tarjeta base: fondo de tarjeta con contorno. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[26px] border-2 border-outline bg-card', className)} {...props} />;
}

const CHIP_TONES = {
  neutral: 'border-2 border-outline bg-card text-ink',
  inverse: 'bg-inverse text-on-inverse',
  guayaba: 'border-2 border-sticker bg-guayaba text-sticker',
  mango: 'border-2 border-sticker bg-mango text-sticker',
  good: 'bg-fat-soft text-ink',
  water: 'border-2 border-outline bg-water-soft text-ink',
} as const;

export function Chip({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof CHIP_TONES }) {
  return (
    <span
      className={cn('inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold', CHIP_TONES[tone], className)}
      {...props}
    />
  );
}

/** Texto pequeño en mayúsculas para rotular secciones y fechas. */
export function Overline({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs font-bold uppercase tracking-[0.08em] text-ink-3', className)} {...props} />;
}

export const inputClasses =
  'h-13 w-full rounded-2xl border-2 border-outline bg-ground px-3.5 text-base text-ink placeholder:text-ink-3 focus-visible:outline-offset-0';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
}

/** Campo de texto con su etiqueta. */
export function Field({ label, hint, id, className, ...props }: FieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold">
        {label}
      </label>
      <input id={id} className={cn(inputClasses, className)} {...props} />
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

/** Marca de xCal: un mango mordido. */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg role="img" aria-label="xCal" width={size} height={size} viewBox="0 0 40 40" className={className}>
      <rect width="40" height="40" rx="13" fill="var(--sticker)" />
      <circle cx="19" cy="21" r="10" fill="var(--mango)" />
      <circle cx="28" cy="13" r="5.5" fill="var(--sticker)" />
    </svg>
  );
}

const STICKER_TONES = ['bg-guayaba-soft', 'bg-mango-soft', 'bg-fat-soft', 'bg-water-soft'];
const STICKER_TILTS = ['-rotate-[5deg]', 'rotate-[4deg]', '-rotate-[3deg]', 'rotate-[6deg]'];

/** Emoji de comida como pegatina. `index` varía el color y la inclinación entre vecinas. */
export function FoodSticker({ emoji, index = 0, size = 'md', className }: { emoji: string; index?: number; size?: 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = { md: 'size-14 rounded-[18px] text-3xl', lg: 'size-[72px] rounded-[22px] text-4xl', xl: 'size-24 rounded-[30px] text-5xl' };
  return (
    <div
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center border-2 border-sticker',
        sizes[size],
        STICKER_TONES[index % STICKER_TONES.length],
        STICKER_TILTS[index % STICKER_TILTS.length],
        className,
      )}
    >
      {emoji}
    </div>
  );
}
