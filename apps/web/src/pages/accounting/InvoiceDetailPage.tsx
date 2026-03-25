import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { RecordPaymentModal } from './RecordPaymentModal';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface Payment {
  id: string;
  amount: string | number;
  paymentDate: string;
  method: string;
  reference?: string | null;
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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ISSUED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-400',
};

export function InvoiceDetailPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { invoiceId } = useParams({ strict: false }) as any;
  const [showPayment, setShowPayment] = useState(false);

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ['accounting', 'invoices', invoiceId],
    queryFn: () =>
      api.get(`/accounting/invoices/${invoiceId as string}`).then((r) => r.data as Invoice),
    enabled: !!invoiceId,
  });

  const issueMutation = useMutation({
    mutationFn: () =>
      api.post(`/accounting/invoices/${invoiceId as string}/issue`).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['accounting', 'invoices'] }),
  });

  const canActOnInvoice = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';

  if (isLoading || !invoice) {
    return (
      <AppShell>
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      </AppShell>
    );
  }

  const outstanding = Number(invoice.amountDue) - Number(invoice.amountPaid);

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t('invoices.period')}: {invoice.periodYear}-
              {String(invoice.periodMonth).padStart(2, '0')}
            </h2>
            <p className="text-sm text-gray-500 mt-1 font-mono">
              {t('invoices.contract')}: {invoice.contractId}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
              STATUS_COLORS[invoice.status] ?? 'bg-gray-100 text-gray-700',
            )}
          >
            {t(`invoices.statuses.${invoice.status}`)}
          </span>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{t('invoices.amountDue')}</p>
            <p className="text-lg font-semibold tabular-nums">
              {Number(invoice.amountDue).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{t('invoices.amountPaid')}</p>
            <p className="text-lg font-semibold tabular-nums text-green-700">
              {Number(invoice.amountPaid).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{t('invoices.outstanding')}</p>
            <p className="text-lg font-semibold tabular-nums text-red-700">
              {outstanding.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Dates */}
        <div className="flex gap-6 text-sm text-gray-600">
          <div>
            <span className="font-medium">{t('invoices.dueDate')}: </span>
            {new Date(invoice.dueDate).toLocaleDateString()}
          </div>
          {invoice.issuedAt && (
            <div>
              <span className="font-medium">{t('invoices.issuedAt')}: </span>
              {new Date(invoice.issuedAt).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Actions */}
        {canActOnInvoice && (
          <div className="flex gap-3">
            {invoice.status === 'DRAFT' && (
              <Button onClick={() => issueMutation.mutate()} loading={issueMutation.isPending}>
                {t('invoices.issue')}
              </Button>
            )}
            {(invoice.status === 'ISSUED' ||
              invoice.status === 'PARTIALLY_PAID' ||
              invoice.status === 'OVERDUE') && (
              <Button onClick={() => setShowPayment(true)}>{t('invoices.recordPayment')}</Button>
            )}
          </div>
        )}

        {issueMutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}

        {/* Payment history */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {t('invoices.paymentHistory')}
          </h3>
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-gray-500">{t('invoices.noPayments')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t('invoices.paymentDate')}</th>
                    <th className="px-4 py-2 font-medium text-right">
                      {t('invoices.paymentAmount')}
                    </th>
                    <th className="px-4 py-2 font-medium">{t('invoices.paymentMethod')}</th>
                    <th className="px-4 py-2 font-medium">{t('invoices.paymentReference')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 text-gray-700">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {Number(p.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {t(`invoices.methods.${p.method}`)}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{p.reference ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showPayment && invoice && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setShowPayment(false)}
          onSuccess={() => setShowPayment(false)}
        />
      )}
    </AppShell>
  );
}
