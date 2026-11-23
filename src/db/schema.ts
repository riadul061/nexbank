import {
  pgTable, pgEnum, text, boolean, integer, timestamp, numeric, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const roleEnum = pgEnum('role', ['ADMIN', 'STAFF', 'CUSTOMER']);
export const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'INACTIVE', 'BLOCKED']);
export const accountTypeEnum = pgEnum('account_type', ['SAVINGS', 'CURRENT', 'BUSINESS']);
export const accountStatusEnum = pgEnum('account_status', ['ACTIVE', 'FROZEN']);
export const txTypeEnum = pgEnum('tx_type', ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT']);
export const txStatusEnum = pgEnum('tx_status', ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED']);
export const requestTypeEnum = pgEnum('request_type', ['DEPOSIT', 'WITHDRAWAL']);
export const requestStatusEnum = pgEnum('request_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const loanTypeEnum = pgEnum('loan_type', ['PERSONAL', 'HOME', 'EDUCATION', 'AUTO', 'BUSINESS']);
export const employmentEnum = pgEnum('employment_status', ['EMPLOYED', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'STUDENT', 'RETIRED', 'UNEMPLOYED']);
export const loanStatusEnum = pgEnum('loan_status', ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED']);
export const installmentStatusEnum = pgEnum('installment_status', ['DUE', 'PAID']);

export const users = pgTable('users', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('CUSTOMER'),
  status: userStatusEnum('status').notNull().default('ACTIVE'),
  phone: text('phone'),
  address: text('address'),
  nationalId: text('national_id'),
  verified: boolean('verified').notNull().default(false),
  verifiedById: text('verified_by_id'),
  verifiedAt: ts('verified_at'),
  pinHash: text('pin_hash'),
  pinAttempts: integer('pin_attempts').notNull().default(0),
  pinLockedUntil: ts('pin_locked_until'),
  createdById: text('created_by_id'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_idx').on(t.email), index('users_role_idx').on(t.role, t.status)]);

export const accounts = pgTable('accounts', {
  id: id(),
  accountNumber: text('account_number').notNull(),
  type: accountTypeEnum('type').notNull(),
  status: accountStatusEnum('status').notNull().default('ACTIVE'),
  balance: money('balance').notNull().default('0'),
  dailyLimit: money('daily_limit').notNull().default('10000'),
  singleLimit: money('single_limit').notNull().default('5000'),
  nickname: text('nickname'),
  ownerId: text('owner_id').notNull().references(() => users.id),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('accounts_number_idx').on(t.accountNumber),
  index('accounts_owner_idx').on(t.ownerId),
  // Defence in depth: the DB itself refuses a negative balance.
  check('accounts_balance_non_negative', sql`${t.balance} >= 0`),
]);

export const transactions = pgTable('transactions', {
  id: id(),
  reference: text('reference').notNull(),
  type: txTypeEnum('type').notNull(),
  status: txStatusEnum('status').notNull().default('PENDING'),
  amount: money('amount').notNull(),
  fee: money('fee').notNull().default('0'),
  description: text('description'),
  senderAccountId: text('sender_account_id').references(() => accounts.id),
  receiverAccountId: text('receiver_account_id').references(() => accounts.id),
  idempotencyKey: text('idempotency_key'),
  initiatedById: text('initiated_by_id'),
  loanId: text('loan_id'),
  flagged: boolean('flagged').notNull().default(false),
  flagReason: text('flag_reason'),
  flagSource: text('flag_source'),
  flaggedById: text('flagged_by_id'),
  flaggedAt: ts('flagged_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  completedAt: ts('completed_at'),
}, (t) => [
  uniqueIndex('tx_reference_idx').on(t.reference),
  uniqueIndex('tx_idem_idx').on(t.idempotencyKey),
  index('tx_sender_idx').on(t.senderAccountId, t.createdAt),
  index('tx_receiver_idx').on(t.receiverAccountId, t.createdAt),
  index('tx_type_idx').on(t.type, t.status),
  index('tx_created_idx').on(t.createdAt),
  check('tx_amount_positive', sql`${t.amount} > 0`),
]);

export const fundRequests = pgTable('fund_requests', {
  id: id(),
  type: requestTypeEnum('type').notNull(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  amount: money('amount').notNull(),
  description: text('description'),
  status: requestStatusEnum('status').notNull().default('PENDING'),
  requestedById: text('requested_by_id').notNull().references(() => users.id),
  reviewedById: text('reviewed_by_id'),
  reviewNote: text('review_note'),
  reviewedAt: ts('reviewed_at'),
  transactionId: text('transaction_id').references(() => transactions.id),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('req_status_idx').on(t.status, t.createdAt)]);

export const loans = pgTable('loans', {
  id: id(),
  reference: text('reference').notNull(),
  customerId: text('customer_id').notNull().references(() => users.id),
  accountId: text('account_id').notNull().references(() => accounts.id),
  loanType: loanTypeEnum('loan_type').notNull(),
  amount: money('amount').notNull(),
  durationMonths: integer('duration_months').notNull(),
  interestRate: numeric('interest_rate', { precision: 5, scale: 2 }).notNull(),
  monthlyIncome: money('monthly_income').notNull(),
  employmentStatus: employmentEnum('employment_status').notNull(),
  description: text('description'),
  status: loanStatusEnum('status').notNull().default('PENDING'),
  monthlyPayment: money('monthly_payment'),
  totalPayable: money('total_payable'),
  remainingBalance: money('remaining_balance'),
  forwardedById: text('forwarded_by_id'),
  forwardedAt: ts('forwarded_at'),
  decidedById: text('decided_by_id'),
  decidedAt: ts('decided_at'),
  decisionNote: text('decision_note'),
  disbursementTxId: text('disbursement_tx_id'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('loans_ref_idx').on(t.reference), index('loans_customer_idx').on(t.customerId), index('loans_status_idx').on(t.status)]);

export const loanNotes = pgTable('loan_notes', {
  id: id(),
  loanId: text('loan_id').notNull().references(() => loans.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull(),
  authorName: text('author_name').notNull(),
  body: text('body').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const installments = pgTable('installments', {
  id: id(),
  loanId: text('loan_id').notNull().references(() => loans.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  dueDate: ts('due_date').notNull(),
  amount: money('amount').notNull(),
  status: installmentStatusEnum('status').notNull().default('DUE'),
  paidAt: ts('paid_at'),
  transactionId: text('transaction_id'),
}, (t) => [uniqueIndex('inst_loan_num_idx').on(t.loanId, t.number)]);

export const notifications = pgTable('notifications', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  kind: text('kind').notNull(),
  link: text('link'),
  read: boolean('read').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('notif_user_idx').on(t.userId, t.read, t.createdAt)]);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: money('value').notNull(),
});

// ---------------------------------------------------------------- relations
export const usersRelations = relations(users, ({ many }) => ({ accounts: many(accounts), loans: many(loans) }));
export const accountsRelations = relations(accounts, ({ one }) => ({ owner: one(users, { fields: [accounts.ownerId], references: [users.id] }) }));
export const transactionsRelations = relations(transactions, ({ one }) => ({
  sender: one(accounts, { fields: [transactions.senderAccountId], references: [accounts.id], relationName: 'sent' }),
  receiver: one(accounts, { fields: [transactions.receiverAccountId], references: [accounts.id], relationName: 'received' }),
}));
export const fundRequestsRelations = relations(fundRequests, ({ one }) => ({
  account: one(accounts, { fields: [fundRequests.accountId], references: [accounts.id] }),
  requestedBy: one(users, { fields: [fundRequests.requestedById], references: [users.id] }),
  transaction: one(transactions, { fields: [fundRequests.transactionId], references: [transactions.id] }),
}));
export const loansRelations = relations(loans, ({ one, many }) => ({
  customer: one(users, { fields: [loans.customerId], references: [users.id] }),
  account: one(accounts, { fields: [loans.accountId], references: [accounts.id] }),
  notes: many(loanNotes),
  installments: many(installments),
}));
export const loanNotesRelations = relations(loanNotes, ({ one }) => ({ loan: one(loans, { fields: [loanNotes.loanId], references: [loans.id] }) }));
export const installmentsRelations = relations(installments, ({ one }) => ({ loan: one(loans, { fields: [installments.loanId], references: [loans.id] }) }));

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
