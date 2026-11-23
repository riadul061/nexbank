'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Plus, Search } from 'lucide-react';
import { useGetCustomersQuery, useRegisterCustomerMutation } from '@/features/customers/customersApi';
import { useAppDispatch } from '@/store/store';
import { pushToast } from '@/features/ui/uiSlice';
import { EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton, Tabs } from '@/components/ui/data';
import { Modal } from '@/components/ui/feedback';
import { Avatar, Badge, Button, Card, Field, Input, Select, StatusBadge } from '@/components/ui/primitives';
import { useRole } from '@/hooks/useRole';
import { useDebounced } from '@/hooks/useDebounced';
import { fmtDate, money } from '@/lib/utils';
import { errMsg } from '@/store/baseApi';

const empty = { name: '', email: '', password: '', phone: '', address: '', nationalId: '', pin: '', accountType: 'SAVINGS', role: 'CUSTOMER' };

function RegisterModal({ open, onClose, isAdmin }: { open: boolean; onClose: () => void; isAdmin: boolean }) {
  const dispatch = useAppDispatch();
  const [register, { isLoading }] = useRegisterCustomerMutation();
  const [f, setF] = useState(empty); const [touched, setTouched] = useState(false); const [serverErr, setServerErr] = useState('');
  useEffect(() => { if (open) { setF(empty); setTouched(false); setServerErr(''); } }, [open]);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const isCust = f.role === 'CUSTOMER';
  const errs = {
    name: f.name.trim().length < 2 ? 'Enter the full name' : '',
    email: !/^\S+@\S+\.\S+$/.test(f.email) ? 'Enter a valid email' : '',
    password: f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password) ? 'At least 8 characters with a letter and a number' : '',
    pin: isCust && f.pin && !/^\d{4,6}$/.test(f.pin) ? 'PIN must be 4–6 digits' : '',
  };
  const bad = Object.values(errs).some(Boolean);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); if (bad) return; setServerErr('');
    const payload: Record<string, unknown> = { name: f.name.trim(), email: f.email.trim(), password: f.password, role: f.role };
    for (const k of ['phone', 'address', 'nationalId'] as const) if (f[k].trim()) payload[k] = f[k].trim();
    if (isCust) { if (f.pin) payload.pin = f.pin; payload.accountType = f.accountType; }
    try { const r = await register(payload).unwrap(); dispatch(pushToast('success', r.accountNumber ? `Registered · account ${r.accountNumber}` : 'User registered')); onClose(); } catch (err) { setServerErr(errMsg(err)); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Register new customer"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="reg-form" loading={isLoading}>Register</Button></>}>
      <form id="reg-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={touched ? errs.name : undefined}><Input value={f.name} onChange={set('name')} invalid={touched && !!errs.name} autoFocus /></Field>
        <Field label="Email" error={touched ? errs.email : undefined}><Input type="email" value={f.email} onChange={set('email')} invalid={touched && !!errs.email} /></Field>
        <Field label="Temporary password" error={touched ? errs.password : undefined}><Input type="text" autoComplete="off" value={f.password} onChange={set('password')} invalid={touched && !!errs.password} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={f.address} onChange={set('address')} /></Field>
        {isAdmin && <Field label="Role"><Select value={f.role} onChange={set('role')}><option value="CUSTOMER">Customer</option><option value="STAFF">Bank staff</option></Select></Field>}
        {isCust && <>
          <Field label="National ID"><Input value={f.nationalId} onChange={set('nationalId')} /></Field>
          <Field label="Opening account"><Select value={f.accountType} onChange={set('accountType')}><option value="SAVINGS">Savings</option><option value="CURRENT">Current</option><option value="BUSINESS">Business</option></Select></Field>
          <Field label="Transaction PIN (optional)" hint="Customer can set it later from their profile." error={touched ? errs.pin : undefined}><Input type="password" inputMode="numeric" maxLength={6} value={f.pin} onChange={set('pin')} /></Field></>}
        {serverErr && <p role="alert" className="text-sm text-danger sm:col-span-2">{serverErr}</p>}
      </form>
    </Modal>
  );
}

export default function CustomersPage() {
  const role = useRole(); const isAdmin = role === 'ADMIN';
  const [who, setWho] = useState<'CUSTOMER' | 'STAFF'>('CUSTOMER');
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [status, setStatus] = useState(''); const [page, setPage] = useState(1); const [open, setOpen] = useState(false);
  const { data, isFetching, error, refetch } = useGetCustomersQuery({ q: dq, status, role: who, page, pageSize: 10 });
  useEffect(() => setPage(1), [dq, status, who]);
  return (
    <>
      <PageHeader title={who === 'STAFF' ? 'Bank staff' : 'Customers'} subtitle="Search, review and manage people on the platform." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Register {who === 'STAFF' ? 'staff' : 'customer'}</Button>} />
      {isAdmin && <div className="mb-4"><Tabs value={who} onChange={(v) => setWho(v as 'CUSTOMER' | 'STAFF')} tabs={[{ id: 'CUSTOMER', label: 'Customers' }, { id: 'STAFF', label: 'Staff' }]} /></div>}
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3">
          <div className="relative sm:col-span-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input className="pl-9" aria-label="Search" placeholder="Name, email, phone or account number…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="BLOCKED">Blocked</option></Select>
        </div>
        {error ? <ErrorState error={error} onRetry={refetch} /> : !data ? <TableSkeleton /> : !data.items.length ? <EmptyState title="No results" text="Try a different search." /> : (
          <div className={`overflow-x-auto ${isFetching ? 'opacity-60' : ''}`}><table className="w-full min-w-[720px]">
            <thead><tr className="border-b border-line bg-surface2/60"><th className="th">Name</th><th className="th">Status</th><th className="th">Verification</th><th className="th">Accounts</th><th className="th text-right">Total balance</th><th className="th">Joined</th></tr></thead>
            <tbody className="divide-y divide-line">{data.items.map((c) => (
              <tr key={c.id} className="hover:bg-surface2/70">
                <td className="td"><Link href={`/customers/${c.id}`} className="flex items-center gap-3"><Avatar name={c.name} /><span><span className="block font-medium">{c.name}</span><span className="block text-xs text-muted">{c.email}</span></span></Link></td>
                <td className="td"><StatusBadge status={c.status} /></td>
                <td className="td">{c.verified ? <Badge tone="success"><BadgeCheck className="h-3 w-3" />Verified</Badge> : <Badge tone="warn">Unverified</Badge>}</td>
                <td className="td num">{c.accountCount}</td><td className="td num text-right font-semibold">{money(c.totalBalance)}</td><td className="td text-xs text-muted">{fmtDate(c.createdAt)}</td>
              </tr>))}</tbody></table></div>
        )}
        {data && data.total > 0 && <Pagination page={page} pageSize={10} total={data.total} onChange={setPage} />}
      </Card>
      <RegisterModal open={open} onClose={() => setOpen(false)} isAdmin={isAdmin} />
    </>
  );
}
