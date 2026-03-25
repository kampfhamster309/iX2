import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface GenerateResult {
  created: number;
  skipped: number;
}

interface Props {
  onClose: () => void;
}

export function GenerateInvoicesModal({ onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [result, setResult] = useState<GenerateResult | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api
        .post<GenerateResult>('/accounting/invoices/generate', { month, year })
        .then((r) => r.data),
    onSuccess: (data) => {
      setResult(data);
      void qc.invalidateQueries({ queryKey: ['accounting', 'invoices'] });
    },
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-lg w-full max-w-sm shadow-xl">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t('invoices.generate')}</h3>
        </div>
        <div className="p-5 space-y-4">
          {result ? (
            <p className="text-sm text-gray-700">
              {t('invoices.generated', { created: result.created, skipped: result.skipped })}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('invoices.month')}
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('invoices.year')}
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {mutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <Button variant="secondary" onClick={onClose}>
            {result ? t('common.back') : t('common.cancel')}
          </Button>
          {!result && (
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
              {t('invoices.generate')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
