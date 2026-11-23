import { and, count, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { accounts, fundRequests, loans, transactions, users } from '@/db/schema';
import type { AuthUser } from '@/lib/api';
import { forbidden } from '@/lib/errors';
import { num } from '@/lib/money';
import type { AdminDashboardDTO, ChartPoint, CustomerDashboardDTO } from '@/types';
import { accountDTO, raAlias, saAlias, soAlias, roAlias, txDTO, type TxJoinRow } from './mappers';

const MONTHS = 6;
function monthKeys() {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) });
  }
  return out;
}
const startDate = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - (MONTHS - 1), 1)); };
const monthOf = (col: Parameters<typeof sql>[0] | unknown) => sql<string>`to_char(${col as never} at time zone 'UTC', 'YYYY-MM')`;
const TYPE_LABEL: Record<string, string> = { DEPOSIT: 'Deposits', WITHDRAWAL: 'Withdrawals', TRANSFER: 'Transfers', LOAN_DISBURSEMENT: 'Loan payouts', LOAN_REPAYMENT: 'Loan repayments' };

export async function adminDashboard(user: AuthUser): Promise<AdminDashboardDTO> {
  if (user.role === 'CUSTOMER') throw forbidden();
  const keys = monthKeys(); const since = startDate();
  const completed = eq(transactions.status, 'COMPLETED');

  const [[cust], [acc], [dep], [wd], [txc], [pl], [pr], [fl], [ptx]] = await Promise.all([
    db.select({ c: count() }).from(users).where(eq(users.role, 'CUSTOMER')),
    db.select({ c: count(), b: sql<string>`coalesce(sum(${accounts.balance}),0)` }).from(accounts),
    db.select({ s: sql<string>`coalesce(sum(${transactions.amount}),0)` }).from(transactions).where(and(completed, eq(transactions.type, 'DEPOSIT'))),
    db.select({ s: sql<string>`coalesce(sum(${transactions.amount}),0)` }).from(transactions).where(and(completed, eq(transactions.type, 'WITHDRAWAL'))),
    db.select({ c: count() }).from(transactions),
    db.select({ c: count() }).from(loans).where(inArray(loans.status, ['PENDING', 'UNDER_REVIEW'])),
    db.select({ c: count() }).from(fundRequests).where(eq(fundRequests.status, 'PENDING')),
    db.select({ c: count() }).from(transactions).where(eq(transactions.flagged, true)),
    db.select({ c: count() }).from(transactions).where(eq(transactions.status, 'PENDING')),
  ]);

  const mTx = monthOf(transactions.createdAt);
  const txRows = await db.select({ m: mTx, type: transactions.type, c: count(), s: sql<string>`coalesce(sum(${transactions.amount}),0)` })
    .from(transactions).where(and(completed, sql`${transactions.createdAt} >= ${since.toISOString()}`)).groupBy(mTx, transactions.type);
  const mUsr = monthOf(users.createdAt);
  const userRows = await db.select({ m: mUsr, c: count() }).from(users).where(and(eq(users.role, 'CUSTOMER'), sql`${users.createdAt} >= ${since.toISOString()}`)).groupBy(mUsr);
  const mLoan = monthOf(loans.createdAt);
  const loanRows = await db.select({ m: mLoan, c: count() }).from(loans).where(sql`${loans.createdAt} >= ${since.toISOString()}`).groupBy(mLoan);

  const pick = (m: string, type?: string, f: 'c' | 's' = 's') => txRows.filter((r) => r.m === m && (!type || r.type === type)).reduce((s, r) => s + num(r[f]), 0);
  const monthlyVolume: ChartPoint[] = keys.map((k) => ({ label: k.label, Volume: pick(k.key), Transactions: pick(k.key, undefined, 'c') }));
  const depositVsWithdrawal: ChartPoint[] = keys.map((k) => ({ label: k.label, Deposits: pick(k.key, 'DEPOSIT'), Withdrawals: pick(k.key, 'WITHDRAWAL') }));
  const monthlyActivity: ChartPoint[] = keys.map((k) => ({
    label: k.label, Transactions: pick(k.key, undefined, 'c'),
    'New customers': userRows.find((r) => r.m === k.key)?.c ?? 0, 'Loan applications': loanRows.find((r) => r.m === k.key)?.c ?? 0,
  }));
  const dist = await db.select({ t: accounts.type, c: count(), b: sql<string>`coalesce(sum(${accounts.balance}),0)` }).from(accounts).groupBy(accounts.type);
  const accountDistribution: ChartPoint[] = dist.map((d) => ({ label: d.t[0] + d.t.slice(1).toLowerCase(), value: d.c, balance: num(d.b) }));
  const ls = await db.select({ s: loans.status, c: count() }).from(loans).groupBy(loans.status);
  const g = (...s: string[]) => ls.filter((x) => s.includes(x.s)).reduce((a, x) => a + x.c, 0);
  const loanStats: ChartPoint[] = [
    { label: 'Pending', value: g('PENDING', 'UNDER_REVIEW') }, { label: 'Approved', value: g('APPROVED', 'ACTIVE', 'COMPLETED') }, { label: 'Rejected', value: g('REJECTED') },
  ];
  return {
    role: user.role as 'ADMIN' | 'STAFF',
    totals: { customers: cust.c, accounts: acc.c, balance: num(acc.b), deposits: num(dep.s), withdrawals: num(wd.s), transactions: txc.c, pendingLoans: pl.c, pendingRequests: pr.c, flagged: fl.c, pendingTx: ptx.c },
    monthlyVolume, depositVsWithdrawal, accountDistribution, loanStats, monthlyActivity,
  };
}

