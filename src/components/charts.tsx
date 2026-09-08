import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  AreaChart,
  Area,
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const C_GREEN = '#CDFF00';
export const C_GREEN_DARK = '#77AA00';
export const C_RED = '#FF4444';
export const C_YELLOW = '#FFB800';
export const C_BLUE = '#4488FF';
export const C_ORANGE = '#FF8C00';

export const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export const formatCompact = (val: number) => {
  const abs = Math.abs(val || 0);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1000000) {
    return `${sign}R$${(abs / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1000) {
    return `${sign}R$${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`;
  }
  return `${sign}R$${abs.toLocaleString('pt-BR')}`;
};

export function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(() => target);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      setValue(target);
      return;
    }
    startedRef.current = true;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  color = C_GREEN,
  delta,
  deltaTone = 'neutral',
  formatter = formatCurrency,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  color?: string;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'neutral';
  formatter?: (v: number) => string;
}) {
  const animated = useCountUp(value, 800);
  const deltaIcon = deltaTone === 'up' ? TrendingUp : deltaTone === 'down' ? TrendingDown : Minus;
  return (
    <div className="group relative overflow-hidden bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl p-4 md:p-5 shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:border-[#CDFF00]/60 hover:scale-[1.02] transition-all duration-150">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/60 leading-snug">{label}</span>
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <Icon size={16} strokeWidth={2.5} />
        </span>
      </div>
      <p className="mt-3 text-2xl md:text-3xl font-black text-white tracking-tight leading-none tabular-nums">
        {formatter(Math.round(animated))}
      </p>
      {delta && (
        <p
          className="mt-2 flex items-center gap-1 text-[11px] font-bold"
          style={{ color: deltaTone === 'up' ? C_GREEN : deltaTone === 'down' ? C_RED : 'rgba(255,255,255,0.4)' }}
        >
          <deltaIcon size={12} strokeWidth={2.5} />
          {delta}
        </p>
      )}
      <div
        className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full opacity-[0.06] pointer-events-none transition-all duration-300 group-hover:opacity-[0.14]"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

export function ChartCard({
  title,
  icon: Icon,
  action,
  children,
  className = '',
}: {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl p-4 md:p-5 shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:border-[#CDFF00]/40 transition-all duration-150 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="w-8 h-8 rounded-lg bg-[#2d2d2d] flex items-center justify-center shrink-0">
              <Icon size={15} className="text-[#CDFF00]" />
            </span>
          )}
          <h3 className="text-xs font-black uppercase tracking-widest text-white/70">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ChartTooltipContent({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#2d2d2d] border border-[rgba(205,255,0,0.35)] rounded-lg px-3.5 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
      {label !== undefined && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color || p.fill }} />
            <span className="text-white/70">{p.name}:</span>
            <span className="font-bold text-white tabular-nums">
              {formatter ? formatter(p.value, p) : formatCurrency(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LegendProgress({
  data,
  total,
}: {
  data: { name: string; value: number; color: string }[];
  total: number;
}) {
  if (!data.length) return null;
  return (
    <div className="space-y-2.5 mt-4">
      {data.map(d => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        return (
          <div key={d.name}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] text-white/70 font-medium truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="truncate">{d.name}</span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-bold text-white tabular-nums">{formatCurrency(d.value)}</span>
                <span className="text-[10px] text-white/40 tabular-nums w-9 text-right">
                  {pct > 0 ? `${pct.toFixed(0)}%` : '0%'}
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#2d2d2d] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct > 0 ? Math.max(pct, 3) : 0}%`,
                  backgroundColor: d.color,
                  boxShadow: pct > 0 ? `0 0 8px ${d.color}55` : 'none',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({
  data,
  centerTop,
  centerBottom,
  height = 230,
}: {
  data: { name: string; value: number; color: string }[];
  centerTop?: ReactNode;
  centerBottom?: string;
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const isEmpty = data.length === 0;
  const chartData = isEmpty ? [{ name: 'Sem dados', value: 1, color: '#333' }] : data;
  return (
    <div>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="68%"
              outerRadius="92%"
              paddingAngle={3}
              cornerRadius={6}
              stroke="#1a1a1a"
              strokeWidth={3}
              startAngle={90}
              endAngle={-270}
              isAnimationActive
              animationDuration={600}
              animationEasing="ease-out"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip cursor={false} content={<ChartTooltipContent />} />
          </PieChart>
        </ResponsiveContainer>
        {!isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-xl md:text-2xl font-black text-white leading-none tracking-tight tabular-nums">
                {centerTop}
              </div>
              {centerBottom && (
                <div className="text-[9px] uppercase tracking-widest text-white/50 mt-1">{centerBottom}</div>
              )}
            </div>
          </div>
        )}
      </div>
      <LegendProgress data={isEmpty ? [] : data} total={total} />
    </div>
  );
}

export function MonthlyBarChart({
  data,
  series,
  height = 280,
  highlightIndex,
  compact = formatCompact,
}: {
  data: Record<string, any>[];
  series: { key: string; label: string; color: string; gradientId: string; start: string; end: string }[];
  height?: number;
  highlightIndex?: number;
  compact?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 28, right: 8, left: -6, bottom: 0 }} barGap={4} barCategoryGap="22%">
        <defs>
          {series.map(s => (
            <linearGradient key={s.gradientId} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.start} stopOpacity={1} />
              <stop offset="100%" stopColor={s.end} stopOpacity={0.6} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 11 }} axisLine={{ stroke: '#333' }} tickLine={false} dy={6} />
        <YAxis
          tick={{ fill: '#777', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v: number) => compact(v)}
        />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltipContent />} />
        {series.map(s => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={`url(#${s.gradientId})`}
            radius={[5, 5, 0, 0]}
            maxBarSize={38}
            isAnimationActive
            animationDuration={500}
            animationEasing="ease-out"
          >
            {data.map((entry, i) => {
              const isCurrent = highlightIndex !== undefined && i === highlightIndex;
              return <Cell key={i} fillOpacity={isCurrent ? 1 : 0.45} />;
            })}
            <LabelList
              dataKey={s.key}
              position="top"
              formatter={(v: number) => (v > 0 ? compact(v) : '')}
              style={{ fill: s.color, fontSize: 10, fontWeight: 800 }}
              offset={6}
            />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyAreaChart({
  data,
  height = 280,
}: {
  data: { name: string; Receitas: number; Despesas: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="areaReceitas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CDFF00" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#CDFF00" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="areaDespesas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF4444" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#FF4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 11 }} axisLine={{ stroke: '#333' }} tickLine={false} dy={6} />
        <YAxis tick={{ fill: '#777', fontSize: 10 }} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => formatCompact(v)} />
        <Tooltip cursor={{ stroke: 'rgba(205,255,0,0.3)', strokeDasharray: '3 3' }} content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="Receitas"
          name="Receitas"
          stroke="#CDFF00"
          strokeWidth={2.5}
          fill="url(#areaReceitas)"
          isAnimationActive
          animationDuration={500}
          animationEasing="ease-out"
          dot={{ fill: '#CDFF00', r: 2.5, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#CDFF00', stroke: '#0a0a0a', strokeWidth: 2 }}
        />
        <Area
          type="monotone"
          dataKey="Despesas"
          name="Despesas"
          stroke="#FF4444"
          strokeWidth={2.5}
          fill="url(#areaDespesas)"
          isAnimationActive
          animationDuration={500}
          animationEasing="ease-out"
          dot={{ fill: '#FF4444', r: 2.5, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#FF4444', stroke: '#0a0a0a', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}