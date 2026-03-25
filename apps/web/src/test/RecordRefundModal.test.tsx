import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));

import { RecordRefundModal } from '@/pages/accounting/RecordRefundModal';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('RecordRefundModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form', () => {
    render(<RecordRefundModal depositId="dep-1" remaining={1500} onClose={onClose} />, {
      wrapper,
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });

  it('pre-fills amount with remaining balance', () => {
    render(<RecordRefundModal depositId="dep-1" remaining={1500} onClose={onClose} />, {
      wrapper,
    });
    expect((screen.getByLabelText(/amount/i) as HTMLInputElement).value).toBe('1500.00');
  });

  it('shows validation error when amount exceeds remaining', async () => {
    const user = userEvent.setup();
    render(<RecordRefundModal depositId="dep-1" remaining={1500} onClose={onClose} />, {
      wrapper,
    });
    const amountInput = screen.getByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, '9999');
    await user.click(screen.getByRole('button', { name: /record refund/i }));

    await waitFor(() => expect(screen.getByTestId('refund-error')).toHaveTextContent(/1500\.00/));
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<RecordRefundModal depositId="dep-1" remaining={1500} onClose={onClose} />, {
      wrapper,
    });
    await user.click(screen.getByRole('button', { name: /cancel|abbrechen/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('submits successfully and calls onClose', async () => {
    const user = userEvent.setup();
    mockApi.post.mockResolvedValue({ data: { id: 'dep-1', status: 'FULLY_RETURNED' } });

    render(<RecordRefundModal depositId="dep-1" remaining={1500} onClose={onClose} />, {
      wrapper,
    });

    await user.click(screen.getByRole('button', { name: /record refund/i }));

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith(
        '/accounting/deposits/dep-1/refunds',
        expect.objectContaining({ amount: 1500 }),
      ),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
