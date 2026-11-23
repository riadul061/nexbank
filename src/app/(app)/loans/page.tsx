'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { setLoanFilters, setLoanPage } from '@/features/loans/loansSlice';
import { useApplyLoanMutation, useGetLoansQuery } from '@/features/loans/loansApi';
import { useGetAccountsQuery } from '@/features/accounts/accountsApi';
import { pushToast } from '@/features/ui/uiSlice';
import { EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton, Tabs } from '@/components/ui/data';
import { Modal } from '@/components/ui/feedback';
import { Button, Card, Field, Input, Select, StatusBadge, Textarea } from '@/components/ui/primitives';
import { useRole } from '@/hooks/useRole';
import { useDebounced } from '@/hooks/useDebounced';
import { fmtDate, money, titleCase } from '@/lib/utils';
import { errMsg } from '@/store/baseApi';

const LOAN_TYPES = ['PERSONAL', 'HOME', 'EDUCATION', 'AUTO', 'BUSINESS'];
const EMPLOYMENT = ['EMPLOYED', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'STUDENT', 'RETIRED', 'UNEMPLOYED'];
const RATES: Record<string, number> = { PERSONAL: 11.5, HOME: 6.5, EDUCATION: 7.5, AUTO: 8.5, BUSINESS: 10 };
const blank = { accountId: '', loanType: 'PERSONAL', amount: '', durationMonths: '12', monthlyIncome: '', employmentStatus: 'EMPLOYED', description: '' };

function ApplyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { data } = useGetAccountsQuery();
  const accounts = (data?.items ?? []).filter((a) => a.status === 'ACTIVE');
  const [apply, { isLoading }] = useApplyLoanMutation();
  const [f, setF] = useState(blank); const [touched, setTouched] = useState(false); const [serverErr, setServerErr] = useState('');
  useEffect(() => { if (open) { setF({ ...blank, accountId: accounts[0]?.id ?? '' }); setTouched(false); setServerErr(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const amt = Number(f.amount), dur = Number(f.durationMonths), inc = Number(f.monthlyIncome);
  const e = {
    amount: !(amt >= 500 && amt <= 500000) ? 'Between $500 and $500,000' : '', durationMonths: !(Number.isInteger(dur) && dur >= 3 && dur <= 360) ? '3 to 360 months' : '',
    monthlyIncome: !(inc > 0) ? 'Enter your monthly income' : '', accountId: !f.accountId ? 'Choose the account to receive funds' : '',
  };
  const r = RATES[f.loanType] / 1200; const est = !e.amount && !e.durationMonths ? (r ? (amt * r) / (1 - Math.pow(1 + r, -dur)) : amt / dur) : 0;
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setTouched(true); if (Object.values(e).some(Boolean)) return; setServerErr('');
    try { await apply({ accountId: f.accountId, loanType: f.loanType, amount: amt, durationMonths: dur, monthlyIncome: inc, employmentStatus: f.employmentStatus, description: f.description || undefined }).unwrap(); dispatch(pushToast('success', 'Loan application submitted')); onClose(); }
    catch (err) { setServerErr(errMsg(err)); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Apply for a loan" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="loan-form" loading={isLoading}>Submit application</Button></>}>
      <form id="loan-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Loan type"><Select value={f.loanType} onChange={set('loanType')}>{LOAN_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)} · {RATES[t]}% p.a.</option>)}</Select></Field>
        <Field label="Disburse to account" error={touched ? e.accountId : undefined}><Select value={f.accountId} onChange={set('accountId')}>{accounts.map((a) => <option key={a.id} value={a.id}>{titleCase(a.type)} · {a.accountNumber}</option>)}</Select></Field>
        <Field label="Requested amount (USD)" error={touched ? e.amount : undefined}><Input inputMode="decimal" className="num" value={f.amount} onChange={set('amount')} invalid={touched && !!e.amount} placeholder="10000" /></Field>
        <Field label="Duration (months)" error={touched ? e.durationMonths : undefined}><Input inputMode="numeric" className="num" value={f.durationMonths} onChange={set('durationMonths')} invalid={touched && !!e.durationMonths} /></Field>
        <Field label="Monthly income (USD)" error={touched ? e.monthlyIncome : undefined}><Input inputMode="decimal" className="num" value={f.monthlyIncome} onChange={set('monthlyIncome')} invalid={touched && !!e.monthlyIncome} /></Field>
        <Field label="Employment status"><Select value={f.employmentStatus} onChange={set('employmentStatus')}>{EMPLOYMENT.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select></Field>
        <Field label="What is the loan for?" className="sm:col-span-2"><Textarea maxLength={500} value={f.description} onChange={set('description')} /></Field>
        {est > 0 && <p className="rounded-lg bg-brand/8 px-3 py-2 text-sm sm:col-span-2">Estimated monthly payment <b className="num">{money(est)}</b> at {RATES[f.loanType]}% — final terms are set on approval.</p>}
        {serverErr && <p role="alert" className="text-sm text-danger sm:col-span-2">{serverErr}</p>}
      </form>
    </Modal>
  );
}

export default function LoansPage() {
  const role = useRole(); const dispatch = useAppDispatch(); const params = useSearchParams();
  const isOps = role === 'ADMIN' || role === 'STAFF';
  const { status, page } = useAppSelector((s) => s.loans);
  const [q, setQ] = useState(''); const dq = useDebounced(q.trim()); const [open, setOpen] = useState(false);
  useEffect(() => { const s = params.get('status'); if (s) dispatch(setLoanFilters({ status: s })); }, [params, dispatch]);
  useEffect(() => { dispatch(setLoanFilters({ q: dq })); }, [dq, dispatch]);
  const filterQ = useAppSelector((s) => s.loans.q);
  const { data, isFetching, error, refetch } = useGetLoansQuery({ status, q: filterQ, page, pageSize: 10 });
  const tabs = [{ id: '', label: 'All' }, { id: 'PENDING', label: 'Pending' }, { id: 'UNDER_REVIEW', label: 'Under review' }, { id: 'ACTIVE', label: 'Active' }, { id: 'REJECTED', label: 'Rejected' }, { id: 'COMPLETED', label: 'Completed' }];
  return (
    <>
      <PageHeader title={role === 'STAFF' ? 'Loan desk' : 'Loans'} subtitle={isOps ? 'Review applications, add notes and manage decisions.' : 'Apply for a loan and track repayments.'}
        actions={role === 'CUSTOMER' && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Apply for a loan</Button>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs tabs={tabs} value={status} onChange={(s) => dispatch(setLoanFilters({ status: s }))} />
          {isOps && <div className="relative lg:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input className="pl-9" aria-label="Search loans" placeholder="Customer or reference…" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
        </div>
        {error ? <ErrorState error={error} onRetry={refetch} /> : !data ? <TableSkeleton /> : !data.items.length ? <EmptyState title="No loans here" text={role === 'CUSTOMER' ? 'Apply for a loan to get started.' : 'No applications match this view.'} /> : (
          <div className={`overflow-x-auto ${isFetching ? 'opacity-60' : ''}`}><table className="w-full min-w-[760px]">
            <thead><tr className="border-b border-line bg-surface2/60"><th className="th">Loan</th>{isOps && <th className="th">Customer</th>}<th className="th">Applied</th><th className="th">Status</th><th className="th text-right">Amount</th><th className="th text-right">Remaining</th></tr></thead>
            <tbody className="divide-y divide-line">{data.items.map((l) => (
              <tr key={l.id} className="hover:bg-surface2/70">
                <td className="td"><Link href={`/loans/${l.id}`} className="block font-medium hover:underline">{titleCase(l.loanType)} loan<span className="num block text-xs font-normal text-muted">{l.reference} · {l.durationMonths} mo</span></Link></td>
                {isOps && <td className="td">{l.customer.name}</td>}
                <td className="td text-xs text-muted">{fmtDate(l.createdAt)}</td><td className="td"><StatusBadge status={l.status} /></td>
                <td className="td num text-right font-semibold">{money(l.amount)}</td><td className="td num text-right">{l.remainingBalance != null ? money(l.remainingBalance) : '—'}</td>
              </tr>))}</tbody></table></div>
        )}
        {data && data.total > 0 && <Pagination page={page} pageSize={10} total={data.total} onChange={(p) => dispatch(setLoanPage(p))} />}
      </Card>
      <ApplyModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
