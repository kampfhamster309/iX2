import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface Payment {
  id: string;
  amount: string | number;
  paymentDate: string;
  method: string;
  reference?: string | null;
}

interface Invoice {
  id: string;
  amountDue: string | number;
  amountPaid: string | number;
}

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: (payment: Payment) => void;
}

interface FormData {
  amount: string;
  paymentDate: string;
  method: 'BANK_TRANSFER' | 'CASH' | 'DIRECT_DEBIT' | 'OTHER';
  reference: string;
}

const METHODS = ['BANK_TRANSFER', 'CASH', 'DIRECT_DEBIT', 'OTHER'] as const;

export function RecordPaymentModal({ invoice, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const outstanding = Number(invoice.amountDue) - Number(invoice.amountPaid);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      amount: outstanding.toFixed(2),
      paymentDate: new Date().toISOString().split('T')[0],
      method: 'BANK_TRANSFER',
      reference: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api
        .post(`/accounting/invoices/${invoice.id}/payments`, {
          amount: Number(data.amount),
          paymentDate: data.paymentDate,
          method: data.method,
          reference: data.reference || undefined,
        })
        .then((r) => r.data as Payment),
    onSuccess: (payment) => {
      void qc.invalidateQueries({ queryKey: ['accounting', 'invoices'] });
      onSuccess(payment);
    },
  });

  const onSubmit = (data: FormData) => mutation.mutate(data);

  const inputCls =
    'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-lg w-full max-w-sm shadow-xl">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t('invoices.recordPayment')}</h3>
        </div>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="rp-amount" className="block text-sm font-medium text-gray-700 mb-1">
                {t('invoices.paymentAmount')}
              </label>
              <input
                id="rp-amount"
                type="number"
                step="0.01"
                min="0.01"
                className={inputCls}
                {...register('amount', {
                  required: true,
                  min: 0.01,
                  validate: (v) =>
                    Number(v) <= outstanding ||
                    t('invoices.overpaymentError', { balance: outstanding.toFixed(2) }),
                })}
              />
              {errors.amount && (
                <p className="text-xs text-red-600 mt-1">
                  {typeof errors.amount.message === 'string'
                    ? errors.amount.message
                    : t('invoices.overpaymentError', { balance: outstanding.toFixed(2) })}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="rp-date" className="block text-sm font-medium text-gray-700 mb-1">
                {t('invoices.paymentDate')}
              </label>
              <input
                id="rp-date"
                type="date"
                className={inputCls}
                {...register('paymentDate', { required: true })}
              />
            </div>

            <div>
              <label htmlFor="rp-method" className="block text-sm font-medium text-gray-700 mb-1">
                {t('invoices.paymentMethod')}
              </label>
              <select id="rp-method" className={inputCls} {...register('method')}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`invoices.methods.${m}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rp-ref" className="block text-sm font-medium text-gray-700 mb-1">
                {t('invoices.paymentReference')}
              </label>
              <input id="rp-ref" type="text" className={inputCls} {...register('reference')} />
            </div>

            {mutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}
          </div>

          <div className="flex justify-end gap-3 px-5 pb-5">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {t('invoices.recordPayment')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
