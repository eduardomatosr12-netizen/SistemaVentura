/**
 * Shared number formatters for chart/KPI surfaces.
 *
 * These live outside `components/charts.tsx` so that file only exports React
 * components (react-refresh requires that for correct HMR).
 */

export const formatCompact = (val: number): string => {
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
