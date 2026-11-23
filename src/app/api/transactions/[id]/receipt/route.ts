import { route } from '@/lib/api';
import { receiptPdf } from '@/lib/services/documents';
import { getTransactionFor } from '@/lib/services/transactions';
export const GET = route<{ id: string }>('any', async ({ user, params }) => {
  const { row } = await getTransactionFor(user, params.id);
  const pdf = await receiptPdf(row, user.name);
  return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="receipt-${row.tx.reference}.pdf"` } });
});
