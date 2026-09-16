import { addDays, format, parseISO, startOfWeek, subWeeks } from 'date-fns';

const amount = (value) => Number(value || 0);

const median = (values = []) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const categoryKey = (tx) => String(tx.category_id || tx.categories?.name || 'uncategorized');

export function buildSpendingAnomalies(transactions = [], date = new Date(), historyWeeks = 6) {
  const currentWeekStart = startOfWeek(date, { weekStartsOn: 1 });
  const elapsedDays = Math.min(Math.max(Math.floor((date - currentWeekStart) / 86400000), 0), 6);
  const currentStart = format(currentWeekStart, 'yyyy-MM-dd');
  const currentEnd = format(addDays(currentWeekStart, elapsedDays), 'yyyy-MM-dd');

  const expenseTx = transactions.filter((tx) => tx.categories?.type !== 'income');
  const categoryMeta = new Map();
  expenseTx.forEach((tx) => {
    const key = categoryKey(tx);
    if (!categoryMeta.has(key)) categoryMeta.set(key, { key, id: tx.category_id, name: tx.categories?.name || 'Lainnya' });
  });

  const weeklyRanges = Array.from({ length: historyWeeks }, (_, index) => {
    const start = startOfWeek(subWeeks(date, index + 1), { weekStartsOn: 1 });
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(addDays(start, elapsedDays), 'yyyy-MM-dd'),
    };
  });

  const byCategory = [];
  categoryMeta.forEach((meta) => {
    const currentTransactions = expenseTx.filter((tx) => categoryKey(tx) === meta.key && tx.transaction_date >= currentStart && tx.transaction_date <= currentEnd);
    const current = currentTransactions.reduce((sum, tx) => sum + amount(tx.amount), 0);
    if (current <= 0) return;

    const historical = weeklyRanges.map((range) => expenseTx
      .filter((tx) => categoryKey(tx) === meta.key && tx.transaction_date >= range.start && tx.transaction_date <= range.end)
      .reduce((sum, tx) => sum + amount(tx.amount), 0));

    const activeHistoryWeeks = historical.filter((value) => value > 0).length;
    const baseline = median(historical);
    const mean = historical.reduce((sum, value) => sum + value, 0) / Math.max(historical.length, 1);
    const difference = current - baseline;
    const ratio = baseline > 0 ? current / baseline : null;
    const percentChange = baseline > 0 ? (difference / baseline) * 100 : null;
    const enoughHistory = activeHistoryWeeks >= 3;

    let flagged = false;
    let severity = 'normal';
    let reason = '';

    if (enoughHistory && baseline >= 20000 && current >= 100000 && ratio >= 1.5 && difference >= Math.max(50000, baseline * 0.3)) {
      flagged = true;
      severity = ratio >= 2.5 || difference >= 500000 ? 'high' : ratio >= 1.8 || difference >= 200000 ? 'medium' : 'watch';
      reason = `${Math.round(percentChange)}% di atas median periode yang sama`;
    }

    byCategory.push({
      ...meta,
      current,
      baseline,
      mean,
      difference,
      ratio,
      percentChange,
      activeHistoryWeeks,
      enoughHistory,
      flagged,
      severity,
      reason,
      transactionCount: currentTransactions.length,
      historical,
    });
  });

  const anomalies = byCategory.filter((item) => item.flagged).sort((a, b) => {
    const severityRank = { high: 3, medium: 2, watch: 1, normal: 0 };
    return severityRank[b.severity] - severityRank[a.severity] || b.difference - a.difference;
  });

  const currentTotal = expenseTx
    .filter((tx) => tx.transaction_date >= currentStart && tx.transaction_date <= currentEnd)
    .reduce((sum, tx) => sum + amount(tx.amount), 0);

  const historicalTotals = weeklyRanges.map((range) => expenseTx
    .filter((tx) => tx.transaction_date >= range.start && tx.transaction_date <= range.end)
    .reduce((sum, tx) => sum + amount(tx.amount), 0));
  const totalBaseline = median(historicalTotals);
  const totalPercentChange = totalBaseline > 0 ? ((currentTotal - totalBaseline) / totalBaseline) * 100 : null;

  return {
    currentStart,
    currentEnd,
    elapsedDays: elapsedDays + 1,
    historyWeeks,
    currentTotal,
    totalBaseline,
    totalPercentChange,
    anomalies,
    categories: byCategory.sort((a, b) => b.current - a.current),
    hasEnoughOverallHistory: historicalTotals.filter((value) => value > 0).length >= 3,
    historicalTotals,
    generatedAt: format(date, 'yyyy-MM-dd'),
  };
}

export function anomalyQueryStart(date = new Date(), historyWeeks = 6) {
  return format(startOfWeek(subWeeks(date, historyWeeks), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export function formatInsightDate(dateString) {
  return format(parseISO(dateString), 'dd MMM yyyy');
}
