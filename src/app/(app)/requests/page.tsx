'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Check, X } from 'lucide-react';
import { useGetAccountsQuery } from '@/features/accounts/accountsApi';
import { useCreateRequestMutation, useGetRequestsQuery, useReviewRequestMutation } from '@/features/requests/requestsApi';
import { useAppDispatch } from '@/store/store';
import { pushToast } from '@/features/ui/uiSlice';
import { errMsg } from '@/store/baseApi';
import { EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton, Tabs } from '@/components/ui/data';
import { ConfirmDialog } from '@/components/ui/feedback';
import { Button, Card, CardHeader, Field, Input, Select, StatusBadge, Textarea } from '@/components/ui/primitives';
import { useRole } from '@/hooks/useRole';
import { fmtDateTime, money, newKey, titleCase } from '@/lib/utils';
import type { FundRequestDTO } from '@/types';

function NewRequest() {
  const dispatch = useAppDispatch();
  const { data } = useGetAccountsQuery();
  const [create, { isLoading }] = useCreateRequestMutation();
  const accounts = (data?.items ?? []).filter((a) => a.status === 'ACTIVE');
  const [type, setType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [accountId, setAccountId] = useState(''); const [amount, setAmount] = useState(''); const [desc, setDesc] = useState(''); const [touched, setTouched] = useState(false);
  const key = useRef(newKey());
  useEffect(() => { if (!accountId && accounts[0]) setAccountId(accounts[0].id); }, [accounts, accountId]);
  const acc = accounts.find((a) => a.id === accountId);
  const n = Number(amount);
  const err = !(n > 0) ? 'Enter an amount greater than zero' : Math.abs(n * 100 - Math.round(n * 100)) > 1e-6 ? 'Maximum 2 decimal places' : type === 'WITHDRAWAL' && acc && n > acc.balance ? `Exceeds available balance (${money(acc.balance)})` : '';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); if (err || !acc) return;
    try {
      await create({ accountId, type, amount: n, description: desc || undefined, idempotencyKey: key.current }).unwrap();
      dispatch(pushToast('success', `${titleCase(type)} request submitted for approval`)); setAmount(''); setDesc(''); setTouched(false); key.current = newKey();
    } catch { key.current = newKey(); /* error toast shown centrally */ }
  };
  return (
    <Card>
      <CardHeader title="New request" subtitle="Requests are reviewed by bank staff before funds move." />
      <form onSubmit={submit} className="space-y-4 p-5" noValidate>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface2 p-1 text-sm font-medium">
          {(['DEPOSIT', 'WITHDRAWAL'] as const).map((t) => <button type="button" key={t} onClick={() => setType(t)} className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition ${type === t ? 'bg-surface shadow-sm' : 'text-muted'}`}>{t === 'DEPOSIT' ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}{titleCase(t)}</button>)}
        </div>
        <Field label="Account"><Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{titleCase(a.type)} · {a.accountNumber} · {money(a.balance)}</option>)}</Select></Field>
        <Field label="Amount (USD)" error={touched ? err : undefined}><Input className="num" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} invalid={touched && !!err} /></Field>
        <Field label="Description (optional)"><Textarea rows={2} maxLength={200} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <Button type="submit" loading={isLoading} disabled={!accounts.length} className="w-full">Submit {type === 'DEPOSIT' ? 'deposit' : 'withdrawal'} request</Button>
      </form>
    </Card>
  );
}

export default function RequestsPage() {
  const role = useRole(); const dispatch = useAppDispatch();
  const isOps = role === 'ADMIN' || role === 'STAFF';
  const [status, setStatus] = useState(''); const [type, setType] = useState(''); const [page, setPage] = useState(1);
  const { data, isFetching, error, refetch } = useGetRequestsQuery({ status, type, page, pageSize: 10 });
  const [review, rv] = useReviewRequestMutation();
  const [target, setTarget] = useState<{ r: FundRequestDTO; decision: 'APPROVE' | 'REJECT' } | null>(null);
  const decide = async (note: string) => {
    if (!target) return;
    try { await review({ id: target.r.id, decision: target.decision, note: note || undefined }).unwrap(); dispatch(pushToast('success', `Request ${target.decision === 'APPROVE' ? 'approved' : 'rejected'}`)); setTarget(null); } catch { setTarget(null); }
  };
  return (
    <>
      <PageHeader title={isOps ? 'Deposit & withdrawal requests' : 'Deposit & withdrawal'} subtitle={isOps ? 'Approve or reject customer requests. You cannot review your own.' : 'Submit a request and track its approval status.'} />
      <div className={isOps ? '' : 'grid gap-6 lg:grid-cols-3'}>
        {role === 'CUSTOMER' && <div className="lg:order-2"><NewRequest /></div>}
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={status} onChange={(s) => { setStatus(s); setPage(1); }} tabs={[{ id: '', label: 'All' }, { id: 'PENDING', label: 'Pending' }, { id: 'APPROVED', label: 'Approved' }, { id: 'REJECTED', label: 'Rejected' }]} />
            <Select aria-label="Type" className="sm:w-40" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">All types</option><option value="DEPOSIT">Deposits</option><option value="WITHDRAWAL">Withdrawals</option></Select>
          </div>
          {error ? <ErrorState error={error} onRetry={refetch} /> : !data ? <TableSkeleton /> : !data.items.length ? <EmptyState title="No requests" text="Nothing matches this view yet." /> : (
            <div className={`overflow-x-auto ${isFetching ? 'opacity-60' : ''}`}>
              <table className="w-full min-w-[680px]">
                <thead><tr className="border-b border-line bg-surface2/60"><th className="th">Request</th>{isOps && <th className="th">Customer</th>}<th className="th">Account</th><th className="th">Date</th><th className="th">Status</th><th className="th text-right">Amount</th>{isOps && <th className="th" />}</tr></thead>
                <tbody className="divide-y divide-line">{data.items.map((r) => (
                  <tr key={r.id}>
                    <td className="td"><span className="font-medium">{titleCase(r.type)}</span><span className="block max-w-[200px] truncate text-xs text-muted">{r.description || '—'}</span>{r.reviewNote && <span className="block text-xs text-muted">Note: {r.reviewNote}</span>}</td>
                    {isOps && <td className="td text-sm">{r.requestedBy.name}</td>}
                    <td className="td num text-xs">{r.account.accountNumber}</td>
                    <td className="td whitespace-nowrap text-xs text-muted">{fmtDateTime(r.createdAt)}</td>
                    <td className="td"><StatusBadge status={r.status} /></td>
                    <td className="td num text-right font-semibold">{money(r.amount)}</td>
                    {isOps && <td className="td"><div className="flex justify-end gap-1.5">{r.status === 'PENDING' && <><Button size="sm" onClick={() => setTarget({ r, decision: 'APPROVE' })}><Check className="h-3.5 w-3.5" />Approve</Button><Button size="sm" variant="secondary" onClick={() => setTarget({ r, decision: 'REJECT' })}><X className="h-3.5 w-3.5" />Reject</Button></>}</div></td>}
                  </tr>))}</tbody>
              </table>
            </div>
          )}
          {data && data.total > 0 && <Pagination page={page} pageSize={10} total={data.total} onChange={setPage} />}
        </Card>
      </div>
      <ConfirmDialog open={!!target} loading={rv.isLoading} tone={target?.decision === 'REJECT' ? 'danger' : 'primary'}
        title={target?.decision === 'APPROVE' ? 'Approve request' : 'Reject request'} confirmLabel={target?.decision === 'APPROVE' ? 'Approve' : 'Reject'}
        askReason reasonRequired={target?.decision === 'REJECT'} reasonLabel={target?.decision === 'REJECT' ? 'Reason for rejection' : 'Note (optional)'}
        message={target && <p>{titleCase(target.r.type)} of <b className="text-ink">{money(target.r.amount)}</b> for {target.r.requestedBy.name} on account {target.r.account.accountNumber}. {target.decision === 'APPROVE' ? 'The balance updates immediately and a transaction is recorded.' : 'The customer will be notified.'}</p>}
        onCancel={() => setTarget(null)} onConfirm={decide} />
    </>
  );
}
