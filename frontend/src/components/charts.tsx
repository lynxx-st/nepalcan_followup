import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, AreaChart, Area, CartesianGrid } from 'recharts';

export const CHART_COLORS = {
  ink: '#0a0a0a',
  mid: '#737373',
  hairline: '#e5e5e5',
  canvas: '#f5f5f5',
  emerald: '#059669',
  amber: '#d97706',
  ember: '#e7000b',
  muted: '#a3a3a3',
};

const axisTick = { fontSize: 10, fill: CHART_COLORS.mid };
const tooltipStyle = {
  fontSize: 11,
  borderRadius: 10,
  border: `1px solid ${CHART_COLORS.hairline}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
};

export function Donut({
  data,
  label,
  height = 220,
  colors = [CHART_COLORS.ink, CHART_COLORS.mid, CHART_COLORS.hairline],
  formatter,
}: {
  data: { name: string; value: number }[];
  label: string;
  height?: number;
  colors?: string[];
  formatter?: (value: number, name: string) => string;
}) {
  return (
    <div role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={formatter as any} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBars({
  data,
  xKey = 'name',
  yKey = 'value',
  color = CHART_COLORS.ink,
  label,
  height = 240,
  formatter,
}: {
  data: Record<string, any>[];
  xKey?: string;
  yKey?: string;
  color?: string;
  label: string;
  height?: number;
  formatter?: (value: any, name: any) => string;
}) {
  return (
    <div role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4 }}>
          <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey={xKey} tick={axisTick} axisLine={false} tickLine={false} width={96} />
          <Tooltip contentStyle={tooltipStyle} formatter={formatter as any} />
          <Bar dataKey={yKey} fill={color} radius={[0, 6, 6, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VBars({
  data,
  xKey = 'name',
  yKey = 'value',
  color = CHART_COLORS.ink,
  label,
  height = 240,
  formatter,
}: {
  data: Record<string, any>[];
  xKey?: string;
  yKey?: string;
  color?: string;
  label: string;
  height?: number;
  formatter?: (value: any, name: any) => string;
}) {
  return (
    <div role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <XAxis dataKey={xKey} tick={axisTick} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={formatter as any} />
          <Bar dataKey={yKey} fill={color} radius={[6, 6, 0, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendArea({
  data,
  series,
  label,
  height = 240,
  formatter,
}: {
  data: Record<string, any>[];
  series: { key: string; name: string; color: string }[];
  label: string;
  height?: number;
  formatter?: (value: any, name: any) => string;
}) {
  return (
    <div role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={CHART_COLORS.hairline} vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={formatter as any} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#grad-${s.key})`} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
