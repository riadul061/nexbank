import { db, type DB, type Tx } from '@/db';
import { settings } from '@/db/schema';
import type { BankSettings } from '@/types';

export const DEFAULT_SETTINGS: BankSettings = {
  dailyTransferLimit: 25000, maxSingleTransaction: 10000, minAccountBalance: 0, transferFeePercent: 0.25, suspiciousAmount: 5000,
};

export async function getSettings(client: DB | Tx = db): Promise<BankSettings> {
  const rows = await client.select().from(settings);
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in out) (out as Record<string, number>)[r.key] = Number(r.value);
  return out;
}

export async function saveSettings(patch: Partial<BankSettings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS) || value == null) continue;
    await db.insert(settings).values({ key, value: String(value) }).onConflictDoUpdate({ target: settings.key, set: { value: String(value) } });
  }
  return getSettings();
}
