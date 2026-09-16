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

  const merged = [...(systemRes.data || []), ...(ownRes.data || [])];
  const seen = new Set();
  return {
    data: merged.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }),
    error: null,
  };
}

export function calculateWalletBalances(wallets = [], transactions = [], date = new Date()) {
  const { start, end } = currentMonthRange(date);

  return wallets.map((wallet) => {
    const allWalletTx = transactions.filter((tx) => String(tx.wallet_id) === String(wallet.id));
    let allIncome = 0;
    let allExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;

    allWalletTx.forEach((tx) => {
      const amount = Number(tx.amount || 0);
      const isIncome = tx.categories?.type === 'income';
      if (isIncome) allIncome += amount;
      else allExpense += amount;

      if (tx.transaction_date >= start && tx.transaction_date <= end) {
        if (isIncome) monthIncome += amount;
        else monthExpense += amount;
      }
    });

    return {
      ...wallet,
      current_balance: Number(wallet.saldo_awal || 0) + allIncome - allExpense,
      month_income: monthIncome,
      month_expense: monthExpense,
      month_net: monthIncome - monthExpense,
    };
  });
}

export function isSystemCategory(category) {
  return category?.user_id == null;
}
