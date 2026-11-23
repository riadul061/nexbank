'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Download, Flag, FlagOff, Undo2 } from 'lucide-react';
import { useClearFlagMutation, useFlagTransactionMutation, useGetTransactionQuery, useReverseTransactionMutation } from '@/features/transactions/transactionsApi';
import { useAppDispatch } from '@/store/store';
import { pushToast } from '@/features/ui/uiSlice';
import { errMsg } from '@/store/baseApi';
import { DetailRow, ErrorState, PageHeader } from '@/components/ui/data';
import { ConfirmDialog } from '@/components/ui/feedback';
import { Badge, Button, Card, Skeleton, StatusBadge } from '@/components/ui/primitives';
import { TX_LABEL, signedAmount } from '@/components/shared';
import { useDownload } from '@/hooks/useDownload';
import { useRole } from '@/hooks/useRole';
import { fmtDateTime, money } from '@/lib/utils';

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const role = useRole(); const dispatch = useAppDispatch();
  const { data: t, isLoading, error, refetch } = useGetTransactionQuery(id);
  const { download, busy } = useDownload();
  const [flag, fl] = useFlagTransactionMutation(); const [clear] = useClearFlagMutation(); const [reverse, rv] = useReverseTransactionMutation();
  const [dlg, setDlg] = useState<'flag' | 'reverse' | null>(null);
  const isOps = role === 'ADMIN' || role === 'STAFF';

  if (error) return <Card><ErrorState error={error} onRetry={refetch} /></Card>;
  const a = t ? signedAmount(t) : null;
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); dispatch(pushToast('success', ok)); setDlg(null); } catch (e) { dispatch(pushToast('error', errMsg(e))); } };
  return (
    <>
      <Link href="/transactions" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to transactions</Link>
      <PageHeader title="Transaction details" subtitle={t?.reference}
        actions={t && <>
          <Button variant="secondary" loading={busy} onClick={() => download(`/api/transactions/${t.id}/receipt`, `receipt-${t.reference}.pdf`)}><Download className="h-4 w-4" />Receipt (PDF)</Button>
          {isOps && !t.flagged && t.status !== 'REVERSED' && <Button variant="secondary" onClick={() => setDlg('flag')}><Flag className="h-4 w-4" />Flag</Button>}
          {role === 'ADMIN' && t.flagged && <Button variant="secondary" onClick={() => run(() => clear(t.id).unwrap(), 'Flag cleared')}><FlagOff className="h-4 w-4" />Clear flag</Button>}
          {role === 'ADMIN' && t.status === 'COMPLETED' && t.type === 'TRANSFER' && <Button variant="danger" onClick={() => setDlg('reverse')}><Undo2 className="h-4 w-4" />Reverse</Button>}
        </>} />
      {isLoading || !t || !a ? <Skeleton className="h-96 w-full" /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
              <div><p className="text-xs text-muted">{TX_LABEL[t.type]}</p><p className={`num display text-4xl font-semibold ${a.cls}`}>{a.text}</p></div>
              <div className="flex items-center gap-2">{t.flagged && <Badge tone="danger">Flagged</Badge>}<StatusBadge status={t.status} /></div>
            </div>
            <dl className="divide-y divide-line">
              <DetailRow label="Transaction ID"><span className="num break-all">{t.reference}</span></DetailRow>
              <DetailRow label="Sender">{t.sender ? <>{t.sender.ownerName}<br /><span className="num text-xs font-normal text-muted">{t.sender.accountNumber}</span></> : 'NexBank'}</DetailRow>
              <DetailRow label="Receiver">{t.receiver ? <>{t.receiver.ownerName}<br /><span className="num text-xs font-normal text-muted">{t.receiver.accountNumber}</span></> : 'NexBank'}</DetailRow>
              <DetailRow label="Amount">{money(t.amount)}</DetailRow>
              <DetailRow label="Fee">{money(t.fee)}</DetailRow>
              <DetailRow label="Date">{fmtDateTime(t.createdAt)}</DetailRow>
              <DetailRow label="Completed">{fmtDateTime(t.completedAt)}</DetailRow>
              <DetailRow label="Description">{t.description || '—'}</DetailRow>
            </dl>
          </Card>
          {t.flagged && (
            <Card className="h-fit border-danger/30 p-5"><div className="flex items-center gap-2 text-danger"><Flag className="h-4 w-4" /><h3 className="text-sm font-semibold">Flagged for review</h3></div>
              <p className="mt-2 text-sm">{t.flagReason}</p><p className="mt-1 text-xs text-muted">Source: {t.flagSource === 'RULE' ? 'Automated rule' : 'Staff'}</p></Card>
          )}
        </div>
      )}
      <ConfirmDialog open={dlg === 'flag'} title="Flag transaction" message="Flagged transactions are sent to an admin for review." askReason reasonRequired reasonLabel="Why is this suspicious?" confirmLabel="Flag" loading={fl.isLoading}
        onCancel={() => setDlg(null)} onConfirm={(reason) => run(() => flag({ id, reason }).unwrap(), 'Transaction flagged')} />
      <ConfirmDialog open={dlg === 'reverse'} tone="danger" title="Reverse transfer" message="Funds (including the fee) are returned to the sender and the transaction is marked Reversed. The receiver must hold enough balance." askReason reasonRequired confirmLabel="Reverse transfer" loading={rv.isLoading}
        onCancel={() => setDlg(null)} onConfirm={(reason) => run(() => reverse({ id, reason }).unwrap(), 'Transfer reversed')} />
    </>
  );
}
