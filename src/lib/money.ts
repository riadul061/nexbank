// Money is stored as NUMERIC(14,2) and exchanged with the DB as strings. All arithmetic that matters
// (balance updates, guards) happens in SQL; these helpers are for validation and display only.
export const toCents = (v: string | number): number => Math.round(Number(v) * 100);
export const fromCents = (c: number): string => (c / 100).toFixed(2);
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const num = (v: string | number | null | undefined): number => (v == null ? 0 : Number(v));
