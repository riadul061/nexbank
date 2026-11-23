import { and, count, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { accounts, transactions } from '@/db/schema';
import type { AuthUser } from '@/lib/api';
import { ApiError, badRequest, forbidden, notFound } from '@/lib/errors';
import { fromCents, toCents } from '@/lib/money';
import type { Paginated, TransactionDTO } from '@/types';
import { raAlias, roAlias, saAlias, soAlias, txDTO, type TxJoinRow } from './mappers';
import { notify, notifyAdmins } from './notifications';

export const txFilterSchema = z.object({
  q: z.string().trim().max(60).optional(),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REVERSED']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  accountId: z.string().optional(),
  customerId: z.string().optional(),
  flagged: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type TxFilters = z.infer<typeof txFilterSchema>;

const baseSelect = () =>
  db.select({ tx: transactions, sa: saAlias, so: { name: soAlias.name }, ra: raAlias, ro: { name: roAlias.name } })
    .from(transactions)
    .leftJoin(saAlias, eq(transactions.senderAccountId, saAlias.id))
    .leftJoin(soAlias, eq(saAlias.ownerId, soAlias.id))
    .leftJoin(raAlias, eq(transactions.receiverAccountId, raAlias.id))
    .leftJoin(roAlias, eq(raAlias.ownerId, roAlias.id));

export async function myAccountIds(userId: string): Promise<string[]> {
  const rows = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.ownerId, userId));
  return rows.map((r) => r.id);
}

export async function listTransactions(user: AuthUser, f: TxFilters): Promise<Paginated<TransactionDTO>> {
  const conds: (SQL | undefined)[] = [];
  let scope: Set<string> | undefined;

  if (user.role === 'CUSTOMER') {
    // Customers are hard-scoped to their own accounts at the query level.
    const mine = await myAccountIds(user.id);
    if (f.accountId) {
      if (!mine.includes(f.accountId)) throw forbidden('That account does not belong to you');
      scope = new Set([f.accountId]);
    } else scope = new Set(mine);
    conds.push(or(eq(saAlias.ownerId, user.id), eq(raAlias.ownerId, user.id)));
    if (f.accountId) conds.push(or(eq(transactions.senderAccountId, f.accountId), eq(transactions.receiverAccountId, f.accountId)));
  } else {
    if (f.accountId) conds.push(or(eq(transactions.senderAccountId, f.accountId), eq(transactions.receiverAccountId, f.accountId)));
    if (f.customerId) conds.push(or(eq(saAlias.ownerId, f.customerId), eq(raAlias.ownerId, f.customerId)));
  }
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, '')}%`;
    conds.push(or(ilike(transactions.reference, like), ilike(transactions.id, like), ilike(transactions.description, like)));
  }
  if (f.type) conds.push(eq(transactions.type, f.type));
  if (f.status) conds.push(eq(transactions.status, f.status));
  if (f.from) conds.push(gte(transactions.createdAt, new Date(`${f.from}T00:00:00.000Z`)));
  if (f.to) conds.push(lt(transactions.createdAt, new Date(new Date(`${f.to}T00:00:00.000Z`).getTime() + 86_400_000)));
  if (f.flagged && user.role !== 'CUSTOMER') conds.push(eq(transactions.flagged, f.flagged === 'true'));
  const where = and(...conds);

  const [{ c }] = await db.select({ c: count() }).from(transactions)
    .leftJoin(saAlias, eq(transactions.senderAccountId, saAlias.id))
    .leftJoin(raAlias, eq(transactions.receiverAccountId, raAlias.id)).where(where);
  const rows = await baseSelect().where(where).orderBy(desc(transactions.createdAt), desc(transactions.id)).limit(f.pageSize).offset((f.page - 1) * f.pageSize);
  return { items: rows.map((r) => txDTO(r as unknown as TxJoinRow, scope)), total: c, page: f.page, pageSize: f.pageSize };
}

export async function fetchTxRow(id: string): Promise<TxJoinRow | undefined> {
  const [row] = await baseSelect().where(or(eq(transactions.id, id), eq(transactions.reference, id))).limit(1);
  return row as unknown as TxJoinRow | undefined;
}

/** Loads a transaction and enforces that customers can only see transactions touching their own accounts. */
export async function getTransactionFor(user: AuthUser, id: string): Promise<{ dto: TransactionDTO; row: TxJoinRow }> {
  const row = await fetchTxRow(id);
  if (!row) throw notFound('Transaction not found');
  let scope: Set<string> | undefined;
  if (user.role === 'CUSTOMER') {
    const owns = row.sa?.ownerId === user.id || row.ra?.ownerId === user.id;
    if (!owns) throw notFound('Transaction not found'); // 404, not 403: do not reveal existence
    scope = new Set(await myAccountIds(user.id));
  }
  return { dto: txDTO(row, scope), row };
}

export async function flagTransaction(user: AuthUser, id: string, reason: string) {
  const { row } = await getTransactionFor(user, id);
  await db.update(transactions).set({ flagged: true, flagReason: reason, flagSource: 'STAFF', flaggedById: user.id, flaggedAt: new Date() }).where(eq(transactions.id, row.tx.id));
  await notifyAdmins(db, { title: 'Transaction flagged for review', body: `${user.name} flagged ${row.tx.reference}: ${reason}`, kind: 'flag', link: `/transactions/${row.tx.id}` });
}

export async function clearFlag(id: string) {
  const r = await db.update(transactions).set({ flagged: false, flagReason: null, flagSource: null, flaggedAt: null, flaggedById: null }).where(eq(transactions.id, id)).returning({ id: transactions.id });
  if (!r.length) throw notFound('Transaction not found');
}

/** Admin-only reversal of a completed transfer. Atomic: both balances move or neither does. */
export async function reverseTransfer(admin: AuthUser, id: string, reason: string) {
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(transactions).where(eq(transactions.id, id)).for('update');
    if (!t) throw notFound('Transaction not found');
    if (t.type !== 'TRANSFER' || t.status !== 'COMPLETED') throw badRequest('Only completed transfers can be reversed');
    if (!t.senderAccountId || !t.receiverAccountId) throw badRequest('Malformed transfer');
    await tx.select().from(accounts).where(inArray(accounts.id, [t.senderAccountId, t.receiverAccountId])).orderBy(accounts.id).for('update');
    const debit = await tx.update(accounts).set({ balance: sql`${accounts.balance} - ${t.amount}::numeric` })
      .where(and(eq(accounts.id, t.receiverAccountId), sql`${accounts.balance} - ${t.amount}::numeric >= 0`)).returning({ ownerId: accounts.ownerId });
    if (!debit.length) throw new ApiError(409, 'Recipient no longer has enough funds to reverse this transfer', 'REVERSAL_INSUFFICIENT');
    const refund = fromCents(toCents(t.amount) + toCents(t.fee));
    const [sender] = await tx.update(accounts).set({ balance: sql`${accounts.balance} + ${refund}::numeric` }).where(eq(accounts.id, t.senderAccountId)).returning({ ownerId: accounts.ownerId });
    await tx.update(transactions).set({ status: 'REVERSED', description: `${t.description ?? ''}${t.description ? ' · ' : ''}Reversed by admin: ${reason}` }).where(eq(transactions.id, t.id));
    await notify(tx, sender.ownerId, { title: 'Transfer reversed', body: `${t.reference} was reversed and ${refund} returned to your account.`, kind: 'reversal', link: `/transactions/${t.id}` });
    if (debit[0].ownerId !== sender.ownerId) await notify(tx, debit[0].ownerId, { title: 'Transfer reversed', body: `${t.reference} was reversed by the bank.`, kind: 'reversal', link: `/transactions/${t.id}` });
  });
}
