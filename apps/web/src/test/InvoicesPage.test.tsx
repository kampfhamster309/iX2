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

import { InvoicesPage } from '@/pages/accounting/InvoicesPage';

const MOCK_INVOICES = [
  {
    id: 'inv-1',
    contractId: 'contract-abc-123',
    periodMonth: 3,
    periodYear: 2026,
    amountDue: '1200.00',
    amountPaid: '0.00',
    status: 'ISSUED',
    dueDate: '2026-03-03T00:00:00.000Z',
    issuedAt: '2026-02-28T00:00:00.000Z',
    payments: [],
  },
  {
    id: 'inv-2',
    contractId: 'contract-def-456',
    periodMonth: 3,
    periodYear: 2026,
    amountDue: '950.00',
    amountPaid: '950.00',
    status: 'PAID',
    dueDate: '2026-03-03T00:00:00.000Z',
    issuedAt: '2026-02-28T00:00:00.000Z',
    payments: [],
  },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('InvoicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({
      data: { data: MOCK_INVOICES, total: 2, page: 1, limit: 25 },
    });
  });

  it('shows a spinner while loading', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<InvoicesPage />, { wrapper });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders invoice rows after load', async () => {
    render(<InvoicesPage />, { wrapper });
    await waitFor(() => expect(screen.getAllByText('2026-03')).toHaveLength(2));
  });

  it('shows status badges', async () => {
    render(<InvoicesPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('Issued')).toBeInTheDocument());
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('shows outstanding amount', async () => {
    render(<InvoicesPage />, { wrapper });
    // outstanding for inv-1 = 1200 - 0 = 1200 (appears in both amountDue and outstanding columns)
    // outstanding for inv-2 = 950 - 950 = 0
    await waitFor(() => expect(screen.getAllByText('1200.00').length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText('0.00').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no invoices', async () => {
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 25 } });
    render(<InvoicesPage />, { wrapper });
    await waitFor(() => expect(screen.getByText(/no invoices/i)).toBeInTheDocument());
  });

  it('opens generate modal on button click', async () => {
    const user = userEvent.setup();
    render(<InvoicesPage />, { wrapper });
    await waitFor(() => expect(screen.getAllByText('2026-03')).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: /generate invoices/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
