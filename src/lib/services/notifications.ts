import { eq } from 'drizzle-orm';
import type { DB, Tx } from '@/db';
import { notifications, users } from '@/db/schema';

type Client = DB | Tx;
export async function notify(c: Client, userId: string, n: { title: string; body: string; kind: string; link?: string }) {
  await c.insert(notifications).values({ userId, title: n.title, body: n.body, kind: n.kind, link: n.link ?? null });
}
export async function notifyAdmins(c: Client, n: { title: string; body: string; kind: string; link?: string }) {
  const admins = await c.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN'));
  if (admins.length) await c.insert(notifications).values(admins.map((a) => ({ userId: a.id, title: n.title, body: n.body, kind: n.kind, link: n.link ?? null })));
}
