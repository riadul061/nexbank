import { baseApi } from '@/store/baseApi';
import type { BankSettings } from '@/types';
export const settingsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getSettings: b.query<BankSettings, void>({ query: () => 'settings', providesTags: ['Settings'] }),
    saveSettings: b.mutation<BankSettings, BankSettings>({ query: (body) => ({ url: 'settings', method: 'PUT', body }), invalidatesTags: ['Settings'] }),
  }),
});
export const { useGetSettingsQuery, useSaveSettingsMutation } = settingsApi;
