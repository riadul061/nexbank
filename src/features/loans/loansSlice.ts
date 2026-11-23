import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
const slice = createSlice({
  name: 'loans',
  initialState: { status: '' as string, q: '', page: 1 },
  reducers: {
    setLoanFilters(s, a: PayloadAction<Partial<{ status: string; q: string }>>) { Object.assign(s, a.payload, { page: 1 }); },
    setLoanPage(s, a: PayloadAction<number>) { s.page = a.payload; },
  },
});
export const { setLoanFilters, setLoanPage } = slice.actions;
export default slice.reducer;
