'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Lock, ShieldCheck, UserCheck, XCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectAccount } from '@/features/accounts/accountsSlice';
import { useGetAccountsQuery, useLazyLookupRecipientQuery, useTransferMutation } from '@/features/accounts/accountsApi';
import { useGetSettingsQuery } from '@/features/settings/settingsApi';
import { useGetMeQuery } from '@/features/settings/profileApi';
import { errMsg } from '@/store/baseApi';
import { PageHeader, DetailRow } from '@/components/ui/data';
import { ConfirmDialog, Modal } from '@/components/ui/feedback';
import { Button, Card, Field, Input, Select, Textarea, Badge } from '@/components/ui/primitives';
import { money, newKey, titleCase } from '@/lib/utils';
import { round2 } from '@/lib/money';
import { pushToast } from '@/features/ui/uiSlice';

type Mode = 'own' | 'other';
interface Done { id: string; reference: string; amount: number; to: string }

export default function TransferPage() {
  const dispatch = useAppDispatch();
  const { data: accData } = useGetAccountsQuery();
  const { data: settings } = useGetSettingsQuery();
  const { data: me } = useGetMeQuery();
  const selected = useAppSelector((s) => s.accounts.selectedAccountId);
  const accounts = useMemo(() => (accData?.items ?? []).filter((a) => a.status === 'ACTIVE'), [accData]);
  const [lookup, lookupState] = useLazyLookupRecipientQuery();
  const [transfer, { isLoading }] = useTransferMutation();

  const [mode, setMode] = useState<Mode>('other');
  const [fromId, setFromId] = useState(''); const [toOwnId, setToOwnId] = useState(''); const [toNumber, setToNumber] = useState('');
  const [amount, setAmount] = useState(''); const [desc, setDesc] = useState(''); const [pin, setPin] = useState('');
  const [touched, setTouched] = useState(false); const [confirm, setConfirm] = useState(false); const [done, setDone] = useState<Done | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  // One idempotency key per "intent": a double-click or retry can never create a second transfer.
  const keyRef = useRef(newKey());

  useEffect(() => { if (!fromId && accounts.length) setFromId(accounts.find((a) => a.id === selected)?.id ?? accounts[0].id); }, [accounts, fromId, selected]);
  const from = accounts.find((a) => a.id === fromId);
  const others = accounts.filter((a) => a.id !== fromId);
  useEffect(() => { if (mode === 'own' && !others.find((a) => a.id === toOwnId)) setToOwnId(others[0]?.id ?? ''); }, [mode, others, toOwnId]);
  const toNum = mode === 'own' ? others.find((a) => a.id === toOwnId)?.accountNumber ?? '' : toNumber.replace(/\s/g, '');

  useEffect(() => { if (mode === 'other' && /^\d{10,16}$/.test(toNum)) void lookup(toNum, true); }, [toNum, mode, lookup]);
  const recipient = mode === 'other' && /^\d{10,16}$/.test(toNum) ? lookupState.data : undefined;

  const amt = Number(amount);
  const feePct = mode === 'own' ? 0 : settings?.transferFeePercent ?? 0;
  const fee = round2((amt * feePct) / 100);
  const errors = {
    to: !toNum ? 'Enter a recipient account number' : !/^\d{10,16}$/.test(toNum) ? 'Account numbers are 10–16 digits' : toNum === from?.accountNumber ? 'Choose a different account' : mode === 'other' && lookupState.isError ? errMsg(lookupState.error) : '',
    amount: !(amt > 0) ? 'Enter an amount greater than zero' : Math.abs(amt * 100 - Math.round(amt * 100)) > 1e-6 ? 'Maximum 2 decimal places' : from && amt + fee > from.balance ? `Insufficient balance (available ${money(from.balance)})` : settings && amt > settings.maxSingleTransaction ? `Exceeds the ${money(settings.maxSingleTransaction)} per-transaction limit` : from && amt > from.singleLimit ? `Exceeds this account’s ${money(from.singleLimit)} limit` : '',
    pin: !/^\d{4,6}$/.test(pin) ? 'Enter your 4–6 digit transaction PIN' : '',
  };
  const valid = !errors.to && !errors.amount && !errors.pin && !!from;

  const reset = () => { setAmount(''); setDesc(''); setPin(''); setToNumber(''); setTouched(false); setServerError(null); keyRef.current = newKey(); };
  const submit = async () => {
    if (!from) return;
    setServerError(null);
    try {
      const res = await transfer({ fromAccountId: from.id, toAccountNumber: toNum, amount: amt, description: desc || undefined, pin, idempotencyKey: keyRef.current }).unwrap();
      setConfirm(false); setDone({ id: res.id, reference: res.reference, amount: amt, to: recipient?.holder ?? toNum });
      dispatch(pushToast('success', 'Transfer completed')); reset();
    } catch (e) { setServerError(errMsg(e)); setConfirm(false); setPin(''); keyRef.current = newKey(); }
  };

  if (me && !me.hasPin) return (
    <><PageHeader title="Send money" />
      <Card className="mx-auto max-w-lg p-8 text-center"><Lock className="mx-auto h-9 w-9 text-warn" /><h2 className="mt-3 font-semibold">Set a transaction PIN first</h2><p className="mt-1 text-sm text-muted">A PIN is required to authorise every transfer.</p><Link href="/profile"><Button className="mt-5">Set PIN</Button></Link></Card></>
  );

  return (
    <>
      <PageHeader title="Send money" subtitle="Transfer between your accounts or to another NexBank customer." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <form onSubmit={(e) => { e.preventDefault(); setTouched(true); if (valid) setConfirm(true); }} className="space-y-5" noValidate>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface2 p-1 text-sm font-medium">
              {(['other', 'own'] as Mode[]).map((m) => <button type="button" key={m} onClick={() => setMode(m)} className={`rounded-lg px-3 py-2 transition ${mode === m ? 'bg-surface shadow-sm' : 'text-muted'}`}>{m === 'own' ? 'My accounts' : 'Another customer'}</button>)}
            </div>
            <Field label="From account">
              <Select value={fromId} onChange={(e) => { setFromId(e.target.value); dispatch(selectAccount(e.target.value)); }}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{titleCase(a.type)} · {a.accountNumber} · {money(a.balance)}</option>)}
              </Select>
            </Field>
            {mode === 'own' ? (
              <Field label="To account" error={touched && !others.length ? 'You need a second active account for this' : undefined}>
                <Select value={toOwnId} onChange={(e) => setToOwnId(e.target.value)} disabled={!others.length}>{others.map((a) => <option key={a.id} value={a.id}>{titleCase(a.type)} · {a.accountNumber} · {money(a.balance)}</option>)}</Select>
              </Field>
            ) : (
              <Field label="Recipient account number" error={touched || toNum.length >= 10 ? errors.to : undefined}>
                <Input inputMode="numeric" autoComplete="off" placeholder="e.g. 4000000000011" value={toNumber} onChange={(e) => setToNumber(e.target.value.replace(/[^\d\s]/g, ''))} invalid={!!errors.to && (touched || toNum.length >= 10)} />
                {recipient && !errors.to && <span className="mt-2 flex items-center gap-2 text-xs text-success"><UserCheck className="h-4 w-4" />{recipient.holder} · {titleCase(recipient.type)} account{!recipient.available && <Badge tone="warn">Currently unavailable</Badge>}</span>}
              </Field>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Amount (USD)" error={touched || amount ? errors.amount : undefined}>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                  <Input className="num pl-7" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} invalid={!!errors.amount && (touched || !!amount)} /></div>
              </Field>
              <Field label="Transaction PIN" error={touched ? errors.pin : undefined}>
                <Input type="password" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} invalid={touched && !!errors.pin} />
              </Field>
            </div>
            <Field label="Description (optional)"><Textarea rows={2} maxLength={140} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What’s this for?" /></Field>
            {serverError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/8 p-3 text-sm text-danger"><XCircle className="mt-0.5 h-4 w-4 shrink-0" />{serverError}</div>}
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!from || (mode === 'own' && !others.length)}>Review transfer</Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Summary</h3>
            <dl className="mt-2 divide-y divide-line">
              <DetailRow label="Available">{money(from?.balance)}</DetailRow>
              <DetailRow label="Amount">{amt > 0 ? money(amt) : '—'}</DetailRow>
              <DetailRow label={`Fee (${feePct}%)`}>{money(fee)}</DetailRow>
              <DetailRow label="Total debit"><span className="text-base">{money(amt > 0 ? amt + fee : 0)}</span></DetailRow>
            </dl>
          </Card>
          <Card className="p-5 text-sm text-muted"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-brand" /><p>Transfers are atomic: both accounts update together or not at all. Limits: <b className="text-ink">{settings ? `${money(settings.maxSingleTransaction)}` : '…'}</b> per transaction, <b className="text-ink">{settings ? money(settings.dailyTransferLimit) : '…'}</b> per day.</p></div></Card>
        </div>
      </div>

      <ConfirmDialog open={confirm} loading={isLoading} title="Confirm transfer" confirmLabel={`Send ${money(amt)}`} onCancel={() => setConfirm(false)} onConfirm={submit}
        message={<div><p>You’re sending <b className="text-ink">{money(amt)}</b> to <b className="text-ink">{recipient?.holder ?? toNum}</b> ({toNum}).</p>{fee > 0 && <p className="mt-1">A fee of {money(fee)} applies. Total debit {money(amt + fee)}.</p>}<p className="mt-2">This action can’t be undone by you.</p></div>} />

      <Modal open={!!done} onClose={() => setDone(null)} size="sm" title="Transfer complete"
        footer={<><Button variant="secondary" onClick={() => setDone(null)}>New transfer</Button>{done && <Link href={`/transactions/${done.id}`}><Button className="w-full">View receipt</Button></Link>}</>}>
        {done && <div className="text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-success" /><p className="num display mt-3 text-3xl font-semibold">{money(done.amount)}</p><p className="mt-1 text-sm text-muted">sent to {done.to}</p><p className="num mt-3 text-xs text-muted">Ref {done.reference}</p></div>}
      </Modal>
    </>
  );
}
