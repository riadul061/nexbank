import { baseApi, MONEY_TAGS } from '@/store/baseApi';
import type { AccountDTO, Paginated } from '@/types';

export interface AccountFilters { q?: string; status?: string; type?: string; ownerId?: string; page?: number; pageSize?: number }
export interface Recipient { accountNumber: string; type: string; available: boolean; holder: string; own: boolean; accountId: string }

export const accountsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getAccounts: b.query<Paginated<AccountDTO>, AccountFilters | void>({
      query: (p) => ({ url: 'accounts', params: Object.fromEntries(Object.entries({ pageSize: 50, ...(p ?? {}) }).filter(([, v]) => v !== '' && v != null)) }),
      providesTags: (r) => [{ type: 'Account', id: 'LIST' }, ...(r?.items ?? []).map((a) => ({ type: 'Account' as const, id: a.id }))],
    }),
    getAccount: b.query<AccountDTO, string>({ query: (id) => `accounts/${id}`, providesTags: (_r, _e, id) => [{ type: 'Account', id }] }),
    lookupRecipient: b.query<Recipient, string>({ query: (n) => ({ url: 'accounts/lookup', params: { number: n } }) }),
    createAccount: b.mutation<AccountDTO, { ownerId: string; type: string; nickname?: string; dailyLimit?: number; singleLimit?: number }>({
      query: (body) => ({ url: 'accounts', method: 'POST', body }), invalidatesTags: ['Account', 'Customer', 'Dashboard'],
    }),
    updateAccount: b.mutation<{ ok: true }, { id: string; patch: Partial<{ status: string; type: string; nickname: string | null; dailyLimit: number; singleLimit: number }> }>({
      query: ({ id, patch }) => ({ url: `accounts/${id}`, method: 'PATCH', body: patch }), invalidatesTags: ['Account', 'Customer'],
    }),
    transfer: b.mutation<{ id: string; reference: string; duplicate: boolean }, { fromAccountId: string; toAccountNumber: string; amount: number; description?: string; pin: string; idempotencyKey: string }>({
      query: (body) => ({ url: 'transfers', method: 'POST', body }), invalidatesTags: [...MONEY_TAGS],
    }),
  }),
});
export const { useGetAccountsQuery, useGetAccountQuery, useLazyLookupRecipientQuery, useCreateAccountMutation, useUpdateAccountMutation, useTransferMutation } = accountsApi;
