import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { CreateExpenseModal } from './CreateExpenseModal';

interface Payable {
  id: string;
  status: string;
  dueDate: string;
}

interface Expense {
  id: string;
  propertyId: string;
  amount: string | number;
  date: string;
  vendor: string | null;
  description: string;
  isPaid: boolean;
  account: { id: string; code: string; name: string };
  payable: Payable | null;
}

interface ExpensesResponse {
  data: Expense[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 25;

export function ExpensesPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [isPaidFilter, setIsPaidFilter] = useState<'' | 'true' | 'false'>('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery<ExpensesResponse>({
    queryKey: ['accounting', 'expenses', page, isPaidFilter],
    queryFn: () =>
      api
        .get('/accounting/expenses', {
          params: {
            page,
            limit: PAGE_SIZE,
            ...(isPaidFilter !== '' ? { isPaid: isPaidFilter } : {}),
          },
        })
        .then((r) => r.data as ExpensesResponse),
  });

  // Payables summary — fetch unpaid expenses for total
  const { data: unpaidData } = useQuery<ExpensesResponse>({
    queryKey: ['accounting', 'expenses', 'unpaid-summary'],
    queryFn: () =>
      api
        .get('/accounting/expenses', { params: { isPaid: 'false', limit: 200 } })
        .then((r) => r.data as ExpensesResponse),
  });

  const pendingTotal = (unpaidData?.data ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{t('expenses.title')}</h2>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            {t('expenses.createExpense')}
          </Button>
        </div>

        {/* Payables summary */}
        {(unpaidData?.total ?? 0) > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {t('expenses.pendingPayables')}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {unpaidData?.total} {t('expenses.unpaidItems')}
                </p>
              </div>
              <p className="text-lg font-bold text-amber-900 tabular-nums">
                {pendingTotal.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <select
            value={isPaidFilter}
            onChange={(e) => {
              setIsPaidFilter(e.target.value as '' | 'true' | 'false');
              setPage(1);
            }}
            className="flex h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">{t('expenses.allStatuses')}</option>
            <option value="true">{t('expenses.paid')}</option>
            <option value="false">{t('expenses.unpaid')}</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('expenses.date')}</th>
                    <th className="px-4 py-3 font-medium">{t('expenses.vendor')}</th>
                    <th className="px-4 py-3 font-medium">{t('expenses.description')}</th>
                    <th className="px-4 py-3 font-medium">{t('expenses.account')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('expenses.amount')}</th>
                    <th className="px-4 py-3 font-medium">{t('expenses.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.data.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        {t('expenses.noExpenses')}
                      </td>
                    </tr>
                  )}
                  {data?.data.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(exp.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{exp.vendor ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Link
                          to="/accounting/expenses/$expenseId"
                          params={{ expenseId: exp.id }}
                          className="text-primary-600 hover:underline"
                        >
                          {exp.description}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {exp.account.code} — {exp.account.name}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {Number(exp.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            exp.isPaid
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {exp.isPaid ? t('expenses.paid') : t('expenses.unpaid')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  {t('accounting.page')} {page} / {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {t('accounting.prev')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t('accounting.next')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && <CreateExpenseModal onClose={() => setShowCreate(false)} />}
    </AppShell>
  );
}
