'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  ArrowLeftRight, Banknote, Bell, CreditCard, FileClock, Landmark, LayoutDashboard, LogOut, Menu, Moon, PiggyBank, Settings, ShieldCheck, Sun, UserCircle, Users, X,
} from 'lucide-react';
import { cn, fmtDateTime } from '@/lib/utils';
import type { Role } from '@/types';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { setSidebar } from '@/features/ui/uiSlice';
import { logoutThunk } from '@/features/auth/authSlice';
import { useGetNotificationsQuery, useMarkReadMutation } from '@/features/notifications/notificationsApi';
import { Avatar } from '@/components/ui/primitives';

const NAV: Record<Role, { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  ADMIN: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard }, { href: '/customers', label: 'Customers', icon: Users }, { href: '/accounts', label: 'Accounts', icon: Landmark },
    { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight }, { href: '/requests', label: 'Deposits & Withdrawals', icon: FileClock }, { href: '/loans', label: 'Loans', icon: Banknote },
    { href: '/settings', label: 'Bank settings', icon: Settings },
  ],
  STAFF: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard }, { href: '/customers', label: 'Customers', icon: Users }, { href: '/accounts', label: 'Accounts', icon: Landmark },
    { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight }, { href: '/requests', label: 'Deposits & Withdrawals', icon: FileClock }, { href: '/loans', label: 'Loan desk', icon: Banknote },
  ],
  CUSTOMER: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, { href: '/accounts', label: 'My accounts', icon: CreditCard }, { href: '/transfer', label: 'Send money', icon: ArrowLeftRight },
    { href: '/transactions', label: 'Transactions', icon: PiggyBank }, { href: '/requests', label: 'Deposit / Withdraw', icon: FileClock }, { href: '/loans', label: 'Loans', icon: Banknote },
    { href: '/profile', label: 'Profile & security', icon: ShieldCheck },
  ],
};
const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Administrator', STAFF: 'Bank staff', CUSTOMER: 'Customer' };

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2fb594] to-[#0f5c4d] text-white shadow-inner"><Landmark className="h-[18px] w-[18px]" /></span>
      <span className="display text-xl font-semibold tracking-tight text-white">NexBank</span>
    </Link>
  );
}

function NavList({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV[role].map(({ href, label, icon: Icon }) => {
        const active = path === href || (href !== '/dashboard' && path.startsWith(href));
        return (
          <Link key={href} href={href} onClick={onNavigate}
            className={cn('group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition', active ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/6 hover:text-white')}>
            <Icon className={cn('h-[18px] w-[18px]', active && 'text-[#5fe0bd]')} />{label}
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#5fe0bd]" />}
          </Link>
        );
      })}
    </nav>
  );
}

function BellMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useGetNotificationsQuery(undefined, { pollingInterval: 30_000 });
  const [markRead] = useMarkReadMutation();
  const router = useRouter();
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-ink/5 hover:text-ink">
        <Bell className="h-[18px] w-[18px]" />
        {!!data?.unread && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="anim-pop absolute right-0 top-11 z-50 w-[min(92vw,22rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><span className="text-sm font-semibold">Notifications</span>{!!data?.unread && <button onClick={() => markRead()} className="text-xs text-brand hover:underline">Mark all read</button>}</div>
          <ul className="max-h-80 overflow-y-auto">
            {data?.items.slice(0, 6).map((n) => (
              <li key={n.id}>
                <button onClick={() => { setOpen(false); if (!n.read) markRead({ id: n.id }); if (n.link) router.push(n.link); }} className={cn('flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left hover:bg-surface2', !n.read && 'bg-brand/5')}>
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand')} />
                  <span><span className="block text-sm font-medium">{n.title}</span><span className="line-clamp-2 text-xs text-muted">{n.body}</span><span className="mt-1 block text-[11px] text-muted/80">{fmtDateTime(n.createdAt)}</span></span>
                </button>
              </li>
            ))}
            {!data?.items.length && <li className="px-4 py-8 text-center text-sm text-muted">You’re all caught up.</li>}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block bg-surface2 px-4 py-2.5 text-center text-xs font-medium text-brand hover:underline">View all</Link>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label="Toggle dark mode" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-ink/5 hover:text-ink">
      {mounted && resolvedTheme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

export default function AppShell({ role, name, email, children }: { role: Role; name: string; email: string; children: React.ReactNode }) {
  const open = useAppSelector((s) => s.ui.sidebarOpen);
  const dispatch = useAppDispatch();
  const path = usePathname();
  useEffect(() => { dispatch(setSidebar(false)); }, [path, dispatch]);
  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[rgb(var(--sidebar))] lg:flex">
        <div className="flex h-16 items-center border-b border-white/8"><Brand /></div>
        <NavList role={role} />
        <div className="m-3 rounded-xl bg-white/6 p-3">
          <div className="flex items-center gap-3"><Avatar name={name} size={34} /><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{name}</p><p className="truncate text-[11px] text-white/50">{ROLE_LABEL[role]}</p></div></div>
        </div>
      </aside>
      {/* Mobile drawer */}
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => dispatch(setSidebar(false))} />}
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[rgb(var(--sidebar))] transition-transform duration-200 lg:hidden', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center justify-between border-b border-white/8 pr-3"><Brand /><button onClick={() => dispatch(setSidebar(false))} aria-label="Close menu" className="text-white/70"><X className="h-5 w-5" /></button></div>
        <NavList role={role} onNavigate={() => dispatch(setSidebar(false))} />
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-bg/85 px-4 backdrop-blur sm:px-6">
        <button onClick={() => dispatch(setSidebar(true))} aria-label="Open menu" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-ink/5 lg:hidden"><Menu className="h-5 w-5" /></button>
        <span className="display text-lg font-semibold lg:hidden">NexBank</span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle /><BellMenu />
          <div className="mx-2 hidden h-6 w-px bg-line sm:block" />
          <div className="hidden text-right sm:block"><p className="text-sm font-medium leading-tight">{name}</p><p className="text-[11px] leading-tight text-muted">{email}</p></div>
          <button onClick={() => dispatch(logoutThunk())} aria-label="Sign out" title="Sign out" className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"><LogOut className="h-[18px] w-[18px]" /></button>
        </div>
      </header>
      <main className="anim-in mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      <span className="hidden"><UserCircle /></span>
    </div>
  );
}
