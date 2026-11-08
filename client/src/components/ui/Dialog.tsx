import * as RadixDialog from '@radix-ui/react-dialog';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Button } from './Button';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

const overlayClass = 'fixed inset-0 z-40 bg-slate-950/40 data-[state=open]:animate-fade-in';

function CloseButton() {
  return (
    <RadixDialog.Close
      aria-label="Chiudi"
      title="Chiudi"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    >
      <X className="size-5" aria-hidden="true" />
    </RadixDialog.Close>
  );
}

/** Centered modal dialog. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: BaseDialogProps & { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={overlayClass} />
        <RadixDialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={clsx(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[min(90dvh,860px)] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 data-[state=open]:animate-pop-in',
            size === 'sm' && 'max-w-md',
            size === 'md' && 'max-w-xl',
            size === 'lg' && 'max-w-3xl',
          )}
        >
          <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0 flex-1">
              <RadixDialog.Title className="text-lg font-semibold text-slate-900">{title}</RadixDialog.Title>
              {description && <RadixDialog.Description className="mt-1 text-sm text-slate-600">{description}</RadixDialog.Description>}
            </div>
            <CloseButton />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Side panel (right) or navigation drawer (left). Full width on small screens. */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = 'right',
  headerExtra,
  width = 'max-w-2xl',
}: BaseDialogProps & { side?: 'left' | 'right'; headerExtra?: ReactNode; width?: string }) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={overlayClass} />
        <RadixDialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={clsx(
            'fixed inset-y-0 z-50 flex w-full flex-col bg-white shadow-2xl',
            width,
            side === 'right' ? 'right-0 data-[state=open]:animate-slide-in-right' : 'left-0 data-[state=open]:animate-slide-in-left',
          )}
        >
          <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0 flex-1">
              <RadixDialog.Title className="text-lg font-semibold break-words text-slate-900">{title}</RadixDialog.Title>
              {description && <RadixDialog.Description className="mt-0.5 text-sm text-slate-600">{description}</RadixDialog.Description>}
            </div>
            {headerExtra}
            <CloseButton />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Confirmation dialog. With `requireText` the user must type a word to confirm (destructive actions). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annulla',
  tone = 'danger',
  loading = false,
  requireText,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  requireText?: string;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const [typed, setTyped] = useState('');
  const inputId = useId();
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const canConfirm = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !loading && onOpenChange(next)}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            disabled={!canConfirm}
            form={undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700">
        {description && <div>{description}</div>}
        {children}
        {requireText && (
          <div className="space-y-1.5">
            <label htmlFor={inputId} className="block font-medium text-slate-800">
              Per confermare scrivi <strong className="font-mono">{requireText}</strong>
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-slate-300 px-3 font-mono uppercase"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
