import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
export interface TxFilterState { q: string; type: string; status: string; from: string; to: string; flagged: string; page: number; pageSize: number }
export const initialTxFilters: TxFilterState = { q: '', type: '', status: '', from: '', to: '', flagged: '', page: 1, pageSize: 10 };
/** Transaction list filters live in Redux so they survive navigation (list → details → back). */
const slice = createSlice({
  name: 'transactions',
  initialState: { filters: initialTxFilters },
  reducers: {
    setTxFilters(s, a: PayloadAction<Partial<TxFilterState>>) { s.filters = { ...s.filters, page: 1, ...a.payload }; },
    setTxPage(s, a: PayloadAction<number>) { s.filters.page = a.payload; },
    resetTxFilters(s) { s.filters = initialTxFilters; },
  },
});
export const { setTxFilters, setTxPage, resetTxFilters } = slice.actions;
export default slice.reducer;
