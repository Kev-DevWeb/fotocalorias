'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

/** Tema claro/oscuro, movimiento (respeta "reducir movimiento" del sistema) y avisos. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            unstyled: true,
            classNames: {
              toast: 'flex w-full items-center gap-3 rounded-2xl border-2 border-sticker bg-card px-4 py-3 text-sm font-semibold text-ink shadow-sticker-sm',
              title: 'text-ink',
              description: 'font-normal text-ink-2',
              success: '[&_[data-icon]]:text-fat',
              error: '[&_[data-icon]]:text-danger',
            },
          }}
        />
      </MotionConfig>
    </ThemeProvider>
  );
}
