import { body, query, route } from '@/lib/api';
import { applyForLoan, listLoans, loanApplySchema, loanFilterSchema } from '@/lib/services/loans';
export const GET = route('any', async ({ req, user }) => listLoans(user, query(req, loanFilterSchema)));
export const POST = route(['CUSTOMER'], async ({ req, user }) => applyForLoan(user, await body(req, loanApplySchema)));
