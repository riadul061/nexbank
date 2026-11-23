import { z } from 'zod';
import { query, route } from '@/lib/api';
import { getAccountFor } from '@/lib/services/accounts';
import { buildStatement, statementCsv, statementPdf } from '@/lib/services/documents';
export const GET = route<{ id: string }>('any', async ({ req, user, params }) => {
  const q = query(req, z.object({ format: z.enum(['csv', 'pdf']).default('csv'), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }));
  const acc = await getAccountFor(user, params.id); // ownership check for customers
  const s = await buildStatement(acc.id, q.from, q.to);
  const name = `statement-${acc.accountNumber}`;
  if (q.format === 'csv') return new Response(statementCsv(s), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"` } });
  const pdf = await statementPdf(s, `${q.from ?? 'start'} – ${q.to ?? 'today'}`);
  return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}.pdf"` } });
});
