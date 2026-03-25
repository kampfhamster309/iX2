import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface FormData {
  amount: string;
  refundDate: string;
  reference: string;
}

interface Props {
  depositId: string;
  remaining: number;
  onClose: () => void;
}

export function RecordRefundModal({ depositId, remaining, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      amount: remaining.toFixed(2),
      refundDate: new Date().toISOString().split('T')[0],
      reference: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api
        .post(`/accounting/deposits/${depositId}/refunds`, {
          amount: Number(data.amount),
          refundDate: data.refundDate,
          reference: data.reference || undefined,
        })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounting', 'deposits'] });
      onClose();
    },
  });

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
          <h3 className="text-lg font-semibold text-gray-900">{t('deposits.recordRefund')}</h3>
        </div>
        <form onSubmit={(e) => void handleSubmit((data) => mutation.mutate(data))(e)}>
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="ref-amount" className="block text-sm font-medium text-gray-700 mb-1">
                {t('deposits.amount')}
              </label>
              <input
                id="ref-amount"
                type="number"
                step="0.01"
                min="0.01"
                className={inputCls}
                {...register('amount', {
                  required: true,
                  min: 0.01,
                  validate: (v) =>
                    Number(v) <= remaining ||
                    t('deposits.exceedsBalance', { balance: remaining.toFixed(2) }),
                })}
              />
              {errors.amount && (
                <p className="text-xs text-red-600 mt-1" data-testid="refund-error">
                  {typeof errors.amount.message === 'string'
                    ? errors.amount.message
                    : t('deposits.exceedsBalance', { balance: remaining.toFixed(2) })}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="ref-date" className="block text-sm font-medium text-gray-700 mb-1">
                {t('deposits.refundDate')}
              </label>
              <input
                id="ref-date"
                type="date"
                className={inputCls}
                {...register('refundDate', { required: true })}
              />
            </div>

            <div>
              <label htmlFor="ref-ref" className="block text-sm font-medium text-gray-700 mb-1">
                {t('deposits.reference')}
              </label>
              <input id="ref-ref" type="text" className={inputCls} {...register('reference')} />
            </div>

            {mutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}
          </div>

          <div className="flex justify-end gap-3 px-5 pb-5">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {t('deposits.recordRefund')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
