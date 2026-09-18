import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { calculateWalletBalances, loadAccessibleCategories } from './financeDataV35';

const monthKey = (dateString) => dateString ? String(dateString).slice(0, 7) : 'Tanpa tanggal';
const monthLabel = (key) => {
  if (!/^\d{4}-\d{2}$/.test(key)) return key;
  return format(parseISO(`${key}-01`), 'MMMM yyyy', { locale: id });
};

const safeNumber = (value) => Number(value || 0);

const createDataSheet = ({
  title,
  subtitle,
  headers,
  rows,
  widths = [],
  numericColumns = [],
}) => {
  const data = [
    [title],
    [subtitle],
    [],
    headers,
    ...rows,
  ];

  const sheet = XLSX.utils.aoa_to_sheet(data);
  const lastColumn = XLSX.utils.encode_col(Math.max(headers.length - 1, 0));
  const lastRow = Math.max(4 + rows.length, 4);

  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 0) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(headers.length - 1, 0) } },
  ];
  sheet['!autofilter'] = rows.length
    ? { ref: `A4:${lastColumn}${lastRow}` }
    : undefined;
  sheet['!cols'] = headers.map((_, index) => ({ wch: widths[index] || 16 }));

  numericColumns.forEach((columnIndex) => {
    for (let rowIndex = 4; rowIndex < 4 + rows.length; rowIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (sheet[address] && typeof sheet[address].v === 'number') {
        sheet[address].z = '#,##0';
      }
    }
  });

  return sheet;
};

