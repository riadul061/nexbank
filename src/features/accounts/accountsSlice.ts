import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
/** Which of the customer's accounts is currently "in focus" across dashboard, transactions and transfer pages. */
const slice = createSlice({
  name: 'accounts',
  initialState: { selectedAccountId: null as string | null },
  reducers: { selectAccount(s, a: PayloadAction<string | null>) { s.selectedAccountId = a.payload; } },
});
export const { selectAccount } = slice.actions;
export default slice.reducer;
