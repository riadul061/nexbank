import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { signOut } from 'next-auth/react';

export interface NormalizedError { status: number | string; data: { error: string; code?: string } }

const raw = fetchBaseQuery({ baseUrl: '/api', headers: { Accept: 'application/json' } });

/** One place for error normalisation + session expiry handling. */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, NormalizedError> = async (args, api, extra) => {
  const res = await raw(args, api, extra);
  if (res.error) {
    const e = res.error as FetchBaseQueryError;
    const data = (typeof e.data === 'object' && e.data ? e.data : {}) as { error?: string; code?: string };
    const status = e.status;
    const msg = data.error ?? (status === 'FETCH_ERROR' ? 'Network error. Check your connection.' : 'Unexpected error');
    if (typeof window !== 'undefined' && (status === 401 || data.code === 'ACCOUNT_DISABLED')) void signOut({ callbackUrl: '/login' });
    return { error: { status, data: { error: msg, code: data.code } } };
  }
  return { data: res.data };
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Account', 'Transaction', 'Loan', 'Request', 'Customer', 'Notification', 'Dashboard', 'Settings', 'Me'],
  endpoints: () => ({}),
});

export const errMsg = (e: unknown): string => {
  const x = e as { data?: { error?: string }; message?: string; error?: string };
  return x?.data?.error ?? x?.error ?? x?.message ?? 'Something went wrong';
};
export const MONEY_TAGS = ['Account', 'Transaction', 'Dashboard', 'Notification', 'Request', 'Loan', 'Customer'] as const;
