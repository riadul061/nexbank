import { baseApi } from '@/store/baseApi';
import type { Paginated, TransactionDTO } from '@/types';

export type TxQuery = Partial<{ q: string; type: string; status: string; from: string; to: string; flagged: string; accountId: string; customerId: string; page: number; pageSize: number }>;
const clean = (o: TxQuery) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));

export const transactionsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getTransactions: b.query<Paginated<TransactionDTO>, TxQuery>({
      query: (p) => ({ url: 'transactions', params: clean(p) }),
      providesTags: (r) => [{ type: 'Transaction', id: 'LIST' }, ...(r?.items ?? []).map((t) => ({ type: 'Transaction' as const, id: t.id }))],
    }),
    getTransaction: b.query<TransactionDTO, string>({ query: (id) => `transactions/${id}`, providesTags: (_r, _e, id) => [{ type: 'Transaction', id }] }),
    flagTransaction: b.mutation<{ ok: true }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `transactions/${id}/flag`, method: 'POST', body: { reason } }), invalidatesTags: ['Transaction', 'Dashboard'],
    }),
    clearFlag: b.mutation<{ ok: true }, string>({ query: (id) => ({ url: `transactions/${id}/flag`, method: 'DELETE' }), invalidatesTags: ['Transaction', 'Dashboard'] }),
    reverseTransaction: b.mutation<{ ok: true }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `transactions/${id}/reverse`, method: 'POST', body: { reason } }), invalidatesTags: ['Transaction', 'Account', 'Dashboard', 'Customer'],
    }),
  }),
});
export const { useGetTransactionsQuery, useGetTransactionQuery, useFlagTransactionMutation, useClearFlagMutation, useReverseTransactionMutation } = transactionsApi;
