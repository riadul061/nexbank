import { z } from 'zod';
import { body, route } from '@/lib/api';
import { getSettings, saveSettings } from '@/lib/services/settings';
export const GET = route('any', async () => getSettings());
export const PUT = route(['ADMIN'], async ({ req }) => {
  const n = z.coerce.number().min(0).max(100_000_000);
  const b = await body(req, z.object({ dailyTransferLimit: n, maxSingleTransaction: n, minAccountBalance: n, transferFeePercent: z.coerce.number().min(0).max(10), suspiciousAmount: n }));
  return saveSettings(b);
});
