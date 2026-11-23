import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AppShell from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  return <AppShell role={session.user.role} name={session.user.name ?? ''} email={session.user.email ?? ''}>{children}</AppShell>;
}
