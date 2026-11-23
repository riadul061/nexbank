'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, FileText, Pencil, Plus, Search, Snowflake, Sun } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectAccount } from '@/features/accounts/accountsSlice';
import { useCreateAccountMutation, useGetAccountsQuery, useUpdateAccountMutation } from '@/features/accounts/accountsApi';
import { useGetCustomersQuery } from '@/features/customers/customersApi';
import { pushToast } from '@/features/ui/uiSlice';
import { DetailRow, EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton } from '@/components/ui/data';
import { ConfirmDialog, Modal } from '@/components/ui/feedback';
import { Button, Card, CardHeader, Field, Input, Select, Skeleton, StatusBadge } from '@/components/ui/primitives';
import { AccountCard } from '@/components/shared';
import { useRole } from '@/hooks/useRole';
import { useDebounced } from '@/hooks/useDebounced';
import { useDownload } from '@/hooks/useDownload';
import { fmtDate, money, titleCase } from '@/lib/utils';
import type { AccountDTO } from '@/types';

function CustomerAccounts() {
  const dispatch = useAppDispatch();
  const { data, isLoading, error, refetch } = useGetAccountsQuery();
  const sel = useAppSelector((s) => s.accounts.selectedAccountId);
  const list = data?.items ?? [];
  const a = list.find((x) => x.id === sel) ?? list[0];
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const { download, busy } = useDownload();
  const stmt = (format: 'csv' | 'pdf') => a && download(`/api/accounts/${a.id}/statement?format=${format}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`, `statement-${a.accountNumber}.${format}`);
  if (error) return <Card><ErrorState error={error} onRetry={refetch} /></Card>;
  return (
    <>
      <PageHeader title="My accounts" subtitle="Balances, account details and statements." />
      {isLoading ? <Skeleton className="h-64 w-full" /> : !a ? <Card><EmptyState title="No accounts yet" text="Visit a branch or contact support to open an account." /></Card> : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">{list.map((x) => <AccountCard key={x.id} a={x} active={x.id === a.id} onClick={() => dispatch(selectAccount(x.id))} />)}</div>
          <div className="space-y-6 lg:col-span-3">
            <Card><CardHeader title="Account details" action={<StatusBadge status={a.status} />} />
              <dl className="divide-y divide-line px-5 pb-3 pt-1">
                <DetailRow label="Account number"><span className="num">{a.accountNumber}</span></DetailRow>
                <DetailRow label="Account type">{titleCase(a.type)}</DetailRow>
                <DetailRow label="Available balance"><span className="num text-base">{money(a.balance)}</span></DetailRow>
                <DetailRow label="Status">{titleCase(a.status)}</DetailRow>
                <DetailRow label="Daily transfer limit">{money(a.dailyLimit)}</DetailRow>
                <DetailRow label="Per-transaction limit">{money(a.singleLimit)}</DetailRow>
                <DetailRow label="Opened">{fmtDate(a.createdAt)}</DetailRow>
              </dl></Card>
            <Card><CardHeader title="Download statement" subtitle="Choose a period (optional) and a format." />
              <div className="grid gap-3 p-5 sm:grid-cols-2"><Field label="From"><Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="To"><Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></Field></div>
              <div className="flex flex-wrap gap-2 px-5 pb-5"><Button variant="secondary" loading={busy} onClick={() => stmt('csv')}><Download className="h-4 w-4" />CSV</Button><Button variant="secondary" loading={busy} onClick={() => stmt('pdf')}><FileText className="h-4 w-4" />PDF</Button>
                <Link href="/transactions" className="ml-auto self-center text-xs font-medium text-brand hover:underline">View transactions</Link></div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function AccountForm({ open, onClose, editing, isAdmin }: { open: boolean; onClose: () => void; editing: AccountDTO | null; isAdmin: boolean }) {
  const dispatch = useAppDispatch();
  const [create, c] = useCreateAccountMutation(); const [update, u] = useUpdateAccountMutation();
  const [custQ, setCustQ] = useState(''); const dq = useDebounced(custQ);
  const { data: custs } = useGetCustomersQuery({ q: dq, status: 'ACTIVE', pageSize: 8 }, { skip: !open || !!editing });
  const [ownerId, setOwnerId] = useState(''); const [type, setType] = useState('SAVINGS'); const [nickname, setNickname] = useState('');
  const [daily, setDaily] = useState(''); const [single, setSingle] = useState('');
  useEffect(() => {
    if (!open) return;
    setOwnerId(''); setCustQ(''); setType(editing?.type ?? 'SAVINGS'); setNickname(editing?.nickname ?? '');
    setDaily(editing ? String(editing.dailyLimit) : ''); setSingle(editing ? String(editing.singleLimit) : '');
  }, [open, editing]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) { await update({ id: editing.id, patch: { type, nickname: nickname || null, dailyLimit: Number(daily), singleLimit: Number(single) } }).unwrap(); dispatch(pushToast('success', 'Account updated')); }
      else { await create({ ownerId, type, nickname: nickname || undefined, dailyLimit: isAdmin && daily ? Number(daily) : undefined, singleLimit: isAdmin && single ? Number(single) : undefined }).unwrap(); dispatch(pushToast('success', 'Account created')); }
      onClose();
    } catch { /* toast shown centrally */ }
  };
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit account ${editing.accountNumber}` : 'Create bank account'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="acc-form" loading={c.isLoading || u.isLoading} disabled={!editing && !ownerId}>{editing ? 'Save changes' : 'Create account'}</Button></>}>
      <form id="acc-form" onSubmit={submit} className="space-y-4">
        {!editing && <Field label="Customer" hint="Search by name, email or phone, then pick a customer.">
          <Input placeholder="Search customers…" value={custQ} onChange={(e) => { setCustQ(e.target.value); setOwnerId(''); }} />
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{custs?.items.map((x) => <button type="button" key={x.id} onClick={() => setOwnerId(x.id)} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${ownerId === x.id ? 'border-brand bg-brand/8' : 'border-line hover:bg-surface2'}`}><span>{x.name}</span><span className="text-xs text-muted">{x.email}</span></button>)}</div>
        </Field>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account type"><Select value={type} onChange={(e) => setType(e.target.value)}><option value="SAVINGS">Savings</option><option value="CURRENT">Current</option><option value="BUSINESS">Business</option></Select></Field>
          <Field label="Nickname (optional)"><Input maxLength={40} value={nickname} onChange={(e) => setNickname(e.target.value)} /></Field>
          {isAdmin && <><Field label="Daily transfer limit ($)"><Input inputMode="decimal" placeholder="Default" value={daily} onChange={(e) => setDaily(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
            <Field label="Per-transaction limit ($)"><Input inputMode="decimal" placeholder="Default" value={single} onChange={(e) => setSingle(e.target.value.replace(/[^\d.]/g, ''))} /></Field></>}
        </div>
      </form>
    </Modal>
  );
}

