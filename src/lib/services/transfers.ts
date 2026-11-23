import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { accounts, transactions, users } from '@/db/schema';
import { amountSchema, type AuthUser } from '@/lib/api';
import { ApiError, badRequest, conflict, notFound, pgError } from '@/lib/errors';
import { fromCents, toCents } from '@/lib/money';
import { txReference } from './mappers';
import { notify } from './notifications';
import { verifyPin } from './pin';
import { getSettings } from './settings';
import { detectSuspicious } from './suspicious';

export const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountNumber: z.string().trim().regex(/^\d{10,16}$/, 'Enter a valid account number'),
  amount: amountSchema,
  description: z.string().trim().max(140).optional(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits'),
  idempotencyKey: z.string().min(8).max(100),
});
export type TransferInput = z.infer<typeof transferSchema>;

const fmt = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export async function findByKey(key: string, userId: string) {
  const [t] = await db.select().from(transactions).where(eq(transactions.idempotencyKey, key)).limit(1);
  if (t && t.initiatedById !== userId) throw conflict('Idempotency key already used', 'IDEMPOTENCY_CONFLICT');
  return t;
}

/**
 * Atomic customer transfer.
 *  1. duplicate-submit guard (idempotency key, unique-indexed)
 *  2. PIN check (persisted failures, lockout)
 *  3. ONE database transaction: lock both account rows (ordered, deadlock-free) → validate everything against the
 *     locked, authoritative rows → debit with a guarded UPDATE → credit → write the ledger entry → notify.
 *     Any thrown error rolls the whole thing back, so money can never leave only one account.
 *  The client never sends balances, fees or the sender's identity: those are derived server-side.
 */
export async function executeTransfer(user: AuthUser, input: TransferInput) {
  const existing = await findByKey(input.idempotencyKey, user.id);
  if (existing) return { id: existing.id, reference: existing.reference, duplicate: true };

  await verifyPin(user.id, input.pin);
  const settings = await getSettings();
  const amountC = toCents(input.amount);

  try {
    return await db.transaction(async (tx) => {
      const [fromOwned] = await tx.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.id, input.fromAccountId), eq(accounts.ownerId, user.id)));
      if (!fromOwned) throw notFound('Source account not found');
      const [toRef] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.accountNumber, input.toAccountNumber));
      if (!toRef) throw new ApiError(422, 'Recipient account not found', 'RECIPIENT_INVALID');
      if (toRef.id === fromOwned.id) throw badRequest('Cannot transfer to the same account');

      // Lock both rows in a stable order, then read authoritative state from the locked rows.
      const locked = await tx.select().from(accounts).where(inArray(accounts.id, [fromOwned.id, toRef.id])).orderBy(accounts.id).for('update');
      const from = locked.find((a) => a.id === fromOwned.id)!;
      const to = locked.find((a) => a.id === toRef.id)!;

      if (from.status !== 'ACTIVE') throw new ApiError(422, 'Your source account is frozen. Contact the bank.', 'ACCOUNT_FROZEN');
      if (to.status !== 'ACTIVE') throw new ApiError(422, 'The recipient account cannot receive funds right now', 'RECIPIENT_UNAVAILABLE');
      const [toOwner] = await tx.select({ status: users.status }).from(users).where(eq(users.id, to.ownerId));
      if (toOwner?.status !== 'ACTIVE') throw new ApiError(422, 'The recipient account cannot receive funds right now', 'RECIPIENT_UNAVAILABLE');

      const sameOwner = to.ownerId === from.ownerId;
      const feeC = sameOwner ? 0 : Math.round((amountC * settings.transferFeePercent) / 100);
      const totalC = amountC + feeC;
      const balanceC = toCents(from.balance);

      const singleCapC = Math.min(toCents(from.singleLimit), toCents(settings.maxSingleTransaction));
      if (amountC > singleCapC) throw new ApiError(422, `Amount exceeds the per-transaction limit of ${fmt(singleCapC)}`, 'LIMIT_SINGLE');

      const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
      const [{ s }] = await tx.select({ s: sql<string>`coalesce(sum(${transactions.amount}), 0)` }).from(transactions)
        .where(and(eq(transactions.senderAccountId, from.id), eq(transactions.type, 'TRANSFER'), inArray(transactions.status, ['COMPLETED', 'PENDING']), gte(transactions.createdAt, startOfDay)));
      const dailyCapC = Math.min(toCents(from.dailyLimit), toCents(settings.dailyTransferLimit));
      if (toCents(s) + amountC > dailyCapC) {
        throw new ApiError(422, `Daily transfer limit of ${fmt(dailyCapC)} would be exceeded (already sent ${fmt(toCents(s))} today)`, 'LIMIT_DAILY');
      }

      const minC = toCents(settings.minAccountBalance);
      if (balanceC < totalC) throw new ApiError(422, `Insufficient funds. Available ${fmt(balanceC)}, required ${fmt(totalC)}${feeC ? ` (incl. ${fmt(feeC)} fee)` : ''}`, 'INSUFFICIENT_FUNDS');
      if (balanceC - totalC < minC) throw new ApiError(422, `This transfer would take the account below the minimum balance of ${fmt(minC)}`, 'MIN_BALANCE');

      // Guarded debit: the WHERE clause re-checks the balance inside the UPDATE itself.
      const debited = await tx.update(accounts).set({ balance: sql`${accounts.balance} - ${fromCents(totalC)}::numeric` })
        .where(and(eq(accounts.id, from.id), sql`${accounts.balance} - ${fromCents(totalC)}::numeric >= ${fromCents(minC)}::numeric`)).returning({ id: accounts.id });
      if (!debited.length) throw new ApiError(409, 'Balance changed while processing. Please retry.', 'CONCURRENT_UPDATE');
      await tx.update(accounts).set({ balance: sql`${accounts.balance} + ${fromCents(amountC)}::numeric` }).where(eq(accounts.id, to.id));

      const reference = txReference();
      const now = new Date();
      const [rec] = await tx.insert(transactions).values({
        reference, type: 'TRANSFER', status: 'COMPLETED', amount: fromCents(amountC), fee: fromCents(feeC),
        description: input.description || null, senderAccountId: from.id, receiverAccountId: to.id,
        idempotencyKey: input.idempotencyKey, initiatedById: user.id, completedAt: now,
      }).returning();

      await detectSuspicious(tx, { transferId: rec.id, reference, fromId: from.id, toId: to.id, sameOwner, amount: amountC / 100, balanceBefore: balanceC / 100, singleCap: singleCapC / 100, settings });

      await notify(tx, from.ownerId, { title: 'Transfer completed', body: `You sent ${fmt(amountC)} to account ••••${to.accountNumber.slice(-4)}. Ref ${reference}.`, kind: 'transfer', link: `/transactions/${rec.id}` });
      if (!sameOwner) await notify(tx, to.ownerId, { title: 'Money received', body: `You received ${fmt(amountC)} in account ••••${to.accountNumber.slice(-4)}. Ref ${reference}.`, kind: 'received', link: `/transactions/${rec.id}` });

      return { id: rec.id, reference, duplicate: false };
    });
  } catch (e) {
    const pg = pgError(e);
    if (pg.code === '23505' && pg.constraint === 'tx_idem_idx') {
      const dup = await findByKey(input.idempotencyKey, user.id);
      if (dup) return { id: dup.id, reference: dup.reference, duplicate: true };
    }
    throw e;
  }
}
