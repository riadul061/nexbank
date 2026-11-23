import { body, route } from '@/lib/api';
import { reviewRequest, reviewSchema } from '@/lib/services/requests';
export const PATCH = route<{ id: string }>(['ADMIN', 'STAFF'], async ({ req, user, params }) => {
  const b = await body(req, reviewSchema); await reviewRequest(user, params.id, b.decision, b.note); return { ok: true };
});
