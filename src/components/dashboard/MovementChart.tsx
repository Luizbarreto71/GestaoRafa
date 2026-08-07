import { useTheme } from '@/contexts/ThemeContext';
import { formatCompactCurrency, formatCurrency } from '@/lib/format';
import type { DashboardData } from '@/types';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ChartPoint = DashboardData['chart'][number];

const COLORS = {
  revenue: '#16A34A',
  entries: '#2563EB',
  exits: '#F59E0B',
};

const shortDate = (iso: string) => {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
};

interface TooltipPayload {
  color?: string;
  name?: string;
  dataKey?: string | number;
  value?: number;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-card-hover dark:border-navy-600 dark:bg-navy-800">
      <p className="mb-1 text-xs font-bold text-navy-900 dark:text-slate-100">
        {label ? shortDate(label) : ''}
      </p>
      {payload.map((item) => (
        <p key={String(item.dataKey)} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-slate-500 dark:text-slate-400">{item.name}:</span>
          <span className="font-semibold text-navy-900 dark:text-slate-100">
            {item.dataKey === 'faturamento' ? formatCurrency(item.value ?? 0) : item.value}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Gráfico de faturamento (área) + entradas/saídas (barras). */
export function MovementChart({ data, mode }: { data: ChartPoint[]; mode: 'revenue' | 'flow' }) {
  const { theme } = useTheme();
  const grid = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const axis = theme === 'dark' ? '#64748B' : '#94A3B8';

  if (mode === 'revenue') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.revenue} stopOpacity={0.28} />
              <stop offset="100%" stopColor={COLORS.revenue} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: axis }} tickLine={false} axisLine={{ stroke: grid }} />
          <YAxis
            tickFormatter={(value: number) => formatCompactCurrency(value)}
            tick={{ fontSize: 11, fill: axis }}
            tickLine={false}
            axisLine={false}
            width={70}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="faturamento"
            name="Faturamento"
            stroke={COLORS.revenue}
            strokeWidth={2.5}
            fill="url(#revenueFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: axis }} tickLine={false} axisLine={{ stroke: grid }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: axis }} tickLine={false} axisLine={false} width={36} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: theme === 'dark' ? '#1E293B60' : '#F1F5F9' }} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value: string) => <span className="text-slate-500 dark:text-slate-400">{value}</span>}
        />
        <Bar dataKey="entradas" name="Entradas" fill={COLORS.entries} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="saidas" name="Saídas" fill={COLORS.exits} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
