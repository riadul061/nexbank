'use client';
import { useCallback, useState } from 'react';
import { useAppDispatch } from '@/store/store';
import { pushToast } from '@/features/ui/uiSlice';

/** Authenticated file download (CSV / PDF). Errors from the API surface as toasts instead of navigating to JSON. */
export function useDownload() {
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);
  const download = useCallback(async (url: string, fallbackName = 'download') => {
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Download failed');
      }
      const cd = res.headers.get('Content-Disposition') ?? '';
      const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      dispatch(pushToast('error', (e as Error).message));
    } finally { setBusy(false); }
  }, [dispatch]);
  return { download, busy };
}
