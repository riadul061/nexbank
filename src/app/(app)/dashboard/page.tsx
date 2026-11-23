import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import CustomerDashboard from '@/components/dashboards/CustomerDashboard';

export const metadata: Metadata = { title: 'Dashboard' };
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  return session?.user.role === 'CUSTOMER' ? <CustomerDashboard name={session.user.name ?? ''} /> : <AdminDashboard role={session?.user.role === 'ADMIN' ? 'ADMIN' : 'STAFF'} />;
}
