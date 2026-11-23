import bcrypt from 'bcryptjs';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { accounts, loans, users } from '@/db/schema';
import type { AuthUser } from '@/lib/api';
import { ApiError, badRequest, conflict, forbidden, notFound, pgError } from '@/lib/errors';
import { num } from '@/lib/money';
import type { CustomerDetailDTO, CustomerDTO, Paginated } from '@/types';
import { accountDTO, accountNumberGen } from './mappers';
import { notify } from './notifications';
import { listTransactions } from './transactions';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((s) => s.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72)
    .regex(/[A-Z]/, 'Password needs an uppercase letter').regex(/[0-9]/, 'Password needs a number'),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(200).optional(),
  nationalId: z.string().trim().max(40).optional(),
  role: z.enum(['CUSTOMER', 'STAFF']).default('CUSTOMER'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits').optional(),
  accountType: z.enum(['SAVINGS', 'CURRENT', 'BUSINESS']).optional(),
});
export const customerFilterSchema = z.object({
  q: z.string().trim().max(60).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  role: z.enum(['CUSTOMER', 'STAFF']).default('CUSTOMER'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

const userDTO = (u: typeof users.$inferSelect): CustomerDTO => ({
  id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, phone: u.phone, address: u.address,
  nationalId: u.nationalId, verified: u.verified, createdAt: u.createdAt.toISOString(),
});

export async function registerUser(actor: AuthUser, input: z.infer<typeof registerSchema>) {
  if (input.role === 'STAFF' && actor.role !== 'ADMIN') throw forbidden('Only admins can create staff accounts');
  const hash = await bcrypt.hash(input.password, 10);
  const pinHash = input.pin ? await bcrypt.hash(input.pin, 10) : null;
  try {
    return await db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({
        name: input.name, email: input.email, passwordHash: hash, role: input.role, phone: input.phone || null, address: input.address || null,
        nationalId: input.nationalId || null, pinHash, createdById: actor.id, verified: input.role === 'STAFF',
      }).returning();
      let account = null;
      if (input.role === 'CUSTOMER' && input.accountType) {
        [account] = await tx.insert(accounts).values({ accountNumber: accountNumberGen(), type: input.accountType, ownerId: u.id }).returning();
      }
      await notify(tx, u.id, { title: 'Welcome to NexBank', body: 'Your profile has been created. Remember to set your transaction PIN in Profile & Security.', kind: 'welcome' });
      return { id: u.id, accountNumber: account?.accountNumber ?? null };
    });
  } catch (e) {
    if (pgError(e).constraint === 'users_email_idx') throw conflict('A user with this email already exists', 'EMAIL_TAKEN');
    throw e;
  }
}

export async function listCustomers(f: z.infer<typeof customerFilterSchema>, actor: AuthUser): Promise<Paginated<CustomerDTO>> {
  if (f.role === 'STAFF' && actor.role !== 'ADMIN') throw forbidden();
  const where = and(
    eq(users.role, f.role),
    f.status ? eq(users.status, f.status) : undefined,
    f.q ? or(ilike(users.name, `%${f.q}%`), ilike(users.email, `%${f.q}%`), ilike(users.phone, `%${f.q}%`),
      sql`exists (select 1 from ${accounts} a where a.owner_id = ${users.id} and a.account_number like ${'%' + f.q.replace(/[%_]/g, '') + '%'})`) : undefined,
  );
  const [{ c }] = await db.select({ c: count() }).from(users).where(where);
  const rows = await db.select({
    u: users,
    n: sql<number>`(select count(*)::int from accounts a where a.owner_id = ${users.id})`,
    b: sql<string>`(select coalesce(sum(a.balance),0) from accounts a where a.owner_id = ${users.id})`,
  }).from(users).where(where).orderBy(desc(users.createdAt)).limit(f.pageSize).offset((f.page - 1) * f.pageSize);
  return { total: c, page: f.page, pageSize: f.pageSize, items: rows.map((r) => ({ ...userDTO(r.u), accountCount: r.n, totalBalance: num(r.b) })) };
}

export async function getCustomer(actor: AuthUser, id: string): Promise<CustomerDetailDTO> {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) throw notFound('Customer not found');
  const accs = await db.select().from(accounts).where(eq(accounts.ownerId, id)).orderBy(accounts.createdAt);
  const recent = await listTransactions(actor, { customerId: id, page: 1, pageSize: 8 });
  const [{ c }] = await db.select({ c: count() }).from(loans).where(eq(loans.customerId, id));
  return { ...userDTO(u), accounts: accs.map((a) => accountDTO(a, u)), recentTransactions: recent.items, loanCount: c };
}

/** Admin: activate / deactivate / block. Non-active users are refused at login and on every API call. */
export async function setUserStatus(admin: AuthUser, id: string, status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED') {
  if (id === admin.id) throw badRequest('You cannot change your own status');
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) throw notFound('User not found');
  if (u.role === 'ADMIN') throw forbidden('Admin accounts cannot be modified here');
  await db.update(users).set({ status }).where(eq(users.id, id));
}

export async function verifyCustomer(actor: AuthUser, id: string) {
  const r = await db.update(users).set({ verified: true, verifiedById: actor.id, verifiedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.role, 'CUSTOMER'))).returning({ id: users.id });
  if (!r.length) throw notFound('Customer not found');
  await notify(db, id, { title: 'Identity verified', body: 'Your customer information has been verified by the bank.', kind: 'verified' });
}
