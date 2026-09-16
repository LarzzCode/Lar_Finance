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
  const [ownRes, systemRes] = await Promise.all([ownQuery.order('name'), systemQuery.order('name')]);
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

export function calculateWalletBalances(wallets = [], transactions = [], transfers = [], date = new Date()) {
  const { start, end } = currentMonthRange(date);

  return wallets.map((wallet) => {
    const walletTx = transactions.filter((tx) => String(tx.wallet_id) === String(wallet.id));
    const incoming = transfers.filter((item) => String(item.to_wallet_id) === String(wallet.id));
    const outgoing = transfers.filter((item) => String(item.from_wallet_id) === String(wallet.id));

    let allIncome = 0;
    let allExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;

    walletTx.forEach((tx) => {
      const amount = Number(tx.amount || 0);
      const isIncome = tx.categories?.type === 'income';
      if (isIncome) allIncome += amount;
      else allExpense += amount;
      if (tx.transaction_date >= start && tx.transaction_date <= end) {
        if (isIncome) monthIncome += amount;
        else monthExpense += amount;
      }
    });

    const allTransferIn = incoming.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const allTransferOut = outgoing.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthTransferIn = incoming.filter((item) => item.transfer_date >= start && item.transfer_date <= end).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthTransferOut = outgoing.filter((item) => item.transfer_date >= start && item.transfer_date <= end).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const startingBalance = Number(wallet.saldo_awal || 0);
    const monthBalance = startingBalance + monthIncome - monthExpense + monthTransferIn - monthTransferOut;

    return {
      ...wallet,
      current_balance: monthBalance,
      month_balance: monthBalance,
      historical_balance: startingBalance + allIncome - allExpense + allTransferIn - allTransferOut,
      month_income: monthIncome,
      month_expense: monthExpense,
      month_net: monthIncome - monthExpense,
      month_transfer_in: monthTransferIn,
      month_transfer_out: monthTransferOut,
    };
  });
}

export function isSystemCategory(category) {
  return category?.user_id == null;
}