export async function exportFinanceBackup({ supabase, user }) {
  if (!user?.id) throw new Error('User belum login');

  const [txRes, walletRes, transferRes, adjustmentRes, trashRes, categoryRes] = await Promise.all([
    supabase.from('transactions')
      .select('id, amount, transaction_date, description, category_id, wallet_id, payment_method, created_at, tags, split_group_id, categories(name, type), wallets(name)')
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase.from('transfers')
      .select('id, from_wallet_id, to_wallet_id, amount, transfer_date, note, created_at')
      .eq('user_id', user.id)
      .order('transfer_date', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('wallet_adjustments')
      .select('id, wallet_id, amount, adjustment_date, expected_balance, actual_balance, reason, created_at')
      .eq('user_id', user.id)
      .order('adjustment_date', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('transaction_trash')
      .select('id, original_transaction_id, category_id, amount, transaction_date, description, payment_method, original_created_at, wallet_id, split_group_id, tags, trashed_at, expires_at, categories(name, type), wallets(name)')
      .eq('user_id', user.id)
      .order('trashed_at', { ascending: true }),
    loadAccessibleCategories(supabase, user.id),
  ]);

  const failed = [txRes, walletRes, transferRes, adjustmentRes, trashRes, categoryRes]
    .find((result) => result?.error);
  if (failed?.error) throw failed.error;

  const transactions = txRes.data || [];
  const wallets = walletRes.data || [];
  const transfers = transferRes.data || [];
  const adjustments = adjustmentRes.data || [];
  const trash = trashRes.data || [];
  const categories = categoryRes.data || [];

  const walletMap = new Map(wallets.map((wallet) => [String(wallet.id), wallet.name]));
  const calculatedWallets = calculateWalletBalances(wallets, transactions, transfers, adjustments);

  const totals = transactions.reduce((acc, tx) => {
    const amount = safeNumber(tx.amount);
    if (tx.categories?.type === 'income') acc.income += amount;
    else acc.expense += amount;
    return acc;
  }, { income: 0, expense: 0 });

  const monthlyMap = new Map();
  transactions.forEach((tx) => {
    const key = monthKey(tx.transaction_date);
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { key, count: 0, income: 0, expense: 0 });
    }
    const item = monthlyMap.get(key);
    item.count += 1;
    if (tx.categories?.type === 'income') item.income += safeNumber(tx.amount);
    else item.expense += safeNumber(tx.amount);
  });

  const categoryMap = new Map();
  transactions.forEach((tx) => {
    const type = tx.categories?.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    const name = tx.categories?.name || 'Lainnya';
    const key = `${type}|${name}`;
    if (!categoryMap.has(key)) categoryMap.set(key, { type, name, count: 0, total: 0 });
    const item = categoryMap.get(key);
    item.count += 1;
    item.total += safeNumber(tx.amount);
  });

  const generatedAt = new Date();
  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    ['Email akun', user.email || '-'],
    ['Waktu backup', format(generatedAt, 'yyyy-MM-dd HH:mm:ss')],
    ['Cakupan', 'Seluruh histori sejak akun mulai digunakan'],
    ['Jumlah transaksi aktif', transactions.length],
    ['Total pemasukan', totals.income],
    ['Total pengeluaran', totals.expense],
    ['Net cashflow', totals.income - totals.expense],
    ['Jumlah dompet', wallets.length],
    ['Jumlah transfer', transfers.length],
    ['Jumlah rekonsiliasi', adjustments.length],
    ['Item di Trash', trash.length],
    [],
    ['Catatan', 'File ini adalah arsip baca/audit. Jangan mengubah sheet raw jika ingin menjaga bukti histori tetap utuh.'],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['LAR FINANCE · BACKUP KEUANGAN'],
    ['Backup lengkap seluruh histori'],
    [],
    ['Informasi', 'Nilai'],
    ...summaryRows,
  ]);
  summarySheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ];
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 70 }];
  ['B8', 'B9', 'B10'].forEach((cell) => {
    if (summarySheet[cell] && typeof summarySheet[cell].v === 'number') summarySheet[cell].z = '#,##0';
  });
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan');

  const transactionRows = transactions.map((tx) => [
    tx.id,
    tx.transaction_date || '',
    monthLabel(monthKey(tx.transaction_date)),
    tx.categories?.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    tx.category_id ?? '',
    tx.categories?.name || 'Lainnya',
    tx.wallet_id || '',
    tx.wallets?.name || tx.payment_method || 'Manual',
    tx.description || '',
    safeNumber(tx.amount),
    tx.payment_method || '',
    (tx.tags || []).join(', '),
    tx.split_group_id || '',
    tx.created_at || '',
  ]);
  XLSX.utils.book_append_sheet(workbook, createDataSheet({
    title: 'TRANSAKSI AKTIF · RAW DATA',
    subtitle: 'Jangan hapus kolom ID bila file digunakan sebagai arsip/audit.',
    headers: ['ID', 'Tanggal', 'Bulan', 'Jenis', 'Kategori ID', 'Kategori', 'Wallet ID', 'Dompet', 'Deskripsi', 'Nominal', 'Payment Method', 'Tags', 'Split Group ID', 'Created At'],
    rows: transactionRows,
    widths: [10, 13, 18, 13, 12, 22, 38, 18, 38, 16, 20, 26, 38, 24],
    numericColumns: [0, 4, 9],
  }), 'Transaksi');

  const monthlyRows = [...monthlyMap.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((item) => [
      item.key,
      monthLabel(item.key),
      item.count,
      item.income,
      item.expense,
      item.income - item.expense,
    ]);
  XLSX.utils.book_append_sheet(workbook, createDataSheet({
    title: 'RINGKASAN PER BULAN',
    subtitle: 'Bulan hanya pengelompokan laporan; saldo Lar Finance tetap kumulatif/lifetime.',
    headers: ['Periode', 'Bulan', 'Jumlah Transaksi', 'Pemasukan', 'Pengeluaran', 'Net'],
    rows: monthlyRows,
    widths: [12, 20, 18, 18, 18, 18],
    numericColumns: [2, 3, 4, 5],
  }), 'Per Bulan');

  const categoryRows = [...categoryMap.values()]
    .sort((a, b) => b.total - a.total)
    .map((item) => [item.type, item.name, item.count, item.total]);
  XLSX.utils.book_append_sheet(workbook, createDataSheet({
    title: 'RINGKASAN KATEGORI',
    subtitle: 'Akumulasi seluruh histori transaksi aktif.',
    headers: ['Jenis', 'Kategori', 'Jumlah Transaksi', 'Total Nominal'],
    rows: categoryRows,
    widths: [14, 24, 18, 20],
    numericColumns: [2, 3],
  }), 'Kategori');

  const walletRows = calculatedWallets.map((wallet) => [
    wallet.id,
    wallet.name,
    safeNumber(wallet.saldo_awal),
    safeNumber(wallet.current_balance),
    safeNumber(wallet.total_income),
    safeNumber(wallet.total_expense),
    safeNumber(wallet.total_transfer_in),
    safeNumber(wallet.total_transfer_out),
    wallet.created_at || '',
  ]);
  XLSX.utils.book_append_sheet(workbook, createDataSheet({
    title: 'DOMPET & SALDO',
    subtitle: 'Saldo saat ini dihitung kumulatif dari seluruh histori dan rekonsiliasi.',
    headers: ['Wallet ID', 'Nama', 'Saldo Awal', 'Saldo Saat Ini', 'Total Pemasukan', 'Total Pengeluaran', 'Transfer Masuk', 'Transfer Keluar', 'Created At'],
    rows: walletRows,
    widths: [38, 22, 18, 18, 18, 18, 18, 18, 24],
    numericColumns: [2, 3, 4, 5, 6, 7],
  }), 'Dompet');

  const transferRows = transfers.map((item) => [
    item.id,
    item.transfer_date || '',
    item.from_wallet_id || '',
    walletMap.get(String(item.from_wallet_id)) || '',
    item.to_wallet_id || '',
    walletMap.get(String(item.to_wallet_id)) || '',
    safeNumber(item.amount),
    item.note || '',
    item.created_at || '',
  ]);
  XLSX.utils.book_append_sheet(workbook, createDataSheet({
    title: 'TRANSFER ANTAR DOMPET',
    subtitle: 'Transfer bukan pemasukan/pengeluaran; data disimpan terpisah untuk menjaga cashflow.',
    headers: ['Transfer ID', 'Tanggal', 'From Wallet ID', 'Dari Dompet', 'To Wallet ID', 'Ke Dompet', 'Nominal', 'Catatan', 'Created At'],
    rows: transferRows,
    widths: [38, 13, 38, 20, 38, 20, 18, 34, 24],
    numericColumns: [6],
  }), 'Transfer');

  const adjustmentRows = adjustments.map((item) => [
    item.id,
    item.adjustment_date || '',
    item.wallet_id || '',
    walletMap.get(String(item.wallet_id)) || '',
    safeNumber(item.expected_balance),
    safeNumber(item.actual_balance),
    safeNumber(item.amount),
    item.reason || '',
    item.created_at || '',
  ]);
  XLSX.utils.book_append_sheet(workbook, createDataSheet({
    title: 'REKONSILIASI SALDO',
    subtitle: 'Audit trail saat saldo aplikasi dicocokkan dengan saldo nyata.',
    headers: ['Adjustment ID', 'Tanggal', 'Wallet ID', 'Dompet', 'Saldo Sebelum', 'Saldo Nyata', 'Selisih', 'Alasan', 'Created At'],
    rows: adjustmentRows,
    widths: [38, 13, 38, 20, 18, 18, 18, 34, 24],
    numericColumns: [4, 5, 6],
  }), 'Rekonsiliasi');

  const trashRows = trash.map((item) => [
    item.id,
    item.original_transaction_id,
    item.transaction_date || '',
    item.categories?.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    item.category_id ?? '',
    item.categories?.name || 'Lainnya',
    item.wallet_id || '',
    item.wallets?.name || item.payment_method || 'Manual',
    item.description || '',
    safeNumber(item.amount),
    (item.tags || []).join(', '),
    item.split_group_id || '',
    item.trashed_at || '',
    item.expires_at || '',
  ]);
  XLSX.utils.book_append_sheet(workbook, createDataSheet({
    title: 'TRANSACTION TRASH',
    subtitle: 'Transaksi yang dipindahkan ke Trash tetap ikut backup supaya tidak hilang dari arsip.',
    headers: ['Trash ID', 'Original Transaction ID', 'Tanggal', 'Jenis', 'Kategori ID', 'Kategori', 'Wallet ID', 'Dompet', 'Deskripsi', 'Nominal', 'Tags', 'Split Group ID', 'Trashed At', 'Expires At'],
    rows: trashRows,
    widths: [38, 20, 13, 13, 12, 22, 38, 18, 38, 16, 26, 38, 24, 24],
    numericColumns: [1, 4, 9],
  }), 'Trash');

  const accessibleCategoryRows = categories.map((category) => [
    category.id,
    category.name,
    category.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    category.user_id ? 'Pribadi' : 'Bawaan',
    category.icon || '',
  ]);
  XLSX.utils.book_append_sheet(workbook, createDataSheet({
    title: 'REFERENSI KATEGORI',
    subtitle: 'Daftar kategori yang bisa dipakai akun pada saat backup dibuat.',
    headers: ['Kategori ID', 'Nama', 'Jenis', 'Sumber', 'Icon'],
    rows: accessibleCategoryRows,
    widths: [12, 24, 14, 14, 20],
    numericColumns: [0],
  }), 'Referensi Kategori');

  const filename = `LarFinance_Backup_${format(generatedAt, 'yyyy-MM-dd_HHmm')}.xlsx`;
  XLSX.writeFile(workbook, filename);

  return {
    filename,
    transactionCount: transactions.length,
    monthCount: monthlyRows.length,
  };
}
