import { format, startOfMonth, endOfMonth } from 'date-fns';

export const rupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export const currentMonthRange = (date = new Date()) => ({
  start: format(startOfMonth(date), 'yyyy-MM-dd'),
  end: format(endOfMonth(date), 'yyyy-MM-dd'),
});

export async function loadAccessibleCategories(supabase, userId, type) {
  const ownQuery = supabase.from('categories').select('*').eq('user_id', userId);
  const systemQuery = supabase.from('categories').select('*').is('user_id', null);

  if (type) {
    ownQuery.eq('type', type);
    systemQuery.eq('type', type);
  }

  const [ownRes, systemRes] = await Promise.all([
    ownQuery.order('name'),
    systemQuery.order('name'),
  ]);

  const error = ownRes.error || systemRes.error;
  if (error) return { data: [], error };

  const seen = new Set();
  return {
    data: [...(systemRes.data || []), ...(ownRes.data || [])].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }),
    error: null,
  };
}

const adjustmentSortValue = (item) =>
  `${item.adjustment_date || ''}|${item.created_at || ''}`;

export function calculateWalletBalances(
  wallets = [],
  transactions = [],
  transfers = [],
  adjustments = [],
  date = new Date(),
) {
  const { start, end } = currentMonthRange(date);
  const today = format(date, 'yyyy-MM-dd');

  return wallets.map((wallet) => {
    const walletTx = transactions.filter((tx) => String(tx.wallet_id) === String(wallet.id));
    const incoming = transfers.filter((item) => String(item.to_wallet_id) === String(wallet.id));
    const outgoing = transfers.filter((item) => String(item.from_wallet_id) === String(wallet.id));
    const walletAdjustments = adjustments
      .filter((item) => String(item.wallet_id) === String(wallet.id) && (!item.adjustment_date || item.adjustment_date <= today))
      .sort((a, b) => adjustmentSortValue(a).localeCompare(adjustmentSortValue(b)));

    const totalIncome = walletTx
      .filter((tx) => tx.categories?.type === 'income')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const totalExpense = walletTx
      .filter((tx) => tx.categories?.type !== 'income')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const monthIncome = walletTx
      .filter((tx) => tx.transaction_date >= start && tx.transaction_date <= end && tx.categories?.type === 'income')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const monthExpense = walletTx
      .filter((tx) => tx.transaction_date >= start && tx.transaction_date <= end && tx.categories?.type !== 'income')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const totalTransferIn = incoming.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalTransferOut = outgoing.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthTransferIn = incoming
      .filter((item) => item.transfer_date >= start && item.transfer_date <= end)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthTransferOut = outgoing
      .filter((item) => item.transfer_date >= start && item.transfer_date <= end)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const latestReconciliation = walletAdjustments.at(-1) || null;
    const startingBalance = Number(wallet.saldo_awal || 0);

    let currentBalance;

    if (latestReconciliation && Number.isFinite(Number(latestReconciliation.actual_balance))) {
      const anchorDate = latestReconciliation.adjustment_date;
      const txAfterAnchor = walletTx.filter((tx) => !anchorDate || tx.transaction_date > anchorDate);
      const transferInAfterAnchor = incoming.filter((item) => !anchorDate || item.transfer_date > anchorDate);
      const transferOutAfterAnchor = outgoing.filter((item) => !anchorDate || item.transfer_date > anchorDate);

      currentBalance =
        Number(latestReconciliation.actual_balance || 0)
        + txAfterAnchor
          .filter((tx) => tx.categories?.type === 'income')
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
        - txAfterAnchor
          .filter((tx) => tx.categories?.type !== 'income')
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
        + transferInAfterAnchor.reduce((sum, item) => sum + Number(item.amount || 0), 0)
        - transferOutAfterAnchor.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    } else {
      currentBalance =
        startingBalance
        + totalIncome
        - totalExpense
        + totalTransferIn
        - totalTransferOut;
    }

    return {
      ...wallet,
      current_balance: currentBalance,
      lifetime_balance: currentBalance,
      historical_balance: currentBalance,

      total_income: totalIncome,
      total_expense: totalExpense,
      total_net: totalIncome - totalExpense,
      total_transfer_in: totalTransferIn,
      total_transfer_out: totalTransferOut,

      // Kept for monthly planning/forecast compatibility.
      month_balance: currentBalance,
      month_income: monthIncome,
      month_expense: monthExpense,
      month_net: monthIncome - monthExpense,
      month_transfer_in: monthTransferIn,
      month_transfer_out: monthTransferOut,
      latest_reconciliation: latestReconciliation,
    };
  });
}

export function findMatchingRule(rules = [], { type, description = '' } = {}) {
  const normalized = String(description || '').trim().toLowerCase();
  if (!normalized) return null;

  return [...rules]
    .filter((rule) => rule.is_active && rule.transaction_type === type)
    .sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100))
    .find((rule) => {
      const value = String(rule.match_value || '').trim().toLowerCase();
      if (!value) return false;
      if (rule.match_operator === 'equals') return normalized === value;
      if (rule.match_operator === 'starts_with') return normalized.startsWith(value);
      return normalized.includes(value);
    }) || null;
}

export function isSystemCategory(category) {
  return category?.user_id == null;
}
