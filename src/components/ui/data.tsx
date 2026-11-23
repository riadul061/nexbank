'use client';
import { ChevronLeft, ChevronRight, Inbox, RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Card, Skeleton } from './primitives';
import { cn } from '@/lib/utils';
import { errMsg } from '@/store/baseApi';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="display text-[28px] font-semibold leading-tight sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, hint, tone = 'brand', loading }: { label: string; value: ReactNode; icon: ReactNode; hint?: ReactNode; tone?: 'brand' | 'accent' | 'info' | 'danger' | 'warn'; loading?: boolean }) {
  const t = { brand: 'bg-brand/12 text-brand', accent: 'bg-accent/15 text-accent', info: 'bg-info/12 text-info', danger: 'bg-danger/12 text-danger', warn: 'bg-warn/14 text-warn' }[tone];
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted">{label}</span><span className={cn('flex h-8 w-8 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4', t)}>{icon}</span></div>
      {loading ? <Skeleton className="mt-3 h-8 w-28" /> : <div className="num display mt-2 text-2xl font-semibold sm:text-[28px]">{value}</div>}
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink/5 text-muted">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="font-medium">{title}</p>{text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}{action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <TriangleAlert className="mb-3 h-8 w-8 text-danger" /><p className="font-medium">Couldn’t load this data</p><p className="mt-1 text-sm text-muted">{errMsg(error)}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Try again</Button>}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="space-y-3 p-5">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>;
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1; const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm sm:flex-row">
      <span className="text-xs text-muted">Showing <b className="text-ink">{from}–{to}</b> of <b className="text-ink">{total}</b></span>
      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="px-2 text-xs text-muted">Page {page} / {pages}</span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export const Tabs = ({ tabs, value, onChange }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void }) => (
  <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface2 p-1">
    {tabs.map((t) => (
      <button key={t.id} onClick={() => onChange(t.id)} className={cn('whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition', value === t.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
        {t.label}{t.count != null && <span className="ml-1.5 rounded-full bg-ink/8 px-1.5 text-[10px]">{t.count}</span>}
      </button>
    ))}
  </div>
);

export const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 text-sm"><dt className="text-muted">{label}</dt><dd className="text-right font-medium">{children}</dd></div>
);
