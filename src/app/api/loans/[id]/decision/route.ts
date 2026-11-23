import { body, route } from '@/lib/api';
import { decideLoan, loanDecisionSchema } from '@/lib/services/loans';
// Admin only: staff can review and forward but never approve/reject.
export const POST = route<{ id: string }>(['ADMIN'], async ({ req, user, params }) => {
  const b = await body(req, loanDecisionSchema); await decideLoan(user, params.id, b.decision, b.note); return { ok: true };
});