function OpsAccounts({ isAdmin }: { isAdmin: boolean }) {
  const dispatch = useAppDispatch();
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [status, setStatus] = useState(''); const [type, setType] = useState(''); const [page, setPage] = useState(1);
  const { data, isFetching, error, refetch } = useGetAccountsQuery({ q: dq, status, type, page, pageSize: 10 });
  const [update, u] = useUpdateAccountMutation();
  const [form, setForm] = useState<{ open: boolean; editing: AccountDTO | null }>({ open: false, editing: null });
  const [freeze, setFreeze] = useState<AccountDTO | null>(null);
  useEffect(() => setPage(1), [dq, status, type]);
  const toggle = async () => {
    if (!freeze) return;
    try { await update({ id: freeze.id, patch: { status: freeze.status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE' } }).unwrap(); dispatch(pushToast('success', freeze.status === 'ACTIVE' ? 'Account frozen' : 'Account unfrozen')); } catch { /* toast */ }
    setFreeze(null);
  };
  return (
    <>
      <PageHeader title="Bank accounts" subtitle={isAdmin ? 'Create, edit, freeze and set limits.' : 'Open accounts for customers and look up account details.'} actions={<Button onClick={() => setForm({ open: true, editing: null })}><Plus className="h-4 w-4" />New account</Button>} />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-4">
          <div className="relative sm:col-span-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input className="pl-9" aria-label="Search accounts" placeholder="Account number, holder or email…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="FROZEN">Frozen</option></Select>
          <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="SAVINGS">Savings</option><option value="CURRENT">Current</option><option value="BUSINESS">Business</option></Select>
        </div>
        {error ? <ErrorState error={error} onRetry={refetch} /> : !data ? <TableSkeleton /> : !data.items.length ? <EmptyState title="No accounts match" /> : (
          <div className={`overflow-x-auto ${isFetching ? 'opacity-60' : ''}`}><table className="w-full min-w-[760px]">
            <thead><tr className="border-b border-line bg-surface2/60"><th className="th">Account</th><th className="th">Holder</th><th className="th">Type</th><th className="th">Status</th><th className="th">Limits (daily / single)</th><th className="th text-right">Balance</th>{isAdmin && <th className="th" />}</tr></thead>
            <tbody className="divide-y divide-line">{data.items.map((a) => (
              <tr key={a.id} className="hover:bg-surface2/70">
                <td className="td num">{a.accountNumber}{a.nickname && <span className="block font-sans text-xs text-muted">{a.nickname}</span>}</td>
                <td className="td"><Link href={`/customers/${a.ownerId}`} className="font-medium hover:underline">{a.ownerName}</Link><span className="block text-xs text-muted">{a.ownerEmail}</span></td>
                <td className="td">{titleCase(a.type)}</td><td className="td"><StatusBadge status={a.status} /></td>
                <td className="td num text-xs text-muted">{money(a.dailyLimit)} / {money(a.singleLimit)}</td>
                <td className="td num text-right font-semibold">{money(a.balance)}</td>
                {isAdmin && <td className="td"><div className="flex justify-end gap-1.5"><Button size="sm" variant="secondary" aria-label="Edit" onClick={() => setForm({ open: true, editing: a })}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="secondary" onClick={() => setFreeze(a)}>{a.status === 'ACTIVE' ? <><Snowflake className="h-3.5 w-3.5" />Freeze</> : <><Sun className="h-3.5 w-3.5" />Unfreeze</>}</Button></div></td>}
              </tr>))}</tbody></table></div>
        )}
        {data && data.total > 0 && <Pagination page={page} pageSize={10} total={data.total} onChange={setPage} />}
      </Card>
      <AccountForm open={form.open} editing={form.editing} isAdmin={isAdmin} onClose={() => setForm({ open: false, editing: null })} />
      <ConfirmDialog open={!!freeze} loading={u.isLoading} tone={freeze?.status === 'ACTIVE' ? 'danger' : 'primary'} title={freeze?.status === 'ACTIVE' ? 'Freeze account' : 'Unfreeze account'}
        confirmLabel={freeze?.status === 'ACTIVE' ? 'Freeze' : 'Unfreeze'} message={freeze && <p>{freeze.status === 'ACTIVE' ? 'A frozen account cannot send or receive money.' : 'The account will be able to transact again.'} Account <b className="text-ink">{freeze.accountNumber}</b> ({freeze.ownerName}).</p>}
        onCancel={() => setFreeze(null)} onConfirm={toggle} />
    </>
  );
}

export default function AccountsPage() {
  const role = useRole();
  if (!role) return <Skeleton className="h-64 w-full" />;
  return role === 'CUSTOMER' ? <CustomerAccounts /> : <OpsAccounts isAdmin={role === 'ADMIN'} />;
}
