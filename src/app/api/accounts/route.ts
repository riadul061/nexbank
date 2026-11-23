import { body, query, route } from '@/lib/api';
import { accountFilterSchema, createAccount, createAccountSchema, listAccounts } from '@/lib/services/accounts';
export const GET = route('any', async ({ req, user }) => listAccounts(user, query(req, accountFilterSchema)));
export const POST = route(['ADMIN', 'STAFF'], async ({ req, user }) => createAccount(await body(req, createAccountSchema), user.role === 'ADMIN'));
