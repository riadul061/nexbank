import PDFDocument from 'pdfkit';
import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '@/db';
import { accounts, transactions, users } from '@/db/schema';
import { fromCents, toCents } from '@/lib/money';
import type { TxJoinRow } from './mappers';

const usd = (v: string | number) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const label = (s: string) => s.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');
const GREEN = '#0f5c4d';

function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export function receiptPdf(r: TxJoinRow, viewerName: string): Promise<Buffer> {
  const t = r.tx;
  const doc = new PDFDocument({ size: 'A5', margin: 40, info: { Title: `Receipt ${t.reference}`, Author: 'NexBank' } });
  doc.rect(0, 0, doc.page.width, 70).fill(GREEN);
  doc.fillColor('#fff').fontSize(20).font('Helvetica-Bold').text('NexBank', 40, 24);
  doc.fontSize(9).font('Helvetica').text('TRANSACTION RECEIPT', 40, 28, { align: 'right', width: doc.page.width - 80 });
  doc.fillColor('#111').moveDown(3);
  doc.fontSize(26).font('Helvetica-Bold').fillColor(GREEN).text(usd(t.amount), 40, 95);
  doc.fontSize(10).font('Helvetica').fillColor('#555').text(`${label(t.status)} · ${label(t.type)}`, 40, 128);
  const rows: [string, string][] = [
    ['Reference', t.reference], ['Date', (t.completedAt ?? t.createdAt).toUTCString()], ['Type', label(t.type)], ['Status', label(t.status)],
    ['From', r.sa ? `${r.so?.name ?? ''} · ${r.sa.accountNumber}` : 'NexBank'], ['To', r.ra ? `${r.ro?.name ?? ''} · ${r.ra.accountNumber}` : 'External / Cash'],
    ['Amount', usd(t.amount)], ['Fee', usd(t.fee)], ['Total', usd(fromCents(toCents(t.amount) + toCents(t.fee)))], ['Description', t.description || '—'],
  ];
  let y = 160;
  for (const [k, v] of rows) {
    doc.fontSize(9).font('Helvetica').fillColor('#777').text(k.toUpperCase(), 40, y, { width: 90 });
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111').text(v, 135, y - 1, { width: doc.page.width - 175 });
    y = Math.max(doc.y, y + 14) + 8;
    doc.moveTo(40, y - 5).lineTo(doc.page.width - 40, y - 5).strokeColor('#e5e5e0').lineWidth(0.5).stroke();
  }
  doc.fontSize(8).font('Helvetica').fillColor('#888').text(`Generated for ${viewerName} on ${new Date().toUTCString()}. This is a simulated banking receipt for demonstration purposes.`, 40, doc.page.height - 60, { width: doc.page.width - 80 });
  return toBuffer(doc);
}

export interface StatementEntry { date: Date; reference: string; type: string; description: string; debit: number; credit: number; fee: number; balance: number }

/** Builds the ledger for one account with a running balance, derived backwards from the authoritative current balance. */
export async function buildStatement(accountId: string, from?: string, to?: string) {
  const [acc] = await db.select({ a: accounts, owner: users.name }).from(accounts).innerJoin(users, eq(accounts.ownerId, users.id)).where(eq(accounts.id, accountId));
  const rows = await db.select().from(transactions)
    .where(and(eq(transactions.status, 'COMPLETED'), or(eq(transactions.senderAccountId, accountId), eq(transactions.receiverAccountId, accountId))))
    .orderBy(desc(transactions.completedAt), desc(transactions.createdAt));
  let bal = toCents(acc.a.balance);
  const all: StatementEntry[] = [];
  for (const t of rows) {
    const credit = t.receiverAccountId === accountId ? toCents(t.amount) : 0;
    const debit = t.senderAccountId === accountId ? toCents(t.amount) + toCents(t.fee) : 0;
    all.push({ date: t.completedAt ?? t.createdAt, reference: t.reference, type: label(t.type), description: t.description ?? '', debit: debit / 100, credit: credit / 100, fee: toCents(t.fee) / 100, balance: bal / 100 });
    bal = bal - credit + debit;
  }
  const f = from ? new Date(`${from}T00:00:00Z`) : null; const tt = to ? new Date(`${to}T23:59:59.999Z`) : null;
  const entries = all.filter((e) => (!f || e.date >= f) && (!tt || e.date <= tt)).reverse();
  return { account: acc.a, owner: acc.owner, entries, openingBalance: bal / 100 };
}

const csvCell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function statementCsv(s: Awaited<ReturnType<typeof buildStatement>>) {
  const lines = [
    ['NexBank statement'], ['Account', s.account.accountNumber], ['Holder', s.owner], [],
    ['Date', 'Reference', 'Type', 'Description', 'Debit', 'Credit', 'Fee included in debit', 'Balance'],
    ...s.entries.map((e) => [e.date.toISOString(), e.reference, e.type, e.description, e.debit.toFixed(2), e.credit.toFixed(2), e.fee.toFixed(2), e.balance.toFixed(2)]),
  ];
  return lines.map((l) => l.map(csvCell).join(',')).join('\n');
}

export function statementPdf(s: Awaited<ReturnType<typeof buildStatement>>, period: string) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Statement ${s.account.accountNumber}`, Author: 'NexBank' } });
  const W = doc.page.width - 80;
  const header = () => { doc.rect(0, 0, doc.page.width, 56).fill(GREEN); doc.fillColor('#fff').font('Helvetica-Bold').fontSize(18).text('NexBank', 40, 20); doc.font('Helvetica').fontSize(9).text('ACCOUNT STATEMENT', 40, 24, { align: 'right', width: W }); };
  header();
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(12).text(s.owner, 40, 76);
  doc.font('Helvetica').fontSize(9).fillColor('#555').text(`Account ${s.account.accountNumber} · ${label(s.account.type)} · ${period}`, 40, 94);
  doc.text(`Current balance ${usd(s.account.balance)}`, 40, 108);
  const cols = [40, 110, 200, 330, 400, 460, 520]; const head = ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'];
  let y = 140;
  const drawHead = () => { doc.rect(40, y - 4, W, 18).fill('#eef2ef'); doc.fillColor('#333').font('Helvetica-Bold').fontSize(8); head.forEach((h, i) => doc.text(h, cols[i] + 2, y, { width: cols[i + 1] - cols[i] - 4, align: i >= 3 ? 'right' : 'left' })); y += 20; };
  drawHead();
  doc.font('Helvetica').fontSize(8).fillColor('#111');
  for (const e of s.entries) {
    if (y > 780) { doc.addPage(); header(); y = 80; drawHead(); doc.font('Helvetica').fontSize(8).fillColor('#111'); }
    const vals = [e.date.toISOString().slice(0, 10), e.reference, e.description.slice(0, 34) || e.type, e.debit ? usd(e.debit) : '', e.credit ? usd(e.credit) : '', usd(e.balance)];
    vals.forEach((v, i) => doc.text(v, cols[i] + 2, y, { width: cols[i + 1] - cols[i] - 4, align: i >= 3 ? 'right' : 'left', lineBreak: false }));
    y += 15;
  }
  if (!s.entries.length) doc.text('No transactions in this period.', 40, y);
  return toBuffer(doc);
}
