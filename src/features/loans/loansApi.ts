import { baseApi, MONEY_TAGS } from '@/store/baseApi';
import type { LoanDetailDTO, LoanDTO, Paginated } from '@/types';

export const loansApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getLoans: b.query<Paginated<LoanDTO>, { status?: string; q?: string; page?: number; pageSize?: number }>({
      query: (params) => ({ url: 'loans', params: Object.fromEntries(Object.entries(params).filter(([, v]) => v)) }),
      providesTags: [{ type: 'Loan', id: 'LIST' }],
    }),
    getLoan: b.query<LoanDetailDTO, string>({ query: (id) => `loans/${id}`, providesTags: (_r, _e, id) => [{ type: 'Loan', id }] }),
    applyLoan: b.mutation<{ id: string; reference: string }, Record<string, unknown>>({ query: (body) => ({ url: 'loans', method: 'POST', body }), invalidatesTags: ['Loan', 'Dashboard'] }),
    addLoanNote: b.mutation<{ ok: true }, { id: string; body: string }>({ query: ({ id, body }) => ({ url: `loans/${id}/notes`, method: 'POST', body: { body } }), invalidatesTags: ['Loan'] }),
    forwardLoan: b.mutation<{ ok: true }, { id: string; note?: string }>({ query: ({ id, note }) => ({ url: `loans/${id}/forward`, method: 'POST', body: { note } }), invalidatesTags: ['Loan', 'Dashboard'] }),
    decideLoan: b.mutation<{ ok: true }, { id: string; decision: 'APPROVE' | 'REJECT'; note?: string }>({
      query: ({ id, ...body }) => ({ url: `loans/${id}/decision`, method: 'POST', body }), invalidatesTags: [...MONEY_TAGS],
    }),
    repayLoan: b.mutation<{ id: string; reference: string }, { id: string; accountId: string; installmentNumber: number; pin: string; idempotencyKey: string }>({
      query: ({ id, ...body }) => ({ url: `loans/${id}/repay`, method: 'POST', body }), invalidatesTags: [...MONEY_TAGS],
    }),
  }),
});
export const { useGetLoansQuery, useGetLoanQuery, useApplyLoanMutation, useAddLoanNoteMutation, useForwardLoanMutation, useDecideLoanMutation, useRepayLoanMutation } = loansApi;
