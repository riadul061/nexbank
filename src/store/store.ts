import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { baseApi } from './baseApi';
import auth from '@/features/auth/authSlice';
import accounts from '@/features/accounts/accountsSlice';
import transactions from '@/features/transactions/transactionsSlice';
import loans from '@/features/loans/loansSlice';
import ui from '@/features/ui/uiSlice';
// Importing the feature API modules registers their injected endpoints.
import '@/features/accounts/accountsApi';
import '@/features/transactions/transactionsApi';
import '@/features/requests/requestsApi';
import '@/features/loans/loansApi';
import '@/features/customers/customersApi';
import '@/features/notifications/notificationsApi';
import '@/features/dashboard/dashboardApi';
import '@/features/settings/settingsApi';
import '@/features/settings/profileApi';

export const makeStore = () =>
  configureStore({
    reducer: { auth, accounts, transactions, loans, ui, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (gdm) => gdm().concat(baseApi.middleware),
  });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
