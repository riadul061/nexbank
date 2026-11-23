import { z } from 'zod';
import { body, route } from '@/lib/api';
import { forbidden } from '@/lib/errors';
import { getCustomer, setUserStatus, verifyCustomer } from '@/lib/services/customers';
export const GET = route<{ id: string }>(['ADMIN', 'STAFF'], async ({ user, params }) => getCustomer(user, params.id));
export const PATCH = route<{ id: string }>(['ADMIN', 'STAFF'], async ({ req, user, params }) => {
  const b = await body(req, z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(), verify: z.literal(true).optional() }));
  if (b.status) { if (user.role !== 'ADMIN') throw forbidden('Only admins can activate, deactivate or block customers'); await setUserStatus(user, params.id, b.status); }
  if (b.verify) await verifyCustomer(user, params.id);
  return { ok: true };
});
