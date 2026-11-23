import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { accounts, fundRequests, installments, loanNotes, loans, notifications, settings, transactions, users } from '../src/db/schema';
import { buildSchedule, LOAN_RATES } from '../src/lib/services/loans';
import { txReference } from '../src/lib/services/mappers';
import { DEFAULT_SETTINGS } from '../src/lib/services/settings';

let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));
const c2s = (c: number) => (c / 100).toFixed(2);
const monthsAgo = (m: number, day: number) => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - m, day, between(8, 18), between(0, 59))); };

async function main() {
  console.log('Resetting tables…');
  await db.execute(sql`truncate table notifications, loan_notes, installments, loans, fund_requests, transactions, accounts, users, settings restart identity cascade`);
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) await db.insert(settings).values({ key, value: String(value) });

  const hash = async (p: string) => bcrypt.hash(p, 10);
  const pw = { admin: await hash('Admin@12345'), staff: await hash('Staff@12345'), cust: await hash('Customer@12345') };
  const pin = await hash('1234');

  const mk = async (v: typeof users.$inferInsert) => (await db.insert(users).values(v).returning())[0];
  const admin = await mk({ name: 'Priya Nair', email: 'admin@nexbank.demo', passwordHash: pw.admin, role: 'ADMIN', verified: true });
  const staff = await mk({ name: 'Marcus Webb', email: 'staff@nexbank.demo', passwordHash: pw.staff, role: 'STAFF', verified: true, createdById: admin.id });
  await mk({ name: 'Elena Petrova', email: 'staff2@nexbank.demo', passwordHash: pw.staff, role: 'STAFF', verified: true, createdById: admin.id });
  const alex = await mk({ name: 'Alex Morgan', email: 'customer@nexbank.demo', passwordHash: pw.cust, phone: '+1 415 555 0142', address: '88 Harbor St, San Francisco, CA', nationalId: 'SSN-***-**-4412', verified: true, pinHash: pin, createdById: staff.id });
  const sara = await mk({ name: 'Sara Khan', email: 'sara@nexbank.demo', passwordHash: pw.cust, phone: '+1 212 555 0198', address: '14 Elm Ave, New York, NY', verified: true, pinHash: pin, createdById: staff.id });
  const daniel = await mk({ name: 'Daniel Okafor', email: 'daniel@nexbank.demo', passwordHash: pw.cust, phone: '+1 312 555 0117', address: '2 Lake Shore Dr, Chicago, IL', verified: true, pinHash: pin, createdById: staff.id });
  const mei = await mk({ name: 'Mei Lin', email: 'mei@nexbank.demo', passwordHash: pw.cust, phone: '+1 206 555 0163', verified: false, pinHash: pin, createdById: staff.id });
  const rafael = await mk({ name: 'Rafael Costa', email: 'rafael@nexbank.demo', passwordHash: pw.cust, phone: '+1 305 555 0129', verified: true, pinHash: pin, status: 'INACTIVE', createdById: staff.id });

  const mkAcc = async (owner: typeof alex, type: 'SAVINGS' | 'CURRENT' | 'BUSINESS', num: string, extra: Partial<typeof accounts.$inferInsert> = {}) =>
    (await db.insert(accounts).values({ ownerId: owner.id, type, accountNumber: num, ...extra }).returning())[0];
  const aSav = await mkAcc(alex, 'SAVINGS', '4000000000001', { nickname: 'Rainy day' });
  const aCur = await mkAcc(alex, 'CURRENT', '4000000000002', { nickname: 'Everyday' });
  const sSav = await mkAcc(sara, 'SAVINGS', '4000000000011');
  const dBus = await mkAcc(daniel, 'BUSINESS', '4000000000021', { dailyLimit: '50000', singleLimit: '20000', nickname: 'Okafor Logistics' });
  const mCur = await mkAcc(mei, 'CURRENT', '4000000000031');
  const rSav = await mkAcc(rafael, 'SAVINGS', '4000000000041');
  const all = [aSav, aCur, sSav, dBus, mCur, rSav];
  const bal = new Map(all.map((a) => [a.id, 0]));

  type Ev = { date: Date; kind: 'DEP' | 'WD' | 'TRF' | 'LOAN_OUT' | 'LOAN_REPAY'; from?: string; to?: string; amountC: number; desc: string; flagged?: string; loanId?: string; inst?: number };
  const ev: Ev[] = [];
  const memo = { DEP: ['Salary', 'Client payment', 'Cash deposit', 'Freelance income'], WD: ['ATM withdrawal', 'Rent', 'Groceries', 'Utilities'], TRF: ['Dinner split', 'Gift', 'Shared rent', 'Reimbursement', 'Birthday'] };
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  for (const a of all) {
    const big = a.type === 'BUSINESS';
    ev.push({ date: monthsAgo(6, 3), kind: 'DEP', to: a.id, amountC: (big ? 40000 : 6000) * 100, desc: 'Opening deposit' });
    for (let m = 5; m >= 0; m--) {
      ev.push({ date: monthsAgo(m, between(1, 5)), kind: 'DEP', to: a.id, amountC: between(big ? 6000 : 1800, big ? 15000 : 4200) * 100, desc: pick(memo.DEP) });
      for (let k = 0; k < between(2, 3); k++) ev.push({ date: monthsAgo(m, between(6, 26)), kind: 'WD', from: a.id, amountC: between(big ? 800 : 80, big ? 3500 : 900) * 100, desc: pick(memo.WD) });
      const other = pick(all.filter((x) => x.ownerId !== a.ownerId && x.id !== rSav.id));
      ev.push({ date: monthsAgo(m, between(8, 24)), kind: 'TRF', from: a.id, to: other.id, amountC: between(50, big ? 1500 : 600) * 100, desc: pick(memo.TRF) });
    }
  }
  ev.push({ date: monthsAgo(0, 1), kind: 'TRF', from: dBus.id, to: aCur.id, amountC: 5200_00, desc: 'Contract milestone payment', flagged: 'Large transfer (≥ 5,000); Large first-time transfer to a new recipient' });
  ev.push({ date: monthsAgo(1, 9), kind: 'TRF', from: aSav.id, to: aCur.id, amountC: 400_00, desc: 'Move to everyday' });

  // Active loan for Alex (disbursed ~3.5 months ago, 3 instalments paid)
  const disb = monthsAgo(3, 2); disb.setUTCDate(Math.min(disb.getUTCDate(), 2));
  const sched = buildSchedule(5000, LOAN_RATES.PERSONAL, 12, disb);
  const [loanA] = await db.insert(loans).values({
    reference: 'LN-DEMO0001', customerId: alex.id, accountId: aCur.id, loanType: 'PERSONAL', amount: '5000.00', durationMonths: 12, interestRate: String(LOAN_RATES.PERSONAL),
    monthlyIncome: '4200', employmentStatus: 'EMPLOYED', description: 'Home office upgrade', status: 'ACTIVE', monthlyPayment: c2s(sched.monthlyC), totalPayable: c2s(sched.totalC),
    remainingBalance: c2s(sched.totalC - sched.monthlyC * 3), forwardedById: staff.id, forwardedAt: disb, decidedById: admin.id, decidedAt: disb, createdAt: new Date(disb.getTime() - 3 * 86400000),
  }).returning();
  ev.push({ date: disb, kind: 'LOAN_OUT', to: aCur.id, amountC: 500000, desc: 'Disbursement of loan LN-DEMO0001', loanId: loanA.id });
  for (let i = 1; i <= 3; i++) ev.push({ date: sched.items[i - 1].dueDate, kind: 'LOAN_REPAY', from: aCur.id, amountC: sched.monthlyC, desc: `Loan LN-DEMO0001 · instalment ${i}/12`, loanId: loanA.id, inst: i });

  ev.sort((a, b) => a.date.getTime() - b.date.getTime());
  const now = new Date();
  const instTx = new Map<number, string>();
  let count = 0;
  for (const e of ev) {
    if (e.date > now) continue;
    const feeC = e.kind === 'TRF' && all.find((x) => x.id === e.from)!.ownerId !== all.find((x) => x.id === e.to)!.ownerId ? Math.round(e.amountC * 0.0025) : 0;
    const debitC = e.amountC + feeC;
    if (e.from && (bal.get(e.from) ?? 0) < debitC) continue;
    if (e.from) bal.set(e.from, bal.get(e.from)! - debitC);
    if (e.to) bal.set(e.to, bal.get(e.to)! + e.amountC);
    const type = e.kind === 'DEP' ? 'DEPOSIT' : e.kind === 'WD' ? 'WITHDRAWAL' : e.kind === 'TRF' ? 'TRANSFER' : e.kind === 'LOAN_OUT' ? 'LOAN_DISBURSEMENT' : 'LOAN_REPAYMENT';
    const [t] = await db.insert(transactions).values({
      reference: txReference(), type, status: 'COMPLETED', amount: c2s(e.amountC), fee: c2s(feeC), description: e.desc, senderAccountId: e.from ?? null, receiverAccountId: e.to ?? null,
      createdAt: e.date, completedAt: e.date, loanId: e.loanId ?? null, flagged: !!e.flagged, flagReason: e.flagged ?? null, flagSource: e.flagged ? 'AUTO' : null, flaggedAt: e.flagged ? e.date : null,
      initiatedById: (all.find((x) => x.id === (e.from ?? e.to))!.ownerId),
    }).returning();
    if (e.inst) instTx.set(e.inst, t.id);
    if (e.kind === 'LOAN_OUT') await db.update(loans).set({ disbursementTxId: t.id }).where(sql`id = ${e.loanId}`);
    if (e.kind === 'DEP' || e.kind === 'WD') {
      const acc = all.find((x) => x.id === (e.to ?? e.from))!;
      await db.insert(fundRequests).values({ type: e.kind === 'DEP' ? 'DEPOSIT' : 'WITHDRAWAL', accountId: acc.id, amount: c2s(e.amountC), description: e.desc, status: 'APPROVED', requestedById: acc.ownerId, reviewedById: staff.id, reviewedAt: e.date, transactionId: t.id, createdAt: e.date });
    }
    count++;
  }
  for (const [id, c] of bal) await db.update(accounts).set({ balance: c2s(c) }).where(sql`id = ${id}`);

  await db.insert(installments).values(sched.items.map((i) => ({
    loanId: loanA.id, number: i.number, dueDate: i.dueDate, amount: c2s(i.amountC), status: (i.number <= 3 ? 'PAID' : 'DUE') as 'PAID' | 'DUE',
    paidAt: i.number <= 3 ? i.dueDate : null, transactionId: instTx.get(i.number) ?? null,
  })));

  // Pending work for staff/admin to action
  const pend = async (type: 'DEPOSIT' | 'WITHDRAWAL', acc: typeof aSav, owner: typeof alex, amt: number, desc: string) => {
    const [t] = await db.insert(transactions).values({ reference: txReference(), type, status: 'PENDING', amount: c2s(amt * 100), description: desc, senderAccountId: type === 'WITHDRAWAL' ? acc.id : null, receiverAccountId: type === 'DEPOSIT' ? acc.id : null, initiatedById: owner.id }).returning();
    await db.insert(fundRequests).values({ type, accountId: acc.id, amount: c2s(amt * 100), description: desc, requestedById: owner.id, transactionId: t.id });
  };
  await pend('DEPOSIT', aSav, alex, 1200, 'Cheque deposit');
  await pend('WITHDRAWAL', aCur, alex, 300, 'Cash for trip');
  await pend('WITHDRAWAL', sSav, sara, 450, 'Furniture');
  await pend('DEPOSIT', dBus, daniel, 8000, 'Client invoice #1042');

  const loanBase = { reference: '', interestRate: '', monthlyIncome: '' };
  void loanBase;
  const [lp] = await db.insert(loans).values({ reference: 'LN-DEMO0002', customerId: sara.id, accountId: sSav.id, loanType: 'EDUCATION', amount: '12000.00', durationMonths: 36, interestRate: String(LOAN_RATES.EDUCATION), monthlyIncome: '3100', employmentStatus: 'STUDENT', description: 'Master’s program tuition' }).returning();
  const [lu] = await db.insert(loans).values({ reference: 'LN-DEMO0003', customerId: daniel.id, accountId: dBus.id, loanType: 'BUSINESS', amount: '60000.00', durationMonths: 48, interestRate: String(LOAN_RATES.BUSINESS), monthlyIncome: '14000', employmentStatus: 'BUSINESS_OWNER', description: 'Two delivery vans', status: 'UNDER_REVIEW', forwardedById: staff.id, forwardedAt: new Date() }).returning();
  await db.insert(loanNotes).values({ loanId: lu.id, authorId: staff.id, authorName: staff.name, body: 'Verified business registration and 12 months of statements. Cash flow healthy. Recommend approval.' });
  await db.insert(loans).values({ reference: 'LN-DEMO0004', customerId: mei.id, accountId: mCur.id, loanType: 'AUTO', amount: '25000.00', durationMonths: 60, interestRate: String(LOAN_RATES.AUTO), monthlyIncome: '1900', employmentStatus: 'UNEMPLOYED', description: 'Car purchase', status: 'REJECTED', decidedById: admin.id, decidedAt: monthsAgo(1, 12), decisionNote: 'Income insufficient for requested amount.', createdAt: monthsAgo(1, 8) });
  void lp;

  await db.insert(notifications).values([
    { userId: alex.id, title: 'Loan approved 🎉', body: 'LN-DEMO0001 was approved. $5,000 has been credited to ••••0002.', kind: 'loan_approved', link: `/loans/${loanA.id}`, read: true, createdAt: disb },
    { userId: alex.id, title: 'Money received', body: 'You received $5,200.00 in account ••••0002.', kind: 'received', link: '/transactions' },
    { userId: alex.id, title: 'Withdrawal rejected', body: 'Your withdrawal request of $9,000.00 was rejected. Reason: exceeds limit.', kind: 'request_rejected', link: '/requests' },
    { userId: admin.id, title: 'Transaction auto-flagged', body: 'A $5,200 transfer from Okafor Logistics was flagged for review.', kind: 'flag', link: '/transactions?flagged=true' },
  ]);
  console.log(`Seeded ${count} historical transactions. Done.`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
