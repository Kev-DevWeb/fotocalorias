import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const VARIANTS = {
  /** Acción principal: pegatina mango con sombra dura */
  primary: 'border-2 border-sticker bg-mango text-sticker shadow-sticker',
  /** Acción fuerte sobre fondos claros (login) */
  strong: 'border-2 border-inverse bg-inverse text-on-inverse shadow-sticker-mango',
  outline: 'border-2 border-outline bg-card text-ink hover:bg-ground',
  ghost: 'text-ink-2 hover:bg-track hover:text-ink',
  danger: 'border-2 border-danger-fill bg-danger-soft text-danger',
} as const;

const SIZES = {
  sm: 'h-11 gap-1.5 rounded-2xl px-3.5 text-[13px]',
  md: 'h-12 gap-2 rounded-2xl px-5 text-[15px]',
  lg: 'h-14 gap-2 rounded-[18px] px-6 text-base',
  icon: 'size-11 rounded-2xl',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}

/** Clases del botón, para dárselas también a un enlace. */
export function buttonClasses({ variant = 'primary', size = 'md', className }: Pick<ButtonProps, 'variant' | 'size' | 'className'> = {}) {
  const pressable = variant === 'primary' || variant === 'strong';
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center font-bold transition-[translate,box-shadow,background-color,color] duration-100',
    'disabled:pointer-events-none disabled:opacity-50',
    // Al presionar, la pegatina "se hunde" sobre su sombra
    pressable ? 'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none' : 'active:scale-[0.97]',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
