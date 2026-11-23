'use client';
import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useGetMeQuery, useSetPinMutation } from '@/features/settings/profileApi';
import { useAppDispatch } from '@/store/store';
import { pushToast } from '@/features/ui/uiSlice';
import { errMsg } from '@/store/baseApi';
import { DetailRow, ErrorState, PageHeader } from '@/components/ui/data';
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, Skeleton } from '@/components/ui/primitives';
import { fmtDate } from '@/lib/utils';

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const { data: me, isLoading, error, refetch } = useGetMeQuery();
  const [setPin, { isLoading: saving }] = useSetPinMutation();
  const [cur, setCur] = useState(''); const [pin, setPinV] = useState(''); const [again, setAgain] = useState(''); const [touched, setTouched] = useState(false); const [serverErr, setServerErr] = useState('');
  const errs = { cur: me?.hasPin && !/^\d{4,6}$/.test(cur) ? 'Enter your current PIN' : '', pin: !/^\d{4,6}$/.test(pin) ? 'PIN must be 4–6 digits' : '', again: pin !== again ? 'PINs do not match' : '' };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerErr(''); if (Object.values(errs).some(Boolean)) return;
    try { await setPin({ pin, currentPin: me?.hasPin ? cur : undefined }).unwrap(); dispatch(pushToast('success', 'Transaction PIN saved')); setCur(''); setPinV(''); setAgain(''); setTouched(false); } catch (err) { setServerErr(errMsg(err)); }
  };
  if (error) return <Card><ErrorState error={error} onRetry={refetch} /></Card>;
  return (
    <>
      <PageHeader title="Profile & security" subtitle="Your details and transaction PIN." />
      {isLoading || !me ? <Skeleton className="h-72" /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><div className="flex items-center gap-4 p-5 pb-2"><Avatar name={me.name} size={56} /><div><p className="text-lg font-semibold">{me.name}</p><p className="text-sm text-muted">{me.email}</p></div></div>
            <dl className="divide-y divide-line px-5 pb-3"><DetailRow label="Verification">{me.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warn">Pending verification</Badge>}</DetailRow><DetailRow label="Phone">{me.phone || '—'}</DetailRow><DetailRow label="Address">{me.address || '—'}</DetailRow><DetailRow label="Member since">{fmtDate(me.createdAt)}</DetailRow></dl></Card>
          <Card><CardHeader title={me.hasPin ? 'Change transaction PIN' : 'Set transaction PIN'} subtitle="Required to authorise transfers and loan repayments." action={<KeyRound className="h-5 w-5 text-muted" />} />
            <form onSubmit={submit} noValidate className="space-y-4 p-5">
              {me.hasPin && <Field label="Current PIN" error={touched ? errs.cur : undefined}><Input type="password" inputMode="numeric" maxLength={6} autoComplete="off" value={cur} onChange={(e) => setCur(e.target.value.replace(/\D/g, ''))} /></Field>}
              <Field label="New PIN (4–6 digits)" error={touched ? errs.pin : undefined}><Input type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin} onChange={(e) => setPinV(e.target.value.replace(/\D/g, ''))} /></Field>
              <Field label="Confirm new PIN" error={touched ? errs.again : undefined}><Input type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, ''))} /></Field>
              {serverErr && <p role="alert" className="text-sm text-danger">{serverErr}</p>}
              <Button type="submit" loading={saving}>Save PIN</Button>
              <p className="flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />PINs are stored hashed. After 3 wrong attempts your PIN is temporarily locked.</p>
            </form></Card>
        </div>
      )}
    </>
  );
}
