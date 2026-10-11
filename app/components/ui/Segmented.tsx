'use client';

import { useId } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';

interface SegmentedProps<T extends string> {
  /** Nombre del grupo para lectores de pantalla */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

/** Selector de una opción entre pocas; la pastilla se desliza a la elegida. */
export function Segmented<T extends string>({ label, options, value, onChange, size = 'md', className }: SegmentedProps<T>) {
  const pillId = useId();
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid gap-1 rounded-[18px] border-2 border-outline bg-ground p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn('relative rounded-xl px-1 font-bold', size === 'md' ? 'h-11 text-sm' : 'h-10 text-[13px]')}
          >
            {selected && (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 rounded-xl bg-inverse"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            <span className={cn('relative transition-colors', selected ? 'text-on-inverse' : 'text-ink')}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
