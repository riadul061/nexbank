'use client';
import { useEffect, useRef } from 'react';
import { Provider } from 'react-redux';
import { SessionProvider, useSession } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { makeStore, type AppStore, useAppDispatch } from '@/store/store';
import { setSession } from '@/features/auth/authSlice';
import { ToastHost, ProgressBar } from '@/components/ui/feedback';

/** Mirrors the NextAuth session into the Redux auth slice so any component can read it from the store. */
function SessionSync() {
  const { data, status } = useSession();
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setSession({
      status,
      user: data?.user ? { id: data.user.id, name: data.user.name ?? '', email: data.user.email ?? '', role: data.user.role } : null,
    }));
  }, [data, status, dispatch]);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const ref = useRef<AppStore | null>(null);
  if (!ref.current) ref.current = makeStore();
  return (
    <Provider store={ref.current}>
      <SessionProvider refetchOnWindowFocus={false}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SessionSync />
          <ProgressBar />
          {children}
          <ToastHost />
        </ThemeProvider>
      </SessionProvider>
    </Provider>
  );
}
