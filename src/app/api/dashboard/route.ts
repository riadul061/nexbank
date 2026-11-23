import { query, route } from '@/lib/api';
import { z } from 'zod';
import { adminDashboard, customerDashboard } from '@/lib/services/analytics';
export const GET = route('any', async ({ req, user }) => {
  if (user.role === 'CUSTOMER') return customerDashboard(user, query(req, z.object({ accountId: z.string().optional() })).accountId);
  return adminDashboard(user);
});
