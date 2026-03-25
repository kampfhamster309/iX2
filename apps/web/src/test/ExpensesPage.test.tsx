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

import { ExpensesPage } from '@/pages/accounting/ExpensesPage';

const MOCK_EXPENSES = [
  {
    id: 'exp-1',
    propertyId: 'prop-1',
    amount: '350.00',
    date: '2026-03-10T00:00:00.000Z',
    vendor: 'Fix-It GmbH',
    description: 'Plumbing repair',
    isPaid: true,
    account: { id: 'acc-6', code: '6100', name: 'Repairs & Maintenance' },
    payable: null,
  },
  {
    id: 'exp-2',
    propertyId: 'prop-1',
    amount: '120.00',
    date: '2026-03-15T00:00:00.000Z',
    vendor: null,
    description: 'Cleaning service',
    isPaid: false,
    account: { id: 'acc-7', code: '6200', name: 'Cleaning' },
    payable: { id: 'pay-1', status: 'PENDING', dueDate: '2026-04-01T00:00:00.000Z' },
  },
];

const MOCK_UNPAID = {
  data: [MOCK_EXPENSES[1]],
  total: 1,
  page: 1,
  limit: 200,
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('ExpensesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      const isPaid = config?.params?.isPaid;
      if (isPaid === 'false') {
        return Promise.resolve({ data: MOCK_UNPAID });
      }
      return Promise.resolve({
        data: { data: MOCK_EXPENSES, total: 2, page: 1, limit: 25 },
      });
    });
  });

  it('shows a spinner while loading', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<ExpensesPage />, { wrapper });
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(1);
  });

  it('renders expense rows after load', async () => {
    render(<ExpensesPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('Plumbing repair')).toBeInTheDocument());
    expect(screen.getByText('Cleaning service')).toBeInTheDocument();
  });

  it('shows paid and unpaid badges', async () => {
    render(<ExpensesPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('Plumbing repair')).toBeInTheDocument());
    expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Unpaid').length).toBeGreaterThanOrEqual(1);
  });

  it('shows payables summary banner for unpaid expenses', async () => {
    render(<ExpensesPage />, { wrapper });
    await waitFor(() => expect(screen.getByText(/pending payables/i)).toBeInTheDocument());
    expect(screen.getAllByText(/120\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no expenses', async () => {
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 25 } });
    render(<ExpensesPage />, { wrapper });
    await waitFor(() => expect(screen.getByText(/no expenses/i)).toBeInTheDocument());
  });

  it('opens create expense modal on button click', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((url: string) => {
      if ((url as string).includes('accounts')) return Promise.resolve({ data: [] });
      if ((url as string).includes('properties')) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: MOCK_EXPENSES, total: 2, page: 1, limit: 25 } });
    });
    render(<ExpensesPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('Plumbing repair')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /new expense/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
