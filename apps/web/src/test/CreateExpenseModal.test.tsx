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

import { CreateExpenseModal } from '@/pages/accounting/CreateExpenseModal';

const MOCK_ACCOUNTS = [
  { id: 'acc-6', code: '6000', name: 'General Expenses', nameDe: 'Allgemeine Ausgaben' },
  { id: 'acc-7', code: '6100', name: 'Repairs & Maintenance', nameDe: null },
];

const MOCK_PROPERTIES = {
  data: [
    { id: 'prop-1', name: 'Main Street 10' },
    { id: 'prop-2', name: 'Oak Avenue 5' },
  ],
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('CreateExpenseModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockImplementation((url: string) => {
      if ((url as string).includes('accounts')) {
        return Promise.resolve({ data: MOCK_ACCOUNTS });
      }
      return Promise.resolve({ data: MOCK_PROPERTIES });
    });
  });

  it('renders the form', async () => {
    render(<CreateExpenseModal onClose={onClose} />, { wrapper });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/property/i)).toBeInTheDocument());
  });

  it('populates property and account dropdowns', async () => {
    render(<CreateExpenseModal onClose={onClose} />, { wrapper });
    await waitFor(() => expect(screen.getByText('Main Street 10')).toBeInTheDocument());
    expect(screen.getByText('6000 — General Expenses')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateExpenseModal onClose={onClose} />, { wrapper });
    await user.click(screen.getByRole('button', { name: /cancel|abbrechen/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('hides dueDate field when isPaid is checked', async () => {
    render(<CreateExpenseModal onClose={onClose} />, { wrapper });
    // isPaid defaults to true — due date should not be visible
    expect(screen.queryByLabelText(/due date/i)).not.toBeInTheDocument();
  });

  it('shows dueDate field when isPaid is unchecked', async () => {
    const user = userEvent.setup();
    render(<CreateExpenseModal onClose={onClose} />, { wrapper });
    await user.click(screen.getByLabelText(/paid immediately/i));
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
  });

  it('submits form and calls onClose on success', async () => {
    const user = userEvent.setup();
    mockApi.post.mockResolvedValue({ data: { id: 'exp-new' } });

    render(<CreateExpenseModal onClose={onClose} />, { wrapper });

    await waitFor(() => expect(screen.getByText('Main Street 10')).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText(/property/i), 'prop-1');
    await user.selectOptions(screen.getByLabelText(/expense account/i), 'acc-6');
    await user.type(screen.getByLabelText(/amount/i), '250');
    await user.type(screen.getByLabelText(/description/i), 'Office supplies');

    await user.click(screen.getByRole('button', { name: /create|erstellen/i }));

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith(
        '/accounting/expenses',
        expect.objectContaining({ amount: 250, description: 'Office supplies' }),
      ),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
