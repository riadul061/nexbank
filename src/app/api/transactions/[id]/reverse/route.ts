import { z } from 'zod';
import { body, route } from '@/lib/api';
import { reverseTransfer } from '@/lib/services/transactions';
export const POST = route<{ id: string }>(['ADMIN'], async ({ req, user, params }) => {
  const b = await body(req, z.object({ reason: z.string().trim().min(3).max(200) }));
  await reverseTransfer(user, params.id, b.reason); return { ok: true };
});
