import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface Account {
  id: string;
  code: string;
  name: string;
  nameDe?: string | null;
}

interface FormData {
  amount: string;
  reason: string;
  accountId: string;
  expenseId: string;
}

interface Props {
  depositId: string;
  remaining: number;
  onClose: () => void;
}

export function AddDeductionModal({ depositId, remaining, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounting', 'accounts', 'all'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data as Account[]),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: { amount: '', reason: '', accountId: '', expenseId: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api
        .post(`/accounting/deposits/${depositId}/deductions`, {
          amount: Number(data.amount),
          reason: data.reason,
          accountId: data.accountId,
          expenseId: data.expenseId || undefined,
        })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounting', 'deposits'] });
      onClose();
    },
  });

  const inputCls =
    'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  const accountLabel = (a: Account) =>
    `${a.code} — ${i18n.language === 'de' && a.nameDe ? a.nameDe : a.name}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-lg w-full max-w-sm shadow-xl">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t('deposits.addDeduction')}</h3>
        </div>
        <form onSubmit={(e) => void handleSubmit((data) => mutation.mutate(data))(e)}>
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="ded-amount" className="block text-sm font-medium text-gray-700 mb-1">
                {t('deposits.amount')}
              </label>
              <input
                id="ded-amount"
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
                <p className="text-xs text-red-600 mt-1">
                  {typeof errors.amount.message === 'string'
                    ? errors.amount.message
                    : t('deposits.exceedsBalance', { balance: remaining.toFixed(2) })}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="ded-reason" className="block text-sm font-medium text-gray-700 mb-1">
                {t('deposits.reason')}
              </label>
              <input
                id="ded-reason"
                type="text"
                className={inputCls}
                {...register('reason', { required: true })}
              />
              {errors.reason && (
                <p className="text-xs text-red-600 mt-1">{t('deposits.required')}</p>
              )}
            </div>

            <div>
              <label htmlFor="ded-account" className="block text-sm font-medium text-gray-700 mb-1">
                {t('deposits.creditAccount')}
              </label>
              <select
                id="ded-account"
                className={inputCls}
                {...register('accountId', { required: true })}
              >
                <option value="">{t('deposits.selectAccount')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </option>
                ))}
              </select>
              {errors.accountId && (
                <p className="text-xs text-red-600 mt-1">{t('deposits.required')}</p>
              )}
            </div>

            <div>
              <label htmlFor="ded-expense" className="block text-sm font-medium text-gray-700 mb-1">
                {t('deposits.expenseRef')}
              </label>
              <input
                id="ded-expense"
                type="text"
                placeholder={t('deposits.expenseRefPlaceholder')}
                className={inputCls}
                {...register('expenseId')}
              />
            </div>

            {mutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}
          </div>

          <div className="flex justify-end gap-3 px-5 pb-5">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {t('deposits.addDeduction')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
