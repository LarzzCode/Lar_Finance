import { endOfMonth, format, startOfMonth } from 'date-fns';
import { calculateWalletBalances } from './financeDataV31';

const normalize = (value) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const money = (value) => Number(value || 0);

const clampDay = (day, date) => Math.min(Math.max(Number(day || 1), 1), endOfMonth(date).getDate());
const dateForDay = (day, date) => format(new Date(date.getFullYear(), date.getMonth(), clampDay(day, date)), 'yyyy-MM-dd');
const commitmentKey = (item) => [normalize(item.name), money(item.amount), String(item.category_id || '')].join('|');

export function buildFinancialForecast({
  transactions = [],
  wallets = [],
  transfers = [],
  budgets = [],
  subscriptions = [],
  recurring = [],
  date = new Date(),
}) {
  const monthStart = format(startOfMonth(date), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(date), 'yyyy-MM-dd');
  const today = format(date, 'yyyy-MM-dd');
  const daysInMonth = endOfMonth(date).getDate();
  const dayOfMonth = Math.min(date.getDate(), daysInMonth);
  const daysRemaining = Math.max(daysInMonth - dayOfMonth + 1, 1);

  const postedThisMonth = transactions.filter((tx) => tx.transaction_date >= monthStart && tx.transaction_date <= monthEnd);
  const postedThroughToday = postedThisMonth.filter((tx) => tx.transaction_date <= today);

  const actual = postedThroughToday.reduce((acc, tx) => {
    const amount = money(tx.amount);
    if (tx.categories?.type === 'income') acc.income += amount;
    else acc.expense += amount;
    return acc;
  }, { income: 0, expense: 0 });

  const isSubscriptionPaid = (sub) => postedThisMonth.some((tx) =>
    normalize(tx.description) === normalize(sub.name)
    && money(tx.amount) === money(sub.amount)
    && String(tx.category_id || '') === String(sub.category_id || '')
  );

  const commitments = [];
  const seenExpense = new Set();

  subscriptions.forEach((sub) => {
    if (isSubscriptionPaid(sub)) return;
    const key = commitmentKey(sub);
    seenExpense.add(key);
    commitments.push({
      id: `subscription-${sub.id}`,
      name: sub.name || 'Tagihan',
      amount: money(sub.amount),
      categoryId: sub.category_id,
      direction: 'expense',
      source: 'Tagihan',
      date: dateForDay(sub.due_date, date),
      overdue: dateForDay(sub.due_date, date) < today,
    });
  });

  recurring.filter((item) => item.is_active).forEach((item) => {
    if (item.last_posted_month === monthStart) return;
    const entry = {
      id: `recurring-${item.id}`,
      name: item.name || 'Transaksi rutin',
      amount: money(item.amount),
      categoryId: item.category_id,
      direction: item.type === 'income' ? 'income' : 'expense',
      source: 'Rutin',
      date: dateForDay(item.day_of_month, date),
      overdue: dateForDay(item.day_of_month, date) < today,
    };

    if (entry.direction === 'expense') {
      const key = commitmentKey(item);
      if (seenExpense.has(key)) return;
      seenExpense.add(key);
    }
    commitments.push(entry);
  });

  commitments.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

  const scheduledExpense = commitments.filter((item) => item.direction === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const scheduledIncome = commitments.filter((item) => item.direction === 'income').reduce((sum, item) => sum + item.amount, 0);

  const dailyExpensePace = actual.expense / Math.max(dayOfMonth, 1);
  const runRateExpense = dailyExpensePace * daysInMonth;
  const committedFloor = actual.expense + scheduledExpense;
  const projectedExpense = Math.max(runRateExpense, committedFloor);
  const projectedIncome = actual.income + scheduledIncome;
  const projectedNet = projectedIncome - projectedExpense;

  const budgetCategoryIds = new Set(budgets.map((item) => String(item.category_id || '')));
  const budgetTotal = budgets.reduce((sum, item) => sum + money(item.amount), 0);
  const budgetSpent = postedThroughToday
    .filter((tx) => tx.categories?.type === 'expense' && budgetCategoryIds.has(String(tx.category_id || '')))
    .reduce((sum, tx) => sum + money(tx.amount), 0);
  const scheduledBudgetedExpense = commitments
    .filter((item) => item.direction === 'expense' && budgetCategoryIds.has(String(item.categoryId || '')))
    .reduce((sum, item) => sum + item.amount, 0);
  const rawBudgetRoom = budgetTotal > 0 ? Math.max(budgetTotal - budgetSpent, 0) : null;
  const discretionaryBudgetRoom = rawBudgetRoom == null ? null : Math.max(rawBudgetRoom - scheduledBudgetedExpense, 0);
  const forecastBudgetCeiling = budgetTotal > 0 ? actual.expense + Math.max(rawBudgetRoom, 0) : null;
  const projectedOverBudget = forecastBudgetCeiling == null ? 0 : projectedExpense - forecastBudgetCeiling;

  const calculatedWallets = calculateWalletBalances(wallets, transactions, transfers, date);
  const currentLiquidity = calculatedWallets.reduce((sum, wallet) => sum + money(wallet.month_balance), 0);
  const liquidityAfterCommitments = currentLiquidity + scheduledIncome - scheduledExpense;
  const safeToSpend = Math.max(0, discretionaryBudgetRoom == null
    ? liquidityAfterCommitments
    : Math.min(liquidityAfterCommitments, discretionaryBudgetRoom));
  const safePerDay = safeToSpend / daysRemaining;

  let runningLiquidity = currentLiquidity;
  const timeline = commitments.map((item) => {
    runningLiquidity += item.direction === 'income' ? item.amount : -item.amount;
    return { ...item, projectedLiquidityAfter: runningLiquidity };
  });

  return {
    monthStart,
    monthEnd,
    today,
    dayOfMonth,
    daysInMonth,
    daysRemaining,
    actualIncome: actual.income,
    actualExpense: actual.expense,
    currentLiquidity,
    dailyExpensePace,
    runRateExpense,
    scheduledExpense,
    scheduledIncome,
    projectedExpense,
    projectedIncome,
    projectedNet,
    budgetTotal,
    budgetSpent,
    budgetRoom: rawBudgetRoom,
    scheduledBudgetedExpense,
    discretionaryBudgetRoom,
    projectedOverBudget,
    liquidityAfterCommitments,
    safeToSpend,
    safePerDay,
    timeline,
    basis: scheduledExpense > 0 || scheduledIncome > 0 ? 'Ritme harian + komitmen terjadwal' : 'Ritme pengeluaran harian',
  };
}
