import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';

// Suppress Sidebar / AppShell tree (avoids AuthContext + router deps in nav)
vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => (
    <a href={String(to)} data-params={JSON.stringify(params)} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: '1', email: 'admin@ix2.local', role: 'ADMIN' } }),
}));

const mockApi = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));

import { AccountsPage } from '@/pages/accounting/AccountsPage';

const MOCK_TRIAL_BALANCE = {
  isBalanced: true,
  grandTotalDebit: 5000,
  grandTotalCredit: 5000,
  rows: [
    {
      accountId: 'acc-1',
      code: '1000',
      name: 'Bank / Cash',
      nameDe: 'Bank / Kasse',
      type: 'ASSET',
      totalDebit: 5000,
      totalCredit: 2000,
      netBalance: 3000,
    },
    {
      accountId: 'acc-2',
      code: '2200',
      name: 'Accounts Payable',
      nameDe: 'Verbindlichkeiten',
      type: 'LIABILITY',
      totalDebit: 0,
      totalCredit: 500,
      netBalance: 500,
    },
    {
      accountId: 'acc-3',
      code: '4000',
      name: 'Rental Income',
      nameDe: 'Mieteinnahmen',
      type: 'INCOME',
      totalDebit: 0,
      totalCredit: 1500,
      netBalance: 1500,
    },
    {
      accountId: 'acc-4',
      code: '6000',
      name: 'Maintenance',
      nameDe: 'Instandhaltung',
      type: 'EXPENSE',
      totalDebit: 500,
      totalCredit: 0,
      netBalance: 500,
    },
  ],
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('AccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({ data: MOCK_TRIAL_BALANCE });
  });

  it('shows a spinner while loading', () => {
    // never resolves
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<AccountsPage />, { wrapper });
    expect(document.querySelector('svg, [class*=spin], [class*=animate]')).toBeTruthy();
  });

  it('renders account type group headers', async () => {
    render(<AccountsPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('Bank / Cash')).toBeInTheDocument());

    // Type group headers (exact match to avoid clashing with account names)
    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.getByText('Liabilities')).toBeInTheDocument();
    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
  });

  it('renders accounts with code, name, and net balance', async () => {
    render(<AccountsPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('Bank / Cash')).toBeInTheDocument());

    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('3000.00')).toBeInTheDocument(); // netBalance
    expect(screen.getByText('Rental Income')).toBeInTheDocument();
    expect(screen.getByText('1500.00')).toBeInTheDocument();
  });

  it('account name links to detail page', async () => {
    render(<AccountsPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('Bank / Cash')).toBeInTheDocument());

    const link = screen.getByText('Bank / Cash').closest('a');
    expect(link).toHaveAttribute('href', '/accounting/accounts/$accountId');
  });
});
