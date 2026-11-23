import { z } from 'zod';
import { query, route } from '@/lib/api';
import { lookupRecipient } from '@/lib/services/accounts';
export const GET = route(['CUSTOMER'], async ({ req, user }) => lookupRecipient(user, query(req, z.object({ number: z.string().regex(/^\d{10,16}$/) })).number));
