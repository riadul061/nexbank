'use client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChartPoint } from '@/types';
import { money, moneyCompact } from '@/lib/utils';

export const PALETTE = ['#12957a', '#c9962e', '#3b6fb6', '#d0604d', '#7a5ea8', '#5c8a3a'];
const tick = { fill: 'rgb(var(--muted))', fontSize: 11 };
const H = 250;

type TipProps = { active?: boolean; payload?: readonly { name?: string | number; value?: unknown; color?: string }[]; label?: string | number };
function makeTip(fmt: (v: number, name: string) => string) {
  return function Tip({ active, payload, label }: TipProps) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
        {label != null && <div className="mb-1 font-semibold">{label}</div>}
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} /><span className="text-muted">{p.name}</span><span className="num ml-auto pl-3 font-medium">{fmt(Number(p.value), String(p.name))}</span></div>
        ))}
      </div>
    );
  };
}
const moneyTip = makeTip((v) => money(v));
const countTip = makeTip((v) => String(v));

export function VolumeArea({ data, keys, colors = PALETTE, currency = true }: { data: ChartPoint[]; keys: string[]; colors?: string[]; currency?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={H} minWidth={0}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>{keys.map((k, i) => <linearGradient key={k} id={`g${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors[i]} stopOpacity={0.35} /><stop offset="100%" stopColor={colors[i]} stopOpacity={0} /></linearGradient>)}</defs>
        <CartesianGrid vertical={false} stroke="rgb(var(--line))" />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
        <YAxis tick={tick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => (currency ? moneyCompact(v) : String(v))} />
        <Tooltip content={currency ? moneyTip : countTip} cursor={{ stroke: 'rgb(var(--line))' }} />
        {keys.map((k, i) => <Area key={k} type="monotone" dataKey={k} stroke={colors[i]} strokeWidth={2.5} fill={`url(#g${i})`} dot={false} activeDot={{ r: 4 }} />)}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function GroupedBars({ data, keys, colors = PALETTE, currency = true }: { data: ChartPoint[]; keys: string[]; colors?: string[]; currency?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={H} minWidth={0}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke="rgb(var(--line))" />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
        <YAxis tick={tick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => (currency ? moneyCompact(v) : String(v))} />
        <Tooltip content={currency ? moneyTip : countTip} cursor={{ fill: 'rgb(var(--ink) / 0.05)' }} />
        {keys.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'rgb(var(--muted))' }} />}
        {keys.map((k, i) => <Bar key={k} dataKey={k} fill={colors[i]} radius={[5, 5, 0, 0]} maxBarSize={32} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({ data, keys, colors = PALETTE }: { data: ChartPoint[]; keys: string[]; colors?: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={H} minWidth={0}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgb(var(--line))" />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
        <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={countTip} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'rgb(var(--muted))' }} />
        {keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={colors[i]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, valueKey = 'value', money: isMoney, colors = PALETTE, centerLabel }: { data: ChartPoint[]; valueKey?: string; money?: boolean; colors?: string[]; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + Number(d[valueKey] ?? 0), 0);
  if (!total) return <div className="flex h-[250px] items-center justify-center text-sm text-muted">No data yet</div>;
  const Tip = isMoney ? moneyTip : countTip;
  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={200} minWidth={0}>
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey="label" innerRadius={58} outerRadius={86} paddingAngle={3} stroke="none" cornerRadius={4}>
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip content={Tip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="num display text-xl font-semibold">{isMoney ? moneyCompact(total) : total}</span><span className="text-[11px] text-muted">{centerLabel}</span></div>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {data.map((d, i) => <li key={d.label as string} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i % colors.length] }} /><span className="text-muted">{d.label}</span><span className="num ml-auto font-medium">{isMoney ? moneyCompact(Number(d[valueKey])) : d[valueKey]}</span></li>)}
      </ul>
    </div>
  );
}
