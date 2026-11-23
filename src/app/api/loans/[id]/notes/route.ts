import { z } from 'zod';
import { body, route } from '@/lib/api';
import { addLoanNote } from '@/lib/services/loans';
export const POST = route<{ id: string }>(['ADMIN', 'STAFF'], async ({ req, user, params }) => {
  const b = await body(req, z.object({ body: z.string().trim().min(2).max(1000) })); await addLoanNote(user, params.id, b.body); return { ok: true };
});
