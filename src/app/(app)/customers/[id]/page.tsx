'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, BadgeCheck, Ban, CheckCircle2, PauseCircle } from 'lucide-react';
import { useGetCustomerQuery, useUpdateCustomerMutation } from '@/features/customers/customersApi';
import { useAppDispatch } from '@/store/store';
import { pushToast } from '@/features/ui/uiSlice';
import { DetailRow, ErrorState, PageHeader } from '@/components/ui/data';
import { ConfirmDialog } from '@/components/ui/feedback';
import { Avatar, Badge, Button, Card, CardHeader, Skeleton, StatusBadge } from '@/components/ui/primitives';
import { TxTable } from '@/components/shared';
import { useRole } from '@/hooks/useRole';
import { fmtDate, money, titleCase } from '@/lib/utils';

const ACTIONS = {
  ACTIVE: { label: 'Activate', icon: CheckCircle2, msg: 'The customer will be able to sign in and transact.', danger: false },
  INACTIVE: { label: 'Deactivate', icon: PauseCircle, msg: 'The customer is signed out of API access immediately and cannot sign in.', danger: true },
  BLOCKED: { label: 'Block', icon: Ban, msg: 'Use for suspicious accounts. Access is refused until an admin reactivates it.', danger: true },
} as const;

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const role = useRole(); const dispatch = useAppDispatch();
  const { data: c, isLoading, error, refetch } = useGetCustomerQuery(id);
  const [update, u] = useUpdateCustomerMutation();
  const [action, setAction] = useState<keyof typeof ACTIONS | null>(null);
  if (error) return <Card><ErrorState error={error} onRetry={refetch} /></Card>;
  const run = async (body: { status?: string; verify?: true }, ok: string) => { try { await update({ id, ...body }).unwrap(); dispatch(pushToast('success', ok)); } catch { /* toast */ } setAction(null); };
  return (
    <>
      <Link href="/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to customers</Link>
      {isLoading || !c ? <Skeleton className="h-72 w-full" /> : (
        <>
          <PageHeader title={c.name} subtitle={c.email}
            actions={<>
              {c.role === 'CUSTOMER' && !c.verified && <Button onClick={() => run({ verify: true }, 'Customer verified')} loading={u.isLoading}><BadgeCheck className="h-4 w-4" />Verify information</Button>}
              {role === 'ADMIN' && c.role !== 'ADMIN' && (Object.keys(ACTIONS) as (keyof typeof ACTIONS)[]).filter((s) => s !== c.status).map((s) => { const A = ACTIONS[s]; return <Button key={s} variant={A.danger ? 'secondary' : 'primary'} onClick={() => setAction(s)}><A.icon className="h-4 w-4" />{A.label}</Button>; })}
            </>} />
          <div className="grid gap-6 lg:grid-cols-3">
            <Card><div className="flex items-center gap-3 p-5 pb-2"><Avatar name={c.name} size={48} /><div><StatusBadge status={c.status} /></div></div>
              <dl className="divide-y divide-line px-5 pb-3">
                <DetailRow label="Role">{titleCase(c.role)}</DetailRow>
                <DetailRow label="Verification">{c.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warn">Unverified</Badge>}</DetailRow>
                <DetailRow label="Phone">{c.phone || '—'}</DetailRow><DetailRow label="Address">{c.address || '—'}</DetailRow>
                <DetailRow label="National ID">{c.nationalId || '—'}</DetailRow><DetailRow label="Customer since">{fmtDate(c.createdAt)}</DetailRow><DetailRow label="Loans">{c.loanCount}</DetailRow>
              </dl></Card>
            <Card className="lg:col-span-2"><CardHeader title="Accounts" subtitle={`${c.accounts.length} account(s)`} />
              <div className="overflow-x-auto p-2"><table className="w-full min-w-[480px]"><thead><tr><th className="th">Number</th><th className="th">Type</th><th className="th">Status</th><th className="th text-right">Balance</th></tr></thead>
                <tbody className="divide-y divide-line">{c.accounts.map((a) => <tr key={a.id}><td className="td num">{a.accountNumber}</td><td className="td">{titleCase(a.type)}</td><td className="td"><StatusBadge status={a.status} /></td><td className="td num text-right font-semibold">{money(a.balance)}</td></tr>)}
                  {!c.accounts.length && <tr><td className="td text-muted" colSpan={4}>No accounts yet.</td></tr>}</tbody></table></div></Card>
          </div>
          {c.role === 'CUSTOMER' && <Card className="mt-6"><CardHeader title="Recent transactions" action={<Link href={`/transactions`} className="text-xs font-medium text-brand hover:underline">All transactions</Link>} /><div className="pt-3"><TxTable items={c.recentTransactions} showViewerAmount={false} /></div></Card>}
        </>
      )}
      <ConfirmDialog open={!!action} loading={u.isLoading} tone={action && ACTIONS[action].danger ? 'danger' : 'primary'} title={action ? `${ACTIONS[action].label} ${c?.name ?? ''}` : ''} confirmLabel={action ? ACTIONS[action].label : ''}
        message={action && ACTIONS[action].msg} onCancel={() => setAction(null)} onConfirm={() => action && run({ status: action }, `Status set to ${titleCase(action)}`)} />
    </>
  );
}
