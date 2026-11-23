import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { UnknownAction } from '@reduxjs/toolkit';

export interface Toast { id: string; kind: 'success' | 'error' | 'info'; message: string }
const API_ACTION = /^api\/execute(Query|Mutation)\/(pending|fulfilled|rejected)$/;
const isApi = (a: UnknownAction) => API_ACTION.test(a.type);

/**
 * Centralised UI state:
 *  - `inflight` counts every RTK Query request (drives the global progress bar)
 *  - failed MUTATIONS surface as error toasts automatically (centralised error handling)
 */
const slice = createSlice({
  name: 'ui',
  initialState: { inflight: 0, toasts: [] as Toast[], sidebarOpen: false },
  reducers: {
    pushToast: { reducer(s, a: PayloadAction<Toast>) { s.toasts.push(a.payload); }, prepare: (kind: Toast['kind'], message: string) => ({ payload: { id: nanoid(), kind, message } }) },
    dismissToast(s, a: PayloadAction<string>) { s.toasts = s.toasts.filter((t) => t.id !== a.payload); },
    setSidebar(s, a: PayloadAction<boolean>) { s.sidebarOpen = a.payload; },
  },
  extraReducers: (b) => {
    b.addMatcher(isApi, (s, a) => {
      if (a.type.endsWith('/pending')) s.inflight += 1;
      else s.inflight = Math.max(0, s.inflight - 1);
      if (a.type === 'api/executeMutation/rejected') {
        const p = a as unknown as { payload?: { data?: { error?: string } }; meta?: { aborted?: boolean } };
        if (!p.meta?.aborted) s.toasts.push({ id: nanoid(), kind: 'error', message: p.payload?.data?.error ?? 'Request failed' });
      }
    });
  },
});
export const { pushToast, dismissToast, setSidebar } = slice.actions;
export default slice.reducer;
