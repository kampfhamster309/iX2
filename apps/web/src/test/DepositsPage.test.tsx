import { render, screen, waitFor } from '@testing-library/react';
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

import { DepositsPage } from '@/pages/accounting/DepositsPage';

const MOCK_DEPOSITS = [
  {
    id: 'dep-1',
    contractId: 'contract-abc-111',
    propertyId: 'prop-1',
    amount: '2400.00',
    receivedDate: '2026-01-15T00:00:00.000Z',
    status: 'HELD',
    deductions: [],
    refunds: [],
  },
  {
    id: 'dep-2',
    contractId: 'contract-def-222',
    propertyId: 'prop-1',
    amount: '1800.00',
    receivedDate: '2025-06-01T00:00:00.000Z',
    status: 'PARTIALLY_RETURNED',
    deductions: [{ id: 'ded-1', amount: '300.00' }],
    refunds: [{ id: 'ref-1', amount: '200.00' }],
  },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('DepositsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({
      data: { data: MOCK_DEPOSITS, total: 2, page: 1, limit: 25 },
    });
  });

  it('shows a spinner while loading', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<DepositsPage />, { wrapper });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders deposit rows after load', async () => {
    render(<DepositsPage />, { wrapper });
    // contractId.slice(0,8) = "contract" for both; check that we have 2 link cells
    await waitFor(() => expect(screen.getAllByText(/contract…/).length).toBe(2));
  });

  it('shows status badges', async () => {
    render(<DepositsPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('Held')).toBeInTheDocument());
    expect(screen.getByText('Partial Return')).toBeInTheDocument();
  });

  it('shows deposit amount and remaining balance', async () => {
    render(<DepositsPage />, { wrapper });
    // dep-1: amount=2400, remaining=2400 (both columns)
    // dep-2: amount=1800, remaining=1300
    await waitFor(() => expect(screen.getAllByText('2400.00').length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText('1300.00')).toBeInTheDocument();
    expect(screen.getByText('1800.00')).toBeInTheDocument();
  });

  it('shows empty state when no deposits', async () => {
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 25 } });
    render(<DepositsPage />, { wrapper });
    await waitFor(() => expect(screen.getByText(/no deposits/i)).toBeInTheDocument());
  });
});
