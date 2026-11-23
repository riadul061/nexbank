import { and, count, eq, gte, inArray } from 'drizzle-orm';
import type { Tx } from '@/db';
import { transactions } from '@/db/schema';
import type { BankSettings } from '@/types';
import { notifyAdmins } from './notifications';

/**
 * Simple rule-based detector. Runs inside the transfer's DB transaction so the flag is committed
 * atomically with the transfer. Flagged transfers still complete (the bank is not blocking customers
 * on heuristics) but land in the admin review queue.
 */
export async function detectSuspicious(
  tx: Tx,
  p: { transferId: string; reference: string; fromId: string; toId: string; sameOwner: boolean; amount: number; balanceBefore: number; singleCap: number; settings: BankSettings },
) {
  const reasons: string[] = [];
  if (p.amount >= p.settings.suspiciousAmount) reasons.push(`Large transfer (≥ ${p.settings.suspiciousAmount.toLocaleString()})`);
  if (p.amount >= 1000 && p.balanceBefore > 0 && p.amount / p.balanceBefore >= 0.9) reasons.push('Moves ≥ 90% of the account balance');
  if (p.amount >= p.singleCap * 0.95) reasons.push('Amount sits just under the per-transaction limit');

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [{ c: recent }] = await tx.select({ c: count() }).from(transactions)
    .where(and(eq(transactions.senderAccountId, p.fromId), eq(transactions.type, 'TRANSFER'), gte(transactions.createdAt, hourAgo), inArray(transactions.status, ['COMPLETED', 'PENDING'])));
  if (recent >= 5) reasons.push(`High velocity: ${recent} transfers in the last hour`);

  if (!p.sameOwner && p.amount >= 2000) {
    const [{ c: prior }] = await tx.select({ c: count() }).from(transactions)
      .where(and(eq(transactions.senderAccountId, p.fromId), eq(transactions.receiverAccountId, p.toId), eq(transactions.status, 'COMPLETED')));
    if (prior === 0) reasons.push('Large first-time transfer to a new recipient');
  }

  if (reasons.length) {
    const reason = reasons.join('; ');
    await tx.update(transactions).set({ flagged: true, flagReason: reason, flagSource: 'AUTO', flaggedAt: new Date() }).where(eq(transactions.id, p.transferId));
    await notifyAdmins(tx, { title: 'Transaction auto-flagged', body: `${p.reference}: ${reason}`, kind: 'flag', link: `/transactions/${p.transferId}` });
  }
  return reasons;
}
