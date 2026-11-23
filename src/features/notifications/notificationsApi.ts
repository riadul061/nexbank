import { baseApi } from '@/store/baseApi';
import type { NotificationDTO } from '@/types';
export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getNotifications: b.query<{ unread: number; items: NotificationDTO[] }, void>({ query: () => 'notifications', providesTags: ['Notification'] }),
    markRead: b.mutation<{ ok: true }, { id?: string } | void>({ query: (body) => ({ url: 'notifications', method: 'PATCH', body: body ?? {} }), invalidatesTags: ['Notification'] }),
  }),
});
export const { useGetNotificationsQuery, useMarkReadMutation } = notificationsApi;
