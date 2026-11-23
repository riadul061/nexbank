import { and, count, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { accounts, fundRequests, transactions, users } from '@/db/schema';
import { amountSchema, type AuthUser } from '@/lib/api';
import { ApiError, badRequest, conflict, forbidden, notFound, pgError } from '@/lib/errors';
import { fromCents, num, toCents } from '@/lib/money';
import type { FundRequestDTO, Paginated } from '@/types';
import { txReference } from './mappers';
import { notify } from './notifications';
import { getSettings } from './settings';

export const requestSchema = z.object({
  accountId: z.string().min(1),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL']),
  amount: amountSchema,
  description: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().min(8).max(100),
});
export const reviewSchema = z.object({ decision: z.enum(['APPROVE', 'REJECT']), note: z.string().trim().max(300).optional() });
export const requestFilterSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

const usd = (n: number | string) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export async function createRequest(user: AuthUser, input: z.infer<typeof requestSchema>) {
  try {
    return await db.transaction(async (tx) => {
      const [acc] = await tx.select().from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.ownerId, user.id)));
      if (!acc) throw notFound('Account not found');
      if (acc.status !== 'ACTIVE') throw new ApiError(422, 'This account is frozen', 'ACCOUNT_FROZEN');
      const settings = await getSettings(tx);
      const cap = Math.min(num(acc.singleLimit), settings.maxSingleTransaction);
      if (input.amount > cap) throw new ApiError(422, `Amount exceeds the per-transaction limit of ${usd(cap)}`, 'LIMIT_SINGLE');
      if (input.type === 'WITHDRAWAL' && toCents(acc.balance) - toCents(input.amount) < toCents(settings.minAccountBalance)) {
        throw new ApiError(422, 'Insufficient available balance for this withdrawal', 'INSUFFICIENT_FUNDS');
      }
      const [t] = await tx.insert(transactions).values({
        reference: txReference(), type: input.type, status: 'PENDING', amount: fromCents(toCents(input.amount)), description: input.description || null,
        senderAccountId: input.type === 'WITHDRAWAL' ? acc.id : null, receiverAccountId: input.type === 'DEPOSIT' ? acc.id : null,
        idempotencyKey: input.idempotencyKey, initiatedById: user.id,
      }).returning();
      const [r] = await tx.insert(fundRequests).values({
        type: input.type, accountId: acc.id, amount: fromCents(toCents(input.amount)), description: input.description || null,
        requestedById: user.id, transactionId: t.id,
      }).returning();
      return { id: r.id, reference: t.reference };
    });
  } catch (e) {
    if (pgError(e).constraint === 'tx_idem_idx') throw conflict('This request was already submitted', 'DUPLICATE');
    throw e;
  }
}

export async function listRequests(user: AuthUser, f: z.infer<typeof requestFilterSchema>): Promise<Paginated<FundRequestDTO>> {
  const where = and(
    user.role === 'CUSTOMER' ? eq(fundRequests.requestedById, user.id) : undefined,
    f.status ? eq(fundRequests.status, f.status) : undefined,
    f.type ? eq(fundRequests.type, f.type) : undefined,
  );
  const [{ c }] = await db.select({ c: count() }).from(fundRequests).where(where);
  const rows = await db.select({ r: fundRequests, acc: accounts, u: users, ref: transactions.reference })
    .from(fundRequests).innerJoin(accounts, eq(fundRequests.accountId, accounts.id)).innerJoin(users, eq(fundRequests.requestedById, users.id))
    .leftJoin(transactions, eq(fundRequests.transactionId, transactions.id))
    .where(where).orderBy(desc(fundRequests.createdAt)).limit(f.pageSize).offset((f.page - 1) * f.pageSize);
  return {
    total: c, page: f.page, pageSize: f.pageSize,
    items: rows.map(({ r, acc, u, ref }) => ({
      id: r.id, type: r.type, status: r.status, amount: num(r.amount), description: r.description, createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null, reviewNote: r.reviewNote,
      account: { id: acc.id, accountNumber: acc.accountNumber, type: acc.type }, requestedBy: { id: u.id, name: u.name }, transactionRef: ref,
    })),
  };
}

export async function reviewRequest(reviewer: AuthUser, id: string, decision: 'APPROVE' | 'REJECT', note?: string) {
  await db.transaction(async (tx) => {
    const [req] = await tx.select().from(fundRequests).where(eq(fundRequests.id, id)).for('update');
    if (!req) throw notFound('Request not found');
    if (req.status !== 'PENDING') throw conflict('This request has already been reviewed', 'ALREADY_REVIEWED');
    if (req.requestedById === reviewer.id) throw forbidden('You cannot review your own request');
    if (decision === 'REJECT' && !note) throw badRequest('Please provide a reason for rejecting');

    const finish = async (status: 'APPROVED' | 'REJECTED') => {
      await tx.update(fundRequests).set({ status, reviewedById: reviewer.id, reviewedAt: new Date(), reviewNote: note || null }).where(eq(fundRequests.id, id));
      if (req.transactionId) await tx.update(transactions).set({ status: status === 'APPROVED' ? 'COMPLETED' : 'FAILED', completedAt: status === 'APPROVED' ? new Date() : null }).where(eq(transactions.id, req.transactionId));
    };
    const label = req.type === 'DEPOSIT' ? 'deposit' : 'withdrawal';

    if (decision === 'REJECT') {
      await finish('REJECTED');
      await notify(tx, req.requestedById, { title: `${label[0].toUpperCase() + label.slice(1)} rejected`, body: `Your ${label} request of ${usd(req.amount)} was rejected. Reason: ${note}`, kind: 'request_rejected', link: '/requests' });
      return;
    }

    const [acc] = await tx.select().from(accounts).where(eq(accounts.id, req.accountId)).for('update');
    if (acc.status !== 'ACTIVE') throw new ApiError(409, 'Account is frozen; unfreeze it or reject the request', 'ACCOUNT_FROZEN');
    if (req.type === 'DEPOSIT') {
      await tx.update(accounts).set({ balance: sql`${accounts.balance} + ${req.amount}::numeric` }).where(eq(accounts.id, acc.id));
    } else {
      const min = (await getSettings(tx)).minAccountBalance;
      const r = await tx.update(accounts).set({ balance: sql`${accounts.balance} - ${req.amount}::numeric` })
        .where(and(eq(accounts.id, acc.id), sql`${accounts.balance} - ${req.amount}::numeric >= ${fromCents(toCents(min))}::numeric`)).returning({ id: accounts.id });
      if (!r.length) throw new ApiError(409, 'Customer no longer has sufficient balance. Reject this request instead.', 'INSUFFICIENT_FUNDS');
    }
    await finish('APPROVED');
    await notify(tx, req.requestedById, { title: `${label[0].toUpperCase() + label.slice(1)} approved`, body: `Your ${label} of ${usd(req.amount)} on ••••${acc.accountNumber.slice(-4)} was approved.`, kind: 'request_approved', link: '/requests' });
  });
}
