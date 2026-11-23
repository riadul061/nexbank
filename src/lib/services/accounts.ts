import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { accounts, users } from '@/db/schema';
import type { AuthUser } from '@/lib/api';
import { badRequest, notFound, pgError } from '@/lib/errors';
import type { AccountDTO, Paginated } from '@/types';
import { accountDTO, accountNumberGen } from './mappers';

export const createAccountSchema = z.object({
  ownerId: z.string().min(1), type: z.enum(['SAVINGS', 'CURRENT', 'BUSINESS']), nickname: z.string().trim().max(40).optional(),
  dailyLimit: z.coerce.number().positive().max(10_000_000).optional(), singleLimit: z.coerce.number().positive().max(10_000_000).optional(),
});
export const updateAccountSchema = z.object({
  status: z.enum(['ACTIVE', 'FROZEN']).optional(), type: z.enum(['SAVINGS', 'CURRENT', 'BUSINESS']).optional(),
  nickname: z.string().trim().max(40).nullable().optional(),
  dailyLimit: z.coerce.number().positive().max(10_000_000).optional(), singleLimit: z.coerce.number().positive().max(10_000_000).optional(),
});
export const accountFilterSchema = z.object({
  q: z.string().trim().max(60).optional(), status: z.enum(['ACTIVE', 'FROZEN']).optional(), type: z.enum(['SAVINGS', 'CURRENT', 'BUSINESS']).optional(),
  ownerId: z.string().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export async function listAccounts(user: AuthUser, f: z.infer<typeof accountFilterSchema>): Promise<Paginated<AccountDTO>> {
  const where = and(
    user.role === 'CUSTOMER' ? eq(accounts.ownerId, user.id) : f.ownerId ? eq(accounts.ownerId, f.ownerId) : undefined,
    f.status ? eq(accounts.status, f.status) : undefined,
    f.type ? eq(accounts.type, f.type) : undefined,
    f.q ? or(ilike(accounts.accountNumber, `%${f.q}%`), ilike(users.name, `%${f.q}%`), ilike(users.email, `%${f.q}%`)) : undefined,
  );
  const [{ c }] = await db.select({ c: count() }).from(accounts).innerJoin(users, eq(accounts.ownerId, users.id)).where(where);
  const rows = await db.select({ a: accounts, u: users }).from(accounts).innerJoin(users, eq(accounts.ownerId, users.id)).where(where)
    .orderBy(desc(accounts.createdAt)).limit(f.pageSize).offset((f.page - 1) * f.pageSize);
  return { total: c, page: f.page, pageSize: f.pageSize, items: rows.map((r) => accountDTO(r.a, r.u)) };
}

export async function getAccountFor(user: AuthUser, id: string): Promise<AccountDTO> {
  const [r] = await db.select({ a: accounts, u: users }).from(accounts).innerJoin(users, eq(accounts.ownerId, users.id)).where(eq(accounts.id, id));
  if (!r || (user.role === 'CUSTOMER' && r.a.ownerId !== user.id)) throw notFound('Account not found');
  return accountDTO(r.a, r.u);
}

export async function createAccount(input: z.infer<typeof createAccountSchema>, canSetLimits: boolean) {
  const [owner] = await db.select().from(users).where(eq(users.id, input.ownerId));
  if (!owner || owner.role !== 'CUSTOMER') throw badRequest('Accounts can only be opened for customers');
  for (let i = 0; i < 5; i++) {
    try {
      const [a] = await db.insert(accounts).values({
        accountNumber: accountNumberGen(), type: input.type, ownerId: input.ownerId, nickname: input.nickname || null,
        ...(canSetLimits && input.dailyLimit ? { dailyLimit: String(input.dailyLimit) } : {}),
        ...(canSetLimits && input.singleLimit ? { singleLimit: String(input.singleLimit) } : {}),
      }).returning();
      return accountDTO(a, owner);
    } catch (e) { if (pgError(e).constraint !== 'accounts_number_idx') throw e; }
  }
  throw badRequest('Could not allocate an account number, try again');
}

/** Admin only. Note: balance is deliberately NOT updatable here, or anywhere outside the transaction services. */
export async function updateAccount(id: string, patch: z.infer<typeof updateAccountSchema>) {
  const set: Partial<typeof accounts.$inferInsert> = {};
  if (patch.status) set.status = patch.status;
  if (patch.type) set.type = patch.type;
  if (patch.nickname !== undefined) set.nickname = patch.nickname;
  if (patch.dailyLimit) set.dailyLimit = String(patch.dailyLimit);
  if (patch.singleLimit) set.singleLimit = String(patch.singleLimit);
  if (!Object.keys(set).length) throw badRequest('Nothing to update');
  const [a] = await db.update(accounts).set(set).where(eq(accounts.id, id)).returning();
  if (!a) throw notFound('Account not found');
  return a;
}

export async function lookupRecipient(user: AuthUser, number: string) {
  const [r] = await db.select({ a: accounts, u: users }).from(accounts).innerJoin(users, eq(accounts.ownerId, users.id)).where(eq(accounts.accountNumber, number));
  if (!r) throw notFound('No account found with that number');
  const [first, ...rest] = r.u.name.split(' ');
  return {
    accountNumber: r.a.accountNumber, type: r.a.type, available: r.a.status === 'ACTIVE' && r.u.status === 'ACTIVE',
    holder: rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first, own: r.a.ownerId === user.id, accountId: r.a.id,
  };
}
