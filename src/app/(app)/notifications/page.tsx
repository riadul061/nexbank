'use client';
import Link from 'next/link';
import { BellOff, CheckCheck } from 'lucide-react';
import { useGetNotificationsQuery, useMarkReadMutation } from '@/features/notifications/notificationsApi';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/ui/data';
import { Button, Card } from '@/components/ui/primitives';
import { cn, fmtDateTime } from '@/lib/utils';

export default function NotificationsPage() {
  const { data, isLoading, error, refetch } = useGetNotificationsQuery();
  const [markRead, { isLoading: marking }] = useMarkReadMutation();
  return (
    <>
      <PageHeader title="Notifications" subtitle={data ? `${data.unread} unread` : undefined} actions={!!data?.unread && <Button variant="secondary" loading={marking} onClick={() => markRead()}><CheckCheck className="h-4 w-4" />Mark all as read</Button>} />
      <Card>
        {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <TableSkeleton /> : !data?.items.length ? <EmptyState icon={<BellOff className="h-6 w-6" />} title="You’re all caught up" text="Transfers received, approvals and loan decisions show up here." /> : (
          <ul className="divide-y divide-line">{data.items.map((n) => {
            const body = (<div className={cn('flex gap-3 px-5 py-4', !n.read && 'bg-brand/5')}><span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand')} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{n.title}</p><p className="text-sm text-muted">{n.body}</p><p className="mt-1 text-xs text-muted/80">{fmtDateTime(n.createdAt)}</p></div></div>);
            return <li key={n.id} onClick={() => !n.read && markRead({ id: n.id })}>{n.link ? <Link href={n.link} className="block hover:bg-surface2/70">{body}</Link> : body}</li>;
          })}</ul>
        )}
      </Card>
    </>
  );
}
