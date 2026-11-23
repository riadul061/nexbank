'use client';
import { useAppSelector } from '@/store/store';
import type { Role } from '@/types';
/** Role from the Redux auth slice (synced from the NextAuth session). UI hint only — the server enforces permissions. */
export const useRole = (): Role | null => useAppSelector((s) => s.auth.user?.role ?? null);
