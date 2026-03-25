import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';

vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: '1', email: 'admin@ix2.local', role: 'ADMIN' } }),
}));

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));

import { ReportsPage } from '@/pages/accounting/ReportsPage';

const MOCK_TRIAL_BALANCE = {
  rows: [
    {
      accountId: 'acc-1',
      code: '1000',
      name: 'Bank',
      nameDe: 'Bank',
      type: 'ASSET',
      totalDebit: 5000,
      totalCredit: 2000,
      netBalance: 3000,
    },
    {
      accountId: 'acc-2',
      code: '4000',
      name: 'Rental Income',
      nameDe: 'Mieteinnahmen',
      type: 'INCOME',
      totalDebit: 0,
      totalCredit: 3000,
      netBalance: -3000,
    },
  ],
  grandTotalDebit: 5000,
  grandTotalCredit: 5000,
  isBalanced: true,
};

const MOCK_RENT_ROLL = {
  rows: [
    {
      contractId: 'c-1',
      property: { id: 'p-1', name: 'Main St', address: '1 Main St' },
      unit: { id: 'u-1', name: 'Unit 1A', type: 'APARTMENT' },
      tenantName: 'John Doe',
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: null,
      rentAmount: 1200,
      outstandingBalance: 0,
      depositHeld: 2400,
    },
  ],
  count: 1,
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Properties query
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/properties') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      return Promise.resolve({ data: MOCK_TRIAL_BALANCE });
    });
  });

  it('renders the page title', () => {
    render(<ReportsPage />, { wrapper });
    expect(screen.getByText('Financial Reports')).toBeInTheDocument();
  });

  it('shows "no data" message before Generate is clicked', () => {
    render(<ReportsPage />, { wrapper });
    expect(screen.getByText(/select filters and click generate/i)).toBeInTheDocument();
  });

  it('renders tab buttons', () => {
    render(<ReportsPage />, { wrapper });
    expect(screen.getByRole('button', { name: /trial balance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /profit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /balance sheet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rent roll/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cash flow/i })).toBeInTheDocument();
  });

  it('fetches and renders trial balance after Generate', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper });

    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => expect(screen.getByText('In Balance')).toBeInTheDocument());
    expect(screen.getByText('Bank')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('shows spinner while fetching', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/properties') return Promise.resolve({ data: { data: [] } });
      return new Promise(() => {});
    });

    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper });
    await user.click(screen.getByRole('button', { name: /generate/i }));

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('resets to no-data when switching tabs', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper });

    await user.click(screen.getByRole('button', { name: /generate/i }));
    await waitFor(() => expect(screen.getByText('In Balance')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /profit/i }));
    expect(screen.getByText(/select filters and click generate/i)).toBeInTheDocument();
  });

  it('renders rent roll with property and tenant data', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/properties') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: MOCK_RENT_ROLL });
    });

    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper });

    await user.click(screen.getByRole('button', { name: /rent roll/i }));
    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => expect(screen.getByText('Main St')).toBeInTheDocument());
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getAllByText('1200.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2400.00').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state in rent roll when no contracts', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/properties') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { rows: [], count: 0 } });
    });

    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper });

    await user.click(screen.getByRole('button', { name: /rent roll/i }));
    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => expect(screen.getByText(/no active contracts/i)).toBeInTheDocument());
  });
});
