/* Integration tests for the money-moving services. Run after `npm run db:seed`:  npm run test:transfers */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { accounts, transactions, users } from '../src/db/schema';
import { executeTransfer } from '../src/lib/services/transfers';
import { createRequest, reviewRequest } from '../src/lib/services/requests';
import { saveSettings } from '../src/lib/services/settings';
import { randomUUID } from 'node:crypto';

const bal = async (num: string) => Number((await db.select().from(accounts).where(eq(accounts.accountNumber, num)))[0].balance);
const total = async () => Number((await db.execute(sql`select coalesce(sum(balance),0)::float8 s from accounts`)).rows[0].s);
const rej = async (p: Promise<unknown>, code: string) => { try { await p; } catch (e) { assert.equal((e as { code?: string }).code, code, `expected ${code}, got ${(e as Error).message}`); return; } assert.fail(`expected ${code}`); };

async function main() {
  const [alex] = await db.select().from(users).where(eq(users.email, 'customer@nexbank.demo'));
  const [staff] = await db.select().from(users).where(eq(users.email, 'staff@nexbank.demo'));
  const A = { id: alex.id, name: alex.name, email: alex.email, role: 'CUSTOMER' as const };
  const S = { id: staff.id, name: staff.name, email: staff.email, role: 'STAFF' as const };
  const [sav] = await db.select().from(accounts).where(eq(accounts.accountNumber, '4000000000001'));
  const [cur] = await db.select().from(accounts).where(eq(accounts.accountNumber, '4000000000002'));
  await saveSettings({ dailyTransferLimit: 1_000_000, maxSingleTransaction: 1_000_000, minAccountBalance: 0, transferFeePercent: 0.25, suspiciousAmount: 5000 });
  await db.update(accounts).set({ dailyLimit: '1000000', singleLimit: '1000000' });
  const base = { fromAccountId: sav.id, pin: '1234', idempotencyKey: '' };
  const t = (o: object) => ({ ...base, idempotencyKey: randomUUID(), ...o }) as Parameters<typeof executeTransfer>[1];

  console.log('1. happy path: both sides move, fee applies to other customers');
  let b0 = await bal('4000000000001'), r0 = await bal('4000000000011'), tot0 = await total();
  await executeTransfer(A, t({ toAccountNumber: '4000000000011', amount: 100 }));
  assert.equal(+(await bal('4000000000001')).toFixed(2), +(b0 - 100.25).toFixed(2));
  assert.equal(+(await bal('4000000000011')).toFixed(2), +(r0 + 100).toFixed(2));
  assert.equal(+(tot0 - (await total())).toFixed(2), 0.25); // only the fee leaves the system

  console.log('2. own-account transfer has no fee');
  b0 = await bal('4000000000001'); const c0 = await bal('4000000000002');
  await executeTransfer(A, t({ toAccountNumber: '4000000000002', amount: 50 }));
  assert.equal(+(await bal('4000000000001')).toFixed(2), +(b0 - 50).toFixed(2));
  assert.equal(+(await bal('4000000000002')).toFixed(2), +(c0 + 50).toFixed(2));

  console.log('3. insufficient funds rolls back everything');
  b0 = await bal('4000000000001'); r0 = await bal('4000000000011'); const n0 = (await db.select().from(transactions)).length;
  await rej(executeTransfer(A, t({ toAccountNumber: '4000000000011', amount: 500_000 })), 'INSUFFICIENT_FUNDS');
  assert.equal(await bal('4000000000001'), b0); assert.equal(await bal('4000000000011'), r0);
  assert.equal((await db.select().from(transactions)).length, n0);

  console.log('4. invalid recipient / same account / source not owned');
  await rej(executeTransfer(A, t({ toAccountNumber: '9999999999999', amount: 5 })), 'RECIPIENT_INVALID');
  await assert.rejects(executeTransfer(A, t({ toAccountNumber: '4000000000001', amount: 5 })));
  await assert.rejects(executeTransfer(A, t({ fromAccountId: (await db.select().from(accounts).where(eq(accounts.accountNumber, '4000000000011')))[0].id, toAccountNumber: '4000000000001', amount: 5 })));

  console.log('5. idempotency: same key twice → one transfer');
  const key = randomUUID(); b0 = await bal('4000000000001');
  const x = await executeTransfer(A, t({ idempotencyKey: key, toAccountNumber: '4000000000011', amount: 10 }));
  const y = await executeTransfer(A, t({ idempotencyKey: key, toAccountNumber: '4000000000011', amount: 10 }));
  assert.equal(x.id, y.id); assert.equal(y.duplicate, true);
  assert.equal(+(await bal('4000000000001')).toFixed(2), +(b0 - 10.03).toFixed(2));

  console.log('6. 12 concurrent identical-key requests → exactly one debit');
  b0 = await bal('4000000000001');
  const k2 = randomUUID();
  const res = await Promise.allSettled(Array.from({ length: 12 }, () => executeTransfer(A, t({ idempotencyKey: k2, toAccountNumber: '4000000000011', amount: 20 }))));
  assert.equal(new Set(res.filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<{ id: string }>).value.id)).size, 1);
  assert.equal(+(await bal('4000000000001')).toFixed(2), +(b0 - 20.05).toFixed(2));

  console.log('7. concurrency: 10 parallel transfers of ~40% of balance → never overdraws, money conserved');
  await db.update(accounts).set({ balance: '1000.00' }).where(eq(accounts.accountNumber, '4000000000001'));
  tot0 = await total(); r0 = await bal('4000000000011');
  const par = await Promise.allSettled(Array.from({ length: 10 }, () => executeTransfer(A, t({ toAccountNumber: '4000000000011', amount: 400 }))));
  const ok = par.filter((p) => p.status === 'fulfilled').length;
  assert.equal(ok, 2, `expected 2 successes, got ${ok}`);
  assert.ok((await bal('4000000000001')) >= 0);
  assert.equal(+(await bal('4000000000011')).toFixed(2), +(r0 + 800).toFixed(2));
  assert.equal(+(tot0 - (await total())).toFixed(2), +(ok * 1).toFixed(2)); // 2 × $1.00 fee

  console.log('8. frozen account blocks transfers');
  await db.update(accounts).set({ status: 'FROZEN' }).where(eq(accounts.id, sav.id));
  await rej(executeTransfer(A, t({ toAccountNumber: '4000000000011', amount: 5 })), 'ACCOUNT_FROZEN');
  await db.update(accounts).set({ status: 'ACTIVE' }).where(eq(accounts.id, sav.id));

  console.log('9. limits: single, daily, minimum balance');
  await saveSettings({ maxSingleTransaction: 50 });
  await rej(executeTransfer(A, t({ toAccountNumber: '4000000000011', amount: 60 })), 'LIMIT_SINGLE');
  await saveSettings({ maxSingleTransaction: 1_000_000, minAccountBalance: 1_000_000 });
  await rej(executeTransfer(A, t({ toAccountNumber: '4000000000011', amount: 5 })), 'MIN_BALANCE');
  await saveSettings({ minAccountBalance: 0 });
  await db.update(accounts).set({ balance: '500.00' }).where(eq(accounts.id, cur.id));
  await saveSettings({ minAccountBalance: 450 });
  await rej(executeTransfer(A, t({ fromAccountId: cur.id, toAccountNumber: '4000000000011', amount: 100 })), 'MIN_BALANCE');
  await saveSettings({ minAccountBalance: 0, dailyTransferLimit: 1 });
  await rej(executeTransfer(A, t({ toAccountNumber: '4000000000011', amount: 100 })), 'LIMIT_DAILY');
  await saveSettings({ dailyTransferLimit: 1_000_000 });

  console.log('10. wrong PIN is rejected and locks after 3 attempts; correct PIN afterwards is refused while locked');
  await rej(executeTransfer(A, t({ toAccountNumber: '4000000000011', amount: 5, pin: '0000' })), 'PIN_INVALID');
  await rej(executeTransfer(A, t({ toAccountNumber: '4000000000011', amount: 5, pin: '0000' })), 'PIN_INVALID');
  await rej(executeTransfer(A, t({ toAccountNumber: '4000000000011', amount: 5, pin: '0000' })), 'PIN_INVALID');
  await rej(executeTransfer(A, t({ toAccountNumber: '4000000000011', amount: 5 })), 'PIN_LOCKED');
  await db.update(users).set({ pinAttempts: 0, pinLockedUntil: null }).where(eq(users.id, alex.id));

  console.log('11. large transfer is auto-flagged');
  await db.update(accounts).set({ balance: '20000.00' }).where(eq(accounts.id, sav.id));
  const big = await executeTransfer(A, t({ toAccountNumber: '4000000000011', amount: 6000 }));
  const [bt] = await db.select().from(transactions).where(eq(transactions.id, big.id));
  assert.equal(bt.flagged, true); assert.equal(bt.flagSource, 'AUTO');

  console.log('12. deposit/withdrawal workflow: requester cannot approve own; staff approves once; balance changes once');
  const dep = await createRequest(A, { accountId: cur.id, type: 'DEPOSIT', amount: 250, idempotencyKey: randomUUID() });
  const [rq] = await db.execute(sql`select id from fund_requests where transaction_id = (select id from transactions where reference = ${dep.reference})`).then((r) => r.rows as { id: string }[]);
  await assert.rejects(reviewRequest({ ...A, role: 'STAFF' }, rq.id, 'APPROVE')); // own request
  b0 = await bal('4000000000002');
  await Promise.allSettled([reviewRequest(S, rq.id, 'APPROVE'), reviewRequest(S, rq.id, 'APPROVE'), reviewRequest(S, rq.id, 'REJECT', 'x')]);
  assert.equal(+(await bal('4000000000002')).toFixed(2), +(b0 + 250).toFixed(2));
  await rej(reviewRequest(S, rq.id, 'APPROVE'), 'ALREADY_REVIEWED');

  console.log('13. DB constraint: balance can never go negative even via raw SQL');
  await assert.rejects(db.execute(sql`update accounts set balance = -1 where id = ${sav.id}`));

  console.log('\n✅ All transfer & ledger integrity tests passed');
  await pool.end();
}
main().catch(async (e) => { console.error('\n❌', e); await pool.end(); process.exit(1); });
