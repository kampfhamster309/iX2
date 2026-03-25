import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { JournalEntryFormModal } from './JournalEntryFormModal';
import { cn } from '@/lib/utils';

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

export function JournalEntriesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canPost = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';

  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['accounting', 'journal-entries', page],
    queryFn: () =>
      api
        .get<JournalPage>('/accounting/journal-entries', {
          params: { page, limit: PAGE_SIZE },
        })
        .then((r) => r.data),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('accounting.journalEntries')}</h2>
        {canPost && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            {t('accounting.newJournalEntry')}
          </Button>
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
        <>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8" />
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    {t('accounting.date')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('accounting.description')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    {t('accounting.reference')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data.data.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                      {t('accounting.noEntries')}
                    </td>
                  </tr>
                ) : (
                  data.data.flatMap((entry) => {
                    const isOpen = expanded.has(entry.id);
                    return [
                      // Main row
                      <tr
                        key={entry.id}
                        className={cn(
                          'hover:bg-gray-50 cursor-pointer transition-colors',
                          isOpen && 'bg-blue-50',
                        )}
                        onClick={() => toggleRow(entry.id)}
                      >
                        <td className="pl-3 text-gray-400 text-xs select-none">
                          {isOpen ? '▾' : '▸'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5 text-gray-800">{entry.description}</td>
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">
                          {entry.reference ?? '—'}
                        </td>
                      </tr>,
                      // Expanded lines sub-table
                      isOpen && (
                        <tr key={`${entry.id}-lines`}>
                          <td colSpan={4} className="bg-gray-50 px-6 pb-3 pt-1">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-400">
                                  <th className="text-left pb-1 font-medium">
                                    {t('accounting.account')}
                                  </th>
                                  <th className="text-right pb-1 font-medium w-24">
                                    {t('accounting.debit')}
                                  </th>
                                  <th className="text-right pb-1 font-medium w-24">
                                    {t('accounting.credit')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.lines.map((line) => (
                                  <tr key={line.id}>
                                    <td className="py-0.5 text-gray-600">
                                      <span className="font-mono text-gray-400 mr-2">
                                        {line.account.code}
                                      </span>
                                      {line.account.name}
                                    </td>
                                    <td className="py-0.5 text-right font-mono">
                                      {Number(line.debit) > 0 ? Number(line.debit).toFixed(2) : '—'}
                                    </td>
                                    <td className="py-0.5 text-right font-mono">
                                      {Number(line.credit) > 0
                                        ? Number(line.credit).toFixed(2)
                                        : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ),
                    ].filter(Boolean);
                  })
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

      {showForm && <JournalEntryFormModal onClose={() => setShowForm(false)} />}
    </AppShell>
  );
}
