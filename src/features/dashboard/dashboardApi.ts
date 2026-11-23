import { baseApi } from '@/store/baseApi';
import type { AdminDashboardDTO, CustomerDashboardDTO } from '@/types';
export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getAdminDashboard: b.query<AdminDashboardDTO, void>({ query: () => 'dashboard', providesTags: ['Dashboard'] }),
    getCustomerDashboard: b.query<CustomerDashboardDTO, string | null | void>({ query: (accountId) => ({ url: 'dashboard', params: accountId ? { accountId } : {} }), providesTags: ['Dashboard'] }),
  }),
});
export const { useGetAdminDashboardQuery, useGetCustomerDashboardQuery } = dashboardApi;
