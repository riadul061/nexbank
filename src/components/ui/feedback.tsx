'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { dismissToast } from '@/features/ui/uiSlice';
import { Button, Textarea, Field } from './primitives';
import { cn } from '@/lib/utils';

export function ProgressBar() {
  const busy = useAppSelector((s) => s.ui.inflight > 0);
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(busy), busy ? 150 : 0); return () => clearTimeout(t); }, [busy]);
  if (!show) return null;
  return <div className="fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-brand/20"><div className="h-full w-1/2 bg-brand" style={{ animation: 'bar 1s ease-in-out infinite' }} /></div>;
}

const ICON = { success: CheckCircle2, error: XCircle, info: Info };
const COLOR = { success: 'text-success', error: 'text-danger', info: 'text-info' };
export function ToastHost() {
  const toasts = useAppSelector((s) => s.ui.toasts);
  const dispatch = useAppDispatch();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(92vw,22rem)] flex-col gap-2">
      {toasts.map((t) => <ToastItem key={t.id} id={t.id} kind={t.kind} message={t.message} onClose={() => dispatch(dismissToast(t.id))} />)}
    </div>
  );
}
function ToastItem({ kind, message, onClose }: { id: string; kind: 'success' | 'error' | 'info'; message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, kind === 'error' ? 7000 : 4000); return () => clearTimeout(t); }, [kind, onClose]);
  const Icon = ICON[kind];
  return (
    <div role="status" className="anim-in pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-lg">
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', COLOR[kind])} />
      <p className="flex-1 text-sm">{message}</p>
      <button onClick={onClose} aria-label="Dismiss" className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('anim-pop relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl', size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-ink/5 hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-3.5 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirmation dialog; optionally collects a reason (required for rejections / reversals). */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', tone = 'primary', loading, askReason, reasonLabel = 'Reason', reasonRequired, onConfirm, onCancel }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; tone?: 'primary' | 'danger'; loading?: boolean;
  askReason?: boolean; reasonLabel?: string; reasonRequired?: boolean; onConfirm: (reason: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  const blocked = askReason && reasonRequired && reason.trim().length < 3;
  return (
    <Modal open={open} onClose={onCancel} title={<span className="flex items-center gap-2"><AlertTriangle className={cn('h-5 w-5', tone === 'danger' ? 'text-danger' : 'text-warn')} />{title}</span>} size="sm"
      footer={<><Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button><Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} disabled={blocked} onClick={() => onConfirm(reason.trim())}>{confirmLabel}</Button></>}>
      <div className="space-y-3 text-sm text-muted">{message}
        {askReason && <Field label={reasonLabel}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a short note…" autoFocus /></Field>}
      </div>
    </Modal>
  );
}
