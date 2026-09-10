import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../../contexts/FinanceContext';
import {
  ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Clock, DollarSign, BarChart2, PieChart as PieIcon, Receipt, Wallet,
} from 'lucide-react';
import { eventTypeLabel } from '../../lib/eventTypeLabel';
import {
  C_GREEN, C_GREEN_DARK, C_RED, C_YELLOW, C_BLUE, C_ORANGE,
  formatCurrency, KpiCard, ChartCard, DonutChart, MonthlyBarChart, MonthlyAreaChart,
} from '../../components/charts';

const CATEGORY_COLORS = [
  '#CDFF00',
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

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const pctChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? '100%' : '0%';
  const diff = ((current - previous) / Math.abs(previous)) * 100;
  return `${Math.abs(diff).toFixed(0)}%`;
};

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

  const prevRange = useMemo(() => ({
    start: new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1),
    end: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 0, 23, 59, 59),
  }), [selectedDate]);

  const goPrevMonth = () => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goNextMonth = () => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const periodTransactions = useMemo(
    () => (transactions || []).filter(
      t => t.status !== 'Cancelado' && isInRange(t.date, dateRange.start, dateRange.end)
    ),
    [transactions, dateRange]
  );

  const prevTransactions = useMemo(
    () => (transactions || []).filter(
      t => t.status !== 'Cancelado' && isInRange(t.date, prevRange.start, prevRange.end)
    ),
    [transactions, prevRange]
  );

  const computeMetrics = useMemo(() => (list: typeof periodTransactions) => {
    const receitas = list.filter(t => t.type === 'receita');
    const despesas = list.filter(t => t.type === 'despesa');

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
  }, []);

  const metrics = useMemo(() => computeMetrics(periodTransactions), [computeMetrics, periodTransactions]);
  const prevMetrics = useMemo(() => computeMetrics(prevTransactions), [computeMetrics, prevTransactions]);

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
      const key = eventTypeLabel(raw);
      grouped[key] = (grouped[key] || 0) + (t.amount || 0);
    });
    return Object.entries(grouped)
      .map(([name, value], i) => ({
        name,
        value,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [periodTransactions]);

  const totalFaturado = useMemo(
    () => chart3Data.reduce((s, d) => s + d.value, 0),
    [chart3Data]
  );

  const totalDespesasPagas = metrics.despesasFixasPagas + metrics.despesasVariaveisPagas;

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
    <div className="min-h-screen bg-black p-4 md:p-6 pb-bottom-nav md:pb-6 space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => navigate('/financeiro')}
          className="p-2 rounded-lg bg-[#1a1a1a] border border-[#2d2d2d] text-neutral-400 hover:text-white hover:border-[#CDFF00] transition-colors"
          title="Voltar ao Financeiro"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-2xl md:text-[32px] font-black text-white tracking-[0.5px]">
            <BarChart2 className="text-[#CDFF00]" size={28} />
            Dashboard Financeiro
          </h1>
          <p className="text-sm font-medium text-white/70">Visão geral do período</p>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 sm:gap-4 bg-[#1a1a1a] border border-[#2d2d2d] rounded-full px-3 sm:px-5 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
          <button
            onClick={goPrevMonth}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-[#222] transition-colors min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs sm:text-sm font-black text-white tracking-wide min-w-0 text-center">
            {MONTHS_PT[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </span>
          <button
            onClick={goNextMonth}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-[#222] transition-colors min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Wallet}
          label="Saldo do Período"
          value={metrics.saldo}
          color={metrics.saldo >= 0 ? C_GREEN : C_RED}
          delta={`${pctChange(metrics.saldo, prevMetrics.saldo)} vs mês anterior`}
          deltaTone={metrics.saldo >= prevMetrics.saldo ? 'up' : 'down'}
        />
        <KpiCard
          icon={TrendingUp}
          label="Total Recebido"
          value={metrics.receitasPagas}
          color={C_GREEN}
          delta={`${pctChange(metrics.receitasPagas, prevMetrics.receitasPagas)} vs mês anterior`}
          deltaTone={metrics.receitasPagas >= prevMetrics.receitasPagas ? 'up' : 'down'}
        />
        <KpiCard
          icon={TrendingDown}
          label="Total Gasto"
          value={metrics.despesasPagas}
          color={C_RED}
          delta={`${pctChange(metrics.despesasPagas, prevMetrics.despesasPagas)} vs mês anterior`}
          deltaTone={metrics.despesasPagas <= prevMetrics.despesasPagas ? 'up' : 'down'}
        />
        <KpiCard
          icon={Clock}
          label="Pendências"
          value={pendenciaTotal}
          color={C_YELLOW}
          delta={`${pctChange(pendenciaTotal, prevMetrics.totalPendente)} vs mês anterior`}
          deltaTone={pendenciaTotal <= prevMetrics.totalPendente ? 'up' : 'down'}
        />
      </div>

      {!hasChartData ? (
        <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl p-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
          <DollarSign size={32} className="mx-auto mb-3 text-neutral-600" />
          <p className="text-sm text-neutral-500 font-medium">Nenhum dado no período</p>
          <p className="text-[10px] text-neutral-600 mt-1">Tente selecionar outro período ou cadastre receitas e despesas</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChartCard title="Receitas vs Despesas" icon={PieIcon}>
              {chart1Data.length === 0 ? (
                <div className="flex items-center justify-center h-[230px] text-neutral-500 text-xs italic">
                  Nenhum dado no período
                </div>
              ) : (
                <DonutChart
                  data={chart1Data}
                  centerTop={formatCurrency(metrics.saldo)}
                  centerBottom="Saldo Líquido"
                />
              )}
            </ChartCard>

            <ChartCard title="Fixas vs Variáveis" icon={Receipt}>
              {chart2Data.length === 0 ? (
                <div className="flex items-center justify-center h-[230px] text-neutral-500 text-xs italic">
                  Nenhum dado no período
                </div>
              ) : (
                <DonutChart
                  data={chart2Data}
                  centerTop={formatCurrency(totalDespesasPagas)}
                  centerBottom="Total Despesas"
                />
              )}
              {metrics.topDespesas.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#222]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2">Top 5 Despesas</p>
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
            </ChartCard>

            <ChartCard title="Top Categorias de Receitas" icon={Wallet}>
              {chart3Data.length === 0 ? (
                <div className="flex items-center justify-center h-[230px] text-neutral-500 text-xs italic">
                  Nenhum dado no período
                </div>
              ) : (
                <DonutChart
                  data={chart3Data}
                  centerTop={formatCurrency(totalFaturado)}
                  centerBottom="Total Faturado"
                />
              )}
            </ChartCard>
          </div>

          <ChartCard
            title="Evolução Mensal"
            icon={BarChart2}
            action={
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#CDFF00] hidden sm:inline">
                Últimos 6 meses
              </span>
            }
          >
            <MonthlyBarChart data={monthlyData} highlightIndex={5} series={[
              { key: 'Receitas', label: 'Receitas', color: C_GREEN, gradientId: 'gradReceitas', start: '#E6FF66', end: C_GREEN_DARK },
              { key: 'Despesas', label: 'Despesas', color: C_RED, gradientId: 'gradDespesas', start: '#FF6B6B', end: '#A02626' },
            ]} />
          </ChartCard>

          <ChartCard title="Receitas vs Despesas — Comparativo" icon={TrendingUp}>
            <MonthlyAreaChart data={monthlyData} />
          </ChartCard>
        </>
      )}
    </div>
  );
}