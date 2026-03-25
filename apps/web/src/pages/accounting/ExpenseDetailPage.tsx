import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

interface Payable {
  id: string;
  status: string;
  dueDate: string | null;
}

interface Expense {
  id: string;
  propertyId: string;
  amount: string | number;
  date: string;
  vendor: string | null;
  description: string;
  isPaid: boolean;
  receiptPath: string | null;
  account: { id: string; code: string; name: string };
  payable: Payable | null;
}

interface PayFormData {
  paymentDate: string;
  reference: string;
}

export function ExpenseDetailPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { expenseId } = useParams({ strict: false }) as any;
  const [showPayForm, setShowPayForm] = useState(false);

  const { data: expense, isLoading } = useQuery<Expense>({
    queryKey: ['accounting', 'expenses', expenseId],
    queryFn: () =>
      api.get(`/accounting/expenses/${expenseId as string}`).then((r) => r.data as Expense),
    enabled: !!expenseId,
  });

  const { register, handleSubmit } = useForm<PayFormData>({
    defaultValues: {
      paymentDate: new Date().toISOString().split('T')[0],
      reference: '',
    },
  });

  const payMutation = useMutation({
    mutationFn: (data: PayFormData) =>
      api
        .post(`/accounting/expenses/${expenseId as string}/pay`, {
          paymentDate: data.paymentDate,
          reference: data.reference || undefined,
        })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounting', 'expenses'] });
      setShowPayForm(false);
    },
  });

  const canAct = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';

  if (isLoading || !expense) {
    return (
      <AppShell>
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      </AppShell>
    );
  }

  const inputCls =
    'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{expense.description}</h2>
            {expense.vendor && <p className="text-sm text-gray-500 mt-1">{expense.vendor}</p>}
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
              expense.isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {expense.isPaid ? t('expenses.paid') : t('expenses.unpaid')}
          </span>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{t('expenses.amount')}</p>
            <p className="text-lg font-semibold tabular-nums">
              {Number(expense.amount).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{t('expenses.date')}</p>
            <p className="text-base font-medium">{new Date(expense.date).toLocaleDateString()}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 col-span-2">
            <p className="text-xs text-gray-500 mb-1">{t('expenses.account')}</p>
            <p className="text-sm font-medium">
              {expense.account.code} — {expense.account.name}
            </p>
          </div>
        </div>

        {/* Payable info */}
        {expense.payable && (
          <div className="text-sm text-gray-600">
            {expense.payable.dueDate && (
              <p>
                <span className="font-medium">{t('expenses.dueDate')}: </span>
                {new Date(expense.payable.dueDate).toLocaleDateString()}
              </p>
            )}
            <p>
              <span className="font-medium">{t('expenses.payableStatus')}: </span>
              {expense.payable.status}
            </p>
          </div>
        )}

        {/* Receipt */}
        {expense.receiptPath && (
          <div>
            <a
              href={`/api/accounting/expenses/${expense.id}/receipt`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline"
            >
              {t('expenses.viewReceipt')}
            </a>
          </div>
        )}

        {/* Pay action */}
        {canAct && !expense.isPaid && (
          <div>
            {!showPayForm ? (
              <Button onClick={() => setShowPayForm(true)}>{t('expenses.markPaid')}</Button>
            ) : (
              <form
                onSubmit={(e) => void handleSubmit((data) => payMutation.mutate(data))(e)}
                className="space-y-4 border border-gray-200 rounded-lg p-4"
              >
                <h3 className="text-sm font-semibold text-gray-700">{t('expenses.markPaid')}</h3>

                <div>
                  <label
                    htmlFor="pay-date"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {t('invoices.paymentDate')}
                  </label>
                  <input
                    id="pay-date"
                    type="date"
                    className={inputCls}
                    {...register('paymentDate', { required: true })}
                  />
                </div>

                <div>
                  <label htmlFor="pay-ref" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('invoices.paymentReference')}
                  </label>
                  <input id="pay-ref" type="text" className={inputCls} {...register('reference')} />
                </div>

                {payMutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}

                <div className="flex gap-3">
                  <Button type="submit" loading={payMutation.isPending}>
                    {t('expenses.confirmPayment')}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowPayForm(false)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
