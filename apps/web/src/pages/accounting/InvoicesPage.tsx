import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { GenerateInvoicesModal } from './GenerateInvoicesModal';
import { cn } from '@/lib/utils';

interface Payment {
  id: string;
  amount: string | number;
  paymentDate: string;
  method: string;
}

interface Invoice {
  id: string;
  contractId: string;
  periodMonth: number;
  periodYear: number;
  amountDue: string | number;
  amountPaid: string | number;
  status: string;
  dueDate: string;
  issuedAt: string | null;
  payments: Payment[];
}

interface InvoicesResponse {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_OPTIONS = ['', 'DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED'];
const PAGE_SIZE = 25;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ISSUED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-400',
};

export function InvoicesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);

  const { data, isLoading } = useQuery<InvoicesResponse>({
    queryKey: ['accounting', 'invoices', page, status],
    queryFn: () =>
      api
        .get('/accounting/invoices', {
          params: { page, limit: PAGE_SIZE, ...(status ? { status } : {}) },
        })
        .then((r) => r.data as InvoicesResponse),
  });

  const markOverdueMutation = useMutation({
    mutationFn: () => api.get('/accounting/invoices/overdue/mark').then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['accounting', 'invoices'] }),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <AppShell>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{t('invoices.title')}</h2>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => markOverdueMutation.mutate()}
              loading={markOverdueMutation.isPending}
            >
              {t('invoices.markOverdue')}
            </Button>
            <Button size="sm" onClick={() => setShowGenerate(true)}>
              {t('invoices.generate')}
            </Button>
          </div>
        </div>

        {/* Filters */}
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
                {s ? t(`invoices.statuses.${s}`) : t('invoices.filterStatus')}
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
                    <th className="px-4 py-3 font-medium">{t('invoices.period')}</th>
                    <th className="px-4 py-3 font-medium">{t('invoices.contract')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('invoices.amountDue')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('invoices.amountPaid')}</th>
                    <th className="px-4 py-3 font-medium text-right">
                      {t('invoices.outstanding')}
                    </th>
                    <th className="px-4 py-3 font-medium">{t('invoices.dueDate')}</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.data.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        {t('invoices.noInvoices')}
                      </td>
                    </tr>
                  )}
                  {data?.data.map((inv) => {
                    const outstanding = Number(inv.amountDue) - Number(inv.amountPaid);
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          <Link
                            to="/accounting/invoices/$invoiceId"
                            params={{ invoiceId: inv.id }}
                            className="text-primary-600 hover:underline"
                          >
                            {String(inv.periodYear)}-{String(inv.periodMonth).padStart(2, '0')}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {inv.contractId.slice(0, 8)}…
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {Number(inv.amountDue).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {Number(inv.amountPaid).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {outstanding.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-700',
                            )}
                          >
                            {t(`invoices.statuses.${inv.status}`)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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

      {showGenerate && <GenerateInvoicesModal onClose={() => setShowGenerate(false)} />}
    </AppShell>
  );
}
