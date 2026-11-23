'use client';
import Link from 'next/link';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Flag } from 'lucide-react';
import type { AccountDTO, TransactionDTO, TxType } from '@/types';
import { Badge, Card, StatusBadge } from '@/components/ui/primitives';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/data';
import { cn, fmtDateTime, maskAccount, money, titleCase } from '@/lib/utils';

export const TX_TYPES: { value: TxType; label: string }[] = [
  { value: 'DEPOSIT', label: 'Deposit' }, { value: 'WITHDRAWAL', label: 'Withdrawal' }, { value: 'TRANSFER', label: 'Fund transfer' },
  { value: 'LOAN_DISBURSEMENT', label: 'Loan disbursement' }, { value: 'LOAN_REPAYMENT', label: 'Loan repayment' },
];
export const TX_LABEL: Record<string, string> = Object.fromEntries(TX_TYPES.map((t) => [t.value, t.label]));

/** Signed amount for the current viewer: money in is green, money out is neutral. */
export function signedAmount(t: TransactionDTO) {
  if (t.direction === 'IN') return { text: `+${money(t.amount)}`, cls: 'text-success' };
  if (t.direction === 'OUT') return { text: `−${money(t.amount + t.fee)}`, cls: 'text-ink' };
  if (t.direction === 'SELF') return { text: money(t.amount), cls: 'text-muted' };
  return { text: money(t.amount), cls: 'text-ink' };
}

export function TxIcon({ t }: { t: TransactionDTO }) {
  const Icon = t.direction === 'IN' ? ArrowDownLeft : t.direction === 'OUT' ? ArrowUpRight : ArrowLeftRight;
  const tone = t.direction === 'IN' ? 'bg-success/12 text-success' : t.direction === 'OUT' ? 'bg-ink/7 text-ink' : 'bg-info/12 text-info';
  return <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', tone)}><Icon className="h-4 w-4" /></span>;
}

const party = (p: TransactionDTO['sender']) => (p ? <span>{p.ownerName || 'Account'} <span className="text-muted">{maskAccount(p.accountNumber)}</span></span> : <span className="text-muted">Bank</span>);

export function TxTable({ items, loading, error, onRetry, showViewerAmount = true }: {
  items?: TransactionDTO[]; loading?: boolean; error?: unknown; onRetry?: () => void; showViewerAmount?: boolean;
}) {
  if (loading) return <TableSkeleton />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!items?.length) return <EmptyState title="No transactions found" text="Try adjusting your filters or date range." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead><tr className="border-b border-line bg-surface2/60"><th className="th">Transaction</th><th className="th">From → To</th><th className="th">Date</th><th className="th">Status</th><th className="th text-right">Amount</th></tr></thead>
        <tbody className="divide-y divide-line">
          {items.map((t) => {
            const a = showViewerAmount ? signedAmount(t) : { text: money(t.amount), cls: '' };
            return (
              <tr key={t.id} className="transition hover:bg-surface2/70">
                <td className="td">
                  <Link href={`/transactions/${t.id}`} className="flex items-center gap-3">
                    <TxIcon t={t} />
                    <span><span className="block font-medium">{TX_LABEL[t.type] ?? titleCase(t.type)}</span><span className="num block whitespace-nowrap text-xs text-muted">{t.reference}</span></span>
                    {t.flagged && <Badge tone="danger" dot={false}><Flag className="h-3 w-3" />Flagged</Badge>}
                  </Link>
                </td>
                <td className="td text-xs">{party(t.sender)} <span className="text-muted">→</span> {party(t.receiver)}</td>
                <td className="td whitespace-nowrap text-xs text-muted">{fmtDateTime(t.createdAt)}</td>
                <td className="td"><StatusBadge status={t.status} /></td>
                <td className={cn('td num whitespace-nowrap text-right font-semibold', a.cls)}>{a.text}{t.fee > 0 && <span className="block text-[11px] font-normal text-muted">fee {money(t.fee)}</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Compact "recent activity" list used on dashboards (mobile friendly). */
export function TxList({ items }: { items: TransactionDTO[] }) {
  if (!items.length) return <EmptyState title="No activity yet" text="Your transactions will appear here." />;
  return (
    <ul className="divide-y divide-line">
      {items.map((t) => {
        const a = signedAmount(t);
        const other = t.direction === 'IN' ? t.sender : t.receiver;
        return (
          <li key={t.id}>
            <Link href={`/transactions/${t.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface2/70">
              <TxIcon t={t} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.description || TX_LABEL[t.type]}</p><p className="truncate text-xs text-muted">{other?.ownerName ? `${other.ownerName} · ` : ''}{fmtDateTime(t.createdAt)}</p></div>
              <div className="text-right"><p className={cn('num text-sm font-semibold', a.cls)}>{a.text}</p><StatusBadge status={t.status} /></div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AccountCard({ a, active, onClick, compact }: { a: AccountDTO; active?: boolean; onClick?: () => void; compact?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn('relative w-full overflow-hidden rounded-xl2 p-5 text-left text-white shadow-card transition', 'bg-gradient-to-br from-[#0f5c4d] via-[#0b4a3f] to-[#082f29]',
        active ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'opacity-90 hover:opacity-100', compact && 'p-4')}>
      <span className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-14 right-8 h-32 w-32 rounded-full bg-accent/20" />
      <div className="relative flex items-start justify-between"><span className="text-xs font-medium uppercase tracking-widest text-white/70">{titleCase(a.type)}{a.nickname ? ` · ${a.nickname}` : ''}</span>{a.status === 'FROZEN' && <Badge tone="info" className="bg-white/20 text-white">Frozen</Badge>}</div>
      <p className="num display relative mt-4 text-[28px] font-semibold leading-none">{money(a.balance)}</p>
      <p className="num relative mt-3 text-xs tracking-[0.18em] text-white/75">{a.accountNumber.replace(/(\d{4})(?=\d)/g, '$1 ')}</p>
    </button>
  );
}

export const Panel = ({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <Card className={className}>
    <div className="flex items-start justify-between gap-3 px-5 pt-5"><div><h3 className="text-[15px] font-semibold">{title}</h3>{subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}</div>{action}</div>
    <div className="px-2 pb-4 pt-3 sm:px-4">{children}</div>
  </Card>
);
