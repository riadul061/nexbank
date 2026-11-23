'use client';
import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useGetSettingsQuery, useSaveSettingsMutation } from '@/features/settings/settingsApi';
import { useAppDispatch } from '@/store/store';
import { pushToast } from '@/features/ui/uiSlice';
import { ErrorState, PageHeader } from '@/components/ui/data';
import { Button, Card, CardHeader, Field, Input, Skeleton } from '@/components/ui/primitives';
import { useRole } from '@/hooks/useRole';
import type { BankSettings } from '@/types';

const FIELDS: { key: keyof BankSettings; label: string; hint: string; suffix?: string; max?: number }[] = [
  { key: 'dailyTransferLimit', label: 'Daily transfer limit', hint: 'Maximum a single account can send per day (default per-account cap).' },
  { key: 'maxSingleTransaction', label: 'Maximum single transaction', hint: 'Largest amount allowed in one transfer, bank-wide.' },
  { key: 'minAccountBalance', label: 'Minimum account balance', hint: 'Balance that must remain after any debit.' },
  { key: 'transferFeePercent', label: 'Transfer fee', hint: 'Charged on transfers to other customers. Own-account transfers are free.', suffix: '%', max: 10 },
  { key: 'suspiciousAmount', label: 'Suspicious amount threshold', hint: 'Transfers at or above this value are auto-flagged for admin review.' },
];

export default function SettingsPage() {
  const role = useRole(); const dispatch = useAppDispatch();
  const { data, isLoading, error, refetch } = useGetSettingsQuery();
  const [save, { isLoading: saving }] = useSaveSettingsMutation();
  const [f, setF] = useState<Record<string, string>>({}); const [touched, setTouched] = useState(false);
  useEffect(() => { if (data) setF(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))); }, [data]);
  const err = (k: keyof BankSettings, max?: number) => { const n = Number(f[k]); return f[k] === '' || !isFinite(n) || n < 0 ? 'Enter a non-negative number' : max && n > max ? `Maximum ${max}` : ''; };
  const dirty = !!data && FIELDS.some((x) => Number(f[x.key]) !== data[x.key]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); if (FIELDS.some((x) => err(x.key, x.max))) return;
    try { await save(Object.fromEntries(FIELDS.map((x) => [x.key, Number(f[x.key])])) as unknown as BankSettings).unwrap(); dispatch(pushToast('success', 'Settings saved — applied to all new transactions')); setTouched(false); } catch { /* toast */ }
  };
  if (role && role !== 'ADMIN') return <Card className="mx-auto max-w-md p-8 text-center"><ShieldAlert className="mx-auto h-9 w-9 text-warn" /><p className="mt-3 font-semibold">Admin only</p><p className="mt-1 text-sm text-muted">Bank-wide financial settings can only be changed by an administrator.</p></Card>;
  return (
    <>
      <PageHeader title="Bank settings" subtitle="Transaction limits and fees. Changes apply immediately to new transactions." />
      {error ? <Card><ErrorState error={error} onRetry={refetch} /></Card> : (
        <Card className="max-w-2xl"><CardHeader title="Transaction limits" />
          {isLoading ? <div className="space-y-4 p-5"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : (
            <form onSubmit={submit} noValidate className="space-y-5 p-5">
              {FIELDS.map((x) => (
                <Field key={x.key} label={x.label} hint={x.hint} error={touched ? err(x.key, x.max) : undefined}>
                  <div className="relative">{!x.suffix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>}
                    <Input inputMode="decimal" className={`num ${x.suffix ? 'pr-8' : 'pl-7'}`} value={f[x.key] ?? ''} onChange={(e) => setF((p) => ({ ...p, [x.key]: e.target.value.replace(/[^\d.]/g, '') }))} invalid={touched && !!err(x.key, x.max)} />
                    {x.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{x.suffix}</span>}</div>
                </Field>
              ))}
              <Button type="submit" loading={saving} disabled={!dirty}>Save settings</Button>
            </form>)}
        </Card>
      )}
    </>
  );
}
