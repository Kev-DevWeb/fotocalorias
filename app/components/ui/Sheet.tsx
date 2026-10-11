'use client';

import type { ReactNode } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Drawer } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buttonClasses } from './Button';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Rótulo pequeño sobre el título */
  eyebrow?: string;
  children: ReactNode;
}

/**
 * Hoja inferior en celular (se cierra arrastrándola hacia abajo) y diálogo
 * centrado en pantallas grandes.
 */
export function Sheet({ open, onOpenChange, title, eyebrow, children }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {/* Mantiene visible el campo enfocado cuando abre el teclado del celular */}
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-scrim opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:duration-0" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <Drawer.Popup
              className={cn(
                'flex max-h-[92dvh] w-full flex-col rounded-t-[32px] border-2 border-b-0 border-outline bg-card text-ink outline-none',
                '[transform:translateY(var(--drawer-swipe-movement-y))] transition-[transform,opacity] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
                'data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)] data-swiping:select-none',
                'sm:max-h-[88dvh] sm:rounded-[32px] sm:border-b-2 sm:shadow-sticker-lg',
                'sm:data-ending-style:opacity-0 sm:data-starting-style:opacity-0 sm:data-ending-style:[transform:translateY(32px)] sm:data-starting-style:[transform:translateY(32px)]',
                'sm:max-w-lg',
              )}
            >
              <div aria-hidden="true" className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-ink/25 sm:hidden" />
              <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-4">
                <div className="min-w-0 space-y-1.5">
                  {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.06em] text-ink-3">{eyebrow}</p>}
                  <Drawer.Title className="font-display text-[28px] font-extrabold leading-[1.05] tracking-tight [text-wrap:balance]">{title}</Drawer.Title>
                </div>
                <Drawer.Close aria-label="Cerrar" className={buttonClasses({ variant: 'outline', size: 'icon' })}>
                  <X className="size-5" aria-hidden="true" />
                </Drawer.Close>
              </div>
              <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                {children}
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
}

/** Confirmación de una acción que no se puede deshacer. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[60] min-h-dvh bg-scrim transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-[60] flex w-[22rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[28px] border-2 border-outline bg-card p-5 text-ink shadow-sticker-lg outline-none transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="space-y-1.5">
            <AlertDialog.Title className="font-display text-2xl font-extrabold leading-tight tracking-tight">{title}</AlertDialog.Title>
            {description && <AlertDialog.Description className="text-sm leading-relaxed text-ink-2">{description}</AlertDialog.Description>}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <AlertDialog.Close className={buttonClasses({ variant: 'outline' })}>Cancelar</AlertDialog.Close>
            <AlertDialog.Close className={buttonClasses({ variant: 'danger' })} onClick={onConfirm}>
              {confirmLabel}
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
