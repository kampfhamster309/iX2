import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: '1', email: 'admin@ix2.local', role: 'ADMIN' } }),
}));

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));

import { JournalEntryFormModal } from '@/pages/accounting/JournalEntryFormModal';

const MOCK_ACCOUNTS = [
  { id: 'acc-bank', code: '1000', name: 'Bank / Cash' },
  { id: 'acc-income', code: '4000', name: 'Rental Income' },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('JournalEntryFormModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/accounting/accounts')) return Promise.resolve({ data: MOCK_ACCOUNTS });
      if (url.includes('/properties')) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: [] });
    });
  });

  it('renders the form with two lines by default', async () => {
    render(<JournalEntryFormModal onClose={onClose} />, { wrapper });
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2));
    // Two account selects + date + description
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('shows "Unbalanced" when debits ≠ credits', async () => {
    const user = userEvent.setup();
    render(<JournalEntryFormModal onClose={onClose} />, { wrapper });

    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2));

    // Type 100 in first debit field (leave credit empty → unbalanced)
    const debitInputs = screen.getAllByPlaceholderText('0.00');
    await user.type(debitInputs[0], '100');

    await waitFor(() =>
      expect(screen.getByTestId('balance-status')).toHaveTextContent(
        /unbalanced|nicht ausgeglichen/i,
      ),
    );
  });

  it('shows "Balanced" when debits = credits', async () => {
    const user = userEvent.setup();
    render(<JournalEntryFormModal onClose={onClose} />, { wrapper });

    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2));

    const debitInputs = screen.getAllByPlaceholderText('0.00');
    // debit[0] = 200 (first line debit), credit[1] = 200 (second line credit)
    await user.type(debitInputs[0], '200');
    await user.type(debitInputs[3], '200'); // index: d0,c0,d1,c1

    await waitFor(() =>
      expect(screen.getByTestId('balance-status')).toHaveTextContent(/^(balanced|ausgeglichen)$/i),
    );
  });

  it('submit button is disabled when unbalanced', async () => {
    const user = userEvent.setup();
    render(<JournalEntryFormModal onClose={onClose} />, { wrapper });

    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2));

    const debitInputs = screen.getAllByPlaceholderText('0.00');
    await user.type(debitInputs[0], '50');

    const submitBtn = screen.getByRole('button', { name: /post entry|buchung/i });
    expect(submitBtn).toBeDisabled();
  });

  it('submit button is enabled when balanced', async () => {
    const user = userEvent.setup();
    render(<JournalEntryFormModal onClose={onClose} />, { wrapper });

    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2));

    const debitInputs = screen.getAllByPlaceholderText('0.00');
    await user.type(debitInputs[0], '300');
    await user.type(debitInputs[3], '300');

    const submitBtn = screen.getByRole('button', { name: /post entry|buchung/i });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<JournalEntryFormModal onClose={onClose} />, { wrapper });

    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2));
    await user.click(screen.getByRole('button', { name: /cancel|abbrechen/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('adds a new line when "Add line" is clicked', async () => {
    const user = userEvent.setup();
    render(<JournalEntryFormModal onClose={onClose} />, { wrapper });

    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2));

    const initialCount = screen.getAllByRole('combobox').length;
    await user.click(screen.getByText(/add line|position hinzufügen/i));

    await waitFor(() =>
      expect(screen.getAllByRole('combobox').length).toBeGreaterThan(initialCount),
    );
  });
});
