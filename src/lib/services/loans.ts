import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { accounts, installments, loanNotes, loans, transactions, users } from '@/db/schema';
import { amountSchema, type AuthUser } from '@/lib/api';
import { ApiError, badRequest, conflict, forbidden, notFound, pgError } from '@/lib/errors';
import { fromCents, num, toCents } from '@/lib/money';
import type { InstallmentDTO, LoanDetailDTO, LoanDTO, Paginated, TransactionDTO } from '@/types';
import { fetchTxRow } from './transactions';
import { txDTO, txReference } from './mappers';
import { notify, notifyAdmins } from './notifications';
import { getSettings } from './settings';
import { verifyPin } from './pin';

export const LOAN_RATES: Record<string, number> = { PERSONAL: 12, HOME: 8, EDUCATION: 6, AUTO: 9, BUSINESS: 10.5 };

export const loanApplySchema = z.object({
  accountId: z.string().min(1),
  loanType: z.enum(['PERSONAL', 'HOME', 'EDUCATION', 'AUTO', 'BUSINESS']),
  amount: amountSchema.refine((n) => n >= 500 && n <= 500_000, 'Amount must be between $500 and $500,000'),
  durationMonths: z.coerce.number().int().min(3).max(360),
  monthlyIncome: z.coerce.number().positive('Monthly income is required').max(10_000_000),
  employmentStatus: z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'STUDENT', 'RETIRED', 'UNEMPLOYED']),
  description: z.string().trim().max(500).optional(),
});
export const loanFilterSchema = z.object({
  status: z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED']).optional(),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export const loanDecisionSchema = z.object({ decision: z.enum(['APPROVE', 'REJECT']), note: z.string().trim().max(400).optional() });
export const loanRepaySchema = z.object({
  accountId: z.string().min(1), installmentNumber: z.coerce.number().int().min(1),
  pin: z.string().regex(/^\d{4,6}$/), idempotencyKey: z.string().min(8).max(100),
});

/** Equal monthly instalment (EMI) amortisation, computed in integer cents. */
export function buildSchedule(principal: number, annualRate: number, months: number, start = new Date()) {
  const r = annualRate / 1200;
  const emi = r === 0 ? principal / months : (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  const monthlyC = Math.round(emi * 100);
  const items = Array.from({ length: months }, (_, i) => {
    const d = new Date(start); d.setUTCMonth(d.getUTCMonth() + i + 1);
    return { number: i + 1, dueDate: d, amountC: monthlyC };
  });
  return { monthlyC, totalC: monthlyC * months, items };
}

type LoanRow = typeof loans.$inferSelect;
const loanDTO = (l: LoanRow, c: { id: string; name: string; email: string }, accNo: string): LoanDTO => ({
  id: l.id, reference: l.reference, loanType: l.loanType, amount: num(l.amount), durationMonths: l.durationMonths, interestRate: num(l.interestRate),
  monthlyIncome: num(l.monthlyIncome), employmentStatus: l.employmentStatus, description: l.description, status: l.status,
  monthlyPayment: l.monthlyPayment ? num(l.monthlyPayment) : null, totalPayable: l.totalPayable ? num(l.totalPayable) : null,
  remainingBalance: l.remainingBalance ? num(l.remainingBalance) : null, createdAt: l.createdAt.toISOString(),
  decidedAt: l.decidedAt?.toISOString() ?? null, decisionNote: l.decisionNote, forwardedAt: l.forwardedAt?.toISOString() ?? null,
  customer: c, account: { id: l.accountId, accountNumber: accNo },
});

export async function applyForLoan(user: AuthUser, input: z.infer<typeof loanApplySchema>) {
  const [acc] = await db.select().from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.ownerId, user.id)));
  if (!acc) throw notFound('Account not found');
  if (acc.status !== 'ACTIVE') throw new ApiError(422, 'Selected account is frozen', 'ACCOUNT_FROZEN');
  const [{ c }] = await db.select({ c: count() }).from(loans).where(and(eq(loans.customerId, user.id), inArray(loans.status, ['PENDING', 'UNDER_REVIEW'])));
  if (c > 0) throw conflict('You already have a loan application in progress. Wait for a decision before applying again.', 'LOAN_IN_PROGRESS');
  const reference = `LN-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;
  const [l] = await db.insert(loans).values({
    reference, customerId: user.id, accountId: acc.id, loanType: input.loanType, amount: fromCents(toCents(input.amount)), durationMonths: input.durationMonths,
    interestRate: String(LOAN_RATES[input.loanType]), monthlyIncome: String(input.monthlyIncome), employmentStatus: input.employmentStatus, description: input.description || null,
  }).returning();
  await notifyAdmins(db, { title: 'New loan application', body: `${user.name} applied for ${input.loanType.toLowerCase()} loan ${reference}.`, kind: 'loan_new', link: `/loans/${l.id}` });
  return { id: l.id, reference };
}

export async function listLoans(user: AuthUser, f: z.infer<typeof loanFilterSchema>): Promise<Paginated<LoanDTO>> {
  const where = and(
    user.role === 'CUSTOMER' ? eq(loans.customerId, user.id) : undefined,
    f.status ? eq(loans.status, f.status) : undefined,
    f.q ? or(ilike(loans.reference, `%${f.q}%`), ilike(users.name, `%${f.q}%`)) : undefined,
  );
  const [{ c }] = await db.select({ c: count() }).from(loans).innerJoin(users, eq(loans.customerId, users.id)).where(where);
  const rows = await db.select({ l: loans, u: users, a: accounts.accountNumber }).from(loans)
    .innerJoin(users, eq(loans.customerId, users.id)).innerJoin(accounts, eq(loans.accountId, accounts.id))
    .where(where).orderBy(desc(loans.createdAt)).limit(f.pageSize).offset((f.page - 1) * f.pageSize);
  return { total: c, page: f.page, pageSize: f.pageSize, items: rows.map((r) => loanDTO(r.l, { id: r.u.id, name: r.u.name, email: r.u.email }, r.a)) };
}

export async function getLoan(user: AuthUser, id: string): Promise<LoanDetailDTO> {
  const [r] = await db.select({ l: loans, u: users, a: accounts.accountNumber }).from(loans)
    .innerJoin(users, eq(loans.customerId, users.id)).innerJoin(accounts, eq(loans.accountId, accounts.id)).where(eq(loans.id, id));
  if (!r || (user.role === 'CUSTOMER' && r.l.customerId !== user.id)) throw notFound('Loan not found');
  const inst = await db.select().from(installments).where(eq(installments.loanId, id)).orderBy(asc(installments.number));
  const isStaff = user.role !== 'CUSTOMER';
  const notes = isStaff ? await db.select().from(loanNotes).where(eq(loanNotes.loanId, id)).orderBy(desc(loanNotes.createdAt)) : [];
  const repRows = await db.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.loanId, id), eq(transactions.type, 'LOAN_REPAYMENT'))).orderBy(desc(transactions.createdAt));
  const repayments: TransactionDTO[] = [];
  for (const x of repRows) { const row = await fetchTxRow(x.id); if (row) repayments.push(txDTO(row)); }
  let customerSummary: LoanDetailDTO['customerSummary'];
  if (isStaff) {
    const accs = await db.select({ b: accounts.balance }).from(accounts).where(eq(accounts.ownerId, r.u.id));
    customerSummary = { verified: r.u.verified, status: r.u.status, accounts: accs.length, totalBalance: accs.reduce((s, a) => s + num(a.b), 0) };
  }
  return {
    ...loanDTO(r.l, { id: r.u.id, name: r.u.name, email: r.u.email }, r.a),
    installments: inst.map<InstallmentDTO>((i) => ({ id: i.id, number: i.number, dueDate: i.dueDate.toISOString(), amount: num(i.amount), status: i.status, paidAt: i.paidAt?.toISOString() ?? null })),
    notes: notes.map((n) => ({ id: n.id, authorName: n.authorName, body: n.body, createdAt: n.createdAt.toISOString() })),
    repayments, customerSummary,
  };
}

export async function addLoanNote(user: AuthUser, id: string, body: string) {
  const [l] = await db.select({ id: loans.id }).from(loans).where(eq(loans.id, id));
  if (!l) throw notFound('Loan not found');
  await db.insert(loanNotes).values({ loanId: id, authorId: user.id, authorName: user.name, body });
}

/** Staff action: move an application to admin review. Staff can never approve/reject. */
export async function forwardLoan(user: AuthUser, id: string, note?: string) {
  await db.transaction(async (tx) => {
    const [l] = await tx.select().from(loans).where(eq(loans.id, id)).for('update');
    if (!l) throw notFound('Loan not found');
    if (l.status !== 'PENDING') throw conflict('Only pending applications can be forwarded');
    await tx.update(loans).set({ status: 'UNDER_REVIEW', forwardedById: user.id, forwardedAt: new Date() }).where(eq(loans.id, id));
    if (note) await tx.insert(loanNotes).values({ loanId: id, authorId: user.id, authorName: user.name, body: note });
    await notifyAdmins(tx, { title: 'Loan forwarded for approval', body: `${user.name} forwarded ${l.reference} for your decision.`, kind: 'loan_forwarded', link: `/loans/${id}` });
    await notify(tx, l.customerId, { title: 'Loan under review', body: `Your application ${l.reference} is now under review.`, kind: 'loan_review', link: `/loans/${id}` });
  });
}

/** Admin-only decision. Approval disburses the funds through a recorded LOAN_DISBURSEMENT transaction, atomically. */
export async function decideLoan(admin: AuthUser, id: string, decision: 'APPROVE' | 'REJECT', note?: string) {
  await db.transaction(async (tx) => {
    const [l] = await tx.select().from(loans).where(eq(loans.id, id)).for('update');
    if (!l) throw notFound('Loan not found');
    if (l.customerId === admin.id) throw forbidden('You cannot decide on your own loan application');
    if (!['PENDING', 'UNDER_REVIEW'].includes(l.status)) throw conflict('This application has already been decided');
    const now = new Date();

    if (decision === 'REJECT') {
      if (!note) throw badRequest('Please provide a reason for rejection');
      await tx.update(loans).set({ status: 'REJECTED', decidedById: admin.id, decidedAt: now, decisionNote: note }).where(eq(loans.id, id));
      await notify(tx, l.customerId, { title: 'Loan rejected', body: `Your application ${l.reference} was not approved. Reason: ${note}`, kind: 'loan_rejected', link: `/loans/${id}` });
      return;
    }

    const [acc] = await tx.select().from(accounts).where(eq(accounts.id, l.accountId)).for('update');
    if (acc.status !== 'ACTIVE') throw new ApiError(409, 'Disbursement account is frozen', 'ACCOUNT_FROZEN');
    const sched = buildSchedule(num(l.amount), num(l.interestRate), l.durationMonths, now);
    const [t] = await tx.insert(transactions).values({
      reference: txReference(), type: 'LOAN_DISBURSEMENT', status: 'COMPLETED', amount: l.amount, description: `Disbursement of loan ${l.reference}`,
      receiverAccountId: acc.id, initiatedById: admin.id, loanId: l.id, completedAt: now,
    }).returning();
    await tx.update(accounts).set({ balance: sql`${accounts.balance} + ${l.amount}::numeric` }).where(eq(accounts.id, acc.id));
    await tx.insert(installments).values(sched.items.map((i) => ({ loanId: id, number: i.number, dueDate: i.dueDate, amount: fromCents(i.amountC) })));
    await tx.update(loans).set({
      status: 'ACTIVE', decidedById: admin.id, decidedAt: now, decisionNote: note || null, monthlyPayment: fromCents(sched.monthlyC),
      totalPayable: fromCents(sched.totalC), remainingBalance: fromCents(sched.totalC), disbursementTxId: t.id,
    }).where(eq(loans.id, id));
    await notify(tx, l.customerId, { title: 'Loan approved 🎉', body: `${l.reference} was approved. $${num(l.amount).toLocaleString()} has been credited to ••••${acc.accountNumber.slice(-4)}.`, kind: 'loan_approved', link: `/loans/${id}` });
  });
}

export async function repayInstallment(user: AuthUser, loanId: string, input: z.infer<typeof loanRepaySchema>) {
  const [dup] = await db.select({ id: transactions.id, ref: transactions.reference, by: transactions.initiatedById }).from(transactions).where(eq(transactions.idempotencyKey, input.idempotencyKey));
  if (dup) { if (dup.by !== user.id) throw conflict('Idempotency key already used'); return { id: dup.id, reference: dup.ref, duplicate: true }; }
  await verifyPin(user.id, input.pin);
  const settings = await getSettings();
  try {
    return await db.transaction(async (tx) => {
      const [l] = await tx.select().from(loans).where(and(eq(loans.id, loanId), eq(loans.customerId, user.id))).for('update');
      if (!l) throw notFound('Loan not found');
      if (l.status !== 'ACTIVE') throw conflict('This loan is not active');
      const due = await tx.select().from(installments).where(and(eq(installments.loanId, loanId), eq(installments.status, 'DUE'))).orderBy(asc(installments.number)).for('update');
      const next = due[0];
      if (!next || next.number !== input.installmentNumber) throw conflict('That instalment is not the next one due (it may already be paid)', 'INSTALLMENT_MISMATCH');
      const [acc] = await tx.select().from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.ownerId, user.id))).for('update');
      if (!acc) throw notFound('Account not found');
      if (acc.status !== 'ACTIVE') throw new ApiError(422, 'Account is frozen', 'ACCOUNT_FROZEN');
      const debited = await tx.update(accounts).set({ balance: sql`${accounts.balance} - ${next.amount}::numeric` })
        .where(and(eq(accounts.id, acc.id), sql`${accounts.balance} - ${next.amount}::numeric >= ${fromCents(toCents(settings.minAccountBalance))}::numeric`)).returning({ id: accounts.id });
      if (!debited.length) throw new ApiError(422, 'Insufficient funds to pay this instalment', 'INSUFFICIENT_FUNDS');
      const now = new Date();
      const [t] = await tx.insert(transactions).values({
        reference: txReference(), type: 'LOAN_REPAYMENT', status: 'COMPLETED', amount: next.amount, description: `Loan ${l.reference} · instalment ${next.number}/${l.durationMonths}`,
        senderAccountId: acc.id, idempotencyKey: input.idempotencyKey, initiatedById: user.id, loanId, completedAt: now,
      }).returning();
      await tx.update(installments).set({ status: 'PAID', paidAt: now, transactionId: t.id }).where(eq(installments.id, next.id));
      const done = due.length === 1;
      await tx.update(loans).set({ remainingBalance: done ? '0' : sql`${loans.remainingBalance} - ${next.amount}::numeric`, status: done ? 'COMPLETED' : 'ACTIVE' }).where(eq(loans.id, loanId));
      await notify(tx, user.id, { title: done ? 'Loan fully repaid 🎉' : 'Repayment received', body: `Instalment ${next.number}/${l.durationMonths} of $${num(next.amount).toLocaleString()} paid for ${l.reference}.`, kind: 'loan_repayment', link: `/loans/${loanId}` });
      return { id: t.id, reference: t.reference, duplicate: false };
    });
  } catch (e) {
    if (pgError(e).constraint === 'tx_idem_idx') throw conflict('This payment was already submitted', 'DUPLICATE');
    throw e;
  }
}
