'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { ArrowLeft, Check, Send, X } from 'lucide-react';
import { useAddLoanNoteMutation, useDecideLoanMutation, useForwardLoanMutation, useGetLoanQuery, useRepayLoanMutation } from '@/features/loans/loansApi';
import { useGetAccountsQuery } from '@/features/accounts/accountsApi';
import { useAppDispatch } from '@/store/store';
import { pushToast } from '@/features/ui/uiSlice';
import { errMsg } from '@/store/baseApi';
import { DetailRow, ErrorState, PageHeader } from '@/components/ui/data';
import { ConfirmDialog, Modal } from '@/components/ui/feedback';
import { Badge, Button, Card, CardHeader, Field, Input, Select, Skeleton, StatusBadge, Textarea } from '@/components/ui/primitives';
import { TxTable } from '@/components/shared';
import { useRole } from '@/hooks/useRole';
import { fmtDate, fmtDateTime, money, newKey, titleCase } from '@/lib/utils';
import type { InstallmentDTO } from '@/types';

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const role = useRole(); const dispatch = useAppDispatch();
  const { data: l, isLoading, error, refetch } = useGetLoanQuery(id);
  const accounts = useGetAccountsQuery(undefined, { skip: role !== 'CUSTOMER' }).data?.items.filter((a) => a.status === 'ACTIVE') ?? [];
  const [note, setNote] = useState('');
  const [addNote, an] = useAddLoanNoteMutation(); const [forward, fw] = useForwardLoanMutation(); const [decide, dc] = useDecideLoanMutation(); const [repay, rp] = useRepayLoanMutation();
  const [dlg, setDlg] = useState<'APPROVE' | 'REJECT' | 'FORWARD' | null>(null);
  const [pay, setPay] = useState<InstallmentDTO | null>(null); const [payAcc, setPayAcc] = useState(''); const [pin, setPin] = useState(''); const [payErr, setPayErr] = useState('');
  const key = useRef(newKey());
  const isOps = role === 'ADMIN' || role === 'STAFF';
  if (error) return <Card><ErrorState error={error} onRetry={refetch} /></Card>;

  const ok = (m: string) => dispatch(pushToast('success', m));
  const doDecide = async (n: string, d: 'APPROVE' | 'REJECT') => { try { await decide({ id, decision: d, note: n || undefined }).unwrap(); ok(d === 'APPROVE' ? 'Loan approved and disbursed' : 'Loan rejected'); } catch { /* toast */ } setDlg(null); };
  const doForward = async (n: string) => { try { await forward({ id, note: n || undefined }).unwrap(); ok('Forwarded to admin for approval'); } catch { /* toast */ } setDlg(null); };
  const doNote = async () => { try { await addNote({ id, body: note.trim() }).unwrap(); setNote(''); ok('Note added'); } catch { /* toast */ } };
  const doPay = async () => {
    if (!pay) return; setPayErr('');
    try { await repay({ id, accountId: payAcc || accounts[0]?.id, installmentNumber: pay.number, pin, idempotencyKey: key.current }).unwrap(); ok(`Installment #${pay.number} paid`); setPay(null); setPin(''); key.current = newKey(); }
    catch (e) { setPayErr(errMsg(e)); setPin(''); key.current = newKey(); }
  };
  const nextDue = l?.installments.find((i) => i.status === 'DUE');
  const paidPct = l && l.totalPayable ? Math.round(((l.totalPayable - (l.remainingBalance ?? 0)) / l.totalPayable) * 100) : 0;

  return (
    <>
      <Link href="/loans" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to loans</Link>
      {isLoading || !l ? <Skeleton className="h-96 w-full" /> : (
        <>
          <PageHeader title={`${titleCase(l.loanType)} loan`} subtitle={<span className="num">{l.reference}</span>}
            actions={<>
              <StatusBadge status={l.status} />
              {role === 'STAFF' && l.status === 'PENDING' && <Button onClick={() => setDlg('FORWARD')}><Send className="h-4 w-4" />Forward to admin</Button>}
              {role === 'ADMIN' && (l.status === 'PENDING' || l.status === 'UNDER_REVIEW') && <><Button onClick={() => setDlg('APPROVE')}><Check className="h-4 w-4" />Approve</Button><Button variant="secondary" onClick={() => setDlg('REJECT')}><X className="h-4 w-4" />Reject</Button></>}
            </>} />
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1"><CardHeader title="Application" />
              <dl className="divide-y divide-line px-5 pb-3 pt-1">
                {isOps && <DetailRow label="Customer"><Link href={`/customers/${l.customer.id}`} className="hover:underline">{l.customer.name}</Link></DetailRow>}
                <DetailRow label="Requested">{money(l.amount)}</DetailRow><DetailRow label="Duration">{l.durationMonths} months</DetailRow><DetailRow label="Interest rate">{l.interestRate}% p.a.</DetailRow>
                <DetailRow label="Monthly income">{money(l.monthlyIncome)}</DetailRow><DetailRow label="Employment">{titleCase(l.employmentStatus)}</DetailRow>
                <DetailRow label="Disburse to"><span className="num">{l.account.accountNumber}</span></DetailRow><DetailRow label="Applied">{fmtDate(l.createdAt)}</DetailRow>
                {l.decidedAt && <DetailRow label="Decided">{fmtDate(l.decidedAt)}</DetailRow>}
                {l.description && <div className="py-2.5 text-sm"><dt className="text-muted">Purpose</dt><dd className="mt-1">{l.description}</dd></div>}
                {l.decisionNote && <div className="py-2.5 text-sm"><dt className="text-muted">Decision note</dt><dd className="mt-1">{l.decisionNote}</dd></div>}
              </dl></Card>

            <div className="space-y-6 lg:col-span-2">
              {l.monthlyPayment != null && (
                <Card className="p-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div><p className="text-xs text-muted">Remaining balance</p><p className="num display text-2xl font-semibold">{money(l.remainingBalance)}</p></div>
                    <div><p className="text-xs text-muted">Monthly payment</p><p className="num display text-2xl font-semibold">{money(l.monthlyPayment)}</p></div>
                    <div><p className="text-xs text-muted">Total payable</p><p className="num display text-2xl font-semibold">{money(l.totalPayable)}</p></div>
                  </div>
                  <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-ink/8"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${paidPct}%` }} /></div><p className="mt-1.5 text-xs text-muted">{paidPct}% repaid · {l.paidInstallments ?? 0} of {l.durationMonths} installments</p></div>
                </Card>
              )}
              {isOps && l.customerSummary && (
                <Card className="p-5"><h3 className="mb-2 text-sm font-semibold">Customer review</h3><div className="flex flex-wrap gap-2 text-xs">
                  <Badge tone={l.customerSummary.verified ? 'success' : 'warn'}>{l.customerSummary.verified ? 'Identity verified' : 'Not verified'}</Badge><Badge tone="info">{l.customerSummary.accounts} account(s)</Badge><Badge tone="brand">{money(l.customerSummary.totalBalance)} on deposit</Badge><StatusBadge status={l.customerSummary.status} /></div></Card>
              )}
              {l.installments.length > 0 && (
                <Card><CardHeader title="Repayment schedule" />
                  <div className="max-h-96 overflow-auto p-2"><table className="w-full min-w-[460px]"><thead className="sticky top-0 bg-surface"><tr><th className="th">#</th><th className="th">Due date</th><th className="th">Status</th><th className="th text-right">Amount</th>{role === 'CUSTOMER' && <th className="th" />}</tr></thead>
                    <tbody className="divide-y divide-line">{l.installments.map((i) => (
                      <tr key={i.id}><td className="td num">{i.number}</td><td className="td">{fmtDate(i.dueDate)}</td><td className="td"><StatusBadge status={i.status} />{i.paidAt && <span className="ml-2 text-xs text-muted">{fmtDate(i.paidAt)}</span>}</td>
                        <td className="td num text-right">{money(i.amount)}</td>
                        {role === 'CUSTOMER' && <td className="td text-right">{nextDue?.id === i.id && l.status === 'ACTIVE' && <Button size="sm" onClick={() => { setPay(i); setPayAcc(accounts.find((a) => a.id === l.account.id)?.id ?? accounts[0]?.id ?? ''); setPayErr(''); }}>Pay now</Button>}</td>}
                      </tr>))}</tbody></table></div></Card>
              )}
              {l.repayments.length > 0 && <Card><CardHeader title="Repayment history" /><div className="pt-3"><TxTable items={l.repayments} showViewerAmount={false} /></div></Card>}
              {isOps && (
                <Card><CardHeader title="Internal notes" subtitle="Visible to staff and admins only." />
                  <div className="space-y-3 p-5">
                    {l.notes.length === 0 && <p className="text-sm text-muted">No notes yet.</p>}
                    {l.notes.map((n) => <div key={n.id} className="rounded-lg bg-surface2 p-3 text-sm"><p>{n.body}</p><p className="mt-1 text-xs text-muted">{n.authorName} · {fmtDateTime(n.createdAt)}</p></div>)}
                    <Textarea rows={2} placeholder="Add an internal note…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
                    <Button variant="secondary" size="sm" disabled={note.trim().length < 2} loading={an.isLoading} onClick={doNote}>Add note</Button>
                  </div></Card>
              )}
            </div>
          </div>
        </>
      )}
      <ConfirmDialog open={dlg === 'APPROVE'} loading={dc.isLoading} title="Approve loan" confirmLabel="Approve & disburse" askReason reasonLabel="Note (optional)" onCancel={() => setDlg(null)} onConfirm={(n) => doDecide(n, 'APPROVE')}
        message={l && <p>{money(l.amount)} will be disbursed to account {l.account.accountNumber} as a recorded Loan Disbursement transaction, and the repayment schedule is created.</p>} />
      <ConfirmDialog open={dlg === 'REJECT'} tone="danger" loading={dc.isLoading} title="Reject loan" confirmLabel="Reject" askReason reasonRequired reasonLabel="Reason for rejection" onCancel={() => setDlg(null)} onConfirm={(n) => doDecide(n, 'REJECT')} message="The customer will be notified." />
      <ConfirmDialog open={dlg === 'FORWARD'} loading={fw.isLoading} title="Forward for approval" confirmLabel="Forward" askReason reasonLabel="Note for the admin (optional)" onCancel={() => setDlg(null)} onConfirm={doForward} message="The application moves to Under Review. Only an admin can approve or reject it." />
      <Modal open={!!pay} onClose={() => setPay(null)} size="sm" title={`Pay installment #${pay?.number ?? ''}`} footer={<><Button variant="secondary" onClick={() => setPay(null)}>Cancel</Button><Button loading={rp.isLoading} disabled={!/^\d{4,6}$/.test(pin) || !payAcc} onClick={doPay}>Pay {money(pay?.amount)}</Button></>}>
        <div className="space-y-4"><Field label="Pay from"><Select value={payAcc} onChange={(e) => setPayAcc(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{titleCase(a.type)} · {a.accountNumber} · {money(a.balance)}</option>)}</Select></Field>
          <Field label="Transaction PIN" error={payErr || undefined}><Input type="password" inputMode="numeric" maxLength={6} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></Field></div>
      </Modal>
    </>
  );
}
