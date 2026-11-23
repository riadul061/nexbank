import { baseApi } from '@/store/baseApi';
export interface MeDTO { id: string; name: string; email: string; role: string; phone: string | null; address: string | null; verified: boolean; hasPin: boolean; createdAt: string }
export const profileApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getMe: b.query<MeDTO, void>({ query: () => 'me', providesTags: ['Me'] }),
    setPin: b.mutation<{ ok: true }, { pin: string; currentPin?: string }>({ query: (body) => ({ url: 'me', method: 'PATCH', body }), invalidatesTags: ['Me'] }),
  }),
});
export const { useGetMeQuery, useSetPinMutation } = profileApi;
