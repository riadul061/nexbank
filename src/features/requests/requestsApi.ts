import { baseApi, MONEY_TAGS } from '@/store/baseApi';
import type { FundRequestDTO, Paginated } from '@/types';

export const requestsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getRequests: b.query<Paginated<FundRequestDTO>, { status?: string; type?: string; page?: number; pageSize?: number }>({
      query: (params) => ({ url: 'requests', params: Object.fromEntries(Object.entries(params).filter(([, v]) => v)) }),
      providesTags: [{ type: 'Request', id: 'LIST' }],
    }),
    createRequest: b.mutation<{ id: string; reference: string }, { accountId: string; type: 'DEPOSIT' | 'WITHDRAWAL'; amount: number; description?: string; idempotencyKey: string }>({
      query: (body) => ({ url: 'requests', method: 'POST', body }), invalidatesTags: ['Request', 'Transaction', 'Dashboard'],
    }),
    reviewRequest: b.mutation<{ ok: true }, { id: string; decision: 'APPROVE' | 'REJECT'; note?: string }>({
      query: ({ id, ...body }) => ({ url: `requests/${id}`, method: 'PATCH', body }), invalidatesTags: [...MONEY_TAGS],
    }),
  }),
});
export const { useGetRequestsQuery, useCreateRequestMutation, useReviewRequestMutation } = requestsApi;
