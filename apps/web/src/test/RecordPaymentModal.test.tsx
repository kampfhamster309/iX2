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

import { RecordPaymentModal } from '@/pages/accounting/RecordPaymentModal';

const MOCK_INVOICE = {
  id: 'inv-1',
  amountDue: '1200.00',
  amountPaid: '200.00',
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('RecordPaymentModal', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form', () => {
    render(<RecordPaymentModal invoice={MOCK_INVOICE} onClose={onClose} onSuccess={onSuccess} />, {
      wrapper,
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });

  it('pre-fills outstanding amount', () => {
    render(<RecordPaymentModal invoice={MOCK_INVOICE} onClose={onClose} onSuccess={onSuccess} />, {
      wrapper,
    });
    const amountInput = screen.getByLabelText(/amount/i);
    expect((amountInput as HTMLInputElement).value).toBe('1000.00'); // 1200 - 200
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<RecordPaymentModal invoice={MOCK_INVOICE} onClose={onClose} onSuccess={onSuccess} />, {
      wrapper,
    });
    await user.click(screen.getByRole('button', { name: /cancel|abbrechen/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows validation error if amount exceeds outstanding', async () => {
    const user = userEvent.setup();
    render(<RecordPaymentModal invoice={MOCK_INVOICE} onClose={onClose} onSuccess={onSuccess} />, {
      wrapper,
    });
    const amountInput = screen.getByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, '9999');
    await user.click(screen.getByRole('button', { name: /record payment/i }));

    await waitFor(() => expect(screen.getByText(/1000\.00/)).toBeInTheDocument());
  });

  it('submits successfully and calls onSuccess', async () => {
    const user = userEvent.setup();
    mockApi.post.mockResolvedValue({ data: { id: 'pay-1', amount: '1000.00' } });

    render(<RecordPaymentModal invoice={MOCK_INVOICE} onClose={onClose} onSuccess={onSuccess} />, {
      wrapper,
    });

    await user.click(screen.getByRole('button', { name: /record payment/i }));

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith(
        '/accounting/invoices/inv-1/payments',
        expect.objectContaining({ amount: 1000 }),
      ),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
