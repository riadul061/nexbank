import { query, route } from '@/lib/api';
import { listTransactions, txFilterSchema } from '@/lib/services/transactions';
export const GET = route('any', async ({ req, user }) => listTransactions(user, query(req, txFilterSchema)));
