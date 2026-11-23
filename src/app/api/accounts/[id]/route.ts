import { body, route } from '@/lib/api';
import { getAccountFor, updateAccount, updateAccountSchema } from '@/lib/services/accounts';
export const GET = route<{ id: string }>('any', async ({ user, params }) => getAccountFor(user, params.id));
// Freeze/unfreeze, limits, type, nickname: admin only. Balance is never writable through the API.
export const PATCH = route<{ id: string }>(['ADMIN'], async ({ req, params }) => { await updateAccount(params.id, await body(req, updateAccountSchema)); return { ok: true }; });
