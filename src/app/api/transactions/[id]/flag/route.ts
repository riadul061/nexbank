import { z } from 'zod';
import { body, route } from '@/lib/api';
import { clearFlag, flagTransaction } from '@/lib/services/transactions';
export const POST = route<{ id: string }>(['ADMIN', 'STAFF'], async ({ req, user, params }) => {
  const b = await body(req, z.object({ reason: z.string().trim().min(3, 'Please describe why').max(300) }));
  await flagTransaction(user, params.id, b.reason); return { ok: true };
});
export const DELETE = route<{ id: string }>(['ADMIN'], async ({ params }) => { await clearFlag(params.id); return { ok: true }; });
