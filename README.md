# NexBank — Digital Banking Management System

A simulated, production-style digital banking platform built with **Next.js (App Router) + TypeScript + Redux Toolkit / RTK Query + PostgreSQL**. Three roles (Admin, Bank Staff, Customer), atomic fund transfers, deposit/withdrawal approval workflow, a full loan lifecycle, PDF receipts, statement export, notifications, rule-based fraud flagging and dark mode.

> Simulation only. No real payment gateways, cards or bank credentials are used.

## Application features

**Customer** – personalised dashboard (balance, deposits, withdrawals, active loans, recent activity, 3 charts), multi-account switcher, account details & status, CSV/PDF statements, transfers (own accounts or other customers) with PIN, deposit/withdrawal requests, loan application + repayment schedule + paying installments, transaction history with search/filters/pagination, PDF receipts, notifications, PIN management.

**Bank staff** – register customers, open accounts, verify customer information, view customer/account details, search transactions by ID, filter by date/type/status, review pending transactions, flag suspicious ones, view loans, add internal notes, forward applications to admin.

**Admin** – bank-wide analytics (7 KPIs + 5 charts), customer management (search, activate/deactivate/block, history), account management (create, edit, freeze/unfreeze, per-account limits), loan approval/rejection (approval disburses via a recorded transaction), fund request approval, transaction reversal, flag clearing, bank-wide limits & fee settings.

**Bonus items implemented:** PDF receipts · notification system · configurable limits (daily, single, minimum balance) · CSV/PDF statements · suspicious-transaction rule engine · dark mode.

## User roles & permissions

| Capability | Customer | Staff | Admin |
|---|---|---|---|
| Own accounts, transactions, loans | ✅ (own only) | – | – |
| Transfer / request deposit & withdrawal / apply for loan / repay | ✅ | ❌ | ❌ |
| Register customers, open accounts, verify info | ❌ | ✅ | ✅ |
| View all customers / accounts / transactions | ❌ | ✅ | ✅ |
| Flag transactions | ❌ | ✅ | ✅ |
| Approve/reject deposit & withdrawal requests | ❌ | ✅ (never own) | ✅ (never own) |
| Add loan notes, forward loans | ❌ | ✅ | ✅ |
| Approve/reject loans | ❌ | ❌ | ✅ |
| Edit/freeze accounts, set limits, block users, reverse transfers, clear flags, bank settings, manage staff | ❌ | ❌ | ✅ |

## Authentication strategy

NextAuth (Credentials provider, JWT sessions, bcrypt-hashed passwords). Defence in depth:

1. **Edge middleware** redirects unauthenticated users and sends users away from sections their role may not see (UX guard).
2. **Server layout** re-checks the session for every page under `(app)`.
3. **Every API route** is wrapped by `route(roles, handler)` in `src/lib/api.ts`, which verifies the session, **re-reads the user's current role and status from the database** (the JWT is never trusted for authority, so deactivation/blocking takes effect immediately) and enforces the allowed roles. Frontend hiding is cosmetic only.
4. Ownership is verified in the service layer (`getAccountFor`, `getTransactionFor`, `getLoan`…) so a customer can never read another customer's data.

Transaction PINs are bcrypt-hashed, with attempt counting and a temporary lock after 3 failures.

## Transaction processing logic

All money movement lives in `src/lib/services/*` and runs inside a **single PostgreSQL transaction**:

