import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { signIn, signOut } from 'next-auth/react';
import type { SessionUser } from '@/types';

interface AuthState { user: SessionUser | null; status: 'loading' | 'authenticated' | 'unauthenticated'; loginStatus: 'idle' | 'pending' | 'failed'; error: string | null }
const initial: AuthState = { user: null, status: 'loading', loginStatus: 'idle', error: null };

const LOGIN_ERRORS: Record<string, string> = {
  ACCOUNT_BLOCKED: 'This account has been blocked. Please contact the bank.',
  ACCOUNT_INACTIVE: 'This account is deactivated. Please contact the bank.',
  CredentialsSignin: 'Invalid email or password.',
};

export const loginThunk = createAsyncThunk<void, { email: string; password: string }, { rejectValue: string }>(
  'auth/login',
  async (creds, { rejectWithValue }) => {
    const res = await signIn('credentials', { ...creds, redirect: false });
    if (!res || res.error) return rejectWithValue(LOGIN_ERRORS[res?.error ?? ''] ?? 'Invalid email or password.');
  },
);
export const logoutThunk = createAsyncThunk('auth/logout', async () => { await signOut({ callbackUrl: '/login' }); });

const slice = createSlice({
  name: 'auth',
  initialState: initial,
  reducers: {
    setSession(s, a: PayloadAction<{ user: SessionUser | null; status: AuthState['status'] }>) { s.user = a.payload.user; s.status = a.payload.status; },
    clearAuthError(s) { s.error = null; s.loginStatus = 'idle'; },
  },
  extraReducers: (b) => {
    b.addCase(loginThunk.pending, (s) => { s.loginStatus = 'pending'; s.error = null; })
      .addCase(loginThunk.fulfilled, (s) => { s.loginStatus = 'idle'; })
      .addCase(loginThunk.rejected, (s, a) => { s.loginStatus = 'failed'; s.error = a.payload ?? 'Login failed'; });
  },
});
export const { setSession, clearAuthError } = slice.actions;
export default slice.reducer;
