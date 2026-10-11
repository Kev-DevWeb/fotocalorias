import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases de Tailwind; las últimas ganan cuando chocan. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
