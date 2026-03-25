import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  nameDe: string;
  type: AccountType;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

interface TrialBalance {
  rows: TrialBalanceRow[];
  grandTotalDebit: number;
  grandTotalCredit: number;
  isBalanced: boolean;
}

const TYPE_ORDER: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

export function AccountsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canPost = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['accounting', 'trial-balance'],
    queryFn: () => api.get<TrialBalance>('/accounting/reports/trial-balance').then((r) => r.data),
  });

  function displayName(row: TrialBalanceRow) {
    return i18n.language === 'de' ? row.nameDe : row.name;
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('accounting.accountsTitle')}</h2>
        {canPost && (
          <Link to="/accounting/journal-entries">
            <span className="inline-flex items-center h-8 px-3 text-sm rounded-md font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors">
              {t('accounting.newJournalEntry')}
            </span>
          </Link>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {isError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {t('app.error')}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {TYPE_ORDER.map((type) => {
            const rows = data.rows.filter((r) => r.type === type);
            return (
              <section key={type} aria-label={t(`accounting.types.${type}`)}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {t(`accounting.types.${type}`)}
                </h3>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                          {t('accounting.code')}
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('accounting.name')}
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                          {t('accounting.balance')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-center text-sm text-gray-400">
                            {t('accounting.noAccounts')}
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.accountId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                              {row.code}
                            </td>
                            <td className="px-4 py-2.5">
                              <Link
                                to="/accounting/accounts/$accountId"
                                params={{ accountId: row.accountId }}
                                className="text-primary-600 hover:underline"
                              >
                                {displayName(row)}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-sm">
                              {row.netBalance.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
