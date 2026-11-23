import { z } from 'zod';
import { body, route } from '@/lib/api';
import { forwardLoan } from '@/lib/services/loans';
export const POST = route<{ id: string }>(['ADMIN', 'STAFF'], async ({ req, user, params }) => {
  const b = await body(req, z.object({ note: z.string().trim().max(1000).optional() })); await forwardLoan(user, params.id, b.note); return { ok: true };
});
