import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'trialBalance' | 'profitLoss' | 'balanceSheet' | 'rentRoll' | 'cashFlow';

interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  propertyId: string;
}

interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  nameDe: string | null;
  type: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  grandTotalDebit: number;
  grandTotalCredit: number;
  isBalanced: boolean;
}

interface PLRow {
  accountId: string;
  code: string;
  name: string;
  nameDe: string | null;
  amount: number;
}

interface ProfitLossResult {
  income: PLRow[];
  expenses: PLRow[];
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

interface BSRow {
  accountId: string;
  code: string;
  name: string;
  nameDe: string | null;
  balance: number;
}

interface BalanceSheetResult {
  assets: BSRow[];
  liabilities: BSRow[];
  equity: BSRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

interface RentRollRow {
  contractId: string;
  property: { id: string; name: string; address: string };
  unit: { id: string; name: string; type: string };
  tenantName: string;
  startDate: string;
  endDate: string | null;
  rentAmount: number;
  outstandingBalance: number;
  depositHeld: number;
}

interface RentRollResult {
  rows: RentRollRow[];
  count: number;
}

interface CashFlowEntry {
  date: string;
  description: string;
  reference: string | null;
  cashIn: number;
  cashOut: number;
}

interface CashFlowResult {
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
  entries: CashFlowEntry[];
}

interface Property {
  id: string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  'flex h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

function fmt(n: number) {
  return n.toFixed(2);
}

async function downloadPdf(
  endpoint: string,
  filename: string,
  params: Record<string, string | undefined>,
) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  ) as Record<string, string>;
  const response = await api.get(endpoint, { responseType: 'blob', params: filtered });
  const url = URL.createObjectURL(
    new Blob([response.data as BlobPart], { type: 'application/pdf' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-report components ────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <tr className="bg-gray-100">
      <td
        colSpan={10}
        className="px-4 py-2 text-xs font-bold text-gray-600 uppercase tracking-wide"
      >
        {title}
      </td>
    </tr>
  );
}

function TrialBalanceReport({ data, lang }: { data: TrialBalanceResult; lang: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
            data.isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
          )}
        >
          {data.isBalanced ? t('reports.inBalance') : t('reports.outOfBalance')}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">{t('reports.code')}</th>
              <th className="px-4 py-2 font-medium">{t('reports.account')}</th>
              <th className="px-4 py-2 font-medium">{t('reports.type')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('accounting.totalDebit')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('accounting.totalCredit')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('accounting.netBalance')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.rows.map((r) => (
              <tr key={r.accountId} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.code}</td>
                <td className="px-4 py-2 text-gray-800">
                  {lang === 'de' && r.nameDe ? r.nameDe : r.name}
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">
                  {t(`accounting.types.${r.type}`)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(r.totalDebit)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(r.totalCredit)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">
                  {fmt(r.netBalance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-bold text-sm border-t-2 border-gray-300">
            <tr>
              <td colSpan={3} className="px-4 py-2">
                {t('reports.grandTotal')}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt(data.grandTotalDebit)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt(data.grandTotalCredit)}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {fmt(data.grandTotalDebit - data.grandTotalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ProfitLossReport({
  data,
  params,
  lang,
}: {
  data: ProfitLossResult;
  params: Record<string, string | undefined>;
  lang: string;
}) {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);

  const handlePdf = async () => {
    setDownloading(true);
    try {
      await downloadPdf('/accounting/reports/profit-loss/pdf', 'profit-loss.pdf', params);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handlePdf()}
          loading={downloading}
        >
          {t('reports.exportPdf')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            <SectionHeader title={t('reports.income')} />
            {data.income.map((r) => (
              <tr key={r.accountId} className="hover:bg-gray-50">
                <td className="px-4 py-2 pl-8 text-gray-700">
                  {r.code} — {lang === 'de' && r.nameDe ? r.nameDe : r.name}
                </td>
                <td className="px-4 py-2 text-right tabular-nums w-36">{fmt(r.amount)}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-4 py-2">{t('reports.totalIncome')}</td>
              <td className="px-4 py-2 text-right tabular-nums text-green-700">
                {fmt(data.totalIncome)}
              </td>
            </tr>
            <SectionHeader title={t('reports.expenses')} />
            {data.expenses.map((r) => (
              <tr key={r.accountId} className="hover:bg-gray-50">
                <td className="px-4 py-2 pl-8 text-gray-700">
                  {r.code} — {lang === 'de' && r.nameDe ? r.nameDe : r.name}
                </td>
                <td className="px-4 py-2 text-right tabular-nums w-36">{fmt(r.amount)}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-4 py-2">{t('reports.totalExpenses')}</td>
              <td className="px-4 py-2 text-right tabular-nums text-red-700">
                {fmt(data.totalExpenses)}
              </td>
            </tr>
            <tr className="bg-gray-900 text-white font-bold">
              <td className="px-4 py-3">{t('reports.netIncome')}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(data.netIncome)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BalanceSheetReport({ data, lang }: { data: BalanceSheetResult; lang: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
            data.isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
          )}
        >
          {data.isBalanced ? t('reports.balanced') : t('reports.unbalanced')}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            <SectionHeader title={t('reports.assets')} />
            {data.assets.map((r) => (
              <tr key={r.accountId} className="hover:bg-gray-50">
                <td className="px-4 py-2 pl-8 text-gray-700">
                  {r.code} — {lang === 'de' && r.nameDe ? r.nameDe : r.name}
                </td>
                <td className="px-4 py-2 text-right tabular-nums w-36">{fmt(r.balance)}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-4 py-2">{t('reports.totalAssets')}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt(data.totalAssets)}</td>
            </tr>
            <SectionHeader title={t('reports.liabilities')} />
            {data.liabilities.map((r) => (
              <tr key={r.accountId} className="hover:bg-gray-50">
                <td className="px-4 py-2 pl-8 text-gray-700">
                  {r.code} — {lang === 'de' && r.nameDe ? r.nameDe : r.name}
                </td>
                <td className="px-4 py-2 text-right tabular-nums w-36">{fmt(r.balance)}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-4 py-2">{t('reports.totalLiabilities')}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt(data.totalLiabilities)}</td>
            </tr>
            <SectionHeader title={t('reports.equity')} />
            {data.equity.map((r) => (
              <tr key={r.accountId} className="hover:bg-gray-50">
                <td className="px-4 py-2 pl-8 text-gray-700">
                  {r.code} — {lang === 'de' && r.nameDe ? r.nameDe : r.name}
                </td>
                <td className="px-4 py-2 text-right tabular-nums w-36">{fmt(r.balance)}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-4 py-2">{t('reports.totalEquity')}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt(data.totalEquity)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RentRollReport({
  data,
  params,
}: {
  data: RentRollResult;
  params: Record<string, string | undefined>;
}) {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);

  const totalRent = data.rows.reduce((s, r) => s + r.rentAmount, 0);
  const totalOutstanding = data.rows.reduce((s, r) => s + r.outstandingBalance, 0);
  const totalDeposit = data.rows.reduce((s, r) => s + r.depositHeld, 0);

  const handlePdf = async () => {
    setDownloading(true);
    try {
      await downloadPdf('/accounting/reports/rent-roll/pdf', 'rent-roll.pdf', params);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handlePdf()}
          loading={downloading}
        >
          {t('reports.exportPdf')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">{t('reports.property')}</th>
              <th className="px-4 py-2 font-medium">{t('reports.unit')}</th>
              <th className="px-4 py-2 font-medium">{t('reports.tenant')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('reports.rentAmount')}</th>
              <th className="px-4 py-2 font-medium">{t('reports.startDate')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('reports.outstanding')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('reports.depositHeld')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {t('reports.noActiveContracts')}
                </td>
              </tr>
            )}
            {data.rows.map((r) => (
              <tr key={r.contractId} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-800">{r.property.name}</td>
                <td className="px-4 py-2 text-gray-600">{r.unit.name}</td>
                <td className="px-4 py-2 text-gray-700">{r.tenantName}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(r.rentAmount)}</td>
                <td className="px-4 py-2 text-gray-600">
                  {new Date(r.startDate).toLocaleDateString()}
                </td>
                <td
                  className={cn(
                    'px-4 py-2 text-right tabular-nums',
                    r.outstandingBalance > 0 ? 'text-red-700 font-medium' : 'text-gray-600',
                  )}
                >
                  {fmt(r.outstandingBalance)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-blue-700">
                  {fmt(r.depositHeld)}
                </td>
              </tr>
            ))}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot className="bg-gray-50 font-bold text-sm border-t-2 border-gray-300">
              <tr>
                <td colSpan={3} className="px-4 py-2">
                  {t('reports.total')} ({data.count})
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(totalRent)}</td>
                <td />
                <td className="px-4 py-2 text-right tabular-nums">{fmt(totalOutstanding)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(totalDeposit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function CashFlowReport({ data }: { data: CashFlowResult }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-xs text-green-600 mb-1">{t('reports.cashIn')}</p>
          <p className="text-lg font-semibold tabular-nums text-green-700">{fmt(data.cashIn)}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-xs text-red-600 mb-1">{t('reports.cashOut')}</p>
          <p className="text-lg font-semibold tabular-nums text-red-700">{fmt(data.cashOut)}</p>
        </div>
        <div className={cn('rounded-lg p-4', data.netCashFlow >= 0 ? 'bg-blue-50' : 'bg-amber-50')}>
          <p
            className={cn(
              'text-xs mb-1',
              data.netCashFlow >= 0 ? 'text-blue-600' : 'text-amber-600',
            )}
          >
            {t('reports.netCashFlow')}
          </p>
          <p
            className={cn(
              'text-lg font-semibold tabular-nums',
              data.netCashFlow >= 0 ? 'text-blue-700' : 'text-amber-700',
            )}
          >
            {fmt(data.netCashFlow)}
          </p>
        </div>
      </div>

      {/* Entries table */}
      {data.entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">{t('reports.date')}</th>
                <th className="px-4 py-2 font-medium">{t('reports.description')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('reports.cashIn')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('reports.cashOut')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.entries.map((e, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">
                    {new Date(e.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{e.description}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-green-700">
                    {e.cashIn > 0 ? fmt(e.cashIn) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-700">
                    {e.cashOut > 0 ? fmt(e.cashOut) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'trialBalance', labelKey: 'reports.tabs.trialBalance' },
  { key: 'profitLoss', labelKey: 'reports.tabs.profitLoss' },
  { key: 'balanceSheet', labelKey: 'reports.tabs.balanceSheet' },
  { key: 'rentRoll', labelKey: 'reports.tabs.rentRoll' },
  { key: 'cashFlow', labelKey: 'reports.tabs.cashFlow' },
];

const REPORT_ENDPOINTS: Record<TabKey, string> = {
  trialBalance: '/accounting/reports/trial-balance',
  profitLoss: '/accounting/reports/profit-loss',
  balanceSheet: '/accounting/reports/balance-sheet',
  rentRoll: '/accounting/reports/rent-roll',
  cashFlow: '/accounting/reports/cash-flow',
};

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('trialBalance');
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: '',
    dateTo: '',
    propertyId: '',
  });
  const [triggered, setTriggered] = useState(false);

  const { data: propertiesResp } = useQuery<{ data: Property[] }>({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then((r) => r.data as { data: Property[] }),
  });
  const properties = propertiesResp?.data ?? [];

  const queryParams = {
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
    ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
  };

  const { data: reportData, isFetching } = useQuery({
    queryKey: ['accounting', 'reports', activeTab, queryParams],
    queryFn: () =>
      api.get(REPORT_ENDPOINTS[activeTab], { params: queryParams }).then((r) => r.data),
    enabled: triggered,
  });

  const pdfParams: Record<string, string | undefined> = {
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    propertyId: filters.propertyId || undefined,
  };

  return (
    <AppShell>
      <div className="p-6 space-y-5">
        <h2 className="text-xl font-semibold text-gray-900">{t('reports.title')}</h2>

        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('reports.dateFrom')}
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('reports.dateTo')}
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('accounting.property')}
            </label>
            <select
              value={filters.propertyId}
              onChange={(e) => setFilters((f) => ({ ...f, propertyId: e.target.value }))}
              className={inputCls}
            >
              <option value="">{t('reports.allProperties')}</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => {
              setTriggered(true);
              // Force re-fetch by toggling key if already triggered
              if (triggered) {
                void Promise.resolve().then(() => setTriggered(true));
              }
            }}
          >
            {t('reports.generate')}
          </Button>
        </div>

        {/* Tab navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setTriggered(false);
                }}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                )}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </nav>
        </div>

        {/* Report content */}
        {!triggered && (
          <p className="text-sm text-gray-500 py-8 text-center">{t('reports.noData')}</p>
        )}

        {triggered && isFetching && (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        )}

        {triggered && !isFetching && reportData && (
          <>
            {activeTab === 'trialBalance' && (
              <TrialBalanceReport data={reportData as TrialBalanceResult} lang={i18n.language} />
            )}
            {activeTab === 'profitLoss' && (
              <ProfitLossReport
                data={reportData as ProfitLossResult}
                params={pdfParams}
                lang={i18n.language}
              />
            )}
            {activeTab === 'balanceSheet' && (
              <BalanceSheetReport data={reportData as BalanceSheetResult} lang={i18n.language} />
            )}
            {activeTab === 'rentRoll' && (
              <RentRollReport data={reportData as RentRollResult} params={pdfParams} />
            )}
            {activeTab === 'cashFlow' && <CashFlowReport data={reportData as CashFlowResult} />}
          </>
        )}
      </div>
    </AppShell>
  );
}
