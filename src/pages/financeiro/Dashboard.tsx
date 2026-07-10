import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../../contexts/FinanceContext';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Clock, DollarSign,
} from 'lucide-react';
const C_GREEN = '#B5FF03';
const C_GREEN_DARK = '#77AA00';
const C_RED = '#FF4444';
const C_YELLOW = '#FFB800';
const C_BLUE = '#4488FF';
const C_ORANGE = '#FF8C00';

const CATEGORY_COLORS = [
  '#B5FF03',
  '#4488FF',
  '#FF8C00',
  '#FF4444',
  '#A855F7',
  '#06B6D4',
  '#F59E0B',
  '#EC4899',
  '#10B981',
  '#8B5CF6',
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  Aniver: 'Aniversário',
  Casam: 'Casamento',
};

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

function DonutCenter({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center">
        <p className="text-xl md:text-2xl font-black text-white leading-none mb-1">{top}</p>
        <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{bottom}</p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, icon: Icon }: {
  label: string; value: number; color: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">{label}</span>
        <Icon size={14} style={{ color }} />
      </div>
      <p className="text-xl md:text-2xl font-black text-white">{formatCurrency(value)}</p>
    </div>
  );
}

function LegendRow({ color, name, value, total }: {
  color: string; name: string; value: number; total: number;
}) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-neutral-400">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-white font-bold">{formatCurrency(value)}</span>
        <span className="text-neutral-500 text-[10px] w-10 text-right">{pct}%</span>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[260px] text-neutral-500 text-xs italic">
      Nenhum dado no período
    </div>
  );
}

function PieTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-[#111] border border-[#333] rounded-lg p-3 shadow-xl">
      <p className="text-xs font-bold" style={{ color: d.payload?.color || d.color }}>{d.name}</p>
      <p className="text-sm text-white font-black">{formatCurrency(d.value)}</p>
    </div>
  );
}

function BarTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-[#333] rounded-lg p-3 shadow-xl">
      <p className="text-xs text-neutral-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

function DonutChart({ data, centerTop, centerBottom }: {
  data: { name: string; value: number; color: string }[];
  centerTop: string;
  centerBottom: string;
}) {
  const chartData = data.length > 0 ? data : [{ name: 'Sem dados', value: 1, color: '#333' }];
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={95}
            dataKey="value"
            stroke="none"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltipContent />} />
        </PieChart>
      </ResponsiveContainer>
      <DonutCenter top={centerTop} bottom={centerBottom} />
    </div>
  );
}

