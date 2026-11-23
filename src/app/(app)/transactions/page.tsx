'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { resetTxFilters, setTxFilters, setTxPage } from '@/features/transactions/transactionsSlice';
import { useGetTransactionsQuery } from '@/features/transactions/transactionsApi';
import { PageHeader, Pagination, Tabs } from '@/components/ui/data';
import { Button, Card, Input, Select } from '@/components/ui/primitives';
import { TX_TYPES, TxTable } from '@/components/shared';
import { useDebounced } from '@/hooks/useDebounced';
import { useRole } from '@/hooks/useRole';

export default function TransactionsPage() {
  const dispatch = useAppDispatch();
  const role = useRole();
  const params = useSearchParams();
  const f = useAppSelector((s) => s.transactions.filters);
  const [q, setQ] = useState(f.q);
  const dq = useDebounced(q.trim());
  useEffect(() => { if (dq !== f.q) dispatch(setTxFilters({ q: dq })); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (params.get('flagged') === 'true') dispatch(setTxFilters({ flagged: 'true' })); }, [params, dispatch]);
  const { data, isFetching, error, refetch } = useGetTransactionsQuery(f);
  const isOps = role === 'ADMIN' || role === 'STAFF';
  const active = !!(f.q || f.type || f.status || f.from || f.to || f.flagged);

  return (
    <>
      <PageHeader title="Transactions" subtitle={isOps ? 'Search, filter and review every transaction on the ledger.' : 'Your complete transaction history.'} />
      {isOps && <div className="mb-4"><Tabs value={f.flagged === 'true' ? 'flagged' : f.status === 'PENDING' ? 'pending' : 'all'} onChange={(id) => dispatch(setTxFilters(id === 'flagged' ? { flagged: 'true', status: '' } : id === 'pending' ? { status: 'PENDING', flagged: '' } : { flagged: '', status: '' }))}
        tabs={[{ id: 'all', label: 'All' }, { id: 'pending', label: 'Pending review' }, { id: 'flagged', label: 'Flagged' }]} /></div>}
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input className="pl-9" aria-label="Search by transaction ID" placeholder="Search by transaction ID…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select aria-label="Type" value={f.type} onChange={(e) => dispatch(setTxFilters({ type: e.target.value }))}><option value="">All types</option>{TX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
          <Select aria-label="Status" value={f.status} onChange={(e) => dispatch(setTxFilters({ status: e.target.value }))}><option value="">All statuses</option>{['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'].map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}</Select>
          <Input type="date" aria-label="From date" value={f.from} max={f.to || undefined} onChange={(e) => dispatch(setTxFilters({ from: e.target.value }))} />
          <Input type="date" aria-label="To date" value={f.to} min={f.from || undefined} onChange={(e) => dispatch(setTxFilters({ to: e.target.value }))} />
          {active && <div className="sm:col-span-2 lg:col-span-6"><Button variant="ghost" size="sm" onClick={() => { setQ(''); dispatch(resetTxFilters()); }}><X className="h-3.5 w-3.5" />Clear filters</Button></div>}
        </div>
        <div className={isFetching && data ? 'opacity-60 transition' : 'transition'}>
          <TxTable items={data?.items} loading={!data && isFetching} error={error} onRetry={refetch} />
        </div>
        {data && data.total > 0 && <Pagination page={f.page} pageSize={f.pageSize} total={data.total} onChange={(p) => dispatch(setTxPage(p))} />}
      </Card>
    </>
  );
}
