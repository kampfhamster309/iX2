import { useRef } from 'react';
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

interface Property {
  id: string;
  name: string;
}

interface PropertiesResponse {
  data: Property[];
}

interface FormData {
  propertyId: string;
  accountId: string;
  amount: string;
  date: string;
  vendor: string;
  description: string;
  isPaid: boolean;
  dueDate: string;
}

interface Props {
  onClose: () => void;
}

export function CreateExpenseModal({ onClose }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounting', 'accounts', 'EXPENSE'],
    queryFn: () =>
      api
        .get('/accounting/accounts', { params: { type: 'EXPENSE' } })
        .then((r) => r.data as Account[]),
  });

  const { data: propertiesResp } = useQuery<PropertiesResponse>({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then((r) => r.data as PropertiesResponse),
  });
  const properties = propertiesResp?.data ?? [];

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      propertyId: '',
      accountId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      vendor: '',
      description: '',
      isPaid: true,
      dueDate: '',
    },
  });

  const isPaid = watch('isPaid');

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const expense = await api
        .post('/accounting/expenses', {
          propertyId: data.propertyId,
          accountId: data.accountId,
          amount: Number(data.amount),
          date: data.date,
          vendor: data.vendor || undefined,
          description: data.description,
          isPaid: data.isPaid,
          dueDate: data.isPaid ? undefined : data.dueDate || undefined,
        })
        .then((r) => r.data as { id: string });

      // Upload receipt if file selected
      const file = fileRef.current?.files?.[0];
      if (file) {
        const form = new FormData();
        form.append('file', file);
        await api.post(`/accounting/expenses/${expense.id}/receipt`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      return expense;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounting', 'expenses'] });
      onClose();
    },
  });

  const onSubmit = (data: FormData) => mutation.mutate(data);

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
      <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t('expenses.createExpense')}</h3>
        </div>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Property */}
            <div>
              <label
                htmlFor="exp-property"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('expenses.property')}
              </label>
              <select
                id="exp-property"
                className={inputCls}
                {...register('propertyId', { required: true })}
              >
                <option value="">{t('expenses.selectProperty')}</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {errors.propertyId && (
                <p className="text-xs text-red-600 mt-1">{t('expenses.required')}</p>
              )}
            </div>

            {/* Account */}
            <div>
              <label htmlFor="exp-account" className="block text-sm font-medium text-gray-700 mb-1">
                {t('expenses.account')}
              </label>
              <select
                id="exp-account"
                className={inputCls}
                {...register('accountId', { required: true })}
              >
                <option value="">{t('expenses.selectAccount')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </option>
                ))}
              </select>
              {errors.accountId && (
                <p className="text-xs text-red-600 mt-1">{t('expenses.required')}</p>
              )}
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="exp-amount"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t('expenses.amount')}
                </label>
                <input
                  id="exp-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className={inputCls}
                  {...register('amount', { required: true, min: 0.01 })}
                />
              </div>
              <div>
                <label htmlFor="exp-date" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('expenses.date')}
                </label>
                <input
                  id="exp-date"
                  type="date"
                  className={inputCls}
                  {...register('date', { required: true })}
                />
              </div>
            </div>

            {/* Vendor */}
            <div>
              <label htmlFor="exp-vendor" className="block text-sm font-medium text-gray-700 mb-1">
                {t('expenses.vendor')}
              </label>
              <input id="exp-vendor" type="text" className={inputCls} {...register('vendor')} />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="exp-desc" className="block text-sm font-medium text-gray-700 mb-1">
                {t('expenses.description')}
              </label>
              <input
                id="exp-desc"
                type="text"
                className={inputCls}
                {...register('description', { required: true })}
              />
              {errors.description && (
                <p className="text-xs text-red-600 mt-1">{t('expenses.required')}</p>
              )}
            </div>

            {/* isPaid toggle */}
            <div className="flex items-center gap-2">
              <input
                id="exp-is-paid"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                {...register('isPaid')}
              />
              <label htmlFor="exp-is-paid" className="text-sm font-medium text-gray-700">
                {t('expenses.paidImmediately')}
              </label>
            </div>

            {/* dueDate (only when unpaid) */}
            {!isPaid && (
              <div>
                <label htmlFor="exp-due" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('expenses.dueDate')}
                </label>
                <input
                  id="exp-due"
                  type="date"
                  className={inputCls}
                  {...register('dueDate', { required: !isPaid })}
                />
                {errors.dueDate && (
                  <p className="text-xs text-red-600 mt-1">{t('expenses.required')}</p>
                )}
              </div>
            )}

            {/* Receipt upload */}
            <div>
              <label htmlFor="exp-receipt" className="block text-sm font-medium text-gray-700 mb-1">
                {t('expenses.receipt')}
              </label>
              <input
                id="exp-receipt"
                type="file"
                ref={fileRef}
                accept="image/*,application/pdf"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>

            {mutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}
          </div>

          <div className="flex justify-end gap-3 px-5 pb-5">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {t('common.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
