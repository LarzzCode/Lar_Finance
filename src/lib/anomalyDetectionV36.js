import { endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';

const amount = (value) => Number(value || 0);

const median = (values = []) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const categoryKey = (tx) => String(tx.category_id || tx.categories?.name || 'uncategorized');

const sameElapsedDayRange = (date, monthsBack) => {
  const targetMonth = subMonths(startOfMonth(date), monthsBack);
  const endDay = Math.min(date.getDate(), endOfMonth(targetMonth).getDate());
  return {
    start: format(targetMonth, 'yyyy-MM-dd'),
    end: format(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), endDay), 'yyyy-MM-dd'),
  };
};

export function buildSpendingAnomalies(transactions = [], date = new Date(), historyMonths = 6) {
  const currentStartDate = startOfMonth(date);
  const currentStart = format(currentStartDate, 'yyyy-MM-dd');
  const currentEnd = format(date, 'yyyy-MM-dd');

  const expenseTx = transactions.filter((tx) => tx.categories?.type !== 'income');
  const categoryMeta = new Map();

  expenseTx.forEach((tx) => {
    const key = categoryKey(tx);
    if (!categoryMeta.has(key)) {
      categoryMeta.set(key, {
        key,
        id: tx.category_id,
        name: tx.categories?.name || 'Lainnya',
      });
    }
  });

  const historicalRanges = Array.from(
    { length: historyMonths },
    (_, index) => sameElapsedDayRange(date, index + 1),
  );

  const byCategory = [];

  categoryMeta.forEach((meta) => {
    const currentTransactions = expenseTx.filter(
      (tx) =>
        categoryKey(tx) === meta.key
        && tx.transaction_date >= currentStart
        && tx.transaction_date <= currentEnd
    );

    const current = currentTransactions.reduce((sum, tx) => sum + amount(tx.amount), 0);
    if (current <= 0) return;

    const historical = historicalRanges.map((range) =>
      expenseTx
        .filter(
          (tx) =>
            categoryKey(tx) === meta.key
            && tx.transaction_date >= range.start
            && tx.transaction_date <= range.end
        )
        .reduce((sum, tx) => sum + amount(tx.amount), 0)
    );

    const activeHistoryMonths = historical.filter((value) => value > 0).length;
    const baseline = median(historical);
    const mean = historical.reduce((sum, value) => sum + value, 0) / Math.max(historical.length, 1);
    const difference = current - baseline;
    const ratio = baseline > 0 ? current / baseline : null;
    const percentChange = baseline > 0 ? (difference / baseline) * 100 : null;
    const enoughHistory = activeHistoryMonths >= 3;

    let flagged = false;
    let severity = 'normal';
    let reason = '';

    if (
      enoughHistory
      && baseline >= 20000
      && current >= 100000
      && ratio >= 1.5
      && difference >= Math.max(50000, baseline * 0.3)
    ) {
      flagged = true;
      severity =
        ratio >= 2.5 || difference >= 500000
          ? 'high'
          : ratio >= 1.8 || difference >= 200000
            ? 'medium'
            : 'watch';
      reason = `${Math.round(percentChange)}% di atas median periode bulan yang sama`;
    }

    byCategory.push({
      ...meta,
      current,
      baseline,
      mean,
      difference,
      ratio,
      percentChange,
      activeHistoryMonths,
      enoughHistory,
      flagged,
      severity,
      reason,
      transactionCount: currentTransactions.length,
      historical,
    });
  });

  const anomalies = byCategory
    .filter((item) => item.flagged)
    .sort((a, b) => {
      const severityRank = { high: 3, medium: 2, watch: 1, normal: 0 };
      return severityRank[b.severity] - severityRank[a.severity] || b.difference - a.difference;
    });

  const currentTotal = expenseTx
    .filter((tx) => tx.transaction_date >= currentStart && tx.transaction_date <= currentEnd)
    .reduce((sum, tx) => sum + amount(tx.amount), 0);

  const historicalTotals = historicalRanges.map((range) =>
    expenseTx
      .filter((tx) => tx.transaction_date >= range.start && tx.transaction_date <= range.end)
      .reduce((sum, tx) => sum + amount(tx.amount), 0)
  );

  const totalBaseline = median(historicalTotals);
  const totalPercentChange =
    totalBaseline > 0 ? ((currentTotal - totalBaseline) / totalBaseline) * 100 : null;

  return {
    currentStart,
    currentEnd,
    elapsedDays: date.getDate(),
    historyMonths,
    currentTotal,
    totalBaseline,
    totalPercentChange,
    anomalies,
    categories: byCategory.sort((a, b) => b.current - a.current),
    hasEnoughOverallHistory: historicalTotals.filter((value) => value > 0).length >= 3,
    historicalTotals,
    historicalRanges,
    generatedAt: format(date, 'yyyy-MM-dd'),
  };
}

export function anomalyQueryStart(date = new Date(), historyMonths = 6) {
  return format(startOfMonth(subMonths(date, historyMonths)), 'yyyy-MM-dd');
}

export function formatInsightDate(dateString) {
  return format(parseISO(dateString), 'dd MMM yyyy');
}
