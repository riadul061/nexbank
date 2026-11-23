'use client';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn, initials, titleCase } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brandfg hover:brightness-110 shadow-sm',
  accent: 'bg-accent text-white hover:brightness-110 shadow-sm',
  secondary: 'bg-surface border border-line text-ink hover:bg-surface2',
  ghost: 'text-ink hover:bg-ink/5',
  danger: 'bg-danger text-white hover:brightness-110',
};
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...p }, ref) {
  return (
    <button ref={ref} disabled={disabled || loading} {...p}
      className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-55',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-5 py-3 text-sm' : 'px-4 py-2 text-sm', variants[variant], className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export const Card = ({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('card', className)} {...p}>{children}</div>;
export const CardHeader = ({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) => (
  <div className="flex items-start justify-between gap-3 px-5 pt-5">
    <div><h3 className="text-[15px] font-semibold">{title}</h3>{subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}</div>
    {action}
  </div>
);

const TONES = {
  success: 'bg-success/12 text-success', warn: 'bg-warn/14 text-warn', danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info', muted: 'bg-ink/7 text-muted', brand: 'bg-brand/12 text-brand',
} as const;
export type Tone = keyof typeof TONES;
export const Badge = ({ tone = 'muted', children, dot = true, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) => (
  <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold', TONES[tone], className)}>
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}{children}
  </span>
);
const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'success', COMPLETED: 'success', APPROVED: 'success', PAID: 'success', VERIFIED: 'success',
  PENDING: 'warn', UNDER_REVIEW: 'info', DUE: 'warn', FAILED: 'danger', REJECTED: 'danger', BLOCKED: 'danger', FROZEN: 'info', REVERSED: 'muted', INACTIVE: 'muted',
};
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status] ?? 'muted'}>{titleCase(status)}</Badge>;

export function Field({ label, error, hint, children, className }: { label?: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>}
      {children}
      {error ? <span role="alert" className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...p }, ref) {
  return <input ref={ref} className={cn('input', invalid && 'border-danger focus:border-danger focus:ring-danger/20', className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return <select ref={ref} className={cn('input pr-8', className)} {...p}>{children}</select>;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} rows={3} className={cn('input resize-y', className)} {...p} />;
});

export const Avatar = ({ name, size = 36 }: { name: string; size?: number }) => (
  <span style={{ width: size, height: size, fontSize: size * 0.36 }} className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand/15 font-semibold text-brand">{initials(name)}</span>
);
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-lg bg-ink/8', className)} />;
export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('h-5 w-5 animate-spin text-muted', className)} />;
