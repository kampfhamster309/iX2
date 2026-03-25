import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface Account {
  id: string;
  code: string;
  name: string;
  nameDe: string;
  type: string;
}

interface AccountBalance {
  accountId: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

interface JournalLine {
  id: string;
  debit: number;
  credit: number;
  description: string | null;
  account: { id: string; code: string; name: string };
}

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  propertyId: string | null;
  lines: JournalLine[];
}

interface JournalPage {
  data: JournalEntry[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 20;

export function AccountDetailPage() {
  const { t, i18n } = useTranslation();
  const { accountId } = useParams({ strict: false }) as { accountId: string };
  const [page, setPage] = useState(1);

  const { data: account, isLoading: loadingAccount } = useQuery({
    queryKey: ['accounting', 'accounts', accountId],
    queryFn: () => api.get<Account>(`/accounting/accounts/${accountId}`).then((r) => r.data),
    enabled: !!accountId,
  });

  const { data: balance, isLoading: loadingBalance } = useQuery({
    queryKey: ['accounting', 'accounts', accountId, 'balance'],
    queryFn: () =>
      api.get<AccountBalance>(`/accounting/accounts/${accountId}/balance`).then((r) => r.data),
    enabled: !!accountId,
  });

  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ['accounting', 'journal-entries', { accountId, page }],
    queryFn: () =>
      api
        .get<JournalPage>('/accounting/journal-entries', {
          params: { accountId, page, limit: PAGE_SIZE },
        })
        .then((r) => r.data),
    enabled: !!accountId,
  });

  const totalPages = entries ? Math.ceil(entries.total / PAGE_SIZE) : 1;
  const isLoading = loadingAccount || loadingBalance || loadingEntries;

  function displayName(acc: Account) {
    return i18n.language === 'de' ? acc.nameDe : acc.name;
  }

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/accounting/accounts">
          <Button variant="ghost" size="sm">
            ← {t('common.back')}
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">
          {account ? `${account.code} — ${displayName(account)}` : '...'}
        </h2>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {balance && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">
                {t('accounting.totalDebit')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-mono font-semibold text-gray-900">
                {balance.totalDebit.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">
                {t('accounting.totalCredit')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-mono font-semibold text-gray-900">
                {balance.totalCredit.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">
                {t('accounting.netBalance')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-mono font-semibold text-gray-900">
                {balance.balance.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {entries && (
        <>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {t('accounting.journalLines')}
          </h3>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('accounting.date')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('accounting.description')}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    {t('accounting.debit')}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    {t('accounting.credit')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {entries.data.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                      {t('accounting.noEntries')}
                    </td>
                  </tr>
                ) : (
                  entries.data.flatMap((entry) =>
                    entry.lines
                      .filter((l) => l.account.id === accountId)
                      .map((line) => (
                        <tr key={`${entry.id}-${line.id}`} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                            {new Date(entry.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700">
                            {line.description ?? entry.description}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {Number(line.debit) > 0 ? Number(line.debit).toFixed(2) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {Number(line.credit) > 0 ? Number(line.credit).toFixed(2) : '—'}
                          </td>
                        </tr>
                      )),
                  )
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t('accounting.prev')}
              </Button>
              <span>
                {t('accounting.page')} {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('accounting.next')}
              </Button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
