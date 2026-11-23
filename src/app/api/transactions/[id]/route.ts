import { route } from '@/lib/api';
import { getTransactionFor } from '@/lib/services/transactions';
export const GET = route<{ id: string }>('any', async ({ user, params }) => (await getTransactionFor(user, params.id)).dto);