export default function DashboardFinanceiro() {
  const navigate = useNavigate();
  const { transactions } = useFinance();

  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const isInRange = (dateStr: string, start: Date, end: Date) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d >= start && d <= end;
    } catch { return false; }
  };

  const dateRange = useMemo(() => ({
    start: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    end: new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59),
  }), [selectedDate]);

  const goPrevMonth = () => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goNextMonth = () => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const periodTransactions = useMemo(
    () => (transactions || []).filter(
      t => t.status !== 'Cancelado' && isInRange(t.date, dateRange.start, dateRange.end)
    ),
    [transactions, dateRange]
  );

  const metrics = useMemo(() => {
    const receitas = periodTransactions.filter(t => t.type === 'receita');
    const despesas = periodTransactions.filter(t => t.type === 'despesa');

    const receitasPagas = receitas
      .filter(t => t.status === 'Pago')
      .reduce((s, t) => s + (t.amount || 0), 0);
    const receitasPendentes = receitas
      .filter(t => t.status === 'Pendente' || t.status === 'Vencida')
      .reduce((s, t) => s + (t.amount || 0), 0);
    const despesasPagas = despesas
      .filter(t => t.status === 'Pago')
      .reduce((s, t) => s + (t.amount || 0), 0);
    const despesasPendentes = despesas
      .filter(t => t.status === 'Pendente' || t.status === 'Vencida')
      .reduce((s, t) => s + (t.amount || 0), 0);
    const despesasFixasPagas = despesas
      .filter(t => t.expenseType === 'fixa' && t.status === 'Pago')
      .reduce((s, t) => s + (t.amount || 0), 0);
    const despesasVariaveisPagas = despesas
      .filter(t => (t.expenseType || 'variavel') === 'variavel' && t.status === 'Pago')
      .reduce((s, t) => s + (t.amount || 0), 0);

    const saldo = receitasPagas - despesasPagas;
    const totalPago = receitasPagas + despesasPagas;
    const totalPendente = receitasPendentes + despesasPendentes;
    const pagoPercent = totalPago + totalPendente > 0
      ? Math.round((totalPago / (totalPago + totalPendente)) * 100)
      : 0;
    const totalReceitas = receitasPagas + receitasPendentes;
    const totalDespesas = despesasPagas + despesasPendentes;
    const saldoProjetado = totalReceitas - totalDespesas;

    const topDespesas = [...despesas]
      .filter(t => t.status === 'Pago')
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 5);

    return {
      receitasPagas, receitasPendentes,
      despesasPagas, despesasPendentes,
      despesasFixasPagas, despesasVariaveisPagas,
      saldo, totalPago, totalPendente, pagoPercent,
      totalReceitas, totalDespesas, saldoProjetado,
      topDespesas,
    };
  }, [periodTransactions]);

  const totalGeral = metrics.receitasPagas + metrics.receitasPendentes
    + metrics.despesasPagas + metrics.despesasPendentes;

  const chart1Data = useMemo(() => [
    { name: 'Receitas Pagas', value: metrics.receitasPagas, color: C_GREEN_DARK },
    { name: 'Despesas Pagas', value: metrics.despesasPagas, color: C_RED },
    { name: 'Pendências', value: metrics.receitasPendentes + metrics.despesasPendentes, color: C_YELLOW },
  ].filter(d => d.value > 0), [metrics]);

  const chart2Data = useMemo(() => [
    { name: 'Despesas Fixas', value: metrics.despesasFixasPagas, color: C_BLUE },
    { name: 'Despesas Variáveis', value: metrics.despesasVariaveisPagas, color: C_ORANGE },
  ].filter(d => d.value > 0), [metrics]);

  const chart3Data = useMemo(() => {
    const receitas = periodTransactions.filter(
      t => t.type === 'receita' && (t.status === 'Pago' || t.status === 'Pendente')
    );
    const grouped: Record<string, number> = {};
    receitas.forEach(t => {
      const raw = t.eventType || t.category || 'Outros';
      const key = EVENT_TYPE_LABELS[raw] || raw;
      grouped[key] = (grouped[key] || 0) + (t.amount || 0);
    });
    return Object.entries(grouped)
      .map(([name, value], i) => ({
        name,
        value,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [periodTransactions]);

  const totalFaturado = useMemo(
    () => chart3Data.reduce((s, d) => s + d.value, 0),
    [chart3Data]
  );

  const monthlyData = useMemo(() => {
    const result: { name: string; Receitas: number; Despesas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - i, 1);
      const monthStr = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      const label = MONTHS_SHORT[m.getMonth()];
      const filtered = (transactions || []).filter(
        t => t.status !== 'Cancelado' && t.date.startsWith(monthStr)
      );
      result.push({
        name: label,
        Receitas: filtered
          .filter(t => t.type === 'receita' && t.status === 'Pago')
          .reduce((s, t) => s + (t.amount || 0), 0),
        Despesas: filtered
          .filter(t => t.type === 'despesa' && t.status === 'Pago')
          .reduce((s, t) => s + (t.amount || 0), 0),
      });
    }
    return result;
  }, [transactions, selectedDate]);

  const hasChartData = chart1Data.length > 0 || chart2Data.length > 0 || chart3Data.length > 0;
  const pendenciaTotal = metrics.receitasPendentes + metrics.despesasPendentes;

  return (
    <div className="min-h-screen bg-black p-4 md:p-6 pb-20 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/financeiro')}
          className="p-2 rounded-lg bg-[#111] border border-[#222] text-neutral-400 hover:text-white hover:border-[#B5FF03] transition-colors"
          title="Voltar ao Financeiro"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">DASHBOARD FINANCEIRO</h1>
          <p className="text-sm text-neutral-400 font-medium">Visão geral do período</p>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex items-center gap-4 bg-[#111] border border-[#222] rounded-full px-5 py-2">
          <button
            onClick={goPrevMonth}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-[#222] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-black text-white tracking-wide min-w-[140px] text-center">
            {MONTHS_PT[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </span>
          <button
            onClick={goNextMonth}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-[#222] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Saldo do Período"
          value={metrics.saldo}
          color={metrics.saldo >= 0 ? C_GREEN : C_RED}
          icon={DollarSign}
        />
        <SummaryCard
          label="Total Recebido"
          value={metrics.receitasPagas}
          color={C_GREEN}
          icon={TrendingUp}
        />
        <SummaryCard
          label="Total Gasto"
          value={metrics.despesasPagas}
          color={C_RED}
          icon={TrendingDown}
        />
        <SummaryCard
          label="Pendências"
          value={pendenciaTotal}
          color={C_YELLOW}
          icon={Clock}
        />
      </div>

      {!hasChartData ? (
        <div className="bg-[#111] border border-[#222] rounded-xl p-8 text-center">
          <DollarSign size={32} className="mx-auto mb-3 text-neutral-600" />
          <p className="text-sm text-neutral-500 font-medium">Nenhum dado no período</p>
          <p className="text-[10px] text-neutral-600 mt-1">Tente selecionar outro período ou cadastre receitas e despesas</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#111] border border-[#222] rounded-xl p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-2">Receitas vs Despesas</h3>
              {chart1Data.length === 0 ? (
                <EmptyChart />
              ) : (
                <>
                  <DonutChart
                    data={chart1Data}
                    centerTop={formatCurrency(metrics.saldo)}
                    centerBottom="Saldo Líquido"
                  />
                  <div className="space-y-1.5 mt-2">
                    {chart1Data.map(d => (
                      <LegendRow key={d.name} color={d.color} name={d.name} value={d.value} total={totalGeral} />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="bg-[#111] border border-[#222] rounded-xl p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-2">Fixas vs Variáveis</h3>
              {chart2Data.length === 0 ? (
                <EmptyChart />
              ) : (
                <>
                  <DonutChart
                    data={chart2Data}
                    centerTop={formatCurrency(metrics.despesasFixasPagas + metrics.despesasVariaveisPagas)}
                    centerBottom="Total Despesas"
                  />
                  <div className="space-y-1.5 mt-2">
                    {chart2Data.map(d => (
                      <LegendRow key={d.name} color={d.color} name={d.name} value={d.value} total={metrics.despesasFixasPagas + metrics.despesasVariaveisPagas} />
                    ))}
                  </div>
                  {metrics.topDespesas.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#222]">
                      <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-2">Top 5 Despesas</p>
                      <div className="space-y-1">
                        {metrics.topDespesas.map(d => (
                          <div key={d.id} className="flex justify-between text-xs">
                            <span className="text-neutral-400 truncate mr-2">{d.description}</span>
                            <span className="text-white font-bold shrink-0">{formatCurrency(d.amount || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="bg-[#111] border border-[#222] rounded-xl p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-2">Top Categorias de Receitas</h3>
              {chart3Data.length === 0 ? (
                <EmptyChart />
              ) : (
                <>
                  <DonutChart
                    data={chart3Data}
                    centerTop={formatCurrency(totalFaturado)}
                    centerBottom="Total Faturado"
                  />
                  <div className="space-y-1.5 mt-2">
                    {chart3Data.map(d => (
                      <LegendRow key={d.name} color={d.color} name={d.name} value={d.value} total={totalFaturado} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-4 md:p-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4">Evolução Mensal</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} barGap={4} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#888', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip content={<BarTooltipContent />} cursor={{ fill: '#1a1a1a' }} />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} iconType="circle" iconSize={8} />
                <Bar dataKey="Receitas" fill={C_GREEN} radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Despesas" fill={C_RED} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}