import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Deduction {
  id: string;
  amount: string | number;
}

interface Refund {
  id: string;
  amount: string | number;
}

interface Deposit {
  id: string;
  contractId: string;
  propertyId: string;
  amount: string | number;
  receivedDate: string;
  status: string;
  deductions: Deduction[];
  refunds: Refund[];
}

interface DepositsResponse {
  data: Deposit[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_OPTIONS = ['', 'HELD', 'PARTIALLY_RETURNED', 'FULLY_RETURNED', 'FORFEITED'];
const PAGE_SIZE = 25;

const STATUS_COLORS: Record<string, string> = {
  HELD: 'bg-blue-100 text-blue-700',
  PARTIALLY_RETURNED: 'bg-yellow-100 text-yellow-700',
  FULLY_RETURNED: 'bg-green-100 text-green-700',
  FORFEITED: 'bg-red-100 text-red-700',
};

export function DepositsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery<DepositsResponse>({
    queryKey: ['accounting', 'deposits', page, status],
    queryFn: () =>
      api
        .get('/accounting/deposits', {
          params: { page, limit: PAGE_SIZE, ...(status ? { status } : {}) },
        })
        .then((r) => r.data as DepositsResponse),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <AppShell>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{t('deposits.title')}</h2>
        </div>

        {/* Status filter */}
        <div className="flex gap-3">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="flex h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s ? t(`deposits.statuses.${s}`) : t('deposits.allStatuses')}
              </option>
            ))}
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
                    <th className="px-4 py-3 font-medium">{t('deposits.contract')}</th>
                    <th className="px-4 py-3 font-medium">{t('deposits.receivedDate')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('deposits.amount')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('deposits.remaining')}</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.data.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        {t('deposits.noDeposits')}
                      </td>
                    </tr>
                  )}
                  {data?.data.map((dep) => {
                    const totalDeductions = dep.deductions.reduce(
                      (s, d) => s + Number(d.amount),
                      0,
                    );
                    const totalRefunds = dep.refunds.reduce((s, r) => s + Number(r.amount), 0);
                    const remaining = Number(dep.amount) - totalDeductions - totalRefunds;
                    return (
                      <tr key={dep.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link
                            to="/accounting/deposits/$depositId"
                            params={{ depositId: dep.id }}
                            className="text-primary-600 hover:underline font-mono text-xs"
                          >
                            {dep.contractId.slice(0, 8)}…
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {new Date(dep.receivedDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {Number(dep.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {remaining.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              STATUS_COLORS[dep.status] ?? 'bg-gray-100 text-gray-700',
                            )}
                          >
                            {t(`deposits.statuses.${dep.status}`)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

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
    </AppShell>
  );
}
