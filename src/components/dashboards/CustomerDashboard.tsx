'use client';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Send, Wallet } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectAccount } from '@/features/accounts/accountsSlice';
import { useGetAccountsQuery } from '@/features/accounts/accountsApi';
import { useGetCustomerDashboardQuery } from '@/features/dashboard/dashboardApi';
import { PageHeader, StatCard, ErrorState, EmptyState } from '@/components/ui/data';
import { AccountCard, Panel, TxList } from '@/components/shared';
import { Donut, GroupedBars, VolumeArea } from '@/components/charts';
import { Button, Card, CardHeader, StatusBadge, Skeleton } from '@/components/ui/primitives';
import { fmtDate, money, titleCase } from '@/lib/utils';

export default function CustomerDashboard({ name }: { name: string }) {
  const dispatch = useAppDispatch();
  const selected = useAppSelector((s) => s.accounts.selectedAccountId);
  const accounts = useGetAccountsQuery();
  const { data, isLoading, error, refetch } = useGetCustomerDashboardQuery(selected);
  const list = accounts.data?.items ?? [];
  const current = list.find((a) => a.id === selected);
  const t = data?.totals;
  return (
    <>
      <PageHeader title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${name.split(' ')[0]}`}
        subtitle={current ? `Showing ${titleCase(current.type)} account ${current.accountNumber}` : 'Showing all of your accounts'}
        actions={<><Link href="/transfer"><Button><Send className="h-4 w-4" />Send money</Button></Link><Link href="/requests"><Button variant="secondary">Deposit / withdraw</Button></Link></>} />
      <div className="space-y-6">
        <section aria-label="Accounts">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Your accounts</h2>
            {list.length > 1 && <Button variant={selected ? 'secondary' : 'primary'} size="sm" onClick={() => dispatch(selectAccount(null))}>All accounts</Button>}</div>
          {accounts.isLoading ? <Skeleton className="h-36 w-full" /> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((a) => <AccountCard key={a.id} a={a} active={selected === a.id} onClick={() => dispatch(selectAccount(selected === a.id ? null : a.id))} />)}
            </div>
          )}
        </section>

        {error ? <Card><ErrorState error={error} onRetry={refetch} /></Card> : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatCard loading={isLoading} label="Total balance" value={money(t?.balance)} icon={<Wallet />} tone="accent" />
              <StatCard loading={isLoading} label="Total deposits" value={money(t?.deposits)} icon={<ArrowDownToLine />} />
              <StatCard loading={isLoading} label="Total withdrawals" value={money(t?.withdrawals)} icon={<ArrowUpFromLine />} tone="warn" />
              <StatCard loading={isLoading} label="Active loans" value={t?.activeLoans} hint={t && t.activeLoans ? `${money(t.loanRemaining)} remaining` : 'No active loans'} icon={<Banknote />} tone="info" />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel className="lg:col-span-2" title="Monthly spending" subtitle="Money out, last 6 months"><VolumeArea data={data?.monthlySpending ?? []} keys={['Spending']} colors={['#c9962e']} /></Panel>
              <Panel title="Transaction distribution" subtitle="By type"><Donut data={data?.distribution ?? []} centerLabel="transactions" /></Panel>
              <Panel className="lg:col-span-3" title="Monthly deposit history" subtitle="Money in, last 6 months"><GroupedBars data={data?.monthlyDeposits ?? []} keys={['Deposits']} colors={['#12957a']} /></Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader title="Recent transactions" action={<Link href="/transactions" className="text-xs font-medium text-brand hover:underline">View all</Link>} />
                <div className="pt-2"><TxList items={data?.recent ?? []} /></div>
              </Card>
              <Card>
                <CardHeader title="Active loans" action={<Link href="/loans" className="text-xs font-medium text-brand hover:underline">Manage</Link>} />
                <div className="p-5 pt-3">
                  {!data?.activeLoans.length ? <EmptyState title="No active loans" text="Apply for a loan any time." action={<Link href="/loans"><Button size="sm" variant="secondary">Apply</Button></Link>} /> : (
                    <ul className="space-y-3">{data.activeLoans.map((l) => (
                      <li key={l.id}><Link href={`/loans/${l.id}`} className="block rounded-lg border border-line p-3 transition hover:bg-surface2">
                        <div className="flex items-center justify-between"><span className="text-sm font-medium">{titleCase(l.loanType)} loan</span><StatusBadge status={l.status} /></div>
                        <p className="num mt-1 text-lg font-semibold">{money(l.remainingBalance)}<span className="text-xs font-normal text-muted"> remaining</span></p>
                        <p className="text-xs text-muted">{money(l.monthlyPayment)}/mo · since {fmtDate(l.decidedAt)}</p>
                      </Link></li>))}</ul>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}
