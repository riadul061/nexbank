import { and, count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { body, route } from '@/lib/api';
export const GET = route('any', async ({ user }) => {
  const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(50);
  const [{ c }] = await db.select({ c: count() }).from(notifications).where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
  return { unread: c, items: rows.map((n) => ({ id: n.id, title: n.title, body: n.body, kind: n.kind, link: n.link, read: n.read, createdAt: n.createdAt })) };
});
export const PATCH = route('any', async ({ req, user }) => {
  const b = await body(req, z.object({ id: z.string().optional() }));
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.userId, user.id), b.id ? eq(notifications.id, b.id) : undefined));
  return { ok: true };
});
