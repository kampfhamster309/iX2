import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { AddDeductionModal } from './AddDeductionModal';
import { RecordRefundModal } from './RecordRefundModal';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Deduction {
  id: string;
  amount: string | number;
  reason: string;
  createdAt?: string;
}

interface Refund {
  id: string;
  amount: string | number;
  refundDate: string;
  reference?: string | null;
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

const STATUS_COLORS: Record<string, string> = {
  HELD: 'bg-blue-100 text-blue-700',
  PARTIALLY_RETURNED: 'bg-yellow-100 text-yellow-700',
  FULLY_RETURNED: 'bg-green-100 text-green-700',
  FORFEITED: 'bg-red-100 text-red-700',
};

export function DepositDetailPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { depositId } = useParams({ strict: false }) as any;
  const [showDeduction, setShowDeduction] = useState(false);
  const [showRefund, setShowRefund] = useState(false);

  const { data: deposit, isLoading } = useQuery<Deposit>({
    queryKey: ['accounting', 'deposits', depositId],
    queryFn: () =>
      api.get(`/accounting/deposits/${depositId as string}`).then((r) => r.data as Deposit),
    enabled: !!depositId,
  });

  const canAct = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';

  if (isLoading || !deposit) {
    return (
      <AppShell>
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      </AppShell>
    );
  }

  const totalDeductions = deposit.deductions.reduce((s, d) => s + Number(d.amount), 0);
  const totalRefunds = deposit.refunds.reduce((s, r) => s + Number(r.amount), 0);
  const remaining = Number(deposit.amount) - totalDeductions - totalRefunds;

  const canModify = canAct && deposit.status !== 'FULLY_RETURNED' && deposit.status !== 'FORFEITED';

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{t('deposits.depositTitle')}</h2>
            <p className="text-sm text-gray-500 mt-1 font-mono">
              {t('deposits.contract')}: {deposit.contractId}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
              STATUS_COLORS[deposit.status] ?? 'bg-gray-100 text-gray-700',
            )}
          >
            {t(`deposits.statuses.${deposit.status}`)}
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{t('deposits.amount')}</p>
            <p className="text-lg font-semibold tabular-nums">
              {Number(deposit.amount).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{t('deposits.returned')}</p>
            <p className="text-lg font-semibold tabular-nums text-amber-700">
              {(totalDeductions + totalRefunds).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{t('deposits.remaining')}</p>
            <p className="text-lg font-semibold tabular-nums text-blue-700">
              {remaining.toFixed(2)}
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          <span className="font-medium">{t('deposits.receivedDate')}: </span>
          {new Date(deposit.receivedDate).toLocaleDateString()}
        </p>

        {/* Actions */}
        {canModify && (
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={() => setShowDeduction(true)}>
              {t('deposits.addDeduction')}
            </Button>
            <Button size="sm" onClick={() => setShowRefund(true)}>
              {t('deposits.recordRefund')}
            </Button>
          </div>
        )}

        {/* Deductions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('deposits.deductions')}</h3>
          {deposit.deductions.length === 0 ? (
            <p className="text-sm text-gray-500">{t('deposits.noDeductions')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t('deposits.reason')}</th>
                    <th className="px-4 py-2 font-medium text-right">{t('deposits.amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deposit.deductions.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-2 text-gray-700">{d.reason}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {Number(d.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Refunds */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('deposits.refunds')}</h3>
          {deposit.refunds.length === 0 ? (
            <p className="text-sm text-gray-500">{t('deposits.noRefunds')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t('deposits.refundDate')}</th>
                    <th className="px-4 py-2 font-medium text-right">{t('deposits.amount')}</th>
                    <th className="px-4 py-2 font-medium">{t('deposits.reference')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deposit.refunds.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-gray-700">
                        {new Date(r.refundDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {Number(r.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{r.reference ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showDeduction && (
        <AddDeductionModal
          depositId={deposit.id}
          remaining={remaining}
          onClose={() => setShowDeduction(false)}
        />
      )}
      {showRefund && (
        <RecordRefundModal
          depositId={deposit.id}
          remaining={remaining}
          onClose={() => setShowRefund(false)}
        />
      )}
    </AppShell>
  );
}