export async function customerDashboard(user: AuthUser, accountId?: string): Promise<CustomerDashboardDTO> {
  const mine = await db.select().from(accounts).where(eq(accounts.ownerId, user.id)).orderBy(accounts.createdAt);
  const mineIds = mine.map((a) => a.id);
  const scopeIds = accountId && mineIds.includes(accountId) ? [accountId] : mineIds;
  const keys = monthKeys(); const since = startDate();
  const empty = !scopeIds.length;
  const scoped = mine.filter((a) => scopeIds.includes(a.id));
  const completed = eq(transactions.status, 'COMPLETED');

  let deposits = 0, withdrawals = 0;
  let spendRows: { m: string; s: string }[] = [], depRows: { m: string; s: string }[] = [], distRows: { t: string; c: number; s: string }[] = [];
  let recent: TxJoinRow[] = [];
  if (!empty) {
    const [d] = await db.select({ s: sql<string>`coalesce(sum(${transactions.amount}),0)` }).from(transactions).where(and(completed, eq(transactions.type, 'DEPOSIT'), inArray(transactions.receiverAccountId, scopeIds)));
    const [w] = await db.select({ s: sql<string>`coalesce(sum(${transactions.amount}),0)` }).from(transactions).where(and(completed, eq(transactions.type, 'WITHDRAWAL'), inArray(transactions.senderAccountId, scopeIds)));
    deposits = num(d.s); withdrawals = num(w.s);
    const m = monthOf(transactions.createdAt);
    spendRows = await db.select({ m, s: sql<string>`coalesce(sum(${transactions.amount} + ${transactions.fee}),0)` }).from(transactions)
      .where(and(completed, inArray(transactions.senderAccountId, scopeIds), sql`${transactions.createdAt} >= ${since.toISOString()}`, sql`(${transactions.receiverAccountId} is null or ${transactions.receiverAccountId} not in (${sql.join(scopeIds.map((i) => sql`${i}`), sql`, `)}))`)).groupBy(m);
    depRows = await db.select({ m, s: sql<string>`coalesce(sum(${transactions.amount}),0)` }).from(transactions)
      .where(and(completed, eq(transactions.type, 'DEPOSIT'), inArray(transactions.receiverAccountId, scopeIds), sql`${transactions.createdAt} >= ${since.toISOString()}`)).groupBy(m);
    distRows = await db.select({ t: transactions.type, c: count(), s: sql<string>`coalesce(sum(${transactions.amount}),0)` }).from(transactions)
      .where(and(completed, or(inArray(transactions.senderAccountId, scopeIds), inArray(transactions.receiverAccountId, scopeIds)))).groupBy(transactions.type);
    recent = (await db.select({ tx: transactions, sa: saAlias, so: { name: soAlias.name }, ra: raAlias, ro: { name: roAlias.name } }).from(transactions)
      .leftJoin(saAlias, eq(transactions.senderAccountId, saAlias.id)).leftJoin(soAlias, eq(saAlias.ownerId, soAlias.id))
      .leftJoin(raAlias, eq(transactions.receiverAccountId, raAlias.id)).leftJoin(roAlias, eq(raAlias.ownerId, roAlias.id))
      .where(or(inArray(transactions.senderAccountId, scopeIds), inArray(transactions.receiverAccountId, scopeIds)))
      .orderBy(desc(transactions.createdAt)).limit(6)) as unknown as TxJoinRow[];
  }
  const activeLoans = await db.select({ l: loans, a: accounts.accountNumber }).from(loans).innerJoin(accounts, eq(loans.accountId, accounts.id))
    .where(and(eq(loans.customerId, user.id), eq(loans.status, 'ACTIVE')));
  const [me] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, user.id));
  const scope = new Set(scopeIds);
  return {
    totals: {
      balance: scoped.reduce((s, a) => s + num(a.balance), 0), deposits, withdrawals,
      activeLoans: activeLoans.length, loanRemaining: activeLoans.reduce((s, x) => s + num(x.l.remainingBalance), 0),
    },
    accounts: mine.map((a) => accountDTO(a, me)),
    recent: recent.map((r) => txDTO(r, scope)),
    monthlySpending: keys.map((k) => ({ label: k.label, Spending: num(spendRows.find((r) => r.m === k.key)?.s) })),
    monthlyDeposits: keys.map((k) => ({ label: k.label, Deposits: num(depRows.find((r) => r.m === k.key)?.s) })),
    distribution: distRows.map((d) => ({ label: TYPE_LABEL[d.t] ?? d.t, value: d.c, amount: num(d.s) })),
    activeLoans: activeLoans.map(({ l, a }) => ({
      id: l.id, reference: l.reference, loanType: l.loanType, amount: num(l.amount), durationMonths: l.durationMonths, interestRate: num(l.interestRate),
      monthlyIncome: num(l.monthlyIncome), employmentStatus: l.employmentStatus, description: l.description, status: l.status,
      monthlyPayment: num(l.monthlyPayment), totalPayable: num(l.totalPayable), remainingBalance: num(l.remainingBalance), createdAt: l.createdAt.toISOString(),
      decidedAt: l.decidedAt?.toISOString() ?? null, decisionNote: l.decisionNote, forwardedAt: l.forwardedAt?.toISOString() ?? null,
      customer: { id: user.id, name: me.name, email: me.email }, account: { id: l.accountId, accountNumber: a },
    })),
  };
}
