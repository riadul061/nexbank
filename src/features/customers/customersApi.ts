import { baseApi } from '@/store/baseApi';
import type { CustomerDetailDTO, CustomerDTO, Paginated } from '@/types';

export const customersApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getCustomers: b.query<Paginated<CustomerDTO>, { q?: string; status?: string; role?: string; page?: number; pageSize?: number }>({
      query: (params) => ({ url: 'customers', params: Object.fromEntries(Object.entries(params).filter(([, v]) => v)) }), providesTags: [{ type: 'Customer', id: 'LIST' }],
    }),
    getCustomer: b.query<CustomerDetailDTO, string>({ query: (id) => `customers/${id}`, providesTags: (_r, _e, id) => [{ type: 'Customer', id }] }),
    registerCustomer: b.mutation<{ id: string; accountNumber: string | null }, Record<string, unknown>>({
      query: (body) => ({ url: 'customers', method: 'POST', body }), invalidatesTags: ['Customer', 'Account', 'Dashboard'],
    }),
    updateCustomer: b.mutation<{ ok: true }, { id: string; status?: string; verify?: true }>({
      query: ({ id, ...body }) => ({ url: `customers/${id}`, method: 'PATCH', body }), invalidatesTags: ['Customer', 'Dashboard'],
    }),
  }),
});
export const { useGetCustomersQuery, useGetCustomerQuery, useRegisterCustomerMutation, useUpdateCustomerMutation } = customersApi;
