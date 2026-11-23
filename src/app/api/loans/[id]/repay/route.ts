import { body, route } from '@/lib/api';
import { loanRepaySchema, repayInstallment } from '@/lib/services/loans';
export const POST = route<{ id: string }>(['CUSTOMER'], async ({ req, user, params }) => repayInstallment(user, params.id, await body(req, loanRepaySchema)));
