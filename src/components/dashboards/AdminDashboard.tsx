'use client';
import Link from 'next/link';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Banknote, ClipboardList, Landmark, Receipt, Users, Wallet } from 'lucide-react';
import { useGetAdminDashboardQuery } from '@/features/dashboard/dashboardApi';
import { PageHeader, StatCard, ErrorState } from '@/components/ui/data';
import { Panel } from '@/components/shared';
import { Donut, GroupedBars, MultiLine, VolumeArea } from '@/components/charts';
import { Card } from '@/components/ui/primitives';
import { money, moneyCompact } from '@/lib/utils';

export default function AdminDashboard({ role }: { role: 'ADMIN' | 'STAFF' }) {
  const { data, isLoading, error, refetch } = useGetAdminDashboardQuery();
  const t = data?.totals;
  const l = isLoading;
  return (
    <>
      <PageHeader title={role === 'ADMIN' ? 'Bank overview' : 'Operations overview'} subtitle="Live figures computed from the ledger." />
      {error ? <Card><ErrorState error={error} onRetry={refetch} /></Card> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard loading={l} label="Registered customers" value={t?.customers} icon={<Users />} />
            <StatCard loading={l} label="Bank accounts" value={t?.accounts} icon={<Landmark />} tone="info" />
            <StatCard loading={l} label="Total bank balance" value={t ? moneyCompact(t.balance) : ''} hint={t ? money(t.balance) : undefined} icon={<Wallet />} tone="accent" />
            <StatCard loading={l} label="Total transactions" value={t?.transactions} icon={<Receipt />} />
            <StatCard loading={l} label="Total deposits" value={t ? moneyCompact(t.deposits) : ''} hint={t ? money(t.deposits) : undefined} icon={<ArrowDownToLine />} />
            <StatCard loading={l} label="Total withdrawals" value={t ? moneyCompact(t.withdrawals) : ''} hint={t ? money(t.withdrawals) : undefined} icon={<ArrowUpFromLine />} tone="warn" />
            <Link href="/loans?status=PENDING" className="block"><StatCard loading={l} label="Pending loan applications" value={t?.pendingLoans} icon={<Banknote />} tone="warn" hint="Review →" /></Link>
            <Link href="/requests" className="block"><StatCard loading={l} label="Pending fund requests" value={t?.pendingRequests} icon={<ClipboardList />} tone="info" hint="Review →" /></Link>
          </div>

          {!!t && (t.flagged > 0 || t.pendingTx > 0) && (
            <Link href="/transactions?flagged=true" className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/8 px-4 py-3 text-sm transition hover:bg-danger/12">
              <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
              <span><b>{t.flagged}</b> flagged transaction{t.flagged === 1 ? '' : 's'} awaiting review{t.pendingTx > 0 && <> · <b>{t.pendingTx}</b> pending</>}</span>
              <span className="ml-auto text-xs font-medium text-danger">Open →</span>
            </Link>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel className="lg:col-span-2" title="Monthly transaction volume" subtitle="Completed value moved, last 6 months"><VolumeArea data={data?.monthlyVolume ?? []} keys={['Volume']} /></Panel>
            <Panel title="Account distribution" subtitle="Accounts by type"><Donut data={data?.accountDistribution ?? []} centerLabel="accounts" /></Panel>
            <Panel className="lg:col-span-2" title="Deposits vs withdrawals" subtitle="Approved requests by month"><GroupedBars data={data?.depositVsWithdrawal ?? []} keys={['Deposits', 'Withdrawals']} colors={['#12957a', '#c9962e']} /></Panel>
            <Panel title="Loan approval statistics" subtitle="Applications by outcome"><Donut data={data?.loanStats ?? []} colors={['#c9962e', '#12957a', '#d0604d']} centerLabel="applications" /></Panel>
            <Panel className="lg:col-span-3" title="Monthly banking activity" subtitle="Transaction counts by type"><MultiLine data={data?.monthlyActivity ?? []} keys={Object.keys(data?.monthlyActivity?.[0] ?? {}).filter((k) => k !== 'label')} /></Panel>
          </div>
        </div>
      )}
    </>
  );
}
