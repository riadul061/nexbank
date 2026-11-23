import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { body, route } from '@/lib/api';
import { setPin } from '@/lib/services/pin';

export const GET = route('any', async ({ user }) => {
  const [u] = await db.select().from(users).where(eq(users.id, user.id));
  return { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, address: u.address, verified: u.verified, hasPin: !!u.pinHash, createdAt: u.createdAt };
});
export const PATCH = route(['CUSTOMER'], async ({ req, user }) => {
  const b = await body(req, z.object({ pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits'), currentPin: z.string().optional() }));
  await setPin(user.id, b.pin, b.currentPin);
  return { ok: true };
});
