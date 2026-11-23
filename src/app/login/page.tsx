'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Landmark, Lock, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { clearAuthError, loginThunk } from '@/features/auth/authSlice';
import { Button, Field, Input } from '@/components/ui/primitives';

const DEMO = [
  { role: 'Admin', email: 'admin@nexbank.demo', password: 'Admin@12345', hint: 'Full control & analytics' },
  { role: 'Bank staff', email: 'staff@nexbank.demo', password: 'Staff@12345', hint: 'Operations & review' },
  { role: 'Customer', email: 'customer@nexbank.demo', password: 'Customer@12345', hint: 'Accounts, transfers, loans · PIN 1234' },
];

function LoginForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useSearchParams();
  const { loginStatus, error } = useAppSelector((s) => s.auth);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false);

  const submit = async (e?: React.FormEvent, creds = { email, password }) => {
    e?.preventDefault();
    const res = await dispatch(loginThunk(creds));
    if (loginThunk.fulfilled.match(res)) { router.replace(params.get('callbackUrl') || '/dashboard'); router.refresh(); }
  };
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 flex items-center gap-2.5 lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brandfg"><Landmark className="h-5 w-5" /></span><span className="display text-2xl font-semibold">NexBank</span></div>
      <h1 className="display text-3xl font-semibold">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted">Sign in to manage your money, loans and activity.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <Field label="Email"><Input type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); dispatch(clearAuthError()); }} placeholder="you@example.com" required /></Field>
        <Field label="Password">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); dispatch(clearAuthError()); }} placeholder="••••••••" className="pr-10" required />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label="Toggle password" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </Field>
        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loginStatus === 'pending'} disabled={!email || !password}>Sign in</Button>
      </form>
      <div className="mt-8">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><Sparkles className="h-3.5 w-3.5" />Demo accounts · click to sign in</p>
        <div className="grid gap-2">
          {DEMO.map((d) => (
            <button key={d.role} type="button" disabled={loginStatus === 'pending'} onClick={() => { setEmail(d.email); setPassword(d.password); void submit(undefined, { email: d.email, password: d.password }); }}
              className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left transition hover:border-brand hover:bg-brand/5 disabled:opacity-60">
              <span><span className="block text-sm font-semibold">{d.role}</span><span className="text-xs text-muted">{d.hint}</span></span>
              <span className="num text-[11px] text-muted">{d.email}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-6 flex items-center gap-1.5 text-[11px] text-muted"><Lock className="h-3 w-3" />Simulated banking environment — no real money or cards are used.</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#0b2620] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#2fb594]/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-[#c9962e]/15 blur-3xl" />
        <div className="relative flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2fb594] to-[#0f5c4d]"><Landmark className="h-5 w-5" /></span><span className="display text-2xl font-semibold">NexBank</span></div>
        <div className="relative max-w-md">
          <p className="display text-5xl font-medium leading-[1.08]">Banking that stays out of your way.</p>
          <p className="mt-5 text-base text-white/65">Atomic transfers, role-based controls and a ledger you can trust — built like a real bank, packaged like a modern product.</p>
          <ul className="mt-10 space-y-4 text-sm text-white/80">
            <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-[#5fe0bd]" />Every transfer is atomic, PIN-protected and idempotent</li>
            <li className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-[#5fe0bd]" />Live analytics computed from the real ledger</li>
          </ul>
        </div>
        <p className="relative text-xs text-white/40">© NexBank · Assessment project</p>
      </div>
      <div className="flex items-center px-5 py-10 sm:px-10"><Suspense><LoginForm /></Suspense></div>
    </div>
  );
}
