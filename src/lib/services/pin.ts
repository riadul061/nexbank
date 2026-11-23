import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { ApiError, badRequest } from '@/lib/errors';

const MAX_ATTEMPTS = 3;
const LOCK_MINUTES = 15;

/**
 * Verifies the transaction PIN. Runs OUTSIDE the money transaction on purpose, so a failed
 * attempt is persisted (and eventually locks the PIN) instead of being rolled back.
 */
export async function verifyPin(userId: string, pin: string) {
  const [u] = await db.select({ pinHash: users.pinHash, attempts: users.pinAttempts, lockedUntil: users.pinLockedUntil }).from(users).where(eq(users.id, userId));
  if (!u?.pinHash) throw new ApiError(400, 'You have not set a transaction PIN yet. Set one in Profile & Security.', 'PIN_NOT_SET');
  if (u.lockedUntil && u.lockedUntil > new Date()) {
    throw new ApiError(423, `PIN locked after too many failed attempts. Try again after ${u.lockedUntil.toLocaleTimeString()}.`, 'PIN_LOCKED');
  }
  const ok = await bcrypt.compare(pin, u.pinHash);
  if (!ok) {
    const attempts = u.attempts + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    await db.update(users).set({ pinAttempts: locked ? 0 : attempts, pinLockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null }).where(eq(users.id, userId));
    throw new ApiError(401, locked ? `Incorrect PIN. PIN locked for ${LOCK_MINUTES} minutes.` : `Incorrect PIN. ${MAX_ATTEMPTS - attempts} attempt(s) left.`, 'PIN_INVALID');
  }
  if (u.attempts) await db.update(users).set({ pinAttempts: 0, pinLockedUntil: null }).where(eq(users.id, userId));
}

export async function setPin(userId: string, pin: string, currentPin?: string) {
  if (!/^\d{4,6}$/.test(pin)) throw badRequest('PIN must be 4 to 6 digits');
  const [u] = await db.select({ pinHash: users.pinHash }).from(users).where(eq(users.id, userId));
  if (u?.pinHash) {
    if (!currentPin) throw badRequest('Current PIN is required to change your PIN');
    await verifyPin(userId, currentPin);
  }
  await db.update(users).set({ pinHash: await bcrypt.hash(pin, 10), pinAttempts: 0, pinLockedUntil: null }).where(eq(users.id, userId));
}
