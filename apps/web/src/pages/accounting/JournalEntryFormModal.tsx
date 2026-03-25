import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface Account {
  id: string;
  code: string;
  name: string;
}

interface Property {
  id: string;
  name: string;
}

interface JournalLine {
  accountId: string;
  debit: string;
  credit: string;
}

interface FormValues {
  date: string;
  description: string;
  reference: string;
  propertyId: string;
  lines: JournalLine[];
}

interface Props {
  onClose: () => void;
}

export function JournalEntryFormModal({ onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting', 'accounts-list'],
    queryFn: () => api.get<Account[]>('/accounting/accounts').then((r) => r.data),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties-list'],
    queryFn: () => api.get<{ data: Property[] }>('/properties').then((r) => r.data.data),
  });

  const { register, control, handleSubmit, watch, formState } = useForm<FormValues>({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      description: '',
      reference: '',
      propertyId: '',
      lines: [
        { accountId: '', debit: '', credit: '' },
        { accountId: '', debit: '', credit: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const watchedLines = watch('lines');
  const totalDebit = watchedLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = watchedLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.001;

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post('/accounting/journal-entries', {
        date: values.date,
        description: values.description,
        reference: values.reference || undefined,
        propertyId: values.propertyId || undefined,
        lines: values.lines.map((l) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounting', 'journal-entries'] });
      void qc.invalidateQueries({ queryKey: ['accounting', 'trial-balance'] });
      onClose();
    },
  });

  const onSubmit = (values: FormValues) => {
    if (!isBalanced) return;
    mutation.mutate(values);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t('accounting.newJournalEntry')}</h3>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('accounting.date')} *
              </label>
              <input
                type="date"
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('date', { required: true })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('accounting.reference')}
              </label>
              <Input placeholder={t('accounting.reference')} {...register('reference')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('accounting.description')} *
            </label>
            <Input
              placeholder={t('accounting.description')}
              {...register('description', { required: true })}
              error={formState.errors.description ? t('accounting.description') : undefined}
            />
          </div>

          {properties.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('accounting.property')}
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('propertyId')}
              >
                <option value="">—</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Journal lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{t('accounting.lines')}</span>
              <button
                type="button"
                className="text-xs text-primary-600 hover:underline"
                onClick={() => append({ accountId: '', debit: '', credit: '' })}
              >
                + {t('accounting.addLine')}
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[2fr_1fr_1fr_28px] gap-2 px-1 mb-1">
              <span className="text-xs font-medium text-gray-500">{t('accounting.account')}</span>
              <span className="text-xs font-medium text-gray-500">{t('accounting.debit')}</span>
              <span className="text-xs font-medium text-gray-500">{t('accounting.credit')}</span>
              <span />
            </div>

            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-[2fr_1fr_1fr_28px] gap-2">
                  <select
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    {...register(`lines.${idx}.accountId`, { required: true })}
                  >
                    <option value="">{t('accounting.account')}</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    {...register(`lines.${idx}.debit`)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    {...register(`lines.${idx}.credit`)}
                  />
                  <button
                    type="button"
                    aria-label={t('accounting.removeLine')}
                    disabled={fields.length <= 2}
                    onClick={() => remove(idx)}
                    className="flex items-center justify-center h-9 w-7 rounded text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Totals row */}
            <div className="mt-3 flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
              <div className="flex gap-6 text-gray-600">
                <span>
                  {t('accounting.totalDebits')}:{' '}
                  <strong className="font-mono">{totalDebit.toFixed(2)}</strong>
                </span>
                <span>
                  {t('accounting.totalCredits')}:{' '}
                  <strong className="font-mono">{totalCredit.toFixed(2)}</strong>
                </span>
              </div>
              <span
                data-testid="balance-status"
                className={cn(
                  'font-medium text-xs px-2 py-0.5 rounded-full',
                  isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600',
                )}
              >
                {isBalanced ? t('accounting.balanced') : t('accounting.unbalanced')}
              </span>
            </div>
          </div>

          {mutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!isBalanced} loading={mutation.isPending}>
              {t('accounting.submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