- **Transfer** (`transfers.ts`): validate input (zod) → idempotency lookup → verify PIN → lock both account rows with `SELECT … FOR UPDATE` in a deterministic order (prevents deadlocks) → check ownership, active/frozen status, recipient validity, single-transaction limit, daily limit (sum of the sender's completed transfers today), minimum balance, sufficient funds incl. fee → debit sender, credit receiver, record the transaction (unique `TXN-YYYYMMDD-XXXXXXXX` reference), notify both parties, run suspicious-activity rules. Any failure rolls back everything, so money can never leave only one account.
- **Balances are never accepted from the client.** The client sends only an amount; balances are read and updated server-side with SQL arithmetic.
- **Duplicate prevention:** each form attempt carries an `idempotencyKey` (unique index). Re-submitting returns the original result; 12 concurrent identical requests produce one debit.
- **DB-level safety net:** `CHECK (balance >= 0)` and `CHECK (amount > 0)` constraints.
- **Deposits/withdrawals:** customer creates a `PENDING` request → staff/admin approves or rejects (never their own) → approval moves funds and records the transaction in one DB transaction; each request can be decided once.
- **Loans:** customer applies → staff reviews, adds notes, forwards (`UNDER_REVIEW`) → admin approves (schedule is generated, funds are disbursed as a `LOAN_DISBURSEMENT` transaction, loan becomes `ACTIVE`) or rejects. Installments are paid in order with PIN, each a `LOAN_REPAYMENT` transaction; the loan becomes `COMPLETED` at zero balance.
- **History is preserved:** transactions are never deleted; a reversal creates a counter-entry and marks the original `REVERSED`.
- **Suspicious detection** (`suspicious.ts`): amount over threshold, rapid repeated transfers, and unusual-size patterns auto-flag a transaction for admin review.

Integrity is covered by `npm run test:transfers` (13 scenarios incl. concurrency and overdraw attempts).

## Redux Toolkit architecture

```
src/store/store.ts          configureStore, typed hooks (useAppDispatch / useAppSelector)
src/store/baseApi.ts        single RTK Query API, normalised errors, 401 handling, tag types
src/features/
  auth/          authSlice        – session mirror + loginThunk / logoutThunk (createAsyncThunk), login error state
  accounts/      accountsSlice    – selected account  · accountsApi
  transactions/  transactionsSlice– persisted filters/pagination · transactionsApi
  loans/         loansSlice       – list filters · loansApi
  ui/            uiSlice          – centralised loading counter (global progress bar), toast queue, sidebar
  customers/ requests/ notifications/ dashboard/ settings/  – API modules
```

- **Centralised loading:** `uiSlice` matchers count every in-flight RTK Query request → global progress bar.
- **Centralised error handling:** `baseApi` normalises errors; failed mutations raise toasts automatically from `uiSlice`; screens render `ErrorState` with retry.

## RTK Query implementation

Each feature calls `baseApi.injectEndpoints`. Queries `providesTags`, mutations `invalidatesTags` (e.g. a transfer invalidates `Account`, `Transaction`, `Dashboard`, `Notification`…), so balances, charts and lists refresh automatically after any money movement. Notifications poll every 30 s. Filters in the transactions list are stored in Redux so they survive navigation.

## Database structure (PostgreSQL, Drizzle ORM)

`users` (role, status, verified, pin_hash, pin attempts) · `accounts` (owner, type, status, `numeric(14,2)` balance, daily/single limits) · `transactions` (reference, type, status, sender/receiver account, amount, fee, flag fields, unique `idempotency_key`) · `fund_requests` · `loans` · `installments` · `loan_notes` · `notifications` · `settings` (key/value bank-wide limits).
Indexes on role/status, account number, reference, idempotency key, loan status/customer. Schema: `src/db/schema.ts`.

## Security implementation (summary)

Server-side RBAC on every endpoint · live status re-check per request · ownership checks · zod validation on all inputs · bcrypt for passwords and PINs · PIN lockout · row locking + DB transactions · idempotency keys · DB check constraints · money as `numeric`, never floats in SQL · security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`) · generic error messages for unexpected failures (details logged server-side only).

## Tech stack & additional libraries

Next.js 15, React 19, TypeScript, Tailwind CSS 3, Redux Toolkit + RTK Query, NextAuth v4, Recharts, **additional:** drizzle-orm / drizzle-kit + `pg` (database), zod (validation), bcryptjs (hashing), pdfkit (PDF receipts/statements), next-themes (dark mode), lucide-react (icons), @fontsource Inter & Fraunces, clsx, tsx (scripts).

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon, Supabase, Vercel Postgres, local…). Add `?sslmode=require` for hosted DBs. |
| `NEXTAUTH_SECRET` | Random secret: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public base URL (`http://localhost:3000` locally, your Vercel URL in production) |

Copy `.env.example` to `.env`.

## Local setup

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and NEXTAUTH_SECRET
npm run db:setup              # creates tables and seeds demo data (resets the DB!)
npm run dev                   # http://localhost:3000
npm run test:transfers        # optional: ledger-integrity test suite
```

Need a local database quickly? `docker run -d -p 5432:5432 -e POSTGRES_USER=bank -e POSTGRES_PASSWORD=bank -e POSTGRES_DB=bank postgres:16`.

## Deployment (Vercel)

1. Create a free PostgreSQL database (Neon / Supabase / Vercel Postgres) and copy its connection string.
2. Push this repo to GitHub and import it in Vercel.
3. Set `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your production URL) in Vercel → Settings → Environment Variables.
4. From your machine, run once against the production DB: `DATABASE_URL="<prod url>" npm run db:setup`.
5. Deploy. (`pdfkit` font files are included via `outputFileTracingIncludes` in `next.config.mjs`.)

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@nexbank.demo` | `Admin@12345` |
| Bank staff | `staff@nexbank.demo` | `Staff@12345` |
| Customer | `customer@nexbank.demo` | `Customer@12345` (transaction PIN **1234**) |

Other seeded customers (same password / PIN): `sara@`, `daniel@` (business account), `mei@` (unverified), `rafael@` (deactivated) `@nexbank.demo`. Handy test recipient account: `4000000000011` (Sara Khan).

## Project structure

```
src/app/            pages (App Router): login, (app)/dashboard|accounts|transfer|transactions|requests|loans|customers|settings|profile|notifications, api/*
src/components/     ui kit, charts, layout shell, dashboards, shared tables
src/features/       Redux slices + RTK Query API modules
src/lib/services/   banking business logic (transfers, loans, requests, analytics, documents…)
src/db/             Drizzle schema + connection
scripts/            seed.ts, test-transfers.ts
```
