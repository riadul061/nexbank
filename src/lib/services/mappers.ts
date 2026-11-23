import { alias } from 'drizzle-orm/pg-core';
import { accounts, users } from '@/db/schema';
import type { AccountDTO, TransactionDTO } from '@/types';
import { num } from '@/lib/money';

export const saAlias = alias(accounts, 'sa');
export const raAlias = alias(accounts, 'ra');
export const soAlias = alias(users, 'so');
export const roAlias = alias(users, 'ro');

type AccRow = typeof accounts.$inferSelect;
export const accountDTO = (a: AccRow, owner?: { name: string; email: string } | null): AccountDTO => ({
  id: a.id, accountNumber: a.accountNumber, type: a.type, status: a.status, balance: num(a.balance),
  dailyLimit: num(a.dailyLimit), singleLimit: num(a.singleLimit), nickname: a.nickname,
  createdAt: a.createdAt.toISOString(), ownerId: a.ownerId, ownerName: owner?.name, ownerEmail: owner?.email,
});

export const accountNumberGen = () => '40' + Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
export const txReference = () => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const r = Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  return `TXN-${d}-${r}`;
};

export interface TxJoinRow {
  tx: typeof import('@/db/schema').transactions.$inferSelect;
  sa: AccRow | null; so: { name: string } | null; ra: AccRow | null; ro: { name: string } | null;
}
export function txDTO(r: TxJoinRow, scope?: Set<string>): TransactionDTO {
  const t = r.tx;
  let direction: TransactionDTO['direction'];
  if (scope) {
    const out = !!t.senderAccountId && scope.has(t.senderAccountId);
    const inn = !!t.receiverAccountId && scope.has(t.receiverAccountId);
    direction = out && inn ? 'SELF' : out ? 'OUT' : 'IN';
  }
  return {
    id: t.id, reference: t.reference, type: t.type, status: t.status, amount: num(t.amount), fee: num(t.fee),
    description: t.description, createdAt: t.createdAt.toISOString(), completedAt: t.completedAt?.toISOString() ?? null,
    sender: r.sa ? { id: r.sa.id, accountNumber: r.sa.accountNumber, ownerName: r.so?.name ?? '' } : null,
    receiver: r.ra ? { id: r.ra.id, accountNumber: r.ra.accountNumber, ownerName: r.ro?.name ?? '' } : null,
    flagged: t.flagged, flagReason: t.flagReason, flagSource: t.flagSource, direction,
  };
}
