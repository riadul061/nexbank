import { route } from '@/lib/api';
import { getLoan } from '@/lib/services/loans';
export const GET = route<{ id: string }>('any', async ({ user, params }) => getLoan(user, params.id));
